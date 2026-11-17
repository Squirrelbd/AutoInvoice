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

test('Partial Delivery Challan tracking, multi-challan linking & slimCompanySnapshot', () => {
  clearAllData();
  saveInvoice({
    invoiceNumber: 'INV-PART-1',
    date: '2026-11-17',
    client: { name: 'Partial Client' },
    items: [
      { name: 'Router', desc: 'AX3000', qty: 10, unit: 'Pcs', unitPrice: 5000 },
      { name: 'Cat6 Cable', desc: '100m Box', qty: 5, unit: 'Boxes', unitPrice: 3000 }
    ],
    grandTotal: 65000
  });

  saveChallan({
    challanNumber: 'CH-PART-1',
    date: '2026-11-17',
    linkedInvoice: 'INV-PART-1',
    client: { name: 'Partial Client' },
    items: [{ name: 'Router', desc: 'AX3000', qty: 4, unit: 'Pcs' }]
  });
  saveChallan({
    challanNumber: 'CH-PART-VOID',
    date: '2026-11-17',
    linkedInvoice: 'INV-PART-1',
    status: 'Void',
    client: { name: 'Partial Client' },
    items: [{ name: 'Router', desc: 'AX3000', qty: 6, unit: 'Pcs' }]
  });

  const ds1 = getInvoiceDispatchStats('INV-PART-1');
  const t1 = ok(ds1.challans.length === 1 && ds1.status === 'Partially Delivered', 'Excludes Void challan & marks Partially Delivered');
  const t2 = ok(ds1.totalOrderedQty === 15 && ds1.totalDispatchedQty === 4 && ds1.totalRemainingQty === 11, `Totals 15/4/11 accurate (got ${ds1.totalOrderedQty}/${ds1.totalDispatchedQty}/${ds1.totalRemainingQty})`);
  const t3 = ok(ds1.items[0].remainingQty === 6 && ds1.items[1].remainingQty === 5, 'Per-item remaining quantities accurate');

  saveChallan({
    challanNumber: 'CH-PART-2',
    date: '2026-11-18',
    linkedInvoice: 'INV-PART-1',
    client: { name: 'Partial Client' },
    items: [
      { name: 'Router', desc: 'AX3000', qty: 6, unit: 'Pcs' },
      { name: 'Cat6 Cable', desc: '100m Box', qty: 5, unit: 'Boxes' }
    ]
  });

  const ds2 = getInvoiceDispatchStats('INV-PART-1');
  const t4 = ok(ds2.challans.length === 2 && ds2.status === 'Fully Delivered' && ds2.totalRemainingQty === 0, 'Multi-challan linking marks Fully Delivered');
  const dsEdit = getInvoiceDispatchStats('INV-PART-1', 'CH-PART-2');
  const t5 = ok(dsEdit.totalRemainingQty === 11 && dsEdit.items[0].remainingQty === 6, 'Excluding edited challan restores remaining quantities');

  const slim = slimCompanySnapshot({ id: 'biller_2', name: 'Test Biller', taxId: '123', logoDataUri: 'data:image/png;base64,AAA', signatureDataUri: 'data:image/png;base64,BBB' });
  const t6 = ok(slim.id === 'biller_2' && slim.taxId === '123' && slim.logoDataUri === undefined && slim.signatureDataUri === undefined, 'slimCompanySnapshot strips Base64 media');

  // Duplicate identical (name, desc) rows on the same invoice distribute dispatched qty sequentially
  saveInvoice({
    invoiceNumber: 'INV-DUP-1',
    date: '2026-11-17',
    client: { name: 'Dup Client' },
    items: [
      { name: 'Router', desc: '', qty: 2, unit: 'Pcs', unitPrice: 1000 },
      { name: 'Router', desc: '', qty: 3, unit: 'Pcs', unitPrice: 1000 }
    ],
    grandTotal: 5000
  });
  saveChallan({
    challanNumber: 'CH-DUP-1',
    date: '2026-11-17',
    linkedInvoice: 'INV-DUP-1',
    client: { name: 'Dup Client' },
    items: [{ name: 'Router', desc: '', qty: 4, unit: 'Pcs' }]
  });
  const dsDup = getInvoiceDispatchStats('INV-DUP-1');
  const t7 = ok(dsDup.totalOrderedQty === 5 && dsDup.totalDispatchedQty === 4 && dsDup.totalRemainingQty === 1 && dsDup.items[0].remainingQty === 0 && dsDup.items[1].remainingQty === 1, `Duplicate (name,desc) rows split pool 2+2 (remaining 0 and 1, got ${dsDup.totalDispatchedQty}/${dsDup.totalRemainingQty})`);
  return [t1, t2, t3, t4, t5, t6, t7];
});
