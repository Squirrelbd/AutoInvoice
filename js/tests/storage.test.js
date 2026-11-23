// Unit tests for storage.js

test('peekNext and finalize sequence pattern does not gap on peek', () => {
  const win = document.getElementById('receiptFrame').contentWindow;
  const p1 = win.peekNextInvoiceNumber();
  const p2 = win.peekNextInvoiceNumber();
  const t1 = ok(p1 === p2, 'Repeated peek returns same number without advancing sequence');

  win.finalizeInvoiceNumber(p1);
  const p3 = win.peekNextInvoiceNumber();
  const t2 = ok(p3 !== p1, 'After finalize, next peek returns next incremented sequence number');
  return [t1, t2];
});

test('finalize does not rewind sequence when saving older document', () => {
  const win = document.getElementById('receiptFrame').contentWindow;
  const year = new Date().getFullYear();
  win.finalizeInvoiceNumber(`INV-${year}-0010`);
  const peekAfter10 = win.peekNextInvoiceNumber();
  const t1 = ok(peekAfter10 === `INV-${year}-0011`, 'Sequence advanced to 11');

  // Saving an older document with sequence 0002 should NOT rewind sequence counter
  win.finalizeInvoiceNumber(`INV-${year}-0002`);
  const peekAfterOld = win.peekNextInvoiceNumber();
  const t2 = ok(peekAfterOld === `INV-${year}-0011`, 'Sequence counter was not rewound by saving older number');
  return [t1, t2];
});

test('sanitizeRecord trims strings, bounds length, and sanitizes objects', () => {
  const win = document.getElementById('receiptFrame').contentWindow;
  const hugeString = 'A'.repeat(20000);
  const input = {
    client: { name: '  ACME Corp  ', memo: hugeString },
    amount: 1500,
    items: [{ name: '  Widget  ', qty: 5 }]
  };
  const sanitized = win.sanitizeRecord(input);
  const t1 = ok(sanitized.client.name === 'ACME Corp', 'String trimmed');
  const t2 = ok(sanitized.client.memo.length === 10000, 'String capped at 10,000 characters');
  const t3 = ok(sanitized.items[0].name === 'Widget', 'Nested array item trimmed');
  return [t1, t2, t3];
});

test('getStorageUsage estimates storage size', () => {
  const win = document.getElementById('receiptFrame').contentWindow;
  const usage = win.getStorageUsage();
  return ok(typeof usage === 'number' && usage >= 0, `Usage returns numeric byte count (${usage} bytes)`);
});

test('saveClient and deleteClient manage client address book', () => {
  const win = document.getElementById('receiptFrame').contentWindow;
  win.saveClient({ name: 'Alpha Traders', company: 'Alpha Group', title: 'Director', address: 'Motijheel' });
  let clients = win.loadClients();
  const found = clients.some(c => c.name === 'Alpha Traders');
  const t1 = ok(found, 'Client successfully added to address book');

  const deleted = win.deleteClient('Alpha Traders');
  const t2 = ok(deleted === true, 'deleteClient returned true on successful removal');
  clients = win.loadClients();
  const notFound = !clients.some(c => c.name === 'Alpha Traders');
  const t3 = ok(notFound, 'Client was successfully removed from address book');
  return [t1, t2, t3];
});

test('getInvoicePaymentStats calculates payment status accurately', () => {
  const win = document.getElementById('receiptFrame').contentWindow;
  const mockInv = {
    invoiceNumber: 'INV-TEST-001',
    grandTotal: 10000,
    dueDate: '2020-01-01'
  };
  const stats = win.getInvoicePaymentStats(mockInv);
  const t1 = ok(stats.total === 10000, 'Total is 10000');
  const t2 = ok(stats.paid === 0, 'Paid is 0');
  const t3 = ok(stats.due === 10000, 'Due is 10000');
  const t4 = ok(stats.status === 'Unpaid', 'Status is Unpaid');
  const t5 = ok(stats.isOverdue === true, 'Overdue is true due to past due date');
  return [t1, t2, t3, t4, t5];
});

test('importAllData and getDashboardKPIs calculate aggregate metrics', () => {
  const win = document.getElementById('receiptFrame').contentWindow;
  const backup = {
    invoices: [
      { invoiceNumber: 'INV-KPI-1', grandTotal: 5000, client: { name: 'Client 1' } },
      { invoiceNumber: 'INV-KPI-2', grandTotal: 3000, client: { name: 'Client 2' } }
    ],
    challans: [{ challanNumber: 'CH-KPI-1', client: { name: 'Client 1' } }],
    quotations: [{ quotationNumber: 'QTN-KPI-1' }],
    receipts: [
      { receiptNumber: 'RCPT-KPI-1', invoiceNumber: 'INV-KPI-1', amount: 5000 }
    ],
    clients: [{ name: 'Client 1' }, { name: 'Client 2' }]
  };
  const counts = win.importAllData(backup);
  const t1 = ok(counts.invoices === 2, '2 invoices imported');
  const t2 = ok(counts.receipts === 1, '1 receipt imported');

  const kpis = win.getDashboardKPIs();
  const t3 = ok(kpis.totalInvoiced === 8000, `Total invoiced is 8000 (actual: ${kpis.totalInvoiced})`);
  const t4 = ok(kpis.totalCollected === 5000, `Total collected is 5000 (actual: ${kpis.totalCollected})`);
  const t5 = ok(kpis.totalDue === 3000, `Total due is 3000 (actual: ${kpis.totalDue})`);
  return [t1, t2, t3, t4, t5];
});

