import os
import sys
import json
import threading
import subprocess
from typing import Dict

def setup_terminal_websockets(sock):
    @sock.route("/ws/terminal")
    def terminal_endpoint(ws):
        from flask import request
        cwd = request.args.get("cwd")
        shell = request.args.get("shell", "default")
        
        target_cwd = cwd or os.getcwd()
        
        if shell == "cmd":
            shell_cmd = ["cmd.exe"]
        elif shell == "bash":
            shell_cmd = ["bash"] if sys.platform != "win32" else ["bash.exe"]
        else:
            shell_cmd = ["powershell.exe"] if sys.platform == "win32" else ["bash"]
        
        try:
            # We use subprocess.Popen with pipes
            # Setting bufsize=0 (unbuffered) is important for interactive terminals
            process = subprocess.Popen(
                shell_cmd,
                cwd=target_cwd,
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                bufsize=1, # Line buffered
                universal_newlines=True
            )
        except Exception as e:
            ws.send(json.dumps({"event": "terminal:data", "data": f"Error starting terminal: {str(e)}\r\n"}))
            return

        def read_from_process():
            try:
                while True:
                    data = process.stdout.read(1)
                    if not data:
                        break
                    ws.send(json.dumps({"event": "terminal:data", "data": data}))
            except Exception:
                pass
            finally:
                try:
                    ws.close()
                except:
                    pass

        reader_thread = threading.Thread(target=read_from_process, daemon=True)
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
                    if process.stdin:
                        process.stdin.write(payload)
                        process.stdin.flush()
        except Exception:
            pass
        finally:
            try:
                process.terminate()
            except:
                pass
