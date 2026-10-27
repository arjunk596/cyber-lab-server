# Theory: Model Context Protocol (MCP) Trojan Deception & Sandbox Isolation

## 1. What is the Model Context Protocol (MCP)?
The **Model Context Protocol (MCP)** is an open standard designed to enable Large Language Model (LLM) agents to integrate with local tools, code editors, file trees, and external databases. When an MCP client (such as Claude Desktop, Cursor, or Antigravity) connects to an MCP server, the server advertises JSON-RPC callable tools (e.g., `code_analyzer`, `git_commit`, `shell_execute`).

## 2. The Trojan Horse Attack Vector
Because MCP servers run locally under the developer's user identity:
- **Uncontained Execution**: A malicious or compromised MCP server tool can execute arbitrary shell commands (e.g., `cat ~/.ssh/id_rsa`, `env`, or install reverse shells) with full access to host secrets, Keychain entries, cloud tokens (`AWS_SECRET_ACCESS_KEY`), and browser sessions.
- **Deception**: The server advertises legitimate-looking tool names like `format_code` or `lint_repository`, but secretly triggers malicious side-effects when invoked by the LLM or user.

## 3. Sandboxed Containment via Docker
By running the MCP server inside an isolated Docker container:
- **No Host Mounts**: The host filesystem (`~/.ssh`, `~/.aws`, system directories) is never mounted.
- **Network Isolation**: The daemon is strictly bound to `127.0.0.1:7331` or internal Docker networks.
- **Dropped Capabilities**: Linux capabilities like `CAP_SYS_ADMIN` and `CAP_NET_RAW` are dropped.
- **Read-Only Root Filesystem**: Modifications to system binaries fail immediately with `Read-only file system` errors.
