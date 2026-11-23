// LocalStorage-based persistence utilities
// Stores last numbers and full records for invoices and challans

let _forceNextSyncPrune = false;

function _isTestEnvironment() {
  try {
    if (typeof window === 'undefined') return true;
    if (window.__IS_AUTOINVOICE_TESTING__) return true;
    if (window.parent && window.parent !== window && window.parent.__IS_AUTOINVOICE_TESTING__) return true;
    if (window.top && window.top !== window && window.top.__IS_AUTOINVOICE_TESTING__) return true;
    if (window.location && /\/tests\/tests\.html/i.test(window.location.pathname || '')) return true;
    if (window.parent && window.parent !== window && window.parent.location && /\/tests\/tests\.html/i.test(window.parent.location.pathname || '')) return true;
  } catch (_) { }
  return false;
}

function _localToday(d = new Date()) {
  if (typeof toLocalISODate === 'function') return toLocalISODate(d);
  const dt = d instanceof Date ? d : new Date(d);
  if (isNaN(dt.getTime())) return '';
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function _parseLocalDate(str) {
  if (typeof parseLocalISODate === 'function') return parseLocalISODate(str);
  if (!str || typeof str !== 'string') return null;
  const parts = str.trim().slice(0, 10).split('-');
  if (parts.length !== 3) return null;
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10) - 1;
  const d = parseInt(parts[2], 10);
  if (isNaN(y) || isNaN(m) || isNaN(d)) return null;
  const dt = new Date(y, m, d);
  return isNaN(dt.getTime()) ? null : dt;
}

function _safeHexColor(c) {
  const s = String(c || '').trim();
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(s) ? s : '#0b3969';
}

function _safeLogoUri(u) {
  const s = String(u || '').trim();
  if (!s || s.includes('..')) return 'assets/logo.svg';
  if (/^(assets\/[a-z0-9_.\-\/]+\.(svg|png|jpe?g|webp|ico))$/i.test(s)) return s;
  if (/^data:image\/(png|jpeg|jpg|webp|svg\+xml);base64,[a-z0-9+/=]+$/i.test(s)) return s;
  return 'assets/logo.svg';
}

function _safeSignatureUri(u) {
  const s = String(u || '').trim();
  if (!s || s.includes('..')) return '';
  if (/^(assets\/[a-z0-9_.\-\/]+\.(svg|png|jpe?g|webp|ico))$/i.test(s)) return s;
  if (/^data:image\/(png|jpeg|jpg|webp|svg\+xml);base64,[a-z0-9+/=\s]+$/i.test(s)) return s.replace(/\s+/g, '');
  return '';
}

function sanitizeRecord(val, depth = 0) {
  if (depth > 10) return val;
  if (typeof val === 'string') {
    return val.trim().slice(0, 10000);
  }
  if (typeof val === 'number') {
    return isFinite(val) ? val : 0;
  }
  if (Array.isArray(val)) {
    return val.map(item => sanitizeRecord(item, depth + 1));
  }
  if (val && typeof val === 'object') {
    const clean = {};
    for (const [k, v] of Object.entries(val)) {
      clean[k] = sanitizeRecord(v, depth + 1);
    }
    return clean;
  }
  return val;
}

function getStorageUsage() {
  let totalBytes = 0;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      const v = localStorage.getItem(k);
      if (k && v) {
        totalBytes += (k.length + v.length) * 2;
      }
    }
  } catch (e) {
    console.warn('Failed to calculate storage usage', e);
  }
  return totalBytes;
}

function showStorageQuotaWarning(percent, bytes) {
  if (typeof document === 'undefined') return;
  let banner = document.getElementById('storageQuotaBanner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'storageQuotaBanner';
    banner.className = 'alert alert-warning alert-dismissible fade show m-3 no-print';
    banner.setAttribute('role', 'alert');
    const header = document.querySelector('header') || document.querySelector('.container') || document.body;
    header.parentNode.insertBefore(banner, header);
  }
  banner.innerHTML = `
    <strong>Storage Warning:</strong> Local storage is ${percent.toFixed(0)}% full (${(bytes / 1024).toFixed(0)} KB used). 
    Please export your records via Download JSON or backup to prevent data loss.
    <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
  `;
}

function checkStorageQuota() {
  const bytes = getStorageUsage();
  const limit = 5 * 1024 * 1024; // 5MB standard localStorage quota
  const percent = (bytes / limit) * 100;
  if (percent >= 80) {
    console.warn(`Storage quota alert: ${percent.toFixed(1)}% used (${(bytes / 1024).toFixed(1)} KB)`);
    showStorageQuotaWarning(percent, bytes);
  }
}

function _collectAllSequenceKeys() {
  const sequences = {};
  const legacySeqKeys = [
    STORAGE_KEYS.lastInvoiceNo,
    STORAGE_KEYS.lastChallanNo,
    STORAGE_KEYS.lastReceiptNo,
    STORAGE_KEYS.lastQuotationNo,
    STORAGE_KEYS.lastExpenseNo
  ].filter(Boolean);
  for (const lk of legacySeqKeys) {
    const val = _readJSON(lk, null);
    if (val) sequences[lk] = val;
  }
  try {
    if (typeof localStorage !== 'undefined') {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('ai_seq_')) {
          const val = _readJSON(k, null);
          if (val) sequences[k] = val;
        }
      }
    }
  } catch (e) { }
  return sequences;
}

