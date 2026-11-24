// Disk-based records loader. Reads records/ indexes and fetches JSON files

async function loadDiskIndex(dir) {
  try {
    const res = await fetch(`records/${dir}/index.json`, { cache: 'no-store' });
    if (!res.ok) return [];
    const data = await res.json();
    const arr = Array.isArray(data.records) ? data.records : [];
    // Normalize fields
    return arr.map(r => ({
      __type: dir === 'invoices' ? 'invoice' : 'challan',
      source: 'disk',
      number: r.number || '',
      date: r.date || '',
      dueDate: r.dueDate || '',
      grandTotal: r.grandTotal != null ? Number(r.grandTotal) : 0,
      title: r.title || '',
      billerId: r.billerId || '',
      status: r.status || '',
      amountPending: !!r.amountPending,
      client: r.client || {},
      file: r.file || ''
    }));
  } catch (e) {
    console.warn('Failed to load disk index', dir, e);
    return [];
  }
}

async function _getDiskRecordByNumber(dir, no) {
  const idx = await loadDiskIndex(dir);
  const entry = idx.find(r => r.number === no);
  if (!entry || !entry.file) return null;
  try {
    const res = await fetch(`records/${dir}/${entry.file}`, { cache: 'no-store' });
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    console.warn(`Failed to load disk ${dir.slice(0, -1)}`, no, e);
    return null;
  }
}

async function getDiskInvoiceByNumber(no) {
  return _getDiskRecordByNumber('invoices', no);
}

async function getDiskChallanByNumber(no) {
  return _getDiskRecordByNumber('challans', no);
}

async function loadDiskInvoicesSummaries() {
  return loadDiskIndex('invoices');
}
async function loadDiskChallansSummaries() {
  return loadDiskIndex('challans');
}

// Deprecated fallback: no-op since disk records use index.json
async function autoDiscoverSummaries() { return []; }

function downloadJSON(filename, obj) {
  if (typeof downloadBlob === 'function') {
    downloadBlob(filename, new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' }));
  }
}