test('finalize does not corrupt active sequence counter when saving prior year document', () => {
  const win = document.getElementById('receiptFrame').contentWindow;
  const currentYear = new Date().getFullYear();
  const priorYear = currentYear - 1;

  win.finalizeInvoiceNumber(`INV-${currentYear}-0005`);
  const peekCurrent = win.peekNextInvoiceNumber();
  const t1 = ok(peekCurrent === `INV-${currentYear}-0006`, 'Current year sequence advanced to 6');

  // Saving a prior year invoice (e.g. INV-2025-0099) must not overwrite or corrupt current year sequence
  win.finalizeInvoiceNumber(`INV-${priorYear}-0099`);
  const peekAfterPriorYear = win.peekNextInvoiceNumber();
  const t2 = ok(peekAfterPriorYear === `INV-${currentYear}-0006`, 'Current year sequence remains intact after finalizing prior year document');
  return [t1, t2];
});

test('saveClient persists phone and email and allows updating', () => {
  const win = document.getElementById('receiptFrame').contentWindow;
  win.saveClient({
    name: 'Beta Tech',
    company: 'Beta Ltd',
    title: 'CTO',
    phone: '+8801700000000',
    email: 'contact@betatech.bd',
    address: 'Dhanmondi, Dhaka'
  });
  const clients = win.loadClients();
  const found = clients.find(c => c.name === 'Beta Tech');
  const t1 = ok(!!found, 'Client Beta Tech saved');
  const t2 = ok(found && found.phone === '+8801700000000', 'Phone stored correctly');
  const t3 = ok(found && found.email === 'contact@betatech.bd', 'Email stored correctly');
  win.deleteClient('Beta Tech');
  return [t1, t2, t3];
});

test('item catalog loadItems, saveItem, deleteItem, getItemByName CRUD operations', () => {
  const win = document.getElementById('receiptFrame').contentWindow;
  const saved = win.saveItem({
    name: 'Laser Barcode Scanner',
    desc: 'High speed USB barcode reader',
    unit: 'Pcs',
    unitPrice: 3500.50
  });
  const t1 = ok(!!saved && !!saved.id, 'saveItem returns created item with unique ID');
  const items = win.loadItems();
  const inList = items.find(i => i.name === 'Laser Barcode Scanner');
  const t2 = ok(!!inList && inList.unitPrice === 3500.50 && inList.unit === 'Pcs', 'loadItems contains saved item with rate and unit');
  
  const fetched = win.getItemByName('laser barcode scanner');
  const t3 = ok(!!fetched && fetched.name === 'Laser Barcode Scanner', 'getItemByName performs case-insensitive lookup');

  const deleted = win.deleteItem(saved.id);
  const t4 = ok(deleted === true, 'deleteItem returns true on removal');
  const notFound = !win.loadItems().some(i => i.name === 'Laser Barcode Scanner');
  const t5 = ok(notFound, 'Item successfully removed from database');
  return [t1, t2, t3, t4, t5];
});

test('exportAllData and importAllData preserve item catalog and client contact info', () => {
  const win = document.getElementById('receiptFrame').contentWindow;
  const backup = {
    invoices: [],
    challans: [],
    quotations: [],
    receipts: [],
    clients: [{ name: 'Test Client', phone: '01711111111', email: 'test@client.com' }],
    items: [{ id: 'test_item_1', name: 'Custom Cable', desc: 'Cat6 3m', unit: 'Pcs', unitPrice: 250 }]
  };
  const counts = win.importAllData(backup);
  const t1 = ok(counts.clients === 1, '1 client imported');
  const t2 = ok(counts.items === 1, '1 item imported');
  const item = win.getItemByName('Custom Cable');
  const t3 = ok(!!item && item.unitPrice === 250, 'Imported item accessible via getItemByName');
  win.deleteItem('Custom Cable');
  win.deleteClient('Test Client');
  return [t1, t2, t3];
});

