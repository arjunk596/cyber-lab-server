#!/usr/bin/env python3
import http.server
import socketserver
import os

PORT = int(os.environ.get("PORT", 5050))
DIR = os.path.dirname(os.path.abspath(__file__))

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIR, **kwargs)

if __name__ == "__main__":
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        print(f"DoS & DDoS Simulation Lab running on port {PORT}")
        httpd.serve_forever()
