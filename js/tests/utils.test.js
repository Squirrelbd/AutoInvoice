// Unit tests for utils.js

test('roundBDT rounds to 2 decimal places and avoids floating-point drift', () => {
  const t1 = ok(roundBDT(0.1 + 0.2) === 0.3, '0.1 + 0.2 rounded is exactly 0.3');
  const t2 = ok(roundBDT(10.005) === 10.01, '10.005 rounded to 2 decimals is exactly 10.01');
  const t3 = ok(roundBDT(3 * 0.33) === 0.99, '3 * 0.33 rounded is 0.99');
  return [t1, t2, t3];
});

test('escapeHTML prevents script injection', () => {
  const raw = '<script>alert("xss")</script>&"\'';
  const escaped = escapeHTML(raw);
  const t1 = ok(!escaped.includes('<script>'), 'Tag brackets escaped');
  const t2 = ok(escaped.includes('&lt;script&gt;'), 'Converted to HTML entities');
  const t3 = ok(escapeHTML(null) === '', 'null returns empty string');
  const t4 = ok(escapeHTML(undefined) === '', 'undefined returns empty string');
  const t5 = ok(escaped.includes('&quot;') && escaped.includes('&#39;'), 'Quotes converted to safe entities');
  return [t1, t2, t3, t4, t5];
});

test('formatBDT formats amounts with Lakh/Crore grouping (en-IN)', () => {
  const f1 = formatBDT(1500000);
  const t1 = ok(f1 === '৳15,00,000.00', `15 Lakh formatted as ৳15,00,000.00 (got ${f1})`);
  const f2 = formatBDT(100);
  const t2 = ok(f2 === '৳100.00', `100 formatted as ৳100.00 (got ${f2})`);
  const f3 = formatBDT(-500);
  const t3 = ok(f3 === '-৳500.00', `Negative 500 formatted as -৳500.00 (got ${f3})`);
  return [t1, t2, t3];
});

test('numberToWordsBDT handles standard and edge cases', () => {
  const w1 = numberToWordsBDT(500);
  const t1 = ok(w1 === 'Five Hundred Taka Only', `500 -> Five Hundred Taka Only (got ${w1})`);

  const w2 = numberToWordsBDT(-500);
  const t2 = ok(w2 === 'Negative Five Hundred Taka Only', `-500 -> Negative Five Hundred Taka Only (got ${w2})`);

  const w3 = numberToWordsBDT(1500000000);
  const t3 = ok(w3 === 'One Hundred Fifty Crore Taka Only', `150 Crore -> One Hundred Fifty Crore Taka Only (got ${w3})`);

  const w4 = numberToWordsBDT(99.999);
  const t4 = ok(w4 === 'One Hundred Taka Only', `99.999 rounded -> One Hundred Taka Only (got ${w4})`);

  const w5 = numberToWordsBDT(0);
  const t5 = ok(w5 === 'Zero Taka Only', `0 -> Zero Taka Only (got ${w5})`);

  const w6 = numberToWordsBDT(1234.50);
  const t6 = ok(w6.includes('Fifty Paisa'), `1234.50 includes Fifty Paisa (got ${w6})`);

  return [t1, t2, t3, t4, t5, t6];
});

test('slugify generates clean URL and filename-safe strings', () => {
  const s1 = slugify('Tech Solutions & Services Ltd.');
  const t1 = ok(s1 === 'tech-solutions-services-ltd', `Slug matches expected (got ${s1})`);
  const s2 = slugify('');
  const t2 = ok(s2 === '', 'Empty string produces empty slug');
  return [t1, t2];
});

