const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { execFile } = require('child_process');
const { pathToFileURL } = require('url');

let db = null;
try {
  db = require('./db.js');
} catch (e) {
  console.warn('[Server] SQLite db module not available:', e.message);
}

const PORT = process.env.PORT || 8080;
const HOST = process.env.HOST || (process.env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2'
};

let _cachedBrowserPath;
function findHeadlessBrowser() {
  if (_cachedBrowserPath !== undefined) return _cachedBrowserPath;
  const candidates = [
    process.env.AUTOINVOICE_PDF_BROWSER,
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/microsoft-edge',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'
  ].filter(Boolean);
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) {
        _cachedBrowserPath = p;
        return _cachedBrowserPath;
      }
    } catch (_) { }
  }
  _cachedBrowserPath = null;
  return null;
}

function getCorsHeaders(req) {
  const origin = req.headers.origin;
  if (!origin) return { ok: true, headers: {} };
  try {
    const parsed = new URL(origin);
    const hostname = parsed.hostname.toLowerCase();
    const isLocalHost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname === '[::1]';
    const hostHdr = String(req.headers.host || '').trim();
    const serverAddr = typeof server !== 'undefined' && server && server.address ? server.address() : null;
    let reqPort = '';
    if (hostHdr) {
      const m = hostHdr.match(/^\[[^\]]+\](?::(\d+))?$/) || hostHdr.match(/^[^:]+(?::(\d+))?$/);
      reqPort = (m && m[1]) || '';
    }
    if (!reqPort) reqPort = String((serverAddr && serverAddr.port) || PORT);
    const originPort = parsed.port || (parsed.protocol === 'https:' ? '443' : '80');
    const samePort = !reqPort || originPort === String(reqPort);
    const allowRemote = process.env.AUTOINVOICE_ALLOW_REMOTE === '1';
    const matchesServerHost = allowRemote && hostHdr && parsed.host.toLowerCase() === hostHdr.toLowerCase();
    if ((parsed.protocol === 'http:' || parsed.protocol === 'https:') && ((isLocalHost && samePort) || matchesServerHost)) {
      return {
        ok: true,
        headers: {
          'Access-Control-Allow-Origin': origin,
          'Vary': 'Origin'
        }
      };
    }
  } catch (_) { }
  return { ok: false, headers: {} };
}

function jsonHeaders(req, extra = {}) {
  return Object.assign({ 'Content-Type': 'application/json; charset=utf-8' }, getCorsHeaders(req).headers, extra);
}

function requireJsonPost(req, res) {
  const ctype = String(req.headers['content-type'] || '').toLowerCase();
  if (!ctype.includes('application/json')) {
    res.writeHead(415, jsonHeaders(req));
    res.end(JSON.stringify({ error: 'Content-Type must be application/json' }));
    return false;
  }
  return true;
}

function readJsonBody(req, res, maxBytes, callback) {
  const chunks = [];
  let totalBytes = 0;
  let aborted = false;

  req.on('error', () => {
    if (aborted) return;
    aborted = true;
    if (!res.headersSent) {
      res.writeHead(400, jsonHeaders(req));
      res.end(JSON.stringify({ error: 'Request stream error' }));
    }
  });

  req.on('data', chunk => {
    if (aborted) return;
    totalBytes += chunk.length;
    if (totalBytes > maxBytes) {
      aborted = true;
      res.writeHead(413, jsonHeaders(req));
      res.end(JSON.stringify({ error: `Payload Too Large: maximum ${Math.round(maxBytes / 1024 / 1024)}MB` }));
      req.destroy();
      return;
    }
    chunks.push(chunk);
  });

  req.on('end', () => {
    if (aborted) return;
    let parsed;
    try {
      const raw = Buffer.concat(chunks).toString('utf8');
      parsed = JSON.parse(raw || '{}');
    } catch (parseErr) {
      res.writeHead(400, jsonHeaders(req));
      res.end(JSON.stringify({ error: 'Invalid JSON body' }));
      return;
    }
    callback(null, parsed);
  });
}