function exportAllData() {
  const backup = {
    version: 1,
    exportedAt: new Date().toISOString(),
    invoices: loadInvoices(),
    challans: loadChallans(),
    receipts: loadReceipts(),
    quotations: loadQuotations(),
    expenses: typeof loadExpenses === 'function' ? loadExpenses() : [],
    expenseCategories: typeof loadExpenseCategories === 'function' ? loadExpenseCategories() : [],
    clients: loadClients(),
    items: loadItems(),
    billers: loadBillers(),
    activeBillerId: getActiveBillerId(),
    lastInvoiceNo: _readJSON(STORAGE_KEYS.lastInvoiceNo, null),
    lastChallanNo: _readJSON(STORAGE_KEYS.lastChallanNo, null),
    lastReceiptNo: _readJSON(STORAGE_KEYS.lastReceiptNo, null),
    lastQuotationNo: _readJSON(STORAGE_KEYS.lastQuotationNo, null),
    lastExpenseNo: _readJSON(STORAGE_KEYS.lastExpenseNo, null),
    sequences: _collectAllSequenceKeys()
  };
  const jsonStr = JSON.stringify(backup, null, 2);
  if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function' && typeof Blob !== 'undefined') {
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `autoinvoice_full_backup_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }
  return backup;
}

function importAllData(jsonStr, options = {}) {
  let data;
  try {
    data = typeof jsonStr === 'string' ? JSON.parse(jsonStr) : jsonStr;
  } catch (e) {
    throw new Error('Invalid JSON format: ' + e.message);
  }

  if (!data || typeof data !== 'object') {
    throw new Error('Backup file must contain a valid JSON object.');
  }

  const isMerge = !!(options && options.mode === 'merge');

  function _mergeByKey(existingArr, incomingArr, keyFn) {
    const out = [];
    const indexByKey = new Map();
    const pushItem = (item) => {
      if (!item || typeof item !== 'object') return;
      const k = String(keyFn(item) || '').trim();
      if (!k) {
        out.push(item);
        return;
      }
      if (indexByKey.has(k)) {
        out[indexByKey.get(k)] = item;
      } else {
        indexByKey.set(k, out.length);
        out.push(item);
      }
    };
    (Array.isArray(existingArr) ? existingArr : []).forEach(pushItem);
    (Array.isArray(incomingArr) ? incomingArr : []).forEach(pushItem);
    return out;
  }

  function _mergeStringList(existingArr, incomingArr) {
    const out = [];
    const seen = new Set();
    [...(Array.isArray(existingArr) ? existingArr : []), ...(Array.isArray(incomingArr) ? incomingArr : [])].forEach(val => {
      const s = String(val || '').trim();
      const k = s.toLowerCase();
      if (s && !seen.has(k)) {
        seen.add(k);
        out.push(s);
      }
    });
    return out;
  }

  const counts = {
    mode: isMerge ? 'merge' : 'replace',
    invoices: Array.isArray(data.invoices) ? data.invoices.length : 0,
    challans: Array.isArray(data.challans) ? data.challans.length : 0,
    receipts: Array.isArray(data.receipts) ? data.receipts.length : 0,
    quotations: Array.isArray(data.quotations) ? data.quotations.length : 0,
    expenses: Array.isArray(data.expenses) ? data.expenses.length : 0,
    clients: Array.isArray(data.clients) ? data.clients.length : 0,
    items: Array.isArray(data.items) ? data.items.length : 0,
    billers: Array.isArray(data.billers) ? data.billers.length : 0
  };

  function _parseSeqObj(val) {
    if (!val) return null;
    if (typeof val === 'string') {
      try { return JSON.parse(val); } catch (e) { return null; }
    }
    return typeof val === 'object' ? val : null;
  }

  function _mergeMaxSequence(key, importedRaw) {
    const importedSeq = _parseSeqObj(importedRaw);
    if (!importedSeq || typeof importedSeq !== 'object') return;
    const current = _readJSON(key, null);
    if (!current) {
      _writeJSON(key, importedSeq);
      return;
    }
    const curYear = Number(current.year) || 0;
    const curSeq = Number(current.seq) || 0;
    const impYear = Number(importedSeq.year) || 0;
    const impSeq = Number(importedSeq.seq) || 0;
    if (impYear > curYear || (impYear === curYear && impSeq > curSeq)) {
      _writeJSON(key, importedSeq);
    }
  }

  if (Array.isArray(data.billers)) {
    const nextBillers = isMerge ? _mergeByKey(_readJSON(STORAGE_KEYS.billers, []), data.billers, b => b.id) : data.billers;
    _writeJSON(STORAGE_KEYS.billers, nextBillers);
  }
  const settings = (data.settings && typeof data.settings === 'object') ? data.settings : {};
  const activeId = data.activeBillerId || settings.activeBillerId;
  if (activeId && (!isMerge || (typeof localStorage !== 'undefined' && !localStorage.getItem(STORAGE_KEYS.activeBillerId)))) {
    if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEYS.activeBillerId, String(activeId));
  }

  if (Array.isArray(data.invoices)) {
    const nextInvoices = isMerge ? _mergeByKey(_readJSON(STORAGE_KEYS.invoices, []), data.invoices, x => x.invoiceNumber || x.number || x.id) : data.invoices;
    _writeJSON(STORAGE_KEYS.invoices, nextInvoices);
    nextInvoices.forEach(inv => {
      const num = inv.invoiceNumber || inv.number;
      if (num && typeof finalizeInvoiceNumber === 'function') finalizeInvoiceNumber(num, inv.billerId);
    });
  }
  if (Array.isArray(data.challans)) {
    const nextChallans = isMerge ? _mergeByKey(_readJSON(STORAGE_KEYS.challans, []), data.challans, x => x.challanNumber || x.number || x.id) : data.challans;
    _writeJSON(STORAGE_KEYS.challans, nextChallans);
    nextChallans.forEach(ch => {
      const num = ch.challanNumber || ch.number;
      if (num && typeof finalizeChallanNumber === 'function') finalizeChallanNumber(num, ch.billerId);
    });
  }
  if (Array.isArray(data.receipts)) {
    const nextReceipts = isMerge ? _mergeByKey(_readJSON(STORAGE_KEYS.receipts, []), data.receipts, x => x.receiptNumber || x.number || x.id) : data.receipts;
    _writeJSON(STORAGE_KEYS.receipts, nextReceipts);
    nextReceipts.forEach(rc => {
      const num = rc.receiptNumber || rc.number;
      if (num && typeof finalizeReceiptNumber === 'function') finalizeReceiptNumber(num, rc.billerId);
    });
  }
  if (Array.isArray(data.quotations)) {
    const nextQuotations = isMerge ? _mergeByKey(_readJSON(STORAGE_KEYS.quotations, []), data.quotations, x => x.quotationNumber || x.number || x.id) : data.quotations;
    _writeJSON(STORAGE_KEYS.quotations, nextQuotations);
    nextQuotations.forEach(qtn => {
      const num = qtn.quotationNumber || qtn.number;
      if (num && typeof finalizeQuotationNumber === 'function') finalizeQuotationNumber(num, qtn.billerId);
    });
  }
  if (Array.isArray(data.expenses)) {
    const nextExpenses = isMerge ? _mergeByKey(_readJSON(STORAGE_KEYS.expenses, []), data.expenses, x => x.id || x.expenseNumber) : data.expenses;
    _writeJSON(STORAGE_KEYS.expenses, nextExpenses);
    nextExpenses.forEach(exp => {
      const num = exp.id || exp.expenseNumber;
      if (num && typeof finalizeExpenseNumber === 'function') finalizeExpenseNumber(num, exp.billerId);
    });
  }
  if (Array.isArray(data.expenseCategories)) {
    const nextCats = isMerge ? _mergeStringList(_readJSON(STORAGE_KEYS.expenseCategories, []), data.expenseCategories) : data.expenseCategories;
    _writeJSON(STORAGE_KEYS.expenseCategories, nextCats);
  }
  if (Array.isArray(data.clients)) {
    const nextClients = isMerge ? _mergeByKey(_readJSON(STORAGE_KEYS.clients, []), data.clients, c => String(c.name || '').trim().toLowerCase()) : data.clients;
    _writeJSON(STORAGE_KEYS.clients, nextClients);
    try { if (typeof localStorage !== 'undefined') localStorage.setItem('ai_clients_seeded', '1'); } catch (_) { }
  }
  if (Array.isArray(data.items)) {
    const nextItems = isMerge ? _mergeByKey(_readJSON(STORAGE_KEYS.items, []), data.items, it => it.id || String(it.name || '').trim().toLowerCase()) : data.items;
    _writeJSON(STORAGE_KEYS.items, nextItems);
    try { if (typeof localStorage !== 'undefined') localStorage.setItem('ai_items_seeded', '1'); } catch (_) { }
  }

  const lastInv = data.lastInvoiceNo ?? settings.lastInvoiceNo;
  const lastCh = data.lastChallanNo ?? settings.lastChallanNo;
  const lastRcpt = data.lastReceiptNo ?? settings.lastReceiptNo;
  const lastQtn = data.lastQuotationNo ?? settings.lastQuotationNo;
  const lastExp = data.lastExpenseNo ?? settings.lastExpenseNo;

  if (lastInv != null) _mergeMaxSequence(STORAGE_KEYS.lastInvoiceNo, lastInv);
  if (lastCh != null) _mergeMaxSequence(STORAGE_KEYS.lastChallanNo, lastCh);
  if (lastRcpt != null) _mergeMaxSequence(STORAGE_KEYS.lastReceiptNo, lastRcpt);
  if (lastQtn != null) _mergeMaxSequence(STORAGE_KEYS.lastQuotationNo, lastQtn);
  if (lastExp != null) _mergeMaxSequence(STORAGE_KEYS.lastExpenseNo, lastExp);

  const seqMap = data.sequences || _parseSeqObj(settings.sequences);
  if (seqMap && typeof seqMap === 'object') {
    for (const [k, v] of Object.entries(seqMap)) {
      if (k.startsWith('ai_seq_')) _mergeMaxSequence(k, v);
    }
  }

  if (!isMerge) _forceNextSyncPrune = true;
  return counts;
}

function clearAllData(options = {}) {
  const { preserveTheme = true } = options;
  const savedTheme = preserveTheme && typeof localStorage !== 'undefined' ? localStorage.getItem('ai_theme') : null;

  try {
    if (typeof localStorage !== 'undefined') {
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && (
          k.startsWith('ai_') ||
          k.startsWith('invoice_') ||
          k.startsWith('challan_') ||
          k.startsWith('receipt_') ||
          k.startsWith('quotation_') ||
          k.startsWith('statement_') ||
          k === 'last_client'
        )) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));
    }

    if (savedTheme && typeof localStorage !== 'undefined') {
      localStorage.setItem('ai_theme', savedTheme);
    }

    // Re-initialize default clean biller profile
    const def = createDefaultBiller();
    _writeJSON(STORAGE_KEYS.billers, [def]);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.activeBillerId, def.id);
    }

    // Call server disk reset endpoint if available (never from isolated unit tests)
    if (!_isTestEnvironment() && typeof fetch === 'function') {
      fetch('/api/clear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-AutoInvoice-Action': 'confirm' },
        body: '{}'
      }).catch(() => { });
    }

    // Notify components of state reset
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new CustomEvent('billerchange', { detail: { billerId: def.id } }));
      window.dispatchEvent(new CustomEvent('storagesync', { detail: { action: 'clear' } }));
    }

    return true;
  } catch (e) {
    console.error('Failed to clear data', e);
    return false;
  }
}

function _readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch (e) {
    console.warn("Failed to parse storage for", key, e);
    return fallback;
  }
}

function _writeJSON(key, obj, options) {
  try {
    localStorage.setItem(key, JSON.stringify(obj));
    checkStorageQuota();
    if ((!options || !options.skipSync) && typeof scheduleSQLiteSync === 'function') {
      scheduleSQLiteSync();
    }
  } catch (e) {
    console.error("Failed to write storage for", key, e);
    if (e.name === 'QuotaExceededError' || e.code === 22) {
      if (typeof showToast === 'function') {
        showToast('Local storage is full! Please export records and clear space to avoid losing data.', 'danger');
      } else if (typeof alert === 'function') {
        alert('Local storage is full! Please export records and clear space to avoid losing data.');
      }
    }
  }
}

// ==========================================
// Multi-Biller Management & Active Profiles
// ==========================================

function createDefaultBiller() {
  const p = (typeof NUMBER_FORMATS !== 'undefined') ? NUMBER_FORMATS : { invoicePrefix: 'INV', challanPrefix: 'CH', receiptPrefix: 'RCPT', quotationPrefix: 'QTN' };
  const c = (typeof COMPANY !== 'undefined') ? COMPANY : {};
  return {
    id: 'biller_default',
    name: c.name || "Amirul Islam",
    slogan: c.slogan || "Freelance Embedded Systems Service provider",
    address: c.address || "Banasree, Rampura, Dhaka, Bangladesh",
    phone: c.phone || (c.contacts?.[0] || "+8801747144755"),
    email: c.email || "mahadi.ma.ak@gmail.com",
    website: c.website || "",
    taxId: c.taxId || "",
    logoDataUri: c.logoPath || "assets/logo.svg",
    signatureDataUri: c.signatureDataUri || "",
    signatoryName: c.signatoryName || "",
    signatoryTitle: c.signatoryTitle || "",
    themeColor: c.themeColor || "#0b3969",
    prefixes: {
      invoice: p.invoicePrefix || "INV",
      challan: p.challanPrefix || "CH",
      receipt: p.receiptPrefix || "RCPT",
      quotation: p.quotationPrefix || "QTN",
      expense: p.expensePrefix || "EXP",
    },
    signatureLabels: {
      deliveredBy: c.signatureLabels?.deliveredBy || "Delivered by",
      receivedBy: c.signatureLabels?.receivedBy || "Received by",
      authorizedBy: c.signatureLabels?.authorizedBy || "Authorized Signature",
    },
    remittance: {
      bankName: '',
      accountName: '',
      accountNo: '',
      branch: '',
      routingNo: '',
      bkash: '',
      nagad: '',
      rocket: '',
      instructions: ''
    },
    isDefault: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

function loadBillers() {
  let list = _readJSON(STORAGE_KEYS.billers, []);
  if (!Array.isArray(list) || list.length === 0) {
    const def = createDefaultBiller();
    list = [def];
    _writeJSON(STORAGE_KEYS.billers, list, { skipSync: true });
    return list;
  }
  let hasDefault = false;
  list = list.map(b => {
    if (b.isDefault) hasDefault = true;
    const rem = b.remittance || {};
    return {
      id: b.id || `biller_${Date.now()}`,
      name: b.name || 'Unnamed Biller',
      slogan: b.slogan || '',
      address: b.address || '',
      phone: b.phone || '',
      email: b.email || '',
      website: b.website || '',
      taxId: b.taxId || '',
      logoDataUri: _safeLogoUri(b.logoDataUri || b.logoPath),
      signatureDataUri: _safeSignatureUri(b.signatureDataUri),
      signatoryName: String(b.signatoryName || '').trim(),
      signatoryTitle: String(b.signatoryTitle || '').trim(),
      themeColor: _safeHexColor(b.themeColor),
      prefixes: {
        invoice: b.prefixes?.invoice || 'INV',
        challan: b.prefixes?.challan || 'CH',
        receipt: b.prefixes?.receipt || 'RCPT',
        quotation: b.prefixes?.quotation || 'QTN',
        expense: b.prefixes?.expense || 'EXP'
      },
      signatureLabels: {
        deliveredBy: b.signatureLabels?.deliveredBy || 'Delivered by',
        receivedBy: b.signatureLabels?.receivedBy || 'Received by',
        authorizedBy: b.signatureLabels?.authorizedBy || 'Authorized Signature'
      },
      remittance: {
        bankName: String(rem.bankName || '').trim(),
        accountName: String(rem.accountName || '').trim(),
        accountNo: String(rem.accountNo || '').trim(),
        branch: String(rem.branch || '').trim(),
        routingNo: String(rem.routingNo || '').trim(),
        bkash: String(rem.bkash || '').trim(),
        nagad: String(rem.nagad || '').trim(),
        rocket: String(rem.rocket || '').trim(),
        instructions: String(rem.instructions || '').trim()
      },
      isDefault: !!b.isDefault,
      createdAt: b.createdAt || new Date().toISOString(),
      updatedAt: b.updatedAt || new Date().toISOString()
    };
  });
  if (!hasDefault && list.length > 0) {
    list[0].isDefault = true;
    _writeJSON(STORAGE_KEYS.billers, list);
  }
  return list;
}

function getBillerById(id) {
  if (!id) return null;
  return loadBillers().find(b => b.id === id) || null;
}

function getActiveBillerId() {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.activeBillerId);
    if (stored) {
      const match = loadBillers().find(b => b.id === stored);
      if (match) return stored;
    }
  } catch (e) {
    console.warn('Failed to read activeBillerId', e);
  }
  const billers = loadBillers();
  const def = billers.find(b => b.isDefault) || billers[0];
  return def ? def.id : 'biller_default';
}

function getActiveBiller() {
  const id = getActiveBillerId();
  return getBillerById(id) || loadBillers()[0] || createDefaultBiller();
}

function setActiveBillerId(id) {
  const biller = getBillerById(id);
  if (!biller) return false;
  try {
    localStorage.setItem(STORAGE_KEYS.activeBillerId, id);
    if (typeof applyBillerTheme === 'function') {
      applyBillerTheme(biller);
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('billerchange', { detail: { billerId: id, biller } }));
    }
    return true;
  } catch (e) {
    console.warn('Failed to set active biller', e);
    return false;
  }
}

function saveBiller(biller) {
  if (!biller || !biller.name || typeof biller.name !== 'string') {
    throw new Error('Biller name is required.');
  }
  const list = loadBillers();
  const now = new Date().toISOString();
  const id = biller.id || `biller_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const idx = list.findIndex(b => b.id === id);
  const existing = idx >= 0 ? (list[idx] || {}) : {};
  const isDefault = !!biller.isDefault;
  const remSrc = biller.remittance || existing.remittance || {};
  const remittance = {
    bankName: String(remSrc.bankName || '').trim(),
    accountName: String(remSrc.accountName || '').trim(),
    accountNo: String(remSrc.accountNo || '').trim(),
    branch: String(remSrc.branch || '').trim(),
    routingNo: String(remSrc.routingNo || '').trim(),
    bkash: String(remSrc.bkash || '').trim(),
    nagad: String(remSrc.nagad || '').trim(),
    rocket: String(remSrc.rocket || '').trim(),
    instructions: String(remSrc.instructions || '').trim()
  };

  const entry = {
    id,
    name: biller.name.trim(),
    slogan: (biller.slogan || '').trim(),
    address: (biller.address || '').trim(),
    phone: (biller.phone || '').trim(),
    email: (biller.email || '').trim(),
    website: (biller.website || '').trim(),
    taxId: (biller.taxId || '').trim(),
    logoDataUri: _safeLogoUri(biller.logoDataUri || biller.logoPath),
    signatureDataUri: biller.signatureDataUri !== undefined
      ? _safeSignatureUri(biller.signatureDataUri)
      : (existing.signatureDataUri || ''),
    signatoryName: (biller.signatoryName !== undefined ? biller.signatoryName : (existing.signatoryName || '')).trim(),
    signatoryTitle: (biller.signatoryTitle !== undefined ? biller.signatoryTitle : (existing.signatoryTitle || '')).trim(),
    themeColor: _safeHexColor(biller.themeColor),
    prefixes: {
      invoice: (biller.prefixes?.invoice || 'INV').trim(),
      challan: (biller.prefixes?.challan || 'CH').trim(),
      receipt: (biller.prefixes?.receipt || 'RCPT').trim(),
      quotation: (biller.prefixes?.quotation || 'QTN').trim(),
      expense: (biller.prefixes?.expense || 'EXP').trim()
    },
    signatureLabels: {
      deliveredBy: (biller.signatureLabels?.deliveredBy || 'Delivered by').trim(),
      receivedBy: (biller.signatureLabels?.receivedBy || 'Received by').trim(),
      authorizedBy: (biller.signatureLabels?.authorizedBy || 'Authorized Signature').trim()
    },
    remittance,
    isDefault,
    createdAt: biller.createdAt || existing.createdAt || now,
    updatedAt: now
  };

  if (isDefault) {
    list.forEach(b => { b.isDefault = false; });
  }

  if (idx >= 0) {
    list[idx] = entry;
  } else {
    if (list.length === 0) entry.isDefault = true;
    list.push(entry);
  }

  _forceNextSyncPrune = true;
  _writeJSON(STORAGE_KEYS.billers, list, { skipSync: true });
  _persistBillersToDisk(list);
  if (typeof _flushSQLiteSyncNow === 'function') _flushSQLiteSyncNow();
  return entry;
}

