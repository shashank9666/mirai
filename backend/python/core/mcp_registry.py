"""
MCP (Model Context Protocol) Registry — manages connections to external
services and tools via the Model Context Protocol.

Supports:
  - Filesystem MCP — read/write/search files
  - GitHub MCP — repos, issues, PRs, commits
  - Docker MCP — containers, images, compose
  - Browser MCP — headless browser automation
  - Database MCP — Postgres, SQLite, MySQL queries
  - Supabase MCP — Supabase project management
  - Render MCP — Render deployment management
  - Railway MCP — Railway deployment management
  - Custom MCP — user-defined servers

Each server is configured and managed independently, exposing its tools
to the LangChain agent framework.
"""

from __future__ import annotations
import json
import os
import subprocess
import threading
import time
from typing import Dict, Any, List, Optional, Callable
from dataclasses import dataclass, field, asdict
from langchain_core.tools import BaseTool, tool


# ---------------------------------------------------------------------------
# MCP Server descriptors
# ---------------------------------------------------------------------------

@dataclass
class MCPServerConfig:
    """Configuration for a single MCP server."""
    name: str
    enabled: bool = True
    command: str = ""
    args: List[str] = field(default_factory=list)
    env: Dict[str, str] = field(default_factory=dict)
    transport: str = "stdio"  # "stdio" or "http"
    url: str = ""            # For HTTP transport
    tools: List[str] = field(default_factory=list)
    status: str = "disconnected"  # "connected", "disconnected", "error"
    error: str = ""
    type: str = "custom"    # "filesystem", "github", "docker", etc.
    description: str = ""

    def to_dict(self) -> dict:
        d = asdict(self)
        d["env"] = {k: "***" if "key" in k.lower() or "token" in k.lower() or "secret" in k.lower() else v
                    for k, v in d["env"].items()}
        return d


# ---------------------------------------------------------------------------
# Built-in MCP server templates
# ---------------------------------------------------------------------------

BUILTIN_SERVERS: Dict[str, MCPServerConfig] = {
    "filesystem": MCPServerConfig(
        name="filesystem",
        type="filesystem",
        command="npx",
        args=["-y", "@modelcontextprotocol/server-filesystem", os.getcwd()],
        description="Read, write, search, and manage files in the workspace",
        tools=["read_file", "write_file", "search_files", "list_directory", "create_directory", "move_file", "delete_file"],
    ),
    "github": MCPServerConfig(
        name="github",
        type="github",
        command="npx",
        args=["-y", "@modelcontextprotocol/server-github"],
        description="GitHub API — repos, issues, PRs, commits, code search",
        env={"GITHUB_TOKEN": os.environ.get("GITHUB_TOKEN", "")},
        tools=["create_repository", "get_repository", "search_repositories",
               "create_issue", "list_issues", "create_pull_request",
               "get_file_contents", "search_code"],
    ),
    "docker": MCPServerConfig(
        name="docker",
        type="docker",
        command="docker",
        args=["run", "-i", "--rm", "-v", "/var/run/docker.sock:/var/run/docker.sock",
              "mcp/docker"],
        description="Docker — containers, images, compose management",
        tools=["list_containers", "list_images", "container_logs",
               "start_container", "stop_container", "compose_up", "compose_down"],
    ),
    "browser": MCPServerConfig(
        name="browser",
        type="browser",
        command="npx",
        args=["-y", "@modelcontextprotocol/server-browser"],
        description="Headless browser — navigate, click, extract data",
        tools=["navigate", "click", "type", "screenshot", "get_text", "evaluate_js"],
    ),
    "postgres": MCPServerConfig(
        name="postgres",
        type="database",
        command="npx",
        args=["-y", "@modelcontextprotocol/server-postgres"],
        description="PostgreSQL database — query, schema, tables",
        tools=["query", "list_tables", "describe_table", "execute_sql"],
    ),
}

# ---------------------------------------------------------------------------
# Registry
# ---------------------------------------------------------------------------

