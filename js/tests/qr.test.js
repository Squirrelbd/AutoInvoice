// Unit tests for QR payload generation and debouncing

test('buildQRPayload generates unified schema for invoices', () => {
  const payload = buildQRPayload('INV', {
    number: 'INV-2026-0001',
    date: '2026-10-08',
    amount: 1500.5,
    client: 'Acme Corp',
    company: 'Amirul Islam'
  });
  const t1 = ok(payload.startsWith('DOC=INV|'), 'Payload starts with DOC=INV');
  const t2 = ok(payload.includes('TXID=INV-2026-0001'), 'Includes transaction ID');
  const t3 = ok(payload.includes('AMT=1500.5'), 'Includes rounded amount');
  const t4 = ok(payload.includes('CCY=BDT'), 'Includes currency BDT');
  const t5 = ok(payload.includes('BEN=Amirul Islam'), 'Includes beneficiary company');
  const t6 = ok(payload.includes('REC=Acme Corp'), 'Includes recipient client');
  const t7 = ok(payload.endsWith('|V=1'), 'Ends with version V=1');
  return [t1, t2, t3, t4, t5, t6, t7];
});

test('buildQRPayload generates compact schema for challans without amount', () => {
  const payload = buildQRPayload('CHAL', {
    number: 'CH-2026-0001',
    date: '2026-10-08',
    client: 'Apex Ltd',
    company: 'Amirul Islam'
  });
  const t1 = ok(payload.startsWith('DOC=CHAL|'), 'Payload starts with DOC=CHAL');
  const t2 = ok(!payload.includes('AMT='), 'Challan omits AMT field');
  const t3 = ok(payload.includes('TXID=CH-2026-0001'), 'Includes challan TXID');
  const t4 = ok(payload.includes('REC=Apex Ltd'), 'Includes recipient');
  return [t1, t2, t3, t4];
});

test('buildQRPayload generates valid receipt and quotation schemas', () => {
  const rcptPayload = buildQRPayload('RCPT', {
    number: 'RCPT-2026-0001',
    date: '2026-10-08',
    amount: 500,
    client: 'John Doe'
  });
  const qtnPayload = buildQRPayload('QTN', {
    number: 'QTN-2026-0001',
    date: '2026-10-08',
    amount: 25000,
    client: 'Tech Solutions'
  });
  const t1 = ok(rcptPayload.includes('DOC=RCPT|TXID=RCPT-2026-0001'), 'Receipt format valid');
  const t2 = ok(qtnPayload.includes('DOC=QTN|TXID=QTN-2026-0001'), 'Quotation format valid');
  return [t1, t2];
});
