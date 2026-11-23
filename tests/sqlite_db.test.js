// Unit Test for AutoInvoice SQLite Database Layer (Hermetic temp DB)
const assert = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn } = require('child_process');

const tmpDbPath = path.join(os.tmpdir(), `autoinvoice-sqlite-test-${process.pid}-${Date.now()}.db`);
process.env.AUTOINVOICE_DB_PATH = tmpDbPath;

const db = require('../db.js');

function cleanupDbFiles(p) {
  [p, p + '-wal', p + '-shm'].forEach(f => {
    try { if (fs.existsSync(f)) fs.unlinkSync(f); } catch (_) { }
  });
}

console.log("▶ Testing SQLite Database Layer (node:sqlite)...");

// 1. Availability and Status Check
assert.strictEqual(db.isAvailable(), true, "db.isAvailable() should be true in Node >= 22.5.0");
const initialStatus = db.getStatus();
assert.strictEqual(initialStatus.available, true);
assert.strictEqual(initialStatus.engine, 'node:sqlite (built-in)');
console.log("  ✓ Availability and Status verified");

// 2. Invoice Upsert & Retrieval
const testInvoice = {
  number: "INV-TEST-001",
  date: "2026-10-25",
  client: { name: "Test Corp BD" },
  grandTotal: 15500,
  status: "saved",
  billerId: "biller_default",
  items: [
    { description: "Industrial Sensor Unit", qty: 2, rate: 7750, amount: 15500 }
  ]
};

db.upsertInvoice(testInvoice);
const invoices = db.getAll('invoices');
const foundInv = invoices.find(i => i.number === "INV-TEST-001");
assert.ok(foundInv, "Invoice should be found in SQLite");
assert.strictEqual(foundInv.grandTotal, 15500);
assert.strictEqual(foundInv.client.name, "Test Corp BD");
console.log("  ✓ Invoice upsert and retrieval verified");

// 2b. Quotation Upsert & Valid Until Column Index Verification
const testQuotation = {
  quotationNumber: "QTN-VAL-TEST",
  date: "2026-11-17",
  validityDays: 15,
  validUntil: "2026-12-02",
  to: { name: "Apex Embedded Systems" },
  grandTotal: 45000,
  billerId: "biller_default"
};
db.upsertQuotation(testQuotation);
const rawQ = db.getDb().prepare("SELECT number, date, valid_until, client_name FROM quotations WHERE number = 'QTN-VAL-TEST'").get();
assert.ok(rawQ, "Quotation should be found in SQLite table");
assert.strictEqual(rawQ.valid_until, "2026-12-02", "valid_until column should match in SQLite table");
assert.strictEqual(rawQ.client_name, "Apex Embedded Systems", "client_name should match");
console.log("  ✓ Quotation upsert, valid_until column, and indexing verified");

// 3. Expense Upsert & Retrieval
const testExpense = {
  id: "exp_test_001",
  voucherNo: "EXP-2026-0001",
  date: "2026-10-25",
  category: "Utilities & Bills",
  amount: 4500,
  description: "High-speed broadband monthly bill",
  paidTo: "Link3 Technologies",
  paymentMethod: "bKash"
};

db.upsertExpense(testExpense);
const expenses = db.getAll('expenses');
const foundExp = expenses.find(e => e.id === "exp_test_001");
assert.ok(foundExp, "Expense should be found in SQLite");
assert.strictEqual(foundExp.amount, 4500);
assert.strictEqual(foundExp.voucherNo, "EXP-2026-0001");
console.log("  ✓ Expense upsert and retrieval verified");

// 4. KV Settings
db.setKV("ai_test_setting", "active_v2");
assert.strictEqual(db.getKV("ai_test_setting"), "active_v2");
console.log("  ✓ Settings KV store verified");

// 5. Batch Snapshot Sync (Transaction)
const syncPayload = {
  invoices: [
    { number: "INV-SYNC-101", date: "2026-10-25", client: { name: "Dhaka Fabrics" }, grandTotal: 25000 },
    { number: "INV-SYNC-102", date: "2026-10-25", client: { name: "Chittagong Steel" }, grandTotal: 50000 }
  ],
  expenses: [
    { id: "exp_sync_101", voucherNo: "EXP-2026-0002", date: "2026-10-25", category: "Office Rent", amount: 30000 }
  ],
  settings: {
    "ai_last_invoice_number": 102,
    "ai_last_expense_number": 2
  }
};

