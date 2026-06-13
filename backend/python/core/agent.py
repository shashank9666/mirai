from typing import TypedDict, Annotated, Sequence, List
import operator
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
        
        # If model doesn't natively support tools, it might return JSON in content
        if not response.tool_calls and isinstance(response.content, str):
            import json
            text = response.content.strip()
            if text.startswith("{") and text.endswith("}"):
                try:
                    data = json.loads(text)
                    if "name" in data and "arguments" in data:
                        response.tool_calls.append({
                            "name": data["name"],
                            "args": data["arguments"],
                            "id": "call_" + str(hash(text))
                        })
                        response.content = ""
                except Exception:
                    pass
        return {"messages": [response]}

    async def run(self, messages: List[BaseMessage], session_id: str = "agent_stream"):
        compacted_messages = await compact_context(messages, self.llm)
        state = {"messages": compacted_messages}
        
        from core.event_bus import event_bus
        
        final_messages = []
        stream_buffer = ""
        is_json_stream = False

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
                        # Check if we are potentially streaming a JSON tool call
                        if not stream_buffer and text.lstrip().startswith("{"):
                            is_json_stream = True
                        
                        stream_buffer += text
                        
                        if is_json_stream:
                            # If it strictly looks like a JSON object containing "name", we suppress it from the UI stream
                            if '{"name"' in stream_buffer.replace(' ', ''):
                                continue
                            # If we realize it's just regular text starting with {, we release the buffer
                            if len(stream_buffer) > 20 and '{"name"' not in stream_buffer.replace(' ', ''):
                                is_json_stream = False
                                await event_bus.publish(session_id, {"type": "token", "content": stream_buffer})
                                stream_buffer = ""
                        else:
                            await event_bus.publish(session_id, {"type": "token", "content": text})

            elif kind == "on_tool_start":
                await event_bus.publish(session_id, {"type": "tool_start", "name": event["name"], "input": event["data"].get("input")})
            elif kind == "on_tool_end":
                await event_bus.publish(session_id, {"type": "tool_end", "name": event["name"], "output": event["data"].get("output")})
            elif kind == "on_chain_end" and event["name"] == "LangGraph":
                final_messages = event["data"].get("output", {}).get("messages", [])
                
        if not final_messages:
            final_messages = state["messages"]
            
        return {"messages": final_messages}
