// Search page logic: filter stored documents, export reports, client ledger, and revenue analysis

document.addEventListener('DOMContentLoaded', () => {
  const billerEl = document.getElementById('searchBiller');
  const typeEl = document.getElementById('recordType');
  const numberEl = document.getElementById('searchNumber');
  const clientEl = document.getElementById('searchClient');
  const fromDateEl = document.getElementById('searchFromDate');
  const toDateEl = document.getElementById('searchToDate');
  const minAmountEl = document.getElementById('searchMinAmount');
  const maxAmountEl = document.getElementById('searchMaxAmount');
  const statusEl = document.getElementById('searchStatus');
  const textEl = document.getElementById('searchText');
  const searchBtn = document.getElementById('searchBtn');
  const resetBtn = document.getElementById('resetBtn');
  const resultsBody = document.getElementById('resultsBody');
  const resultsCountBadge = document.getElementById('resultsCountBadge');
  const outstandingBody = document.getElementById('outstandingBody');
  const agingBody = document.getElementById('agingBody');
  const revenueBody = document.getElementById('revenueAnalysisBody');
  const statementClientSelect = document.getElementById('statementClientSelect');
  const openFullStatementBtn = document.getElementById('openFullStatementBtn');
  const statementContent = document.getElementById('statementContent');
  const statementPlaceholder = document.getElementById('statementPlaceholder');
  const statementTableBody = document.getElementById('statementTableBody');
  const statementClientName = document.getElementById('statementClientName');
  const statementClientAddress = document.getElementById('statementClientAddress');
  const statementNetDue = document.getElementById('statementNetDue');
  const exportStatementCsvBtn = document.getElementById('exportStatementCsvBtn');

  const emptyMsg = document.createElement('tr');
  emptyMsg.innerHTML = `<td colspan="8" class="text-muted text-center py-3">No matching records. Try adjusting filters or create documents.</td>`;

  let currentSearchResultsData = [];
  let currentOutstandingData = [];
  let currentAgingData = [];
  let currentRevenueData = [];
  let currentStatementData = null;
  let allDiscoveredRecords = [];
  let revenueViewMode = 'monthly'; // 'monthly' | 'quarterly'

  // Initialize Biller Filter Dropdown
  function populateBillerFilter() {
    if (!billerEl || typeof loadBillers !== 'function') return;
    const currentVal = billerEl.value || 'all';
    const billers = loadBillers();
    let opts = '<option value="all">All Billers (Consolidated)</option>';
    billers.forEach(b => {
      const pref = b.prefixes?.invoice || b.invoicePrefix || 'INV';
      opts += `<option value="${escapeAttr(b.id)}">${escapeHTML(b.name)} (${escapeHTML(pref)})</option>`;
    });
    billerEl.innerHTML = opts;
    billerEl.value = currentVal;
  }
  populateBillerFilter();

  if (billerEl) {
    billerEl.addEventListener('change', () => runSearch(false));
  }
  window.addEventListener('billerchange', () => {
    populateBillerFilter();
    populateStatementClients();
    runSearch(false);
  });

  searchBtn.addEventListener('click', () => runSearch(false));
  typeEl.addEventListener('change', () => runSearch(false));
  if (statusEl) statusEl.addEventListener('change', () => runSearch(false));
  [numberEl, clientEl, textEl, minAmountEl, maxAmountEl, fromDateEl, toDateEl].forEach(inp => {
    if (!inp) return;
    inp.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        runSearch(false);
      }
    });
  });

  function badgeColorStyle(hex) {
    const safe = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(String(hex || '').trim()) ? String(hex).trim() : '#0b3969';
    const full = safe.length === 4
      ? '#' + safe[1] + safe[1] + safe[2] + safe[2] + safe[3] + safe[3]
      : safe;
    const r = parseInt(full.slice(1, 3), 16);
    const g = parseInt(full.slice(3, 5), 16);
    const b = parseInt(full.slice(5, 7), 16);
    const yiq = (r * 299 + g * 587 + b * 114) / 1000;
    const fg = yiq >= 150 ? '#111827' : '#ffffff';
    return `background-color: ${escapeAttr(safe)}; color: ${fg};`;
  }
  resetBtn.addEventListener('click', () => {
    if (billerEl) billerEl.value = 'all';
    typeEl.value = 'all';
    numberEl.value = '';
    clientEl.value = '';
    fromDateEl.value = '';
    toDateEl.value = '';
    if (minAmountEl) minAmountEl.value = '';
    if (maxAmountEl) maxAmountEl.value = '';
    if (statusEl) statusEl.value = 'any';
    if (textEl) textEl.value = '';
    resultsBody.innerHTML = '';
    if (outstandingBody) outstandingBody.innerHTML = '';
    if (agingBody) agingBody.innerHTML = '';
    runSearch(true);
  });

  // Revenue radio toggles
  const revMonthlyRadio = document.getElementById('revViewMonthly');
  const revQuarterlyRadio = document.getElementById('revViewQuarterly');
  if (revMonthlyRadio && revQuarterlyRadio) {
    revMonthlyRadio.addEventListener('change', () => {
      revenueViewMode = 'monthly';
      runSearch(false);
    });
    revQuarterlyRadio.addEventListener('change', () => {
      revenueViewMode = 'quarterly';
      runSearch(false);
    });
  }

  // Preload records and clients
  populateStatementClients();
  runSearch(true);

  async function runSearch(preload = false) {
    const billerQ = billerEl?.value || 'all';
    const type = typeEl.value;
    const numberQ = (numberEl.value || '').trim().toLowerCase();
    const clientQ = (clientEl.value || '').trim().toLowerCase();
    const fromQ = fromDateEl.value || '';
    const toQ = toDateEl.value || '';
    const minAmtQ = parseFloat((minAmountEl?.value || '').replace(/[^0-9.]/g, ''));
    const maxAmtQ = parseFloat((maxAmountEl?.value || '').replace(/[^0-9.]/g, ''));
    const statusQ = (statusEl?.value || 'any');
    const textQ = (textEl?.value || '').trim().toLowerCase();

    let list = [];
    const invLocal = loadInvoices().map(r => ({ ...r, __type: 'invoice', source: 'local' }));
    const chLocal = loadChallans().map(r => ({ ...r, __type: 'challan', source: 'local' }));
    const rcLocal = loadReceipts().map(r => ({ ...r, __type: 'receipt', source: 'local' }));
    const qtnLocal = (typeof loadQuotations === 'function') ? loadQuotations().map(r => ({ ...r, __type: 'quotation', source: 'local' })) : [];
    let invDisk = await loadDiskInvoicesSummaries();
    let chDisk = await loadDiskChallansSummaries();
    if (!invDisk.length) invDisk = await autoDiscoverSummaries('invoices');
    if (!chDisk.length) chDisk = await autoDiscoverSummaries('challans');

    const dedupeByNo = (localArr, diskArr, field) => {
      const seen = new Set(localArr.map(r => r[field] || r.number).filter(Boolean));
      return localArr.concat(diskArr.filter(d => {
        const no = d[field] || d.number;
        return no && !seen.has(no);
      }));
    };
    const invs = dedupeByNo(invLocal, invDisk, 'invoiceNumber');
    const chs = dedupeByNo(chLocal, chDisk, 'challanNumber');

    const allRecords = invs.concat(chs).concat(rcLocal).concat(qtnLocal);
    allDiscoveredRecords = allRecords;
    populateStatementClients(allDiscoveredRecords);

    if (type === 'invoice') list = invs;
    else if (type === 'challan') list = chs;
    else if (type === 'receipt') list = rcLocal;
    else if (type === 'quotation') list = qtnLocal;
    else list = allRecords;

    let out = list.filter(rec => {
      // 1. Biller filter
      const recBillerId = rec.billerId || 'biller_default';
      const okBiller = (billerQ === 'all') || (recBillerId === billerQ);
      if (!okBiller) return false;

      // 2. Document number
      const num = rec.__type === 'invoice' ? (rec.invoiceNumber || rec.number)
        : rec.__type === 'challan' ? (rec.challanNumber || rec.number)
          : rec.__type === 'receipt' ? ((rec.receiptNumber || rec.number) || '')
            : rec.__type === 'quotation' ? ((rec.quotationNumber || rec.number) || '')
              : '';
      const okNumber = !numberQ || num.toLowerCase().includes(numberQ);

      // 3. Client Name
      const cli = (rec.client?.name || '').toLowerCase();
      const qtnTo = rec.__type === 'quotation' ? `${rec.to?.name || ''} ${rec.to?.company || ''}`.toLowerCase() : '';
      const okClient = !clientQ || cli.includes(clientQ) || (!!qtnTo && qtnTo.includes(clientQ));

      // 4. Date range
      const date = rec.date || '';
      const okFrom = !fromQ || (date && date >= fromQ);
      const okTo = !toQ || (date && date <= toQ);
      const okDate = okFrom && okTo;

      // 5. Amount
      let okAmount = true;
      if (rec.__type === 'receipt') {
        const amt = Number(rec.amount || 0) || 0;
        if (!isNaN(minAmtQ)) okAmount = okAmount && (amt >= minAmtQ);
        if (!isNaN(maxAmtQ)) okAmount = okAmount && (amt <= maxAmtQ);
      } else if (rec.__type === 'quotation') {
        const amt = Number(rec.grandTotal || 0) || 0;
        if (!isNaN(minAmtQ)) okAmount = okAmount && (amt >= minAmtQ);
        if (!isNaN(maxAmtQ)) okAmount = okAmount && (amt <= maxAmtQ);
      } else if (rec.__type === 'invoice') {
        const stats = rec.status === 'Void' ? null : getInvoicePaymentStats(rec);
        const amt = stats ? stats.total : (Number(rec.grandTotal || 0) || 0);
        if (!isNaN(minAmtQ)) okAmount = okAmount && (amt >= minAmtQ);
        if (!isNaN(maxAmtQ)) okAmount = okAmount && (amt <= maxAmtQ);
      }

      // 6. Status
      let okStatus = true;
      if (statusQ !== 'any') {
        if (statusQ === 'void') {
          okStatus = rec.status === 'Void';
        } else if (rec.status === 'Void') {
          okStatus = false;
        } else if (rec.__type === 'quotation') {
          const qStats = typeof getQuotationStatus === 'function' ? getQuotationStatus(rec) : null;
          if (statusQ === 'valid') okStatus = qStats ? (qStats.isValid && !qStats.isConverted) : false;
          else if (statusQ === 'expired') okStatus = qStats ? qStats.isExpired : false;
          else if (statusQ === 'converted') okStatus = qStats ? qStats.isConverted : false;
          else okStatus = false;
        } else if (rec.__type === 'invoice') {
          const stats = getInvoicePaymentStats(rec);
          if (statusQ === 'paid') okStatus = stats.status === 'Paid';
          else if (statusQ === 'partial') okStatus = stats.status === 'Partial';
          else if (statusQ === 'unpaid') okStatus = stats.status === 'Unpaid';
          else if (statusQ === 'overdue') okStatus = stats.isOverdue;
          else okStatus = false;
        } else {
          okStatus = false;
        }
      }

      // 7. Keywords / text
      let okText = true;
      if (textQ) {
        if (rec.__type === 'quotation') {
          const itemsText = (rec.items || []).map(i => `${i.desc || ''}`).join(' ').toLowerCase();
          const toText = `${rec.to?.name || ''} ${rec.to?.title || ''} ${rec.to?.company || ''} ${rec.to?.address || ''}`.toLowerCase();
          const subjText = (rec.subject || '').toLowerCase();
          okText = `${subjText} ${toText} ${itemsText}`.includes(textQ);
        } else if (rec.__type === 'invoice' || rec.__type === 'challan') {
          const itemsText = (rec.items || []).map(i => `${i.name || ''} ${i.desc || ''}`).join(' ').toLowerCase();
          const clientText = `${rec.client?.name || ''} ${rec.client?.address || ''}`.toLowerCase();
          const titleText = (rec.title || '').toLowerCase();
          okText = `${num.toLowerCase()} ${clientText} ${titleText} ${itemsText}`.includes(textQ);
        } else if (rec.__type === 'receipt') {
          const clientText = `${rec.client?.name || ''} ${rec.client?.address || ''}`.toLowerCase();
          const methodText = (rec.paymentMethod || '').toLowerCase();
          okText = `${num.toLowerCase()} ${clientText} ${methodText}`.includes(textQ);
        }
      }

      return okNumber && okClient && okDate && okAmount && okStatus && okText;
    }).sort((a, b) => {
      const ta = (typeof parseLocalISODate === 'function' ? parseLocalISODate(a.date || '1970-01-01')?.getTime() : Date.parse(a.date || '1970-01-01')) || 0;
      const tb = (typeof parseLocalISODate === 'function' ? parseLocalISODate(b.date || '1970-01-01')?.getTime() : Date.parse(b.date || '1970-01-01')) || 0;
      return tb - ta;
    });

    if (preload === true && billerQ === 'all') {
      out = list.sort((a, b) => {
        const ta = (typeof parseLocalISODate === 'function' ? parseLocalISODate(a.date || '1970-01-01')?.getTime() : Date.parse(a.date || '1970-01-01')) || 0;
        const tb = (typeof parseLocalISODate === 'function' ? parseLocalISODate(b.date || '1970-01-01')?.getTime() : Date.parse(b.date || '1970-01-01')) || 0;
        return tb - ta;
      });
    }

    if (resultsCountBadge) {
      resultsCountBadge.textContent = `${out.length} records`;
    }

    // Cache current search results for CSV export
    currentSearchResultsData = out.map(rec => {
      const num = rec.__type === 'invoice' ? (rec.invoiceNumber || rec.number)
        : rec.__type === 'challan' ? (rec.challanNumber || rec.number)
          : rec.__type === 'receipt' ? ((rec.receiptNumber || rec.number) || '')
            : rec.__type === 'quotation' ? ((rec.quotationNumber || rec.number) || '') : '';
      const bObj = (typeof getBillerById === 'function' ? getBillerById(rec.billerId || 'biller_default') : null);
      const bName = bObj?.name || (rec.company?.name || 'Default');
      let amt = 0;
      let invStats = null;
      if (rec.__type === 'invoice') {
        invStats = rec.status === 'Void' ? null : getInvoicePaymentStats(rec);
        amt = invStats ? invStats.total : (rec.grandTotal || 0);
      } else if (rec.__type === 'quotation') {
        amt = rec.grandTotal || 0;
      } else if (rec.__type === 'receipt') {
        amt = rec.amount || 0;
      }
      let status = 'Recorded';
      if (rec.status === 'Void') {
        status = 'Void';
      } else if (rec.__type === 'invoice') {
        const stats = invStats || getInvoicePaymentStats(rec);
        status = stats.isOverdue ? 'Overdue' : stats.status;
      } else if (rec.__type === 'quotation') {
        const qStats = typeof getQuotationStatus === 'function' ? getQuotationStatus(rec) : null;
        status = qStats ? qStats.status : 'Recorded';
      } else if (rec.__type === 'receipt') {
        status = 'Received';
      } else if (rec.__type === 'challan') {
        status = 'Delivered';
      }
      return {
        type: rec.__type.toUpperCase(),
        number: num,
        biller: bName,
        date: rec.date || '',
        client: rec.client?.name || rec.to?.name || '',
        amount: roundBDT(amt),
        status
      };
    });

    resultsBody.innerHTML = '';
    if (out.length === 0) {
      const tr = emptyMsg.cloneNode(true);
      tr.querySelector('td').textContent = 'No matching records. Try adjusting filters or create documents.';
      resultsBody.appendChild(tr);
    } else {
      out.forEach(rec => {
        const tr = document.createElement('tr');
        const num = rec.__type === 'invoice' ? (rec.invoiceNumber || rec.number)
          : rec.__type === 'challan' ? (rec.challanNumber || rec.number)
            : rec.__type === 'receipt' ? ((rec.receiptNumber || rec.number) || '')
              : rec.__type === 'quotation' ? ((rec.quotationNumber || rec.number) || '')
                : '';

        const isVoid = rec.status === 'Void';
        const invStatsRow = (rec.__type === 'invoice' && !isVoid) ? getInvoicePaymentStats(rec) : null;
        let amtDisplay = '—';
        if (rec.__type === 'invoice') {
          const effAmt = invStatsRow ? invStatsRow.total : (rec.grandTotal || 0);
          amtDisplay = formatBDT(effAmt);
          if (invStatsRow && Math.abs(invStatsRow.adjustmentAmount || 0) > 0) {
            amtDisplay += ` (Orig: ${formatBDT(invStatsRow.originalTotal)})`;
          }
        } else if (rec.__type === 'quotation') {
          amtDisplay = formatBDT(rec.grandTotal || 0);
        } else if (rec.__type === 'receipt') {
          amtDisplay = formatBDT(rec.amount || 0);
        }

        const bObj = (typeof getBillerById === 'function' ? getBillerById(rec.billerId || 'biller_default') : null);
        const bName = bObj?.name || (rec.company?.name || 'Default');
        const bColor = bObj?.themeColor || '#0b3969';

        let statusBadge = '';
        if (isVoid) {
          statusBadge = '<span class="badge bg-dark">Void</span>';
        } else if (rec.__type === 'invoice') {
          const stats = invStatsRow || getInvoicePaymentStats(rec);
          if (stats.isOverdue) {
            statusBadge = '<span class="badge bg-danger">Overdue</span>';
          } else if (stats.status === 'Paid') {
            statusBadge = '<span class="badge bg-success">Paid</span>';
          } else if (stats.status === 'Partial') {
            statusBadge = '<span class="badge bg-warning text-dark">Partial</span>';
          } else {
            statusBadge = '<span class="badge bg-secondary">Unpaid</span>';
          }
        } else if (rec.__type === 'quotation') {
          const qStats = typeof getQuotationStatus === 'function' ? getQuotationStatus(rec) : null;
          if (qStats && qStats.isConverted) {
            statusBadge = `<span class="badge bg-primary" title="Converted to ${escapeHTML(rec.convertedToInvoice || '')}">Converted</span>`;
          } else if (qStats && qStats.isExpired) {
            const expDisplay = typeof formatDisplayDate === 'function' ? formatDisplayDate(qStats.validUntil) : qStats.validUntil;
            statusBadge = `<span class="badge bg-danger" title="Expired on ${escapeAttr(expDisplay)}">Expired</span>`;
          } else if (qStats) {
            const untilDisplay = typeof formatDisplayDate === 'function' ? formatDisplayDate(qStats.validUntil) : qStats.validUntil;
            statusBadge = `<span class="badge bg-success-subtle text-success border border-success-subtle" title="Valid until ${escapeAttr(untilDisplay)}">Valid (${qStats.daysRemaining}d left)</span>`;
          } else {
            statusBadge = '<span class="badge bg-info text-dark">Valid</span>';
          }
        } else if (rec.__type === 'receipt') {
          statusBadge = '<span class="badge bg-success-subtle text-success border border-success-subtle">Received</span>';
        } else if (rec.__type === 'challan') {
          statusBadge = '<span class="badge bg-secondary-subtle text-secondary border">Delivered</span>';
        }

        const openUrl = rec.__type === 'invoice' ? 'invoice.html?no=' : rec.__type === 'challan' ? 'challan.html?no=' : rec.__type === 'quotation' ? 'quotation.html?no=' : 'receipt.html?rcpt=';
        const clientNameStr = rec.client?.name || rec.to?.name || '';
        const isLocal = rec.source !== 'disk';

        tr.innerHTML = `
          <td><span class="badge bg-body-tertiary text-body border text-uppercase">${escapeHTML(rec.__type || '')}</span></td>
          <td class="fw-semibold text-nowrap ${isVoid ? 'text-decoration-line-through text-muted' : ''}">${escapeHTML(num)}</td>
          <td><span class="badge text-truncate" style="${badgeColorStyle(bColor)} max-width: 130px;" title="${escapeAttr(bName)}">${escapeHTML(bName)}</span></td>
          <td class="text-nowrap">${escapeHTML(rec.date || '')}</td>
          <td class="fw-medium">${escapeHTML(clientNameStr)}</td>
          <td class="text-end fw-semibold text-nowrap ${isVoid ? 'text-decoration-line-through text-muted' : ''}">${amtDisplay}</td>
          <td class="text-center">${statusBadge}</td>
          <td class="text-end no-print">
            <div class="btn-group btn-group-sm">
              <a class="btn btn-outline-primary" href="${openUrl}${encodeURIComponent(num)}">Open</a>
              <button class="btn btn-outline-secondary viewBtn">View</button>
              <button type="button" class="btn btn-outline-secondary dropdown-toggle dropdown-toggle-split" data-bs-toggle="dropdown" aria-expanded="false">
                <span class="visually-hidden">Toggle</span>
              </button>
              <ul class="dropdown-menu dropdown-menu-end shadow-sm">
                <li><button class="dropdown-item printBtn">🖨️ Print PDF</button></li>
                <li><button class="dropdown-item downloadBtn">📥 Download JSON</button></li>
                ${clientNameStr ? `<li><hr class="dropdown-divider my-1"></li><li><button class="dropdown-item statementQuickBtn">📑 Client Ledger</button></li>` : ''}
                ${isLocal ? `
                  <li><hr class="dropdown-divider my-1"></li>
                  <li><button class="dropdown-item text-warning voidBtn">${isVoid ? '♻️ Restore Active' : '🚫 Mark Void'}</button></li>
                  <li><button class="dropdown-item text-danger deleteBtn">🗑️ Delete Record</button></li>
                ` : ''}
              </ul>
            </div>
          </td>
        `;

        // View inline toggle
        const viewBtn = tr.querySelector('.viewBtn');
        viewBtn.addEventListener('click', async () => {
          const nextEl = tr.nextElementSibling;
          if (nextEl && nextEl.classList.contains('detail-row')) {
            nextEl.remove();
            viewBtn.textContent = 'View';
            return;
          }

          let full = rec;
          if (rec.__type === 'invoice' && (!rec.items || rec.source === 'disk')) full = await getDiskInvoiceByNumber(num);
          if (rec.__type === 'challan' && (!rec.items || rec.source === 'disk')) full = await getDiskChallanByNumber(num);
          const details = document.createElement('tr');
          details.className = 'detail-row';
          if (!full) {
            details.innerHTML = `<td colspan="8"><div class="alert alert-warning mb-0 small">Unable to load full record file for <strong>${escapeHTML(num)}</strong>.</div></td>`;
            tr.insertAdjacentElement('afterend', details);
            viewBtn.textContent = 'Hide';
            return;
          }
          const recCompany = bObj || full.company || (typeof COMPANY !== 'undefined' ? COMPANY : {});
          details.innerHTML = `
            <td colspan="8">
              <div class="border rounded p-3 bg-body-tertiary">
                <div class="d-flex justify-content-between align-items-center mb-2">
                  <div><strong class="text-primary">${escapeHTML(recCompany.name || '')}</strong> — ${escapeHTML(recCompany.address || '')}</div>
                  <div class="badge bg-secondary">${escapeHTML(rec.__type.toUpperCase())} — ${escapeHTML(num)}</div>
                </div>
                <div class="small text-muted mb-2">Client / Recipient: <strong>${escapeHTML(clientNameStr)}</strong></div>
                ${rec.__type === 'receipt' ? `
                  <div class="small">
                    <div>Linked Invoice: <strong>${escapeHTML(full.invoiceNumber || 'None')}</strong></div>
                    <div>Payment Method: <strong>${escapeHTML(full.paymentMethod || 'Cash')}</strong></div>
                    <div>Amount Received: <strong class="text-success">${formatBDT(full.amount || 0)}</strong></div>
                  </div>
                ` : rec.__type === 'quotation' ? `
                  <div class="small">
                    <div>Subject: <strong>${escapeHTML(full.subject || '')}</strong></div>
                    ${full.validUntil ? `<div>Valid Until: <strong>${escapeHTML(typeof formatDisplayDate === 'function' ? formatDisplayDate(full.validUntil) : full.validUntil)}</strong> (${escapeHTML(String(full.validityDays || 30))} days)</div>` : ''}
                    ${(full.items || []).map(it => `<div>• ${escapeHTML(it.desc || '')} (Qty: ${escapeHTML(it.qty || 0)}, Rate: ${formatBDT(it.unitPrice || 0)})</div>`).join('')}
                    <div class="mt-1 fw-bold">Total: ${formatBDT(full.grandTotal || 0)}</div>
                  </div>
                ` : `
                  <div class="small">
                    ${(full.items || []).map(it => `<div>• ${escapeHTML(it.name || '')} — ${escapeHTML(it.desc || '')} (Qty: ${escapeHTML(it.qty || 0)}${it.unitPrice != null ? ', Rate: ' + formatBDT(it.unitPrice) : ''})</div>`).join('')}
                    ${full.grandTotal != null ? `<div class="mt-1 fw-bold">Total: ${formatBDT(full.grandTotal)}</div>` : ''}
                  </div>
                `}
              </div>
            </td>
          `;
          tr.insertAdjacentElement('afterend', details);
          viewBtn.textContent = 'Hide';
        });

        const printBtn = tr.querySelector('.printBtn');
        if (printBtn) {
          printBtn.addEventListener('click', () => {
            const url = rec.__type === 'invoice' ? `invoice.html?no=${encodeURIComponent(num)}&autoprint=1`
              : rec.__type === 'challan' ? `challan.html?no=${encodeURIComponent(num)}&autoprint=1`
                : rec.__type === 'receipt' ? `receipt.html?rcpt=${encodeURIComponent(num)}&autoprint=1`
                  : `quotation.html?no=${encodeURIComponent(num)}&autoprint=1`;
            window.open(url, '_blank');
          });
        }

        const downloadBtn = tr.querySelector('.downloadBtn');
        if (downloadBtn) {
          downloadBtn.addEventListener('click', async () => {
            let data = rec;
            if (rec.__type === 'invoice' && (!rec.items || rec.source === 'disk')) data = await getDiskInvoiceByNumber(num);
            if (rec.__type === 'challan' && (!rec.items || rec.source === 'disk')) data = await getDiskChallanByNumber(num);
            if (!data) { showToast('Record file not found or invalid.', 'danger'); return; }
            downloadJSON(`${rec.__type}_${num}.json`, data);
          });
        }

        const statementQuickBtn = tr.querySelector('.statementQuickBtn');
        if (statementQuickBtn && clientNameStr) {
          statementQuickBtn.addEventListener('click', () => {
            if (statementClientSelect) {
              statementClientSelect.value = clientNameStr;
              renderClientStatement(clientNameStr);
              document.getElementById('clientStatementCard')?.scrollIntoView({ behavior: 'smooth' });
            }
          });
        }

        const voidBtn = tr.querySelector('.voidBtn');
        if (voidBtn && typeof toggleVoidRecord === 'function') {
          voidBtn.addEventListener('click', () => {
            const updated = toggleVoidRecord(rec.__type, num);
            if (updated) {
              showToast(`${rec.__type.toUpperCase()} ${num} marked as ${updated.status}.`, 'info');
              runSearch(false);
            }
          });
        }

        const deleteBtn = tr.querySelector('.deleteBtn');
        if (deleteBtn && typeof deleteRecordByType === 'function') {
          deleteBtn.addEventListener('click', () => {
            if (confirm(`Are you sure you want to permanently delete ${rec.__type.toUpperCase()} ${num}?`)) {
              if (deleteRecordByType(rec.__type, num)) {
                showToast(`${rec.__type.toUpperCase()} ${num} deleted.`, 'success');
                runSearch(false);
              }
            }
          });
        }

        resultsBody.appendChild(tr);
      });
    }

    // Build sub-reports: Outstanding Receivables & Aging
    const filteredInvs = out.filter(r => r.__type === 'invoice' && r.status !== 'Void');
    await buildReports(filteredInvs);

    // Build periodic revenue breakdown
    buildRevenueBreakdown(filteredInvs);
  }

  // Live storage sync
  window.addEventListener('storage', () => runSearch(false));
  window.addEventListener('storagesync', () => runSearch(false));

  const localTodayStr = () => (typeof toLocalISODate === 'function' ? toLocalISODate() : new Date().toISOString().slice(0, 10));

  // 1. Export Search Results CSV Button (uses shared downloadCSV from js/utils.js)
  const exportSearchResultsBtn = document.getElementById('exportSearchResultsCsvBtn');
  if (exportSearchResultsBtn) {
    exportSearchResultsBtn.addEventListener('click', () => {
      if (!currentSearchResultsData.length) {
        showToast('No search results to export.', 'info');
        return;
      }
      const headers = ['Type', 'Document Number', 'Biller / Company', 'Date', 'Client', 'Amount (BDT)', 'Status'];
      const rows = [headers, ...currentSearchResultsData.map(d => [d.type, d.number, d.biller, d.date, d.client, d.amount, d.status])];
      downloadCSV(`search_results_${localTodayStr()}.csv`, rows);
      showToast('Search results exported to CSV.', 'success');
    });
  }

  // 2. Export Outstanding Receivables CSV Button
  const exportOutBtn = document.getElementById('exportOutstandingCsvBtn');
  if (exportOutBtn) {
    exportOutBtn.addEventListener('click', () => {
      if (!currentOutstandingData.length) {
        showToast('No outstanding receivables to export.', 'info');
        return;
      }
      const headers = ['Invoice Number', 'Biller / Company', 'Date', 'Client', 'Total Amount (BDT)', 'Paid Amount (BDT)', 'Due Amount (BDT)'];
      const rows = [headers, ...currentOutstandingData.map(d => [d.num, d.biller, d.date, d.client, d.total, d.paid, d.due])];
      downloadCSV(`outstanding_receivables_${localTodayStr()}.csv`, rows);
      showToast('Receivables exported to CSV.', 'success');
    });
  }

  // 3. Export Aging Analysis CSV Button
  const exportAgingBtn = document.getElementById('exportAgingCsvBtn');
  if (exportAgingBtn) {
    exportAgingBtn.addEventListener('click', () => {
      if (!currentAgingData.length) {
        showToast('No aging data to export.', 'info');
        return;
      }
      const headers = ['Aging Bracket', 'Invoices Count', 'Total Due (BDT)'];
      const rows = [headers, ...currentAgingData.map(d => [d.label, d.count, d.total])];
      downloadCSV(`aging_report_${localTodayStr()}.csv`, rows);
      showToast('Aging analysis exported to CSV.', 'success');
    });
  }

  // 4. Export Revenue Breakdown CSV Button
  const exportRevenueBtn = document.getElementById('exportRevenueCsvBtn');
  if (exportRevenueBtn) {
    exportRevenueBtn.addEventListener('click', () => {
      if (!currentRevenueData.length) {
        showToast('No revenue data available to export.', 'info');
        return;
      }
      const headers = ['Period', 'Invoiced Amount (BDT)', 'Collected Amount (BDT)', 'Net Due (BDT)', 'Collection Rate (%)', 'Invoices Count'];
      const rows = [headers, ...currentRevenueData.map(d => [d.periodLabel, d.invoiced, d.collected, d.due, d.rate, d.count])];
      downloadCSV(`revenue_breakdown_${revenueViewMode}_${localTodayStr()}.csv`, rows);
      showToast('Revenue breakdown exported to CSV.', 'success');
    });
  }

  // 5. Export Client Account Statement CSV Button
  if (exportStatementCsvBtn) {
    exportStatementCsvBtn.addEventListener('click', () => {
      if (!currentStatementData || !currentStatementData.rows.length) {
        showToast('No client statement data to export.', 'info');
        return;
      }
      const s = currentStatementData;
      const meta = [
        ['CLIENT STATEMENT OF ACCOUNT / TRANSACTION LEDGER'],
        ['Client Name:', s.clientName],
        ['Client Address:', s.clientAddress || 'N/A'],
        ['Statement Date:', localTodayStr()],
        ['Total Billed (BDT):', s.totalBilled],
        ['Total Paid (BDT):', s.totalPaid],
        ['Net Outstanding Balance (BDT):', s.netDue],
        []
      ];
      const headers = ['Date', 'Type', 'Reference Number', 'Biller / Company', 'Description', 'Billed / Debit (BDT)', 'Paid / Credit (BDT)', 'Running Balance (BDT)'];
      const tableRows = s.rows.map(r => [r.date, r.type, r.ref, r.biller, r.desc, r.debit, r.credit, r.balance]);
      downloadCSV(`statement_${slugify(s.clientName)}_${localTodayStr()}.csv`, [...meta, headers, ...tableRows]);
      showToast(`Statement exported for ${s.clientName}.`, 'success');
    });
  }

  // Sub-reports: Outstanding Receivables & Aging Analysis
  async function buildReports(invs) {
    if (!outstandingBody || !agingBody) return;
    outstandingBody.innerHTML = '';
    agingBody.innerHTML = '';
    currentOutstandingData = [];
    currentAgingData = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const buckets = {
      current: { label: 'Current (Not Due)', count: 0, total: 0 },
      b1: { label: '1–30 days', count: 0, total: 0 },
      b2: { label: '31–60 days', count: 0, total: 0 },
      b3: { label: '61–90 days', count: 0, total: 0 },
      b4: { label: '90+ days', count: 0, total: 0 },
    };

    for (const rec of invs) {
      if (rec.status === 'Void') continue;
      const num = rec.invoiceNumber || rec.number;
      let full = rec;
      if (!rec.items || rec.source === 'disk') {
        full = await getDiskInvoiceByNumber(num);
      }
      if (!full || full.status === 'Void') continue;
      const latestAdj = getLatestAdjustmentForInvoice(num);
      const baseTotal = Number(full.grandTotal || 0) || 0;
      const total = roundBDT(latestAdj && isFinite(Number(latestAdj.adjustedTotal)) ? Number(latestAdj.adjustedTotal) : baseTotal);
      const paid = roundBDT(getTotalPaidForInvoice(num));
      const due = roundBDT(Math.max(0, total - paid));
      const bObj = (typeof getBillerById === 'function' ? getBillerById(rec.billerId || 'biller_default') : null);
      const bName = bObj?.name || (full.company?.name || 'Default');
      const clientName = full.client?.name || rec.client?.name || '';

      if (due > 0) {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td class="fw-semibold text-nowrap"><a href="invoice.html?no=${encodeURIComponent(num)}" class="text-decoration-none">${escapeHTML(num)}</a></td>
          <td><span class="badge text-truncate" style="${badgeColorStyle(bObj?.themeColor || '#0b3969')} max-width: 120px;" title="${escapeAttr(bName)}">${escapeHTML(bName)}</span></td>
          <td class="text-nowrap">${escapeHTML(full.date || rec.date || '')}</td>
          <td>${escapeHTML(clientName)}</td>
          <td class="text-end text-nowrap">${formatBDT(total)}</td>
          <td class="text-end text-nowrap text-success">${formatBDT(paid)}</td>
          <td class="text-end text-nowrap text-danger fw-bold">${formatBDT(due)}</td>
          <td class="text-end no-print text-nowrap">
            <a href="receipt.html?inv=${encodeURIComponent(num)}" class="btn btn-sm btn-outline-success py-0 px-2" title="Record Payment">🧾 Pay</a>
            <button type="button" class="btn btn-sm btn-outline-primary py-0 px-2 ms-1 remindOverdueBtn" title="Send WhatsApp Payment Reminder">💬 Remind</button>
          </td>
        `;
        const remindBtn = tr.querySelector('.remindOverdueBtn');
        if (remindBtn && typeof shareDocumentWhatsApp === 'function') {
          remindBtn.addEventListener('click', () => {
            const matchedClient = typeof loadClients === 'function'
              ? loadClients().find(c => (c.name || '').toLowerCase() === clientName.toLowerCase())
              : null;
            shareDocumentWhatsApp('invoice', {
              number: num,
              date: full.date || rec.date || '',
              dueDate: full.dueDate || '',
              clientName: clientName || 'Customer',
              clientPhone: matchedClient?.phone || full.client?.phone || '',
              total,
              due,
              billerName: bName
            });
          });
        }
        outstandingBody.appendChild(tr);
        currentOutstandingData.push({
          num,
          biller: bName,
          date: full.date || rec.date || '',
          client: clientName,
          total,
          paid,
          due,
        });

        // Aging classification
        const dueDateStr = full.dueDate || full.date || rec.date || '';
        const parsedBasis = dueDateStr
          ? (typeof parseLocalISODate === 'function' ? parseLocalISODate(dueDateStr) : new Date(dueDateStr))
          : new Date(today);
        const basisDate = (parsedBasis && !isNaN(parsedBasis.getTime())) ? parsedBasis : new Date(today);
        basisDate.setHours(0, 0, 0, 0);
        const days = Math.floor((today - basisDate) / (1000 * 60 * 60 * 24));
        let bucketKey = 'current';
        if (days >= 1 && days <= 30) bucketKey = 'b1';
        else if (days >= 31 && days <= 60) bucketKey = 'b2';
        else if (days >= 61 && days <= 90) bucketKey = 'b3';
        else if (days > 90) bucketKey = 'b4';
        buckets[bucketKey].count += 1;
        buckets[bucketKey].total = roundBDT(buckets[bucketKey].total + due);
      }
    }

    if (currentOutstandingData.length === 0) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td colspan="8" class="text-muted text-center py-3">No outstanding receivables for the active filter.</td>`;
      outstandingBody.appendChild(tr);
    }

    // Render aging table
    Object.values(buckets).forEach(b => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="fw-medium">${b.label}</td>
        <td class="text-end">${b.count}</td>
        <td class="text-end text-danger fw-bold">${formatBDT(b.total)}</td>
      `;
      agingBody.appendChild(tr);
      currentAgingData.push({ label: b.label, count: b.count, total: b.total });
    });
  }

  // Periodic Revenue & Collection Breakdown Table
  function buildRevenueBreakdown(invs) {
    if (!revenueBody) return;
    revenueBody.innerHTML = '';
    currentRevenueData = [];

    const periodMap = new Map();

    invs.forEach(inv => {
      const dt = inv.date || '';
      if (!dt || dt.length < 7) return;
      const yyyy = dt.slice(0, 4);
      const mm = dt.slice(5, 7);
      let key = '';
      let label = '';

      if (revenueViewMode === 'quarterly') {
        const mNum = parseInt(mm, 10);
        const qNum = Math.ceil(mNum / 3);
        key = `${yyyy}-Q${qNum}`;
        const qNames = ['Jan–Mar', 'Apr–Jun', 'Jul–Sep', 'Oct–Dec'];
        label = `Q${qNum} ${yyyy} (${qNames[qNum - 1]})`;
      } else {
        // Monthly
        key = `${yyyy}-${mm}`;
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const mIdx = parseInt(mm, 10) - 1;
        label = `${monthNames[mIdx] || mm} ${yyyy}`;
      }

      if (!periodMap.has(key)) {
        periodMap.set(key, { key, label, invoiced: 0, collected: 0, count: 0 });
      }
      const entry = periodMap.get(key);
      const stats = typeof getInvoicePaymentStats === 'function' ? getInvoicePaymentStats(inv) : null;
      const total = stats ? stats.total : (Number(inv.grandTotal || 0) || 0);
      const num = inv.invoiceNumber || inv.number;
      const paid = stats ? stats.paid : roundBDT(getTotalPaidForInvoice(num));
      entry.invoiced = roundBDT(entry.invoiced + total);
      entry.collected = roundBDT(entry.collected + paid);
      entry.count += 1;
    });

    const sortedPeriods = Array.from(periodMap.values()).sort((a, b) => b.key.localeCompare(a.key));

    if (sortedPeriods.length === 0) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td colspan="6" class="text-muted text-center py-3">No invoice data available for periodic revenue breakdown.</td>`;
      revenueBody.appendChild(tr);
      return;
    }

    sortedPeriods.forEach(p => {
      const due = roundBDT(Math.max(0, p.invoiced - p.collected));
      const rateNum = p.invoiced > 0 ? (p.collected / p.invoiced) * 100 : 100;
      const rateStr = `${rateNum.toFixed(1)}%`;
      let badgeClass = 'bg-success';
      if (rateNum < 50) badgeClass = 'bg-danger';
      else if (rateNum < 85) badgeClass = 'bg-warning text-dark';

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="fw-semibold">${escapeHTML(p.label)}</td>
        <td class="text-end fw-medium">${formatBDT(p.invoiced)}</td>
        <td class="text-end text-success">${formatBDT(p.collected)}</td>
        <td class="text-end text-danger fw-bold">${formatBDT(due)}</td>
        <td class="text-center"><span class="badge ${badgeClass}">${rateStr}</span></td>
        <td class="text-end">${p.count}</td>
      `;
      revenueBody.appendChild(tr);

      currentRevenueData.push({
        periodKey: p.key,
        periodLabel: p.label,
        invoiced: p.invoiced,
        collected: p.collected,
        due,
        rate: rateStr,
        count: p.count
      });
    });
  }

  // Populate Client Statement Dropdown
  function populateStatementClients(records = allDiscoveredRecords) {
    if (!statementClientSelect) return;
    const currentVal = statementClientSelect.value;
    const namesSet = new Set();

    // From saved clients
    const savedClients = typeof loadClients === 'function' ? loadClients() : [];
    savedClients.forEach(c => { if (c.name) namesSet.add(c.name.trim()); });

    // From all discovered records (local + disk)
    (records || []).forEach(r => {
      const name = r.client?.name || r.to?.name || '';
      if (name) namesSet.add(name.trim());
    });

    const sortedNames = Array.from(namesSet).sort((a, b) => a.localeCompare(b));
    let opts = '<option value="">Select a Client...</option>';
    sortedNames.forEach(name => {
      opts += `<option value="${escapeAttr(name)}">${escapeHTML(name)}</option>`;
    });
    statementClientSelect.innerHTML = opts;
    statementClientSelect.value = sortedNames.includes(currentVal) ? currentVal : '';
  }

  if (statementClientSelect) {
    statementClientSelect.addEventListener('change', () => {
      const selected = statementClientSelect.value;
      if (selected) {
        renderClientStatement(selected);
      } else {
        if (statementContent) statementContent.classList.add('d-none');
        if (statementPlaceholder) statementPlaceholder.classList.remove('d-none');
        document.getElementById('clientStatementCard')?.classList.add('no-print');
        if (exportStatementCsvBtn) exportStatementCsvBtn.disabled = true;
        if (openFullStatementBtn) openFullStatementBtn.classList.add('d-none');
        currentStatementData = null;
      }
    });
  }

  // Render Chronological Client Account Statement Ledger (aligned with statement.html engine)
  function renderClientStatement(clientName) {
    if (!clientName || !statementTableBody) return;
    const billerQ = billerEl?.value || 'all';

    const extraInvoices = allDiscoveredRecords.filter(r => r.__type === 'invoice' && r.source === 'disk');
    const ledger = typeof computeClientStatementData === 'function'
      ? computeClientStatementData({ clientName, billerId: billerQ, extraInvoices })
      : { allInvoices: [], allReceipts: [], periodInvoices: [], periodReceipts: [] };

    const allInvoices = ledger.allInvoices;
    const allReceipts = ledger.allReceipts;

    // Find address
    const registeredClient = typeof loadClients === 'function'
      ? loadClients().find(c => (c.name || '').trim().toLowerCase() === clientName.trim().toLowerCase())
      : null;
    const clientAddress = registeredClient?.address || allInvoices[0]?.client?.address || allReceipts[0]?.client?.address || '';

    // Build timeline items
    const timeline = [];
    ledger.periodInvoices.forEach(inv => {
      const bObj = typeof getBillerById === 'function' ? getBillerById(inv.billerId || 'biller_default') : null;
      const bName = bObj?.name || (inv.company?.name || 'Default');
      const invNum = inv.invoiceNumber || inv.number || '';
      timeline.push({
        date: inv.date || '',
        type: 'Invoice',
        ref: invNum,
        biller: bName,
        desc: inv.title || 'Invoice Issued',
        debit: roundBDT(inv._effectiveTotal || inv.grandTotal || 0),
        credit: 0
      });
    });

    ledger.periodReceipts.forEach(rc => {
      const bObj = typeof getBillerById === 'function' ? getBillerById(rc.billerId || 'biller_default') : null;
      const bName = bObj?.name || (rc.company?.name || 'Default');
      const rcNum = rc.receiptNumber || rc.number || '';
      const effCredit = roundBDT(rc._effectiveCredit != null ? rc._effectiveCredit : (rc.amount || 0));
      let adjTxt = '';
      if (rc._adjAmt) {
        adjTxt = rc._adjAmt < 0
          ? ` [Surcharge Adj: +${formatBDT(Math.abs(rc._adjAmt))}]`
          : ` [Adj: ${formatBDT(rc._adjAmt)}]`;
      }
      timeline.push({
        date: rc.date || '',
        type: 'Receipt',
        ref: rcNum,
        biller: bName,
        desc: `Payment Received (${rc.paymentMethod || 'Cash'})${rc.invoiceNumber ? ` for ${rc.invoiceNumber}` : ''}${adjTxt}`,
        debit: effCredit < 0 ? roundBDT(Math.abs(effCredit)) : 0,
        credit: effCredit >= 0 ? effCredit : 0
      });
    });

    // Sort chronologically ascending (Invoices before Receipts on same day)
    timeline.sort((a, b) => {
      const d1 = a.date || '1970-01-01';
      const d2 = b.date || '1970-01-01';
      if (d1 !== d2) return d1.localeCompare(d2);
      if (a.type !== b.type) return a.type === 'Invoice' ? -1 : 1;
      return (a.ref || '').localeCompare(b.ref || '');
    });

    let runningBalance = 0;
    let totalBilled = 0;
    let totalPaid = 0;
    statementTableBody.innerHTML = '';

    const calculatedRows = timeline.map(item => {
      totalBilled = roundBDT(totalBilled + item.debit);
      totalPaid = roundBDT(totalPaid + item.credit);
      runningBalance = roundBDT(runningBalance + item.debit - item.credit);
      return { ...item, balance: runningBalance };
    });

    if (calculatedRows.length === 0) {
      statementTableBody.innerHTML = `<tr><td colspan="7" class="text-muted text-center py-3">No invoices or receipts found for ${escapeHTML(clientName)}.</td></tr>`;
    } else {
      calculatedRows.forEach(row => {
        const tr = document.createElement('tr');
        const isInv = row.type === 'Invoice';
        tr.innerHTML = `
          <td>${escapeHTML(row.date)}</td>
          <td><span class="badge ${isInv ? 'bg-primary-subtle text-primary border border-primary-subtle' : 'bg-success-subtle text-success border border-success-subtle'}">${escapeHTML(row.type)}</span></td>
          <td class="fw-semibold">${escapeHTML(row.ref)}</td>
          <td><span class="badge bg-body-tertiary text-body border">${escapeHTML(row.biller)}</span></td>
          <td class="text-end ${row.debit > 0 ? 'fw-semibold text-danger' : 'text-muted'}">${row.debit > 0 ? formatBDT(row.debit) : '—'}</td>
          <td class="text-end ${row.credit > 0 ? 'fw-semibold text-success' : 'text-muted'}">${row.credit > 0 ? formatBDT(row.credit) : '—'}</td>
          <td class="text-end fw-bold ${row.balance > 0 ? 'text-danger' : 'text-success'}">${formatBDT(row.balance)}</td>
        `;
        statementTableBody.appendChild(tr);
      });
    }

    if (statementClientName) statementClientName.textContent = clientName;
    if (statementClientAddress) statementClientAddress.textContent = clientAddress || 'No address registered';
    if (statementNetDue) statementNetDue.textContent = formatBDT(runningBalance);

    if (statementPlaceholder) statementPlaceholder.classList.add('d-none');
    if (statementContent) statementContent.classList.remove('d-none');
    document.getElementById('clientStatementCard')?.classList.remove('no-print');
    if (exportStatementCsvBtn) exportStatementCsvBtn.disabled = calculatedRows.length === 0;
    if (openFullStatementBtn) {
      openFullStatementBtn.href = `statement.html?client=${encodeURIComponent(clientName)}${billerQ !== 'all' ? `&biller=${encodeURIComponent(billerQ)}` : ''}`;
      openFullStatementBtn.classList.remove('d-none');
    }

    currentStatementData = {
      clientName,
      clientAddress,
      totalBilled,
      totalPaid,
      netDue: runningBalance,
      rows: calculatedRows
    };
  }

  // Offline QR V=1 Verifier Modal Logic
  const runQrVerifyBtn = document.getElementById('runQrVerifyBtn');
  const qrVerifyInput = document.getElementById('qrVerifyInput');
  const qrVerifyResult = document.getElementById('qrVerifyResult');

  async function verifyQrString() {
    if (!qrVerifyInput || !qrVerifyResult) return;
    const raw = qrVerifyInput.value.trim();
    qrVerifyResult.classList.remove('d-none');
    if (!raw || typeof parseQRPayload !== 'function') {
      qrVerifyResult.innerHTML = `<div class="text-warning fw-semibold">Please paste a valid AutoInvoice QR payload string.</div>`;
      return;
    }
    const parsed = parseQRPayload(raw);
    if (!parsed.valid) {
      qrVerifyResult.innerHTML = `<div class="text-danger fw-semibold mb-1">❌ Unrecognized / Non-Standard QR Format</div><div class="text-muted">Expected V=1 pipe-delimited payload (DOC=..., TXID=..., V=1).</div>`;
      return;
    }
    const { docType, fields } = parsed;
    const txid = fields.TXID || '';
    let inv = typeof getInvoiceByNumber === 'function' ? getInvoiceByNumber(txid) : null;
    let ch = typeof getChallanByNumber === 'function' ? getChallanByNumber(txid) : null;
    const rc = typeof getReceiptByNumber === 'function' ? getReceiptByNumber(txid) : null;
    const qtn = typeof getQuotationByNumber === 'function' ? getQuotationByNumber(txid) : null;
    if (!inv && docType === 'INV' && typeof getDiskInvoiceByNumber === 'function') {
      try { inv = await getDiskInvoiceByNumber(txid); } catch (_) { }
    }
    if (!ch && docType === 'CHAL' && typeof getDiskChallanByNumber === 'function') {
      try { ch = await getDiskChallanByNumber(txid); } catch (_) { }
    }
    const byDoc = { INV: inv, CHAL: ch, RCPT: rc, QTN: qtn };
    const matched = byDoc[docType] || inv || ch || rc || qtn;

    let matchBanner = `<div class="badge bg-info text-dark mb-2">ℹ️ Valid V=1 Syntax — No local record matching ${escapeHTML(txid)}</div>`;
    let openLink = '';
    const hasAmt = fields.AMT != null && String(fields.AMT).trim() !== '';
    const rawAmtNum = hasAmt ? Number(fields.AMT) : null;
    const qrAmtValid = !hasAmt || Number.isFinite(rawAmtNum);
    const qrAmt = (hasAmt && qrAmtValid) ? roundBDT(rawAmtNum) : null;

    if (matched) {
      const matchedDocType = matched === inv ? 'INV' : matched === ch ? 'CHAL' : matched === rc ? 'RCPT' : 'QTN';
      const localAmt = matched.grandTotal != null ? roundBDT(matched.grandTotal) : (matched.amount != null ? roundBDT(matched.amount) : null);
      const openPage = matched === inv ? `invoice.html?no=${encodeURIComponent(txid)}`
        : matched === ch ? `challan.html?no=${encodeURIComponent(txid)}`
          : matched === rc ? `receipt.html?rcpt=${encodeURIComponent(txid)}`
            : `quotation.html?no=${encodeURIComponent(txid)}`;
      openLink = `<div class="mt-2"><a href="${openPage}" class="btn btn-sm btn-outline-primary">Open Record ↗</a></div>`;
      if (matched.status === 'Void') {
        matchBanner = `<div class="badge bg-dark mb-2">⚠️ Matched Local Record — MARKED VOID</div>`;
      } else if (docType !== matchedDocType) {
        matchBanner = `<div class="badge bg-danger mb-2">❌ Document Type Mismatch! Local: ${escapeHTML(matchedDocType)} vs QR: ${escapeHTML(docType)}</div>`;
      } else if (!qrAmtValid) {
        matchBanner = `<div class="badge bg-danger mb-2">❌ Invalid / Tampered Amount in QR Payload</div>`;
      } else if (localAmt != null && qrAmt != null && localAmt !== qrAmt) {
        matchBanner = `<div class="badge bg-danger mb-2">❌ Amount Mismatch! Local: ${formatBDT(localAmt)} vs QR: ${formatBDT(qrAmt)}</div>`;
      } else if (fields.DT && matched.date && fields.DT !== matched.date) {
        matchBanner = `<div class="badge bg-warning text-dark mb-2">⚠️ Date Mismatch! Local: ${escapeHTML(matched.date)} vs QR: ${escapeHTML(fields.DT)}</div>`;
      } else {
        matchBanner = `<div class="badge bg-success mb-2">✅ Verified Authentic Match in Local Ledger</div>`;
      }
    } else if (!qrAmtValid) {
      matchBanner = `<div class="badge bg-danger mb-2">❌ Invalid / Non-Numeric Amount in QR Payload</div>`;
    }

    qrVerifyResult.innerHTML = `
      ${matchBanner}
      <table class="table table-sm table-borderless mb-0">
        <tbody>
          <tr><th class="text-muted" style="width:32%;">Doc Type:</th><td class="fw-bold">${escapeHTML(docType)}</td></tr>
          <tr><th class="text-muted">Document #:</th><td class="font-monospace fw-semibold">${escapeHTML(txid)}</td></tr>
          ${fields.DT ? `<tr><th class="text-muted">Date:</th><td>${escapeHTML(fields.DT)}</td></tr>` : ''}
          ${hasAmt ? `<tr><th class="text-muted">Amount:</th><td class="fw-bold text-primary">${qrAmtValid ? formatBDT(qrAmt) : escapeHTML(fields.AMT)}</td></tr>` : ''}
          ${fields.BEN ? `<tr><th class="text-muted">Issuer:</th><td>${escapeHTML(fields.BEN)}</td></tr>` : ''}
          ${fields.REC ? `<tr><th class="text-muted">Recipient:</th><td>${escapeHTML(fields.REC)}</td></tr>` : ''}
        </tbody>
      </table>
      ${openLink}
    `;
  }

  if (runQrVerifyBtn) runQrVerifyBtn.addEventListener('click', verifyQrString);

  // Global exposure for integration
  window.renderClientStatement = renderClientStatement;
});
