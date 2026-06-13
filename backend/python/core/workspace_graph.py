"""
Workspace Knowledge Graph — indexes code structure into a queryable graph.

Stores:
  - Files & Folders
  - Imports & Exports
  - Functions & Classes
  - Routes (for web frameworks)
  - Components (React, Vue, etc.)
  - Hooks & Utils
  - Database Models
  - Dependencies

Stored in SQLite for fast, persistent queries.
"""

from __future__ import annotations
import os
import re
import json
import sqlite3
import threading
import hashlib
import time
from typing import Dict, List, Optional, Set, Tuple, Any
from pathlib import Path
from dataclasses import dataclass, field, asdict


MIRAI_DIR = os.path.join(os.path.expanduser("~"), '.mirai')
GRAPH_DB_PATH = os.path.join(MIRAI_DIR, 'workspace_graph.db')

# ---------------------------------------------------------------------------
# Node types
# ---------------------------------------------------------------------------

NODE_FILE = "file"
NODE_DIR = "directory"
NODE_FUNCTION = "function"
NODE_CLASS = "class"
NODE_IMPORT = "import"
NODE_EXPORT = "export"
NODE_ROUTE = "route"
NODE_COMPONENT = "component"
NODE_HOOK = "hook"
NODE_MODEL = "model"
NODE_DEPENDENCY = "dependency"
NODE_VARIABLE = "variable"
NODE_TYPE = "type"
NODE_API = "api"


@dataclass
class GraphNode:
    id: str
    type: str
    name: str
    file_path: str
    line: int = 0
    column: int = 0
    parent_id: Optional[str] = None
    metadata: dict = field(default_factory=dict)

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class GraphEdge:
    source_id: str
    target_id: str
    relation: str   # "imports", "extends", "calls", "contains", "defines", "uses", "routes_to"

    def to_dict(self) -> dict:
        return asdict(self)


# ---------------------------------------------------------------------------
# The Graph
# ---------------------------------------------------------------------------