test('clearAllData wipes all documents, items, and clients while restoring default biller', () => {
  const win = document.getElementById('receiptFrame').contentWindow;
  win.saveClient({ name: 'Temp Client' });
  win.saveItem({ name: 'Temp Item' });
  const cleared = win.clearAllData();
  const t1 = ok(cleared === true, 'clearAllData returned true');
  const t2 = ok(win.loadClients().length === 0, 'Clients array cleared');
  const t3 = ok(win.loadItems().length === 0, 'Items array cleared');
  const t4 = ok(win.loadInvoices().length === 0, 'Invoices array cleared');
  const billers = win.loadBillers();
  const t5 = ok(billers.length === 1 && billers[0].id === 'biller_default', 'Restores single clean default biller');
  return [t1, t2, t3, t4, t5];
});

test('toggleVoidRecord, deleteRecordByType, and Void status exclusion from KPIs', () => {
  const win = document.getElementById('receiptFrame').contentWindow;
  win.importAllData({
    invoices: [
      { invoiceNumber: 'INV-VOID-1', grandTotal: 10000, client: { name: 'Void Client' } },
      { invoiceNumber: 'INV-ACTIVE-2', grandTotal: 4000, client: { name: 'Active Client' } }
    ],
    receipts: []
  });

  const voided = win.toggleVoidRecord('invoice', 'INV-VOID-1');
  const t1 = ok(voided && voided.status === 'Void', 'toggleVoidRecord marks invoice as Void');

  const voidStats = win.getInvoicePaymentStats(voided);
  const t2 = ok(voidStats.status === 'Void' && voidStats.due === 0 && voidStats.total === 0, 'Void invoice has 0 total/due in payment stats');

  const kpis = win.getDashboardKPIs();
  const t3 = ok(kpis.totalInvoiced === 4000 && kpis.totalDue === 4000, `Void invoice excluded from KPIs (invoiced: ${kpis.totalInvoiced})`);

  const restored = win.toggleVoidRecord('invoice', 'INV-VOID-1');
  const t4 = ok(restored && restored.status === 'Saved', 'toggleVoidRecord restores Void invoice to Saved');

  const deleted = win.deleteRecordByType('invoice', 'INV-VOID-1');
  const t5 = ok(deleted === true && !win.getInvoiceByNumber('INV-VOID-1'), 'deleteRecordByType removes invoice');
  return [t1, t2, t3, t4, t5];
});

test('exportAllData and importAllData preserve monotonic sequence counters', () => {
  const win = document.getElementById('receiptFrame').contentWindow;
  const year = new Date().getFullYear();
  const customBiller = win.saveBiller({
    name: 'Seq Corp',
    prefixes: { invoice: 'SEQ', challan: 'SCH', receipt: 'SRCP', quotation: 'SQTN', expense: 'SEXP' }
  });
  win.setActiveBillerId(customBiller.id);
  win.finalizeInvoiceNumber(`SEQ-${year}-0042`);
  const exported = win.exportAllData();
  const t1 = ok(exported.sequences && Object.keys(exported.sequences).some(k => k.startsWith('ai_seq_')), 'exportAllData includes custom biller sequence counters');

  win.clearAllData();
  win.importAllData(exported);
  win.setActiveBillerId(customBiller.id);
  const nextPeek = win.peekNextInvoiceNumber();
  const t2 = ok(nextPeek === `SEQ-${year}-0043`, `Restored sequence counter continues at 0043 (got ${nextPeek})`);
  return [t1, t2];
});

test('Metadata preservation & zero zombie resurrection on deleteClient/deleteItem', () => {
  const win = document.getElementById('receiptFrame').contentWindow;
  win.clearAllData();

  win.saveClient({ name: 'Dhaka Co', phone: '+8801711111111', email: 'd@co.bd', bin: '001122334-0102' });
  win.saveInvoice({ invoiceNumber: 'INV-META-1', grandTotal: 500, client: { name: 'Dhaka Co', address: 'Banani' } });
  const c = win.loadClients().find(x => x.name === 'Dhaka Co');
  const t1 = ok(c && c.phone === '+8801711111111' && c.bin === '001122334-0102' && c.address === 'Banani', 'Document save merges address without wiping phone/email/bin');

  win.saveItem({ name: 'MCU Board', desc: 'STM32', unit: 'Pcs', unitPrice: 1200 });
  win.saveItem({ name: 'MCU Board', desc: 'STM32', unit: 'Pcs' }, { preserveExisting: true });
  const it = win.getItemByName('MCU Board');
  const t2 = ok(it && it.unitPrice === 1200, 'Challan/preserveExisting does not overwrite catalog unitPrice');

  win.deleteClient('Dhaka Co');
  win.deleteItem('MCU Board');
  const t3 = ok(!win.loadClients().some(x => x.name === 'Dhaka Co'), 'Deleted client does not resurrect from invoices');
  const t4 = ok(!win.loadItems().some(x => x.name === 'MCU Board'), 'Deleted item does not resurrect from documents');
  return [t1, t2, t3, t4];
});

