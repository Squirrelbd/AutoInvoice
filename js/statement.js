// Client Statement of Account & Transaction Ledger Engine
// Generates chronological audit-ready statements with opening balance, debits, credits, and running balance

(function () {
  let currentStatementData = null;
  let cachedDiskInvoices = [];
  let diskInvoicesLoaded = false;

  async function hydrateDiskInvoicesForStatement() {
    if (diskInvoicesLoaded) return cachedDiskInvoices;
    diskInvoicesLoaded = true;
    if (typeof window === 'undefined' || window.__IS_AUTOINVOICE_TESTING__) return [];
    if (typeof loadDiskInvoicesSummaries !== 'function' && typeof autoDiscoverSummaries !== 'function') return [];
    try {
      let summaries = typeof loadDiskInvoicesSummaries === 'function' ? await loadDiskInvoicesSummaries() : [];
      if ((!summaries || summaries.length === 0) && typeof autoDiscoverSummaries === 'function') {
        summaries = await autoDiscoverSummaries('invoices');
      }
      const loaded = [];
      for (const s of (summaries || [])) {
        const num = s.number || s.invoiceNumber;
        if (!num) continue;
        let full = null;
        if (typeof getDiskInvoiceByNumber === 'function') {
          full = await getDiskInvoiceByNumber(num);
        }
        loaded.push(full ? Object.assign({ source: 'disk' }, full) : Object.assign({ source: 'disk', invoiceNumber: num }, s));
      }
      cachedDiskInvoices = loaded;
      populateClientSelect();
      if (document.getElementById('clientSelect')?.value) {
        generateStatement();
      }
    } catch (_) { }
    return cachedDiskInvoices;
  }

  function init() {
    if (typeof setCompanyHeader === 'function') {
      setCompanyHeader();
    }
    populateBillerSelect();
    populateClientSelect();
    initEventListeners();
    handleQueryParams();
    hydrateDiskInvoicesForStatement();
  }

  function populateBillerSelect() {
    const billerFilter = document.getElementById('billerFilter');
    if (!billerFilter || typeof loadBillers !== 'function') return;
    const current = billerFilter.value || 'all';
    const billers = loadBillers();
    const validIds = new Set(['all', ...billers.map(b => b.id)]);
    let opts = '<option value="all">All Billers (Consolidated)</option>';
    billers.forEach(b => {
      opts += `<option value="${escapeAttr(b.id)}">${escapeHTML(b.name)}</option>`;
    });
    billerFilter.innerHTML = opts;
    billerFilter.value = validIds.has(current) ? current : 'all';
  }

  function handleQueryParams() {
    const params = typeof parseQuery === 'function' ? parseQuery() : {};
    const clientSelect = document.getElementById('clientSelect');
    const billerFilter = document.getElementById('billerFilter');
    const dateFromEl = document.getElementById('dateFrom');
    const dateToEl = document.getElementById('dateTo');
    const datePresetEl = document.getElementById('datePreset');

    if (params.biller && billerFilter) {
      billerFilter.value = params.biller;
    }
    if (params.from && dateFromEl) {
      dateFromEl.value = params.from;
      if (datePresetEl) datePresetEl.value = 'custom';
    }
    if (params.to && dateToEl) {
      dateToEl.value = params.to;
      if (datePresetEl) datePresetEl.value = 'custom';
    }
    if (params.preset && datePresetEl) {
      datePresetEl.value = params.preset;
      applyDatePreset(params.preset);
    }

    if (params.client && clientSelect) {
      clientSelect.value = params.client;
      if (clientSelect.value !== params.client) {
        const opt = document.createElement('option');
        opt.value = params.client;
        opt.textContent = params.client;
        opt.selected = true;
        clientSelect.appendChild(opt);
      }
      generateStatement();
    } else {
      generateStatement();
    }
  }

  function populateClientSelect() {
    const clientSelect = document.getElementById('clientSelect');
    if (!clientSelect) return;

    const namesSet = new Set();
    // 1. Saved Clients
    const saved = typeof loadClients === 'function' ? loadClients() : [];
    saved.forEach(c => { if (c.name) namesSet.add(c.name.trim()); });

    // 2. Clients from Local + Disk Invoices
    const invs = typeof loadInvoices === 'function' ? loadInvoices() : [];
    invs.concat(cachedDiskInvoices || []).forEach(inv => {
      const n = inv.client?.name || inv.to?.name;
      if (n) namesSet.add(n.trim());
    });

    // 3. Clients from Receipts
    const rcpts = typeof loadReceipts === 'function' ? loadReceipts() : [];
    rcpts.forEach(r => {
      const n = r.client?.name || r.to?.name;
      if (n) namesSet.add(n.trim());
    });

    const sorted = Array.from(namesSet).sort((a, b) => a.localeCompare(b));
    const current = clientSelect.value;
    let opts = '<option value="">-- Choose Client --</option>';
    sorted.forEach(name => {
      opts += `<option value="${escapeAttr(name)}">${escapeHTML(name)}</option>`;
    });
    clientSelect.innerHTML = opts;
    if (current && sorted.includes(current)) {
      clientSelect.value = current;
    } else if (current) {
      const match = sorted.find(n => n.toLowerCase() === current.toLowerCase());
      if (match) clientSelect.value = match;
    }
  }

  function initEventListeners() {
    const clientSelect = document.getElementById('clientSelect');
    const billerFilter = document.getElementById('billerFilter');
    const datePreset = document.getElementById('datePreset');
    const dateFrom = document.getElementById('dateFrom');
    const dateTo = document.getElementById('dateTo');
    const resetBtn = document.getElementById('resetFiltersBtn');
    const printBtn = document.getElementById('printBtn');
    const exportCsvBtn = document.getElementById('exportCsvBtn');
    const shareWhatsAppBtn = document.getElementById('shareWhatsAppBtn');
    const shareEmailBtn = document.getElementById('shareEmailBtn');

    if (clientSelect) {
      clientSelect.addEventListener('change', generateStatement);
    }

    if (billerFilter) {
      billerFilter.addEventListener('change', generateStatement);
    }

    if (datePreset) {
      datePreset.addEventListener('change', () => {
        applyDatePreset(datePreset.value);
        generateStatement();
      });
    }

    if (dateFrom) {
      dateFrom.addEventListener('change', () => {
        if (datePreset) datePreset.value = 'custom';
        generateStatement();
      });
    }

    if (dateTo) {
      dateTo.addEventListener('change', () => {
        if (datePreset) datePreset.value = 'custom';
        generateStatement();
      });
    }

    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        if (billerFilter) billerFilter.value = 'all';
        if (datePreset) datePreset.value = 'all';
        if (dateFrom) dateFrom.value = '';
        if (dateTo) dateTo.value = '';
        generateStatement();
      });
    }

    function syncStatementPrintTitle() {
      if (currentStatementData && typeof setPrintDocumentTitle === 'function') {
        const refEl = document.getElementById('statementRefDisplay');
        return setPrintDocumentTitle(refEl?.textContent || 'Statement', currentStatementData.client?.name);
      }
      return 'Statement';
    }

    if (printBtn) {
      printBtn.addEventListener('click', () => {
        syncStatementPrintTitle();
        window.print();
      });
    }

    window.addEventListener('beforeprint', syncStatementPrintTitle);

    if (typeof initPdfDownloadButton === 'function') {
      initPdfDownloadButton('downloadPdfBtn', syncStatementPrintTitle, syncStatementPrintTitle);
    }
    if (typeof runAutoPrintIfRequested === 'function') {
      runAutoPrintIfRequested(syncStatementPrintTitle);
    }

    if (exportCsvBtn) {
      exportCsvBtn.addEventListener('click', exportStatementCSV);
    }

    if (shareWhatsAppBtn) {
      shareWhatsAppBtn.addEventListener('click', (e) => {
        e.preventDefault();
        shareViaWhatsApp();
      });
    }

    if (shareEmailBtn) {
      shareEmailBtn.addEventListener('click', (e) => {
        e.preventDefault();
        shareViaEmail();
      });
    }

    window.addEventListener('billerchange', () => {
      populateBillerSelect();
      if (typeof setCompanyHeader === 'function') {
        setCompanyHeader();
      }
      generateStatement();
    });
  }

  function applyDatePreset(preset) {
    const fromEl = document.getElementById('dateFrom');
    const toEl = document.getElementById('dateTo');
    if (!fromEl || !toEl) return;

    const today = new Date();
    const y = today.getFullYear();
    const m = today.getMonth();

    const formatDateStr = (d) => typeof toLocalISODate === 'function'
      ? toLocalISODate(d)
      : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    if (preset === 'all') {
      fromEl.value = '';
      toEl.value = '';
    } else if (preset === 'this_month') {
      fromEl.value = formatDateStr(new Date(y, m, 1));
      toEl.value = formatDateStr(new Date(y, m + 1, 0));
    } else if (preset === 'last_month') {
      fromEl.value = formatDateStr(new Date(y, m - 1, 1));
      toEl.value = formatDateStr(new Date(y, m, 0));
    } else if (preset === 'this_quarter') {
      const qStartMonth = Math.floor(m / 3) * 3;
      fromEl.value = formatDateStr(new Date(y, qStartMonth, 1));
      toEl.value = formatDateStr(new Date(y, qStartMonth + 3, 0));
    } else if (preset === 'this_fy') {
      // Bangladesh Fiscal Year: Jul 1 to Jun 30
      const fyStartYear = m >= 6 ? y : y - 1;
      fromEl.value = `${fyStartYear}-07-01`;
      toEl.value = `${fyStartYear + 1}-06-30`;
    } else if (preset === 'this_year') {
      fromEl.value = `${y}-01-01`;
      toEl.value = `${y}-12-31`;
    }
  }

  // Core Ledger Calculation Function
  function generateStatement() {
    const clientSelect = document.getElementById('clientSelect');
    const clientName = clientSelect?.value?.trim();

    if (!clientName) {
      renderEmptyState('Please select a client from the toolbar above to generate their statement of account.');
      return;
    }

    const fromDate = document.getElementById('dateFrom')?.value || '';
    const toDate = document.getElementById('dateTo')?.value || '';
    const billerQ = document.getElementById('billerFilter')?.value || 'all';
    const activeBiller = (billerQ !== 'all' && typeof getBillerById === 'function' ? getBillerById(billerQ) : null)
      || (typeof getActiveBiller === 'function' ? getActiveBiller() : null);
    if (typeof setCompanyHeader === 'function' && activeBiller) {
      setCompanyHeader(activeBiller);
    }

    const ledgerData = typeof computeClientStatementData === 'function'
      ? computeClientStatementData({ clientName, billerId: billerQ, fromDate, toDate, extraInvoices: cachedDiskInvoices })
      : { allInvoices: [], allReceipts: [], openingBalance: 0, periodInvoices: [], periodReceipts: [] };

    const allInvoices = ledgerData.allInvoices;
    const allReceipts = ledgerData.allReceipts;

    // Client contact info
    const registeredClient = (typeof loadClients === 'function' ? loadClients() : []).find(c => {
      return (c.name || '').trim().toLowerCase() === clientName.toLowerCase();
    });

    const clientAddress = registeredClient?.address || allInvoices[0]?.client?.address || allReceipts[0]?.client?.address || '';
    const clientPhone = registeredClient?.phone || allInvoices[0]?.client?.phone || '';
    const clientEmail = registeredClient?.email || allInvoices[0]?.client?.email || '';
    const clientBin = registeredClient?.bin || allInvoices[0]?.client?.bin || '';
    const clientCompany = registeredClient?.company || '';
    const clientTitle = registeredClient?.title || '';

    const openingBalance = ledgerData.openingBalance;
    const periodInvoices = ledgerData.periodInvoices;
    const periodReceipts = ledgerData.periodReceipts;

    // 4. Build Chronological Timeline
    const timeline = [];

    periodInvoices.forEach(inv => {
      const bObj = typeof getBillerById === 'function' && inv.billerId ? getBillerById(inv.billerId) : null;
      const bName = bObj?.name || (inv.company?.name || activeBiller?.name || 'Default');
      const invNum = inv.invoiceNumber || inv.number || 'INV';
      const itemCount = Array.isArray(inv.items) ? inv.items.length : 0;
      const desc = inv.title ? `${inv.title} (${itemCount} item${itemCount === 1 ? '' : 's'})` : `Commercial Invoice (${itemCount} items)`;

      timeline.push({
        date: inv.date || '',
        ref: invNum,
        type: 'Invoice',
        desc: desc,
        biller: bName,
        debit: roundBDT(inv._effectiveTotal || 0),
        credit: 0,
        rawDoc: inv,
        url: `invoice.html?no=${encodeURIComponent(invNum)}`
      });
    });

    periodReceipts.forEach(rc => {
      timeline.push(buildReceiptStatementRow(rc, activeBiller));
    });

    // Sort chronologically ascending
    timeline.sort((a, b) => {
      const d1 = a.date || '1970-01-01';
      const d2 = b.date || '1970-01-01';
      if (d1 !== d2) return d1.localeCompare(d2);
      // Invoices before receipts on same day
      if (a.type !== b.type) return a.type === 'Invoice' ? -1 : 1;
      return (a.ref || '').localeCompare(b.ref || '');
    });

    // 5. Compute Running Balance and Totals
    let runningBalance = openingBalance;
    let totalDebits = 0;
    let totalCredits = 0;

    const calculatedRows = timeline.map(row => {
      totalDebits = roundBDT(totalDebits + row.debit);
      totalCredits = roundBDT(totalCredits + row.credit);
      runningBalance = roundBDT(runningBalance + row.debit - row.credit);
      return { ...row, balance: runningBalance };
    });

    const closingBalance = runningBalance;

    // 6. Compute Receivables Aging Analysis
    const aging = calculateAging(allInvoices);

    // 7. Store current statement data for export/share
    currentStatementData = {
      client: {
        name: clientName,
        company: clientCompany,
        title: clientTitle,
        address: clientAddress,
        phone: clientPhone,
        email: clientEmail,
        bin: clientBin
      },
      biller: activeBiller,
      period: {
        from: fromDate,
        to: toDate,
        label: formatPeriodLabel(fromDate, toDate)
      },
      openingBalance,
      totalDebits,
      totalCredits,
      closingBalance,
      rows: calculatedRows,
      aging
    };

    renderStatementUI(currentStatementData);
  }

  function calculateAging(invoices) {
    const buckets = { current: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90plus: 0 };
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    invoices.forEach(inv => {
      const stats = typeof getInvoicePaymentStats === 'function' ? getInvoicePaymentStats(inv) : null;
      const due = stats ? stats.due : Number(inv.grandTotal || 0);
      if (due <= 0) return;

      const dueDateStr = inv.dueDate || inv.date || '';
      if (!dueDateStr) {
        buckets.current = roundBDT(buckets.current + due);
        return;
      }

      const dueD = typeof parseLocalISODate === 'function' ? parseLocalISODate(dueDateStr) : new Date(dueDateStr);
      if (!dueD || isNaN(dueD.getTime())) {
        buckets.current = roundBDT(buckets.current + due);
        return;
      }
      dueD.setHours(0, 0, 0, 0);
      const diffDays = Math.floor((today - dueD) / (1000 * 60 * 60 * 24));

      if (diffDays <= 0) {
        buckets.current = roundBDT(buckets.current + due);
      } else if (diffDays <= 30) {
        buckets.d1_30 = roundBDT(buckets.d1_30 + due);
      } else if (diffDays <= 60) {
        buckets.d31_60 = roundBDT(buckets.d31_60 + due);
      } else if (diffDays <= 90) {
        buckets.d61_90 = roundBDT(buckets.d61_90 + due);
      } else {
        buckets.d90plus = roundBDT(buckets.d90plus + due);
      }
    });

    return buckets;
  }

  function formatPeriodLabel(from, to) {
    if (!from && !to) return 'All Time (Full Transaction History)';
    if (from && to) return `${formatDisplayDate(from)} to ${formatDisplayDate(to)}`;
    if (from) return `From ${formatDisplayDate(from)} onwards`;
    return `Up to ${formatDisplayDate(to)}`;
  }

  function renderStatementUI(data) {
    // 1. Client Meta
    const nameEl = document.getElementById('clientNameDisplay');
    const contactEl = document.getElementById('clientContactDisplay');
    const addrEl = document.getElementById('clientAddressDisplay');
    const commsEl = document.getElementById('clientCommsDisplay');
    const statusBadge = document.getElementById('accountStatusBadge');
    const refEl = document.getElementById('statementRefDisplay');
    const dateEl = document.getElementById('statementDateDisplay');
    const periodEl = document.getElementById('statementPeriodDisplay');

    if (nameEl) nameEl.textContent = data.client.name;
    if (contactEl) {
      const parts = [data.client.company, data.client.title].filter(Boolean);
      contactEl.textContent = parts.join(' • ') || '';
    }
    if (addrEl) addrEl.textContent = data.client.address || 'Registered Office Address Not Provided';
    if (commsEl) {
      const parts = [];
      if (data.client.phone) parts.push(`📞 ${data.client.phone}`);
      if (data.client.email) parts.push(`✉️ ${data.client.email}`);
      if (data.client.bin) parts.push(`BIN/TIN: ${data.client.bin}`);
      commsEl.textContent = parts.join(' | ');
    }

    const todayStr = typeof toLocalISODate === 'function' ? toLocalISODate() : new Date().toISOString().slice(0, 10);
    const cleanClientSlug = (data.client.name || 'CLIENT').replace(/[^a-zA-Z0-9]/g, '').substring(0, 8).toUpperCase();
    const statementRef = `SOA-${todayStr.replace(/-/g, '')}-${cleanClientSlug}`;

    if (refEl) refEl.textContent = statementRef;
    if (dateEl) dateEl.textContent = typeof formatDisplayDate === 'function' ? formatDisplayDate(todayStr) : todayStr;
    if (periodEl) periodEl.textContent = data.period.label;

    if (statusBadge) {
      if (data.closingBalance <= 0) {
        statusBadge.className = 'badge bg-success-subtle text-success border border-success-subtle';
        statusBadge.textContent = 'Account Settled (Nil Balance)';
      } else {
        statusBadge.className = 'badge bg-danger-subtle text-danger border border-danger-subtle';
        statusBadge.textContent = `Outstanding Due: ${formatBDT(data.closingBalance)}`;
      }
    }

    // 2. Financial KPI Ribbon
    const openEl = document.getElementById('openingBalanceVal');
    const debitsEl = document.getElementById('totalDebitsVal');
    const creditsEl = document.getElementById('totalCreditsVal');
    const closingEl = document.getElementById('closingBalanceVal');

    if (openEl) openEl.textContent = formatBDT(data.openingBalance);
    if (debitsEl) debitsEl.textContent = formatBDT(data.totalDebits);
    if (creditsEl) creditsEl.textContent = formatBDT(data.totalCredits);
    if (closingEl) {
      closingEl.textContent = formatBDT(data.closingBalance);
      closingEl.className = data.closingBalance > 0 ? 'kpi-val text-danger' : 'kpi-val text-success';
    }

    // 3. Ledger Table Rows
    const tbody = document.getElementById('ledgerTableBody');
    const tfoot = document.getElementById('ledgerTableFoot');
    if (tbody) {
      tbody.innerHTML = '';

      // If opening balance exists, render Opening Balance row first
      if (data.openingBalance !== 0 || data.period.from) {
        const openTr = document.createElement('tr');
        openTr.className = 'table-light fst-italic';
        openTr.innerHTML = `
          <td>${data.period.from ? escapeHTML(formatDisplayDate(data.period.from)) : '—'}</td>
          <td class="font-monospace text-muted">—</td>
          <td><span class="badge text-bg-secondary">B/F</span></td>
          <td><strong>Opening Balance Brought Forward</strong></td>
          <td class="text-end text-muted">—</td>
          <td class="text-end text-muted">—</td>
          <td class="text-end fw-bold">${formatBDT(data.openingBalance)}</td>
        `;
        tbody.appendChild(openTr);
      }

      if (data.rows.length === 0) {
        const emptyTr = document.createElement('tr');
        emptyTr.innerHTML = `
          <td colspan="7" class="text-center text-muted py-3">
            No transaction records found for ${escapeHTML(data.client.name)} during this period.
          </td>
        `;
        tbody.appendChild(emptyTr);
      } else {
        data.rows.forEach(row => {
          const tr = document.createElement('tr');
          const isInv = row.type === 'Invoice';
          tr.innerHTML = `
            <td>${escapeHTML(formatDisplayDate(row.date))}</td>
            <td>
              <a href="${escapeAttr(row.url)}" target="_blank" class="fw-semibold font-monospace text-decoration-none">
                ${escapeHTML(row.ref)}
              </a>
            </td>
            <td>
              <span class="badge ${isInv ? 'bg-primary-subtle text-primary border border-primary-subtle' : 'bg-success-subtle text-success border border-success-subtle'}">
                ${escapeHTML(row.type)}
              </span>
            </td>
            <td>
              <div class="text-truncate" style="max-width: 280px;" title="${escapeAttr(row.desc)}">
                ${escapeHTML(row.desc)}
              </div>
            </td>
            <td class="text-end ${row.debit > 0 ? 'fw-semibold text-danger' : 'text-muted'}">
              ${row.debit > 0 ? formatBDT(row.debit) : '—'}
            </td>
            <td class="text-end ${row.credit > 0 ? 'fw-semibold text-success' : 'text-muted'}">
              ${row.credit > 0 ? formatBDT(row.credit) : '—'}
            </td>
            <td class="text-end fw-bold ${row.balance > 0 ? 'text-danger' : 'text-success'}">
              ${formatBDT(row.balance)}
            </td>
          `;
          tbody.appendChild(tr);
        });
      }
    }

    if (tfoot) {
      tfoot.innerHTML = `
        <tr>
          <td colspan="4" class="text-end text-uppercase small text-muted">Period Totals:</td>
          <td class="text-end text-danger">${formatBDT(data.totalDebits)}</td>
          <td class="text-end text-success">${formatBDT(data.totalCredits)}</td>
          <td class="text-end ${data.closingBalance > 0 ? 'text-danger' : 'text-success'}">${formatBDT(data.closingBalance)}</td>
        </tr>
      `;
    }

    // 4. Receivables Aging
    const agCurr = document.getElementById('agingCurrentVal');
    const ag1to30 = document.getElementById('aging1to30Val');
    const ag31to60 = document.getElementById('aging31to60Val');
    const ag61to90 = document.getElementById('aging61to90Val');
    const ag90plus = document.getElementById('aging90PlusVal');

    if (agCurr) agCurr.textContent = formatBDT(data.aging.current);
    if (ag1to30) ag1to30.textContent = formatBDT(data.aging.d1_30);
    if (ag31to60) ag31to60.textContent = formatBDT(data.aging.d31_60);
    if (ag61to90) ag61to90.textContent = formatBDT(data.aging.d61_90);
    if (ag90plus) ag90plus.textContent = formatBDT(data.aging.d90plus);

    // 5. Verification QR Code
    const qrEl = document.getElementById('qrContainer');
    const qrWrap = document.getElementById('statementQrWrap') || qrEl?.closest?.('.qr-block-wrap');
    if (qrEl && typeof renderQR === 'function') {
      if (qrWrap) qrWrap.classList.remove('d-none');
      qrEl.classList.remove('d-none');
      const ben = data.biller?.name || 'AutoInvoice';
      const qrPayload = typeof buildQRPayload === 'function'
        ? buildQRPayload('STATEMENT', {
          number: statementRef,
          date: todayStr,
          amount: data.closingBalance,
          company: ben,
          client: data.client.name
        })
        : `DOC=STATEMENT|TXID=${statementRef}|DT=${todayStr}|AMT=${data.closingBalance}|CCY=BDT|BEN=${ben}|REC=${data.client.name}|V=1`;
      renderQR(qrEl, qrPayload);
    }
  }

  function renderEmptyState(message) {
    currentStatementData = null;
    const tbody = document.getElementById('ledgerTableBody');
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted py-4">${escapeHTML(message)}</td></tr>`;
    }
    const tfoot = document.getElementById('ledgerTableFoot');
    if (tfoot) tfoot.innerHTML = '';
    const nameEl = document.getElementById('clientNameDisplay');
    if (nameEl) nameEl.textContent = 'Select a client to view statement';
    ['clientContactDisplay', 'clientAddressDisplay', 'clientCommsDisplay'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = '';
    });
    const refEl = document.getElementById('statementRefDisplay');
    if (refEl) refEl.textContent = '—';
    const dateEl = document.getElementById('statementDateDisplay');
    if (dateEl) dateEl.textContent = '—';
    const periodEl = document.getElementById('statementPeriodDisplay');
    if (periodEl) periodEl.textContent = 'All Time';
    ['openingBalanceVal', 'totalDebitsVal', 'totalCreditsVal', 'closingBalanceVal', 'agingCurrentVal', 'aging1to30Val', 'aging31to60Val', 'aging61to90Val', 'aging90PlusVal'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = '৳0.00';
    });
    const closingEl = document.getElementById('closingBalanceVal');
    if (closingEl) closingEl.className = 'kpi-val text-danger';
    const qrEl = document.getElementById('qrContainer');
    const qrWrap = document.getElementById('statementQrWrap') || qrEl?.closest?.('.qr-block-wrap');
    if (qrWrap) qrWrap.classList.add('d-none');
    if (qrEl) {
      qrEl.innerHTML = '';
      qrEl.classList.add('d-none');
    }
    const statusBadge = document.getElementById('accountStatusBadge');
    if (statusBadge) {
      statusBadge.className = 'badge bg-secondary-subtle text-secondary';
      statusBadge.textContent = 'No Client Selected';
    }
  }

  function exportStatementCSV() {
    if (!currentStatementData) {
      if (typeof showToast === 'function') showToast('Please select a client to export statement.', 'warning');
      return;
    }
    const d = currentStatementData;
    const genDate = typeof toLocalISODate === 'function' ? toLocalISODate() : new Date().toISOString().slice(0, 10);
    const rows = [
      ['STATEMENT OF ACCOUNT / CLIENT LEDGER'],
      ['Biller / Issuer', d.biller?.name || 'AutoInvoice'],
      ['Customer / Client', d.client.name],
      ['Billing Address', d.client.address || ''],
      ['Statement Period', d.period.label],
      ['Generated Date', genDate],
      ['Opening Balance (BDT)', d.openingBalance],
      ['Total Debits (BDT)', d.totalDebits],
      ['Total Credits (BDT)', d.totalCredits],
      ['Closing Balance Due (BDT)', d.closingBalance],
      [],
      ['Date', 'Reference #', 'Type', 'Description', 'Biller', 'Debit (BDT)', 'Credit (BDT)', 'Running Balance (BDT)']
    ];

    if (d.openingBalance !== 0 || d.period.from) {
      rows.push([
        d.period.from || '',
        '-',
        'Opening Balance',
        'Balance Brought Forward',
        '-',
        '0.00',
        '0.00',
        d.openingBalance.toFixed(2)
      ]);
    }

    d.rows.forEach(r => {
      rows.push([
        r.date,
        r.ref,
        r.type,
        r.desc,
        r.biller,
        r.debit.toFixed(2),
        r.credit.toFixed(2),
        r.balance.toFixed(2)
      ]);
    });

    const safeName = (d.client.name || 'client').replace(/[^a-zA-Z0-9]/g, '_');
    const fname = `Statement_${safeName}_${genDate}.csv`;
    if (typeof downloadCSV === 'function') {
      downloadCSV(fname, rows);
    }
    if (typeof showToast === 'function') showToast('Statement exported to CSV.', 'success');
  }

  function shareViaWhatsApp() {
    if (!currentStatementData) return;
    const d = currentStatementData;
    const msg = `Dear ${d.client.name},\n\nPlease find your Statement of Account from ${d.biller?.name || 'AutoInvoice'}.\n\n` +
      `*Statement Period:* ${d.period.label}\n` +
      `*Total Invoiced:* ${formatBDT(d.totalDebits)}\n` +
      `*Total Paid:* ${formatBDT(d.totalCredits)}\n` +
      `*Closing Balance Due:* ${formatBDT(d.closingBalance)}\n\n` +
      `Kindly verify and remit the pending balance at your earliest convenience. Thank you!`;

    const phone = (d.client.phone || '').replace(/[^0-9]/g, '');
    const url = phone
      ? `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  }

  function shareViaEmail() {
    if (!currentStatementData) return;
    const d = currentStatementData;
    const subject = `Statement of Account — ${d.client.name} [${d.biller?.name || 'AutoInvoice'}]`;
    const body = `Dear ${d.client.name},\n\n` +
      `Please review the summary of your Statement of Account with ${d.biller?.name || 'AutoInvoice'}.\n\n` +
      `Statement Period: ${d.period.label}\n` +
      `Total Invoiced (Debits): BDT ${d.totalDebits.toLocaleString('en-IN', { minimumFractionDigits: 2 })}\n` +
      `Total Payments (Credits): BDT ${d.totalCredits.toLocaleString('en-IN', { minimumFractionDigits: 2 })}\n` +
      `Closing Balance Due: BDT ${d.closingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}\n\n` +
      `Please let us know if you require a formal PDF or invoice breakdown.\n\n` +
      `Warm regards,\n${d.biller?.name || 'AutoInvoice'}\n${d.biller?.phone || ''}`;

    const mailto = `mailto:${encodeURIComponent(d.client.email || '')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailto;
  }

  function buildReceiptStatementRow(rc, activeBiller) {
    const bObj = typeof getBillerById === 'function' && rc.billerId ? getBillerById(rc.billerId) : null;
    const bName = bObj?.name || (rc.company?.name || activeBiller?.name || 'Default');
    const rcNum = rc.receiptNumber || rc.number || 'RCPT';
    const method = rc.paymentMethod || 'Payment';
    const linked = rc.invoiceNumber ? ` for Invoice ${rc.invoiceNumber}` : '';
    let desc = `Payment Received via ${method}${linked}`;
    if (rc.adjustment && rc.adjustment.applied) {
      const adjVal = roundBDT(Number(rc.adjustment.amount || 0));
      desc += adjVal < 0
        ? ` [Surcharge Adj: +৳${Math.abs(adjVal).toFixed(2)}]`
        : ` [Settlement Adj: ৳${adjVal.toFixed(2)}]`;
    }
    const effCredit = roundBDT(rc._effectiveCredit != null ? rc._effectiveCredit : (rc.amount || 0));
    return {
      date: rc.date || '',
      ref: rcNum,
      type: 'Receipt',
      desc,
      biller: bName,
      debit: effCredit < 0 ? roundBDT(Math.abs(effCredit)) : 0,
      credit: effCredit >= 0 ? effCredit : 0,
      rawDoc: rc,
      url: `receipt.html?no=${encodeURIComponent(rcNum)}`
    };
  }

  document.addEventListener('DOMContentLoaded', init);

  // Expose for testing
  window.StatementEngine = {
    generateStatement,
    calculateAging,
    applyDatePreset,
    buildReceiptStatementRow
  };
})();
