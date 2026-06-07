from typing import Any, Callable, Dict, List
from pydantic import BaseModel
from langchain_core.tools import BaseTool, tool
import inspect

class ToolRegistry:
    """
    A dynamic registry for managing and validating tools.
    Allows loading tools from different modules and exporting them to the agent.
    """
    def __init__(self):
        self._tools: Dict[str, BaseTool] = {}

    def register(self, t: BaseTool):
        """
        Register a LangChain tool.
        """
        if not isinstance(t, BaseTool):
            raise ValueError(f"Expected a LangChain BaseTool, got {type(t)}")
        self._tools[t.name] = t

    def register_function(self, func: Callable):
        """
        Convenience method to register a python function directly as a tool.
        """
        t = tool()(func)
        self.register(t)

    def get_tool(self, name: str) -> BaseTool:
        """
        Retrieve a tool by name.
        """
        if name not in self._tools:
            raise KeyError(f"Tool {name} not found in registry.")
        return self._tools[name]

    def get_all_tools(self) -> List[BaseTool]:
        """
        Returns all registered tools.
        """
        return list(self._tools.values())

    def clear(self):
        self._tools.clear()

# Global singleton tool registry
tool_registry = ToolRegistry()