const syncRes = db.syncClientSnapshot(syncPayload);
assert.strictEqual(syncRes.success, true);
assert.strictEqual(syncRes.syncedCounts.invoices, 2);
assert.strictEqual(syncRes.syncedCounts.expenses, 1);
assert.strictEqual(db.getKV("ai_last_invoice_number"), "102");
// Verify that snapshot sync pruned older unreferenced records
const syncedInvoices = db.getAll('invoices');
assert.strictEqual(syncedInvoices.some(i => i.number === 'INV-TEST-001'), false, "Older record was correctly pruned during sync");
console.log("  ✓ Batch transactional snapshot sync & pruning verified");

// 6. Client Schema Compatibility (Items, String Categories, Quotations, Receipts) & Empty-Snapshot Wipe Guard
const schemaSyncRes = db.syncClientSnapshot({
  quotations: [
    { quotationNumber: "QTN-2026-0001", date: "2026-10-25", to: { name: "Bashundhara Group" }, grandTotal: 120000 }
  ],
  receipts: [
    { receiptNumber: "RCPT-2026-0001", date: "2026-10-25", client: { name: "Dhaka Fabrics" }, amount: 15000 }
  ],
  items: [
    { id: "item_cat_01", name: "Cat6 Patch Cord", desc: "3m Factory Molded", unit: "Pcs", unitPrice: 350 }
  ],
  expenseCategories: [
    "Hardware & Components",
    { id: "cat_custom_1", name: "Cloud Hosting" }
  ]
});
assert.strictEqual(schemaSyncRes.syncedCounts.quotations, 1);
assert.strictEqual(schemaSyncRes.syncedCounts.receipts, 1);
assert.strictEqual(schemaSyncRes.syncedCounts.items, 1, "Client item with .name/.desc/.unitPrice should sync");
assert.strictEqual(schemaSyncRes.syncedCounts.categories, 2, "String and object expense categories should sync");

// Empty-snapshot wipe guard: syncing empty arrays without forcePruneEmpty must NOT wipe existing records
db.syncClientSnapshot({
  invoices: [],
  quotations: [],
  receipts: [],
  items: []
});
assert.strictEqual(db.getAll('invoices').length, 2, "Empty snapshot without forcePruneEmpty must preserve existing invoices");
assert.strictEqual(db.getAll('quotations').length, 1, "Empty snapshot without forcePruneEmpty must preserve existing quotations");
assert.strictEqual(db.getAll('catalog_items').length, 1, "Empty snapshot without forcePruneEmpty must preserve existing items");

// With forcePruneEmpty: true, empty arrays intentionally prune tables
db.syncClientSnapshot({ quotations: [], receipts: [], items: [], expenseCategories: [] }, { forcePruneEmpty: true });
assert.strictEqual(db.getAll('quotations').length, 0, "forcePruneEmpty: true prunes cleared tables");
console.log("  ✓ Client schema compatibility & empty-snapshot wipe guard verified");

// 7. Explicit Deletion
const deletedInv = db.deleteRecord('invoices', 'INV-SYNC-101');
assert.strictEqual(deletedInv, true, "Should return true on successful delete");
const postDeleteInvoices = db.getAll('invoices');
assert.strictEqual(postDeleteInvoices.some(i => i.number === 'INV-SYNC-101'), false);

const deletedExp = db.deleteRecord('expenses', 'exp_sync_101');
assert.strictEqual(deletedExp, true);
console.log("  ✓ Explicit record deletion verified");

// Cleanup test sync records
db.deleteRecord('invoices', 'INV-SYNC-102');

// 8. Bangla / Unicode PK collision prevention
db.upsertClient({ name: 'রহিম', phone: '01711111111' });
db.upsertClient({ name: 'করিম', phone: '01822222222' });
const allClients = db.getAll('clients');
assert.ok(allClients.some(c => c.name === 'রহিম'), 'Bangla client 1 preserved');
assert.ok(allClients.some(c => c.name === 'করিম'), 'Bangla client 2 preserved without PK collision');