function _persistBillersToDisk(list) {
  if (_isTestEnvironment()) {
    return;
  }
  if (typeof fetch === 'function' && typeof window !== 'undefined' && window.location?.protocol?.startsWith('http')) {
    fetch('/api/billers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-AutoInvoice-Action': 'save-billers' },
      body: JSON.stringify(list)
    }).catch(e => { });
  }
}

async function syncBillersFromDisk() {
  if (_isTestEnvironment()) return;
  if (typeof fetch !== 'function' || typeof window === 'undefined' || !window.location?.protocol?.startsWith('http')) {
    return;
  }
  try {
    const res = await fetch('/api/billers', { cache: 'no-store' });
    if (!res.ok) return;
    const diskBillers = await res.json();
    if (!Array.isArray(diskBillers) || diskBillers.length === 0) return;

    const localList = _readJSON(STORAGE_KEYS.billers, []);
    let changed = false;
    const merged = [...localList];

    diskBillers.forEach(db => {
      const idx = merged.findIndex(b => b.id === db.id);
      if (idx === -1) {
        merged.push(db);
        changed = true;
      }
    });

    if (changed || localList.length === 0) {
      _writeJSON(STORAGE_KEYS.billers, merged);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('billerchange', { detail: { billerId: getActiveBillerId() } }));
      }
    }
  } catch (e) { }
}

function deleteBiller(id) {
  if (!id) return { success: false, error: 'Biller ID required' };
  const list = loadBillers();
  if (list.length <= 1) {
    return { success: false, error: 'Cannot delete the only remaining biller profile.' };
  }
  const idx = list.findIndex(b => b.id === id);
  if (idx < 0) {
    return { success: false, error: 'Biller profile not found.' };
  }
  const wasDefault = list[idx].isDefault;
  const removed = list.splice(idx, 1)[0];
  if (wasDefault && list.length > 0) {
    list[0].isDefault = true;
  }
  _forceNextSyncPrune = true;
  _writeJSON(STORAGE_KEYS.billers, list, { skipSync: true });
  _persistBillersToDisk(list);
  if (typeof _flushSQLiteSyncNow === 'function') _flushSQLiteSyncNow();

  if (getActiveBillerId() === id) {
    const nextActive = list.find(b => b.isDefault) || list[0];
    if (nextActive) setActiveBillerId(nextActive.id);
  }
  return { success: true, removed };
}

// Sequence key helper with backward compatibility
function _getBillerSeqKey(type, billerId, prefix) {
  const bId = billerId || getActiveBillerId() || 'biller_default';
  const defaultPrefix = (typeof NUMBER_FORMATS !== 'undefined' && NUMBER_FORMATS[type + 'Prefix']) || '';
  const isDefaultBiller = (bId === 'biller_default' || !billerId);
  const isDefaultPrefix = (!prefix || prefix === defaultPrefix);

  if (isDefaultBiller && isDefaultPrefix) {
    if (type === 'invoice') return STORAGE_KEYS.lastInvoiceNo;
    if (type === 'challan') return STORAGE_KEYS.lastChallanNo;
    if (type === 'receipt') return STORAGE_KEYS.lastReceiptNo;
    if (type === 'quotation') return STORAGE_KEYS.lastQuotationNo;
    if (type === 'expense') return STORAGE_KEYS.lastExpenseNo;
  }
  return `ai_seq_${bId}_${type}`;
}

function _findBillerByPrefix(type, prefix) {
  if (!prefix) return null;
  const target = String(prefix).trim().toLowerCase();
  const billers = loadBillers();
  return billers.find(b => (b.prefixes?.[type] || '').trim().toLowerCase() === target) || null;
}

// Next numbers (Isolated per biller)
function getNextInvoiceNumber(billerId) {
  const b = (billerId && getBillerById(billerId)) || getActiveBiller();
  const prefix = (b?.prefixes?.invoice || NUMBER_FORMATS.invoicePrefix || 'INV').trim();
  const key = _getBillerSeqKey('invoice', b?.id, prefix);
  const year = new Date().getFullYear();
  let last = _readJSON(key, { year, seq: 0 });
  if (last.year !== year) last = { year, seq: 0 };
  last.seq += 1;
  _writeJSON(key, last);
  const padded = String(last.seq).padStart(4, "0");
  return `${prefix}-${year}-${padded}`;
}

function peekNextInvoiceNumber(billerId) {
  const b = (billerId && getBillerById(billerId)) || getActiveBiller();
  const prefix = (b?.prefixes?.invoice || NUMBER_FORMATS.invoicePrefix || 'INV').trim();
  const key = _getBillerSeqKey('invoice', b?.id, prefix);
  const year = new Date().getFullYear();
  let last = _readJSON(key, { year, seq: 0 });
  if (last.year !== year) last = { year, seq: 0 };
  const padded = String(last.seq + 1).padStart(4, "0");
  return `${prefix}-${year}-${padded}`;
}

function finalizeInvoiceNumber(no, billerId) {
  if (!no) return;
  try {
    const parts = String(no).split('-');
    if (parts.length < 3) return;
    const prefix = parts.slice(0, parts.length - 2).join('-');
    const year = Number(parts[parts.length - 2]) || new Date().getFullYear();
    const seq = Number(parts[parts.length - 1]) || 0;
    if (!seq) return;
    const b = (billerId && getBillerById(billerId)) || _findBillerByPrefix('invoice', prefix) || getActiveBiller();
    const key = _getBillerSeqKey('invoice', b?.id, prefix);
    let last = _readJSON(key, { year, seq: 0 });
    if (last.year > year) return;
    if (last.year === year && seq <= last.seq) return;
    _writeJSON(key, { year, seq });
  } catch (e) {
    console.warn('Failed to finalize invoice number', e);
  }
}

