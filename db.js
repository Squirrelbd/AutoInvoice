// AutoInvoice - Embedded SQLite Database Engine
// Powered by Node.js built-in 'node:sqlite' (Zero external npm packages)
// Provides ACID transactions, single-file storage, and fast indexed search.

const path = require('path');
const fs = require('fs');

let DatabaseSync = null;
try {
  const sqlite = require('node:sqlite');
  DatabaseSync = sqlite.DatabaseSync;
} catch (e) {
  DatabaseSync = null;
}

const DB_DIR = path.join(__dirname, 'records');
const DB_PATH = process.env.AUTOINVOICE_DB_PATH
  ? path.resolve(process.env.AUTOINVOICE_DB_PATH)
  : path.join(DB_DIR, 'autoinvoice.db');

function _slugKey(prefix, raw) {
  const s = String(raw || '').trim().normalize('NFC');
  if (!s) return '';
  if (/^[a-z0-9]+$/i.test(s)) {
    return s.toLowerCase();
  }
  let hash = 2166136261;
  for (let i = 0; i < s.length; i++) {
    hash ^= s.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const safe = s.toLowerCase().replace(/[^\p{L}\p{M}\p{N}]+/gu, '_').replace(/^_+|_+$/g, '').slice(0, 32);
  return `${prefix}_${safe || 'u'}_${(hash >>> 0).toString(16)}`;
}

let dbInstance = null;

function getDb() {
  if (dbInstance) return dbInstance;
  if (!DatabaseSync) {
    throw new Error("node:sqlite is not supported in this Node runtime (requires Node.js >= 22.5.0)");
  }
  const dbDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  dbInstance = new DatabaseSync(DB_PATH);

  // Optimize SQLite for high reliability & fast local reads
  dbInstance.exec("PRAGMA journal_mode = WAL;");
  dbInstance.exec("PRAGMA synchronous = NORMAL;");
  dbInstance.exec("PRAGMA busy_timeout = 5000;");

  initSchema(dbInstance);
  seedFromExistingFiles(dbInstance);

  return dbInstance;
}

function closeDb() {
  if (dbInstance) {
    try { dbInstance.close(); } catch (_) { }
    dbInstance = null;
  }
}

function initSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS invoices (
      number TEXT PRIMARY KEY,
      date TEXT,
      client_name TEXT,
      total_amount REAL DEFAULT 0,
      status TEXT,
      biller_id TEXT,
      data TEXT NOT NULL,
      created_at TEXT,
      updated_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_invoices_date ON invoices(date);
    CREATE INDEX IF NOT EXISTS idx_invoices_client ON invoices(client_name);

    CREATE TABLE IF NOT EXISTS challans (
      number TEXT PRIMARY KEY,
      date TEXT,
      client_name TEXT,
      status TEXT,
      biller_id TEXT,
      data TEXT NOT NULL,
      created_at TEXT,
      updated_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_challans_date ON challans(date);
    CREATE INDEX IF NOT EXISTS idx_challans_client ON challans(client_name);

    CREATE TABLE IF NOT EXISTS quotations (
      number TEXT PRIMARY KEY,
      date TEXT,
      valid_until TEXT,
      client_name TEXT,
      total_amount REAL DEFAULT 0,
      biller_id TEXT,
      data TEXT NOT NULL,
      created_at TEXT,
      updated_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_quotations_date ON quotations(date);
    CREATE INDEX IF NOT EXISTS idx_quotations_valid_until ON quotations(valid_until);

    CREATE TABLE IF NOT EXISTS receipts (
      number TEXT PRIMARY KEY,
      date TEXT,
      client_name TEXT,
      amount REAL DEFAULT 0,
      biller_id TEXT,
      data TEXT NOT NULL,
      created_at TEXT,
      updated_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_receipts_date ON receipts(date);

    CREATE TABLE IF NOT EXISTS expenses (
      id TEXT PRIMARY KEY,
      voucher_no TEXT,
      date TEXT,
      category TEXT,
      amount REAL DEFAULT 0,
      description TEXT,
      paid_to TEXT,
      payment_method TEXT,
      data TEXT NOT NULL,
      created_at TEXT,
      updated_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);
    CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);

    CREATE TABLE IF NOT EXISTS billers (
      id TEXT PRIMARY KEY,
      name TEXT,
      is_default INTEGER DEFAULT 0,
      data TEXT NOT NULL,
      created_at TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS clients (
      id TEXT PRIMARY KEY,
      name TEXT,
      phone TEXT,
      data TEXT NOT NULL,
      created_at TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS catalog_items (
      id TEXT PRIMARY KEY,
      description TEXT,
      unit_price REAL DEFAULT 0,
      data TEXT NOT NULL,
      created_at TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS expense_categories (
      id TEXT PRIMARY KEY,
      name TEXT,
      data TEXT NOT NULL,
      created_at TEXT
    );

    CREATE TABLE IF NOT EXISTS settings_kv (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at TEXT
    );
  `);

  try {
    db.exec("ALTER TABLE quotations ADD COLUMN valid_until TEXT;");
  } catch (_) {
    // Column already exists
  }
  try {
    db.exec("CREATE INDEX IF NOT EXISTS idx_quotations_valid_until ON quotations(valid_until);");
  } catch (_) { }
  try {
    db.exec("ALTER TABLE receipts ADD COLUMN status TEXT;");
  } catch (_) {
    // Column already exists
  }
}

function seedFromExistingFiles(db) {
  // If billers table is empty, seed from records/billers.json if present
  try {
    const billerCount = db.prepare("SELECT COUNT(*) AS count FROM billers").get().count;
    if (billerCount === 0) {
      const billersFile = path.join(DB_DIR, 'billers.json');
      if (fs.existsSync(billersFile)) {
        const raw = fs.readFileSync(billersFile, 'utf8');
        const list = JSON.parse(raw);
        if (Array.isArray(list)) {
          const insert = db.prepare(`
            INSERT OR REPLACE INTO billers (id, name, is_default, data, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
          `);
          for (const b of list) {
            insert.run(
              b.id || 'biller_default',
              b.name || 'Default Biller',
              b.isDefault ? 1 : 0,
              JSON.stringify(b),
              b.createdAt || new Date().toISOString(),
              b.updatedAt || new Date().toISOString()
            );
          }
        }
      }
    }
  } catch (e) {
    console.warn("[SQLite] Auto-seed error (non-fatal):", e.message);
  }
}

function isAvailable() {
  return DatabaseSync !== null;
}

function getStatus() {
  if (!isAvailable()) {
    return {
      available: false,
      engine: 'none',
      reason: 'node:sqlite not available in this Node version'
    };
  }

  const db = getDb();
  let fileSize = 0;
  try {
    if (fs.existsSync(DB_PATH)) {
      fileSize = fs.statSync(DB_PATH).size;
    }
  } catch (e) { }

  const counts = {
    invoices: db.prepare("SELECT COUNT(*) AS c FROM invoices").get().c,
    challans: db.prepare("SELECT COUNT(*) AS c FROM challans").get().c,
    quotations: db.prepare("SELECT COUNT(*) AS c FROM quotations").get().c,
    receipts: db.prepare("SELECT COUNT(*) AS c FROM receipts").get().c,
    expenses: db.prepare("SELECT COUNT(*) AS c FROM expenses").get().c,
    billers: db.prepare("SELECT COUNT(*) AS c FROM billers").get().c,
    clients: db.prepare("SELECT COUNT(*) AS c FROM clients").get().c,
    items: db.prepare("SELECT COUNT(*) AS c FROM catalog_items").get().c,
    categories: db.prepare("SELECT COUNT(*) AS c FROM expense_categories").get().c
  };

  return {
    available: true,
    engine: 'node:sqlite (built-in)',
    dbPath: DB_PATH,
    sizeBytes: fileSize,
    counts
  };
}

// -------------------------------------------------------------
// Upsert and Batch Operations
// -------------------------------------------------------------

function upsertInvoice(inv) {
  const num = inv && (inv.number || inv.invoiceNumber);
  if (!inv || !num) return;
  const db = getDb();
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO invoices (number, date, client_name, total_amount, status, biller_id, data, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    String(num),
    inv.date || inv.invoiceDate || '',
    inv.client?.name || inv.clientName || '',
    Number(inv.grandTotal || inv.total || 0),
    inv.status || 'saved',
    inv.billerId || '',
    JSON.stringify(inv),
    inv.createdAt || new Date().toISOString(),
    new Date().toISOString()
  );
}

function upsertChallan(ch) {
  const num = ch && (ch.number || ch.challanNumber);
  if (!ch || !num) return;
  const db = getDb();
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO challans (number, date, client_name, status, biller_id, data, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    String(num),
    ch.date || ch.challanDate || '',
    ch.client?.name || ch.clientName || '',
    ch.status || 'saved',
    ch.billerId || '',
    JSON.stringify(ch),
    ch.createdAt || new Date().toISOString(),
    new Date().toISOString()
  );
}

function upsertQuotation(qt) {
  const num = qt && (qt.number || qt.quotationNumber);
  if (!qt || !num) return;
  const db = getDb();
  const validUntil = qt.validUntil || qt.valid_until || '';
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO quotations (number, date, valid_until, client_name, total_amount, biller_id, data, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    String(num),
    qt.date || qt.quotationDate || '',
    validUntil,
    qt.to?.name || qt.to?.company || qt.client?.name || qt.clientName || '',
    Number(qt.grandTotal || qt.total || 0),
    qt.billerId || '',
    JSON.stringify(qt),
    qt.createdAt || new Date().toISOString(),
    new Date().toISOString()
  );
}

function upsertReceipt(rcpt) {
  const num = rcpt && (rcpt.number || rcpt.receiptNumber);
  if (!rcpt || !num) return;
  const db = getDb();
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO receipts (number, date, client_name, amount, biller_id, status, data, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    String(num),
    rcpt.date || rcpt.receiptDate || '',
    rcpt.client?.name || rcpt.receivedFrom || rcpt.clientName || '',
    Number(rcpt.amount || 0),
    rcpt.billerId || '',
    rcpt.status || 'saved',
    JSON.stringify(rcpt),
    rcpt.createdAt || new Date().toISOString(),
    new Date().toISOString()
  );
}

function upsertExpense(exp) {
  const id = exp && (exp.id || exp.voucherNo || exp.expenseNumber);
  if (!exp || !id) return;
  const db = getDb();
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO expenses (id, voucher_no, date, category, amount, description, paid_to, payment_method, data, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    String(id),
    exp.voucherNo || String(id),
    exp.date || '',
    exp.category || 'Other',
    Number(exp.amount || 0),
    exp.notes || exp.description || '',
    exp.payee || exp.paidTo || '',
    exp.paymentMethod || 'Cash',
    JSON.stringify(exp),
    exp.createdAt || new Date().toISOString(),
    new Date().toISOString()
  );
}

function upsertBiller(b) {
  if (!b || !b.id) return;
  const db = getDb();
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO billers (id, name, is_default, data, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    String(b.id),
    b.name || 'Unnamed Biller',
    b.isDefault ? 1 : 0,
    JSON.stringify(b),
    b.createdAt || new Date().toISOString(),
    new Date().toISOString()
  );
}

function upsertClient(c) {
  if (!c || !c.name) return;
  const db = getDb();
  const id = c.id || _slugKey('c', c.name);
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO clients (id, name, phone, data, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    String(id),
    c.name,
    c.phone || '',
    JSON.stringify(c),
    c.createdAt || new Date().toISOString(),
    new Date().toISOString()
  );
}

function upsertItem(item) {
  const desc = item && (item.name || item.desc || item.description);
  if (!item || !desc) return;
  const db = getDb();
  const id = item.id || _slugKey('it', desc);
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO catalog_items (id, description, unit_price, data, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    String(id),
    String(desc),
    Number(item.unitPrice || item.price || 0),
    JSON.stringify(item),
    item.createdAt || new Date().toISOString(),
    new Date().toISOString()
  );
}

function upsertExpenseCategory(cat) {
  if (!cat) return;
  const isStr = typeof cat === 'string';
  const name = String(isStr ? cat : (cat.name || cat.id || '')).trim();
  if (!name) return;
  const id = isStr ? _slugKey('cat', name) : (cat.id || _slugKey('cat', name));
  const db = getDb();
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO expense_categories (id, name, data, created_at)
    VALUES (?, ?, ?, ?)
  `);
  stmt.run(
    String(id),
    name,
    JSON.stringify(isStr ? name : cat),
    new Date().toISOString()
  );
}

function setKV(key, value) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO settings_kv (key, value, updated_at)
    VALUES (?, ?, ?)
  `);
  stmt.run(String(key), String(value), new Date().toISOString());
}

function getKV(key) {
  const db = getDb();
  const row = db.prepare("SELECT value FROM settings_kv WHERE key = ?").get(String(key));
  return row ? row.value : null;
}

// -------------------------------------------------------------
// Retrieval Operations
// -------------------------------------------------------------

const ALLOWED_TABLES = new Set([
  'invoices', 'challans', 'quotations', 'receipts', 'expenses',
  'billers', 'clients', 'catalog_items', 'expense_categories', 'settings_kv'
]);

function getAll(table) {
  if (!ALLOWED_TABLES.has(table)) {
    throw new Error(`Invalid table name: ${table}`);
  }
  const db = getDb();
  const rows = db.prepare(`SELECT data FROM ${table} ORDER BY created_at DESC`).all();
  return rows.map(r => {
    try {
      return JSON.parse(r.data);
    } catch (e) {
      return null;
    }
  }).filter(Boolean);
}

function getAllData() {
  const db = getDb();
  const parseRows = (table) => {
    return db.prepare(`SELECT data FROM ${table} ORDER BY created_at DESC`).all().map(r => {
      try { return JSON.parse(r.data); } catch (e) { return null; }
    }).filter(Boolean);
  };

  const kvRows = db.prepare("SELECT key, value FROM settings_kv").all();
  const settings = {};
  for (const r of kvRows) {
    settings[r.key] = r.value;
  }

  return {
    invoices: parseRows('invoices'),
    challans: parseRows('challans'),
    quotations: parseRows('quotations'),
    receipts: parseRows('receipts'),
    expenses: parseRows('expenses'),
    billers: parseRows('billers'),
    clients: parseRows('clients'),
    items: parseRows('catalog_items'),
    expenseCategories: parseRows('expense_categories'),
    settings
  };
}

// -------------------------------------------------------------
// Two-Way Sync Handler
// Receives client snapshot and syncs into SQLite transactionally
// Prunes records removed on the client so deletions stay synchronized
// -------------------------------------------------------------

function syncClientSnapshot(payload, options = {}) {
  const db = getDb();

  let counts = {
    invoices: 0,
    challans: 0,
    quotations: 0,
    receipts: 0,
    expenses: 0,
    billers: 0,
    clients: 0,
    items: 0,
    categories: 0
  };

  const totalIncoming =
    (Array.isArray(payload.invoices) ? payload.invoices.length : 0) +
    (Array.isArray(payload.challans) ? payload.challans.length : 0) +
    (Array.isArray(payload.quotations) ? payload.quotations.length : 0) +
    (Array.isArray(payload.receipts) ? payload.receipts.length : 0) +
    (Array.isArray(payload.expenses) ? payload.expenses.length : 0) +
    (Array.isArray(payload.clients) ? payload.clients.length : 0) +
    (Array.isArray(payload.items) ? payload.items.length : 0);
  const canPruneEmpty = totalIncoming > 0 || payload.forcePruneEmpty === true || (options && options.forcePruneEmpty === true);

  // Run in a single transaction for atomicity and high performance
  db.exec("BEGIN TRANSACTION;");
  try {
    if (Array.isArray(payload.invoices)) {
      const numbers = payload.invoices.map(i => i.number || i.invoiceNumber).filter(Boolean).map(String);
      if (numbers.length > 0) {
        const placeholders = numbers.map(() => '?').join(',');
        db.prepare(`DELETE FROM invoices WHERE number NOT IN (${placeholders})`).run(...numbers);
      } else if (canPruneEmpty) {
        db.exec("DELETE FROM invoices;");
      }
      for (const inv of payload.invoices) {
        upsertInvoice(inv);
        counts.invoices++;
      }
    }
    if (Array.isArray(payload.challans)) {
      const numbers = payload.challans.map(c => c.number || c.challanNumber).filter(Boolean).map(String);
      if (numbers.length > 0) {
        const placeholders = numbers.map(() => '?').join(',');
        db.prepare(`DELETE FROM challans WHERE number NOT IN (${placeholders})`).run(...numbers);
      } else if (canPruneEmpty) {
        db.exec("DELETE FROM challans;");
      }
      for (const ch of payload.challans) {
        upsertChallan(ch);
        counts.challans++;
      }
    }
    if (Array.isArray(payload.quotations)) {
      const numbers = payload.quotations.map(q => q.number || q.quotationNumber).filter(Boolean).map(String);
      if (numbers.length > 0) {
        const placeholders = numbers.map(() => '?').join(',');
        db.prepare(`DELETE FROM quotations WHERE number NOT IN (${placeholders})`).run(...numbers);
      } else if (canPruneEmpty) {
        db.exec("DELETE FROM quotations;");
      }
      for (const qt of payload.quotations) {
        upsertQuotation(qt);
        counts.quotations++;
      }
    }
    if (Array.isArray(payload.receipts)) {
      const numbers = payload.receipts.map(r => r.number || r.receiptNumber).filter(Boolean).map(String);
      if (numbers.length > 0) {
        const placeholders = numbers.map(() => '?').join(',');
        db.prepare(`DELETE FROM receipts WHERE number NOT IN (${placeholders})`).run(...numbers);
      } else if (canPruneEmpty) {
        db.exec("DELETE FROM receipts;");
      }
      for (const rcpt of payload.receipts) {
        upsertReceipt(rcpt);
        counts.receipts++;
      }
    }
    if (Array.isArray(payload.expenses)) {
      const ids = payload.expenses.map(e => e.id || e.voucherNo || e.expenseNumber).filter(Boolean).map(String);
      if (ids.length > 0) {
        const placeholders = ids.map(() => '?').join(',');
        db.prepare(`DELETE FROM expenses WHERE id NOT IN (${placeholders})`).run(...ids);
      } else if (canPruneEmpty) {
        db.exec("DELETE FROM expenses;");
      }
      for (const exp of payload.expenses) {
        upsertExpense(exp);
        counts.expenses++;
      }
    }
    if (Array.isArray(payload.billers)) {
      const ids = payload.billers.map(b => b && b.id).filter(Boolean).map(String);
      if (ids.length > 0) {
        if (canPruneEmpty || ids.length > 1) {
          const placeholders = ids.map(() => '?').join(',');
          db.prepare(`DELETE FROM billers WHERE id NOT IN (${placeholders})`).run(...ids);
        }
      } else if (canPruneEmpty) {
        db.exec("DELETE FROM billers;");
      }
      for (const b of payload.billers) {
        upsertBiller(b);
        counts.billers++;
      }
    }
    if (Array.isArray(payload.clients)) {
      const ids = payload.clients.map(c => c.id || _slugKey('c', c.name)).filter(Boolean).map(String);
      if (ids.length > 0) {
        const placeholders = ids.map(() => '?').join(',');
        db.prepare(`DELETE FROM clients WHERE id NOT IN (${placeholders})`).run(...ids);
      } else if (canPruneEmpty) {
        db.exec("DELETE FROM clients;");
      }
      for (const c of payload.clients) {
        upsertClient(c);
        counts.clients++;
      }
    }
    if (Array.isArray(payload.items)) {
      const ids = payload.items.map(it => {
        const label = it.name || it.desc || it.description || '';
        return it.id || _slugKey('it', label);
      }).filter(Boolean).map(String);
      if (ids.length > 0) {
        const placeholders = ids.map(() => '?').join(',');
        db.prepare(`DELETE FROM catalog_items WHERE id NOT IN (${placeholders})`).run(...ids);
      } else if (canPruneEmpty) {
        db.exec("DELETE FROM catalog_items;");
      }
      for (const it of payload.items) {
        upsertItem(it);
        counts.items++;
      }
    }
    if (Array.isArray(payload.expenseCategories)) {
      const ids = payload.expenseCategories.map(cat => {
        if (!cat) return '';
        const isStr = typeof cat === 'string';
        const name = String(isStr ? cat : (cat.name || cat.id || '')).trim();
        return name ? (isStr ? _slugKey('cat', name) : (cat.id || _slugKey('cat', name))) : '';
      }).filter(Boolean).map(String);
      if (ids.length > 0) {
        if (canPruneEmpty) {
          const placeholders = ids.map(() => '?').join(',');
          db.prepare(`DELETE FROM expense_categories WHERE id NOT IN (${placeholders})`).run(...ids);
        }
      } else if (canPruneEmpty) {
        db.exec("DELETE FROM expense_categories;");
      }
      for (const cat of payload.expenseCategories) {
        upsertExpenseCategory(cat);
        counts.categories++;
      }
    }
    if (payload.settings && typeof payload.settings === 'object') {
      for (const [k, v] of Object.entries(payload.settings)) {
        if (v !== undefined && v !== null) {
          setKV(k, typeof v === 'object' ? JSON.stringify(v) : String(v));
        }
      }
    }

    db.exec("COMMIT;");
  } catch (err) {
    db.exec("ROLLBACK;");
    throw err;
  }

  checkpointWal('PASSIVE');

  return {
    success: true,
    syncedCounts: counts,
    dbStatus: getStatus()
  };
}

function checkpointWal(mode = 'PASSIVE') {
  if (!dbInstance) return false;
  const safeMode = ['PASSIVE', 'FULL', 'RESTART', 'TRUNCATE'].includes(String(mode).toUpperCase())
    ? String(mode).toUpperCase()
    : 'PASSIVE';
  try {
    dbInstance.exec(`PRAGMA wal_checkpoint(${safeMode});`);
    return true;
  } catch (_) {
    return false;
  }
}

// -------------------------------------------------------------
// Deletion by Primary Key
// -------------------------------------------------------------

function replaceBillers(billers = []) {
  const db = getDb();
  db.exec('BEGIN TRANSACTION;');
  try {
    const ids = billers.map(b => b && b.id).filter(Boolean).map(String);
    if (ids.length > 0) {
      const placeholders = ids.map(() => '?').join(',');
      db.prepare(`DELETE FROM billers WHERE id NOT IN (${placeholders})`).run(...ids);
    } else {
      db.exec('DELETE FROM billers;');
    }
    for (const b of billers) {
      upsertBiller(b);
    }
    db.exec('COMMIT;');
  } catch (err) {
    db.exec('ROLLBACK;');
    throw err;
  }
}

function clearAllTables(defaultBillers = []) {
  const db = getDb();
  db.exec('BEGIN TRANSACTION;');
  try {
    db.exec(`
      DELETE FROM invoices;
      DELETE FROM challans;
      DELETE FROM quotations;
      DELETE FROM receipts;
      DELETE FROM expenses;
      DELETE FROM billers;
      DELETE FROM clients;
      DELETE FROM catalog_items;
      DELETE FROM expense_categories;
      DELETE FROM settings_kv;
    `);
    for (const b of defaultBillers) {
      upsertBiller(b);
    }
    db.exec('COMMIT;');
  } catch (err) {
    db.exec('ROLLBACK;');
    throw err;
  }
}

function deleteRecord(table, primaryKey) {
  if (!ALLOWED_TABLES.has(table)) {
    throw new Error(`Invalid table name: ${table}`);
  }
  const db = getDb();
  const pkCol = (table === 'expenses' || table === 'billers' || table === 'clients' || table === 'catalog_items' || table === 'expense_categories') ? 'id' : 'number';
  const stmt = db.prepare(`DELETE FROM ${table} WHERE ${pkCol} = ?`);
  const result = stmt.run(String(primaryKey));
  return result.changes > 0;
}

module.exports = {
  isAvailable,
  getStatus,
  getDb,
  closeDb,
  upsertInvoice,
  upsertChallan,
  upsertQuotation,
  upsertReceipt,
  upsertExpense,
  upsertBiller,
  replaceBillers,
  upsertClient,
  upsertItem,
  upsertExpenseCategory,
  setKV,
  getKV,
  getAll,
  getAllData,
  syncClientSnapshot,
  clearAllTables,
  deleteRecord,
  checkpointWal,
  _slugKey
};