test('getLatestAdjustmentForInvoice respects excludeReceiptNo during receipt re-edit', () => {
  const win = document.getElementById('receiptFrame').contentWindow;
  win.clearAllData();
  win.saveInvoice({ invoiceNumber: 'INV-ADJ-1', grandTotal: 1000, client: { name: 'Adj Client' } });
  win.saveReceipt({
    receiptNumber: 'RCPT-ADJ-1',
    date: '2026-10-10',
    invoiceNumber: 'INV-ADJ-1',
    client: { name: 'Adj Client' },
    amount: 900,
    adjustment: { applied: true, amount: 100, originalTotal: 1000, adjustedTotal: 900, timestamp: '2026-10-10T10:00:00Z' }
  });
  const sInc = win.getInvoicePaymentStats('INV-ADJ-1');
  const sExc = win.getInvoicePaymentStats('INV-ADJ-1', 'RCPT-ADJ-1');
  const t1 = ok(sInc.total === 900 && sInc.due === 0, 'With receipt included, adjusted total is 900 and due is 0');
  const t2 = ok(sExc.total === 1000 && sExc.due === 1000, 'Excluding edited adjusted receipt restores base total 1000 before recalculation');

  win.importAllData({
    invoices: [{ invoiceNumber: 'INV-RES-1', date: '2026-10-12', client: { name: 'Should Not Resurrect Client' }, items: [{ name: 'Should Not Resurrect Item', unitPrice: 100, qty: 1 }], grandTotal: 100 }],
    clients: [],
    items: []
  });
  const t3 = ok(win.loadClients().length === 0 && win.loadItems().length === 0, 'importAllData with explicit empty clients/items prevents zombie resurrection');
  return [t1, t2, t3];
});

test('importAllData merge mode & getDashboardKPIs attention strip counts', () => {
  const win = document.getElementById('receiptFrame').contentWindow;
  win.clearAllData();

  const today = win.toLocalISODate(new Date());
  const dSoon = new Date();
  dSoon.setDate(dSoon.getDate() + 3);
  const soonStr = win.toLocalISODate(dSoon);
  const dFar = new Date();
  dFar.setDate(dFar.getDate() + 20);
  const farStr = win.toLocalISODate(dFar);

  win.saveInvoice({ invoiceNumber: 'INV-M-1', date: today, dueDate: '2020-01-01', grandTotal: 4000, client: { name: 'Alpha' } });
  win.saveInvoice({ invoiceNumber: 'INV-M-PEND', date: today, status: 'Pending', amountPending: true, grandTotal: 0, client: { name: 'Beta' } });
  win.saveReceipt({ receiptNumber: 'RCPT-M-PEND', date: today, status: 'Pending', amountPending: true, amount: 0, client: { name: 'Beta' } });
  win.saveQuotation({ quotationNumber: 'QTN-M-SOON', date: today, validUntil: soonStr, grandTotal: 1000, to: { name: 'Gamma' } });
  win.saveQuotation({ quotationNumber: 'QTN-M-FAR', date: today, validUntil: farStr, grandTotal: 1000, to: { name: 'Gamma' } });

  const kpi = win.getDashboardKPIs('all');
  const t1 = ok(
    kpi.attention.pendingInvoices === 1 &&
    kpi.attention.pendingReceipts === 1 &&
    kpi.attention.overdueInvoices === 1 &&
    kpi.attention.overdueTotal === 4000 &&
    kpi.attention.expiringQuotations === 1,
    `Attention counts accurate: ${JSON.stringify(kpi.attention)}`
  );

  // Merge mode keeps existing INV-M-PEND, updates INV-M-1, adds INV-M-2
  win.importAllData({
    invoices: [
      { invoiceNumber: 'INV-M-1', date: today, dueDate: '2020-01-01', grandTotal: 5500, client: { name: 'Alpha Updated' } },
      { invoiceNumber: 'INV-M-2', date: today, grandTotal: 2500, client: { name: 'Delta' } }
    ],
    clients: [{ name: 'Delta', phone: '01700' }]
  }, { mode: 'merge' });

  const mergedInvs = win.loadInvoices();
  const m1 = mergedInvs.find(i => i.invoiceNumber === 'INV-M-1');
  const mPend = mergedInvs.find(i => i.invoiceNumber === 'INV-M-PEND');
  const m2 = mergedInvs.find(i => i.invoiceNumber === 'INV-M-2');
  const t2 = ok(
    mergedInvs.length === 3 &&
    m1?.grandTotal === 5500 &&
    mPend?.status === 'Pending' &&
    m2?.grandTotal === 2500 &&
    win.loadReceipts().length === 1,
    `Merge mode kept existing & updated matching records (${mergedInvs.length} invs)`
  );
  return [t1, t2];
});