function getNextChallanNumber(billerId) {
  const b = (billerId && getBillerById(billerId)) || getActiveBiller();
  const prefix = (b?.prefixes?.challan || NUMBER_FORMATS.challanPrefix || 'CH').trim();
  const key = _getBillerSeqKey('challan', b?.id, prefix);
  const year = new Date().getFullYear();
  let last = _readJSON(key, { year, seq: 0 });
  if (last.year !== year) last = { year, seq: 0 };
  last.seq += 1;
  _writeJSON(key, last);
  const padded = String(last.seq).padStart(4, "0");
  return `${prefix}-${year}-${padded}`;
}

function peekNextChallanNumber(billerId) {
  const b = (billerId && getBillerById(billerId)) || getActiveBiller();
  const prefix = (b?.prefixes?.challan || NUMBER_FORMATS.challanPrefix || 'CH').trim();
  const key = _getBillerSeqKey('challan', b?.id, prefix);
  const year = new Date().getFullYear();
  let last = _readJSON(key, { year, seq: 0 });
  if (last.year !== year) last = { year, seq: 0 };
  const padded = String(last.seq + 1).padStart(4, "0");
  return `${prefix}-${year}-${padded}`;
}

function finalizeChallanNumber(no, billerId) {
  if (!no) return;
  try {
    const parts = String(no).split('-');
    if (parts.length < 3) return;
    const prefix = parts.slice(0, parts.length - 2).join('-');
    const year = Number(parts[parts.length - 2]) || new Date().getFullYear();
    const seq = Number(parts[parts.length - 1]) || 0;
    if (!seq) return;
    const b = (billerId && getBillerById(billerId)) || _findBillerByPrefix('challan', prefix) || getActiveBiller();
    const key = _getBillerSeqKey('challan', b?.id, prefix);
    let last = _readJSON(key, { year, seq: 0 });
    if (last.year > year) return;
    if (last.year === year && seq <= last.seq) return;
    _writeJSON(key, { year, seq });
  } catch (e) {
    console.warn('Failed to finalize challan number', e);
  }
}

function getNextReceiptNumber(billerId) {
  const b = (billerId && getBillerById(billerId)) || getActiveBiller();
  const prefix = (b?.prefixes?.receipt || NUMBER_FORMATS.receiptPrefix || 'RCPT').trim();
  const key = _getBillerSeqKey('receipt', b?.id, prefix);
  const year = new Date().getFullYear();
  let last = _readJSON(key, { year, seq: 0 });
  if (last.year !== year) last = { year, seq: 0 };
  last.seq += 1;
  _writeJSON(key, last);
  const padded = String(last.seq).padStart(4, "0");
  return `${prefix}-${year}-${padded}`;
}

function peekNextReceiptNumber(billerId) {
  const b = (billerId && getBillerById(billerId)) || getActiveBiller();
  const prefix = (b?.prefixes?.receipt || NUMBER_FORMATS.receiptPrefix || 'RCPT').trim();
  const key = _getBillerSeqKey('receipt', b?.id, prefix);
  const year = new Date().getFullYear();
  let last = _readJSON(key, { year, seq: 0 });
  if (last.year !== year) last = { year, seq: 0 };
  const padded = String(last.seq + 1).padStart(4, "0");
  return `${prefix}-${year}-${padded}`;
}

function finalizeReceiptNumber(no, billerId) {
  if (!no) return;
  try {
    const parts = String(no).split('-');
    if (parts.length < 3) return;
    const prefix = parts.slice(0, parts.length - 2).join('-');
    const year = Number(parts[parts.length - 2]) || new Date().getFullYear();
    const seq = Number(parts[parts.length - 1]) || 0;
    if (!seq) return;
    const b = (billerId && getBillerById(billerId)) || _findBillerByPrefix('receipt', prefix) || getActiveBiller();
    const key = _getBillerSeqKey('receipt', b?.id, prefix);
    let last = _readJSON(key, { year, seq: 0 });
    if (last.year > year) return;
    if (last.year === year && seq <= last.seq) return;
    _writeJSON(key, { year, seq });
  } catch (e) {
    console.warn('Failed to finalize receipt number', e);
  }
}

function getNextQuotationNumber(billerId) {
  const b = (billerId && getBillerById(billerId)) || getActiveBiller();
  const prefix = (b?.prefixes?.quotation || NUMBER_FORMATS.quotationPrefix || 'QTN').trim();
  const key = _getBillerSeqKey('quotation', b?.id, prefix);
  const year = new Date().getFullYear();
  let last = _readJSON(key, { year, seq: 0 });
  if (last.year !== year) last = { year, seq: 0 };
  last.seq += 1;
  _writeJSON(key, last);
  const padded = String(last.seq).padStart(4, "0");
  return `${prefix}-${year}-${padded}`;
}

function peekNextQuotationNumber(billerId) {
  const b = (billerId && getBillerById(billerId)) || getActiveBiller();
  const prefix = (b?.prefixes?.quotation || NUMBER_FORMATS.quotationPrefix || 'QTN').trim();
  const key = _getBillerSeqKey('quotation', b?.id, prefix);
  const year = new Date().getFullYear();
  let last = _readJSON(key, { year, seq: 0 });
  if (last.year !== year) last = { year, seq: 0 };
  const padded = String(last.seq + 1).padStart(4, "0");
  return `${prefix}-${year}-${padded}`;
}

function finalizeQuotationNumber(no, billerId) {
  if (!no) return;
  try {
    const parts = String(no).split('-');
    if (parts.length < 3) return;
    const prefix = parts.slice(0, parts.length - 2).join('-');
    const year = Number(parts[parts.length - 2]) || new Date().getFullYear();
    const seq = Number(parts[parts.length - 1]) || 0;
    if (!seq) return;
    const b = (billerId && getBillerById(billerId)) || _findBillerByPrefix('quotation', prefix) || getActiveBiller();
    const key = _getBillerSeqKey('quotation', b?.id, prefix);
    let last = _readJSON(key, { year, seq: 0 });
    if (last.year > year) return;
    if (last.year === year && seq <= last.seq) return;
    _writeJSON(key, { year, seq });
  } catch (e) {
    console.warn('Failed to finalize quotation number', e);
  }
}

function getNextExpenseNumber(billerId) {
  const b = (billerId && getBillerById(billerId)) || getActiveBiller();
  const prefix = (b?.prefixes?.expense || NUMBER_FORMATS.expensePrefix || 'EXP').trim();
  const key = _getBillerSeqKey('expense', b?.id, prefix);
  const year = new Date().getFullYear();
  let last = _readJSON(key, { year, seq: 0 });
  if (last.year !== year) last = { year, seq: 0 };
  last.seq += 1;
  _writeJSON(key, last);
  const padded = String(last.seq).padStart(4, "0");
  return `${prefix}-${year}-${padded}`;
}

function peekNextExpenseNumber(billerId) {
  const b = (billerId && getBillerById(billerId)) || getActiveBiller();
  const prefix = (b?.prefixes?.expense || NUMBER_FORMATS.expensePrefix || 'EXP').trim();
  const key = _getBillerSeqKey('expense', b?.id, prefix);
  const year = new Date().getFullYear();
  let last = _readJSON(key, { year, seq: 0 });
  if (last.year !== year) last = { year, seq: 0 };
  const padded = String(last.seq + 1).padStart(4, "0");
  return `${prefix}-${year}-${padded}`;
}

function finalizeExpenseNumber(no, billerId) {
  if (!no) return;
  try {
    const parts = String(no).split('-');
    if (parts.length < 3) return;
    const prefix = parts.slice(0, parts.length - 2).join('-');
    const year = Number(parts[parts.length - 2]) || new Date().getFullYear();
    const seq = Number(parts[parts.length - 1]) || 0;
    if (!seq) return;
    const b = (billerId && getBillerById(billerId)) || _findBillerByPrefix('expense', prefix) || getActiveBiller();
    const key = _getBillerSeqKey('expense', b?.id, prefix);
    let last = _readJSON(key, { year, seq: 0 });
    if (last.year > year) return;
    if (last.year === year && seq <= last.seq) return;
    _writeJSON(key, { year, seq });
  } catch (e) {
    console.warn('Failed to finalize expense number', e);
  }
}

// Records
function loadInvoices() {
  const data = _readJSON(STORAGE_KEYS.invoices, []);
  return Array.isArray(data) ? data : [];
}
function loadChallans() {
  const data = _readJSON(STORAGE_KEYS.challans, []);
  return Array.isArray(data) ? data : [];
}

function loadReceipts() {
  const data = _readJSON(STORAGE_KEYS.receipts, []);
  return Array.isArray(data) ? data : [];
}

function loadQuotations() {
  const data = _readJSON(STORAGE_KEYS.quotations, []);
  return Array.isArray(data) ? data : [];
}

function saveInvoice(inv) {
  const cleanInv = sanitizeRecord(inv);
  const list = loadInvoices();
  const now = new Date().toISOString();
  const idx = list.findIndex(x => x.invoiceNumber === cleanInv.invoiceNumber);
  const existing = idx >= 0 ? list[idx] : null;
  const billerId = cleanInv.billerId || existing?.billerId || getActiveBillerId() || 'biller_default';
  const record = {
    id: cleanInv.id || existing?.id || `inv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    createdAt: existing?.createdAt || cleanInv.createdAt || now,
    savedAt: now,
    billerId,
    ...cleanInv
  };
  if (idx >= 0) {
    if (existing.savedAt && existing.savedAt > record.savedAt) {
      console.warn('Invoice conflict: existing newer than current');
    }
    list[idx] = record;
  } else {
    list.push(record);
  }
  if (cleanInv.client) saveClient(cleanInv.client, { replace: false });
  _writeJSON(STORAGE_KEYS.invoices, list);
}

function saveChallan(ch) {
  const cleanCh = sanitizeRecord(ch);
  const list = loadChallans();
  const now = new Date().toISOString();
  const idx = list.findIndex(x => x.challanNumber === cleanCh.challanNumber);
  const existing = idx >= 0 ? list[idx] : null;
  const billerId = cleanCh.billerId || existing?.billerId || getActiveBillerId() || 'biller_default';
  const record = {
    id: cleanCh.id || existing?.id || `ch_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    createdAt: existing?.createdAt || cleanCh.createdAt || now,
    savedAt: now,
    billerId,
    ...cleanCh
  };
  if (idx >= 0) {
    if (existing.savedAt && existing.savedAt > record.savedAt) {
      console.warn('Challan conflict: existing newer than current');
    }
    list[idx] = record;
  } else {
    list.push(record);
  }
  if (cleanCh.client) saveClient(cleanCh.client, { replace: false });
  _writeJSON(STORAGE_KEYS.challans, list);
}