db.upsertItem({ name: 'সেবা', unitPrice: 100 });
db.upsertItem({ name: 'পণ্য', unitPrice: 200 });
const allItems = db.getAll('catalog_items');
assert.ok(allItems.some(i => i.name === 'সেবা'), 'Bangla item 1 preserved');
assert.ok(allItems.some(i => i.name === 'পণ্য'), 'Bangla item 2 preserved without PK collision');

// ASCII punctuation PK collision prevention ("A & B" vs "A - B")
assert.notStrictEqual(db._slugKey('c', 'Alpha & Co.'), db._slugKey('c', 'Alpha - Co.'), 'ASCII punctuation keys must not collide');
db.upsertClient({ name: 'Alpha & Co.', phone: '01700000001' });
db.upsertClient({ name: 'Alpha - Co.', phone: '01700000002' });
const punctClients = db.getAll('clients');
assert.ok(punctClients.some(c => c.name === 'Alpha & Co.'), 'Alpha & Co. preserved');
assert.ok(punctClients.some(c => c.name === 'Alpha - Co.'), 'Alpha - Co. preserved without PK collision');

// Boot-race biller prune guard: incoming [biller_default] with 0 docs must NOT wipe secondary billers
db.replaceBillers([
  { id: 'biller_default', name: 'Default Biller', isDefault: true },
  { id: 'biller_sec', name: 'Secondary Biller', isDefault: false }
]);
db.syncClientSnapshot({ billers: [{ id: 'biller_default', name: 'Default Biller', isDefault: true }] });
assert.strictEqual(db.getAll('billers').length, 2, 'Empty-doc sync with only biller_default must preserve secondary billers');
console.log("  ✓ Unicode / ASCII punctuation PK collision & boot biller prune guards verified");

// 8b. Biller Digital Signature Persistence
db.upsertBiller({
  id: "biller_sig_test",
  name: "Apex Embedded Systems (Signed)",
  signatureDataUri: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  signatoryName: "Amirul Islam",
  signatoryTitle: "Chief Executive Officer"
});
const billerDump = db.getAll('billers');
const foundSignedBiller = billerDump.find(b => b.id === "biller_sig_test");
assert.ok(foundSignedBiller, "Biller with digital signature found in SQLite");
assert.strictEqual(foundSignedBiller.signatoryName, "Amirul Islam");
assert.strictEqual(foundSignedBiller.signatoryTitle, "Chief Executive Officer");
assert.ok(foundSignedBiller.signatureDataUri.startsWith("data:image/png;base64,"), "Signature data URI persisted in SQLite");
console.log("  ✓ Biller digital signature SQLite persistence verified");

// 9. replaceBillers pruning & clearAllTables
db.replaceBillers([{ id: 'b1', name: 'Biller 1' }, { id: 'b2', name: 'Biller 2' }]);
assert.strictEqual(db.getAll('billers').length, 2);
db.replaceBillers([{ id: 'b1', name: 'Biller 1' }]);
assert.strictEqual(db.getAll('billers').length, 1, 'Deleted biller pruned cleanly by replaceBillers');
db.clearAllTables([{ id: 'biller_default', name: 'Default', isDefault: true }]);
assert.strictEqual(db.getAll('clients').length, 0, 'clearAllTables clears clients');
assert.strictEqual(db.getAll('billers').length, 1, 'clearAllTables resets billers to default');
console.log("  ✓ replaceBillers pruning & clearAllTables verified");

const finalStatus = db.getStatus();
console.log("  ✓ Final DB Status:", finalStatus.counts);

