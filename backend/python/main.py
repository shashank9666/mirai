from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os

from routers import fs_router, web_router, tasks_router, git_router, agent_router, settings_router
from services import terminal, watcher

app = FastAPI(title="Mirai Backend")

# Allow all origins, similar to Express setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(fs_router.router, prefix="/api/fs", tags=["File System"])
app.include_router(web_router.router, prefix="/api/web", tags=["Web"])
app.include_router(tasks_router.router, prefix="/api/tasks", tags=["Tasks"])
app.include_router(git_router.router, prefix="/api/git", tags=["Git"])
app.include_router(agent_router.router, prefix="/api", tags=["Agent"])
app.include_router(settings_router.router, prefix="/api/settings", tags=["Settings"])

# Setup WebSockets
terminal.setup_terminal_websockets(app)
watcher.setup_watcher_websockets(app)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=3000, reload=True)