function saveReceipt(rc) {
  const cleanRc = sanitizeRecord(rc);
  const list = loadReceipts();
  const now = new Date().toISOString();
  const idx = list.findIndex(x => x.receiptNumber === cleanRc.receiptNumber);
  const existing = idx >= 0 ? list[idx] : null;
  const billerId = cleanRc.billerId || existing?.billerId || getActiveBillerId() || 'biller_default';
  const rec = {
    id: cleanRc.id || existing?.id || `r_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    createdAt: existing?.createdAt || cleanRc.createdAt || now,
    savedAt: now,
    billerId,
    ...cleanRc
  };
  if (idx >= 0) list[idx] = rec; else list.push(rec);
  if (cleanRc.client) saveClient(cleanRc.client, { replace: false });
  _writeJSON(STORAGE_KEYS.receipts, list);
}

function saveQuotation(q) {
  const cleanQ = sanitizeRecord(q);
  const list = loadQuotations();
  const now = new Date().toISOString();
  const idx = list.findIndex(x => x.quotationNumber === cleanQ.quotationNumber);
  const existing = idx >= 0 ? list[idx] : null;
  const billerId = cleanQ.billerId || existing?.billerId || getActiveBillerId() || 'biller_default';
  const rec = {
    id: cleanQ.id || existing?.id || `q_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    createdAt: existing?.createdAt || cleanQ.createdAt || now,
    savedAt: now,
    billerId,
    ...cleanQ
  };
  if (idx >= 0) list[idx] = rec; else list.push(rec);
  if (cleanQ.to) {
    saveClient({
      name: cleanQ.to.name,
      address: cleanQ.to.address,
      title: cleanQ.to.title,
      company: cleanQ.to.company,
      bin: cleanQ.to.bin || ''
    }, { replace: false });
  }
  _writeJSON(STORAGE_KEYS.quotations, list);
}

// ==========================================
// Expense Tracking & Category Management
// ==========================================

function loadExpenseCategories() {
  const custom = _readJSON(STORAGE_KEYS.expenseCategories, null);
  if (Array.isArray(custom) && custom.length > 0) {
    return custom;
  }
  const defaults = (typeof DEFAULT_EXPENSE_CATEGORIES !== 'undefined') ? [...DEFAULT_EXPENSE_CATEGORIES] : [
    "Hardware & Components",
    "Tools & Lab Equipment",
    "Software & Cloud Hosting",
    "Office Rent & Utilities",
    "Internet & Communication",
    "Transport & Conveyance",
    "Salary & Contractor Fees",
    "Taxes & Government Fees",
    "Marketing & Advertising",
    "Meals & Refreshments",
    "Miscellaneous"
  ];
  _writeJSON(STORAGE_KEYS.expenseCategories, defaults, { skipSync: true });
  return defaults;
}

function saveExpenseCategory(categoryName) {
  if (!categoryName || typeof categoryName !== 'string') return null;
  const nameTrim = categoryName.trim();
  if (!nameTrim) return null;
  const list = loadExpenseCategories();
  if (!list.some(c => c.toLowerCase() === nameTrim.toLowerCase())) {
    list.push(nameTrim);
    _writeJSON(STORAGE_KEYS.expenseCategories, list);
  }
  return nameTrim;
}

function loadExpenses() {
  const data = _readJSON(STORAGE_KEYS.expenses, []);
  return Array.isArray(data) ? data : [];
}

function saveExpense(expense) {
  if (!expense) return null;
  const clean = sanitizeRecord(expense);
  const list = loadExpenses();
  const now = new Date().toISOString();
  const idx = clean.id ? list.findIndex(e => e.id === clean.id) : -1;
  const existing = idx >= 0 ? list[idx] : null;
  const billerId = clean.billerId || existing?.billerId || getActiveBillerId() || 'biller_default';
  const id = (clean.id || clean.expenseNumber || peekNextExpenseNumber(billerId)).trim();
  const amount = typeof _safeRound === 'function' ? _safeRound(clean.amount || 0) : (Number(clean.amount) || 0);
  const vatAmount = typeof _safeRound === 'function' ? _safeRound(clean.vatAmount || 0) : (Number(clean.vatAmount) || 0);

  const entry = {
    id,
    billerId,
    date: clean.date || _localToday(),
    category: (clean.category || 'Miscellaneous').trim(),
    amount,
    vatAmount,
    payee: (clean.payee || '').trim(),
    paymentMethod: (clean.paymentMethod || 'Cash').trim(),
    reference: (clean.reference || '').trim(),
    notes: (clean.notes || clean.description || '').trim(),
    createdAt: clean.createdAt || existing?.createdAt || now,
    updatedAt: now
  };

  const finalIdx = idx >= 0 ? idx : list.findIndex(e => e.id === id);
  if (finalIdx >= 0) {
    list[finalIdx] = Object.assign(list[finalIdx], entry);
  } else {
    list.push(entry);
    finalizeExpenseNumber(entry.id, entry.billerId);
  }

  if (entry.category) {
    saveExpenseCategory(entry.category);
  }

  _writeJSON(STORAGE_KEYS.expenses, list);

  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(new CustomEvent('storagesync', { detail: { action: 'saveExpense', id: entry.id } }));
  }

  return entry;
}

function deleteExpense(id) {
  if (!id) return false;
  const list = loadExpenses();
  const filtered = list.filter(e => e.id !== id);
  if (filtered.length === list.length) return false;
  _forceNextSyncPrune = true;
  _writeJSON(STORAGE_KEYS.expenses, filtered, { skipSync: true });
  if (typeof _flushSQLiteSyncNow === 'function') _flushSQLiteSyncNow();
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(new CustomEvent('storagesync', { detail: { action: 'deleteExpense', id } }));
  }
  return true;
}

function getExpenseById(id) {
  if (!id) return null;
  return loadExpenses().find(e => e.id === id) || null;
}

// Client Address Book helpers
function loadClients() {
  let list = _readJSON(STORAGE_KEYS.clients, []);
  const seeded = typeof localStorage !== 'undefined' && localStorage.getItem('ai_clients_seeded') === '1';
  if ((!Array.isArray(list) || !list.length) && !seeded) {
    // Seed from existing documents once if empty and not deliberately emptied
    const seen = new Map();
    const addClient = (c) => {
      if (!c || !c.name || typeof c.name !== 'string') return;
      const key = c.name.trim().toLowerCase();
      if (!key) return;
      const prev = seen.get(key) || {};
      seen.set(key, {
        name: c.name.trim(),
        address: (c.address || '').trim() || prev.address || '',
        title: (c.title || '').trim() || prev.title || '',
        company: (c.company || '').trim() || prev.company || '',
        phone: (c.phone || '').trim() || prev.phone || '',
        email: (c.email || '').trim() || prev.email || '',
        bin: (c.bin || c.tin || '').trim() || prev.bin || ''
      });
    };
    loadInvoices().forEach(inv => addClient(inv.client));
    loadChallans().forEach(ch => addClient(ch.client));
    loadQuotations().forEach(q => addClient({ name: q.to?.name, address: q.to?.address, title: q.to?.title, company: q.to?.company, bin: q.to?.bin }));
    loadReceipts().forEach(r => addClient(r.client));
    list = Array.from(seen.values());
    if (list.length) {
      if (typeof localStorage !== 'undefined') localStorage.setItem('ai_clients_seeded', '1');
      _writeJSON(STORAGE_KEYS.clients, list);
    }
  }
  return Array.isArray(list) ? list : [];
}

function saveClient(client, options = {}) {
  if (!client || !client.name || typeof client.name !== 'string') return null;
  const nameTrim = client.name.trim();
  if (!nameTrim) return null;
  const list = _readJSON(STORAGE_KEYS.clients, []);
  const idx = list.findIndex(c => (c.name || '').toLowerCase() === nameTrim.toLowerCase());
  const existing = idx >= 0 ? (list[idx] || {}) : {};
  const pick = (val, oldVal) => {
    const cleaned = (val == null ? '' : String(val)).trim();
    if (options.replace) return cleaned;
    return cleaned || (oldVal == null ? '' : String(oldVal)).trim();
  };
  const entry = {
    name: nameTrim,
    address: pick(client.address, existing.address),
    title: pick(client.title, existing.title),
    company: pick(client.company, existing.company),
    phone: pick(client.phone, existing.phone),
    email: pick(client.email, existing.email),
    bin: pick(client.bin !== undefined ? client.bin : client.tin, existing.bin)
  };
  if (idx >= 0) {
    list[idx] = Object.assign({}, existing, entry);
  } else {
    list.push(entry);
  }
  if (typeof localStorage !== 'undefined') localStorage.setItem('ai_clients_seeded', '1');
  _writeJSON(STORAGE_KEYS.clients, list);
  return entry;
}

function deleteClient(name) {
  if (!name) return false;
  const list = _readJSON(STORAGE_KEYS.clients, []);
  const filtered = list.filter(c => (c.name || '').toLowerCase() !== name.trim().toLowerCase());
  if (typeof localStorage !== 'undefined') localStorage.setItem('ai_clients_seeded', '1');
  if (filtered.length !== list.length) _forceNextSyncPrune = true;
  _writeJSON(STORAGE_KEYS.clients, filtered);
  return filtered.length !== list.length;
}

// Item Catalog / Database helpers
function loadItems() {
  let list = _readJSON(STORAGE_KEYS.items, []);
  const seeded = typeof localStorage !== 'undefined' && localStorage.getItem('ai_items_seeded') === '1';
  if ((!Array.isArray(list) || !list.length) && !seeded) {
    // Seed from existing document line items once if empty
    const seen = new Map();
    const addItem = (it) => {
      if (!it) return;
      const name = (it.name || it.desc || '').trim();
      if (!name) return;
      const key = name.toLowerCase();
      const prev = seen.get(key);
      const nextPrice = typeof _safeRound === 'function' ? _safeRound(it.unitPrice || 0) : (Number(it.unitPrice) || 0);
      if (prev) {
        if (!prev.desc && it.desc) prev.desc = String(it.desc).trim();
        if (prev.unitPrice === 0 && nextPrice > 0) prev.unitPrice = nextPrice;
        if ((!prev.unit || prev.unit === 'Pcs') && it.unit) prev.unit = String(it.unit).trim();
        return;
      }
      seen.set(key, {
        id: 'item_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
        name: name,
        desc: (it.desc || '').trim(),
        unit: (it.unit || 'Pcs').trim(),
        unitPrice: nextPrice
      });
    };
    loadInvoices().forEach(inv => (inv.items || []).forEach(addItem));
    loadChallans().forEach(ch => (ch.items || []).forEach(addItem));
    loadQuotations().forEach(q => (q.items || []).forEach(addItem));
    list = Array.from(seen.values());
    if (list.length) {
      if (typeof localStorage !== 'undefined') localStorage.setItem('ai_items_seeded', '1');
      _writeJSON(STORAGE_KEYS.items, list);
    }
  }
  return Array.isArray(list) ? list : [];
}

