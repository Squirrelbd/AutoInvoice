/**
 * AutoInvoice Shared Document List Controller & Invoice Picker Modal
 * Provides mode-switched List View (search, biller/status/method filters, sort, KPIs, actions)
 * for quotation.html, invoice.html, challan.html, and receipt.html, plus a shared
 * "Generate from Invoice" picker modal for challan.html and receipt.html.
 */
(function (root) {
  'use strict';

  function _escHtml(v) {
    if (typeof root.escapeHTML === 'function') return root.escapeHTML(v);
    return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function _escAttr(v) {
    if (typeof root.escapeAttr === 'function') return root.escapeAttr(v);
    return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function _round(v) {
    return typeof root.roundBDT === 'function'
      ? root.roundBDT(v)
      : Math.round((Number(v || 0) + Number.EPSILON) * 100) / 100;
  }

  function _fmtBDT(v) {
    return typeof root.formatBDT === 'function' ? root.formatBDT(v) : `৳${_round(v).toFixed(2)}`;
  }

  function _fmtDate(d) {
    if (!d) return '—';
    return typeof root.formatDisplayDate === 'function' ? root.formatDisplayDate(d) : String(d).slice(0, 10);
  }

  const NUMBER_FIELDS = {
    quotation: 'quotationNumber',
    invoice: 'invoiceNumber',
    challan: 'challanNumber',
    receipt: 'receiptNumber'
  };

  function getDocNumber(rec, type) {
    if (!rec) return '';
    const f = NUMBER_FIELDS[type];
    return String((f && rec[f]) || rec.number || rec.quotationNumber || rec.invoiceNumber || rec.challanNumber || rec.receiptNumber || '').trim();
  }

  function _getBillerName(billerId, rawBillerName, billerMap) {
    if (billerMap && billerId && billerMap.has(billerId)) {
      return billerMap.get(billerId).name || billerId;
    }
    return rawBillerName || billerId || 'Default';
  }

  function _buildBillerMap() {
    const map = new Map();
    if (typeof root.loadBillers === 'function') {
      (root.loadBillers() || []).forEach(b => {
        if (b && b.id) map.set(b.id, b);
      });
    }
    return map;
  }

  /**
   * Computes normalized list-view metadata for a record so filtering, sorting,
   * and rendering share one canonical calculation path.
   */
  function enrichRecord(rec, type, ctx) {
    const num = getDocNumber(rec, type);
    const clientObj = (rec && typeof rec.client === 'object' && rec.client)
      ? rec.client
      : ((rec && typeof rec.to === 'object' && rec.to) ? rec.to : {});
    const clientName = String(clientObj.name || clientObj.company || rec.clientName || '').trim();
    const clientCompany = String(clientObj.company || '').trim();
    const clientPhone = String(clientObj.phone || '').trim();
    const date = String(rec.date || '').slice(0, 10);
    const title = String(rec.title || rec.projectTitle || rec.subject || '').trim();
    const billerId = String(rec.billerId || (rec.company && rec.company.id) || 'biller_default').trim();
    const billerName = _getBillerName(billerId, rec.billerName || (rec.company && rec.company.name), ctx && ctx.billerMap);
    const isVoid = String(rec.status || '').toLowerCase() === 'void';
    const items = Array.isArray(rec.items) ? rec.items : [];

    let status = 'Saved';
    let statusBadgeClass = 'bg-secondary-subtle text-secondary border border-secondary-subtle';
    let amount = 0;
    let originalAmount = 0;
    let isAdjusted = false;
    let due = 0;
    let paid = 0;
    let linkedRef = '';
    let linkedUrl = '';
    let method = String(rec.paymentMethod || rec.method || '').trim();
    let metaNote = '';
    let canConvert = false;
    let dispatchInfo = null;

    if (type === 'quotation') {
      amount = _round(Number(rec.grandTotal || 0) || 0);
      originalAmount = amount;
      const qs = typeof root.getQuotationStatus === 'function' ? root.getQuotationStatus(rec) : null;
      status = isVoid ? 'Void' : (qs ? qs.status : (rec.converted ? 'Converted' : 'Valid'));
      statusBadgeClass = qs ? qs.badgeClass : (status === 'Void' ? 'bg-danger' : 'bg-secondary');
      if (qs && qs.badgeText && status === 'Valid') metaNote = qs.badgeText;
      if (rec.convertedToInvoice) {
        linkedRef = `Inv: ${rec.convertedToInvoice}`;
        linkedUrl = `invoice.html?no=${encodeURIComponent(rec.convertedToInvoice)}`;
      }
      canConvert = !isVoid && !rec.converted;
    } else if (type === 'invoice') {
      originalAmount = _round(Number(rec.grandTotal || 0) || 0);
      const stats = (!isVoid && typeof root.getInvoicePaymentStats === 'function')
        ? root.getInvoicePaymentStats(rec)
        : null;
      amount = isVoid ? originalAmount : (stats ? _round(stats.total) : originalAmount);
      due = isVoid ? 0 : (stats ? _round(stats.due) : originalAmount);
      paid = isVoid ? 0 : (stats ? _round(stats.paid) : 0);
      isAdjusted = !isVoid && stats && Math.abs(_round(stats.adjustmentAmount || 0)) > 0;
      if (isVoid) {
        status = 'Void';
        statusBadgeClass = 'bg-danger';
      } else if (stats && stats.isOverdue) {
        status = 'Overdue';
        statusBadgeClass = 'bg-danger-subtle text-danger border border-danger-subtle';
      } else if (stats && stats.status === 'Paid') {
        status = 'Paid';
        statusBadgeClass = 'bg-success-subtle text-success border border-success-subtle';
      } else if (stats && stats.status === 'Partial') {
        status = 'Partial';
        statusBadgeClass = 'bg-warning-subtle text-warning-emphasis border border-warning-subtle';
      } else {
        status = 'Unpaid';
        statusBadgeClass = 'bg-secondary-subtle text-secondary border border-secondary-subtle';
      }
      const chList = _parseChallanList(rec);
      if (chList.length) {
        linkedRef = `Ch: ${chList.join(', ')}`;
        linkedUrl = `challan.html?no=${encodeURIComponent(chList[0])}`;
      } else if (rec.linkedQuotation) {
        linkedRef = `Qtn: ${rec.linkedQuotation}`;
        linkedUrl = `quotation.html?no=${encodeURIComponent(rec.linkedQuotation)}`;
      }
      if (!isVoid && typeof root.getInvoiceDispatchStats === 'function') {
        dispatchInfo = root.getInvoiceDispatchStats(rec);
        if (dispatchInfo && dispatchInfo.challans.length) {
          metaNote = dispatchInfo.status;
        }
      }
      canConvert = !isVoid && due > 0;
    } else if (type === 'challan') {
      const invoicedBySet = ctx && ctx.invoicedChallans ? ctx.invoicedChallans.get(num) : '';
      const invTarget = String(rec.linkedInvoice || invoicedBySet || '').trim();
      if (isVoid) {
        status = 'Void';
        statusBadgeClass = 'bg-danger';
      } else if (invTarget) {
        status = 'Invoiced';
        statusBadgeClass = 'bg-primary-subtle text-primary border border-primary-subtle';
        linkedRef = `Inv: ${invTarget}`;
        linkedUrl = `invoice.html?no=${encodeURIComponent(invTarget)}`;
        if (typeof root.getInvoiceDispatchStats === 'function') {
          dispatchInfo = root.getInvoiceDispatchStats(invTarget);
          if (dispatchInfo && dispatchInfo.challans && dispatchInfo.challans.length) metaNote = dispatchInfo.status;
        }
      } else {
        status = 'Open';
        statusBadgeClass = 'bg-info-subtle text-info-emphasis border border-info-subtle';
      }
      const totalQty = _round(items.reduce((s, it) => s + (Number(it.qty || 0) || 0), 0));
      amount = totalQty;
      metaNote = metaNote ? `${metaNote} · ${items.length} item(s)` : `${items.length} item(s), Qty ${totalQty}`;
      canConvert = !isVoid && !invTarget;
    } else if (type === 'receipt') {
      amount = _round(Number(rec.amount || 0) || 0);
      const invRef = String(rec.invoiceNumber || rec.linkedInvoice || '').trim();
      const invStats = (!isVoid && invRef && typeof root.getInvoicePaymentStats === 'function')
        ? root.getInvoicePaymentStats(invRef)
        : null;
      due = isVoid
        ? 0
        : (invStats && invStats.status !== 'Unknown'
          ? _round(invStats.due)
          : _round(Math.max(0, Number(rec.due || 0) || 0)));
      const adjAmt = (rec.adjustment && rec.adjustment.applied)
        ? _round(Number(rec.adjustment.amount || 0))
        : 0;
      isAdjusted = !isVoid && !!(rec.adjustment && rec.adjustment.applied);
      if (isVoid) {
        status = 'Void';
        statusBadgeClass = 'bg-danger';
      } else if (due <= 0) {
        status = 'Settled';
        statusBadgeClass = 'bg-success-subtle text-success border border-success-subtle';
      } else {
        status = 'Partial';
        statusBadgeClass = 'bg-warning-subtle text-warning-emphasis border border-warning-subtle';
      }
      if (invRef) {
        linkedRef = `Inv: ${invRef}`;
        linkedUrl = `invoice.html?no=${encodeURIComponent(invRef)}`;
      }
      if (isAdjusted && Math.abs(adjAmt) > 0) {
        const sign = adjAmt > 0 ? '-' : '+';
        metaNote = `Adj ${sign}${_fmtBDT(Math.abs(adjAmt))}`;
      } else if (isAdjusted) {
        metaNote = 'Adjusted';
      }
    }

    const itemText = items.map(it => `${it.name || ''} ${it.desc || ''}`).join(' ');
    const searchBlob = [
      num, clientName, clientCompany, clientPhone, title, billerName, billerId,
      linkedRef, rec.invoiceNumber, rec.linkedInvoice, rec.linkedChallan, rec.linkedQuotation,
      rec.convertedToInvoice, rec.trxRef, method, status, itemText
    ].filter(Boolean).join(' ').toLowerCase();

    return {
      raw: rec,
      number: num,
      date,
      clientName,
      clientPhone,
      title,
      billerId,
      billerName,
      status,
      statusBadgeClass,
      isVoid,
      isAdjusted,
      amount,
      originalAmount,
      due,
      paid,
      method,
      linkedRef,
      linkedUrl,
      metaNote,
      canConvert,
      isDiskOnly: !!rec.__diskOnly,
      searchBlob
    };
  }

  function _parseChallanList(rec) {
    if (!rec) return [];
    if (Array.isArray(rec.linkedChallans) && rec.linkedChallans.length) {
      return rec.linkedChallans.map(c => String(c || '').trim()).filter(Boolean);
    }
    if (rec.linkedChallan) {
      return String(rec.linkedChallan).split(',').map(c => c.trim()).filter(Boolean);
    }
    return [];
  }

  function _buildContext(type) {
    const ctx = { billerMap: _buildBillerMap(), invoicedChallans: new Map() };
    if (type === 'challan' && typeof root.loadInvoices === 'function') {
      (root.loadInvoices() || []).forEach(inv => {
        if (!inv || inv.status === 'Void') return;
        const invNo = inv.invoiceNumber || inv.number || '';
        _parseChallanList(inv).forEach(chNo => {
          if (chNo && !ctx.invoicedChallans.has(chNo)) ctx.invoicedChallans.set(chNo, invNo);
        });
      });
    }
    return ctx;
  }

  /**
   * Pure filtering and sorting helper for document lists (tested directly in CLI/UI tests).
   * @param {Array} records Raw or pre-enriched records.
   * @param {Object} opts { type, query, billerId, status, method, sortBy }
   * @returns {Array} Enriched matching rows sorted per sortBy.
   */
  function filterAndSortRecords(records, opts) {
    const o = opts || {};
    const type = o.type || 'invoice';
    const q = String(o.query || '').trim().toLowerCase();
    const billerFilter = String(o.billerId || 'all').trim();
    const statusFilter = String(o.status || 'all').trim().toLowerCase();
    const methodFilter = String(o.method || 'all').trim().toLowerCase();
    const sortBy = o.sortBy || 'date_desc';
    const ctx = o._ctx || _buildContext(type);

    const rows = (Array.isArray(records) ? records : []).map(r => enrichRecord(r, type, ctx));

    const filtered = rows.filter(row => {
      if (q && !row.searchBlob.includes(q)) return false;
      if (billerFilter !== 'all' && billerFilter !== '' && row.billerId !== billerFilter) return false;
      if (statusFilter !== 'all' && statusFilter !== '') {
        if (type === 'receipt' && statusFilter === 'adjusted') {
          if (!row.isAdjusted || row.isVoid) return false;
        } else if (row.status.toLowerCase() !== statusFilter) {
          return false;
        }
      }
      if (type === 'receipt' && methodFilter !== 'all' && methodFilter !== '') {
        if (row.method.toLowerCase() !== methodFilter) return false;
      }
      return true;
    });

    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'date_asc':
          return (a.date || '').localeCompare(b.date || '') || a.number.localeCompare(b.number);
        case 'amount_desc':
          return (b.amount - a.amount) || (b.date || '').localeCompare(a.date || '');
        case 'amount_asc':
          return (a.amount - b.amount) || (b.date || '').localeCompare(a.date || '');
        case 'due_desc':
          return (b.due - a.due) || (b.date || '').localeCompare(a.date || '');
        case 'number_asc':
          return a.number.localeCompare(b.number, undefined, { numeric: true });
        case 'number_desc':
          return b.number.localeCompare(a.number, undefined, { numeric: true });
        case 'client_asc':
          return (a.clientName || '').localeCompare(b.clientName || '') || (b.date || '').localeCompare(a.date || '');
        case 'date_desc':
        default:
          return (b.date || '').localeCompare(a.date || '') || b.number.localeCompare(a.number, undefined, { numeric: true });
      }
    });

    return filtered;
  }

  const STATUS_OPTIONS = {
    quotation: [
      { value: 'all', label: 'All Statuses' },
      { value: 'valid', label: 'Valid / Active' },
      { value: 'converted', label: 'Converted' },
      { value: 'expired', label: 'Expired' },
      { value: 'void', label: 'Void' }
    ],
    invoice: [
      { value: 'all', label: 'All Statuses' },
      { value: 'unpaid', label: 'Unpaid' },
      { value: 'partial', label: 'Partial' },
      { value: 'overdue', label: 'Overdue' },
      { value: 'paid', label: 'Paid' },
      { value: 'void', label: 'Void' }
    ],
    challan: [
      { value: 'all', label: 'All Statuses' },
      { value: 'open', label: 'Open (Not Invoiced)' },
      { value: 'invoiced', label: 'Invoiced' },
      { value: 'void', label: 'Void' }
    ],
    receipt: [
      { value: 'all', label: 'All Statuses' },
      { value: 'settled', label: 'Settled (0 Due)' },
      { value: 'partial', label: 'Partial (Due > 0)' },
      { value: 'adjusted', label: 'Adjusted' },
      { value: 'void', label: 'Void' }
    ]
  };

  const DOC_LABELS = {
    quotation: { singular: 'Quotation', plural: 'Quotations', amountCol: 'Total (৳)' },
    invoice: { singular: 'Invoice', plural: 'Invoices', amountCol: 'Total / Due' },
    challan: { singular: 'Challan', plural: 'Challans', amountCol: 'Items / Qty' },
    receipt: { singular: 'Receipt', plural: 'Receipts', amountCol: 'Received / Due' }
  };

  function _ensureInvoicePickerModal() {
    let modalEl = document.getElementById('invoicePickerModal');
    if (modalEl) return modalEl;

    modalEl = document.createElement('div');
    modalEl.id = 'invoicePickerModal';
    modalEl.className = 'modal no-print';
    modalEl.tabIndex = -1;
    modalEl.setAttribute('aria-labelledby', 'invoicePickerModalTitle');
    modalEl.setAttribute('aria-hidden', 'true');
    modalEl.innerHTML = `
      <div class="modal-dialog modal-xl modal-dialog-scrollable">
        <div class="modal-content">
          <div class="modal-header py-2">
            <div>
              <h2 class="modal-title h5 mb-0" id="invoicePickerModalTitle">Generate from Invoice</h2>
              <p class="small text-muted mb-0" id="invoicePickerModalSub">Select an invoice to prefill document details and line items.</p>
            </div>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body">
            <div class="row g-2 align-items-end mb-3">
              <div class="col-md-5">
                <label for="invPickerSearchInput" class="form-label small fw-semibold mb-1">Search Invoices</label>
                <input type="search" id="invPickerSearchInput" class="form-control form-control-sm" placeholder="Invoice #, client, subject, or item...">
              </div>
              <div class="col-md-3">
                <label for="invPickerBillerSelect" class="form-label small fw-semibold mb-1">Biller</label>
                <select id="invPickerBillerSelect" class="form-select form-select-sm"></select>
              </div>
              <div class="col-md-4 d-flex align-items-center justify-content-md-end pt-2">
                <div class="form-check form-switch mb-0">
                  <input class="form-check-input" type="checkbox" id="invPickerShowCompleted">
                  <label class="form-check-label small" for="invPickerShowCompleted" id="invPickerShowCompletedLabel">Include settled / completed</label>
                </div>
              </div>
            </div>
            <div class="table-responsive border rounded">
              <table class="table table-hover table-sm align-middle mb-0">
                <caption class="visually-hidden">Invoices available to generate a linked document</caption>
                <thead class="table-light">
                  <tr>
                    <th scope="col">Invoice #</th>
                    <th scope="col" class="d-none d-sm-table-cell">Date</th>
                    <th scope="col">Client</th>
                    <th scope="col" class="d-none d-md-table-cell">Biller</th>
                    <th scope="col" class="text-end">Total (৳)</th>
                    <th scope="col" id="invPickerMetricCol">Status / Remaining</th>
                    <th scope="col" class="text-end">Action</th>
                  </tr>
                </thead>
                <tbody id="invPickerTbody"></tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modalEl);
    return modalEl;
  }

  let _pickerState = null;

  /**
   * Opens a shared modal to pick an Invoice and pass the full invoice object to onSelect(inv).
   * @param {Object} opts { mode: 'receipt'|'challan', title, subtitle, onSelect }
   */
  async function openInvoicePicker(opts) {
    const options = opts || {};
    const mode = options.mode === 'challan' ? 'challan' : 'receipt';
    const modalEl = _ensureInvoicePickerModal();

    const titleEl = modalEl.querySelector('#invoicePickerModalTitle');
    const subEl = modalEl.querySelector('#invoicePickerModalSub');
    const searchEl = modalEl.querySelector('#invPickerSearchInput');
    const billerEl = modalEl.querySelector('#invPickerBillerSelect');
    const completedEl = modalEl.querySelector('#invPickerShowCompleted');
    const completedLbl = modalEl.querySelector('#invPickerShowCompletedLabel');
    const metricCol = modalEl.querySelector('#invPickerMetricCol');
    const tbody = modalEl.querySelector('#invPickerTbody');

    titleEl.textContent = options.title || (mode === 'challan' ? 'Generate Challan from Invoice' : 'Generate Receipt from Invoice');
    subEl.textContent = options.subtitle || (mode === 'challan'
      ? 'Choose an invoice to load client, delivery details, and remaining undelivered items.'
      : 'Choose an invoice to link payment, review line items, and adjust the agreed amount if needed.');
    completedLbl.textContent = mode === 'challan' ? 'Include fully delivered invoices' : 'Include fully paid invoices';
    metricCol.textContent = mode === 'challan' ? 'Dispatch Status' : 'Balance Due';

    const billers = typeof root.loadBillers === 'function' ? (root.loadBillers() || []) : [];
    billerEl.innerHTML = `<option value="all">All Billers</option>` +
      billers.map(b => `<option value="${_escAttr(b.id)}">${_escHtml(b.name || b.id)}</option>`).join('');

    searchEl.value = '';
    completedEl.checked = false;

    const localInvs = typeof root.loadInvoices === 'function' ? (root.loadInvoices() || []) : [];
    const seen = new Set(localInvs.map(inv => getDocNumber(inv, 'invoice')));
    let combined = localInvs.slice();

    if (typeof root.loadDiskInvoicesSummaries === 'function') {
      try {
        let disk = await root.loadDiskInvoicesSummaries();
        if (!disk.length && typeof root.autoDiscoverSummaries === 'function') {
          disk = await root.autoDiscoverSummaries('invoices');
        }
        (disk || []).forEach(d => {
          const no = getDocNumber(d, 'invoice');
          if (no && !seen.has(no)) {
            seen.add(no);
            combined.push(Object.assign({}, d, { __diskOnly: true }));
          }
        });
      } catch (_) {}
    }

    _pickerState = { mode, combined, onSelect: options.onSelect };

    function renderRows() {
      if (!_pickerState) return;
      const includeDone = completedEl.checked;
      const rows = filterAndSortRecords(_pickerState.combined, {
        type: 'invoice',
        query: searchEl.value,
        billerId: billerEl.value,
        status: 'all',
        sortBy: 'date_desc'
      }).filter(row => !row.isVoid);

      const visible = rows.filter(row => {
        if (includeDone) return true;
        if (mode === 'challan') {
          const ds = row.raw.__diskOnly ? null : (typeof root.getInvoiceDispatchStats === 'function' ? root.getInvoiceDispatchStats(row.raw) : null);
          return !ds || ds.status !== 'Fully Delivered';
        }
        return row.due > 0;
      });

      if (!visible.length) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted py-4">No matching invoices found. Toggle "${_escHtml(completedLbl.textContent)}" or clear search filters.</td></tr>`;
        return;
      }

      tbody.innerHTML = visible.map(row => {
        let metricHtml = '';
        if (mode === 'challan') {
          const ds = !row.raw.__diskOnly && typeof root.getInvoiceDispatchStats === 'function'
            ? root.getInvoiceDispatchStats(row.raw)
            : null;
          if (!ds || ds.challans.length === 0) {
            metricHtml = `<span class="badge bg-info-subtle text-info-emphasis border border-info-subtle">Pending Dispatch</span>`;
          } else if (ds.status === 'Partially Delivered') {
            metricHtml = `<span class="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle">Partial (${_round(ds.totalRemainingQty)} left)</span>`;
          } else {
            metricHtml = `<span class="badge bg-success-subtle text-success border border-success-subtle">Fully Delivered</span>`;
          }
        } else {
          metricHtml = row.due > 0
            ? `<span class="fw-semibold text-danger">${_escHtml(_fmtBDT(row.due))}</span>`
            : `<span class="badge bg-success-subtle text-success border border-success-subtle">Paid</span>`;
        }
        const origNote = row.isAdjusted
          ? `<div class="small text-muted" style="font-size:0.75em">Orig: ${_escHtml(_fmtBDT(row.originalAmount))}</div>`
          : '';
        return `
          <tr>
            <td class="fw-semibold text-nowrap">
              ${_escHtml(row.number)}${row.isDiskOnly ? ' <span class="badge bg-secondary-subtle text-body border">Disk</span>' : ''}
              <div class="small text-muted d-sm-none" style="font-size:0.72em">${_escHtml(_fmtDate(row.date))}</div>
            </td>
            <td class="text-nowrap small d-none d-sm-table-cell">${_escHtml(_fmtDate(row.date))}</td>
            <td>
              <div class="fw-medium">${_escHtml(row.clientName || '—')}</div>
              ${row.title ? `<div class="small text-muted text-truncate" style="max-width:220px">${_escHtml(row.title)}</div>` : ''}
            </td>
            <td class="small text-muted d-none d-md-table-cell">${_escHtml(row.billerName)}</td>
            <td class="text-end text-nowrap">${_escHtml(_fmtBDT(row.amount))}${origNote}</td>
            <td>${metricHtml}</td>
            <td class="text-end">
              <button type="button" class="btn btn-sm btn-primary picker-select-inv-btn" data-inv="${_escAttr(row.number)}">
                Select
              </button>
            </td>
          </tr>
        `;
      }).join('');
    }

    if (!modalEl.dataset.wired) {
      modalEl.dataset.wired = '1';
      let timer = null;
      searchEl.addEventListener('input', () => {
        clearTimeout(timer);
        timer = setTimeout(renderRows, 120);
      });
      billerEl.addEventListener('change', renderRows);
      completedEl.addEventListener('change', renderRows);
      tbody.addEventListener('click', async (e) => {
        const btn = e.target.closest('.picker-select-inv-btn');
        if (!btn || !_pickerState) return;
        const invNo = btn.getAttribute('data-inv');
        let inv = typeof root.getInvoiceByNumber === 'function' ? root.getInvoiceByNumber(invNo) : null;
        if (!inv && typeof root.getDiskInvoiceByNumber === 'function') {
          try { inv = await root.getDiskInvoiceByNumber(invNo); } catch (_) {}
        }
        if (!inv) {
          inv = _pickerState.combined.find(x => getDocNumber(x, 'invoice') === invNo) || null;
        }
        if (!inv) return;
        if (root.bootstrap && root.bootstrap.Modal) {
          const inst = root.bootstrap.Modal.getOrCreateInstance(modalEl);
          if (inst._isTransitioning) {
            modalEl.addEventListener('shown.bs.modal', () => {
              try { inst.hide(); } catch (_) {}
            }, { once: true });
          } else {
            try { inst.hide(); } catch (_) {}
          }
        }
        if (typeof _pickerState.onSelect === 'function') {
          _pickerState.onSelect(inv);
        }
      });
    }

    renderRows();
    if (root.bootstrap && root.bootstrap.Modal) {
      const inst = root.bootstrap.Modal.getOrCreateInstance(modalEl);
      inst.show();
      setTimeout(() => { try { searchEl.focus(); } catch (_) {} }, 160);
    }
  }

  /**
   * Initializes a per-document List View inside `config.containerId`.
   */
  function init(config) {
    const cfg = config || {};
    const type = cfg.type || 'invoice';
    const meta = DOC_LABELS[type] || DOC_LABELS.invoice;
    const container = document.getElementById(cfg.containerId || 'docListSection');
    if (!container) return null;

    const uid = `dl_${type}`;
    const statusOpts = STATUS_OPTIONS[type] || STATUS_OPTIONS.invoice;
    const showMethodFilter = type === 'receipt';

    container.innerHTML = `
      <div class="doc-list-shell">
        <div class="row g-2 mb-3" id="${uid}_kpis"></div>

        <div class="card border shadow-sm mb-3">
          <div class="card-body py-2 px-3">
            <div class="row g-2 align-items-end">
              <div class="${showMethodFilter ? 'col-lg-3 col-md-6' : 'col-lg-4 col-md-6'}">
                <label for="${uid}_search" class="form-label small fw-semibold mb-1">Search ${_escHtml(meta.plural)}</label>
                <div class="input-group input-group-sm">
                  <span class="input-group-text bg-transparent" aria-hidden="true">🔍</span>
                  <input type="search" id="${uid}_search" class="form-control" placeholder="Doc #, client, subject, ref, or item...">
                </div>
              </div>
              <div class="col-lg-2 col-md-6">
                <label for="${uid}_biller" class="form-label small fw-semibold mb-1">Biller</label>
                <select id="${uid}_biller" class="form-select form-select-sm"></select>
              </div>
              <div class="col-lg-2 col-md-4">
                <label for="${uid}_status" class="form-label small fw-semibold mb-1">Status</label>
                <select id="${uid}_status" class="form-select form-select-sm">
                  ${statusOpts.map(o => `<option value="${_escAttr(o.value)}">${_escHtml(o.label)}</option>`).join('')}
                </select>
              </div>
              ${showMethodFilter ? `
              <div class="col-lg-2 col-md-4">
                <label for="${uid}_method" class="form-label small fw-semibold mb-1">Method</label>
                <select id="${uid}_method" class="form-select form-select-sm">
                  <option value="all">All Methods</option>
                  <option value="Cash">Cash</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Cheque">Cheque</option>
                  <option value="bKash">bKash</option>
                  <option value="Nagad">Nagad</option>
                  <option value="Rocket">Rocket</option>
                  <option value="Card / POS">Card / POS</option>
                  <option value="Mobile Banking">Mobile Banking</option>
                  <option value="Other">Other</option>
                </select>
              </div>` : ''}
              <div class="col-lg-3 col-md-4">
                <label for="${uid}_sort" class="form-label small fw-semibold mb-1">Sort By</label>
                <select id="${uid}_sort" class="form-select form-select-sm">
                  <option value="date_desc">Date (Newest first)</option>
                  <option value="date_asc">Date (Oldest first)</option>
                  <option value="amount_desc">${type === 'challan' ? 'Qty (Highest)' : 'Amount (Highest)'}</option>
                  <option value="amount_asc">${type === 'challan' ? 'Qty (Lowest)' : 'Amount (Lowest)'}</option>
                  ${(type === 'invoice' || type === 'receipt') ? '<option value="due_desc">Balance Due (Highest)</option>' : ''}
                  <option value="number_desc">Doc # (Descending)</option>
                  <option value="number_asc">Doc # (Ascending)</option>
                  <option value="client_asc">Client Name (A–Z)</option>
                </select>
              </div>
              <div class="col-lg-auto col-md-4 d-flex gap-2">
                <button type="button" id="${uid}_clear" class="btn btn-sm btn-outline-secondary">Reset Filters</button>
              </div>
            </div>
            <div class="d-flex justify-content-between align-items-center mt-2 pt-2 border-top small text-muted">
              <span id="${uid}_summary" aria-live="polite">Loading...</span>
              <a href="search.html" class="text-decoration-none">Cross-Document Archive &rarr;</a>
            </div>
          </div>
        </div>

        <div class="card border shadow-sm">
          <div class="table-responsive">
            <table class="table table-hover table-sm align-middle mb-0">
              <caption class="visually-hidden">${_escHtml(meta.plural)} list with search, filters, and actions</caption>
              <thead class="table-light">
                <tr>
                  <th scope="col">${_escHtml(meta.singular)} #</th>
                  <th scope="col" class="d-none d-sm-table-cell">Date</th>
                  <th scope="col">Client / Subject</th>
                  <th scope="col" class="d-none d-md-table-cell">Biller</th>
                  <th scope="col" class="d-none d-lg-table-cell">Linked Ref</th>
                  <th scope="col" class="text-end">${_escHtml(meta.amountCol)}</th>
                  <th scope="col" class="d-none d-sm-table-cell">Status</th>
                  <th scope="col" class="text-end">Actions</th>
                </tr>
              </thead>
              <tbody id="${uid}_tbody"></tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    const searchEl = document.getElementById(`${uid}_search`);
    const billerEl = document.getElementById(`${uid}_biller`);
    const statusEl = document.getElementById(`${uid}_status`);
    const methodEl = showMethodFilter ? document.getElementById(`${uid}_method`) : null;
    const sortEl = document.getElementById(`${uid}_sort`);
    const clearEl = document.getElementById(`${uid}_clear`);
    const summaryEl = document.getElementById(`${uid}_summary`);
    const kpiEl = document.getElementById(`${uid}_kpis`);
    const tbody = document.getElementById(`${uid}_tbody`);

    let cachedDiskRecords = [];
    let diskLoaded = false;

    function populateBillers() {
      const prev = billerEl.value || 'all';
      const billers = typeof root.loadBillers === 'function' ? (root.loadBillers() || []) : [];
      billerEl.innerHTML = `<option value="all">All Billers</option>` +
        billers.map(b => `<option value="${_escAttr(b.id)}">${_escHtml(b.name || b.id)}</option>`).join('');
      billerEl.value = Array.from(billerEl.options).some(o => o.value === prev) ? prev : 'all';
    }

    function getAllRawRecords() {
      const local = typeof cfg.getRecords === 'function' ? (cfg.getRecords() || []) : [];
      const seen = new Set(local.map(r => getDocNumber(r, type)));
      const merged = local.slice();
      cachedDiskRecords.forEach(d => {
        const no = getDocNumber(d, type);
        if (no && !seen.has(no)) {
          seen.add(no);
          merged.push(Object.assign({}, d, { __diskOnly: true }));
        }
      });
      return merged;
    }

    function renderKPIs(allRows) {
      const nonVoid = allRows.filter(r => !r.isVoid);
      let cards = [];
      if (type === 'quotation') {
        const validCount = nonVoid.filter(r => r.status === 'Valid').length;
        const convCount = nonVoid.filter(r => r.status === 'Converted').length;
        const expCount = nonVoid.filter(r => r.status === 'Expired').length;
        cards = [
          { label: 'Total Quotations', val: String(nonVoid.length) },
          { label: 'Active / Valid', val: String(validCount), cls: 'text-success' },
          { label: 'Converted', val: String(convCount), cls: 'text-primary' },
          { label: 'Expired', val: String(expCount), cls: expCount ? 'text-danger' : '' }
        ];
      } else if (type === 'invoice') {
        const billed = _round(nonVoid.reduce((s, r) => s + r.amount, 0));
        const due = _round(nonVoid.reduce((s, r) => s + r.due, 0));
        const overdue = nonVoid.filter(r => r.status === 'Overdue').length;
        cards = [
          { label: 'Active Invoices', val: String(nonVoid.length) },
          { label: 'Effective Billed', val: _fmtBDT(billed) },
          { label: 'Receivables Due', val: _fmtBDT(due), cls: due > 0 ? 'text-danger' : 'text-success' },
          { label: 'Overdue Count', val: String(overdue), cls: overdue ? 'text-danger' : '' }
        ];
      } else if (type === 'challan') {
        const openCount = nonVoid.filter(r => r.status === 'Open').length;
        const invCount = nonVoid.filter(r => r.status === 'Invoiced').length;
        const totalQty = _round(nonVoid.reduce((s, r) => s + r.amount, 0));
        cards = [
          { label: 'Total Challans', val: String(nonVoid.length) },
          { label: 'Open (Uninvoiced)', val: String(openCount), cls: openCount ? 'text-info-emphasis' : '' },
          { label: 'Linked to Invoice', val: String(invCount), cls: 'text-primary' },
          { label: 'Dispatched Qty', val: String(totalQty) }
        ];
      } else if (type === 'receipt') {
        const received = _round(nonVoid.reduce((s, r) => s + r.amount, 0));
        const adjCount = nonVoid.filter(r => r.isAdjusted).length;
        const settled = nonVoid.filter(r => r.status === 'Settled').length;
        cards = [
          { label: 'Active Receipts', val: String(nonVoid.length) },
          { label: 'Total Collected', val: _fmtBDT(received), cls: 'text-success' },
          { label: 'Settled Receipts', val: String(settled) },
          { label: 'With Adjustments', val: String(adjCount) }
        ];
      }

      kpiEl.innerHTML = cards.map(c => `
        <div class="col-6 col-md-3">
          <div class="card border shadow-sm h-100">
            <div class="card-body py-2 px-3">
              <div class="small text-muted">${_escHtml(c.label)}</div>
              <div class="h6 mb-0 fw-bold ${_escAttr(c.cls || '')}">${_escHtml(c.val)}</div>
            </div>
          </div>
        </div>
      `).join('');
    }

    function renderActionButtons(row) {
      const no = _escAttr(row.number);
      const btns = [];
      btns.push(`<button type="button" class="btn btn-outline-primary dl-open-btn" data-no="${no}" title="Open ${no}" aria-label="Open ${_escAttr(row.number)}">Open</button>`);
      if (type === 'quotation' && row.canConvert) {
        btns.push(`<a href="invoice.html?qtn=${encodeURIComponent(row.number)}" class="btn btn-outline-success" title="Convert to Invoice" aria-label="Convert ${_escAttr(row.number)} to Invoice">Invoice</a>`);
      } else if (type === 'invoice' && !row.isVoid) {
        if (row.due > 0) {
          btns.push(`<a href="receipt.html?inv=${encodeURIComponent(row.number)}" class="btn btn-outline-success" title="Receive Payment" aria-label="Receive payment for ${_escAttr(row.number)}">Receipt</a>`);
        }
        btns.push(`<a href="challan.html?inv=${encodeURIComponent(row.number)}" class="btn btn-outline-secondary d-none d-sm-inline-block" title="Create Challan" aria-label="Create challan for ${_escAttr(row.number)}">Challan</a>`);
      } else if (type === 'challan' && row.canConvert) {
        btns.push(`<a href="invoice.html?ch=${encodeURIComponent(row.number)}" class="btn btn-outline-success" title="Convert to Invoice" aria-label="Convert ${_escAttr(row.number)} to Invoice">Invoice</a>`);
      }
      if (!row.isDiskOnly) {
        const voidLabel = row.isVoid ? 'Restore' : 'Void';
        btns.push(`<button type="button" class="btn btn-outline-warning dl-void-btn d-none d-md-inline-block" data-no="${no}" aria-label="${voidLabel} ${_escAttr(row.number)}">${voidLabel}</button>`);
        btns.push(`<button type="button" class="btn btn-outline-danger dl-del-btn d-none d-md-inline-block" data-no="${no}" aria-label="Delete ${_escAttr(row.number)}">Del</button>`);
      }
      return `<div class="btn-group btn-group-sm dl-action-group" role="group" aria-label="Actions for ${_escAttr(row.number)}">${btns.join('')}</div>`;
    }

    function refresh() {
      populateBillers();
      const ctx = _buildContext(type);
      const raw = getAllRawRecords();
      const allRows = filterAndSortRecords(raw, { type, status: 'all', billerId: 'all', sortBy: 'date_desc', _ctx: ctx });
      renderKPIs(allRows);

      const badgeEl = cfg.countBadgeId ? document.getElementById(cfg.countBadgeId) : null;
      if (badgeEl) badgeEl.textContent = String(allRows.length);

      const filtered = filterAndSortRecords(raw, {
        type,
        query: searchEl.value,
        billerId: billerEl.value,
        status: statusEl.value,
        method: methodEl ? methodEl.value : 'all',
        sortBy: sortEl.value,
        _ctx: ctx
      });

      summaryEl.textContent = `Showing ${filtered.length} of ${allRows.length} ${meta.plural.toLowerCase()}`;

      if (!filtered.length) {
        const isEmptyRepo = allRows.length === 0;
        tbody.innerHTML = `
          <tr>
            <td colspan="8" class="text-center py-5 text-muted">
              <div class="mb-2">${isEmptyRepo ? `No ${meta.plural.toLowerCase()} saved yet.` : `No ${meta.plural.toLowerCase()} match your search or filter criteria.`}</div>
              ${isEmptyRepo
                ? `<button type="button" class="btn btn-sm btn-primary dl-empty-new-btn">+ Create First ${_escHtml(meta.singular)}</button>`
                : `<button type="button" class="btn btn-sm btn-outline-secondary dl-empty-reset-btn">Clear Filters</button>`}
            </td>
          </tr>
        `;
        return;
      }

      tbody.innerHTML = filtered.map(row => {
        let amtHtml = '';
        if (type === 'invoice') {
          const origHtml = row.isAdjusted ? `<div class="small text-muted" style="font-size:0.75em">Orig: ${_escHtml(_fmtBDT(row.originalAmount))}</div>` : '';
          const dueHtml = (!row.isVoid && row.due > 0) ? `<div class="small text-danger" style="font-size:0.75em">Due: ${_escHtml(_fmtBDT(row.due))}</div>` : '';
          amtHtml = `<div class="fw-semibold">${_escHtml(_fmtBDT(row.amount))}</div>${origHtml}${dueHtml}`;
        } else if (type === 'receipt') {
          const dueHtml = (!row.isVoid && row.due > 0) ? `<div class="small text-danger" style="font-size:0.75em">Due: ${_escHtml(_fmtBDT(row.due))}</div>` : '';
          const methHtml = row.method ? `<div class="small text-muted" style="font-size:0.75em">${_escHtml(row.method)}</div>` : '';
          amtHtml = `<div class="fw-semibold">${_escHtml(_fmtBDT(row.amount))}</div>${methHtml}${dueHtml}`;
        } else if (type === 'challan') {
          const itemCount = Array.isArray(row.raw.items) ? row.raw.items.length : 0;
          amtHtml = `<div class="fw-semibold">${itemCount} item(s)</div><div class="small text-muted" style="font-size:0.75em">Qty ${_escHtml(String(row.amount))}</div>`;
        } else {
          amtHtml = `<div class="fw-semibold">${_escHtml(_fmtBDT(row.amount))}</div>`;
        }

        const linkedHtml = row.linkedRef
          ? `<a href="${_escAttr(row.linkedUrl)}" class="small text-decoration-none">${_escHtml(row.linkedRef)}</a>`
          : `<span class="small text-muted">—</span>`;
        const metaNoteHtml = row.metaNote
          ? `<div class="small text-muted mt-1" style="font-size:0.75em">${_escHtml(row.metaNote)}</div>`
          : '';

        return `
          <tr class="${row.isVoid ? 'opacity-75' : ''}">
            <td class="text-nowrap">
              <div>
                <button type="button" class="btn btn-link btn-sm p-0 fw-semibold text-decoration-none dl-open-btn" data-no="${_escAttr(row.number)}">
                  ${_escHtml(row.number)}
                </button>
              </div>
              <div class="small text-muted" style="font-size:0.72em">
                <span class="badge ${_escAttr(row.statusBadgeClass)} d-sm-none me-1" style="font-size:0.85em">${_escHtml(row.status)}</span>
                <span class="d-sm-none">${_escHtml(_fmtDate(row.date))}</span>
              </div>
              ${row.isDiskOnly ? '<div><span class="badge bg-secondary-subtle text-body border" style="font-size:0.65em">Disk</span></div>' : ''}
            </td>
            <td class="text-nowrap small d-none d-sm-table-cell">${_escHtml(_fmtDate(row.date))}</td>
            <td>
              <div class="fw-medium text-truncate dl-client-cell" style="max-width:105px">${_escHtml(row.clientName || '—')}</div>
              ${row.title ? `<div class="small text-muted text-truncate d-none d-sm-block" style="max-width:240px">${_escHtml(row.title)}</div>` : ''}
            </td>
            <td class="small text-muted d-none d-md-table-cell">${_escHtml(row.billerName)}</td>
            <td class="d-none d-lg-table-cell">${linkedHtml}</td>
            <td class="text-end text-nowrap">${amtHtml}</td>
            <td class="d-none d-sm-table-cell">
              <span class="badge ${_escAttr(row.statusBadgeClass)}">${_escHtml(row.status)}</span>
              ${metaNoteHtml}
            </td>
            <td class="text-end text-nowrap">${renderActionButtons(row)}</td>
          </tr>
        `;
      }).join('');
    }

    let searchTimer = null;
    searchEl.addEventListener('input', () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(refresh, 150);
    });
    billerEl.addEventListener('change', refresh);
    statusEl.addEventListener('change', refresh);
    if (methodEl) methodEl.addEventListener('change', refresh);
    sortEl.addEventListener('change', refresh);
    clearEl.addEventListener('click', () => {
      searchEl.value = '';
      billerEl.value = 'all';
      statusEl.value = 'all';
      if (methodEl) methodEl.value = 'all';
      sortEl.value = 'date_desc';
      refresh();
    });

    tbody.addEventListener('click', (e) => {
      const openBtn = e.target.closest('.dl-open-btn');
      if (openBtn) {
        const no = openBtn.getAttribute('data-no');
        if (no && typeof cfg.onOpen === 'function') cfg.onOpen(no);
        return;
      }
      const emptyNew = e.target.closest('.dl-empty-new-btn');
      if (emptyNew && typeof cfg.onNew === 'function') {
        cfg.onNew();
        return;
      }
      const emptyReset = e.target.closest('.dl-empty-reset-btn');
      if (emptyReset) {
        clearEl.click();
        return;
      }
      const voidBtn = e.target.closest('.dl-void-btn');
      if (voidBtn) {
        const no = voidBtn.getAttribute('data-no');
        const isCurrentlyVoid = voidBtn.textContent.trim() === 'Restore';
        if (!no || typeof root.toggleVoidRecord !== 'function') return;
        const msg = isCurrentlyVoid
          ? `Restore ${meta.singular} ${no} back to active status?`
          : `Mark ${meta.singular} ${no} as Void? Voided documents are excluded from financial totals.`;
        if (!root.confirm || root.confirm(msg)) {
          root.toggleVoidRecord(type, no);
          refresh();
          if (typeof cfg.onAfterMutate === 'function') cfg.onAfterMutate(no, 'void');
        }
        return;
      }
      const delBtn = e.target.closest('.dl-del-btn');
      if (delBtn) {
        const no = delBtn.getAttribute('data-no');
        if (!no || typeof root.deleteRecordByType !== 'function') return;
        if (!root.confirm || root.confirm(`Permanently delete ${meta.singular} ${no}? This cannot be undone.`)) {
          root.deleteRecordByType(type, no);
          refresh();
          if (typeof root.showToast === 'function') root.showToast(`${meta.singular} ${no} deleted.`, 'info');
          if (typeof cfg.onAfterMutate === 'function') cfg.onAfterMutate(no, 'delete');
        }
      }
    });

    if (typeof root.addEventListener === 'function') {
      root.addEventListener('storagesync', refresh);
      root.addEventListener('billerchange', refresh);
    }

    if (typeof cfg.loadDiskSummaries === 'function' && !diskLoaded) {
      diskLoaded = true;
      Promise.resolve(cfg.loadDiskSummaries()).then(list => {
        if (Array.isArray(list) && list.length) {
          cachedDiskRecords = list;
          refresh();
        }
      }).catch(() => {});
    }

    refresh();
    return {
      refresh,
      focusSearch() { try { searchEl.focus(); } catch (_) {} }
    };
  }

  function _paramsToSearch(params) {
    const p = params || {};
    const keys = ['no', 'rcpt', 'inv', 'ch', 'qtn', 'id', 'load'];
    const qs = new URLSearchParams();
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      if (p[k]) qs.set(k, p[k]);
    }
    if (p.autoprint) qs.set('autoprint', p.autoprint);
    if (!Array.from(qs.keys()).length) qs.set('new', '1');
    return `?${qs.toString()}`;
  }

  /**
   * Connects shared List View <-> Editor View transitions, history routing,
   * dirty-state guards, and invoice picker modal for document pages.
   */
  function connectWorkspace(opts) {
    const o = opts || {};
    const listSection = document.getElementById(o.containerId || 'docListSection');
    const editorSection = document.getElementById(o.editorSectionId || 'docEditorSection');
    const backBtn = document.getElementById('backToListBtn');
    const newBtn = document.getElementById('listNewDocBtn');
    const genBtn = document.getElementById('headerGenFromInvBtn');
    const mainEl = document.getElementById('mainContent');

    const isDirtyFn = typeof o.isDirty === 'function' ? o.isDirty : () => false;
    const resetDirtyFn = typeof o.resetDirty === 'function' ? o.resetDirty : () => {};
    let listCtrl = null;

    function isEditorVisible() {
      return !!(editorSection && !editorSection.classList.contains('d-none'));
    }

    function showEditor(show) {
      if (listSection) listSection.classList.toggle('d-none', !!show);
      if (editorSection) editorSection.classList.toggle('d-none', !show);
      if (backBtn) backBtn.classList.toggle('d-none', !show);
      if (!show && document.body) {
        document.body.classList.remove('prf-mode');
      }
    }

    async function openEditor(params, navOpts) {
      const n = navOpts || {};
      if (isEditorVisible() && isDirtyFn()) {
        if (!root.confirm || !root.confirm('You have unsaved changes. Discard them and continue?')) {
          return false;
        }
      }
      resetDirtyFn();
      if (n.pushHistory !== false && typeof history !== 'undefined' && history.pushState) {
        const nextSearch = _paramsToSearch(params);
        if (window.location.search !== nextSearch) {
          try { history.pushState({ view: 'editor', search: nextSearch }, '', nextSearch); } catch (_) {}
        }
      }
      showEditor(true);
      if (typeof o.loadEditor === 'function') {
        await o.loadEditor(params || { new: '1' }, n);
      }
      resetDirtyFn();
      if (mainEl && typeof mainEl.focus === 'function') {
        try { mainEl.focus({ preventScroll: true }); } catch (_) {}
      }
      return true;
    }

    function enterList(navOpts) {
      const n = navOpts || {};
      if (isEditorVisible() && isDirtyFn()) {
        if (!root.confirm || !root.confirm('You have unsaved changes. Discard them and return to the list?')) {
          return false;
        }
      }
      resetDirtyFn();
      if (typeof o.onEnterList === 'function') o.onEnterList();
      if (typeof root.setCompanyHeader === 'function') root.setCompanyHeader();
      showEditor(false);
      if (n.pushHistory !== false && window.location.search && typeof history !== 'undefined' && history.pushState) {
        try { history.pushState({ view: 'list' }, '', window.location.pathname); } catch (_) {}
      }
      if (listCtrl) listCtrl.refresh();
      if (newBtn && typeof newBtn.focus === 'function') {
        try { newBtn.focus({ preventScroll: true }); } catch (_) {}
      }
      return true;
    }

    listCtrl = init({
      type: o.type,
      containerId: o.containerId || 'docListSection',
      countBadgeId: o.countBadgeId || 'docListCountBadge',
      getRecords: o.getRecords,
      loadDiskSummaries: o.loadDiskSummaries,
      onNew: () => openEditor({ new: '1' }),
      onOpen: (no) => openEditor({ no }),
      onAfterMutate: o.onAfterMutate
    });

    if (backBtn) backBtn.addEventListener('click', () => enterList());
    if (newBtn) newBtn.addEventListener('click', () => openEditor({ new: '1' }));
    if (genBtn && typeof o.onGenerateFromInvoice === 'function') {
      genBtn.addEventListener('click', () => {
        openInvoicePicker({
          mode: o.type === 'challan' ? 'challan' : 'receipt',
          onSelect: async (inv) => {
            await o.onGenerateFromInvoice(inv, { openEditor, isEditorVisible });
          }
        });
      });
    }

    if (typeof root.addEventListener === 'function') {
      root.addEventListener('popstate', async () => {
        const p = typeof root.parseQuery === 'function' ? root.parseQuery() : {};
        if (typeof o.hasEditorParams === 'function' && o.hasEditorParams(p)) {
          await openEditor(p, { pushHistory: false });
        } else {
          resetDirtyFn();
          if (typeof o.onEnterList === 'function') o.onEnterList();
          if (typeof root.setCompanyHeader === 'function') root.setCompanyHeader();
          showEditor(false);
          if (listCtrl) listCtrl.refresh();
        }
      });
    }

    const initialParams = typeof root.parseQuery === 'function' ? root.parseQuery() : {};
    if (typeof o.hasEditorParams === 'function' && o.hasEditorParams(initialParams)) {
      Promise.resolve(openEditor(initialParams, { pushHistory: false })).then(() => {
        if (typeof o.afterFirstLoad === 'function') o.afterFirstLoad();
      });
    } else {
      showEditor(false);
    }

    return {
      listCtrl,
      openEditor,
      enterList,
      isEditorVisible,
      refreshList: () => listCtrl && listCtrl.refresh()
    };
  }

  root.AutoInvoiceDocList = {
    getDocNumber,
    enrichRecord,
    filterAndSortRecords,
    init,
    openInvoicePicker,
    connectWorkspace
  };
})(typeof window !== 'undefined' ? window : globalThis);
