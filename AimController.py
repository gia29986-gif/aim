import json
import time
from http.server import BaseHTTPRequestHandler, HTTPServer

class AimController:
    """
    AimController V9 - Logic xử lý trung tâm cho Aimlock và Drag Aim.
    """
    def __init__(self):
        self.is_active = True
        self.lock_target = "head"
        self.drag_multiplier = 2.5
        self.vertical_boost = 1.8
        self.smoothing_alpha = 0.6
        self.current_offset = {"x": 0, "y": 0}

    def process_drag(self, x, y):
        start_time = time.time() * 1000
        # Thuật toán EMA Smoothing
        self.current_offset["x"] = (self.smoothing_alpha * x * self.drag_multiplier) + \
                                  ((1 - self.smoothing_alpha) * self.current_offset["x"])
        self.current_offset["y"] = (self.smoothing_alpha * y * self.drag_multiplier * self.vertical_boost) + \
                                  ((1 - self.smoothing_alpha) * self.current_offset["y"])
        
        latency = (time.time() * 1000) - start_time
        return {
            "status": "success",
            "offset": self.current_offset,
            "latency_ms": round(latency, 3)
        }

    def get_status(self):
        return {
            "version": "9.1.0",
            "active": self.is_active,
            "target": self.lock_target,
            "config": {
                "multiplier": self.drag_multiplier,
                "vertical_boost": self.vertical_boost
            }
        }

# Global controller instance
controller = AimController()

class AimServerHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/v9/aim/status":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps(controller.get_status()).encode())
        else:
            self.send_error(404, "Endpoint not found")

    def do_POST(self):
        if self.path == "/v9/aim/control":
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            
            try:
                data = json.loads(post_data)
                if data.get("type") == "drag":
                    response = controller.process_drag(data.get("x", 0), data.get("y", 0))
                    self.send_response(200)
                    self.send_header("Content-Type", "application/json")
                    self.end_headers()
                    self.wfile.write(json.dumps(response).encode())
                else:
                    self.send_error(400, "Invalid signal type")
            except Exception as e:
                self.send_error(500, str(e))
        else:
            self.send_error(404, "Endpoint not found")

def run_server(port=8080):
    server_address = ('', port)
    httpd = HTTPServer(server_address, AimServerHandler)
    print(f"[+] Aimlock V9 Server đang chạy tại cổng {port}...")
    print(f"[!] Endpoint Control: http://localhost:{port}/v9/aim/control")
    print(f"[!] Endpoint Status: http://localhost:{port}/v9/aim/status")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n[!] Đang dừng máy chủ...")
        httpd.server_close()

if __name__ == "__main__":
    run_server()