const server = http.createServer((req, res) => {
  const cors = getCorsHeaders(req);
  if (!cors.ok) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Forbidden Origin');
    return;
  }

  let reqPath;
  try {
    reqPath = decodeURI(req.url.split('?')[0]);
  } catch (e) {
    res.writeHead(400, { 'Content-Type': 'text/plain' });
    res.end('Bad Request');
    return;
  }
  if (reqPath.includes('\0')) {
    res.writeHead(400, { 'Content-Type': 'text/plain' });
    res.end('Bad Request');
    return;
  }

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, Object.assign({
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-AutoInvoice-Action'
    }, cors.headers));
    res.end();
    return;
  }

  // API: Headless PDF Engine Status
  if (reqPath === '/api/pdf/status') {
    if (req.method !== 'GET') {
      res.writeHead(405, jsonHeaders(req, { Allow: 'GET' }));
      res.end(JSON.stringify({ error: 'Method Not Allowed' }));
      return;
    }
    const browserPath = findHeadlessBrowser();
    res.writeHead(200, jsonHeaders(req, { 'Cache-Control': 'no-cache' }));
    res.end(JSON.stringify({
      available: !!browserPath,
      browser: browserPath ? path.basename(browserPath) : null
    }));
    return;
  }

  // API: Headless Server-Side A4 PDF Rendering (Zero-npm Edge/Chrome)
  if (reqPath === '/api/pdf') {
    if (req.method !== 'POST') {
      res.writeHead(405, jsonHeaders(req, { Allow: 'POST' }));
      res.end(JSON.stringify({ error: 'Method Not Allowed' }));
      return;
    }
    if (!requireJsonPost(req, res)) return;
    const browserPath = findHeadlessBrowser();
    if (!browserPath) {
      res.writeHead(501, jsonHeaders(req));
      res.end(JSON.stringify({ error: 'Headless PDF browser not found; use browser print fallback' }));
      return;
    }
    readJsonBody(req, res, 10 * 1024 * 1024, (err, body) => {
      if (err) return;
      const rawHtml = body && typeof body.html === 'string' ? body.html : '';
      if (!rawHtml.trim()) {
        res.writeHead(400, jsonHeaders(req));
        res.end(JSON.stringify({ error: 'Missing html snapshot payload' }));
        return;
      }
      const token = crypto.randomBytes(8).toString('hex');
      const tmpHtml = path.join(os.tmpdir(), `autoinvoice-pdf-${token}.html`);
      const tmpPdf = path.join(os.tmpdir(), `autoinvoice-pdf-${token}.pdf`);
      const safeName = (String(body.filename || 'AutoInvoice_Document').replace(/[^a-zA-Z0-9._-]/g, '_').replace(/\.pdf$/i, '') || 'AutoInvoice_Document') + '.pdf';

      const serverAddr = server.address();
      const activePort = (serverAddr && typeof serverAddr === 'object' && serverAddr.port) ? serverAddr.port : PORT;
      const rawHost = (serverAddr && typeof serverAddr === 'object' && serverAddr.address) ? serverAddr.address : '';
      const connectHost = (!rawHost || rawHost === '0.0.0.0' || rawHost === '::')
        ? '127.0.0.1'
        : (rawHost.includes(':') ? `[${rawHost}]` : rawHost);
      const serverOrigin = `http://${connectHost}:${activePort}`;
      const baseTag = `<base href="${serverOrigin}/">`;
      const cspTag = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${serverOrigin} 'unsafe-inline'; img-src ${serverOrigin} data:; font-src ${serverOrigin} data:; script-src 'none'; object-src 'none'; frame-src 'none'; connect-src 'none';">`;
      let sanitizedHtml = rawHtml.replace(/<base\b[^>]*>/gi, '');
      // Strip HTML comments, scripts/frames/meta-refresh, slash/space event handlers & script URIs iteratively
      let prevHtml;
      do {
        prevHtml = sanitizedHtml;
        sanitizedHtml = sanitizedHtml
          .replace(/<!--[\s\S]*?-->/g, '')
          .replace(/<script\b[\s\S]*?<\/script>/gi, '')
          .replace(/<(iframe|object|embed|applet)\b[\s\S]*?<\/\1>/gi, '')
          .replace(/<(iframe|object|embed|applet)\b[^>]*>/gi, '')
          .replace(/<meta\b[^>]*http-equiv\s*=\s*["']?\s*refresh\b[^>]*>/gi, '')
          .replace(/(?:[\s/])on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
          .replace(/\b(href|src|action|formaction|xlink:href)\s*=\s*(["']?)\s*(?:javascript|vbscript):/gi, '$1=$2#');
      } while (sanitizedHtml !== prevHtml);
      if (/<head\b[^>]*>/i.test(sanitizedHtml)) {
        sanitizedHtml = sanitizedHtml.replace(/<head\b([^>]*)>/i, `<head$1>${baseTag}${cspTag}`);
      } else {
        sanitizedHtml = `<!DOCTYPE html><html><head><meta charset="utf-8">${baseTag}${cspTag}</head><body>${sanitizedHtml}</body></html>`;
      }

      const cleanup = () => {
        try { if (fs.existsSync(tmpHtml)) fs.unlinkSync(tmpHtml); } catch (_) { }
        try { if (fs.existsSync(tmpPdf)) fs.unlinkSync(tmpPdf); } catch (_) { }
      };

      try {
        fs.writeFileSync(tmpHtml, sanitizedHtml, 'utf8');
        const args = [
          '--headless=new',
          '--disable-gpu',
          '--no-sandbox',
          '--disable-dev-shm-usage',
          '--no-pdf-header-footer',
          '--virtual-time-budget=2500',
          `--print-to-pdf=${tmpPdf}`,
          pathToFileURL(tmpHtml).href
        ];
        execFile(browserPath, args, { timeout: 25000 }, (execErr) => {
          if (execErr || !fs.existsSync(tmpPdf)) {
            cleanup();
            if (!res.headersSent) {
              res.writeHead(500, jsonHeaders(req));
              res.end(JSON.stringify({ error: 'PDF rendering failed', details: execErr ? execErr.message : 'Output PDF missing' }));
            }
            return;
          }
          fs.readFile(tmpPdf, (readErr, pdfBuf) => {
            cleanup();
            if (readErr || !pdfBuf || pdfBuf.length === 0) {
              if (!res.headersSent) {
                res.writeHead(500, jsonHeaders(req));
                res.end(JSON.stringify({ error: 'Failed to read generated PDF' }));
              }
              return;
            }
            res.writeHead(200, Object.assign({
              'Content-Type': 'application/pdf',
              'Content-Disposition': `attachment; filename="${safeName}"`,
              'Content-Length': String(pdfBuf.length),
              'Cache-Control': 'no-store'
            }, cors.headers));
            res.end(pdfBuf);
          });
        });
      } catch (writeErr) {
        cleanup();
        res.writeHead(500, jsonHeaders(req));
        res.end(JSON.stringify({ error: 'Failed to prepare PDF snapshot', details: writeErr.message }));
      }
    });
    return;
  }

  // API: SQLite Database Status
  if (reqPath === '/api/db/status') {
    if (req.method !== 'GET') {
      res.writeHead(405, jsonHeaders(req, { Allow: 'GET' }));
      res.end(JSON.stringify({ error: 'Method Not Allowed' }));
      return;
    }
    res.writeHead(200, jsonHeaders(req, { 'Cache-Control': 'no-cache' }));
    res.end(JSON.stringify(db ? db.getStatus() : { available: false, engine: 'none' }));
    return;
  }

  // API: SQLite Database Full Dump
  if (reqPath === '/api/db/all') {
    if (req.method !== 'GET') {
      res.writeHead(405, jsonHeaders(req, { Allow: 'GET' }));
      res.end(JSON.stringify({ error: 'Method Not Allowed' }));
      return;
    }
    if (!db || !db.isAvailable()) {
      res.writeHead(503, jsonHeaders(req));
      res.end(JSON.stringify({ error: 'SQLite database engine not available' }));
      return;
    }
    try {
      const data = db.getAllData();
      res.writeHead(200, jsonHeaders(req, { 'Cache-Control': 'no-cache' }));
      res.end(JSON.stringify(data));
    } catch (err) {
      res.writeHead(500, jsonHeaders(req));
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // API: Two-Way / Client Snapshot Sync to SQLite
  if (reqPath === '/api/db/sync') {
    if (req.method !== 'POST') {
      res.writeHead(405, jsonHeaders(req, { Allow: 'POST' }));
      res.end(JSON.stringify({ error: 'Method Not Allowed' }));
      return;
    }
    if (!db || !db.isAvailable()) {
      res.writeHead(503, jsonHeaders(req));
      res.end(JSON.stringify({ error: 'SQLite database engine not available' }));
      return;
    }
    if (!requireJsonPost(req, res)) return;
    readJsonBody(req, res, 25 * 1024 * 1024, (err, payload) => {
      if (err) return;
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        res.writeHead(400, jsonHeaders(req));
        res.end(JSON.stringify({ error: 'Sync payload must be a JSON object' }));
        return;
      }
      try {
        const result = db.syncClientSnapshot(payload);

        // Also ensure records/billers.json is synced if billers were sent
        if (Array.isArray(payload.billers) && payload.billers.length > 0) {
          const billersFile = path.join(__dirname, 'records', 'billers.json');
          fs.mkdir(path.dirname(billersFile), { recursive: true }, (mkErr) => {
            if (!mkErr) fs.writeFile(billersFile, JSON.stringify(payload.billers, null, 2), 'utf8', () => { });
          });
        }

        res.writeHead(200, jsonHeaders(req));
        res.end(JSON.stringify(result));
      } catch (syncErr) {
        res.writeHead(500, jsonHeaders(req));
        res.end(JSON.stringify({ error: 'Sync failed', details: syncErr.message }));
      }
    });
    return;
  }

  // API: Invoices CRUD
  if (reqPath === '/api/invoices') {
    if (!db || !db.isAvailable()) {
      res.writeHead(503, jsonHeaders(req));
      res.end(JSON.stringify({ error: 'Database not available' }));
      return;
    }
    if (req.method === 'GET') {
      try {
        const list = db.getAll('invoices');
        res.writeHead(200, jsonHeaders(req, { 'Cache-Control': 'no-cache' }));
        res.end(JSON.stringify(list));
      } catch (e) {
        res.writeHead(500, jsonHeaders(req));
        res.end(JSON.stringify({ error: e.message }));
      }
      return;
    }
    if (req.method === 'POST') {
      if (!requireJsonPost(req, res)) return;
      readJsonBody(req, res, 5 * 1024 * 1024, (err, invoice) => {
        if (err) return;
        if (!invoice || typeof invoice !== 'object' || Array.isArray(invoice)) {
          res.writeHead(400, jsonHeaders(req));
          res.end(JSON.stringify({ error: 'Invoice payload must be a JSON object' }));
          return;
        }
        const num = String(invoice.invoiceNumber || invoice.number || '').trim();
        if (!num) {
          res.writeHead(400, jsonHeaders(req));
          res.end(JSON.stringify({ error: 'Invoice payload must include invoiceNumber or number' }));
          return;
        }
        try {
          db.upsertInvoice(invoice);
          res.writeHead(200, jsonHeaders(req));
          res.end(JSON.stringify({ success: true, number: num }));
        } catch (e) {
          res.writeHead(500, jsonHeaders(req));
          res.end(JSON.stringify({ error: e.message }));
        }
      });
      return;
    }
    res.writeHead(405, jsonHeaders(req, { Allow: 'GET, POST' }));
    res.end(JSON.stringify({ error: 'Method Not Allowed' }));
    return;
  }

  // API: Expenses CRUD
  if (reqPath === '/api/expenses') {
    if (!db || !db.isAvailable()) {
      res.writeHead(503, jsonHeaders(req));
      res.end(JSON.stringify({ error: 'Database not available' }));
      return;
    }
    if (req.method === 'GET') {
      try {
        const list = db.getAll('expenses');
        res.writeHead(200, jsonHeaders(req, { 'Cache-Control': 'no-cache' }));
        res.end(JSON.stringify(list));
      } catch (e) {
        res.writeHead(500, jsonHeaders(req));
        res.end(JSON.stringify({ error: e.message }));
      }
      return;
    }
    if (req.method === 'POST') {
      if (!requireJsonPost(req, res)) return;
      readJsonBody(req, res, 2 * 1024 * 1024, (err, expense) => {
        if (err) return;
        if (!expense || typeof expense !== 'object' || Array.isArray(expense)) {
          res.writeHead(400, jsonHeaders(req));
          res.end(JSON.stringify({ error: 'Expense payload must be a JSON object' }));
          return;
        }
        const id = String(expense.id || expense.voucherNo || expense.expenseNumber || '').trim();
        if (!id) {
          res.writeHead(400, jsonHeaders(req));
          res.end(JSON.stringify({ error: 'Expense payload must include id, voucherNo, or expenseNumber' }));
          return;
        }
        try {
          db.upsertExpense(expense);
          res.writeHead(200, jsonHeaders(req));
          res.end(JSON.stringify({ success: true, id }));
        } catch (e) {
          res.writeHead(500, jsonHeaders(req));
          res.end(JSON.stringify({ error: e.message }));
        }
      });
      return;
    }
    res.writeHead(405, jsonHeaders(req, { Allow: 'GET, POST' }));
    res.end(JSON.stringify({ error: 'Method Not Allowed' }));
    return;
  }

  // API: Billers persistence (both SQLite and records/billers.json)
  if (reqPath === '/api/billers') {
    const billersFile = path.join(__dirname, 'records', 'billers.json');
    if (req.method === 'GET') {
      if (db && db.isAvailable()) {
        try {
          const billersList = db.getAll('billers');
          if (billersList.length > 0) {
            res.writeHead(200, jsonHeaders(req, { 'Cache-Control': 'no-cache' }));
            res.end(JSON.stringify(billersList));
            return;
          }
        } catch (e) {
          res.writeHead(500, jsonHeaders(req));
          res.end(JSON.stringify({ error: e.message }));
          return;
        }
      }
      fs.readFile(billersFile, 'utf8', (err, data) => {
        res.writeHead(200, jsonHeaders(req, { 'Cache-Control': 'no-cache' }));
        res.end(err || !data ? '[]' : data);
      });
      return;
    }
    if (req.method === 'POST') {
      if (!requireJsonPost(req, res)) return;
      readJsonBody(req, res, 5 * 1024 * 1024, (err, parsed) => {
        if (err) return;
        if (!Array.isArray(parsed)) {
          res.writeHead(400, jsonHeaders(req));
          res.end(JSON.stringify({ error: 'Expected JSON array of billers' }));
          return;
        }
        try {
          if (db && db.isAvailable()) {
            db.replaceBillers(parsed);
          }
        } catch (dbErr) {
          res.writeHead(500, jsonHeaders(req));
          res.end(JSON.stringify({ error: 'Failed to persist billers to SQLite', details: dbErr.message }));
          return;
        }
        fs.mkdir(path.dirname(billersFile), { recursive: true }, (mkdirErr) => {
          if (mkdirErr) {
            res.writeHead(500, jsonHeaders(req));
            res.end(JSON.stringify({ error: 'Failed to create directory' }));
            return;
          }
          fs.writeFile(billersFile, JSON.stringify(parsed, null, 2), 'utf8', (writeErr) => {
            if (writeErr) {
              res.writeHead(500, jsonHeaders(req));
              res.end(JSON.stringify({ error: 'Failed to write billers file' }));
              return;
            }
            res.writeHead(200, jsonHeaders(req));
            res.end(JSON.stringify({ success: true, count: parsed.length }));
          });
        });
      });
      return;
    }
    res.writeHead(405, jsonHeaders(req, { Allow: 'GET, POST' }));
    res.end(JSON.stringify({ error: 'Method Not Allowed' }));
    return;
  }

  // API: Clear/Reset database on disk
  if (reqPath === '/api/clear' || reqPath === '/api/reset') {
    if (req.method !== 'POST') {
      res.writeHead(405, jsonHeaders(req, { Allow: 'POST' }));
      res.end(JSON.stringify({ error: 'Method Not Allowed' }));
      return;
    }
    if (!requireJsonPost(req, res)) return;
    if (req.headers['x-autoinvoice-action'] !== 'confirm') {
      res.writeHead(403, jsonHeaders(req));
      res.end(JSON.stringify({ error: 'Explicit confirmation header required for clear operation' }));
      return;
    }
    const defaultBiller = [
      {
        id: "biller_default",
        name: "Amirul Islam",
        slogan: "Freelance Embedded Systems Service provider",
        address: "Banasree, Rampura, Dhaka, Bangladesh",
        phone: "+8801747144755",
        email: "mahadi.ma.ak@gmail.com",
        website: "",
        taxId: "",
        logoDataUri: "assets/logo.svg",
        themeColor: "#0b3969",
        prefixes: {
          invoice: "INV",
          challan: "CH",
          receipt: "RCPT",
          quotation: "QTN"
        },
        signatureLabels: {
          deliveredBy: "Delivered by",
          receivedBy: "Received by",
          authorizedBy: "Authorized Signature"
        },
        isDefault: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];

    const billersFile = path.join(__dirname, 'records', 'billers.json');
    const invIndex = path.join(__dirname, 'records', 'invoices', 'index.json');
    const chalIndex = path.join(__dirname, 'records', 'challans', 'index.json');

    try {
      fs.mkdirSync(path.dirname(billersFile), { recursive: true });
      fs.writeFileSync(billersFile, JSON.stringify(defaultBiller, null, 2), 'utf8');

      if (fs.existsSync(path.dirname(invIndex))) {
        fs.writeFileSync(invIndex, JSON.stringify({ version: 1, records: [] }, null, 2), 'utf8');
      }
      if (fs.existsSync(path.dirname(chalIndex))) {
        fs.writeFileSync(chalIndex, JSON.stringify({ version: 1, records: [] }, null, 2), 'utf8');
      }

      if (db && db.isAvailable()) {
        db.clearAllTables(defaultBiller);
      }

      res.writeHead(200, jsonHeaders(req));
      res.end(JSON.stringify({ success: true, message: 'Database reset to default' }));
    } catch (err) {
      res.writeHead(500, jsonHeaders(req));
      res.end(JSON.stringify({ error: 'Failed to reset database on disk', details: err.message }));
    }
    return;
  }

  if (reqPath.startsWith('/api/')) {
    res.writeHead(404, jsonHeaders(req));
    res.end(JSON.stringify({ error: 'API route not found' }));
    return;
  }

  if (reqPath === '/' || reqPath === '') {
    reqPath = '/index.html';
  }

  const filePath = path.join(__dirname, reqPath);

  // Security: prevent path traversal and block internal server/DB/metadata files
  const rel = path.relative(__dirname, filePath);
  const relPosix = rel.split(path.sep).join('/');
  const relLower = relPosix.toLowerCase();
  const isBlockedFile =
    rel.startsWith('..') ||
    path.isAbsolute(rel) ||
    relPosix.includes(':') ||
    reqPath.includes(':') ||
    /(^|\/)\./.test(relPosix) ||
    relLower === 'server.js' ||
    relLower === 'db.js' ||
    relLower === 'package.json' ||
    relLower === 'package-lock.json' ||
    relLower === 'dockerfile' ||
    relLower === 'docker-compose.yml' ||
    relLower === 'audit_report.md' ||
    relLower.startsWith('graphify-out/') ||
    relLower === 'graphify-out' ||
    relLower.startsWith('node_modules/') ||
    /\.(db|db-wal|db-shm|sqlite|sqlite3)$/i.test(relLower);

  if (isBlockedFile) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(`File Not Found: ${reqPath}`);
      return;
    }

    if (stats.isDirectory()) {
      const indexPath = path.join(filePath, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.writeHead(200, Object.assign({
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-cache'
        }, cors.headers));
        fs.createReadStream(indexPath).on('error', () => {
          if (!res.headersSent) {
            res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('File read error');
          } else { res.destroy(); }
        }).pipe(res);
        return;
      }

      const normDir = reqPath.replace(/\/+$/, '');
      if (normDir !== '/records/invoices' && normDir !== '/records/challans') {
        res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Directory listing disabled');
        return;
      }

      fs.readdir(filePath, (readErr, files) => {
        if (readErr) {
          res.writeHead(500, { 'Content-Type': 'text/plain' });
          res.end('Error reading directory');
          return;
        }
        const esc = s => String(s).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
        const links = files.map(f => `<li><a href="${encodeURI(f)}">${esc(f)}</a></li>`).join('');
        const html = `<!DOCTYPE html><html><head><title>Index of ${esc(reqPath)}</title></head><body><h1>Index of ${esc(reqPath)}</h1><ul>${links}</ul></body></html>`;
        res.writeHead(200, Object.assign({
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-cache'
        }, cors.headers));
        res.end(html);
      });
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, Object.assign({
      'Content-Type': contentType,
      'Cache-Control': 'no-cache'
    }, cors.headers));

    fs.createReadStream(filePath).on('error', () => {
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('File read error');
      } else { res.destroy(); }
    }).pipe(res);
  });
});

server.listen(PORT, HOST, () => {
  console.log(`AutoInvoice server is running!`);
  console.log(`URL: http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`);
  console.log(`Dashboard: http://localhost:${PORT}/index.html`);
  console.log(`Invoice:   http://localhost:${PORT}/invoice.html`);
  console.log(`Challan:   http://localhost:${PORT}/challan.html`);
  console.log(`Quotation: http://localhost:${PORT}/quotation.html`);
  console.log(`Receipt:   http://localhost:${PORT}/receipt.html`);
  console.log(`Search:    http://localhost:${PORT}/search.html`);
  console.log(`Tests:     http://localhost:${PORT}/tests/tests.html`);
});

function gracefulShutdown() {
  try {
    if (db && typeof db.checkpointWal === 'function') db.checkpointWal('TRUNCATE');
    if (db && typeof db.closeDb === 'function') db.closeDb();
  } catch (_) { }
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 2000).unref();
}
process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);
