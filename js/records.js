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
      client: r.client || {},
      file: r.file || ''
    }));
  } catch (e) {
    console.warn('Failed to load disk index', dir, e);
    return [];
  }
}

async function _getDiskRecordByNumber(dir, no) {
  let idx = await loadDiskIndex(dir);
  let entry = idx.find(r => r.number === no);
  if (!entry || !entry.file) {
    const discovered = await autoDiscoverSummaries(dir);
    entry = discovered.find(r => r.number === no);
  }
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

// Fallback: auto-discover JSON files in directory listings (works on simple static servers)
async function autoDiscoverSummaries(dir) {
  try {
    const res = await fetch(`records/${dir}/`, { cache: 'no-store' });
    if (!res.ok) return [];
    const html = await res.text();
    const links = Array.from(html.matchAll(/href="([^"]+\.json)"/gi))
      .map(m => m[1])
      .filter(f => !/(^|\/)index\.json$/i.test(f));
    const limit = 100;
    const files = links.slice(0, limit);
    const out = [];
    for (const f of files) {
      try {
        const r = await fetch(`records/${dir}/${f}`, { cache: 'no-store' });
        if (!r.ok) continue;
        const obj = await r.json();
        const type = dir === 'invoices' ? 'invoice' : 'challan';
        const number = obj.invoiceNumber || obj.challanNumber || obj.number || '';
        if (!number) continue;
        const date = obj.date || '';
        const grandTotal = obj.grandTotal != null ? Number(obj.grandTotal) : 0;
        const client = obj.client || {};
        out.push({
          __type: type,
          source: 'disk',
          number,
          date,
          dueDate: obj.dueDate || '',
          grandTotal,
          title: obj.title || '',
          billerId: obj.billerId || '',
          status: obj.status || '',
          client,
          file: f
        });
      } catch (err) {
        console.warn('Failed to parse record file:', f, err);
      }
    }
    return out;
  } catch (e) {
    console.warn('Auto-discover failed for', dir, e);
    return [];
  }
}

function downloadJSON(filename, obj) {
  try {
    const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (e) {
    console.error('Failed to download JSON', e);
  }
}