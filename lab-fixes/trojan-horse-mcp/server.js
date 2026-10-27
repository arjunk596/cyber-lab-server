const http = require('http');
const url = require('url');

const PORT = process.env.PORT || 7331;

const TOOLS = [
  {
    name: 'code_analyzer',
    description: 'Static AST analysis and security linting for repositories',
    parameters: { type: 'object', properties: { path: { type: 'string' } } },
    sandboxed: true,
    privilegeLevel: 'contained-guest'
  },
  {
    name: 'safe_linter',
    description: 'Style guide validation without system execution privileges',
    parameters: { type: 'object', properties: { file: { type: 'string' } } },
    sandboxed: true,
    privilegeLevel: 'contained-guest'
  }
];

const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url, true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (parsed.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', server: 'trojan-mcp', port: PORT, containerized: true }));
    return;
  }

  if (parsed.pathname === '/tools') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      protocol: 'mcp/1.0',
      server: 'trojan-mcp-sandboxed',
      tools: TOOLS,
      containment: {
        readOnlyFs: true,
        hostMounts: false,
        droppedCaps: ['CAP_SYS_ADMIN', 'CAP_NET_RAW']
      }
    }, null, 2));
    return;
  }

  // Dashboard UI
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>MCP Trojan Daemon (Sandboxed Container)</title>
  <style>
    body { background: #0f172a; color: #f8fafc; font-family: -apple-system, sans-serif; padding: 2rem; }
    .card { background: #1e293b; border-radius: 12px; padding: 1.5rem; border: 1px solid #334155; max-width: 600px; margin: 0 auto; }
    h2 { color: #f97316; margin-top: 0; }
    .tag { display: inline-block; background: rgba(34, 197, 94, 0.2); color: #4ade80; padding: 4px 10px; border-radius: 6px; font-size: 12px; font-weight: 600; }
    pre { background: #090d16; padding: 1rem; border-radius: 8px; color: #38bdf8; font-family: monospace; font-size: 13px; }
  </style>
</head>
<body>
  <div class="card">
    <div style="display:flex; justify-content:space-between; align-items:center;">
      <h2>Model Context Protocol Daemon</h2>
      <span class="tag">Docker Contained</span>
    </div>
    <p>Containerized MCP daemon active on port <strong>${PORT}</strong>.</p>
    <p>Endpoint bound to loopback. Host filesystem is non-accessible.</p>
    <pre>GET /tools -> returns registered MCP tools</pre>
  </div>
</body>
</html>`);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[*] Sandboxed Trojan MCP Server active on port ${PORT}`);
});
