from typing import TypedDict, Annotated, Sequence, List, Optional, Dict, Any
import operator
import json
from langgraph.graph import StateGraph, END
from langgraph.prebuilt import ToolNode, tools_condition
from langchain_core.messages import BaseMessage, HumanMessage, AIMessage
from langchain_core.tools import tool
from core.llm import get_llm
from core.context_compactor import compact_context

@tool
def dummy_search(query: str) -> str:
    """A dummy search tool to test tool execution."""
    return f"Search results for: {query}"

class AgentState(TypedDict):
    """
    State representing the agent's memory during an execution loop.
    """
    messages: Annotated[Sequence[BaseMessage], operator.add]

class MiraiAgent:
    def __init__(self, provider="openai", model="gpt-4o", api_key="", base_url=""):
        from core.tool_registry import tool_registry
        self.tools = tool_registry.get_all_tools()
        # Fallback to dummy if empty
        if not self.tools:
            self.tools = [dummy_search]
        raw_llm = get_llm(provider, model, api_key, base_url)
        self.llm = raw_llm.bind_tools(self.tools)
        self.tool_names = {t.name for t in self.tools}
        self.graph = self._build_graph()

    def _build_graph(self):
        """
        Builds the LangGraph state graph.
        """
        builder = StateGraph(AgentState)
        builder.add_node("reason", self._reason_node)
        builder.add_node("tools", ToolNode(self.tools))
        
        builder.set_entry_point("reason")
        builder.add_conditional_edges("reason", tools_condition, {"tools": "tools", "__end__": END})
        builder.add_edge("tools", "reason")
        return builder.compile()

    async def _reason_node(self, state: AgentState):
        messages = state['messages']
        response = await self.llm.ainvoke(messages)
        tool_call = self._parse_text_tool_call(response.content)
        if not response.tool_calls and tool_call:
            response.tool_calls = [tool_call]
            response.content = ""
        return {"messages": [response]}

    def _parse_text_tool_call(self, content: Any) -> Optional[Dict[str, Any]]:
        if not isinstance(content, str):
            return None

        text = content.strip()
        if text.startswith("```"):
            lines = text.splitlines()
            if len(lines) >= 3 and lines[0].startswith("```") and lines[-1].strip().startswith("```"):
                text = "\n".join(lines[1:-1]).strip()

        if not text.startswith("{") or not text.endswith("}"):
            return None

        try:
            data = json.loads(text)
        except json.JSONDecodeError:
            return None

        if not isinstance(data, dict):
            return None

        name = data.get("name")
        args = data.get("arguments")
        if name not in self.tool_names or not isinstance(args, dict):
            return None

        return {
            "name": name,
            "args": args,
            "id": "call_" + str(abs(hash(text))),
        }

    def _is_potential_json_tool_call(self, text: str) -> bool:
        stripped = text.lstrip()
        return stripped.startswith("{") or stripped.startswith("```")

    async def run(self, messages: List[BaseMessage], session_id: str = "agent_stream"):
        compacted_messages = await compact_context(messages, self.llm)
        state = {"messages": compacted_messages}
        
        from core.event_bus import event_bus
        
        final_messages = []
        stream_buffer = ""
        buffering_tool_json = False

        async for event in self.graph.astream_events(state, version="v2"):
            kind = event["event"]
            if kind == "on_chat_model_stream":
                chunk = event["data"]["chunk"]
                if hasattr(chunk, 'content') and chunk.content:
                    text = ""
                    if isinstance(chunk.content, str):
                        text = chunk.content
                    elif isinstance(chunk.content, list):
                        text = "".join([item.get("text", "") for item in chunk.content if isinstance(item, dict) and item.get("type") == "text"])
                    
                    if text:
                        if not stream_buffer and self._is_potential_json_tool_call(text):
                            buffering_tool_json = True

                        if buffering_tool_json:
                            stream_buffer += text
                            if self._parse_text_tool_call(stream_buffer):
                                stream_buffer = ""
                                buffering_tool_json = False
                            elif len(stream_buffer) > 4096:
                                await event_bus.publish(session_id, {"type": "token", "content": stream_buffer})
                                stream_buffer = ""
                                buffering_tool_json = False
                        else:
                            await event_bus.publish(session_id, {"type": "token", "content": text})

            elif kind == "on_tool_start":
                await event_bus.publish(session_id, {"type": "tool_start", "name": event["name"], "input": event["data"].get("input")})
            elif kind == "on_tool_end":
                await event_bus.publish(session_id, {"type": "tool_end", "name": event["name"], "output": event["data"].get("output")})
            elif kind == "on_chain_end" and event["name"] == "LangGraph":
                final_messages = event["data"].get("output", {}).get("messages", [])

        if stream_buffer:
            if not self._parse_text_tool_call(stream_buffer):
                await event_bus.publish(session_id, {"type": "token", "content": stream_buffer})
                
        if not final_messages:
            final_messages = state["messages"]
            
        return {"messages": final_messages}
