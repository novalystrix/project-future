const express = require('express');
const crypto = require('crypto');
const { marked } = require('marked');
const fs = require('fs');
const path = require('path');
const { OAuth2Client } = require('google-auth-library');

const app = express();
const PORT = process.env.PORT || 3000;
const ROOT = path.join(__dirname, '..');

// --- Google OAuth Config ---
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const BASE_URL = process.env.BASE_URL || 'https://project-future.onrender.com';
const REDIRECT_URI = `${BASE_URL}/auth/callback`;

// Allowed emails (lowercase)
const ALLOWED_EMAILS = [
  'vaselin@gmail.com',
  'mayaalpe@gmail.com',
];

const COOKIE_NAME = 'pf_session';
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');

function makeSessionToken(email) {
  return crypto.createHmac('sha256', SESSION_SECRET).update(email.toLowerCase()).digest('hex');
}

function parseCookies(req) {
  const header = req.headers.cookie || '';
  const cookies = {};
  header.split(';').forEach(c => {
    const [k, ...v] = c.split('=');
    if (k) cookies[k.trim()] = decodeURIComponent(v.join('=').trim());
  });
  return cookies;
}

function getEmailFromCookie(req) {
  const cookies = parseCookies(req);
  const raw = cookies[COOKIE_NAME] || '';
  // Format: email:hmac
  const idx = raw.lastIndexOf(':');
  if (idx === -1) return null;
  const email = raw.substring(0, idx);
  const hmac = raw.substring(idx + 1);
  if (makeSessionToken(email) !== hmac) return null;
  return email;
}

