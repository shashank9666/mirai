from typing import TypedDict, Annotated, Sequence, List, Optional, Dict, Any
import operator
import json
import contextvars
from langgraph.graph import StateGraph, END

# Context variable to hold auto-approve settings for the current execution context
auto_approve_settings_var = contextvars.ContextVar("auto_approve_settings", default={})
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
        print(f"--- [DEBUG agent.py] Calling llm.ainvoke with {len(messages)} messages:")
        for idx, m in enumerate(messages):
            content_safe = repr(m.content).encode('ascii', errors='backslashreplace').decode('ascii')
            print(f"  [{idx}] type={type(m).__name__} content={content_safe[:100]}")
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

    async def run(self, messages: List[BaseMessage], session_id: str = "agent_stream", auto_approve_settings: dict = None, workspace_path: str = None):
        if auto_approve_settings is None:
            auto_approve_settings = {}
        token = auto_approve_settings_var.set(auto_approve_settings)
        try:
            compacted_messages = await compact_context(messages, self.llm)
            state = {"messages": compacted_messages}
            
            from core.event_bus import event_bus
            await event_bus.publish(session_id, {
                "type": "workflow_step",
                "id": "plan",
                "title": "Planning",
                "status": "running",
                "category": "plan",
                "detail": "Understanding the request and selecting tools."
            })
            
            # Load dynamic skills
            if workspace_path:
                from core.dynamic_skills import load_dynamic_tools
                try:
                    dynamic_tools = load_dynamic_tools(workspace_path)
                    if dynamic_tools:
                        # Append and re-bind tools
                        self.tools.extend(dynamic_tools)
                        self.tool_names = {t.name for t in self.tools}
                        self.llm = self.llm.bind_tools(self.tools)
                        # Rebuild graph to include new tools
                        self.graph = self._build_graph()
                except Exception as e:
                    print(f"Error loading dynamic skills: {e}")
            
            final_messages = []
            stream_buffer = ""
            buffering_tool_json = False
            tool_invocation_counter = 0

            def _categorize_tool(name):
                """Classify tool into UI-friendly categories."""
                n = name.lower()
                if n in ('read_file', 'list_directory', 'search_files', 'grep_search'):
                    return 'read'
                elif n in ('write_file', 'replace_file_content', 'multi_replace_file_content'):
                    return 'edit'
                elif n in ('execute_command', 'run_command'):
                    return 'command'
                elif n in ('search_web', 'web_search'):
                    return 'search'
                return 'tool'

            def _humanize_tool(name, input_data):
                """Create human-readable step title from tool name and input."""
                n = name.lower()
                detail_input = input_data if isinstance(input_data, dict) else {}

                if n == 'read_file':
                    path = detail_input.get('path', '')
                    fname = path.rsplit('/', 1)[-1].rsplit('\\', 1)[-1] if path else 'file'
                    return f"Reading {fname}"
                elif n == 'list_directory':
                    path = detail_input.get('path', '') or '.'
                    return f"Listing {path}"
                elif n == 'write_file':
                    path = detail_input.get('path', '')
                    fname = path.rsplit('/', 1)[-1].rsplit('\\', 1)[-1] if path else 'file'
                    return f"Writing {fname}"
                elif n == 'execute_command':
                    cmd = detail_input.get('command', 'command')
                    short = cmd[:40] + ('…' if len(cmd) > 40 else '')
                    return f"Running `{short}`"
                elif n == 'search_files' or n == 'grep_search':
                    query = detail_input.get('query', detail_input.get('Query', ''))
                    return f"Searching for '{query[:30]}'"
                else:
                    return f"Running {name}"

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
                    tool_invocation_counter += 1
                    step_id = f"tool:{event['name']}:{tool_invocation_counter}"
                    input_data = event["data"].get("input")
                    category = _categorize_tool(event["name"])
                    title = _humanize_tool(event["name"], input_data)

                    await event_bus.publish(session_id, {
                        "type": "workflow_step",
                        "id": step_id,
                        "title": title,
                        "status": "running",
                        "category": category,
                        "toolName": event["name"],
                        "detail": input_data,
                    })
                    await event_bus.publish(session_id, {
                        "type": "tool_start",
                        "name": event["name"],
                        "input": input_data,
                        "stepId": step_id,
                    })
                elif kind == "on_tool_end":
                    output = event["data"].get("output")
                    approval_required = False
                    if isinstance(output, str):
                        try:
                            parsed = json.loads(output)
                            approval_required = isinstance(parsed, dict) and parsed.get("approval_required") is True
                        except json.JSONDecodeError:
                            approval_required = False

                    # Find the matching step id for this tool end
                    completed_step_id = f"tool:{event['name']}:{tool_invocation_counter}"
                    category = _categorize_tool(event["name"])

                    await event_bus.publish(session_id, {
                        "type": "workflow_step",
                        "id": completed_step_id,
                        "title": f"Completed {event['name']}",
                        "status": "waiting_approval" if approval_required else "completed",
                        "category": category,
                        "toolName": event["name"],
                        "detail": "Waiting for user approval." if approval_required else None,
                    })
                    await event_bus.publish(session_id, {
                        "type": "tool_end",
                        "name": event["name"],
                        "output": output,
                        "stepId": completed_step_id,
                    })
                elif kind == "on_chain_end" and event["name"] == "LangGraph":
                    final_messages = event["data"].get("output", {}).get("messages", [])

            if stream_buffer:
                if not self._parse_text_tool_call(stream_buffer):
                    await event_bus.publish(session_id, {"type": "token", "content": stream_buffer})

            if not final_messages:
                final_messages = state["messages"]
            # Mark plan as completed
            await event_bus.publish(session_id, {
                "type": "workflow_step",
                "id": "plan",
                "title": "Planning",
                "status": "completed",
                "category": "plan",
            })
            await event_bus.publish(session_id, {
                "type": "workflow_step",
                "id": "final",
                "title": "Response ready",
                "status": "completed",
                "category": "plan",
            })
                
            return {"messages": final_messages}
        finally:
            auto_approve_settings_var.reset(token)
