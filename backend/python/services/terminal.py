import os
import sys
import json
import threading
from typing import Dict

def setup_terminal_websockets(sock):
    @sock.route("/ws/terminal")
    def terminal_endpoint(ws):
        # We don't get query params nicely in flask_sock by default, so we'll expect an init message or just use default
        # But wait, flask_sock lets us access `request.args` if we import it!
        from flask import request
        cwd = request.args.get("cwd")
        shell = request.args.get("shell", "default")
        
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

        def read_from_pty():
            try:
                while True:
                    if sys.platform == "win32":
                        data = pty_process.read()
                    else:
                        data = pty_process.read(1024)
                    if data:
                        ws.send(json.dumps({"event": "terminal:data", "data": data}))
            except Exception:
                pass

        reader_thread = threading.Thread(target=read_from_pty, daemon=True)
        reader_thread.start()

        try:
            while True:
                data = ws.receive()
                if data is None:
                    break
                try:
                    msg = json.loads(data)
                except Exception:
                    continue
                
                event = msg.get("event")
                payload = msg.get("data")
                
                if event == "terminal:write":
                    pty_process.write(payload)
                elif event == "terminal:resize":
                    cols = payload.get("cols", 80)
                    rows = payload.get("rows", 30)
                    pty_process.setwinsize(rows, cols)
        except Exception:
            pass
        finally:
            if sys.platform == "win32":
                pty_process.close()
            else:
                pty_process.terminate(True)