function saveItem(item, options = {}) {
  if (!item || (!item.name && !item.desc)) return null;
  const nameTrim = (item.name || item.desc || '').trim();
  if (!nameTrim) return null;
  const list = _readJSON(STORAGE_KEYS.items, []);
  const idx = list.findIndex(i => (i.name || '').toLowerCase() === nameTrim.toLowerCase());
  const existing = idx >= 0 ? (list[idx] || {}) : {};
  const rawIncomingPrice = item.unitPrice !== undefined ? item.unitPrice : item.price;
  const roundedIncomingPrice = typeof _safeRound === 'function' ? _safeRound(rawIncomingPrice || 0) : (Number(rawIncomingPrice) || 0);
  const keepExistingPrice = idx >= 0 && !options.replace && (
    rawIncomingPrice === undefined ||
    rawIncomingPrice === null ||
    rawIncomingPrice === '' ||
    options.preserveExisting ||
    (roundedIncomingPrice === 0 && Number(existing.unitPrice || 0) > 0)
  );
  const entry = {
    id: item.id || existing.id || ('item_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4)),
    name: nameTrim,
    desc: options.replace ? (item.desc || '').trim() : ((item.desc || '').trim() || existing.desc || ''),
    unit: options.replace ? (item.unit || 'Pcs').trim() : ((item.unit || '').trim() || existing.unit || 'Pcs'),
    unitPrice: keepExistingPrice ? _safeRound(existing.unitPrice || 0) : roundedIncomingPrice
  };
  if (idx >= 0) {
    list[idx] = Object.assign({}, existing, entry);
  } else {
    list.push(entry);
  }
  if (typeof localStorage !== 'undefined') localStorage.setItem('ai_items_seeded', '1');
  _writeJSON(STORAGE_KEYS.items, list);
  return entry;
}

function deleteItem(nameOrId) {
  if (!nameOrId) return false;
  const target = String(nameOrId).trim().toLowerCase();
  const list = _readJSON(STORAGE_KEYS.items, []);
  const filtered = list.filter(i =>
    i.id !== nameOrId &&
    (i.name || '').toLowerCase() !== target
  );
  if (typeof localStorage !== 'undefined') localStorage.setItem('ai_items_seeded', '1');
  if (filtered.length !== list.length) _forceNextSyncPrune = true;
  _writeJSON(STORAGE_KEYS.items, filtered);
  return filtered.length !== list.length;
}

function getItemByName(name) {
  if (!name) return null;
  const target = String(name).trim().toLowerCase();
  return loadItems().find(i => (i.name || '').toLowerCase() === target) || null;
}

function getDashboardKPIs(billerId) {
  let invs = loadInvoices();
  let chs = loadChallans();
  let qtns = loadQuotations();
  let rcpts = loadReceipts();
  let exps = typeof loadExpenses === 'function' ? loadExpenses() : [];

  if (billerId && billerId !== 'all') {
    invs = invs.filter(x => (x.billerId || 'biller_default') === billerId);
    chs = chs.filter(x => (x.billerId || 'biller_default') === billerId);
    qtns = qtns.filter(x => (x.billerId || 'biller_default') === billerId);
    rcpts = rcpts.filter(x => (x.billerId || 'biller_default') === billerId);
    exps = exps.filter(x => (x.billerId || 'biller_default') === billerId);
  }

  let totalInvoiced = 0;
  let totalDue = 0;
  let totalCollected = 0;
  let overdueInvoices = 0;
  let overdueTotal = 0;

  invs.forEach(inv => {
    const stats = getInvoicePaymentStats(inv);
    const isTaxWithholding = /\b(AIT|VDS)\b/i.test(stats.adjustmentReason || '');
    totalInvoiced = _safeRound(totalInvoiced + (isTaxWithholding ? stats.originalTotal : stats.total));
    totalCollected = _safeRound(totalCollected + stats.paid);
    totalDue = _safeRound(totalDue + stats.due);
    if (stats.isOverdue) {
      overdueInvoices++;
      overdueTotal = _safeRound(overdueTotal + stats.due);
    }
  });

  // Include direct / unlinked receipts (and receipts on Void invoices) in collected cash flow
  const invNumbers = new Set(invs.filter(i => i.status !== 'Void' && i.status !== 'Pending' && !i.amountPending).map(i => i.invoiceNumber || i.number).filter(Boolean));
  rcpts.forEach(r => {
    if (r.status === 'Void' || r.status === 'Pending' || r.amountPending) return;
    if (!r.invoiceNumber || !invNumbers.has(r.invoiceNumber)) {
      totalCollected = _safeRound(totalCollected + (Number(r.amount || 0) || 0));
    }
  });

  let totalExpenses = 0;
  exps.forEach(e => {
    totalExpenses = _safeRound(totalExpenses + (Number(e.amount || 0) || 0));
  });

  const roundedCollected = _safeRound(totalCollected);
  const netProfit = _safeRound(roundedCollected - totalExpenses);
  const profitMargin = roundedCollected > 0 ? _safeRound((netProfit / roundedCollected) * 100) : 0;

  const isActiveNonPending = x => x.status !== 'Void' && x.status !== 'Pending' && !x.amountPending;
  const isPendingDoc = x => x.status !== 'Void' && (x.status === 'Pending' || !!x.amountPending);
  const pendingInvoices = invs.filter(isPendingDoc).length;
  const pendingReceipts = rcpts.filter(isPendingDoc).length;
  let expiringQuotations = 0;
  if (typeof getQuotationStatus === 'function') {
    qtns.forEach(q => {
      if (!q || q.status === 'Void' || q.converted) return;
      const qs = getQuotationStatus(q);
      if (qs && qs.isValid && !qs.isExpired && qs.daysRemaining >= 0 && qs.daysRemaining <= 7) {
        expiringQuotations++;
      }
    });
  }

  return {
    totalInvoiced: _safeRound(totalInvoiced),
    totalCollected: roundedCollected,
    totalDue: _safeRound(totalDue),
    totalExpenses,
    netProfit,
    profitMargin,
    attention: {
      pendingInvoices,
      pendingReceipts,
      overdueInvoices,
      overdueTotal: _safeRound(overdueTotal),
      expiringQuotations
    },
    counts: {
      invoices: invs.filter(isActiveNonPending).length,
      pendingInvoices,
      challans: chs.filter(x => x.status !== 'Void').length,
      quotations: qtns.filter(x => x.status !== 'Void').length,
      receipts: rcpts.filter(isActiveNonPending).length,
      pendingReceipts,
      expenses: exps.length,
      clients: loadClients().length,
      items: loadItems().length
    }
  };
}

function getReceiptByNumber(no) {
  return loadReceipts().find(x => x.receiptNumber === no) || null;
}

function getQuotationByNumber(no) {
  return loadQuotations().find(x => x.quotationNumber === no) || null;
}

function getInvoiceByNumber(no) {
  return loadInvoices().find(x => x.invoiceNumber === no) || null;
}
function getChallanByNumber(no) {
  return loadChallans().find(x => x.challanNumber === no) || null;
}

function _safeRound(n) {
  if (typeof roundBDT === 'function') return roundBDT(n);
  const num = Number(n);
  if (!Number.isFinite(num) || Math.abs(num) < 1e-9) return 0;
  if (Math.abs(num) >= 1e15) return Math.round(num * 100) / 100;
  const sign = num < 0 ? -1 : 1;
  const absStr = String(Math.abs(num));
  const res = (absStr.includes('e') || absStr.includes('E'))
    ? sign * (Math.round((Math.abs(num) + Number.EPSILON) * 100) / 100)
    : sign * Number(Math.round(Number(absStr + 'e2')) + 'e-2');
  return res === 0 ? 0 : res;
}

// Money receipt helpers
function getReceiptsByInvoiceNumber(no, opts = {}) {
  const includePending = !!(opts && opts.includePending);
  return loadReceipts().filter(x => x.invoiceNumber === no && x.status !== 'Void' && (includePending || (x.status !== 'Pending' && !x.amountPending)));
}

function getTotalPaidForInvoice(no, excludeReceiptNo) {
  return getReceiptsByInvoiceNumber(no).reduce((sum, r) => {
    if (excludeReceiptNo && r.receiptNumber === excludeReceiptNo) return sum;
    if (r.status === 'Pending' || r.amountPending) return sum;
    const amt = Number(r.amount || 0);
    return _safeRound(sum + (isFinite(amt) ? amt : 0));
  }, 0);
}

function _getLatestAdjustedReceiptForInvoice(no, excludeReceiptNo) {
  const recs = getReceiptsByInvoiceNumber(no)
    .filter(r => (!excludeReceiptNo || r.receiptNumber !== excludeReceiptNo) && r.status !== 'Pending' && !r.amountPending && r.adjustment && r.adjustment.applied);
  if (!recs.length) return null;
  recs.sort((a, b) => {
    const ta = (a.adjustment.timestamp || a.savedAt || a.date || '');
    const tb = (b.adjustment.timestamp || b.savedAt || b.date || '');
    return ta.localeCompare(tb);
  });
  return recs[recs.length - 1];
}

function getLatestAdjustmentForInvoice(no, excludeReceiptNo) {
  const latestRec = _getLatestAdjustedReceiptForInvoice(no, excludeReceiptNo);
  return latestRec ? latestRec.adjustment : null;
}

function getInvoicePaymentStats(no, excludeReceiptNo) {
  const inv = (typeof no === 'object' && no !== null) ? no : getInvoiceByNumber(no);
  if (!inv) return { total: 0, paid: 0, due: 0, status: 'Unknown', isOverdue: false, receipts: [] };
  if (inv.status === 'Void') {
    return { total: 0, paid: 0, due: 0, status: 'Void', isOverdue: false, receipts: [] };
  }
  if (inv.status === 'Pending' || inv.amountPending) {
    const invNoPending = inv.invoiceNumber || inv.number || (typeof no === 'string' ? no : '');
    const allLinkedPending = getReceiptsByInvoiceNumber(invNoPending, { includePending: true });
    return {
      total: 0,
      originalTotal: 0,
      adjustmentAmount: 0,
      adjustmentReason: '',
      paid: getTotalPaidForInvoice(invNoPending, excludeReceiptNo),
      due: 0,
      status: 'Pending',
      isOverdue: false,
      receipts: allLinkedPending.filter(r => r.status !== 'Pending' && !r.amountPending),
      pendingReceipts: allLinkedPending.filter(r => r.status === 'Pending' || r.amountPending)
    };
  }
  const invNo = inv.invoiceNumber || inv.number || (typeof no === 'string' ? no : '');
  const baseTotal = _safeRound(Number(inv.grandTotal || 0) || 0);
  const latestAdj = getLatestAdjustmentForInvoice(invNo, excludeReceiptNo);
  const total = latestAdj && isFinite(Number(latestAdj.adjustedTotal))
    ? _safeRound(Number(latestAdj.adjustedTotal))
    : baseTotal;
  const receipts = getReceiptsByInvoiceNumber(invNo);
  const pendingReceipts = getReceiptsByInvoiceNumber(invNo, { includePending: true })
    .filter(r => r.status === 'Pending' || r.amountPending);
  const paid = getTotalPaidForInvoice(invNo, excludeReceiptNo);
  let due = _safeRound(total - paid);
  if (due < 0) due = 0; // due amount can be set to 0, never negative

  const todayStr = _localToday();
  const dueDateStr = inv.dueDate || '';
  const isOverdue = due > 0 && !!dueDateStr && dueDateStr < todayStr;

  let status = 'Unpaid';
  if (total > 0 && due === 0) {
    status = 'Paid';
  } else if (paid > 0 && due > 0) {
    status = 'Partial';
  } else if (total === 0 && due === 0) {
    status = 'Paid';
  }

  return {
    total,
    originalTotal: baseTotal,
    adjustmentAmount: latestAdj ? _safeRound(Number(latestAdj.amount || 0)) : 0,
    adjustmentReason: latestAdj ? (latestAdj.reason || '') : '',
    paid,
    due,
    status,
    isOverdue,
    receipts,
    pendingReceipts
  };
}

function slimCompanySnapshot(biller) {
  if (!biller || typeof biller !== 'object') return {};
  return {
    id: biller.id || 'biller_default',
    name: biller.name || '',
    slogan: biller.slogan || '',
    address: biller.address || '',
    phone: biller.phone || '',
    email: biller.email || '',
    website: biller.website || '',
    taxId: biller.taxId || '',
    themeColor: biller.themeColor || '#0b3969',
    signatoryName: biller.signatoryName || '',
    signatoryTitle: biller.signatoryTitle || '',
    signatureLabels: biller.signatureLabels ? { ...biller.signatureLabels } : undefined,
    remittance: biller.remittance ? { ...biller.remittance } : undefined
  };
}

function getChallansByInvoiceNumber(invNo) {
  const target = String(invNo || '').trim().toLowerCase();
  if (!target) return [];
  return loadChallans()
    .filter(c => c && c.status !== 'Void' && String(c.linkedInvoice || '').trim().toLowerCase() === target)
    .sort((a, b) => String(a.date || a.createdAt || a.challanNumber || '').localeCompare(String(b.date || b.createdAt || b.challanNumber || '')));
}

function getInvoiceDispatchStats(invOrNo, excludeChallanNo) {
  const inv = (typeof invOrNo === 'object' && invOrNo !== null) ? invOrNo : getInvoiceByNumber(invOrNo);
  if (!inv) {
    return { challans: [], totalOrderedQty: 0, totalDispatchedQty: 0, totalRemainingQty: 0, status: 'Pending', items: [] };
  }
  const invNo = inv.invoiceNumber || inv.number || (typeof invOrNo === 'string' ? invOrNo : '');
  const challans = getChallansByInvoiceNumber(invNo).filter(c => !excludeChallanNo || c.challanNumber !== excludeChallanNo);

  const exactMap = new Map();
  const nameMap = new Map();
  const invItems = Array.isArray(inv.items) ? inv.items : [];
  const nameCounts = new Map();
  const exactCounts = new Map();
  invItems.forEach(it => {
    const n = String(it.name || '').trim().toLowerCase();
    const d = String(it.desc || '').trim().toLowerCase();
    const ek = `${n}||${d}`;
    exactCounts.set(ek, (exactCounts.get(ek) || 0) + 1);
    if (n) nameCounts.set(n, (nameCounts.get(n) || 0) + 1);
  });

  const parseNum = (v) => parseFloat(String(v ?? 0).replace(/,/g, '')) || 0;

  challans.forEach(ch => {
    (ch.items || []).forEach(ci => {
      const q = _safeRound(parseNum(ci.qty));
      if (q <= 0) return;
      const n = String(ci.name || '').trim().toLowerCase();
      const d = String(ci.desc || '').trim().toLowerCase();
      const exactKey = `${n}||${d}`;
      exactMap.set(exactKey, _safeRound((exactMap.get(exactKey) || 0) + q));
      if (n) nameMap.set(n, _safeRound((nameMap.get(n) || 0) + q));
    });
  });

  // Track exact vs unique-name consumption so duplicate rows share pool sequentially without double-counting
  let totalOrderedQty = 0;
  let totalDispatchedQty = 0;
  let totalRemainingQty = 0;

  const items = invItems.map(it => {
    const orderedQty = _safeRound(parseNum(it.qty));
    const n = String(it.name || '').trim().toLowerCase();
    const d = String(it.desc || '').trim().toLowerCase();
    const exactKey = `${n}||${d}`;
    let dispatchedQty = 0;
    const remRows = exactCounts.get(exactKey) || 0;
    if (exactMap.has(exactKey) && remRows > 0) {
      const pool = exactMap.get(exactKey);
      dispatchedQty = remRows === 1 ? pool : Math.min(orderedQty, pool);
      exactMap.set(exactKey, _safeRound(Math.max(0, pool - dispatchedQty)));
      exactCounts.set(exactKey, remRows - 1);
    } else if (n && nameCounts.get(n) === 1 && nameMap.has(n)) {
      dispatchedQty = nameMap.get(n);
    }
    const remainingQty = _safeRound(Math.max(0, orderedQty - dispatchedQty));
    totalOrderedQty = _safeRound(totalOrderedQty + orderedQty);
    totalDispatchedQty = _safeRound(totalDispatchedQty + Math.min(orderedQty, dispatchedQty));
    totalRemainingQty = _safeRound(totalRemainingQty + remainingQty);
    return {
      name: it.name || '',
      desc: it.desc || '',
      unit: it.unit || 'Pcs',
      orderedQty,
      dispatchedQty,
      remainingQty
    };
  });

  let status = 'Pending';
  if (challans.length > 0) {
    status = totalRemainingQty <= 0 ? 'Fully Delivered' : 'Partially Delivered';
  }
  return { challans, totalOrderedQty, totalDispatchedQty, totalRemainingQty, status, items };
}

function getQuotationStatus(quotation, asOfDate) {
  const q = (typeof quotation === 'object' && quotation !== null) ? quotation : getQuotationByNumber(quotation);
  if (!q) {
    return {
      status: 'Unknown',
      isValid: false,
      isExpired: false,
      isConverted: false,
      isVoid: false,
      validUntil: '',
      validityDays: 30,
      daysRemaining: 0,
      badgeClass: 'bg-secondary',
      badgeText: 'Unknown'
    };
  }
  if (q.status === 'Void') {
    return {
      status: 'Void',
      isValid: false,
      isExpired: false,
      isConverted: false,
      isVoid: true,
      validUntil: q.validUntil || '',
      validityDays: Number(q.validityDays) || 30,
      daysRemaining: 0,
      badgeClass: 'bg-danger',
      badgeText: 'Void'
    };
  }
  if (q.converted) {
    return {
      status: 'Converted',
      isValid: false,
      isExpired: false,
      isConverted: true,
      isVoid: false,
      validUntil: q.validUntil || '',
      validityDays: Number(q.validityDays) || 30,
      daysRemaining: 0,
      targetInvoice: q.convertedToInvoice || '',
      badgeClass: 'bg-primary',
      badgeText: 'Converted'
    };
  }

  const qDateStr = q.date ? String(q.date).slice(0, 10) : '';
  let validUntil = q.validUntil ? String(q.validUntil).slice(0, 10) : '';
  let validityDays = Number(q.validityDays);

  if (!validUntil && qDateStr) {
    const vDays = (!isNaN(validityDays) && validityDays > 0) ? validityDays : 30;
    const baseDate = _parseLocalDate(qDateStr);
    if (baseDate) {
      baseDate.setDate(baseDate.getDate() + vDays);
      validUntil = _localToday(baseDate);
    }
  }

  if (isNaN(validityDays) || validityDays <= 0) {
    if (qDateStr && validUntil) {
      const d1 = _parseLocalDate(qDateStr);
      const d2 = _parseLocalDate(validUntil);
      if (d1 && d2) {
        validityDays = Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
      }
    }
    if (isNaN(validityDays) || validityDays <= 0) validityDays = 30;
  }

  const todayStr = asOfDate
    ? (typeof asOfDate === 'string' ? asOfDate.slice(0, 10) : _localToday(asOfDate))
    : _localToday();

  let isExpired = false;
  let daysRemaining = 0;

  if (validUntil && todayStr) {
    const todayDate = _parseLocalDate(todayStr);
    const untilDate = _parseLocalDate(validUntil);
    if (todayDate && untilDate) {
      const diffMs = untilDate.getTime() - todayDate.getTime();
      daysRemaining = Math.round(diffMs / (1000 * 60 * 60 * 24));
      // In commercial practice, a quotation is valid through the end of validUntil date
      isExpired = daysRemaining < 0;
    }
  }

  return {
    status: isExpired ? 'Expired' : 'Valid',
    isValid: !isExpired,
    isExpired,
    isConverted: false,
    isVoid: false,
    validUntil,
    validityDays,
    daysRemaining: isExpired ? 0 : Math.max(0, daysRemaining),
    badgeClass: isExpired ? 'bg-danger' : 'bg-success-subtle text-success border border-success-subtle',
    badgeText: isExpired ? 'Expired' : `Valid (${Math.max(0, daysRemaining)}d left)`
  };
}

function computeClientStatementData(options = {}) {
  const clientName = String(options.clientName || '').trim();
  const billerId = options.billerId || 'all';
  const fromDate = options.fromDate || '';
  const toDate = options.toDate || '';

  const invMap = new Map();
  (loadInvoices() || []).forEach(inv => {
    const key = inv.invoiceNumber || inv.number || '';
    if (key) invMap.set(key, inv);
  });
  (Array.isArray(options.extraInvoices) ? options.extraInvoices : []).forEach(inv => {
    const key = inv.invoiceNumber || inv.number || '';
    if (key && !invMap.has(key)) invMap.set(key, inv);
  });

  const rcMap = new Map();
  (loadReceipts() || []).forEach(rc => {
    const key = rc.receiptNumber || rc.number || '';
    if (key) rcMap.set(key, rc);
  });
  (Array.isArray(options.extraReceipts) ? options.extraReceipts : []).forEach(rc => {
    const key = rc.receiptNumber || rc.number || '';
    if (key && !rcMap.has(key)) rcMap.set(key, rc);
  });

  const targetLower = clientName.toLowerCase();
  const allInvoices = Array.from(invMap.values()).filter(inv => {
    if (inv.status === 'Void' || inv.status === 'Pending' || inv.amountPending) return false;
    const nameMatch = (inv.client?.name || inv.to?.name || '').trim().toLowerCase() === targetLower;
    const billerMatch = billerId === 'all' || (inv.billerId || 'biller_default') === billerId;
    return nameMatch && billerMatch;
  });

  const allReceipts = Array.from(rcMap.values()).filter(rc => {
    if (rc.status === 'Void' || rc.status === 'Pending' || rc.amountPending) return false;
    const nameMatch = (rc.client?.name || rc.to?.name || '').trim().toLowerCase() === targetLower;
    const billerMatch = billerId === 'all' || (rc.billerId || 'biller_default') === billerId;
    return nameMatch && billerMatch;
  });

  // Only the winning latest applied settlement adjustment per invoice (within period cutoff) counts as a settlement credit
  const winningAdjByInv = new Map();
  allInvoices.forEach(inv => {
    const invNo = inv.invoiceNumber || inv.number || '';
    if (!invNo) return;
    const candidates = allReceipts.filter(r =>
      (r.invoiceNumber || '') === invNo &&
      r.adjustment && r.adjustment.applied &&
      (!toDate || (r.date || '') <= toDate)
    );
    if (!candidates.length) return;
    candidates.sort((a, b) => (a.adjustment.timestamp || a.savedAt || a.date || '').localeCompare(b.adjustment.timestamp || b.savedAt || b.date || ''));
    const winRec = candidates[candidates.length - 1];
    if (winRec && winRec.receiptNumber) {
      winningAdjByInv.set(invNo, winRec.receiptNumber);
    }
  });

  let openingBalance = 0;
  const periodInvoices = [];
  const periodReceipts = [];

  allInvoices.forEach(inv => {
    const d = inv.date || '';
    const total = _safeRound(Number(inv.grandTotal || 0));
    if (fromDate && d < fromDate) {
      openingBalance = _safeRound(openingBalance + total);
    } else if (!toDate || d <= toDate) {
      periodInvoices.push({ ...inv, _effectiveTotal: total });
    }
  });

  allReceipts.forEach(rc => {
    const d = rc.date || '';
    const invNo = rc.invoiceNumber || '';
    const isWinningAdj = !!(
      rc.adjustment &&
      rc.adjustment.applied &&
      (!invNo || !winningAdjByInv.has(invNo) || winningAdjByInv.get(invNo) === rc.receiptNumber)
    );
    const adjAmt = isWinningAdj ? _safeRound(Number(rc.adjustment.amount || 0)) : 0;
    const effectiveCredit = _safeRound((Number(rc.amount || 0) || 0) + adjAmt);
    if (fromDate && d < fromDate) {
      openingBalance = _safeRound(openingBalance - effectiveCredit);
    } else if (!toDate || d <= toDate) {
      periodReceipts.push({ ...rc, _adjAmt: adjAmt, _effectiveCredit: effectiveCredit });
    }
  });

  return {
    allInvoices,
    allReceipts,
    openingBalance,
    periodInvoices,
    periodReceipts
  };
}

function deleteRecordByType(type, number) {
  if (!type || !number) return false;
  const t = String(type).toLowerCase();
  const target = String(number).trim();
  const map = {
    invoice: { key: STORAGE_KEYS.invoices, field: 'invoiceNumber' },
    challan: { key: STORAGE_KEYS.challans, field: 'challanNumber' },
    receipt: { key: STORAGE_KEYS.receipts, field: 'receiptNumber' },
    quotation: { key: STORAGE_KEYS.quotations, field: 'quotationNumber' }
  };
  const cfg = map[t];
  if (!cfg) return false;
  const list = _readJSON(cfg.key, []);
  const filtered = list.filter(r => (r[cfg.field] || r.number) !== target);
  if (filtered.length === list.length) return false;
  _forceNextSyncPrune = true;
  _writeJSON(cfg.key, filtered, { skipSync: true });
  _flushSQLiteSyncNow();
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(new CustomEvent('storagesync', { detail: { action: 'deleteRecord', type: t, number: target } }));
  }
  return true;
}

