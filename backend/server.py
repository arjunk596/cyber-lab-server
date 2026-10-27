#!/usr/bin/env python3
"""
Cyber Lab Catalog Server
Endpoints:
  GET  /             -> All labs as JSON
  /upload            -> Login: admin / admin123
  GET|POST /edit/:id -> Login: admin / admin123
  GET  /delete       -> Delete labs (cards page, auth on delete)
  POST /delete/:id   -> Login: admin / delete123
"""

import http.server
import socketserver
import json
import os
import uuid
import base64
import urllib.parse
from datetime import datetime

PORT = 8000
DATA_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "labs.json")

ADMIN_USER = os.environ.get("CYBERLAB_ADMIN_USER", "admin")
ADMIN_PASS = os.environ.get("CYBERLAB_ADMIN_PASS", "admin123")
DELETE_PASS = os.environ.get("CYBERLAB_DELETE_PASS", "delete123")

INITIAL_LABS = [
    {
        "id": "4ab9919e-3326-4775-9c85-cba8ef5f1475",
        "title": "Trojan Horse via MCP Server (Sandboxed)",
        "description": "A local Node.js Model Context Protocol (MCP) server that exposes shell command execution as a single tool, containerised on Ubuntu 24.04. The experiment demonstrates how an MCP server can behave as a trojan-horse vector - installed like ordinary developer tooling, then acting with the user's privileges - and how Docker containment limits the damage: every command runs inside a disposable container, the host filesystem is never mounted, and the endpoint stays bound to 127.0.0.1.",
        "category": "Malware Analysis",
        "difficulty": "Intermediate",
        "port": 7331,
        "web_url": "http://localhost:7331",
        "github_url": "https://github.com/ybhavesh-0915/trojan-horse-mcp",
        "aim": "https://raw.githubusercontent.com/ybhavesh-0915/trojan-horse-mcp/main/aim.md",
        "theory": "https://raw.githubusercontent.com/ybhavesh-0915/trojan-horse-mcp/main/theory.md",
        "objective": "https://raw.githubusercontent.com/ybhavesh-0915/trojan-horse-mcp/main/objective.md",
        "procedure": "https://raw.githubusercontent.com/ybhavesh-0915/trojan-horse-mcp/main/procedure.md",
        "references": "https://raw.githubusercontent.com/ybhavesh-0915/trojan-horse-mcp/main/reference.md",
        "created_at": "2026-10-24 21:09:11",
        "github_issue_url": "https://github.com/ybhavesh-0915/trojan-horse-mcp/issues",
        "github_repo_name": "trojan-horse-mcp"
    },
    {
        "id": "e81f5c31-97b4-4b53-93d1-561bcf7ea101",
        "title": "RSA Cryptosystem: Factoring Challenge & Chosen Ciphertext Attack",
        "description": "A self-contained virtual lab on the RSA public-key cryptosystem demonstrating semiprime modulus generation, prime factorization vulnerabilities, and Chosen Ciphertext Attack (CCA) on unpadded RSA.",
        "category": "Cryptography",
        "difficulty": "Intermediate",
        "port": 8080,
        "web_url": "http://localhost:8080",
        "github_url": "https://github.com/CarinLemos20/CSS-lab-simulation",
        "aim": "https://raw.githubusercontent.com/CarinLemos20/CSS-lab-simulation/main/aim.md",
        "theory": "https://raw.githubusercontent.com/CarinLemos20/CSS-lab-simulation/main/theory.md",
        "objective": "https://raw.githubusercontent.com/CarinLemos20/CSS-lab-simulation/main/objective.md",
        "procedure": "https://raw.githubusercontent.com/CarinLemos20/CSS-lab-simulation/main/procedure.md",
        "references": "https://raw.githubusercontent.com/CarinLemos20/CSS-lab-simulation/main/reference.md",
        "created_at": "2026-10-27 09:00:00",
        "github_issue_url": "https://github.com/CarinLemos20/CSS-lab-simulation/issues",
        "github_repo_name": "CSS-lab-simulation"
    },
    {
        "id": "7fa239d4-6e11-4a87-b95c-9c3db6f81002",
        "title": "Virtual Network Security Lab: DoS & DDoS Attacks and Mitigation",
        "description": "Hands-on simulation of Denial of Service (SYN Flood/UDP Flood) and Distributed Denial of Service attacks on network infrastructure, demonstrating traffic analysis, server saturation, and firewall/rate-limiting protections.",
        "category": "Network",
        "difficulty": "Intermediate",
        "port": 5050,
        "web_url": "http://localhost:5050",
        "github_url": "https://github.com/Xombi17/css-virtual-lab",
        "aim": "https://raw.githubusercontent.com/Xombi17/css-virtual-lab/main/aim.md",
        "theory": "https://raw.githubusercontent.com/Xombi17/css-virtual-lab/main/theory.md",
        "objective": "https://raw.githubusercontent.com/Xombi17/css-virtual-lab/main/objective.md",
        "procedure": "https://raw.githubusercontent.com/Xombi17/css-virtual-lab/main/procedure.md",
        "references": "https://raw.githubusercontent.com/Xombi17/css-virtual-lab/main/reference.md",
        "created_at": "2026-10-27 09:00:00",
        "github_issue_url": "https://github.com/Xombi17/css-virtual-lab/issues",
        "github_repo_name": "css-virtual-lab"
    },
    {
        "id": "b304c5e8-23d9-482f-8711-4091a1411003",
        "title": "Buffer Overflow Attack: Stack Smashing & Control Flow Hijacking",
        "description": "Interactive Docker-isolated educational lab demonstrating classic stack-based buffer overflow vulnerabilities in C, return address overwriting, control-flow hijacking, and memory-safety mitigations.",
        "category": "System",
        "difficulty": "Intermediate",
        "port": 3001,
        "web_url": "http://localhost:3001",
        "github_url": "https://github.com/beeth73/CSS-LAB-BOA",
        "aim": "https://raw.githubusercontent.com/arjunk596/cyber-lab-server/main/lab-fixes/CSS-LAB-BOA/aim.md",
        "theory": "https://raw.githubusercontent.com/beeth73/CSS-LAB-BOA/main/docs/theory.md",
        "objective": "https://raw.githubusercontent.com/arjunk596/cyber-lab-server/main/lab-fixes/CSS-LAB-BOA/objective.md",
        "procedure": "https://raw.githubusercontent.com/arjunk596/cyber-lab-server/main/lab-fixes/CSS-LAB-BOA/procedure.md",
        "references": "https://raw.githubusercontent.com/beeth73/CSS-LAB-BOA/main/docs/references.md",
        "created_at": "2026-10-27 09:00:00",
        "github_issue_url": "https://github.com/beeth73/CSS-LAB-BOA/issues",
        "github_repo_name": "CSS-LAB-BOA"
    },
    {
        "id": "c92d5e71-42ab-41c3-8f6a-6a5789f21004",
        "title": "TCP SYN Flood Attack & Defense Simulation",
        "description": "Interactive simulation demonstrating how TCP half-open connections exhaust server backlog queues during a SYN flood attack, and how SYN cookies, backlog expansion, and rate limiting restore availability.",
        "category": "Network",
        "difficulty": "Beginner",
        "port": 8081,
        "web_url": "http://localhost:8081",
        "github_url": "https://github.com/ManvithKarkera/css_mini",
        "aim": "https://raw.githubusercontent.com/ManvithKarkera/css_mini/main/aim.md",
        "theory": "https://raw.githubusercontent.com/ManvithKarkera/css_mini/main/theory.md",
        "objective": "https://raw.githubusercontent.com/ManvithKarkera/css_mini/main/objective.md",
        "procedure": "https://raw.githubusercontent.com/ManvithKarkera/css_mini/main/procedure.md",
        "references": "https://raw.githubusercontent.com/ManvithKarkera/css_mini/main/reference.md",
        "created_at": "2026-10-27 09:00:00",
        "github_issue_url": "https://github.com/ManvithKarkera/css_mini/issues",
        "github_repo_name": "css_mini"
    },
    {
        "id": "199f781d-93e3-4f18-92cd-3a1cb328c8a7",
        "title": "Packet Sniffing, ARP Spoofing & Protocol Analysis",
        "description": "Interactive virtual laboratory simulating network packet analysis, promiscuous mode sniffing, ARP cache poisoning (MITM), cleartext vs TLS 1.3 traffic inspection, and network defense strategies.",
        "category": "Network",
        "difficulty": "Intermediate",
        "port": 3002,
        "web_url": "http://localhost:3002",
        "github_url": "https://github.com/tapu3983-hue/packet_spoofing",
        "github_repo_name": "packet_spoofing",
        "github_issue_url": "https://github.com/tapu3983-hue/packet_spoofing/issues",
        "aim": "https://raw.githubusercontent.com/arjunk596/cyber-lab-server/main/lab-fixes/packet_spoofing/aim.md",
        "theory": "https://raw.githubusercontent.com/tapu3983-hue/packet_spoofing/main/README.md",
        "objective": "https://raw.githubusercontent.com/arjunk596/cyber-lab-server/main/lab-fixes/packet_spoofing/objective.md",
        "procedure": "https://raw.githubusercontent.com/arjunk596/cyber-lab-server/main/lab-fixes/packet_spoofing/procedure.md",
        "references": "https://raw.githubusercontent.com/arjunk596/cyber-lab-server/main/lab-fixes/packet_spoofing/reference.md",
        "created_at": "2026-10-27 11:27:06"
    }
]

