/**
 * AutoInvoice Supabase Cloud Sync Engine
 * Provides transparent, two-way real-time synchronization between browser localStorage
 * and Supabase PostgreSQL database using standard REST API (zero npm dependencies).
 */
(function (root) {
  'use strict';

  const SUPABASE_CONFIG = {
    url: 'https://oxbznvwhxjjkpklghmik.supabase.co',
    anonKey: 'sb_publishable_Nb-GuWAXX7XINSi2SzIRvQ_mIRSYOW6',
    enabled: true
  };

  let isSyncing = false;
  let lastSyncTime = null;

  function isSupabaseConfigured() {
    return Boolean(SUPABASE_CONFIG.enabled && SUPABASE_CONFIG.url && SUPABASE_CONFIG.anonKey);
  }

  function getHeaders() {
    return {
      'apikey': SUPABASE_CONFIG.anonKey,
      'Authorization': `Bearer ${SUPABASE_CONFIG.anonKey}`,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates'
    };
  }

  async function supabaseRequest(endpoint, options = {}) {
    if (!isSupabaseConfigured() || (typeof navigator !== 'undefined' && !navigator.onLine)) {
      return null;
    }
    const url = `${SUPABASE_CONFIG.url}/rest/v1/${endpoint}`;
    try {
      const res = await fetch(url, {
        headers: getHeaders(),
        ...options
      });
      if (!res.ok) {
        console.warn(`[Supabase] ${options.method || 'GET'} ${endpoint} failed: ${res.status}`);
        return null;
      }
      if (res.status === 204) return true;
      return await res.json();
    } catch (err) {
      console.warn(`[Supabase] Network error on ${endpoint}:`, err);
      return null;
    }
  }

  async function supabaseUpsert(table, row) {
    if (!row || !row.id) return false;
    const res = await supabaseRequest(table, {
      method: 'POST',
      body: JSON.stringify(row)
    });
    return res !== null;
  }

  async function supabaseDelete(table, id) {
    if (!id) return false;
    const res = await supabaseRequest(`${table}?id=eq.${encodeURIComponent(id)}`, {
      method: 'DELETE'
    });
    return res !== null;
  }

  async function supabaseFetchAll(table) {
    const data = await supabaseRequest(`${table}?select=*`);
    return Array.isArray(data) ? data : [];
  }

  // Row formatters for mapping local document records to Supabase tables
  const TABLE_FORMATTERS = {
    invoices: rec => ({
      id: rec.id || `inv_${rec.invoiceNumber}`,
      invoice_number: rec.invoiceNumber || rec.number || '',
      biller_id: rec.billerId || 'biller_default',
      client_name: rec.client?.name || '',
      date: rec.date || '',
      grand_total: Number(rec.grandTotal || 0) || 0,
      status: rec.status || 'Saved',
      data: rec,
      updated_at: rec.savedAt || new Date().toISOString()
    }),
    challans: rec => ({
      id: rec.id || `ch_${rec.challanNumber}`,
      challan_number: rec.challanNumber || rec.number || '',
      biller_id: rec.billerId || 'biller_default',
      client_name: rec.client?.name || '',
      date: rec.date || '',
      status: rec.status || 'Saved',
      data: rec,
      updated_at: rec.savedAt || new Date().toISOString()
    }),
    receipts: rec => ({
      id: rec.id || `r_${rec.receiptNumber}`,
      receipt_number: rec.receiptNumber || rec.number || '',
      invoice_number: rec.invoiceNumber || '',
      biller_id: rec.billerId || 'biller_default',
      amount: Number(rec.amount || 0) || 0,
      status: rec.status || 'Saved',
      data: rec,
      updated_at: rec.savedAt || new Date().toISOString()
    }),
    quotations: rec => ({
      id: rec.id || `q_${rec.quotationNumber}`,
      quotation_number: rec.quotationNumber || rec.number || '',
      biller_id: rec.billerId || 'biller_default',
      client_name: rec.to?.company || rec.to?.name || '',
      grand_total: Number(rec.grandTotal || 0) || 0,
      status: rec.status || 'Valid',
      data: rec,
      updated_at: rec.savedAt || new Date().toISOString()
    }),
    expenses: rec => ({
      id: rec.id || `exp_${rec.voucherNo || Date.now()}`,
      voucher_no: rec.voucherNo || rec.expenseNumber || '',
      biller_id: rec.billerId || 'biller_default',
      category: rec.category || '',
      amount: Number(rec.amount || 0) || 0,
      date: rec.date || '',
      data: rec,
      updated_at: rec.savedAt || new Date().toISOString()
    }),
    clients: rec => ({
      id: rec.id || `cli_${String(rec.name || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
      name: rec.name || '',
      phone: rec.phone || '',
      email: rec.email || '',
      data: rec,
      updated_at: new Date().toISOString()
    }),
    items: rec => ({
      id: rec.id || `it_${String(rec.name || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
      name: rec.name || '',
      unit_price: Number(rec.unitPrice || 0) || 0,
      data: rec,
      updated_at: new Date().toISOString()
    }),
    billers: rec => ({
      id: rec.id || 'biller_default',
      name: rec.name || '',
      data: rec,
      updated_at: rec.updatedAt || new Date().toISOString()
    })
  };

  /**
   * Push a single record to Supabase asynchronously
   */
  async function supabasePushRecord(table, record) {
    if (!isSupabaseConfigured() || !record) return;
    const formatter = TABLE_FORMATTERS[table];
    if (!formatter) return;
    const row = formatter(record);
    try {
      await supabaseUpsert(table, row);
      updateSyncBadge('synced');
    } catch (e) {
      console.warn(`[Supabase] Push to ${table} failed:`, e);
      updateSyncBadge('error');
    }
  }

  /**
   * Push a sequence counter to Supabase
   */
  async function supabasePushSequence(key, year, seq) {
    if (!isSupabaseConfigured() || !key) return;
    try {
      await supabaseUpsert('sequences', {
        key,
        year: Number(year) || new Date().getFullYear(),
        seq: Number(seq) || 0,
        updated_at: new Date().toISOString()
      });
    } catch (e) {
      console.warn('[Supabase] Failed to push sequence:', e);
    }
  }

  /**
   * Delete a record from Supabase asynchronously
   */
  async function supabaseDeleteRecord(table, id) {
    if (!isSupabaseConfigured() || !id) return;
    try {
      await supabaseDelete(table, id);
    } catch (e) {
      console.warn(`[Supabase] Delete from ${table} failed:`, e);
    }
  }

  /**
   * Perform a full two-way synchronization:
   * 1. Fetches all tables from Supabase
   * 2. Merges cloud records into local storage (cloud records not present locally are saved; newer records win)
   * 3. Pushes any local records not present in Supabase up to the cloud
   */
  async function supabaseSyncAll(options = {}) {
    if (!isSupabaseConfigured() || isSyncing) return false;
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      updateSyncBadge('offline');
      return false;
    }

    isSyncing = true;
    updateSyncBadge('syncing');

    try {
      const tables = ['billers', 'clients', 'items', 'invoices', 'challans', 'receipts', 'quotations', 'expenses', 'sequences'];
      const cloudData = {};

      // 1. Fetch all cloud records in parallel
      await Promise.all(tables.map(async t => {
        cloudData[t] = await supabaseFetchAll(t);
      }));

      // 2. Hydrate Sequences
      if (Array.isArray(cloudData.sequences)) {
        cloudData.sequences.forEach(s => {
          if (!s.key) return;
          try {
            const local = (typeof root._readJSON === 'function') ? root._readJSON(s.key, null) : null;
            if (!local || local.year < s.year || (local.year === s.year && local.seq < s.seq)) {
              if (typeof root._writeJSON === 'function') {
                root._writeJSON(s.key, { year: s.year, seq: s.seq }, { skipCloudSync: true });
              }
            }
          } catch (_) { }
        });
      }

      // 3. Merge Entity & Document Tables
      const storageKeyMap = {
        invoices: root.STORAGE_KEYS?.invoices || 'ai_invoices',
        challans: root.STORAGE_KEYS?.challans || 'ai_challans',
        receipts: root.STORAGE_KEYS?.receipts || 'ai_receipts',
        quotations: root.STORAGE_KEYS?.quotations || 'ai_quotations',
        expenses: root.STORAGE_KEYS?.expenses || 'ai_expenses',
        clients: root.STORAGE_KEYS?.clients || 'ai_clients',
        items: root.STORAGE_KEYS?.items || 'ai_items',
        billers: root.STORAGE_KEYS?.billers || 'ai_billers'
      };

      for (const [table, sKey] of Object.entries(storageKeyMap)) {
        const cloudRows = cloudData[table] || [];
        const localList = (typeof root._readJSON === 'function') ? root._readJSON(sKey, []) : [];
        const localArr = Array.isArray(localList) ? localList : [];
        const localMap = new Map();
        localArr.forEach(item => {
          const id = item.id || (table === 'invoices' ? item.invoiceNumber : table === 'challans' ? item.challanNumber : table === 'receipts' ? item.receiptNumber : table === 'quotations' ? item.quotationNumber : item.name);
          if (id) localMap.set(String(id), item);
        });

        let changedLocal = false;
        const missingOnCloud = [];

        // Ingest from Cloud
        for (const cRow of cloudRows) {
          const cDoc = cRow.data || cRow;
          const id = String(cRow.id || cDoc.id || '');
          if (!id) continue;

          if (!localMap.has(id)) {
            localArr.push(cDoc);
            localMap.set(id, cDoc);
            changedLocal = true;
          } else {
            // Check timestamps if both have savedAt / updatedAt
            const existing = localMap.get(id);
            const cTime = cRow.updated_at || cDoc.savedAt || cDoc.updatedAt || '';
            const lTime = existing.savedAt || existing.updatedAt || '';
            if (cTime && lTime && cTime > lTime) {
              const idx = localArr.findIndex(x => (x.id || x.invoiceNumber || x.challanNumber || x.receiptNumber || x.quotationNumber || x.name) === id);
              if (idx >= 0) {
                localArr[idx] = cDoc;
                localMap.set(id, cDoc);
                changedLocal = true;
              }
            }
          }
        }

        // Detect local records to push up to cloud
        const cloudIdSet = new Set(cloudRows.map(r => String(r.id)));
        for (const localItem of localArr) {
          const id = String(localItem.id || (table === 'invoices' ? localItem.invoiceNumber : table === 'challans' ? localItem.challanNumber : table === 'receipts' ? localItem.receiptNumber : table === 'quotations' ? localItem.quotationNumber : localItem.name) || '');
          if (id && !cloudIdSet.has(id)) {
            missingOnCloud.push(localItem);
          }
        }

        // Save updated local data if cloud added items
        if (changedLocal && typeof root._writeJSON === 'function') {
          root._writeJSON(sKey, localArr, { skipCloudSync: true });
        }

        // Push any missing local items to Supabase
        if (missingOnCloud.length > 0) {
          const formatter = TABLE_FORMATTERS[table];
          if (formatter) {
            for (const item of missingOnCloud) {
              await supabaseUpsert(table, formatter(item));
            }
          }
        }
      }

      lastSyncTime = new Date();
      updateSyncBadge('synced');

      if (options.notify && typeof root.showToast === 'function') {
        root.showToast('Cloud database synchronized successfully.', 'success');
      }

      // Notify open UI components to refresh
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('storagesync'));
      }
      return true;
    } catch (err) {
      console.warn('[Supabase] Full sync failed:', err);
      updateSyncBadge('error');
      return false;
    } finally {
      isSyncing = false;
    }
  }

  /**
   * Cloud Status Badge in Navbar
   */
  function updateSyncBadge(status) {
    if (typeof document === 'undefined') return;
    const badge = document.getElementById('cloudSyncBadge');
    const textEl = document.getElementById('cloudSyncText');
    const iconEl = document.getElementById('cloudSyncIcon');
    const spinner = document.getElementById('cloudSyncSpinner');
    if (!badge || !textEl) return;

    badge.className = 'badge rounded-pill border d-inline-flex align-items-center gap-1 ms-2';

    if (status === 'syncing') {
      badge.classList.add('bg-warning-subtle', 'text-warning-emphasis', 'border-warning-subtle');
      if (spinner) spinner.classList.remove('d-none');
      if (iconEl) iconEl.textContent = '🔄';
      textEl.textContent = 'Syncing...';
    } else if (status === 'synced') {
      badge.classList.add('bg-success-subtle', 'text-success', 'border-success-subtle');
      if (spinner) spinner.classList.add('d-none');
      if (iconEl) iconEl.textContent = '☁️';
      const timeStr = lastSyncTime ? lastSyncTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Ready';
      textEl.textContent = `Cloud Synced (${timeStr})`;
    } else if (status === 'offline') {
      badge.classList.add('bg-secondary-subtle', 'text-secondary', 'border-secondary-subtle');
      if (spinner) spinner.classList.add('d-none');
      if (iconEl) iconEl.textContent = '📴';
      textEl.textContent = 'Offline Mode';
    } else {
      badge.classList.add('bg-danger-subtle', 'text-danger', 'border-danger-subtle');
      if (spinner) spinner.classList.add('d-none');
      if (iconEl) iconEl.textContent = '⚠️';
      textEl.textContent = 'Sync Retry';
    }
  }

  function initCloudSyncUI() {
    if (typeof document === 'undefined') return;
    const navbars = document.querySelectorAll('.navbar .container, .navbar .container-fluid');
    if (!navbars.length) return;

    // Attach to first navbar brand/title if not already present
    if (!document.getElementById('cloudSyncBadge')) {
      const brand = document.querySelector('.navbar-brand');
      if (brand && brand.parentNode) {
        const badge = document.createElement('div');
        badge.id = 'cloudSyncBadge';
        badge.className = 'badge rounded-pill bg-success-subtle text-success border border-success-subtle d-inline-flex align-items-center gap-1 ms-2';
        badge.style.fontSize = '0.74rem';
        badge.style.cursor = 'pointer';
        badge.title = 'Connected to Supabase Cloud. Click to sync immediately.';
        badge.innerHTML = `<span class="spinner-grow spinner-grow-sm d-none" id="cloudSyncSpinner" role="status"></span><span id="cloudSyncIcon">☁️</span> <span id="cloudSyncText">Cloud Synced</span>`;
        badge.addEventListener('click', () => {
          supabaseSyncAll({ notify: true });
        });
        brand.after(badge);
      }
    }

    // Auto-sync on window focus or coming online
    window.addEventListener('online', () => supabaseSyncAll());
    window.addEventListener('offline', () => updateSyncBadge('offline'));

    // Trigger initial background sync 800ms after load
    setTimeout(() => {
      supabaseSyncAll();
    }, 800);
  }

  // Auto-init UI when DOM is ready
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initCloudSyncUI);
    } else {
      initCloudSyncUI();
    }
  }

  // Export public API to root (window)
  root.SUPABASE_CONFIG = SUPABASE_CONFIG;
  root.isSupabaseConfigured = isSupabaseConfigured;
  root.supabasePushRecord = supabasePushRecord;
  root.supabasePushSequence = supabasePushSequence;
  root.supabaseDeleteRecord = supabaseDeleteRecord;
  root.supabaseSyncAll = supabaseSyncAll;

})(typeof window !== 'undefined' ? window : globalThis);
