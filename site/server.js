const express = require('express');
const { marked } = require('marked');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const ROOT = path.join(__dirname, '..');

// Configure marked with heading IDs for TOC anchor links
const renderer = new marked.Renderer();
renderer.heading = function({ tokens, depth }) {
  const text = this.parser.parseInline(tokens);
  const raw = tokens.map(t => t.raw || t.text || '').join('');
  // Generate slug matching the markdown TOC anchor style
  const slug = raw.toLowerCase()
    .replace(/<[^>]*>/g, '')
    .replace(/[—–]/g, '')           // remove em/en dashes  
    .replace(/[^\w\s-]/g, '')       // remove other special chars
    .replace(/\s/g, '-')            // each space → one hyphen (preserves double spaces as --)
    .trim();
  return `<h${depth} id="${slug}">${text}</h${depth}>`;
};
marked.setOptions({ gfm: true, breaks: true, renderer });

function getFiles(dir) {
  const full = path.join(ROOT, dir);
  if (!fs.existsSync(full)) return [];
  return fs.readdirSync(full)
    .filter(f => f.endsWith('.md') && f !== '.gitkeep')
    .map(f => ({ name: f.replace('.md', ''), file: f, dir }));
}

function renderPage(title, body, back) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex, nofollow">
<title>${title} — Project Future</title>
<style>
  html { scroll-behavior: smooth; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
    background: #0d1117; color: #e6edf3;
    line-height: 1.7; padding: 0;
    -webkit-font-smoothing: antialiased;
  }
  .container { max-width: 720px; margin: 0 auto; padding: 24px 20px 60px; }
  .back { display: inline-block; margin-bottom: 20px; color: #58a6ff; text-decoration: none; font-size: 14px; }
  .back:hover { text-decoration: underline; }
  h1 { font-size: 1.8em; margin-bottom: 8px; color: #fff; border-bottom: 1px solid #30363d; padding-bottom: 12px; }
  h2 { font-size: 1.4em; margin-top: 32px; margin-bottom: 12px; color: #fff; border-bottom: 1px solid #21262d; padding-bottom: 8px; }
  h3 { font-size: 1.15em; margin-top: 24px; margin-bottom: 8px; color: #e6edf3; }
  p { margin-bottom: 16px; }
  ul, ol { margin-bottom: 16px; padding-left: 24px; }
  li { margin-bottom: 6px; }
  strong { color: #fff; }
  a { color: #58a6ff; text-decoration: none; }
  a:hover { text-decoration: underline; }
  table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 0.9em; overflow-x: auto; display: block; }
  th, td { border: 1px solid #30363d; padding: 8px 12px; text-align: left; }
  th { background: #161b22; color: #fff; font-weight: 600; }
  tr:nth-child(even) { background: #161b22; }
  code { background: #161b22; padding: 2px 6px; border-radius: 4px; font-size: 0.9em; color: #f0883e; }
  pre { background: #161b22; padding: 16px; border-radius: 8px; overflow-x: auto; margin: 16px 0; }
  pre code { background: none; padding: 0; color: #e6edf3; }
  blockquote { border-left: 3px solid #30363d; padding-left: 16px; color: #8b949e; margin: 16px 0; }
  hr { border: none; border-top: 1px solid #21262d; margin: 32px 0; }
  .card {
    background: #161b22; border: 1px solid #30363d; border-radius: 12px;
    padding: 20px; margin-bottom: 12px; text-decoration: none; display: block;
    transition: border-color 0.2s;
  }
  .card:hover { border-color: #58a6ff; text-decoration: none; }
  .card h3 { margin: 0 0 6px; color: #fff; font-size: 1.05em; }
  .card p { color: #8b949e; margin: 0; font-size: 0.9em; }
  .section-label { color: #8b949e; font-size: 0.75em; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; }
  .hero { text-align: center; padding: 40px 0 32px; }
  .hero h1 { border: none; font-size: 2.2em; }
  .hero p { color: #8b949e; font-size: 1.05em; }
  @media (max-width: 480px) {
    .container { padding: 16px 14px 40px; }
    h1 { font-size: 1.5em; }
    h2 { font-size: 1.2em; }
    table { font-size: 0.8em; }
    th, td { padding: 6px 8px; }
  }
</style>
</head>
<body>
<div class="container">
${back ? '<a class="back" href="/">← Back to index</a>' : ''}
${body}
</div>
</body>
</html>`;
}

// Index page
app.get('/', (req, res) => {
  const research = getFiles('research');
  const scenarios = getFiles('scenarios');
  const thoughts = getFiles('thoughts');

  const section = (label, items, dir) => {
    if (!items.length) return '';
    const cards = items.map(i => {
      const content = fs.readFileSync(path.join(ROOT, dir, i.file), 'utf8');
      const firstLine = content.split('\n').find(l => l.trim() && !l.startsWith('#')) || '';
      const preview = firstLine.replace(/[*_`]/g, '').slice(0, 120);
      return `<a class="card" href="/${dir}/${i.name}"><h3>${i.name.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</h3><p>${preview}${preview.length >= 120 ? '…' : ''}</p></a>`;
    }).join('\n');
    return `<div class="section-label">${label}</div>\n${cards}`;
  };

  const body = `
<div class="hero">
  <h1>🔮 Project Future</h1>
  <p>Research & scenario planning for AI-driven shifts</p>
</div>
${section('Research', research, 'research')}
${section('Scenarios', scenarios, 'scenarios')}
${section('Thoughts', thoughts, 'thoughts')}
`;
  res.send(renderPage('Home', body, false));
});

// Document pages
app.get('/:dir/:name', (req, res) => {
  const { dir, name } = req.params;
  if (!['research', 'scenarios', 'thoughts'].includes(dir)) return res.status(404).send('Not found');
  const filePath = path.join(ROOT, dir, `${name}.md`);
  if (!fs.existsSync(filePath)) return res.status(404).send('Not found');
  const md = fs.readFileSync(filePath, 'utf8');
  const html = marked(md);
  const title = name.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  res.send(renderPage(title, html, true));
});

app.listen(PORT, () => console.log(`Project Future running on port ${PORT}`));
