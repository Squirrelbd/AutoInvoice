// Tests for receipt page

test('Receipt required fields present', () => {
  const doc = document.getElementById('receiptFrame').contentWindow.document;
  const ids = ['receiptNumber','receiptDate','linkedInvoice','clientName','clientAddress','paymentMethod','amountReceived','dueAmount','amountInWords','receiptQR'];
  const results = ids.map(id => ok(!!doc.getElementById(id), `Element #${id} exists`));
  return results;
});

test('Payment stats and due calculation accurate', () => {
  const win = document.getElementById('receiptFrame').contentWindow;
  const { STORAGE_KEYS } = win;
  const base = { invoiceNumber: 'INV-TEST-0001', date: '2025-12-01', client: { name: 'Test Co', address: 'Dhaka' }, items: [], grandTotal: 1000 };
  win.localStorage.setItem(STORAGE_KEYS.invoices, JSON.stringify([base]));
  const stats1 = win.getInvoicePaymentStats('INV-TEST-0001');
  const r1 = ok(stats1.total === 1000 && stats1.paid === 0 && stats1.due === 1000, 'Initial stats reflect full due');
  // Save a receipt of 300
  win.saveReceipt({ receiptNumber: 'RCPT-TEST-0001', date: '2025-12-02', invoiceNumber: 'INV-TEST-0001', client: base.client, paymentMethod: 'Cash', amount: 300 });
  const stats2 = win.getInvoicePaymentStats('INV-TEST-0001');
  const r2 = ok(stats2.total === 1000 && stats2.paid === 300 && stats2.due === 700, 'Stats after payment reflect remaining due');
  // Apply zero due adjustment to 650 remaining
  win.saveReceipt({ receiptNumber: 'RCPT-TEST-0002', date: '2025-12-03', invoiceNumber: 'INV-TEST-0001', client: base.client, paymentMethod: 'Cash', amount: 650, adjustment: { applied: true, amount: 50, originalTotal: 1000, adjustedTotal: 950, timestamp: new Date().toISOString(), method: 'toggle' } });
  const stats3 = win.getInvoicePaymentStats('INV-TEST-0001');
  const r3 = ok(stats3.total === 950 && stats3.paid === 950 && stats3.due === 0, 'Adjustment lowers total and closes due');
  return [r1, r2, r3];
});

