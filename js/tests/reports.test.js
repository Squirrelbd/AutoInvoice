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

test('AutoInvoiceDocList.filterAndSortRecords filters & sorts across all 4 doc types', () => {
  const backupInvoices = localStorage.getItem(STORAGE_KEYS.invoices);
  const backupReceipts = localStorage.getItem(STORAGE_KEYS.receipts);
  const backupChallans = localStorage.getItem(STORAGE_KEYS.challans);

  const testInvoices = [
    {
      invoiceNumber: 'INV-DL-01',
      date: '2026-01-10',
      dueDate: '2026-01-20',
      billerId: 'biller_default',
      client: { name: 'Alpha Textiles', phone: '01711' },
      title: 'Web Portal Setup',
      items: [{ name: 'Server Node', qty: 1, rate: 5000, amount: 5000 }],
      grandTotal: 5000
    },
    {
      invoiceNumber: 'INV-DL-02',
      date: '2026-02-15',
      dueDate: '2099-12-31',
      billerId: 'biller_b',
      client: { name: 'Beta Logistics' },
      title: 'Fleet GPS Dashboard',
      items: [{ name: 'Tracker App', qty: 2, rate: 1000, amount: 2000 }],
      grandTotal: 2000
    },
    {
      invoiceNumber: 'INV-DL-03',
      date: '2026-02-01',
      dueDate: '2026-02-10',
      status: 'Void',
      client: { name: 'Cancelled Client' },
      grandTotal: 9000
    }
  ];
  const testReceipts = [
    {
      receiptNumber: 'RCPT-DL-01',
      date: '2026-02-16',
      invoiceNumber: 'INV-DL-02',
      billerId: 'biller_b',
      client: { name: 'Beta Logistics' },
      paymentMethod: 'bKash',
      amount: 1200,
      adjustment: { applied: true, amount: 800, adjustedTotal: 1200, reason: 'Discount', method: 'editable_total' }
    },
    {
      receiptNumber: 'RCPT-DL-02',
      date: '2026-01-12',
      invoiceNumber: 'INV-DL-01',
      billerId: 'biller_default',
      client: { name: 'Alpha Textiles' },
      paymentMethod: 'Cash',
      amount: 1500
    }
  ];
  const testChallans = [
    {
      challanNumber: 'CH-DL-01',
      date: '2026-02-16',
      linkedInvoice: 'INV-DL-02',
      billerId: 'biller_b',
      client: { name: 'Beta Logistics' },
      items: [{ name: 'Tracker App', qty: 2 }]
    },
    {
      challanNumber: 'CH-DL-02',
      date: '2026-01-05',
      billerId: 'biller_default',
      client: { name: 'Delta Foods' },
      items: [{ name: 'POS Printer', qty: 3 }]
    }
  ];
  const testQuotations = [
    {
      quotationNumber: 'QTN-DL-01',
      date: '2026-01-01',
      validUntil: '2099-12-31',
      billerId: 'biller_default',
      subject: 'Solar Inverter Proposal',
      to: { name: 'Zeta Corp', company: 'Zeta Industries Ltd' },
      grandTotal: 4500
    },
    {
      quotationNumber: 'QTN-DL-02',
      date: '2026-01-05',
      validUntil: '2026-01-15',
      converted: true,
      convertedToInvoice: 'INV-DL-01',
      billerId: 'biller_default',
      subject: 'Portal Upgrade',
      to: { name: 'Alpha Textiles' },
      grandTotal: 5000
    },
    {
      quotationNumber: 'QTN-DL-03',
      date: '2025-01-01',
      validUntil: '2025-01-10',
      billerId: 'biller_default',
      to: { company: 'Expired Co' },
      grandTotal: 3000
    }
  ];

  localStorage.setItem(STORAGE_KEYS.invoices, JSON.stringify(testInvoices));
  localStorage.setItem(STORAGE_KEYS.receipts, JSON.stringify(testReceipts));
  localStorage.setItem(STORAGE_KEYS.challans, JSON.stringify(testChallans));

  try {
    const invAll = AutoInvoiceDocList.filterAndSortRecords(testInvoices, { type: 'invoice', sortBy: 'date_desc' });
    const invBetaAdjusted = invAll.find(r => r.number === 'INV-DL-02');
    const invOverdue = AutoInvoiceDocList.filterAndSortRecords(testInvoices, { type: 'invoice', status: 'overdue' });
    const invSearchItem = AutoInvoiceDocList.filterAndSortRecords(testInvoices, { type: 'invoice', query: 'Server Node' });
    const invDueDesc = AutoInvoiceDocList.filterAndSortRecords(testInvoices, { type: 'invoice', sortBy: 'due_desc' });
    const invDefBiller = AutoInvoiceDocList.filterAndSortRecords(testInvoices, { type: 'invoice', billerId: 'biller_default' });

    const qtnValid = AutoInvoiceDocList.filterAndSortRecords(testQuotations, { type: 'quotation', status: 'valid' });
    const qtnConv = AutoInvoiceDocList.filterAndSortRecords(testQuotations, { type: 'quotation', status: 'converted' });
    const qtnExp = AutoInvoiceDocList.filterAndSortRecords(testQuotations, { type: 'quotation', status: 'expired' });
    const qtnClientAsc = AutoInvoiceDocList.filterAndSortRecords(testQuotations, { type: 'quotation', sortBy: 'client_asc' });
    const qtnBySubj = AutoInvoiceDocList.filterAndSortRecords(testQuotations, { type: 'quotation', query: 'Solar Inverter' });
    const qtnByCompany = AutoInvoiceDocList.filterAndSortRecords(testQuotations, { type: 'quotation', query: 'Zeta Industries' });

    const multiInv = { invoiceNumber: 'INV-MC-1', billerId: 'biller_default', linkedChallan: 'CH-M1, CH-M2', grandTotal: 500, client: { name: 'MC Client' } };
    const mcCtx = { invoicedChallans: new Map([['CH-M1', 'INV-MC-1'], ['CH-M2', 'INV-MC-1']]), billerMap: new Map() };
    const enrichedMcInv = AutoInvoiceDocList.enrichRecord(multiInv, 'invoice', mcCtx);
    const chOpen = AutoInvoiceDocList.filterAndSortRecords(testChallans, { type: 'challan', status: 'open' });
    const chInvoiced = AutoInvoiceDocList.filterAndSortRecords(testChallans, { type: 'challan', status: 'invoiced' });

    const rcAdj = AutoInvoiceDocList.filterAndSortRecords(testReceipts, { type: 'receipt', status: 'adjusted' });
    const rcMethod = AutoInvoiceDocList.filterAndSortRecords(testReceipts, { type: 'receipt', method: 'bKash' });
    const rcAmtDesc = AutoInvoiceDocList.filterAndSortRecords(testReceipts, { type: 'receipt', sortBy: 'amount_desc' });
    const rcSur = AutoInvoiceDocList.enrichRecord({ receiptNumber: 'RCPT-SUR-X', amount: 1200, invoiceNumber: 'INV-DL-01', adjustment: { applied: true, amount: -200 } }, 'receipt');

    return [
      ok(invAll.length === 3 && invAll[0].number === 'INV-DL-02', 'Invoices sorted date_desc newest first'),
      ok(invBetaAdjusted && invBetaAdjusted.amount === 1200 && invBetaAdjusted.isAdjusted === true && invBetaAdjusted.due === 0, 'Invoice reflects adjusted total and 0 due'),
      ok(invOverdue.length === 1 && invOverdue[0].number === 'INV-DL-01', 'Overdue filter isolates unpaid past-due invoice'),
      ok(invSearchItem.length === 1 && invSearchItem[0].number === 'INV-DL-01', 'Item keyword search matches invoice'),
      ok(invDueDesc[0].number === 'INV-DL-01' && invDueDesc[0].due === 3500, 'Sort due_desc places highest balance due first'),
      ok(invDefBiller.some(r => r.number === 'INV-DL-01') && invDefBiller.some(r => r.number === 'INV-DL-03') && !invDefBiller.some(r => r.number === 'INV-DL-02'), 'Default biller filter includes legacy missing-billerId record and isolates biller_default'),
      ok(qtnValid.length === 1 && qtnValid[0].number === 'QTN-DL-01' && qtnValid[0].clientName === 'Zeta Corp' && qtnValid[0].title === 'Solar Inverter Proposal', 'Canonical quotation to/subject extracted & valid status filtered'),
      ok(qtnConv.length === 1 && qtnConv[0].number === 'QTN-DL-02', 'Quotation converted status filter'),
      ok(qtnExp.length === 1 && qtnExp[0].number === 'QTN-DL-03' && qtnExp[0].clientName === 'Expired Co', 'Quotation expired status & company fallback'),
      ok(qtnClientAsc[0].number === 'QTN-DL-02', 'Quotation client_asc sorts Alpha before Expired/Zeta'),
      ok(qtnBySubj.length === 1 && qtnByCompany.length === 1 && qtnBySubj[0].number === 'QTN-DL-01', 'Quotation search matches canonical subject and to.company'),
      ok(enrichedMcInv.linkedUrl === 'challan.html?no=CH-M1', 'Comma-separated multi-challan link URL targets first challan without commas'),
      ok(chOpen.length === 1 && chOpen[0].number === 'CH-DL-02', 'Challan open filter returns unlinked challan'),
      ok(chInvoiced.length === 1 && chInvoiced[0].number === 'CH-DL-01', 'Challan invoiced filter returns linked challan'),
      ok(rcAdj.length === 1 && rcAdj[0].number === 'RCPT-DL-01', 'Receipt adjusted filter isolates adjusted receipt'),
      ok(rcMethod.length === 1 && rcMethod[0].number === 'RCPT-DL-01', 'Receipt payment method filter isolates bKash'),
      ok(rcAmtDesc[0].number === 'RCPT-DL-02' && rcAmtDesc[0].amount === 1500, 'Receipt amount_desc sorts highest received first'),
      ok(rcSur.metaNote.includes('+'), 'Surcharge adjustment metaNote renders + sign cleanly')
    ];
  } finally {
    if (backupInvoices === null) localStorage.removeItem(STORAGE_KEYS.invoices);
    else localStorage.setItem(STORAGE_KEYS.invoices, backupInvoices);
    if (backupReceipts === null) localStorage.removeItem(STORAGE_KEYS.receipts);
    else localStorage.setItem(STORAGE_KEYS.receipts, backupReceipts);
    if (backupChallans === null) localStorage.removeItem(STORAGE_KEYS.challans);
    else localStorage.setItem(STORAGE_KEYS.challans, backupChallans);
  }
});
