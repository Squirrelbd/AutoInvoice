// Unit tests for reports, multi-biller filtering, client account statement ledger, and revenue breakdown

test('search & reports filters documents by active biller and consolidated view', () => {
  const b1 = saveBiller({ name: 'Alpha Ltd', invoicePrefix: 'ALPHA', themeColor: '#0b3969' });
  const b2 = saveBiller({ name: 'Beta Tech', invoicePrefix: 'BETA', themeColor: '#15803d' });

  saveInvoice({
    invoiceNumber: 'ALPHA-2026-0001',
    billerId: b1.id,
    date: '2026-10-01',
    client: { name: 'Client X' },
    items: [{ name: 'Hosting', desc: 'Cloud server', qty: 1, unitPrice: 5000 }],
    grandTotal: 5000
  });

  saveInvoice({
    invoiceNumber: 'BETA-2026-0001',
    billerId: b2.id,
    date: '2026-10-05',
    client: { name: 'Client Y' },
    items: [{ name: 'Consulting', desc: 'System Audit', qty: 1, unitPrice: 12000 }],
    grandTotal: 12000
  });

  const allInvs = loadInvoices();
  const t1 = ok(allInvs.length === 2, '2 total invoices saved');

  const b1Invs = allInvs.filter(i => (i.billerId || 'biller_default') === b1.id);
  const t2 = ok(b1Invs.length === 1 && b1Invs[0].invoiceNumber === 'ALPHA-2026-0001', 'Biller Alpha filter isolates ALPHA-2026-0001');

  const b2Invs = allInvs.filter(i => (i.billerId || 'biller_default') === b2.id);
  const t3 = ok(b2Invs.length === 1 && b2Invs[0].invoiceNumber === 'BETA-2026-0001', 'Biller Beta filter isolates BETA-2026-0001');

  // Clean up
  deleteBiller(b1.id);
  deleteBiller(b2.id);
  return [t1, t2, t3];
});

test('client statement of account calculates chronological running balance with zero-drift', () => {
  // Invoice 1: 10,000 on 2026-10-01
  saveInvoice({
    invoiceNumber: 'INV-2026-0001',
    date: '2026-10-01',
    client: { name: 'Universal Acme', address: 'Tejgaon, Dhaka' },
    items: [{ name: 'Machinery', desc: 'Unit A', qty: 1, unitPrice: 10000 }],
    grandTotal: 10000
  });

  // Receipt 1: Partial payment of 4,000 on 2026-10-03
  saveReceipt({
    receiptNumber: 'RCPT-2026-0001',
    invoiceNumber: 'INV-2026-0001',
    date: '2026-10-03',
    client: { name: 'Universal Acme', address: 'Tejgaon, Dhaka' },
    amount: 4000,
    paymentMethod: 'Bank Transfer'
  });

  // Invoice 2: 7,500.50 on 2026-10-05
  saveInvoice({
    invoiceNumber: 'INV-2026-0002',
    date: '2026-10-05',
    client: { name: 'Universal Acme', address: 'Tejgaon, Dhaka' },
    items: [{ name: 'Spares', desc: 'Parts', qty: 1, unitPrice: 7500.50 }],
    grandTotal: 7500.50
  });

  // Receipt 2: Payment of 5,000.25 on 2026-10-10
  saveReceipt({
    receiptNumber: 'RCPT-2026-0002',
    invoiceNumber: 'INV-2026-0002',
    date: '2026-10-10',
    client: { name: 'Universal Acme', address: 'Tejgaon, Dhaka' },
    amount: 5000.25,
    paymentMethod: 'bKash'
  });

  const clientName = 'Universal Acme';
  const clientInvs = loadInvoices().filter(i => (i.client?.name || '').trim().toLowerCase() === clientName.toLowerCase());
  const clientRcpts = loadReceipts().filter(r => (r.client?.name || '').trim().toLowerCase() === clientName.toLowerCase());

  const timeline = [];
  clientInvs.forEach(i => timeline.push({ date: i.date, type: 'Invoice', ref: i.invoiceNumber, debit: i.grandTotal, credit: 0 }));
  clientRcpts.forEach(r => timeline.push({ date: r.date, type: 'Receipt', ref: r.receiptNumber, debit: 0, credit: r.amount }));
  timeline.sort((a, b) => new Date(a.date) - new Date(b.date));

  let runningBalance = 0;
  const ledger = timeline.map(row => {
    runningBalance = roundBDT(runningBalance + row.debit - row.credit);
    return { ...row, balance: runningBalance };
  });

  const t1 = ok(ledger.length === 4, '4 transactions in chronological statement');
  const t2 = ok(ledger[0].balance === 10000, 'Balance after Invoice 1 is 10,000.00');
  const t3 = ok(ledger[1].balance === 6000, 'Balance after Receipt 1 is 6,000.00');
  const t4 = ok(ledger[2].balance === 13500.50, 'Balance after Invoice 2 is 13,500.50');
  const t5 = ok(ledger[3].balance === 8500.25, 'Balance after Receipt 2 is exactly 8,500.25 (got ' + ledger[3].balance + ')');

  return [t1, t2, t3, t4, t5];
});