test('generateSharePayload builds clean WhatsApp and Email URLs for all document types', () => {
  // 1. Invoice test
  const invPayload = generateSharePayload('invoice', {
    number: 'INV-2025-0042',
    date: '2025-10-24',
    dueDate: '2025-11-05',
    clientName: 'Acme Corp',
    clientPhone: '+880 1711-223344',
    clientEmail: 'billing@acme.com',
    total: 125000,
    due: 50000,
    billerName: 'Nexus Info Sys'
  });
  const t1 = ok(invPayload.whatsappUrl.startsWith('https://wa.me/8801711223344?text='), 'WhatsApp phone parsed to clean digits');
  const t2 = ok(invPayload.mailtoUrl.startsWith('mailto:billing%40acme.com?subject='), 'Mailto link has client email and encoded subject');
  const t3 = ok(invPayload.subject.includes('INV-2025-0042') && invPayload.subject.includes('Nexus Info Sys'), 'Subject contains invoice number and biller');
  const t4 = ok(invPayload.msg.includes('৳1,25,000.00') && invPayload.msg.includes('৳50,000.00'), 'Formatted BDT totals present in message');

  // 2. Quotation test
  const qtnPayload = generateSharePayload('quotation', {
    number: 'QTN-2025-0010',
    date: '2025-10-24',
    clientName: 'Stark Industries',
    total: 350000,
    billerName: 'Nexus Info Sys'
  });
  const t5 = ok(qtnPayload.whatsappUrl.startsWith('https://wa.me/?text='), 'WhatsApp URL defaults to generic link without phone');
  const t6 = ok(qtnPayload.msg.includes('Validity: 30 Days') && qtnPayload.msg.includes('৳3,50,000.00'), 'Quotation message has 30 days validity and formatted total');

  // 3. Challan test (shipping confidentiality: line items only, no money)
  const chalPayload = generateSharePayload('challan', {
    number: 'CH-2025-0005',
    date: '2025-10-24',
    clientName: 'Wayne Enterprises',
    items: [{ name: 'Server Rack', qty: 2 }, { name: 'Switch', qty: 4 }],
    billerName: 'Nexus Info Sys'
  });
  const t7 = ok(chalPayload.msg.includes('2 line item(s)'), 'Challan counts line items array accurately');
  const t8 = ok(!chalPayload.msg.includes('৳'), 'Challan message preserves pricing confidentiality');

  // 4. Receipt test
  const rcptPayload = generateSharePayload('receipt', {
    number: 'RCPT-2025-0015',
    date: '2025-10-24',
    clientName: 'Acme Corp',
    amount: 75000,
    paymentMethod: 'Bank Transfer',
    linkedInvoice: 'INV-2025-0042',
    due: 50000,
    billerName: 'Nexus Info Sys'
  });
  const t9 = ok(rcptPayload.msg.includes('৳75,000.00') && rcptPayload.msg.includes('Bank Transfer'), 'Receipt has received amount and method');
  const t10 = ok(rcptPayload.msg.includes('Invoice INV-2025-0042'), 'Receipt references linked invoice');
  const t11 = ok(rcptPayload.msg.includes('Remaining Due: ৳50,000.00'), 'Receipt references remaining due');

  return [t1, t2, t3, t4, t5, t6, t7, t8, t9, t10, t11];
});

test('sanitizeCsvCell neutralizes whitespace/tab formula injection & edge math helpers', () => {
  const win = document.getElementById('receiptFrame').contentWindow;
  const c1 = sanitizeCsvCell('\t=1+1');
  const c2 = sanitizeCsvCell('  +cmd|calc');
  const c3 = sanitizeCsvCell('=HYPERLINK("http://x")');
  const t1 = ok(c1.startsWith(`"'\t=`) && c2.startsWith(`"'  +`) && c3.startsWith(`"'=`), 'Tab, leading space, and formula cells neutralized');
  const t2 = ok(
    roundBDT(NaN) === 0 && roundBDT(Infinity) === 0 &&
    roundBDT(0.1 + 0.2 - 0.3) === 0 && roundBDT(10.10 + 20.20 - 30.30) === 0 &&
    roundBDT(1e-7) === 0 && roundBDT(-0.001) === 0,
    'roundBDT handles non-finite, sub-1e-6 scientific float drift, and zero safely'
  );
  const t3 = ok(formatBDT(-0.001) === '৳0.00', 'formatBDT never emits negative zero');
  const iso = toLocalISODate(new Date(2026, 9, 8));
  const t4 = ok(iso === '2026-10-08', `toLocalISODate formats local date accurately (got ${iso})`);
  const qr = buildQRPayload('INV', { number: 'INV-1', date: '2026-10-08', amount: 500, client: 'A|B=C', company: 'X' });
  const parsed = parseQRPayload(qr);
  const t5 = ok(parsed.valid && parsed.fields.REC === 'A B:C', 'QR builder sanitizes delimiters and parseQRPayload decodes V=1');
  return [t1, t2, t3, t4, t5];
});

