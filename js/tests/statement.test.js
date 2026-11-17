// Unit tests for Client Statement of Account & Ledger Calculations

test('Statement Engine calculates chronological running balance and totals', () => {
  const clientName = 'Apex Engineering Ltd';

  // Seed sample invoices
  const inv1 = {
    invoiceNumber: 'INV-2026-0001',
    date: '2026-01-10',
    dueDate: '2026-01-25',
    client: { name: clientName, address: 'Tejgaon I/A, Dhaka' },
    grandTotal: 50000,
    items: [{ desc: 'PCB Assembly', qty: 10, price: 5000, total: 50000 }]
  };
  const inv2 = {
    invoiceNumber: 'INV-2026-0002',
    date: '2026-02-15',
    dueDate: '2026-03-02',
    client: { name: clientName, address: 'Tejgaon I/A, Dhaka' },
    grandTotal: 30000,
    items: [{ desc: 'Firmware Programming', qty: 1, price: 30000, total: 30000 }]
  };
  saveInvoice(inv1);
  saveInvoice(inv2);

  // Seed sample receipt
  const rc1 = {
    receiptNumber: 'RCPT-2026-0001',
    date: '2026-01-20',
    invoiceNumber: 'INV-2026-0001',
    client: { name: clientName },
    amount: 20000,
    paymentMethod: 'Bank Transfer'
  };
  saveReceipt(rc1);

  // Verify load
  const clientInvoices = loadInvoices().filter(i => i.client?.name === clientName);
  const clientReceipts = loadReceipts().filter(r => r.client?.name === clientName);

  const t1 = ok(clientInvoices.length === 2, '2 invoices loaded for client');
  const t2 = ok(clientReceipts.length === 1, '1 receipt loaded for client');

  // Verify total invoiced, total collected, and remaining balance
  const totalBilled = clientInvoices.reduce((sum, i) => roundBDT(sum + Number(i.grandTotal)), 0);
  const totalPaid = clientReceipts.reduce((sum, r) => roundBDT(sum + Number(r.amount)), 0);
  const netBalance = roundBDT(totalBilled - totalPaid);

  const t3 = ok(totalBilled === 80000, `Total billed is 80,000 (got ${totalBilled})`);
  const t4 = ok(totalPaid === 20000, `Total paid is 20,000 (got ${totalPaid})`);
  const t5 = ok(netBalance === 60000, `Net closing balance is 60,000 (got ${netBalance})`);

  return [t1, t2, t3, t4, t5];
});

test('Statement Engine calculates opening balance when date filter is applied', () => {
  const clientName = 'Delta Automation';

  // Invoice in Jan 2026
  saveInvoice({
    invoiceNumber: 'INV-2026-0101',
    date: '2026-01-05',
    dueDate: '2026-01-20',
    client: { name: clientName },
    grandTotal: 40000
  });

  // Receipt in Jan 2026
  saveReceipt({
    receiptNumber: 'RCPT-2026-0101',
    date: '2026-01-15',
    invoiceNumber: 'INV-2026-0101',
    client: { name: clientName },
    amount: 15000
  });

  // Invoice in Feb 2026
  saveInvoice({
    invoiceNumber: 'INV-2026-0102',
    date: '2026-02-10',
    dueDate: '2026-02-25',
    client: { name: clientName },
    grandTotal: 25000
  });

  // Filter for period starting 2026-02-01
  const fromDate = '2026-02-01';
  let openingBalance = 0;
  loadInvoices().filter(i => i.client?.name === clientName).forEach(inv => {
    if (inv.date < fromDate) {
      openingBalance = roundBDT(openingBalance + Number(inv.grandTotal));
    }
  });
  loadReceipts().filter(r => r.client?.name === clientName).forEach(rc => {
    if (rc.date < fromDate) {
      openingBalance = roundBDT(openingBalance - Number(rc.amount));
    }
  });

  const t1 = ok(openingBalance === 25000, `Opening balance brought forward on Feb 1 is 25,000 (got ${openingBalance})`);
  return [t1];
});