// 10. HTTP Server Hardening, UTF-8 Sync & PDF Endpoint Verification
(async function runHttpTests() {
  const testPort = 18940 + Math.floor(Math.random() * 500);
  const srvDbPath = path.join(os.tmpdir(), `autoinvoice-http-test-${process.pid}-${Date.now()}.db`);
  const child = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], {
    env: Object.assign({}, process.env, { PORT: String(testPort), HOST: '127.0.0.1', AUTOINVOICE_DB_PATH: srvDbPath }),
    stdio: ['ignore', 'pipe', 'pipe']
  });

  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Server startup timeout')), 8000);
      let out = '';
      child.stdout.on('data', chunk => {
        out += chunk.toString();
        if (out.includes('AutoInvoice server is running')) {
          clearTimeout(timer);
          resolve();
        }
      });
      child.stderr.on('data', chunk => {
        out += chunk.toString();
      });
      child.on('exit', code => {
        clearTimeout(timer);
        reject(new Error(`Server exited early (${code}): ${out}`));
      });
    });

    const base = `http://127.0.0.1:${testPort}`;

    // Untrusted external Origin & cross-port localhost blocked with 403
    const evilRes = await fetch(`${base}/api/db/status`, { headers: { Origin: 'https://evil.example' } });
    assert.strictEqual(evilRes.status, 403, 'External Origin must receive 403 Forbidden');
    const crossPortRes = await fetch(`${base}/api/db/status`, { headers: { Origin: `http://127.0.0.1:${testPort + 1}` } });
    assert.strictEqual(crossPortRes.status, 403, 'Different localhost port Origin must receive 403 Forbidden');

    // Unsupported methods on /api/db/* return 405 Method Not Allowed
    const statusPostRes = await fetch(`${base}/api/db/status`, { method: 'POST' });
    assert.strictEqual(statusPostRes.status, 405, 'POST /api/db/status returns 405');

    // Sensitive files & Windows NTFS ADS blocked
    const dbJsRes = await fetch(`${base}/db.js`);
    assert.strictEqual(dbJsRes.status, 403, '/db.js static access blocked');
    const srvJsRes = await fetch(`${base}/server.js`);
    assert.strictEqual(srvJsRes.status, 403, '/server.js static access blocked');
    const adsRes = await fetch(`${base}/server.js::$DATA`);
    assert.strictEqual(adsRes.status, 403, 'Windows NTFS ADS ::$DATA blocked');

    // Null JSON body & missing primary key validation
    const nullInvRes = await fetch(`${base}/api/invoices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'null'
    });
    assert.strictEqual(nullInvRes.status, 400, 'POST /api/invoices with null JSON returns 400');
    const missingKeyInvRes = await fetch(`${base}/api/invoices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client: { name: 'No Number' } })
    });
    assert.strictEqual(missingKeyInvRes.status, 400, 'POST /api/invoices missing invoiceNumber returns 400');
    const canonInvRes = await fetch(`${base}/api/invoices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        invoiceNumber: 'INV-PEND-API-1',
        status: 'Pending',
        amountPending: true,
        paymentMethod: '',
        client: { name: 'Pending API Client' },
        items: [{ name: 'PLC Controller', desc: '', qty: 0, unit: 'Pcs', unitPrice: 0 }],
        grandTotal: 0
      })
    });
    assert.strictEqual(canonInvRes.status, 200);
    const canonInvJson = await canonInvRes.json();
    assert.strictEqual(canonInvJson.number, 'INV-PEND-API-1', 'POST /api/invoices returns canonical invoiceNumber');

    // Unconfirmed /api/clear blocked
    const unconfClear = await fetch(`${base}/api/clear`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}'
    });
    assert.strictEqual(unconfClear.status, 403, 'Unconfirmed /api/clear blocked without X-AutoInvoice-Action: confirm');

    // Multi-byte UTF-8 Bangla sync roundtrip
    const utf8Sync = await fetch(`${base}/api/db/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        invoices: [{ invoiceNumber: 'INV-BN-01', date: '2026-11-17', client: { name: 'ঢাকা ইঞ্জিনিয়ারিং লিঃ' }, grandTotal: 12345.67 }]
      })
    });
    assert.strictEqual(utf8Sync.status, 200);
    const dump = await (await fetch(`${base}/api/db/all`)).json();
    assert.strictEqual(dump.invoices[0].client.name, 'ঢাকা ইঞ্জিনিয়ারিং লিঃ', 'UTF-8 Bangla payload preserved cleanly');

    // Headless PDF status, negative validation & real PDF generation check
    const pdfBadType = await fetch(`${base}/api/pdf`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: '{}'
    });
    assert.strictEqual(pdfBadType.status, 415, 'POST /api/pdf requires application/json');
    const pdfEmpty = await fetch(`${base}/api/pdf`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ html: '' })
    });
    assert.strictEqual(pdfEmpty.status, 400, 'POST /api/pdf rejects empty html with 400');
    const pdfStatus = await (await fetch(`${base}/api/pdf/status`)).json();
    assert.strictEqual(typeof pdfStatus.available, 'boolean');
    if (pdfStatus.available) {
      const pdfRes = await fetch(`${base}/api/pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: 'Smoke_Test_Inv',
          html: '<!doctype html><!-- <head> --><html><head></head><body onload="window.__xss=1"><img src=x/onerror=window.__xss3=1><script>window.__xss2=1</script><h1>AutoInvoice PDF Test ৳1,000.00</h1></body></html>'
        })
      });
      assert.strictEqual(pdfRes.status, 200, 'POST /api/pdf succeeds when headless browser available');
      assert.ok(String(pdfRes.headers.get('content-type') || '').includes('application/pdf'), 'Content-Type is application/pdf');
      const buf = Buffer.from(await pdfRes.arrayBuffer());
      assert.ok(buf.slice(0, 5).toString('ascii') === '%PDF-', 'Response bytes start with %PDF- signature');
      console.log(`  ✓ Headless Tier-2 PDF endpoint verified (${pdfStatus.browser}, ${buf.length} bytes)`);
    } else {
      console.log("  ℹ Headless browser not installed; /api/pdf/status returned available: false");
    }

    // Pending invoice + Pending receipt with optional items roundtrip & receipts.status column
    const pendSync = await fetch(`${base}/api/db/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        invoices: [
          { invoiceNumber: 'INV-BN-01', date: '2026-11-17', client: { name: 'ঢাকা ইঞ্জিনিয়ারিং লিঃ' }, grandTotal: 12345.67 },
          { invoiceNumber: 'INV-PEND-SYNC-1', status: 'Pending', amountPending: true, paymentMethod: '', client: { name: '' }, items: [{ name: 'Sensor Unit' }], grandTotal: 0 }
        ],
        receipts: [
          { receiptNumber: 'RCPT-PEND-SYNC-1', status: 'Pending', amountPending: true, paymentMethod: '', client: { name: 'Pending Client' }, items: [{ name: 'Cable Assembly', desc: '5m' }], amount: 0 }
        ]
      })
    });
    assert.strictEqual(pendSync.status, 200);
    const dump2 = await (await fetch(`${base}/api/db/all`)).json();
    const syncedPendRc = dump2.receipts.find(r => r.receiptNumber === 'RCPT-PEND-SYNC-1');
    assert.ok(syncedPendRc && syncedPendRc.status === 'Pending' && syncedPendRc.amountPending === true && syncedPendRc.items[0].name === 'Cable Assembly', 'Pending receipt with items round-trips cleanly');

    // Verify GET endpoints return 200 JSON cleanly
    for (const ep of ['/api/invoices', '/api/expenses', '/api/billers']) {
      const r = await fetch(`${base}${ep}`);
      assert.strictEqual(r.status, 200, `GET ${ep} returns 200`);
      const parsed = await r.json();
      assert.ok(Array.isArray(parsed), `GET ${ep} returns JSON array`);
    }

    console.log("  ✓ HTTP API security, UTF-8 sync, & PDF checks verified");
  } finally {
    db.closeDb();
    try {
      await new Promise(resolve => {
        if (child.exitCode !== null) return resolve();
        const t = setTimeout(resolve, 1500);
        child.once('exit', () => { clearTimeout(t); resolve(); });
        child.kill();
      });
    } catch (_) { }
    cleanupDbFiles(tmpDbPath);
    cleanupDbFiles(srvDbPath);
  }
  console.log("🎉 ALL SQLITE & SERVER TESTS PASSED!");
})().catch(err => {
  console.error(err);
  cleanupDbFiles(tmpDbPath);
  process.exit(1);
});