function setSessionCookie(res, email) {
  const token = `${email}:${makeSessionToken(email)}`;
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000`);
}

// --- Login page ---
const loginPage = (error) => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex, nofollow">
<title>Project Future — Login</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; background: #0d1117; color: #e6edf3; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
  .login-box { background: #161b22; border: 1px solid #30363d; border-radius: 12px; padding: 40px 32px; width: 340px; text-align: center; }
  .login-box h1 { font-size: 1.5em; margin-bottom: 8px; }
  .login-box p { color: #8b949e; font-size: 0.9em; margin-bottom: 24px; }
  .google-btn {
    display: flex; align-items: center; justify-content: center; gap: 12px;
    width: 100%; padding: 12px 16px; border-radius: 8px; border: 1px solid #30363d;
    background: #fff; color: #3c4043; font-size: 0.95em; font-weight: 500;
    cursor: pointer; text-decoration: none; transition: background 0.2s;
  }
  .google-btn:hover { background: #f8f9fa; }
  .google-btn svg { flex-shrink: 0; }
  .error { color: #f85149; font-size: 0.85em; margin-bottom: 16px; }
  .restricted { color: #8b949e; font-size: 0.8em; margin-top: 20px; }
</style>
</head>
<body>
<div class="login-box">
  <h1>🔮 Project Future</h1>
  <p>Sign in to access research & scenarios</p>
  ${error ? `<div class="error">${error}</div>` : ''}
  <a class="google-btn" href="/auth/login">
    <svg width="18" height="18" viewBox="0 0 18 18"><path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 002.38-5.88c0-.57-.05-.66-.15-1.17z"/><path fill="#34A853" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2a4.8 4.8 0 01-7.18-2.54H1.83v2.07A8 8 0 008.98 17z"/><path fill="#FBBC05" d="M4.5 10.52a4.8 4.8 0 010-3.04V5.41H1.83a8 8 0 000 7.18l2.67-2.07z"/><path fill="#EA4335" d="M8.98 4.18c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 001.83 5.4L4.5 7.49a4.77 4.77 0 014.48-3.31z"/></svg>
    Sign in with Google
  </a>
  <p class="restricted">Access restricted to invited users only.</p>
</div>
</body>
</html>`;

app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// Auth routes
app.get('/auth/login', (req, res) => {
  const oAuth2Client = new OAuth2Client(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, REDIRECT_URI);
  const url = oAuth2Client.generateAuthUrl({
    access_type: 'online',
    scope: ['email', 'profile'],
    prompt: 'select_account',
  });
  res.redirect(url);
});

app.get('/auth/callback', async (req, res) => {
  const { code, error } = req.query;
  if (error || !code) {
    return res.status(400).send(loginPage('Google sign-in was cancelled or failed.'));
  }
  try {
    const oAuth2Client = new OAuth2Client(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, REDIRECT_URI);
    const { tokens } = await oAuth2Client.getToken(code);
    oAuth2Client.setCredentials(tokens);

    // Get user info
    const ticket = await oAuth2Client.verifyIdToken({
      idToken: tokens.id_token,
      audience: GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    const email = (payload.email || '').toLowerCase();

    if (!ALLOWED_EMAILS.includes(email)) {
      return res.status(403).send(loginPage(`Access denied. ${email} is not an authorized user.`));
    }

    setSessionCookie(res, email);
    res.redirect('/');
  } catch (err) {
    console.error('OAuth error:', err.message);
    res.status(500).send(loginPage('Authentication failed. Please try again.'));
  }
});

app.get('/auth/logout', (req, res) => {
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; Path=/; HttpOnly; Max-Age=0`);
  res.redirect('/');
});

// Auth middleware
app.use((req, res, next) => {
  if (req.path.startsWith('/auth/')) return next();
  const email = getEmailFromCookie(req);
  if (email && ALLOWED_EMAILS.includes(email)) return next();
  return res.status(401).send(loginPage());
});

// Configure marked with heading IDs for TOC anchor links
const renderer = new marked.Renderer();
renderer.heading = function({ tokens, depth }) {
  const text = this.parser.parseInline(tokens);
  const raw = tokens.map(t => t.raw || t.text || '').join('');
  const slug = raw.toLowerCase()
    .replace(/<[^>]*>/g, '')
    .replace(/[—–]/g, '')
    .replace(/[^\w\s-]/g, '')
    .replace(/\s/g, '-')
    .trim();
  return `<h${depth} id="${slug}">${text}</h${depth}>`;
};
marked.setOptions({ gfm: true, breaks: true, renderer });

// Recursively get all .md files from a directory
function getFilesRecursive(dir, basePath) {
  basePath = basePath || dir;
  const full = path.join(ROOT, dir);
  if (!fs.existsSync(full)) return [];
  let results = [];
  const entries = fs.readdirSync(full, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === '.gitkeep' || entry.name === 'README.md') continue;
    const rel = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results = results.concat(getFilesRecursive(rel, basePath));
    } else if (entry.name.endsWith('.md')) {
      results.push({
        name: entry.name.replace('.md', ''),
        file: entry.name,
        dir: dir,
        subdir: dir !== basePath ? dir.replace(basePath + '/', '') : null,
        route: `/${dir}/${entry.name.replace('.md', '')}`
      });
    }
  }
  return results;
}

// Get top-level files only
function getTopLevelFiles(dir) {
  const full = path.join(ROOT, dir);
  if (!fs.existsSync(full)) return [];
  return fs.readdirSync(full, { withFileTypes: true })
    .filter(f => f.isFile() && f.name.endsWith('.md') && f.name !== '.gitkeep' && f.name !== 'README.md')
    .map(f => ({
      name: f.name.replace('.md', ''),
      file: f.name,
      dir: dir,
      subdir: null,
      route: `/${dir}/${f.name.replace('.md', '')}`
    }));
}

// Get subdirectories
function getSubdirs(dir) {
  const full = path.join(ROOT, dir);
  if (!fs.existsSync(full)) return [];
  return fs.readdirSync(full, { withFileTypes: true })
    .filter(f => f.isDirectory())
    .map(f => f.name);
}

function getPreview(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const firstLine = content.split('\n').find(l => l.trim() && !l.startsWith('#')) || '';
  const preview = firstLine.replace(/[*_`]/g, '').slice(0, 140);
  return preview + (preview.length >= 140 ? '…' : '');
}

function prettyName(name) {
  return name.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
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
  .topbar { display: flex; justify-content: flex-end; padding: 12px 20px; border-bottom: 1px solid #21262d; }
  .logout-btn { color: #8b949e; font-size: 0.8em; text-decoration: none; }
  .logout-btn:hover { color: #e6edf3; }
  h1 { font-size: 1.8em; margin-bottom: 8px; color: #fff; border-bottom: 1px solid #30363d; padding-bottom: 12px; }
  h2 { font-size: 1.4em; margin-top: 32px; margin-bottom: 12px; color: #fff; border-bottom: 1px solid #21262d; padding-bottom: 8px; }
  h3 { font-size: 1.15em; margin-top: 24px; margin-bottom: 8px; color: #e6edf3; }
  h4 { font-size: 1.05em; margin-top: 20px; margin-bottom: 6px; color: #c9d1d9; }
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
  .section-label { color: #8b949e; font-size: 0.75em; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; margin-top: 28px; }
  .subsection-label { color: #58a6ff; font-size: 0.85em; font-weight: 600; margin-top: 24px; margin-bottom: 10px; padding-left: 4px; }
  .subsection-card {
    background: #161b22; border: 1px solid #30363d; border-radius: 10px;
    padding: 16px 18px; margin-bottom: 10px; margin-left: 8px; text-decoration: none; display: block;
    transition: border-color 0.2s; border-left: 3px solid #30363d;
  }
  .subsection-card:hover { border-color: #58a6ff; border-left-color: #58a6ff; text-decoration: none; }
  .subsection-card h3 { margin: 0 0 4px; color: #e6edf3; font-size: 0.95em; }
  .subsection-card p { color: #8b949e; margin: 0; font-size: 0.85em; }
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
<div class="topbar"><a class="logout-btn" href="/auth/logout">Sign out</a></div>
<div class="container">
${back ? `<a class="back" href="${typeof back === 'string' ? back : '/'}">← Back</a>` : ''}
${body}
</div>
</body>
</html>`;
}

// Index page
app.get('/', (req, res) => {
  const buildSection = (label, dir) => {
    const topFiles = getTopLevelFiles(dir);
    const subdirs = getSubdirs(dir);
    if (!topFiles.length && !subdirs.length) return '';

    let html = `<div class="section-label">${label}</div>\n`;

    for (const item of topFiles) {
      const preview = getPreview(path.join(ROOT, dir, item.file));
      html += `<a class="card" href="${item.route}"><h3>${prettyName(item.name)}</h3><p>${preview}</p></a>\n`;
    }

    for (const sub of subdirs) {
      const subPath = `${dir}/${sub}`;
      const subFiles = getFilesRecursive(subPath, subPath);
      if (!subFiles.length) continue;
      html += `<a class="card" href="/section/${subPath}"><h3>📁 ${prettyName(sub)}</h3><p>${subFiles.length} documents</p></a>\n`;
    }

    return html;
  };

  const body = `
<div class="hero">
  <h1>🔮 Project Future</h1>
  <p>Research & scenario planning for AI-driven shifts</p>
</div>
${buildSection('Research', 'research')}
${buildSection('Scenarios', 'scenarios')}
${buildSection('Thoughts', 'thoughts')}
`;
  res.send(renderPage('Home', body, false));
});

// Section page (for subdirectories)
app.get('/section/*dir', (req, res) => {
  const dir = Array.isArray(req.params.dir) ? req.params.dir.join('/') : req.params.dir;
  const full = path.join(ROOT, dir);
  if (!fs.existsSync(full) || !fs.statSync(full).isDirectory()) return res.status(404).send('Not found');

  const files = getFilesRecursive(dir, dir);
  if (!files.length) return res.status(404).send('Not found');

  let intro = '';
  const readmePath = path.join(full, 'README.md');
  if (fs.existsSync(readmePath)) {
    const readmeContent = fs.readFileSync(readmePath, 'utf8');
    intro = marked(readmeContent);
  }

  const groups = {};
  const topLevel = [];
  for (const f of files) {
    if (f.subdir) {
      if (!groups[f.subdir]) groups[f.subdir] = [];
      groups[f.subdir].push(f);
    } else {
      topLevel.push(f);
    }
  }

  let cards = '';
  if (intro) {
    cards += `<div style="margin-bottom: 24px; color: #8b949e; font-size: 0.95em;">${intro}</div>`;
  }

  for (const f of topLevel) {
    const preview = getPreview(path.join(ROOT, f.dir, f.file));
    cards += `<a class="card" href="${f.route}"><h3>${prettyName(f.name)}</h3><p>${preview}</p></a>\n`;
  }

  for (const [sub, subFiles] of Object.entries(groups)) {
    cards += `<div class="subsection-label">${prettyName(sub)}</div>\n`;
    for (const f of subFiles) {
      const preview = getPreview(path.join(ROOT, f.dir, f.file));
      cards += `<a class="subsection-card" href="${f.route}"><h3>${prettyName(f.name)}</h3><p>${preview}</p></a>\n`;
    }
  }

  const dirName = dir.split('/').pop();
  const body = `<h1>${prettyName(dirName)}</h1>\n${cards}`;
  res.send(renderPage(prettyName(dirName), body, '/'));
});

// Document pages (supports nested paths)
app.get('/*path', (req, res) => {
  const fullPath = Array.isArray(req.params.path) ? req.params.path.join('/') : req.params.path;

  const filePath = path.join(ROOT, `${fullPath}.md`);
  if (!fs.existsSync(filePath)) return res.status(404).send('Not found');

  const resolved = path.resolve(filePath);
  const rootResolved = path.resolve(ROOT);
  if (!resolved.startsWith(rootResolved)) return res.status(403).send('Forbidden');

  const topDir = fullPath.split('/')[0];
  if (!['research', 'scenarios', 'thoughts'].includes(topDir)) return res.status(404).send('Not found');

  const md = fs.readFileSync(filePath, 'utf8');
  const html = marked(md);
  const name = fullPath.split('/').pop();
  const title = prettyName(name);

  const parts = fullPath.split('/');
  let backLink = '/';
  if (parts.length > 2) {
    backLink = '/section/' + parts.slice(0, -1).join('/');
  }

  res.send(renderPage(title, html, backLink));
});

app.listen(PORT, '0.0.0.0', () => console.log(`Project Future running on port ${PORT}`));
