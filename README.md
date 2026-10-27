# Cyber Lab Catalog Server & API

A standalone, lightweight catalog server and administration portal for **CRCE Cyber Lab**. It serves experiment configurations to the Cyber Lab desktop client and provides secure endpoints to upload, edit, and delete labs.

## 🚀 Quick Start

Run the server (zero external dependencies required):

```bash
python3 server.py
```

### Server Output:
```text
✓ Server running → http://localhost:8000
  GET  /             → All labs as JSON
  /upload            → Login: admin / admin123
  GET|POST /edit/:id → Login: admin / admin123
  GET  /delete       → Delete labs (cards page, auth on delete)
  POST /delete/:id   → Login: admin / delete123
```

---

## 📡 API Endpoints & Routes

| Method | Route | Description | Auth |
| :--- | :--- | :--- | :--- |
| `GET` | `/` | All experiments returned as a JSON array | Public |
| `GET` | `/upload` | Modern web form to submit a new lab | `admin` / `admin123` |
| `POST` | `/upload` | Accepts JSON or Form-encoded payload | `admin` / `admin123` |
| `GET` | `/edit/:id` | Edit form prefilled with lab data | `admin` / `admin123` |
| `POST` | `/edit/:id` | Update experiment details | `admin` / `admin123` |
| `GET` | `/delete` | Cards page displaying all labs with delete buttons | Public |
| `POST` | `/delete/:id` | Delete experiment from database | `admin` / `delete123` |

---

## 📋 Experiment Schema Contract

Each experiment in `labs.json` adheres to the following specification:

```json
{
  "id": "4ab9919e-3326-4775-9c85-cba8ef5f1475",
  "title": "Trojan Horse via MCP Server (Sandboxed)",
  "description": "A local Node.js Model Context Protocol (MCP) server that exposes shell command execution as a single tool...",
  "category": "Malware Analysis",
  "difficulty": "Intermediate",
  "github_url": "https://github.com/ybhavesh-0915/trojan-horse-mcp",
  "github_repo_name": "trojan-horse-mcp",
  "github_issue_url": "https://github.com/ybhavesh-0915/trojan-horse-mcp/issues",
  "aim": "https://raw.githubusercontent.com/ybhavesh-0915/trojan-horse-mcp/main/aim.md",
  "theory": "https://raw.githubusercontent.com/ybhavesh-0915/trojan-horse-mcp/main/theory.md",
  "objective": "https://raw.githubusercontent.com/ybhavesh-0915/trojan-horse-mcp/main/objective.md",
  "procedure": "https://raw.githubusercontent.com/ybhavesh-0915/trojan-horse-mcp/main/procedure.md",
  "references": "https://raw.githubusercontent.com/ybhavesh-0915/trojan-horse-mcp/main/reference.md",
  "created_at": "2026-10-24 21:09:11"
}
```

### Valid Categories:
* `Web Security`
* `System`
* `Network`
* `Cryptography`
* `Authentication Security`
* `Malware Analysis`

### Valid Difficulties:
* `Beginner`
* `Intermediate`
* `Advanced`

---

## ⚡ Batch Upload Script

To upload labs programmatically in bulk:

```bash
python3 upload_labs.py
```

---

## 🔗 Connecting to Cyber Lab Desktop

In your `cyber-lab` client root directory, edit or create `.env`:

```env
RENDERER_VITE_API_URL=http://localhost:8000/
```

Then start the desktop application:

```bash
npm run dev
```
