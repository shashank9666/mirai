# Odysseus Features and Agent Architecture

## Features
- **Chat**: Interfaces with any local model or API (vLLM, llama.cpp, Ollama, OpenRouter, OpenAI, GitHub Copilot).
- **Agent**: A powerful agentic engine built on opencode with tools for MCP, web search, file management, shell execution, skills, and memory.
- **Cookbook**: Scans hardware, recommends models, and supports one-click download and serving.
- **Deep Research**: Multi-step agent execution to gather, read, and synthesize sources into visual reports.
- **Compare**: Side-by-side, blind model testing and synthesis.
- **Documents**: Multi-tab text/markdown editor with AI assistance, CSV support, and syntax highlighting.
- **Memory / Skills**: Persistent memory using ChromaDB for the agent to evolve over time.
- **Email**: IMAP/SMTP inbox integration with AI triage (urgency, auto-tag, auto-reply, auto-summary).
- **Notes & Tasks**: Quick notes, todo lists, and cron-style scheduled tasks.
- **Calendar**: Local-first calendar with CalDAV sync.
- **Mobile Ready**: Installable PWA with responsive design and touch gestures.

## How the Agent Works
The agent operates via a robust execution loop built on Python, drawing heavy inspiration from the structure seen in `src/`.

1. **Agent Loop (`agent_loop.py`)**: The central orchestrator that communicates with the LLM. It parses intents, manages turn-taking, and decides when to execute tools versus returning output to the user.
2. **Context Management (`context_compactor.py`, `context_budget.py`)**: Continuously monitors the token budget and compacts context when the conversation gets too long, preserving essential memory without exceeding the LLM's context window.
3. **Tool Parsing and Execution (`tool_parsing.py`, `tool_execution.py`)**: Validates LLM-requested tools against strict schemas (`tool_schemas.py`) and executes local or built-in actions (`builtin_actions.py`).
4. **Memory & RAG (`memory_vector.py`, `rag_vector.py`, `chroma_client.py`)**: Utilizes an embedded ChromaDB instance to retrieve past context, skills, and user preferences dynamically, allowing the agent's context to evolve over time.
5. **Security and Sandboxing (`tool_security.py`, `prompt_security.py`)**: Enforces strict boundaries on what the agent can execute (e.g., shell commands, URL safety) depending on user privileges and the environment.
6. **MCP Integration (`mcp_manager.py`)**: Natively supports the Model Context Protocol to seamlessly add external tool servers (like `@playwright/mcp`) without altering the core agent loop.