test('monthly and quarterly revenue breakdown aggregates invoice periods and recovery rates', () => {
  saveInvoice({
    invoiceNumber: 'INV-2026-0101',
    date: '2026-01-15',
    client: { name: 'Client Q1' },
    items: [{ name: 'Service', desc: '', qty: 1, unitPrice: 20000 }],
    grandTotal: 20000
  });
  saveReceipt({
    receiptNumber: 'RCPT-2026-0101',
    invoiceNumber: 'INV-2026-0101',
    date: '2026-01-20',
    amount: 15000
  });

  saveInvoice({
    invoiceNumber: 'INV-2026-0401',
    date: '2026-04-10',
    client: { name: 'Client Q2' },
    items: [{ name: 'Service', desc: '', qty: 1, unitPrice: 30000 }],
    grandTotal: 30000
  });
  saveReceipt({
    receiptNumber: 'RCPT-2026-0401',
    invoiceNumber: 'INV-2026-0401',
    date: '2026-04-15',
    amount: 30000
  });

  const invs = loadInvoices();
  // Aggregate Q1 (Jan-Mar)
  const q1Invs = invs.filter(i => i.date >= '2026-01-01' && i.date <= '2026-03-31');
  const q1Invoiced = q1Invs.reduce((a, c) => roundBDT(a + c.grandTotal), 0);
  const q1Collected = q1Invs.reduce((a, c) => roundBDT(a + getTotalPaidForInvoice(c.invoiceNumber)), 0);
  const q1Due = roundBDT(Math.max(0, q1Invoiced - q1Collected));
  const q1Rate = ((q1Collected / q1Invoiced) * 100).toFixed(1) + '%';

  const t1 = ok(q1Invoiced === 20000, 'Q1 invoiced is 20,000');
  const t2 = ok(q1Collected === 15000, 'Q1 collected is 15,000');
  const t3 = ok(q1Due === 5000, 'Q1 due is 5,000');
  const t4 = ok(q1Rate === '75.0%', 'Q1 collection recovery rate is 75.0%');

  // Aggregate Q2 (Apr-Jun)
  const q2Invs = invs.filter(i => i.date >= '2026-04-01' && i.date <= '2026-06-30');
  const q2Invoiced = q2Invs.reduce((a, c) => roundBDT(a + c.grandTotal), 0);
  const q2Collected = q2Invs.reduce((a, c) => roundBDT(a + getTotalPaidForInvoice(c.invoiceNumber)), 0);
  const q2Due = roundBDT(Math.max(0, q2Invoiced - q2Collected));
  const q2Rate = ((q2Collected / q2Invoiced) * 100).toFixed(1) + '%';

  const t5 = ok(q2Invoiced === 30000, 'Q2 invoiced is 30,000');
  const t6 = ok(q2Collected === 30000, 'Q2 collected is 30,000');
  const t7 = ok(q2Due === 0, 'Q2 due is 0');
  const t8 = ok(q2Rate === '100.0%', 'Q2 collection recovery rate is 100.0%');

  return [t1, t2, t3, t4, t5, t6, t7, t8];
});

test('CSV exports protect against spreadsheet formula injection (=, +, -, @)', () => {
  const maliciousCells = ['=cmd|"/C calc"!A0', '+12345', '-500', '@SUM(A1:A10)', '\t=1+1', 'Standard Text'];

  const sanitizedCells = maliciousCells.map(cell =>
    typeof sanitizeCsvCell === 'function' ? sanitizeCsvCell(cell) : `"${String(cell || '')}"`
  );

  const t1 = ok(sanitizedCells[0] === `"'=cmd|""/C calc""!A0"`, 'Equals formula escaped with leading quote');
  const t2 = ok(sanitizedCells[1] === `"'${'+12345'}"`, 'Plus formula escaped with leading quote');
  const t3 = ok(sanitizedCells[2] === `"'-500"`, 'Minus formula escaped with leading quote');
  const t4 = ok(sanitizedCells[3] === `"'@SUM(A1:A10)"`, 'At symbol formula escaped with leading quote');
  const t5 = ok(sanitizedCells[4] === `"'\t=1+1"`, 'Tab-prefixed formula escaped');
  const t6 = ok(sanitizedCells[5] === `"Standard Text"`, 'Regular text not prefixed with single quote');

  return [t1, t2, t3, t4, t5, t6];
});