function toggleVoidRecord(type, number) {
  if (!type || !number) return null;
  const t = String(type).toLowerCase();
  const target = String(number).trim();
  const map = {
    invoice: { key: STORAGE_KEYS.invoices, field: 'invoiceNumber' },
    challan: { key: STORAGE_KEYS.challans, field: 'challanNumber' },
    receipt: { key: STORAGE_KEYS.receipts, field: 'receiptNumber' },
    quotation: { key: STORAGE_KEYS.quotations, field: 'quotationNumber' }
  };
  const cfg = map[t];
  if (!cfg) return null;
  const list = _readJSON(cfg.key, []);
  const rec = list.find(r => (r[cfg.field] || r.number) === target);
  if (!rec) return null;
  rec.status = rec.status === 'Void' ? (rec.amountPending ? 'Pending' : 'Saved') : 'Void';
  rec.updatedAt = new Date().toISOString();
  _writeJSON(cfg.key, list);
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(new CustomEvent('storagesync', { detail: { action: 'toggleVoid', type: t, number: target, status: rec.status } }));
  }
  return rec;
}

// ==========================================
// Embedded SQLite Database Synchronization
// ==========================================

let _sqliteSyncTimer = null;

function scheduleSQLiteSync(delayMs = 500) {
  if (_isTestEnvironment()) return;
  if (typeof window === 'undefined' || typeof fetch === 'undefined') return;
  if (window.location && window.location.protocol === 'file:') return;

  if (_sqliteSyncTimer) clearTimeout(_sqliteSyncTimer);
  _sqliteSyncTimer = setTimeout(() => {
    syncWithSQLite(true);
  }, delayMs);
}

