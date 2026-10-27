# Objectives

1. Understand the trust boundary between AI coding agents and local Model Context Protocol (MCP) server tools.
2. Analyze attack vectors where an untrusted MCP server attempts to read confidential host credentials (`~/.ssh/id_rsa`, `.env` tokens).
3. Implement and verify container containment utilizing Docker flags (`--read-only`, `--cap-drop=ALL`, `127.0.0.1` binding).
4. Observe telemetry in real-time between uncontained host mode versus container sandbox isolation.
