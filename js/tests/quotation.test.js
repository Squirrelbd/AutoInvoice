// Unit tests for quotation calculations, QR payload, and persistence

test('Quotation line total and grand total rounding', () => {
  const items = [
    { qty: 5, unitPrice: 120.50 },
    { qty: 2.5, unitPrice: 400.00 },
    { qty: 10, unitPrice: 15.75 }
  ];
  // 5 * 120.50 = 602.50
  // 2.5 * 400.00 = 1000.00
  // 10 * 15.75 = 157.50
  // Total = 602.50 + 1000.00 + 157.50 = 1760.00
  const lineTotals = items.map(it => roundBDT(it.qty * it.unitPrice));
  const t1 = ok(lineTotals[0] === 602.50, `Line 1 rounded to 602.50 (got ${lineTotals[0]})`);
  const t2 = ok(lineTotals[1] === 1000.00, `Line 2 rounded to 1000.00 (got ${lineTotals[1]})`);
  const t3 = ok(lineTotals[2] === 157.50, `Line 3 rounded to 157.50 (got ${lineTotals[2]})`);

  const grandTotal = lineTotals.reduce((sum, line) => roundBDT(sum + line), 0);
  const t4 = ok(grandTotal === 1760.00, `Quotation grand total is 1760.00 (got ${grandTotal})`);
  return [t1, t2, t3, t4];
});

test('Quotation QR payload standard schema', () => {
  const payload = buildQRPayload('QTN', {
    number: 'QTN-2026-0001',
    date: '2026-10-08',
    amount: 1760.00,
    client: 'Beta Ltd',
    company: 'Test Company'
  });
  const t1 = ok(payload.startsWith('DOC=QTN'), 'Payload starts with DOC=QTN');
  const t2 = ok(payload.includes('TXID=QTN-2026-0001'), 'Contains quotation TXID');
  const t3 = ok(payload.includes('AMT=1760'), 'Contains quotation amount');
  const t4 = ok(payload.includes('CCY=BDT'), 'Specifies currency BDT');
  return [t1, t2, t3, t4];
});

test('Quotation storage save and retrieve with validity', () => {
  const sample = {
    quotationNumber: 'QTN-TEST-9999',
    date: '2026-10-08',
    validityDays: 15,
    validUntil: '2026-10-23',
    subject: 'Web Application Development',
    to: { name: 'Rahim Khan', company: 'Digital Services', address: 'Dhanmondi, Dhaka' },
    items: [{ desc: 'Full-stack delivery', qty: 1, unitPrice: 50000, total: 50000 }],
    grandTotal: 50000
  };
  saveQuotation(sample);
  const retrieved = getQuotationByNumber('QTN-TEST-9999');
  const t1 = ok(!!retrieved, 'Saved quotation retrieved successfully');
  const t2 = ok(retrieved?.grandTotal === 50000, 'Retrieved grand total matches');
  const t3 = ok(retrieved?.to?.name === 'Rahim Khan', 'Client contact name matches');
  const t4 = ok(retrieved?.validityDays === 15, `validityDays persisted as 15 (got ${retrieved?.validityDays})`);
  const t5 = ok(retrieved?.validUntil === '2026-10-23', `validUntil persisted as 2026-10-23 (got ${retrieved?.validUntil})`);
  return [t1, t2, t3, t4, t5];
});

test('Quotation validity lifecycle via getQuotationStatus()', () => {
  // 1. Legacy record fallback: only date present, no validUntil/validityDays
  const legacyQ = {
    quotationNumber: 'QTN-LEGACY-01',
    date: '2026-10-01'
  };
  const stLegacyValid = getQuotationStatus(legacyQ, '2026-10-20');
  const t1 = ok(stLegacyValid.isValid && stLegacyValid.status === 'Valid', 'Legacy quotation valid within 30 days');
  const t2 = ok(stLegacyValid.validUntil === '2026-10-31', `Legacy validUntil computed as 2026-10-31 (got ${stLegacyValid.validUntil})`);
  const t3 = ok(stLegacyValid.daysRemaining === 11, `Days remaining is 11 (got ${stLegacyValid.daysRemaining})`);

  const stLegacyExpired = getQuotationStatus(legacyQ, '2026-11-05');
  const t4 = ok(stLegacyExpired.isExpired && stLegacyExpired.status === 'Expired', 'Legacy quotation expired after 30 days');

  // 2. Custom validityDays (15 days)
  const q15 = {
    quotationNumber: 'QTN-15D',
    date: '2026-11-01',
    validityDays: 15
  };
  const st15Valid = getQuotationStatus(q15, '2026-11-15');
  const t5 = ok(st15Valid.isValid && st15Valid.validUntil === '2026-11-16', `15-day quotation valid until 2026-11-16 (got ${st15Valid.validUntil})`);
  const st15Expired = getQuotationStatus(q15, '2026-11-17');
  const t6 = ok(st15Expired.isExpired, '15-day quotation expired on day 16');

  // 3. Exact boundary condition (valid on the exact validUntil day, expired the next day)
  const qBoundary = {
    quotationNumber: 'QTN-BOUND',
    date: '2026-11-10',
    validityDays: 10,
    validUntil: '2026-11-20'
  };
  const stBoundaryOn = getQuotationStatus(qBoundary, '2026-11-20');
  const t7 = ok(stBoundaryOn.isValid && stBoundaryOn.daysRemaining === 0, 'Quotation is still valid on exact validUntil date (0 days remaining)');
  const stBoundaryAfter = getQuotationStatus(qBoundary, '2026-11-21');
  const t8 = ok(stBoundaryAfter.isExpired, 'Quotation is expired 1 day after validUntil date');

  // 4. Converted quotation overrides validity
  const qConverted = {
    quotationNumber: 'QTN-CONV',
    date: '2025-01-01',
    validUntil: '2025-01-15',
    converted: true,
    convertedToInvoice: 'INV-2025-0010'
  };
  const stConv = getQuotationStatus(qConverted, '2026-11-17');
  const t9 = ok(stConv.status === 'Converted' && stConv.isConverted && !stConv.isExpired, 'Converted quotation has Converted status');

  // 5. Void quotation
  const qVoid = {
    quotationNumber: 'QTN-VOID',
    date: '2026-11-15',
    validUntil: '2026-12-15',
    status: 'Void'
  };
  const stVoid = getQuotationStatus(qVoid, '2026-11-17');
  const t10 = ok(stVoid.status === 'Void' && stVoid.isVoid && !stVoid.isValid, 'Void quotation has Void status');

  return [t1, t2, t3, t4, t5, t6, t7, t8, t9, t10];
});