class WorkspaceGraph:
    """
    Persisted directed graph of workspace code structure.
    Thread-safe with SQLite backend.
    """

    def __init__(self, workspace_path: str):
        self.workspace_path = os.path.abspath(workspace_path)
        os.makedirs(MIRAI_DIR, exist_ok=True)
        self.lock = threading.Lock()
        self._init_db()
        self._node_cache: Dict[str, GraphNode] = {}
        self._edge_cache: List[GraphEdge] = []

    def _init_db(self):
        with self.lock:
            conn = sqlite3.connect(GRAPH_DB_PATH)
            conn.execute("PRAGMA journal_mode=WAL")
            conn.execute("""
                CREATE TABLE IF NOT EXISTS nodes (
                    id TEXT PRIMARY KEY,
                    type TEXT NOT NULL,
                    name TEXT NOT NULL,
                    file_path TEXT NOT NULL,
                    line INTEGER DEFAULT 0,
                    column INTEGER DEFAULT 0,
                    parent_id TEXT,
                    metadata TEXT DEFAULT '{}',
                    workspace_hash TEXT NOT NULL,
                    updated_at REAL NOT NULL
                )
            """)
            conn.execute("""
                CREATE TABLE IF NOT EXISTS edges (
                    source_id TEXT NOT NULL,
                    target_id TEXT NOT NULL,
                    relation TEXT NOT NULL,
                    workspace_hash TEXT NOT NULL,
                    PRIMARY KEY (source_id, target_id, relation)
                )
            """)
            conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_nodes_file ON nodes(file_path, workspace_hash)
            """)
            conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_nodes_type ON nodes(type, workspace_hash)
            """)
            conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_edges_source ON edges(source_id)
            """)
            conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_edges_target ON edges(target_id)
            """)
            conn.commit()
            conn.close()

    @property
    def _hash(self) -> str:
        return hashlib.md5(self.workspace_path.encode()).hexdigest()[:12]

    def clear(self):
        """Remove all nodes/edges for this workspace."""
        with self.lock:
            conn = sqlite3.connect(GRAPH_DB_PATH)
            conn.execute("DELETE FROM nodes WHERE workspace_hash = ?", (self._hash,))
            conn.execute("DELETE FROM edges WHERE workspace_hash = ?", (self._hash,))
            conn.commit()
            conn.close()
        self._node_cache.clear()
        self._edge_cache.clear()

    def add_node(self, node: GraphNode) -> str:
        node_id = node.id or f"{node.type}:{node.file_path}:{node.name}:{node.line}"
        with self.lock:
            conn = sqlite3.connect(GRAPH_DB_PATH)
            conn.execute("""
                INSERT OR REPLACE INTO nodes
                (id, type, name, file_path, line, column, parent_id, metadata, workspace_hash, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                node_id, node.type, node.name, node.file_path, node.line, node.column,
                node.parent_id, json.dumps(node.metadata), self._hash, time.time()
            ))
            conn.commit()
            conn.close()
        self._node_cache[node_id] = node
        return node_id

    def add_edge(self, edge: GraphEdge):
        with self.lock:
            conn = sqlite3.connect(GRAPH_DB_PATH)
            conn.execute("""
                INSERT OR REPLACE INTO edges (source_id, target_id, relation, workspace_hash)
                VALUES (?, ?, ?, ?)
            """, (edge.source_id, edge.target_id, edge.relation, self._hash))
            conn.commit()
            conn.close()
        self._edge_cache.append(edge)

    def get_file_nodes(self, file_path: str) -> List[GraphNode]:
        """Get all nodes from a specific file."""
        results = []
        with self.lock:
            conn = sqlite3.connect(GRAPH_DB_PATH)
            cursor = conn.execute(
                "SELECT id, type, name, file_path, line, column, parent_id, metadata FROM nodes "
                "WHERE file_path = ? AND workspace_hash = ?",
                (file_path, self._hash)
            )
            for row in cursor.fetchall():
                results.append(GraphNode(
                    id=row[0], type=row[1], name=row[2], file_path=row[3],
                    line=row[4], column=row[5], parent_id=row[6],
                    metadata=json.loads(row[7] or '{}')
                ))
            conn.close()
        return results

    def find_by_type(self, node_type: str) -> List[GraphNode]:
        """Find all nodes of a given type (e.g., 'function', 'class', 'route')."""
        results = []
        with self.lock:
            conn = sqlite3.connect(GRAPH_DB_PATH)
            cursor = conn.execute(
                "SELECT id, type, name, file_path, line, column, parent_id, metadata FROM nodes "
                "WHERE type = ? AND workspace_hash = ?",
                (node_type, self._hash)
            )
            for row in cursor.fetchall():
                results.append(GraphNode(
                    id=row[0], type=row[1], name=row[2], file_path=row[3],
                    line=row[4], column=row[5], parent_id=row[6],
                    metadata=json.loads(row[7] or '{}')
                ))
            conn.close()
        return results

    def search_nodes(self, query: str, node_type: Optional[str] = None) -> List[GraphNode]:
        """Search nodes by name (partial match)."""
        results = []
        with self.lock:
            conn = sqlite3.connect(GRAPH_DB_PATH)
            sql = "SELECT id, type, name, file_path, line, column, parent_id, metadata FROM nodes WHERE name LIKE ? AND workspace_hash = ?"
            params = [f"%{query}%", self._hash]
            if node_type:
                sql += " AND type = ?"
                params.append(node_type)
            cursor = conn.execute(sql, params)
            for row in cursor.fetchall():
                results.append(GraphNode(
                    id=row[0], type=row[1], name=row[2], file_path=row[3],
                    line=row[4], column=row[5], parent_id=row[6],
                    metadata=json.loads(row[7] or '{}')
                ))
            conn.close()
        return results

    def get_related(self, node_id: str, relation: Optional[str] = None) -> List[Tuple[GraphNode, str]]:
        """Get all nodes directly related to a node (with relation type)."""
        results = []
        with self.lock:
            conn = sqlite3.connect(GRAPH_DB_PATH)
            sql = """
                SELECT n.id, n.type, n.name, n.file_path, n.line, n.column, n.parent_id, n.metadata, e.relation
                FROM edges e
                JOIN nodes n ON (n.id = e.target_id OR n.id = e.source_id)
                WHERE (e.source_id = ? OR e.target_id = ?) AND n.workspace_hash = ?
            """
            params = [node_id, node_id, self._hash]
            if relation:
                sql += " AND e.relation = ?"
                params.append(relation)
            cursor = conn.execute(sql, params)
            for row in cursor.fetchall():
                node = GraphNode(
                    id=row[0], type=row[1], name=row[2], file_path=row[3],
                    line=row[4], column=row[5], parent_id=row[6],
                    metadata=json.loads(row[7] or '{}')
                )
                results.append((node, row[8]))
            conn.close()
        return results

    def get_statistics(self) -> dict:
        """Return summary statistics of the indexed workspace."""
        stats = {"files": 0, "functions": 0, "classes": 0, "routes": 0,
                 "components": 0, "imports": 0, "total_nodes": 0, "total_edges": 0}
        with self.lock:
            conn = sqlite3.connect(GRAPH_DB_PATH)
            cursor = conn.execute(
                "SELECT type, COUNT(*) FROM nodes WHERE workspace_hash = ? GROUP BY type",
                (self._hash,)
            )
            for row in cursor.fetchall():
                t, count = row
                stats["total_nodes"] += count
                if t in stats:
                    stats[t] += count
                else:
                    stats[f"{t}s"] = stats.get(f"{t}s", 0) + count
            cursor = conn.execute(
                "SELECT COUNT(*) FROM edges WHERE workspace_hash = ?",
                (self._hash,)
            )
            stats["total_edges"] = cursor.fetchone()[0]
            conn.close()
        return stats

    def find_unused_imports(self) -> List[dict]:
        """Detect imports that don't have corresponding usage in the file."""
        # This is a simplified version — real detection needs AST parsing
        results = []
        imports = self.find_by_type(NODE_IMPORT)
        for imp in imports:
            related = self.get_related(imp.id, "uses")
            if not related:
                results.append({
                    "file": imp.file_path,
                    "import_name": imp.name,
                    "line": imp.line,
                })
        return results

    def find_circular_imports(self) -> List[List[str]]:
        """Detect circular dependency chains between files."""
        with self.lock:
            conn = sqlite3.connect(GRAPH_DB_PATH)
            cursor = conn.execute("""
                SELECT DISTINCT e.source_id, e.target_id
                FROM edges e
                JOIN nodes ns ON ns.id = e.source_id AND ns.type = 'import'
                JOIN nodes nt ON nt.id = e.target_id AND nt.type = 'file'
                WHERE e.workspace_hash = ?
            """, (self._hash,))
            edges = [(r[0], r[1]) for r in cursor.fetchall()]
            conn.close()

        # Build adjacency list
        graph: Dict[str, List[str]] = {}
        for src, tgt in edges:
            if src not in graph:
                graph[src] = []
            graph[src].append(tgt)

        cycles = []
        visited: Set[str] = set()
        path: List[str] = []

        def dfs(node: str):
            if node in path:
                cycle_start = path.index(node)
                cycles.append(path[cycle_start:] + [node])
                return
            if node in visited:
                return
            visited.add(node)
            path.append(node)
            for neighbor in graph.get(node, []):
                dfs(neighbor)
            path.pop()

        for node in graph:
            dfs(node)

        return cycles


# ---------------------------------------------------------------------------
# Indexer — parses files and populates the graph
# ---------------------------------------------------------------------------

# Regex patterns for various languages
PATTERNS = {
    "import_python": re.compile(r'^from\s+(\S+)\s+import\s+(\S+)|^import\s+(\S+)', re.MULTILINE),
    "import_js": re.compile(r'import\s+(?:\{[^}]*\}|\*\s+as\s+\S+|\S+)\s+from\s+[\'"]([^\'"]+)[\'"]', re.MULTILINE),
    "import_ts": re.compile(r'import\s+(?:\{[^}]*\}|\*\s+as\s+\S+|\S+|type\s+\{[^}]*\})\s+from\s+[\'"]([^\'"]+)[\'"]', re.MULTILINE),
    "function": re.compile(r'(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(', re.MULTILINE),
    "arrow_function": re.compile(r'(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\(', re.MULTILINE),
    "class": re.compile(r'(?:export\s+)?(?:abstract\s+)?class\s+(\w+)', re.MULTILINE),
    "route_flask": re.compile(r'@\w+\.route\([\'"]([^\'"]+)[\'"]', re.MULTILINE),
    "route_express": re.compile(r'(?:router|app)\.(?:get|post|put|delete|patch)\s*\(\s*[\'"]([^\'"]+)[\'"]', re.MULTILINE),
    "route_nextjs": re.compile(r'(?:export\s+)?(?:async\s+)?function\s+(?:GET|POST|PUT|DELETE|PATCH)\s*\(', re.MULTILINE),
    "component_react": re.compile(r'(?:export\s+)?(?:default\s+)?function\s+([A-Z]\w*)\s*\(?\s*(?:props|\{)/', re.MULTILINE),
    "component_arrow": re.compile(r'(?:export\s+)?(?:const|let|var)\s+([A-Z]\w*)\s*:\s*(?:React\.)?FC|<', re.MULTILINE),
    "hook": re.compile(r'(?:export\s+)?(?:const|let|var|function)\s+(use\w+)', re.MULTILINE),
    "model_sqlalchemy": re.compile(r'class\s+(\w+)\s*\(\s*(?:db\.Model|Base)\s*\)', re.MULTILINE),
    "decorator": re.compile(r'@(\w+)', re.MULTILINE),
}


class WorkspaceIndexer:
    """
    Parses files in the workspace and populates the WorkspaceGraph.
    Supports Python, JavaScript/TypeScript, JSX/TSX, and more.
    """

    def __init__(self, workspace_path: str):
        self.graph = WorkspaceGraph(workspace_path)
        self.workspace_path = workspace_path
        # File extensions to parse
        self.supported_extensions = {'.py', '.js', '.jsx', '.ts', '.tsx', '.vue', '.svelte', '.rb', '.go'}

    def index_all(self) -> dict:
        """Index the entire workspace. Returns statistics."""
        self.graph.clear()
        start = time.time()
        files_scanned = 0
        nodes_added = 0

        for root, dirs, files in os.walk(self.workspace_path):
            # Skip node_modules, .git, __pycache__, etc.
            dirs[:] = [d for d in dirs if not d.startswith('.') and d not in ('node_modules', '__pycache__', 'venv', 'env', 'dist', 'build')]

            for file in files:
                ext = os.path.splitext(file)[1].lower()
                if ext not in self.supported_extensions:
                    continue

                file_path = os.path.join(root, file)
                rel_path = os.path.relpath(file_path, self.workspace_path)
                files_scanned += 1

                try:
                    count = self._index_file(file_path, rel_path)
                    nodes_added += count
                except Exception as e:
                    print(f"  [graph] Error indexing {rel_path}: {e}")

        elapsed = time.time() - start
        stats = self.graph.get_statistics()
        stats["files_scanned"] = files_scanned
        stats["nodes_added"] = nodes_added
        stats["index_time_ms"] = int(elapsed * 1000)
        return stats

    def index_file(self, file_path: str) -> Optional[int]:
        """Index a single file. Returns node count or None."""
        abs_path = os.path.join(self.workspace_path, file_path) if not os.path.isabs(file_path) else file_path
        if not os.path.isfile(abs_path):
            return None
        try:
            rel_path = os.path.relpath(abs_path, self.workspace_path)
            return self._index_file(abs_path, rel_path)
        except Exception as e:
            print(f"  [graph] Error indexing {file_path}: {e}")
            return None

    def _index_file(self, abs_path: str, rel_path: str) -> int:
        """Parse and index a single file."""
        with open(abs_path, 'r', encoding='utf-8', errors='replace') as f:
            content = f.read()

        ext = os.path.splitext(abs_path)[1].lower()
        nodes_added = 0

        # Create file node
        file_node = GraphNode(
            id=f"file:{rel_path}",
            type=NODE_FILE,
            name=os.path.basename(rel_path),
            file_path=rel_path,
            metadata={"size": len(content), "extension": ext}
        )
        self.graph.add_node(file_node)
        nodes_added += 1

        # Detect language-specific patterns
        is_python = ext == '.py'
        is_js_like = ext in ('.js', '.jsx', '.ts', '.tsx')

        # Parse imports
        if is_python:
            nodes_added += self._parse_python_imports(content, rel_path, file_node.id)
        elif is_js_like:
            nodes_added += self._parse_js_imports(content, rel_path, file_node.id)
            nodes_added += self._parse_js_exports(content, rel_path, file_node.id)

        # Parse functions
        nodes_added += self._parse_functions(content, rel_path, file_node.id)

        # Parse classes
        for match in PATTERNS["class"].finditer(content):
            line = content[:match.start()].count('\n') + 1
            class_name = match.group(1)
            class_node = GraphNode(
                id=f"class:{rel_path}:{class_name}",
                type=NODE_CLASS,
                name=class_name,
                file_path=rel_path,
                line=line,
                parent_id=file_node.id,
                metadata={}
            )
            self.graph.add_node(class_node)
            self.graph.add_edge(GraphEdge(file_node.id, class_node.id, "contains"))
            nodes_added += 1

        # Parse routes (Flask)
        if is_python:
            for match in PATTERNS["route_flask"].finditer(content):
                line = content[:match.start()].count('\n') + 1
                route_path = match.group(1)
                route_node = GraphNode(
                    id=f"route:{rel_path}:{route_path}",
                    type=NODE_ROUTE,
                    name=route_path,
                    file_path=rel_path,
                    line=line,
                    parent_id=file_node.id,
                    metadata={"method": "GET"}
                )
                self.graph.add_node(route_node)
                self.graph.add_edge(GraphEdge(file_node.id, route_node.id, "contains"))
                nodes_added += 1

        # Parse Express.js routes
        if is_js_like:
            for match in PATTERNS["route_express"].finditer(content):
                line = content[:match.start()].count('\n') + 1
                route_path = match.group(1)
                route_node = GraphNode(
                    id=f"route:{rel_path}:{route_path}",
                    type=NODE_ROUTE,
                    name=route_path,
                    file_path=rel_path,
                    line=line,
                    parent_id=file_node.id,
                    metadata={}
                )
                self.graph.add_node(route_node)
                self.graph.add_edge(GraphEdge(file_node.id, route_node.id, "contains"))
                nodes_added += 1

        # Parse React components (named components)
        for match in PATTERNS["component_react"].finditer(content):
            line = content[:match.start()].count('\n') + 1
            comp_name = match.group(1)
            comp_node = GraphNode(
                id=f"component:{rel_path}:{comp_name}",
                type=NODE_COMPONENT,
                name=comp_name,
                file_path=rel_path,
                line=line,
                parent_id=file_node.id,
                metadata={"framework": "react"}
            )
            self.graph.add_node(comp_node)
            self.graph.add_edge(GraphEdge(file_node.id, comp_node.id, "contains"))
            nodes_added += 1

        # Parse React hooks
        for match in PATTERNS["hook"].finditer(content):
            line = content[:match.start()].count('\n') + 1
            hook_name = match.group(1)
            hook_node = GraphNode(
                id=f"hook:{rel_path}:{hook_name}",
                type=NODE_HOOK,
                name=hook_name,
                file_path=rel_path,
                line=line,
                parent_id=file_node.id,
                metadata={}
            )
            self.graph.add_node(hook_node)
            self.graph.add_edge(GraphEdge(file_node.id, hook_node.id, "contains"))
            nodes_added += 1

        # Parse database models
        for match in PATTERNS["model_sqlalchemy"].finditer(content):
            line = content[:match.start()].count('\n') + 1
            model_name = match.group(1)
            model_node = GraphNode(
                id=f"model:{rel_path}:{model_name}",
                type=NODE_MODEL,
                name=model_name,
                file_path=rel_path,
                line=line,
                parent_id=file_node.id,
                metadata={"orm": "sqlalchemy"}
            )
            self.graph.add_node(model_node)
            self.graph.add_edge(GraphEdge(file_node.id, model_node.id, "contains"))
            nodes_added += 1

        return nodes_added

    def _parse_python_imports(self, content: str, rel_path: str, file_node_id: str) -> int:
        count = 0
        for match in PATTERNS["import_python"].finditer(content):
            line = content[:match.start()].count('\n') + 1
            module = match.group(1) or match.group(3) or ""
            imported_names = match.group(2) or "*"
            imp_name = f"{module}.{imported_names}" if module else imported_names

            imp_node = GraphNode(
                id=f"import:{rel_path}:{imp_name}:{line}",
                type=NODE_IMPORT,
                name=imp_name,
                file_path=rel_path,
                line=line,
                parent_id=file_node_id,
                metadata={"module": module, "names": imported_names}
            )
            self.graph.add_node(imp_node)
            self.graph.add_edge(GraphEdge(file_node_id, imp_node.id, "contains"))
            count += 1
        return count

    def _parse_js_imports(self, content: str, rel_path: str, file_node_id: str) -> int:
        count = 0
        for match in PATTERNS["import_js"].finditer(content):
            line = content[:match.start()].count('\n') + 1
            module_path = match.group(1) or ""
            imp_node = GraphNode(
                id=f"import:{rel_path}:{module_path}:{line}",
                type=NODE_IMPORT,
                name=module_path,
                file_path=rel_path,
                line=line,
                parent_id=file_node_id,
                metadata={"module": module_path}
            )
            self.graph.add_node(imp_node)
            self.graph.add_edge(GraphEdge(file_node_id, imp_node.id, "contains"))
            count += 1
        return count

    def _parse_js_exports(self, content: str, rel_path: str, file_node_id: str) -> int:
        count = 0
        export_pattern = re.compile(r'export\s+(?:default\s+)?(?:const|let|var|function|class)\s+(\w+)', re.MULTILINE)
        for match in export_pattern.finditer(content):
            line = content[:match.start()].count('\n') + 1
            export_name = match.group(1)
            exp_node = GraphNode(
                id=f"export:{rel_path}:{export_name}",
                type=NODE_EXPORT,
                name=export_name,
                file_path=rel_path,
                line=line,
                parent_id=file_node_id,
                metadata={}
            )
            self.graph.add_node(exp_node)
            self.graph.add_edge(GraphEdge(file_node_id, exp_node.id, "contains"))
            count += 1
        return count

    def _parse_functions(self, content: str, rel_path: str, file_node_id: str) -> int:
        count = 0
        for match in PATTERNS["function"].finditer(content):
            line = content[:match.start()].count('\n') + 1
            func_name = match.group(1)
            func_node = GraphNode(
                id=f"function:{rel_path}:{func_name}",
                type=NODE_FUNCTION,
                name=func_name,
                file_path=rel_path,
                line=line,
                parent_id=file_node_id,
                metadata={}
            )
            self.graph.add_node(func_node)
            self.graph.add_edge(GraphEdge(file_node_id, func_node.id, "contains"))
            count += 1
        return count