class MCPRegistry:
    """
    Manages MCP server connections and exposes tools to the agent system.
    Supports dynamic registration, connection, and tool discovery.
    """

    def __init__(self):
        self.servers: Dict[str, MCPServerConfig] = {}
        self._custom_tools: List[BaseTool] = []
        self._lock = threading.Lock()
        self._processes: Dict[str, subprocess.Popen] = {}
        self._tool_handlers: Dict[str, Callable] = {}
        self._initialize_defaults()

    def _initialize_defaults(self):
        """Register built-in server templates."""
        for name, cfg in BUILTIN_SERVERS.items():
            self.servers[name] = cfg

    def register_server(self, config: MCPServerConfig) -> bool:
        """Register an MCP server configuration."""
        with self._lock:
            self.servers[config.name] = config
        print(f"[MCP] Registered server: {config.name} ({config.type})")
        return True

    def register_server_from_dict(self, name: str, config: dict) -> bool:
        """Register from a dictionary (e.g., from frontend settings)."""
        cfg = MCPServerConfig(
            name=name,
            enabled=config.get("enabled", True),
            command=config.get("command", ""),
            args=config.get("args", []),
            env=config.get("env", {}),
            transport=config.get("transport", "stdio"),
            url=config.get("url", ""),
            tools=config.get("tools", []),
            type=config.get("type", "custom"),
        )
        return self.register_server(cfg)

    def remove_server(self, name: str) -> bool:
        """Remove a registered server."""
        with self._lock:
            if name in self.servers:
                del self.servers[name]
                return True
        return False

    def get_server(self, name: str) -> Optional[MCPServerConfig]:
        return self.servers.get(name)

    def list_servers(self) -> List[MCPServerConfig]:
        return list(self.servers.values())

    def list_servers_dict(self) -> List[dict]:
        return [s.to_dict() for s in self.servers.values()]

    # ------------------------------------------------------------------
    # Connection management
    # ------------------------------------------------------------------

    def connect_server(self, name: str) -> bool:
        """Attempt to connect (start) an MCP server process."""
        cfg = self.servers.get(name)
        if not cfg or not cfg.enabled:
            return False

        if name in self._processes and self._processes[name].poll() is None:
            cfg.status = "connected"
            return True  # Already running

        try:
            env = os.environ.copy()
            env.update(cfg.env)

            if cfg.transport == "stdio" and cfg.command:
                process = subprocess.Popen(
                    [cfg.command] + cfg.args,
                    stdin=subprocess.PIPE,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    env=env,
                    text=True,
                )
                self._processes[name] = process
                cfg.status = "connected"
                cfg.error = ""
                print(f"[MCP] Connected server: {name}")
                return True
            elif cfg.transport == "http" and cfg.url:
                # HTTP-based MCP — just mark as connected, validate on first use
                cfg.status = "connected"
                cfg.error = ""
                print(f"[MCP] Registered HTTP server: {name} @ {cfg.url}")
                return True
            else:
                cfg.status = "error"
                cfg.error = "No command or URL specified"
                return False

        except Exception as e:
            cfg.status = "error"
            cfg.error = str(e)
            print(f"[MCP] Failed to connect {name}: {e}")
            return False

    def disconnect_server(self, name: str) -> bool:
        """Disconnect (stop) an MCP server."""
        if name in self._processes:
            proc = self._processes[name]
            try:
                proc.terminate()
                proc.wait(timeout=5)
            except Exception:
                proc.kill()
            del self._processes[name]

        cfg = self.servers.get(name)
        if cfg:
            cfg.status = "disconnected"
        return True

    def connect_all(self) -> dict:
        """Connect all enabled servers. Returns results keyed by name."""
        results = {}
        for name, cfg in self.servers.items():
            if cfg.enabled:
                results[name] = self.connect_server(name)
            else:
                results[name] = False
        return results

    def disconnect_all(self):
        """Disconnect all running servers."""
        for name in list(self._processes.keys()):
            self.disconnect_server(name)

    # ------------------------------------------------------------------
    # Tool registration
    # ------------------------------------------------------------------

    def register_tool(self, t: BaseTool):
        """Register a custom tool (not from an MCP server)."""
        with self._lock:
            self._custom_tools.append(t)

    def register_function_tool(self, name: str, fn: Callable, description: str = ""):
        """Register a Python function as a tool."""
        t = tool(name, description=description)(fn)
        self.register_tool(t)

    def get_all_tools(self) -> List[BaseTool]:
        """Return all available tools (builtin + custom + MCP-derived)."""
        tools = list(self._custom_tools)

        # For each connected server, create proxy tools
        for name, cfg in self.servers.items():
            if cfg.status == "connected" and cfg.tools:
                for tool_name in cfg.tools:
                    proxy = self._create_proxy_tool(name, tool_name)
                    tools.append(proxy)

        return tools

    def _create_proxy_tool(self, server_name: str, tool_name: str) -> BaseTool:
        """Create a LangChain-compatible proxy tool that delegates to an MCP server."""

        @tool(f"{server_name}_{tool_name}")
        def mcp_proxy_tool(**kwargs) -> str:
            """Execute {tool_name} on {server_name} MCP server."""
            return self._execute_mcp_tool(server_name, tool_name, kwargs)

        mcp_proxy_tool.name = f"{server_name}_{tool_name}"
        mcp_proxy_tool.description = f"Execute {tool_name} via {server_name} MCP server"
        return mcp_proxy_tool

    def _execute_mcp_tool(self, server_name: str, tool_name: str, args: dict) -> str:
        """Execute a tool on an MCP server via stdio JSON-RPC."""
        cfg = self.servers.get(server_name)
        if not cfg or cfg.status != "connected":
            return f"Error: Server '{server_name}' is not connected"

        proc = self._processes.get(server_name)
        if not proc or proc.poll() is not None:
            # Try to reconnect
            if not self.connect_server(server_name):
                return f"Error: Could not connect to server '{server_name}'"
            proc = self._processes.get(server_name)

        # Build JSON-RPC request
        request = {
            "jsonrpc": "2.0",
            "method": "tools/call",
            "params": {
                "name": tool_name,
                "arguments": args,
            },
            "id": 1,
        }

        try:
            proc.stdin.write(json.dumps(request) + "\n")
            proc.stdin.flush()

            response_line = proc.stdout.readline()
            if response_line:
                response = json.loads(response_line.strip())
                if "result" in response:
                    content = response["result"].get("content", "")
                    if isinstance(content, list):
                        return "\n".join(c.get("text", str(c)) for c in content)
                    return str(content)
                elif "error" in response:
                    return f"Error from {server_name}: {response['error'].get('message', str(response['error']))}"
            return f"Warning: No response from {server_name}"

        except Exception as e:
            return f"Error executing {tool_name} on {server_name}: {e}"

    def test_connection(self, name: str) -> dict:
        """Test if a server is reachable and functional."""
        cfg = self.servers.get(name)
        if not cfg:
            return {"success": False, "error": "Server not found"}

        was_connected = cfg.status == "connected"
        connected = self.connect_server(name)

        if connected and not was_connected:
            # If we just connected, disconnect to preserve state
            self.disconnect_server(name)

        return {
            "success": connected,
            "status": "connected" if connected else "error",
            "error": cfg.error if not connected else "",
        }

    def to_dict(self) -> dict:
        """Export all servers as list of dicts."""
        return self.list_servers_dict()

    def save_config(self, path: str = ""):
        """Save MCP server configurations to a JSON file."""
        if not path:
            mirai_dir = os.path.join(os.path.expanduser("~"), '.mirai')
            os.makedirs(mirai_dir, exist_ok=True)
            path = os.path.join(mirai_dir, 'mcp_servers.json')

        data = []
        for cfg in self.servers.values():
            d = asdict(cfg)
            data.append(d)

        with open(path, 'w') as f:
            json.dump(data, f, indent=2)
        return path

    def load_config(self, path: str = "") -> bool:
        """Load MCP server configurations from a JSON file."""
        if not path:
            mirai_dir = os.path.join(os.path.expanduser("~"), '.mirai')
            path = os.path.join(mirai_dir, 'mcp_servers.json')

        if not os.path.exists(path):
            return False

        try:
            with open(path, 'r') as f:
                data = json.load(f)
            for item in data:
                cfg = MCPServerConfig(**item)
                self.servers[cfg.name] = cfg
            return True
        except Exception as e:
            print(f"[MCP] Error loading config: {e}")
            return False


# Global singleton
registry = MCPRegistry()