test('Print CSS includes A4 and QR physical sizing', async () => {
  const res = await fetch('../css/print.css', { cache: 'no-store' });
  const css = await res.text();
  const hasA4 = /@page\s*\{\s*size:\s*A4/i.test(css);
  const hasQR = /#receiptQR\s*\{[^}]*width:\s*20mm[^}]*height:\s*20mm/i.test(css);
  return [ok(hasA4, '@page size A4 present'), ok(hasQR, '#receiptQR 20mm sizing present')];
});

test('Approximate print content size within limits', () => {
  const doc = document.getElementById('receiptFrame').contentWindow.document;
  const html = doc.getElementById('printArea').outerHTML;
  const bytes = new Blob([html]).size;
  return ok(bytes < 200000, `Print area HTML ${bytes} bytes < 200KB`);
});

test('Currency formatting and words (BDT)', () => {
  const win = document.getElementById('receiptFrame').contentWindow;
  const s1 = ok(win.formatBDT(1234.5) === '৳1,234.50', 'formatBDT formats en-BD with ৳');
  const s2 = ok(win.numberToWordsBDT(100.5).includes('One Hundred Taka and Fifty Paisa'), 'numberToWordsBDT produces words for BDT');
  return [s1, s2];
});

test('Receipt QR uses standardized payload', () => {
  const doc = document.getElementById('receiptFrame').contentWindow.document;
  const el = doc.getElementById('receiptQR');
  const txt = el?.dataset?.text || '';
  const pattern = /^(?:INV:[^|]+\|T:[0-9]+(\.[0-9]+)?\|C:[^|]+\|TO:.+|DOC=RCPT\|TXID=[^|]+\|DT=[^|]*\|AMT=[0-9]+(\.[0-9]+)?\|CCY=BDT\|BEN=[^|]+\|REC=[^|]*\|V=1)$/;
  return ok(pattern.test(txt), 'QR text matches valid receipt schema');
});

test('Void invoice reports status Void with zero due in payment stats', () => {
  const win = document.getElementById('receiptFrame').contentWindow;
  win.saveInvoice({ invoiceNumber: 'INV-VOID-RCPT', date: '2026-10-01', grandTotal: 5000, status: 'Void', client: { name: 'Void Co' } });
  const stats = win.getInvoicePaymentStats('INV-VOID-RCPT');
  return ok(stats.status === 'Void' && stats.total === 0 && stats.due === 0, 'Void invoice reports Void status and 0 payable due');
});

test('Editable agreed invoice total supports downward partial and upward surcharge adjustments', () => {
  const win = document.getElementById('receiptFrame').contentWindow;
  win.saveInvoice({ invoiceNumber: 'INV-ADJ-DN-1', date: '2026-11-01', grandTotal: 10000, client: { name: 'Adj Client A' } });
  win.saveReceipt({
    receiptNumber: 'RCPT-ADJ-DN-1',
    date: '2026-11-02',
    invoiceNumber: 'INV-ADJ-DN-1',
    client: { name: 'Adj Client A' },
    paymentMethod: 'Cash',
    amount: 4000,
    adjustment: { applied: true, reason: 'Payment Settlement Rebate', amount: 1500, originalTotal: 10000, adjustedTotal: 8500, timestamp: '2026-11-02T10:00:00Z', method: 'editable_total' }
  });
  const s1 = win.getInvoicePaymentStats('INV-ADJ-DN-1');
  const r1 = ok(s1.total === 8500 && s1.originalTotal === 10000 && s1.paid === 4000 && s1.due === 4500 && s1.status === 'Partial', 'Downward editable adjustment preserves partial due (4500)');

  win.saveReceipt({
    receiptNumber: 'RCPT-ADJ-DN-2',
    date: '2026-11-03',
    invoiceNumber: 'INV-ADJ-DN-1',
    client: { name: 'Adj Client A' },
    paymentMethod: 'Cash',
    amount: 4500,
    adjustment: { applied: true, reason: 'Payment Settlement Rebate', amount: 1500, originalTotal: 10000, adjustedTotal: 8500, timestamp: '2026-11-03T10:00:00Z', method: 'editable_total' }
  });
  const s2 = win.getInvoicePaymentStats('INV-ADJ-DN-1');
  const r2 = ok(s2.total === 8500 && s2.paid === 8500 && s2.due === 0 && s2.status === 'Paid', 'Final installment against adjusted total closes balance cleanly');

  win.saveInvoice({ invoiceNumber: 'INV-ADJ-UP-1', date: '2026-11-01', grandTotal: 1000, client: { name: 'Adj Client B' } });
  win.saveReceipt({
    receiptNumber: 'RCPT-ADJ-UP-1',
    date: '2026-11-04',
    invoiceNumber: 'INV-ADJ-UP-1',
    client: { name: 'Adj Client B' },
    paymentMethod: 'Bank Transfer',
    amount: 1200,
    adjustment: { applied: true, reason: 'Agreed Invoice Revision', amount: -200, originalTotal: 1000, adjustedTotal: 1200, timestamp: '2026-11-04T10:00:00Z', method: 'editable_total' }
  });
  const sUp = win.getInvoicePaymentStats('INV-ADJ-UP-1');
  const r3 = ok(sUp.total === 1200 && sUp.adjustmentAmount === -200 && sUp.paid === 1200 && sUp.due === 0 && sUp.status === 'Paid', 'Upward surcharge increases effective total to 1200 and settles cleanly');

  win.saveInvoice({ invoiceNumber: 'INV-ADJ-RST-1', date: '2026-11-01', grandTotal: 1000, client: { name: 'Adj Client C' } });
  win.saveReceipt({
    receiptNumber: 'RCPT-ADJ-RST-1',
    date: '2026-11-05',
    invoiceNumber: 'INV-ADJ-RST-1',
    client: { name: 'Adj Client C' },
    paymentMethod: 'Cash',
    amount: 200,
    adjustment: { applied: true, reason: 'Payment Settlement Rebate', amount: 200, originalTotal: 1000, adjustedTotal: 800, timestamp: '2026-11-05T10:00:00Z', method: 'editable_total' }
  });
  win.saveReceipt({
    receiptNumber: 'RCPT-ADJ-RST-2',
    date: '2026-11-06',
    invoiceNumber: 'INV-ADJ-RST-1',
    client: { name: 'Adj Client C' },
    paymentMethod: 'Cash',
    amount: 800,
    adjustment: { applied: true, reason: 'Adjustment Removed / Restored', amount: 0, originalTotal: 1000, adjustedTotal: 1000, timestamp: '2026-11-06T10:00:00Z', method: 'editable_total' }
  });
  const sRst = win.getInvoicePaymentStats('INV-ADJ-RST-1');
  const r4 = ok(sRst.total === 1000 && sRst.adjustmentAmount === 0 && sRst.paid === 1000 && sRst.due === 0, 'Restoring agreed total overrides prior adjustment back to 1000');
  return [r1, r2, r3, r4];
});

test('Blank/Pending receipt reserves unique number, stores items, excludes KPIs until completed', () => {
  const win = document.getElementById('receiptFrame').contentWindow;
  const rcNo = win.peekNextReceiptNumber();
  win.saveReceipt({
    receiptNumber: rcNo,
    date: '2026-11-23',
    status: 'Pending',
    amountPending: true,
    client: { name: 'Pending Receipt Client', address: 'Dhaka' },
    paymentMethod: '',
    items: [{ name: 'Telemetry Sensor', desc: 'Batch A' }],
    amount: 0,
    amountInWords: ''
  });
  win.finalizeReceiptNumber(rcNo);

  const nextNo = win.peekNextReceiptNumber();
  const r1 = ok(nextNo !== rcNo, `Pending receipt locked ${rcNo}; next peek is ${nextNo}`);

  const savedPending = win.getReceiptByNumber(rcNo);
  const r2 = ok(savedPending?.status === 'Pending' && savedPending?.items?.length === 1 && savedPending.items[0].name === 'Telemetry Sensor', 'Pending receipt preserves optional item names');

  const kpiBefore = win.getDashboardKPIs('all');
  const stmtBefore = win.computeClientStatementData({ clientName: 'Pending Receipt Client' });
  const r3 = ok(kpiBefore.totalCollected === 0 && stmtBefore.allReceipts.length === 0, 'Pending receipt excluded from KPIs and client statement');

  // Complete the receipt later with received amount
  win.saveReceipt({
    receiptNumber: rcNo,
    date: '2026-11-23',
    status: 'Saved',
    amountPending: false,
    client: { name: 'Pending Receipt Client', address: 'Dhaka' },
    paymentMethod: 'Cash',
    items: [{ name: 'Telemetry Sensor', desc: 'Batch A' }],
    amount: 5000,
    amountInWords: win.numberToWordsBDT(5000)
  });
  const kpiAfter = win.getDashboardKPIs('all');
  const stmtAfter = win.computeClientStatementData({ clientName: 'Pending Receipt Client' });
  const r4 = ok(kpiAfter.totalCollected === 5000 && stmtAfter.allReceipts.length === 1, 'Completed receipt updates collected KPI and statement');

  // Pending receipt linked to real invoice must NOT count toward paid or getReceiptsByInvoiceNumber()
  win.saveInvoice({ invoiceNumber: 'INV-LINKED-PEND', date: '2026-11-23', client: { name: 'Linked Co' }, grandTotal: 4000 });
  win.saveReceipt({ receiptNumber: 'RCPT-LINKED-PEND', date: '', invoiceNumber: 'INV-LINKED-PEND', status: 'Pending', amountPending: true, client: { name: 'Linked Co' }, amount: 0 });
  const linkedStats = win.getInvoicePaymentStats('INV-LINKED-PEND');
  const r5 = ok(
    linkedStats.paid === 0 &&
    linkedStats.due === 4000 &&
    linkedStats.receipts.length === 0 &&
    linkedStats.pendingReceipts.length === 1 &&
    win.getTotalPaidForInvoice('INV-LINKED-PEND') === 0,
    'Pending linked receipt excluded from paid/settled receipts and tracked in pendingReceipts'
  );

  return [r1, r2, r3, r4, r5];
});
