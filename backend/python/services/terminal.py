import os
import sys
import asyncio
from fastapi import WebSocket, WebSocketDisconnect
from typing import Dict

def setup_terminal_websockets(app):
    @app.websocket("/ws/terminal")
    async def terminal_endpoint(websocket: WebSocket, cwd: str = None, shell: str = "default"):
        await websocket.accept()
        target_cwd = cwd or os.getcwd()
        
        # Cross platform pty support
        if sys.platform == "win32":
            from winpty import PtyProcess
            shell_cmd = "powershell.exe"
            if shell == "cmd":
                shell_cmd = "cmd.exe"
            elif shell == "bash":
                shell_cmd = "bash.exe"
            
            pty_process = PtyProcess.spawn(shell_cmd, cwd=target_cwd)
        else:
            import ptyprocess
            shell_cmd = "bash"
            if shell in ["sh", "zsh"]:
                shell_cmd = shell
            pty_process = ptyprocess.PtyProcessUnicode.spawn([shell_cmd], cwd=target_cwd)

        async def read_from_pty():
            try:
                while True:
                    if sys.platform == "win32":
                        data = pty_process.read()
                    else:
                        data = pty_process.read(1024)
                    if data:
                        await websocket.send_json({"event": "terminal:data", "data": data})
                    await asyncio.sleep(0.01)
            except Exception:
                pass

        reader_task = asyncio.create_task(read_from_pty())

        try:
            while True:
                data = await websocket.receive_json()
                event = data.get("event")
                payload = data.get("data")
                
                if event == "terminal:write":
                    if sys.platform == "win32":
                        pty_process.write(payload)
                    else:
                        pty_process.write(payload)
                elif event == "terminal:resize":
                    cols = payload.get("cols", 80)
                    rows = payload.get("rows", 30)
                    pty_process.setwinsize(rows, cols)
        except WebSocketDisconnect:
            reader_task.cancel()
            if sys.platform == "win32":
                pty_process.close()
            else:
                pty_process.terminate(True)
