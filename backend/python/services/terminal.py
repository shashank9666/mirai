import os
import sys
import json
import threading

def setup_terminal_websockets(sock):
    @sock.route("/ws/terminal")
    def terminal_endpoint(ws):
        from flask import request
        cwd = request.args.get("cwd")
        shell = request.args.get("shell", "default")
        
        target_cwd = cwd or os.getcwd()
        
        if sys.platform == "win32":
            try:
                from winpty import PtyProcess
            except ImportError:
                ws.send(json.dumps({"event": "terminal:data", "data": "Error: winpty is not installed. Please install pywinpty.\r\n"}))
                return
                
            if shell == "cmd":
                shell_cmd = "cmd.exe"
            elif shell == "bash":
                shell_cmd = "bash.exe"
            else:
                shell_cmd = "powershell.exe"
                
            try:
                process = PtyProcess.spawn(shell_cmd, cwd=target_cwd)
            except Exception as e:
                ws.send(json.dumps({"event": "terminal:data", "data": f"Error starting terminal: {str(e)}\r\n"}))
                return
                
                try:
                    while True:
                        data = process.read(1024)
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
                        process.write(payload)
            except Exception:
                pass
            finally:
                try:
                    process.terminate(force=True)
                except:
                    pass
        else:
            try:
                from ptyprocess import PtyProcessUnicode
            except ImportError:
                ws.send(json.dumps({"event": "terminal:data", "data": "Error: ptyprocess is not installed.\r\n"}))
                return
                
            shell_cmd = ["bash"]
            
            try:
                process = PtyProcessUnicode.spawn(shell_cmd, cwd=target_cwd)
            except Exception as e:
                ws.send(json.dumps({"event": "terminal:data", "data": f"Error starting terminal: {str(e)}\r\n"}))
                return
                
            def read_from_process():
                try:
                    while True:
                        data = process.read(1024)
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
                        process.write(payload)
            except Exception:
                pass
            finally:
                try:
                    process.terminate(force=True)
                except:
                    pass
