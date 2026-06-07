from typing import Dict, Any, List
from langchain_core.tools import tool

# Stub for managing MCP (Model Context Protocol) servers

class MCPRegistry:
    def __init__(self):
        self.servers: Dict[str, Any] = {}
        self.tools: List[Any] = []

    def register_server(self, name: str, server_config: Dict[str, Any]):
        """
        Register an MCP server connection.
        server_config typically contains command, args, and env.
        """
        self.servers[name] = server_config
        print(f"Registered MCP Server: {name}")

    def get_registered_tools(self) -> List[Any]:
        """
        Return LangChain-compatible tools aggregated from all MCP servers.
        """
        return self.tools

    def list_tools(self, server_name: str):
        """
        Retrieves available tools from a given MCP server.
        """
        if server_name in self.servers:
            return self.servers[server_name].get("tools", [])
        return []

registry = MCPRegistry()
