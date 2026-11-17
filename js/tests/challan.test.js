// Unit tests for challan data structures, QR payload, and persistence

test('Challan item structure sanitization and comma-formatted quantity parsing', () => {
  const rawRow = { name: '  Office Laptop  ', desc: ' Core i7 16GB ', qty: ' 1,250.5 ', unit: ' Sets ' };
  const sanitized = {
    name: (rawRow.name || '').trim(),
    desc: (rawRow.desc || '').trim(),
    qty: parseFloat(String(rawRow.qty || '0').replace(/[^0-9.]/g, '')) || 0,
    unit: (rawRow.unit || '').trim()
  };
  const t1 = ok(sanitized.name === 'Office Laptop', 'Item name trimmed');
  const t2 = ok(sanitized.desc === 'Core i7 16GB', 'Description trimmed');
  const t3 = ok(sanitized.qty === 1250.5, 'Comma & decimal quantity parsed accurately');
  const t4 = ok(sanitized.unit === 'Sets', 'Unit preserved and trimmed');
  return [t1, t2, t3, t4];
});

test('Challan QR payload standard schema', () => {
  const payload = buildQRPayload('CHAL', {
    number: 'CHAL-2026-0005',
    date: '2026-10-08',
    itemCount: 3,
    client: 'Apex Logistics',
    company: 'Test Company'
  });
  const t1 = ok(payload.startsWith('DOC=CHAL'), 'Payload starts with DOC=CHAL');
  const t2 = ok(payload.includes('TXID=CHAL-2026-0005'), 'Contains challan TXID');
  const t3 = ok(payload.includes('BEN=Test Company'), 'Contains company beneficiary name');
  const t4 = ok(payload.includes('REC=Apex Logistics'), 'Contains recipient client name');
  return [t1, t2, t3, t4];
});

test('Challan storage save and retrieve', () => {
  const sampleChallan = {
    challanNumber: 'CHAL-TEST-0042',
    date: '2026-10-08',
    title: 'Hardware Delivery',
    client: { name: 'Global Tech Ltd', address: 'Uttara, Dhaka' },
    items: [
      { name: 'Server Rack', desc: '42U Enclosure', qty: 2, unit: 'Units' },
      { name: 'Patch Cable', desc: 'Cat6 2m', qty: 50, unit: 'Pcs' }
    ]
  };
  saveChallan(sampleChallan);
  const loaded = getChallanByNumber('CHAL-TEST-0042');
  const t1 = ok(!!loaded, 'Challan saved and retrieved by number');
  const t2 = ok(loaded?.items?.length === 2, '2 line items preserved');
  const t3 = ok(loaded?.client?.name === 'Global Tech Ltd', 'Client name preserved');
  return [t1, t2, t3];
});

test('Challan sequence does not rewind on earlier number finalize', () => {
  const year = new Date().getFullYear();
  finalizeChallanNumber(`${NUMBER_FORMATS.challanPrefix}-${year}-0020`);
  const peek1 = peekNextChallanNumber();
  const t1 = ok(peek1 === `${NUMBER_FORMATS.challanPrefix}-${year}-0021`, 'Sequence advances to 21');

  finalizeChallanNumber(`${NUMBER_FORMATS.challanPrefix}-${year}-0005`);
  const peek2 = peekNextChallanNumber();
  const t2 = ok(peek2 === `${NUMBER_FORMATS.challanPrefix}-${year}-0021`, 'Sequence not rewound by saving earlier number');
  return [t1, t2];
});
