# CRCE Cyber Lab (Fullstack Repository)

A complete cyber-range and virtual laboratory platform consisting of:
1. **Frontend**: An Electron desktop application (`/frontend`) providing an interactive terminal, live Docker Compose execution, and Markdown experiment views.
2. **Backend**: A catalog server and management portal (`/backend`) providing experiment feed APIs, web-based upload/edit/delete administration, and JSON persistence.

---

## 📁 Repository Structure

```text
cyber-lab-server/
├── backend/                  # Catalog API & Administration Portal (Python)
│   ├── server.py             # HTTP server with CRUD & Basic Auth
│   ├── labs.json             # Experiment database
│   └── upload_labs.py        # CLI batch uploader utility
├── frontend/                 # Electron Desktop Application (React + Vite + TypeScript)
│   ├── src/                  # Main, preload, renderer, and shared processes
│   ├── electron.vite.config.ts
│   ├── electron-builder.yml
│   └── package.json
├── package.json              # Root monorepo scripts
└── README.md
```

---

## 🚀 Quick Start Guide

### 1. Start the Catalog Server (Backend)

The catalog server runs with the standard Python 3 runtime (no external pip dependencies needed):

```bash
cd backend
python3 server.py
```

* **Server URL**: `http://localhost:8000`
* **JSON API**: `GET http://localhost:8000/`
* **Upload Lab Form**: `http://localhost:8000/upload` *(Auth: `admin` / `admin123`)*
* **Edit Lab**: `http://localhost:8000/edit/:id` *(Auth: `admin` / `admin123`)*
* **Delete Labs Dashboard**: `http://localhost:8000/delete` *(Auth: `admin` / `delete123`)*

---

### 2. Start the Cyber Lab Desktop App (Frontend)

In a new terminal window:

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

Ensure `frontend/.env` points to the local backend:
```env
RENDERER_VITE_API_URL=http://localhost:8000/
```

---

## 🧪 Experiments Catalog

The database currently includes:
* **Trojan Horse via MCP Server (Sandboxed)** (`Malware Analysis`)
* **RSA Cryptosystem: Factoring Challenge & Chosen Ciphertext Attack** (`Cryptography`)
* **Virtual Network Security Lab: DoS & DDoS Attacks and Mitigation** (`Network`)
* **Buffer Overflow Attack: Stack Smashing & Control Flow Hijacking** (`System`)
* **TCP SYN Flood Attack & Defense Simulation** (`Network`)
* **Packet Sniffing, ARP Spoofing & Protocol Analysis** (`Network`)

---

## 🛠️ Monorepo NPM Shortcuts

From the repository root, you can also run:

| Command | Description |
| :--- | :--- |
| `npm run server` | Starts the Python catalog server on port 8000 |
| `npm run install:frontend` | Installs frontend dependencies |
| `npm run dev` | Launches the Electron desktop app in development mode |
| `npm run build` | Builds the Electron desktop app distribution bundle |
