# Mirai/Odyssey AI IDE - Implementation TODO

## Phase 0 — Repo understanding
- [ ] Inspect state management + API wiring
  - [ ] `frontend/src/store/ideStore.ts`
  - [ ] `frontend/src/lib/api.ts`
  - [ ] IDE layout components (activity bar/panels if needed)

## Phase 1 — Safe workspace + real file editing loop (Priority A)
- [ ] Harden backend filesystem routes to enforce workspace root safety
  - [ ] Update `backend/python/routers/fs_router.py` to resolve paths through `WorkspaceManager`
  - [ ] Ensure all endpoints (readDir/readFile/writeFile/search/list/rename/delete/backup) are protected
- [ ] Implement editor dirty state + Save/Save As/Revert
  - [ ] Wire editor changes -> dirty tracking in `ideStore`
  - [ ] Add save actions calling backend `/writeFile`
  - [ ] Add revert (reload file content from backend)
  - [ ] Save all (iterate dirty tabs)
- [ ] Implement explorer CRUD actions
  - [ ] Create file / create folder
  - [ ] Rename / delete
  - [ ] Duplicate / move / copy (or staged v1 versions)
  - [ ] Context menu + keyboard shortcuts where applicable
- [ ] Tabs actions
  - [ ] Close tab
  - [ ] Close all / close others
  - [ ] Reopen closed tab (basic history)

## Phase 2 — Command Palette + Quick Open (Priority B)
- [ ] Convert `CommandPalette` from static UI to real command registry
  - [ ] Implement command list (file ops + AI actions)
  - [ ] Wire results -> action execution
- [ ] Implement Quick Open (`Ctrl+P`)
  - [ ] Fuzzy file open
  - [ ] Recent files support
  - [ ] Symbol search (v1: file symbols via indexing if available)

## Phase 3 — Terminal backend execution (Priority C)
- [x] Replace terminal mock in `HyprTerminal` with real backend execution
  - [x] Inspect `backend/python/services/terminal.py`
  - [x] Add backend endpoints for running commands / session management
  - [x] Add streaming output to frontend
  - [x] Multiple terminal tabs

## Phase 4 — Search UX + navigation (Priority D)
- [ ] Implement workspace search UI panel
  - [ ] Wire to backend `/searchFiles`
  - [ ] Results tree: file + match count
  - [ ] Click result -> open file and reveal match location (add line/column in backend)

## Phase 5 — Git / Debug / Problems / IntelliSense / Refactor
- [ ] Git integration
- [ ] Debugger
- [ ] Problems panel + code actions
- [ ] IntelliSense improvements (LSP/TS server or Monaco providers)
- [ ] Refactoring + AI code actions

## Phase 6 — AI-native modules
- [ ] Agent mode UI + execution loop
- [ ] Multi-LLM routing
- [ ] Memory (user/project/agent)
- [ ] RAG repository indexing + semantic search
- [ ] MCP manager + tool permissions
- [ ] AI Actions: explain/refactor/tests/docs/review PR/create commits

