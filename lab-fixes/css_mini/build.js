#!/usr/bin/env node
/* build.js — OWNER: Manvith Karkera
   Concatenates the per-owner CSS/JS files into the three final deliverables:
   dist/index.html, dist/style.css, dist/script.js. No dependencies.
   Usage: node build.js */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const DIST = path.join(ROOT, 'dist');

const CSS_FILES = ['css/base.css', 'css/lab.css', 'css/workshop.css'];
// Contract load order (CONTRACT §5.1). mock-engine.js is dev only and is excluded.
const JS_FILES = [
  'js/content.js', 'js/workshop-content.js', 'js/icons.js', 'js/engine.js',
  'js/visuals.js', 'js/dashboard.js', 'js/quiz.js', 'js/workshop.js', 'js/terminal.js', 'js/workflow.js'
];

const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n');
const banner = (rel) => `/* ===== ${rel} ===== */\n`;

fs.mkdirSync(DIST, { recursive: true });

fs.writeFileSync(path.join(DIST, 'style.css'),
  CSS_FILES.map((f) => banner(f) + read(f)).join('\n'));

fs.writeFileSync(path.join(DIST, 'script.js'),
  JS_FILES.map((f) => banner(f) + read(f)).join('\n'));

let html = read('index.html');
html = html.replace(/[ \t]*<!-- build\.js replaces these (?:two )?links.*?-->\n/, '');
html = html.replace(/[ \t]*<link rel="stylesheet" href="css\/base\.css">\n[ \t]*<link rel="stylesheet" href="css\/lab\.css">\n[ \t]*<link rel="stylesheet" href="css\/workshop\.css">\n/,
  '  <link rel="stylesheet" href="style.css">\n');
html = html.replace(/<!-- build\.js replaces these script tags.*?-->\n(?:<script src="js\/[^"]+"><\/script>\n)+/,
  '<script src="script.js"></script>\n');
if (/css\/|js\//.test(html)) {
  console.error('build failed: dist/index.html still references css/ or js/ files');
  process.exit(1);
}
fs.writeFileSync(path.join(DIST, 'index.html'), html);

console.log('Built dist/index.html, dist/style.css, dist/script.js');