function getFullDataSnapshot() {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    invoices: typeof loadInvoices === 'function' ? loadInvoices() : [],
    challans: typeof loadChallans === 'function' ? loadChallans() : [],
    receipts: typeof loadReceipts === 'function' ? loadReceipts() : [],
    quotations: typeof loadQuotations === 'function' ? loadQuotations() : [],
    expenses: typeof loadExpenses === 'function' ? loadExpenses() : [],
    expenseCategories: typeof loadExpenseCategories === 'function' ? loadExpenseCategories() : [],
    clients: typeof loadClients === 'function' ? loadClients() : [],
    items: typeof loadItems === 'function' ? loadItems() : [],
    billers: typeof loadBillers === 'function' ? loadBillers() : [],
    settings: {
      activeBillerId: typeof getActiveBillerId === 'function' ? getActiveBillerId() : null,
      lastInvoiceNo: typeof _readJSON === 'function' ? _readJSON(STORAGE_KEYS.lastInvoiceNo, null) : null,
      lastChallanNo: typeof _readJSON === 'function' ? _readJSON(STORAGE_KEYS.lastChallanNo, null) : null,
      lastReceiptNo: typeof _readJSON === 'function' ? _readJSON(STORAGE_KEYS.lastReceiptNo, null) : null,
      lastQuotationNo: typeof _readJSON === 'function' ? _readJSON(STORAGE_KEYS.lastQuotationNo, null) : null,
      lastExpenseNo: typeof _readJSON === 'function' ? _readJSON(STORAGE_KEYS.lastExpenseNo, null) : null,
      sequences: _collectAllSequenceKeys()
    }
  };
}

function _flushSQLiteSyncNow() {
  if (_sqliteSyncTimer) {
    clearTimeout(_sqliteSyncTimer);
    _sqliteSyncTimer = null;
  }
  if (typeof syncWithSQLite === 'function') {
    syncWithSQLite(true, { keepalive: true });
  }
}

async function syncWithSQLite(silent = true, fetchOpts = {}) {
  if (_isTestEnvironment()) return { success: false, testing: true };
  if (typeof window === 'undefined' || typeof fetch === 'undefined') return { success: false, offline: true };
  if (window.location && window.location.protocol === 'file:') return { success: false, offline: true };

  const forcePruneEmpty = _forceNextSyncPrune;
  _forceNextSyncPrune = false;

  try {
    const payload = getFullDataSnapshot();
    if (forcePruneEmpty) payload.forcePruneEmpty = true;
    const bodyStr = JSON.stringify(payload);
    const res = await fetch('/api/db/sync', {
      method: 'POST',
      keepalive: !!fetchOpts.keepalive && bodyStr.length <= 60000,
      headers: { 'Content-Type': 'application/json', 'X-AutoInvoice-Action': 'sync' },
      body: bodyStr
    });
    if (!res.ok) {
      if (forcePruneEmpty) _forceNextSyncPrune = true;
      if (!silent) console.warn('[SQLite Sync] Server returned status', res.status);
      return { success: false, status: res.status };
    }
    const result = await res.json();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('autoinvoice:db-synced', { detail: result }));
    }
    return result;
  } catch (err) {
    if (forcePruneEmpty) _forceNextSyncPrune = true;
    if (!silent) console.warn('[SQLite Sync] Network error:', err.message);
    return { success: false, error: err.message };
  }
}

async function checkSQLiteStatus() {
  if (typeof window === 'undefined' || typeof fetch === 'undefined') return { available: false, offline: true };
  if (window.location && window.location.protocol === 'file:') return { available: false, offline: true };

  try {
    const res = await fetch('/api/db/status', { cache: 'no-cache' });
    if (!res.ok) return { available: false, status: res.status };
    return await res.json();
  } catch (e) {
    return { available: false, offline: true };
  }
}

async function pullFromSQLite() {
  if (_isTestEnvironment()) return false;
  if (typeof window === 'undefined' || typeof fetch === 'undefined') throw new Error('Browser environment required');
  const res = await fetch('/api/db/all', { cache: 'no-cache' });
  if (!res.ok) throw new Error('Server returned HTTP ' + res.status);
  const data = await res.json();
  return importAllData(data);
}

if (typeof window !== 'undefined' && typeof window.addEventListener === 'function' && !_isTestEnvironment()) {
  window.addEventListener('load', () => {
    if (_isTestEnvironment()) return;
    setTimeout(async () => {
      if (_isTestEnvironment()) return;
      try {
        const localCount = loadInvoices().length + loadChallans().length + loadQuotations().length + loadReceipts().length + loadExpenses().length;
        if (localCount === 0 && typeof checkSQLiteStatus === 'function') {
          const st = await checkSQLiteStatus();
          const c = (st && st.counts) || {};
          const dbDocs = (c.invoices || 0) + (c.challans || 0) + (c.quotations || 0) + (c.receipts || 0) + (c.expenses || 0);
          const hasDbExtras = (c.billers || 0) > 1 || (c.clients || 0) > 0 || (c.items || 0) > 0;
          if (dbDocs > 0 || hasDbExtras) {
            await pullFromSQLite();
            window.dispatchEvent(new CustomEvent('storagesync', { detail: { action: 'pullFromSQLite' } }));
            window.dispatchEvent(new CustomEvent('billerchange', { detail: { billerId: getActiveBillerId() } }));
            return;
          }
        }
      } catch (e) { }
      scheduleSQLiteSync(800);
    }, 400);
  });
}


