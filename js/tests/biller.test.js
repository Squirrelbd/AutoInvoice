// Unit tests for Multi-Biller Profiles and Sequence Isolation

test('loadBillers initializes with default biller profile', () => {
  localStorage.removeItem(STORAGE_KEYS.billers);
  localStorage.removeItem(STORAGE_KEYS.activeBillerId);
  const billers = loadBillers();
  const t1 = ok(Array.isArray(billers), 'Billers is an array');
  const t2 = ok(billers.length >= 1, 'Contains at least one biller');
  const def = billers[0];
  const t3 = ok(def.id === 'biller_default', 'Default biller ID is biller_default');
  const t4 = ok(def.name === COMPANY.name, 'Default biller name matches COMPANY.name');
  const t5 = ok(def.themeColor === '#0b3969', 'Default themeColor is #0b3969');
  const t6 = ok(def.isDefault === true, 'Default biller has isDefault=true');
  const t7 = ok(def.prefixes?.invoice === 'INV', 'Default invoice prefix is INV');
  return [t1, t2, t3, t4, t5, t6, t7];
});

test('saveBiller adds new biller with custom prefixes and theme', () => {
  const newBiller = {
    name: 'Apex Robotics & IoT Ltd',
    slogan: 'Precision Industrial Automation',
    address: 'Plot 42, Tejgaon I/A, Dhaka-1208',
    phone: '+8801811223344',
    email: 'billing@apexrobotics.io',
    website: 'https://apexrobotics.io',
    taxId: 'BIN-9988776655',
    logoDataUri: 'assets/logo.svg',
    themeColor: '#0b8f8f',
    prefixes: {
      invoice: 'APEX-INV',
      challan: 'APEX-CH',
      receipt: 'APEX-RCPT',
      quotation: 'APEX-QTN'
    },
    signatureLabels: {
      deliveredBy: 'Dispatched by Logistics',
      receivedBy: 'Received & Inspected by'
    },
    remittance: {
      bankName: 'BRAC Bank PLC',
      accountNo: '205184920001',
      bkash: '01711-000111'
    },
    isDefault: false
  };

  const saved = saveBiller(newBiller);
  const t1 = ok(saved.id.startsWith('biller_'), 'Saved biller has generated ID');
  const t2 = ok(saved.name === 'Apex Robotics & IoT Ltd', 'Name preserved');
  const t3 = ok(saved.prefixes.invoice === 'APEX-INV', 'Custom invoice prefix preserved');
  const t4 = ok(saved.themeColor === '#0b8f8f', 'Custom theme color preserved');

  const found = getBillerById(saved.id);
  const t5 = ok(found !== null, 'Biller found by ID');
  const t6 = ok(found && found.name === 'Apex Robotics & IoT Ltd', 'Retrieved name matches');
  const t7 = ok(found?.remittance?.bankName === 'BRAC Bank PLC' && found?.remittance?.bkash === '01711-000111', 'Biller bank/MFS remittance preserved by loadBillers');
  return [t1, t2, t3, t4, t5, t6, t7];
});

test('setActiveBillerId switches active profile and dispatches event', () => {
  const secondBiller = saveBiller({
    name: 'Apex Robotics & IoT Ltd',
    themeColor: '#0b8f8f',
    prefixes: { invoice: 'APEX-INV' },
    isDefault: false
  });
  const t1 = ok(secondBiller != null, 'Second biller created');

  let eventFired = false;
  let eventDetail = null;
  const handler = (e) => {
    eventFired = true;
    eventDetail = e.detail;
  };
  window.addEventListener('billerchange', handler);

  const success = setActiveBillerId(secondBiller.id);
  const t2 = ok(success === true, 'setActiveBillerId succeeded');
  const t3 = ok(getActiveBillerId() === secondBiller.id, 'getActiveBillerId returns second biller ID');
  const t4 = ok(getActiveBiller().name === 'Apex Robotics & IoT Ltd', 'getActiveBiller returns second profile');
  const t5 = ok(eventFired === true, 'billerchange custom event dispatched');
  const t6 = ok(eventDetail && eventDetail.billerId === secondBiller.id, 'Event carries billerId');

  window.removeEventListener('billerchange', handler);

  // Reset back to default
  setActiveBillerId('biller_default');
  const t7 = ok(getActiveBillerId() === 'biller_default', 'Active biller restored to default');
  return [t1, t2, t3, t4, t5, t6, t7];
});

test('deleteBiller removes profile but prevents deleting the sole remaining biller', () => {
  const target = saveBiller({
    name: 'Temp Biller To Delete',
    isDefault: false
  });
  const t1 = ok(target != null, 'Target biller created');

  const result = deleteBiller(target.id);
  const t2 = ok(result.success === true, 'Delete succeeded');
  const t3 = ok(getBillerById(target.id) === null, 'Deleted biller no longer exists');

  // Attempt to delete remaining biller
  const remaining = loadBillers();
  const t4 = ok(remaining.length === 1, 'Only 1 biller remaining');
  const deleteAttempt = deleteBiller(remaining[0].id);
  const t5 = ok(deleteAttempt.success === false, 'Cannot delete the only remaining biller');
  const t6 = ok(loadBillers().length === 1, 'Biller count remains 1');
  return [t1, t2, t3, t4, t5, t6];
});