FEEDBACK_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "feedback.json")
LAB_FIXES_DIR = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "lab-fixes"))

def load_feedback():
    if os.path.exists(FEEDBACK_FILE):
        try:
            with open(FEEDBACK_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                if isinstance(data, list):
                    return data
        except Exception:
            pass
    return []

def save_feedback(feedbacks):
    tmp = FEEDBACK_FILE + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(feedbacks, f, indent=2)
    os.replace(tmp, FEEDBACK_FILE)

def resolve_local_doc(repo_name, section):
    sec = section.lower().replace(".md", "")
    candidates = [
        f"{sec}.md",
        f"{sec}",
        f"docs/{sec}.md",
        f"docs/{sec}"
    ]
    if sec == "references":
        candidates.insert(0, "reference.md")
    elif sec == "reference":
        candidates.insert(0, "references.md")

    repo_dir = os.path.join(LAB_FIXES_DIR, repo_name)
    if os.path.isdir(repo_dir):
        for c in candidates:
            p = os.path.join(repo_dir, c)
            if os.path.isfile(p):
                with open(p, "r", encoding="utf-8", errors="replace") as f:
                    return f.read()

    return None

def load_labs():
    if os.path.exists(DATA_FILE):
        try:
            with open(DATA_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                if isinstance(data, list) and len(data) > 0:
                    return data
        except Exception:
            pass
    save_labs(INITIAL_LABS)
    return INITIAL_LABS

def save_labs(labs):
    tmp = DATA_FILE + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(labs, f, indent=2)
    os.replace(tmp, DATA_FILE)

CSS_STYLES = """
:root {
  --bg: #0d1117;
  --surface: #161b22;
  --border: #30363d;
  --text: #e6edf3;
  --text-muted: #8b949e;
  --primary: #58a6ff;
  --primary-hover: #1f6feb;
  --danger: #f85149;
  --danger-hover: #da3633;
  --success: #3fb950;
  --font: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
}
* { box-sizing: border-box; margin: 0; padding: 0; font-family: var(--font); }
body { background: var(--bg); color: var(--text); padding: 2rem 1rem; min-height: 100vh; }
.container { max-width: 900px; margin: 0 auto; }
header { margin-bottom: 2rem; border-bottom: 1px solid var(--border); padding-bottom: 1rem; display: flex; justify-content: space-between; align-items: center; }
h1 { font-size: 1.5rem; font-weight: 600; color: #fff; }
nav a { color: var(--primary); text-decoration: none; margin-left: 1rem; font-size: 0.95rem; }
nav a:hover { text-decoration: underline; }
.card { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 1.5rem; margin-bottom: 1.25rem; }
.card-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.75rem; }
.card-title { font-size: 1.2rem; font-weight: 600; color: #fff; }
.badge { display: inline-block; padding: 0.2rem 0.6rem; border-radius: 12px; font-size: 0.75rem; font-weight: 600; text-transform: uppercase; margin-left: 0.5rem; }
.badge-category { background: rgba(88, 166, 255, 0.15); color: var(--primary); border: 1px solid rgba(88, 166, 255, 0.3); }
.badge-diff { background: rgba(63, 185, 80, 0.15); color: var(--success); border: 1px solid rgba(63, 185, 80, 0.3); }
.card-desc { font-size: 0.95rem; color: var(--text-muted); line-height: 1.5; margin-bottom: 1rem; }
.card-meta { font-size: 0.85rem; color: var(--text-muted); margin-bottom: 1rem; word-break: break-all; }
.card-meta div { margin-bottom: 0.3rem; }
.card-actions { display: flex; gap: 0.75rem; margin-top: 1rem; }
.btn { padding: 0.5rem 1rem; border-radius: 6px; font-size: 0.9rem; font-weight: 500; cursor: pointer; text-decoration: none; border: none; display: inline-flex; align-items: center; justify-content: center; }
.btn-primary { background: var(--primary); color: #fff; }
.btn-primary:hover { background: var(--primary-hover); }
.btn-danger { background: var(--danger); color: #fff; }
.btn-danger:hover { background: var(--danger-hover); }
.btn-secondary { background: #21262d; color: var(--text); border: 1px solid var(--border); }
.btn-secondary:hover { background: #30363d; }
.form-group { margin-bottom: 1.25rem; }
label { display: block; font-size: 0.9rem; font-weight: 500; margin-bottom: 0.4rem; color: var(--text); }
input, select, textarea { width: 100%; padding: 0.6rem 0.8rem; background: #0d1117; border: 1px solid var(--border); border-radius: 6px; color: var(--text); font-size: 0.95rem; }
input:focus, select:focus, textarea:focus { outline: none; border-color: var(--primary); box-shadow: 0 0 0 3px rgba(88, 166, 255, 0.2); }
textarea { resize: vertical; min-height: 80px; }
.grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
"""

class LabServerHandler(http.server.BaseHTTPRequestHandler):
    def send_cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization, ngrok-skip-browser-warning")

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_cors_headers()
        self.end_headers()

    def check_auth(self, expected_user, expected_pass):
        auth = self.headers.get("Authorization")
        if not auth or not auth.startswith("Basic "):
            return False
        try:
            cred = base64.b64decode(auth.split(" ")[1]).decode("utf-8")
            u, p = cred.split(":", 1)
            return u == expected_user and p == expected_pass
        except Exception:
            return False

    def require_auth(self, expected_user, expected_pass, realm="Admin"):
        if not self.check_auth(expected_user, expected_pass):
            self.send_response(401)
            self.send_header("WWW-Authenticate", f'Basic realm="{realm}"')
            self.send_header("Content-Type", "text/html")
            self.send_cors_headers()
            self.end_headers()
            self.wfile.write(b"<h1>401 Unauthorized</h1><p>Invalid credentials.</p>")
            return False
        return True

    def do_GET(self):
        url_parts = urllib.parse.urlparse(self.path)
        path = url_parts.path

        # 1. GET / -> All labs as JSON
        if path == "/" or path == "/labs":
            labs = load_labs()
            data = json.dumps(labs, indent=2).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(data)))
            self.send_cors_headers()
            self.end_headers()
            self.wfile.write(data)
            return

        # 2. GET /upload -> Upload form
        if path == "/upload":
            if not self.require_auth(ADMIN_USER, ADMIN_PASS, "Upload Lab"):
                return
            html = self.render_form(title="Upload New Lab", action="/upload")
            self.send_html(html)
            return

        # 3. GET /edit/:id -> Edit form
        if path.startswith("/edit/"):
            if not self.require_auth(ADMIN_USER, ADMIN_PASS, "Edit Lab"):
                return
            lab_id = path[len("/edit/"):]
            labs = load_labs()
            target = next((x for x in labs if x.get("id") == lab_id), None)
            if not target:
                self.send_error(404, "Lab not found")
                return
            html = self.render_form(title="Edit Lab", action=f"/edit/{lab_id}", lab=target)
            self.send_html(html)
            return

        # 4. GET /delete -> Cards page to delete labs
        if path == "/delete":
            labs = load_labs()
            html = self.render_delete_cards(labs)
            self.send_html(html)
            return

        # 5. GET /feedback -> Return submitted student feedback
        if path == "/feedback":
            feedbacks = load_feedback()
            self.send_json(feedbacks)
            return

        # 6. GET /docs/<repo>/<section> -> Local Markdown resolver
        if path.startswith("/docs/"):
            parts = path.strip("/").split("/")
            if len(parts) >= 3:
                repo_name = parts[1]
                section = parts[2]
                content = resolve_local_doc(repo_name, section)
                if content:
                    data = content.encode("utf-8")
                    self.send_response(200)
                    self.send_header("Content-Type", "text/markdown; charset=utf-8")
                    self.send_header("Content-Length", str(len(data)))
                    self.send_cors_headers()
                    self.end_headers()
                    self.wfile.write(data)
                    return

        self.send_error(404, "Not Found")

    def do_POST(self):
        url_parts = urllib.parse.urlparse(self.path)
        path = url_parts.path

        # Feedback POST
        if path == "/feedback":
            body = self.parse_body()
            feedbacks = load_feedback()
            entry = {
                "id": str(uuid.uuid4()),
                "lab_id": str(body.get("lab_id") or body.get("experiment_id") or ""),
                "lab_title": str(body.get("lab_title") or body.get("experiment_title") or ""),
                "rating": int(body.get("rating", 5)),
                "ease": int(body.get("ease") or body.get("ease_of_understanding") or 5),
                "difficulty": str(body.get("difficulty") or body.get("perceived_difficulty") or "Appropriate"),
                "objective_achieved": bool(body.get("objective_achieved", True)),
                "comments": str(body.get("comments") or ""),
                "suggestions": str(body.get("suggestions") or ""),
                "submitted_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            }
            feedbacks.append(entry)
            save_feedback(feedbacks)
            self.send_json({"success": True, "message": "Feedback recorded successfully", "feedback": entry})
            return

        # Upload POST
        if path == "/upload":
            if not self.require_auth(ADMIN_USER, ADMIN_PASS, "Upload Lab"):
                return
            lab = self.parse_body()
            if not lab.get("id"):
                lab["id"] = str(uuid.uuid4())
            if not lab.get("created_at"):
                lab["created_at"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

            labs = load_labs()
            labs.append(lab)
            save_labs(labs)

            if "application/json" in self.headers.get("Content-Type", ""):
                self.send_json({"success": True, "lab": lab})
            else:
                self.send_redirect("/")
            return

        # Edit POST
        if path.startswith("/edit/"):
            if not self.require_auth(ADMIN_USER, ADMIN_PASS, "Edit Lab"):
                return
            lab_id = path[len("/edit/"):]
            updated = self.parse_body()
            labs = load_labs()
            for idx, x in enumerate(labs):
                if x.get("id") == lab_id:
                    updated["id"] = lab_id
                    updated["created_at"] = x.get("created_at", datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
                    labs[idx] = updated
                    break
            save_labs(labs)
            if "application/json" in self.headers.get("Content-Type", ""):
                self.send_json({"success": True, "lab": updated})
            else:
                self.send_redirect("/")
            return

        # Delete POST
        if path.startswith("/delete/"):
            if not self.require_auth(ADMIN_USER, DELETE_PASS, "Delete Lab Authorization"):
                return
            lab_id = path[len("/delete/"):]
            labs = load_labs()
            labs = [x for x in labs if x.get("id") != lab_id]
            save_labs(labs)

            if "application/json" in self.headers.get("Content-Type", ""):
                self.send_json({"success": True, "deleted_id": lab_id})
            else:
                self.send_redirect("/delete")
            return

        self.send_error(404, "Not Found")

    def parse_body(self):
        content_length = int(self.headers.get("Content-Length", 0))
        raw = self.rfile.read(content_length).decode("utf-8")
        content_type = self.headers.get("Content-Type", "")
        if "application/json" in content_type:
            try:
                return json.loads(raw)
            except Exception:
                return {}
        else:
            parsed = urllib.parse.parse_qs(raw)
            return {k: v[0] for k, v in parsed.items()}

    def send_html(self, html):
        data = html.encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.send_cors_headers()
        self.end_headers()
        self.wfile.write(data)

    def send_json(self, obj):
        data = json.dumps(obj).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.send_cors_headers()
        self.end_headers()
        self.wfile.write(data)

    def send_redirect(self, loc):
        self.send_response(303)
        self.send_header("Location", loc)
        self.send_cors_headers()
        self.end_headers()

    def render_form(self, title, action, lab=None):
        if not lab:
            lab = {}
        categories = ["Web Security", "System", "Network", "Cryptography", "Authentication Security", "Malware Analysis"]
        difficulties = ["Beginner", "Intermediate", "Advanced"]

        cat_options = "".join(f'<option value="{c}" {"selected" if lab.get("category") == c else ""}>{c}</option>' for c in categories)
        diff_options = "".join(f'<option value="{d}" {"selected" if lab.get("difficulty") == d else ""}>{d}</option>' for d in difficulties)

        return f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>{title} - Cyber Lab Server</title>
  <style>{CSS_STYLES}</style>
</head>
<body>
  <div class="container">
    <header>
      <h1>{title}</h1>
      <nav>
        <a href="/">JSON Feed</a>
        <a href="/upload">Upload</a>
        <a href="/delete">Manage Labs</a>
      </nav>
    </header>
    <div class="card">
      <form method="POST" action="{action}">
        <div class="form-group">
          <label>Title</label>
          <input type="text" name="title" required value="{lab.get('title', '')}" placeholder="Lab Title">
        </div>
        <div class="form-group">
          <label>Description</label>
          <textarea name="description" required placeholder="Short summary of the experiment">{lab.get('description', '')}</textarea>
        </div>
        <div class="grid-2">
          <div class="form-group">
            <label>Category</label>
            <select name="category">{cat_options}</select>
          </div>
          <div class="form-group">
            <label>Difficulty</label>
            <select name="difficulty">{diff_options}</select>
          </div>
        </div>
        <div class="grid-2">
          <div class="form-group">
            <label>GitHub URL</label>
            <input type="url" name="github_url" required value="{lab.get('github_url', '')}" placeholder="https://github.com/user/repo">
          </div>
          <div class="form-group">
            <label>GitHub Repo Name (Must be exact)</label>
            <input type="text" name="github_repo_name" required value="{lab.get('github_repo_name', '')}" placeholder="repo-name">
          </div>
        </div>
        <div class="form-group">
          <label>GitHub Issues URL</label>
          <input type="url" name="github_issue_url" required value="{lab.get('github_issue_url', '')}" placeholder="https://github.com/user/repo/issues">
        </div>
        <div class="form-group">
          <label>Aim (Markdown URL)</label>
          <input type="url" name="aim" required value="{lab.get('aim', '')}" placeholder="https://raw.githubusercontent.com/.../aim.md">
        </div>
        <div class="form-group">
          <label>Theory (Markdown URL)</label>
          <input type="url" name="theory" required value="{lab.get('theory', '')}" placeholder="https://raw.githubusercontent.com/.../theory.md">
        </div>
        <div class="form-group">
          <label>Objective (Markdown URL)</label>
          <input type="url" name="objective" required value="{lab.get('objective', '')}" placeholder="https://raw.githubusercontent.com/.../objective.md">
        </div>
        <div class="form-group">
          <label>Procedure (Markdown URL)</label>
          <input type="url" name="procedure" required value="{lab.get('procedure', '')}" placeholder="https://raw.githubusercontent.com/.../procedure.md">
        </div>
        <div class="form-group">
          <label>References (Markdown URL)</label>
          <input type="url" name="references" required value="{lab.get('references', '')}" placeholder="https://raw.githubusercontent.com/.../references.md">
        </div>
        <button type="submit" class="btn btn-primary" style="width:100%;">Save Lab</button>
      </form>
    </div>
  </div>
</body>
</html>"""

    def render_delete_cards(self, labs):
        cards_html = ""
        for lab in labs:
            lid = lab.get("id")
            title = lab.get("title", "Untitled")
            desc = lab.get("description", "")
            cat = lab.get("category", "")
            diff = lab.get("difficulty", "")
            gh = lab.get("github_url", "")
            cards_html += f"""
            <div class="card" id="card-{lid}">
              <div class="card-header">
                <div class="card-title">{title}</div>
                <div>
                  <span class="badge badge-category">{cat}</span>
                  <span class="badge badge-diff">{diff}</span>
                </div>
              </div>
              <div class="card-desc">{desc}</div>
              <div class="card-meta">
                <div><strong>Repo:</strong> <a href="{gh}" target="_blank" style="color:var(--primary);">{gh}</a></div>
                <div><strong>ID:</strong> {lid}</div>
              </div>
              <div class="card-actions">
                <a href="/edit/{lid}" class="btn btn-secondary">Edit</a>
                <button class="btn btn-danger" onclick="deleteLab('{lid}')">Delete Lab</button>
              </div>
            </div>
            """

        return f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Manage Labs - Cyber Lab Server</title>
  <style>{CSS_STYLES}</style>
</head>
<body>
  <div class="container">
    <header>
      <h1>Manage Labs ({len(labs)})</h1>
      <nav>
        <a href="/">JSON Feed</a>
        <a href="/upload">Upload</a>
        <a href="/delete">Manage Labs</a>
      </nav>
    </header>
    {cards_html}
  </div>
  <script>
    async function deleteLab(id) {{
      if (!confirm('Are you sure you want to delete this lab?')) return;
      try {{
        const resp = await fetch('/delete/' + id, {{
          method: 'POST',
          headers: {{
            'Authorization': 'Basic ' + btoa('admin:delete123')
          }}
        }});
        if (resp.ok) {{
          const el = document.getElementById('card-' + id);
          if (el) el.remove();
          alert('Lab deleted successfully');
        }} else if (resp.status === 401) {{
          alert('Authentication failed. Requires admin / delete123');
        }} else {{
          alert('Failed to delete lab');
        }}
      }} catch (err) {{
        alert('Network error: ' + err);
      }}
    }}
  </script>
</body>
</html>"""

def run_server():
    load_labs()
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", PORT), LabServerHandler) as httpd:
        print(f"✓ Server running → http://localhost:{PORT}")
        print("  GET  /             → All labs as JSON")
        print("  /upload            → Login: admin / admin123")
        print("  GET|POST /edit/:id → Login: admin / admin123")
        print("  GET  /delete       → Delete labs (cards page, auth on delete)")
        print("  POST /delete/:id   → Login: admin / delete123")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nShutting down server.")

if __name__ == "__main__":
    run_server()
