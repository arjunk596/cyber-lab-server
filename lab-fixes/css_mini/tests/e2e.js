#!/usr/bin/env node
/* End-to-end test: node tests/e2e.js
   Builds a temporary copy of index.html (or dist/index.html with --dist) with tests/e2e-driver.js injected, opens it in headless Chrome/Chromium
   (virtual time, so the ~60 s journey runs in a few seconds) and prints PASS/FAIL for every step of the student journey.
   Needs Chrome, Chromium or Edge installed. Set CHROME=/path/to/browser to pick one. */
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.join(__dirname, '..');
const candidates = [process.env.CHROME, 'google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'chrome', 'microsoft-edge']
  .concat(process.platform === 'darwin' ? ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'] : [])
  .concat(process.platform === 'win32' ? ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'] : [])
  .filter(Boolean);
let browser = null;
for (const c of candidates) {
  const r = spawnSync(c, ['--version'], { encoding: 'utf8' });
  if (r.status === 0) { browser = c; break; }
}
if (!browser) { console.error('No Chrome/Chromium/Edge found. Set CHROME=/path/to/browser'); process.exit(2); }

// --dist tests the final three-file build (dist/index.html + style.css + script.js) instead of the split sources
const useDist = process.argv.includes('--dist');
const page = path.join(root, useDist ? 'dist' : 'tests', '.e2e-page.html');   // inside the project so sandboxed browsers can read it
let html = fs.readFileSync(path.join(root, useDist ? 'dist/index.html' : 'index.html'), 'utf8');
html = html.replace('</body>', '<script src="' + (useDist ? '../tests/' : '') + 'e2e-driver.js"></script>\n</body>');
if (!useDist) html = html.replace(/(href|src)="(css|js)\//g, '$1="../$2/');
fs.writeFileSync(page, html);

const args = ['--headless', '--no-sandbox', '--disable-gpu', '--allow-file-access-from-files', '--virtual-time-budget=150000',
  '--dump-dom', 'file://' + page.replace(/\\/g, '/')];
const r = spawnSync(browser, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 240000 });
fs.unlinkSync(page);

const m = /<pre id="e2e-result">([\s\S]*?)<\/pre>/.exec(r.stdout || '');
if (!m) { console.error('The page produced no result. Browser said:\n' + (r.stderr || '').split('\n').filter((l) => !/snapd|update\.go/.test(l)).slice(-8).join('\n')); process.exit(1); }
const decode = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
const data = JSON.parse(decode(m[1]));
let failed = 0;
data.results.filter((x) => x.msg).forEach((x) => { console.log((x.ok ? 'PASS ' : 'FAIL ') + x.msg); if (!x.ok) failed++; });
data.errors.forEach((e) => { console.log('ERROR ' + e); failed++; });
console.log(failed ? `\n${failed} problem(s)` : `\nAll ${data.results.filter((x) => x.msg).length} end-to-end checks passed`);
process.exit(failed ? 1 : 0);