test('different billers maintain isolated sequence counters and custom prefixes', () => {
  const currentYear = new Date().getFullYear();

  // Reset default sequences
  localStorage.removeItem(STORAGE_KEYS.lastInvoiceNo);
  localStorage.removeItem(`ai_seq_biller_default_invoice`);

  // Create a secondary biller with distinct prefix
  const techBiller = saveBiller({
    id: 'biller_tech_corp',
    name: 'Tech Corp Bangladesh',
    themeColor: '#2563eb',
    prefixes: { invoice: 'TECH', challan: 'TECH-CH', receipt: 'TECH-RC', quotation: 'TECH-QTN' },
    isDefault: false
  });

  // 1. Default Biller Peek and Finalize
  setActiveBillerId('biller_default');
  const defPeek1 = peekNextInvoiceNumber();
  const t1 = ok(defPeek1 === `INV-${currentYear}-0001`, `Default biller next is INV-${currentYear}-0001 (got ${defPeek1})`);
  finalizeInvoiceNumber(`INV-${currentYear}-0001`);
  const defPeek2 = peekNextInvoiceNumber();
  const t2 = ok(defPeek2 === `INV-${currentYear}-0002`, `Default biller advanced to INV-${currentYear}-0002 (got ${defPeek2})`);

  // 2. Tech Corp Biller Peek and Finalize
  setActiveBillerId(techBiller.id);
  const techPeek1 = peekNextInvoiceNumber();
  const t3 = ok(techPeek1 === `TECH-${currentYear}-0001`, `Tech biller next is TECH-${currentYear}-0001 (got ${techPeek1})`);
  finalizeInvoiceNumber(`TECH-${currentYear}-0001`, techBiller.id);
  const techPeek2 = peekNextInvoiceNumber();
  const t4 = ok(techPeek2 === `TECH-${currentYear}-0002`, `Tech biller advanced to TECH-${currentYear}-0002 (got ${techPeek2})`);

  // 3. Verify Default biller sequence was NOT affected by Tech Corp's increment
  setActiveBillerId('biller_default');
  const defPeekAfter = peekNextInvoiceNumber();
  const t5 = ok(defPeekAfter === `INV-${currentYear}-0002`, `Default biller sequence remained intact at 0002 (got ${defPeekAfter})`);

  // Cleanup
  deleteBiller(techBiller.id);
  return [t1, t2, t3, t4, t5];
});

test('Biller digital signature persistence, sanitization, and clearing', () => {
  const sampleBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

  // 1. Save biller with signature, signatory name, and title
  const signedBiller = saveBiller({
    name: 'Signed Engineering Solutions',
    signatureDataUri: sampleBase64,
    signatoryName: 'Engr. Amirul Islam',
    signatoryTitle: 'Lead Architect & MD',
    isDefault: false
  });

  const t1 = ok(signedBiller != null, 'Biller with signature created');
  const t2 = ok(signedBiller.signatureDataUri === sampleBase64, 'signatureDataUri persisted exactly');
  const t3 = ok(signedBiller.signatoryName === 'Engr. Amirul Islam', 'signatoryName persisted');
  const t4 = ok(signedBiller.signatoryTitle === 'Lead Architect & MD', 'signatoryTitle persisted');

  // 2. Unsafe signature URI sanitization
  const evilBiller = saveBiller({
    name: 'Sanitization Test Biller',
    signatureDataUri: 'javascript:alert("pwned")',
    isDefault: false
  });
  const t5 = ok(evilBiller.signatureDataUri === '', 'Unsafe javascript: scheme sanitized to empty string');

  const traversalBiller = saveBiller({
    name: 'Traversal Test Biller',
    signatureDataUri: '../secret/sig.png',
    isDefault: false
  });
  const t6 = ok(traversalBiller.signatureDataUri === '', 'Path traversal URI sanitized to empty string');

  // 3. Updating other fields preserves existing signature
  const updatedBiller = saveBiller({
    id: signedBiller.id,
    name: 'Signed Engineering Solutions Updated',
    slogan: 'New Slogan'
  });
  const t7 = ok(updatedBiller.signatureDataUri === sampleBase64, 'Existing signatureDataUri preserved when not passed in update');
  const t8 = ok(updatedBiller.signatoryName === 'Engr. Amirul Islam', 'Existing signatoryName preserved');

  // 4. Explicitly clearing signature
  const clearedBiller = saveBiller({
    id: signedBiller.id,
    name: 'Signed Engineering Solutions Updated',
    signatureDataUri: '',
    signatoryName: '',
    signatoryTitle: ''
  });
  const t9 = ok(clearedBiller.signatureDataUri === '', 'Explicit empty string clears signature');
  const t10 = ok(clearedBiller.signatoryName === '', 'signatoryName cleared');

  // Cleanup
  deleteBiller(signedBiller.id);
  deleteBiller(evilBiller.id);
  deleteBiller(traversalBiller.id);

  return [t1, t2, t3, t4, t5, t6, t7, t8, t9, t10];
});
