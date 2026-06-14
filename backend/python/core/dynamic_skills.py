import os
import re
from typing import List
from langchain_core.tools import BaseTool

def load_dynamic_tools(workspace_path: str) -> List[BaseTool]:
    """
    Scans the given workspace for a SKILLS.md file, extracts Python code blocks,
    executes them in a restricted namespace, and returns any LangChain BaseTool instances.
    """
    if not workspace_path:
        return []

    skills_file = os.path.join(workspace_path, "SKILLS.md")
    if not os.path.exists(skills_file):
        return []

    try:
        with open(skills_file, "r", encoding="utf-8") as f:
            content = f.read()
    except Exception as e:
        print(f"Error reading SKILLS.md: {e}")
        return []

    # Extract all python code blocks
    pattern = re.compile(r"```python\n(.*?)\n```", re.DOTALL)
    matches = pattern.findall(content)

    if not matches:
        return []

    combined_code = "\n\n".join(matches)
    dynamic_tools: List[BaseTool] = []

    # We need to inject some common imports and the @tool decorator into the namespace
    # so the user doesn't have to import them manually every time.
    import json
    import requests
    from langchain_core.tools import tool

    namespace = {
        "__builtins__": __builtins__,
        "json": json,
        "requests": requests,
        "os": os,
        "tool": tool
    }

    try:
        exec(combined_code, namespace)
    except Exception as e:
        print(f"Error executing python blocks from SKILLS.md: {e}")
        return []

    # Find all BaseTool instances in the executed namespace
    for name, obj in namespace.items():
        if isinstance(obj, BaseTool):
            dynamic_tools.append(obj)

    return dynamic_tools