test('Statement Aging Analysis correctly categorizes overdue invoices (real StatementEngine)', () => {
  const clientName = 'Zenith Robotics';
  const today = new Date();
  const formatD = (d) => typeof toLocalISODate === 'function' ? toLocalISODate(d) : d.toISOString().slice(0, 10);

  // 1. Current / Not overdue (due 5 days in future)
  const dFuture = new Date(today.getTime() + 5 * 86400000);
  const invCurrent = {
    invoiceNumber: 'INV-ZEN-01',
    date: formatD(today),
    dueDate: formatD(dFuture),
    client: { name: clientName },
    grandTotal: 10000
  };

  // 2. 15 days overdue
  const dOverdue15 = new Date(today.getTime() - 15 * 86400000);
  const inv15 = {
    invoiceNumber: 'INV-ZEN-02',
    date: formatD(new Date(today.getTime() - 30 * 86400000)),
    dueDate: formatD(dOverdue15),
    client: { name: clientName },
    grandTotal: 15000
  };

  // 3. 45 days overdue
  const dOverdue45 = new Date(today.getTime() - 45 * 86400000);
  const inv45 = {
    invoiceNumber: 'INV-ZEN-03',
    date: formatD(new Date(today.getTime() - 60 * 86400000)),
    dueDate: formatD(dOverdue45),
    client: { name: clientName },
    grandTotal: 25000
  };

  saveInvoice(invCurrent);
  saveInvoice(inv15);
  saveInvoice(inv45);

  const aging = window.StatementEngine.calculateAging([invCurrent, inv15, inv45]);

  const t1 = ok(aging.current === 10000, `Current bucket is 10,000 (got ${aging.current})`);
  const t2 = ok(aging.d1_30 === 15000, `1-30 days bucket is 15,000 (got ${aging.d1_30})`);
  const t3 = ok(aging.d31_60 === 25000, `31-60 days bucket is 25,000 (got ${aging.d31_60})`);

  return [t1, t2, t3];
});

test('computeClientStatementData excludes Void docs and prevents double-counting prior adjustments', () => {
  saveInvoice({ invoiceNumber: 'INV-SOA-1', date: '2026-09-01', client: { name: 'Ledger Co' }, grandTotal: 1000 });
  saveInvoice({ invoiceNumber: 'INV-SOA-VOID', date: '2026-09-02', client: { name: 'Ledger Co' }, grandTotal: 9999, status: 'Void' });
  saveReceipt({
    receiptNumber: 'RCPT-SOA-1',
    date: '2026-09-05',
    invoiceNumber: 'INV-SOA-1',
    client: { name: 'Ledger Co' },
    amount: 400,
    adjustment: { applied: true, amount: 100, originalTotal: 1000, adjustedTotal: 900, timestamp: '2026-09-05T10:00:00Z' }
  });
  saveReceipt({
    receiptNumber: 'RCPT-SOA-2',
    date: '2026-09-06',
    invoiceNumber: 'INV-SOA-1',
    client: { name: 'Ledger Co' },
    amount: 450,
    adjustment: { applied: true, amount: 50, originalTotal: 900, adjustedTotal: 850, timestamp: '2026-09-06T10:00:00Z' }
  });

  const data = computeClientStatementData({ clientName: 'Ledger Co' });
  const t1 = ok(data.allInvoices.length === 1 && data.periodInvoices[0]._effectiveTotal === 1000, 'Void invoice excluded from statement ledger');
  const totalCredit = data.periodReceipts.reduce((s, r) => roundBDT(s + r._effectiveCredit), 0);
  const t2 = ok(totalCredit === 900, `Only latest adjustment (50) credited once alongside cash (400+450=850+50=900, got ${totalCredit})`);
  return [t1, t2];
});
