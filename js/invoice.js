// Invoice page logic: dynamic items, totals, QR, save, print

document.addEventListener('DOMContentLoaded', () => {
  setCompanyHeader();

  const invoiceNumberEl = document.getElementById('invoiceNumber');
  const invoiceDateEl = document.getElementById('invoiceDate');
  const dueDateEl = document.getElementById('dueDate');
  const clientNameEl = document.getElementById('clientName');
  const clientAddressEl = document.getElementById('clientAddress');
  const clientListEl = document.getElementById('clientList');
  const docTitleInput = document.getElementById('docTitle');
  const docTitleHeader = document.getElementById('docTitleHeader');
  const paymentMethodEl = document.getElementById('paymentMethod');
  const itemRowsEl = document.getElementById('itemRows');
  const addRowBtn = document.getElementById('addRowBtn');
  const grandTotalEl = document.getElementById('grandTotal');
  const discountInputEl = document.getElementById('invoiceDiscount');
  const discountModeEl = document.getElementById('discountMode');
  const discountRateLabelEl = document.getElementById('discountRateLabel');
  const vatRateInputEl = document.getElementById('invoiceVatRate');
  const vatModeEl = document.getElementById('vatMode');
  const vatAmountDisplayEl = document.getElementById('vatAmountDisplay');
  const discountRowEl = document.getElementById('discountRow');
  const vatRowEl = document.getElementById('vatRow');
  const discountPrintEl = document.getElementById('discountDisplayPrint');
  const vatRateLabelEl = document.getElementById('vatRateLabel');
  const poRefEl = document.getElementById('poRef');
  const headerTotalEl = document.getElementById('headerTotal');
  const amountWordsEl = document.getElementById('amountInWords');
  const saveBtn = document.getElementById('saveInvoiceBtn');
  const exportBtn = document.getElementById('exportInvoiceBtn');
  const printBtn = document.getElementById('printBtn');
  const resetBtn = document.getElementById('resetBtn');
  const duplicateInvoiceBtn = document.getElementById('duplicateInvoiceBtn');
  const linkedChallanEl = document.getElementById('linkedChallan');
  const qrContainer = document.getElementById('qrContainer');
  const paymentStatusBannerEl = document.getElementById('paymentStatusBanner');
  const LAST_CLIENT_KEY = 'ai_last_client_invoice';
  let activeParams = parseQuery();
  let sourceBillerId = null;

  function getDraftKey() {
    const num = (invoiceNumberEl ? invoiceNumberEl.value.trim() : '');
    const isNew = !activeParams || !activeParams.no;
    return isNew ? 'ai_invoice_draft_new' : `ai_invoice_draft_${num || activeParams.no}`;
  }

  function clearDraft() {
    try {
      localStorage.removeItem(getDraftKey());
      localStorage.removeItem('ai_invoice_draft');
      if (invoiceNumberEl && invoiceNumberEl.value) {
        localStorage.removeItem(`ai_invoice_draft_${invoiceNumberEl.value.trim()}`);
      }
      if (activeParams && activeParams.no) {
        localStorage.removeItem(`ai_invoice_draft_${activeParams.no}`);
      }
    } catch (e) {
      console.warn('Failed to clear draft', e);
    }
  }

  function renderPaymentStatusBanner(inv) {
    if (!paymentStatusBannerEl) return;
    const stats = getInvoicePaymentStats(inv);
    const isOverdue = stats.isOverdue;
    let alertClass = 'alert-info';
    let badgeHtml = '';
    if (stats.status === 'Void') {
      alertClass = 'alert-secondary';
      badgeHtml = '<span class="badge bg-dark fs-6 me-2">Void / Cancelled</span>';
    } else if (isOverdue) {
      alertClass = 'alert-danger';
      badgeHtml = '<span class="badge bg-danger fs-6 me-2">Overdue</span>';
    } else if (stats.status === 'Paid') {
      alertClass = 'alert-success';
      badgeHtml = '<span class="badge bg-success fs-6 me-2">Paid in Full</span>';
    } else if (stats.status === 'Partial') {
      alertClass = 'alert-warning';
      badgeHtml = '<span class="badge bg-warning text-dark fs-6 me-2">Partially Paid</span>';
    } else {
      alertClass = 'alert-secondary';
      badgeHtml = '<span class="badge bg-secondary fs-6 me-2">Unpaid</span>';
    }

    let rcptLinks = '';
    if (stats.receipts && stats.receipts.length) {
      rcptLinks = stats.receipts.map(r => `
        <a href="receipt.html?rcpt=${encodeURIComponent(r.receiptNumber)}" class="badge bg-primary-subtle text-primary border text-decoration-none p-1 me-1">
          🧾 ${escapeHTML(r.receiptNumber)} (${formatBDT(r.amount)})
        </a>
      `).join('');
    } else {
      rcptLinks = '<span class="text-muted small">No receipts recorded</span>';
    }

    let dispatchHtml = '';
    if (typeof getInvoiceDispatchStats === 'function' && inv.invoiceNumber) {
      const ds = getInvoiceDispatchStats(inv);
      const dispBadge = ds.status === 'Fully Delivered'
        ? '<span class="badge bg-success me-1">Fully Delivered</span>'
        : ds.status === 'Partially Delivered'
          ? '<span class="badge bg-warning text-dark me-1">Partially Delivered</span>'
          : '<span class="badge bg-secondary me-1">Pending Dispatch</span>';
      const chLinks = ds.challans.length
        ? ds.challans.map(c => {
            const cQty = (c.items || []).reduce((s, it) => s + (Number(it.qty || 0) || 0), 0);
            return `<a href="challan.html?no=${encodeURIComponent(c.challanNumber)}" class="badge bg-info-subtle text-info-emphasis border text-decoration-none p-1 me-1">🚚 ${escapeHTML(c.challanNumber)} (${cQty})</a>`;
          }).join('')
        : '<span class="text-muted small">No challans dispatched</span>';
      const dispatchBtn = (ds.totalRemainingQty > 0 || ds.challans.length === 0) && inv.status !== 'Void'
        ? `<a href="challan.html?inv=${encodeURIComponent(inv.invoiceNumber)}" class="btn btn-sm btn-outline-primary ms-2 bg-body">${ds.challans.length ? 'Dispatch Remaining' : 'Create Challan'}</a>`
        : '';
      dispatchHtml = `
        <div class="d-flex flex-wrap align-items-center justify-content-between gap-2 mt-2 pt-2 border-top border-secondary-subtle">
          <div class="d-flex align-items-center flex-wrap gap-2 small">
            ${dispBadge}
            <span><strong>Dispatched:</strong> ${ds.totalDispatchedQty} / ${ds.totalOrderedQty} units</span>
            ${ds.totalRemainingQty > 0 ? `<span class="text-muted">(${ds.totalRemainingQty} remaining)</span>` : ''}
          </div>
          <div class="d-flex align-items-center flex-wrap gap-1">
            <span class="small me-1">Challans:</span>
            ${chLinks}
            ${dispatchBtn}
          </div>
        </div>
      `;
    }

    paymentStatusBannerEl.className = `alert ${alertClass} p-3 mb-3 no-print shadow-sm`;
    paymentStatusBannerEl.innerHTML = `
      <div class="d-flex flex-wrap align-items-center justify-content-between gap-2">
        <div class="d-flex align-items-center flex-wrap gap-2">
          ${badgeHtml}
          <span><strong>Total:</strong> ${formatBDT(stats.total)}</span>
          <span class="text-muted">|</span>
          <span class="text-success"><strong>Paid:</strong> ${formatBDT(stats.paid)}</span>
          <span class="text-muted">|</span>
          <span class="text-danger"><strong>Remaining Due:</strong> ${formatBDT(stats.due)}</span>
        </div>
        <div class="d-flex align-items-center gap-1">
          <span class="small me-1">Receipts:</span>
          ${rcptLinks}
          <a href="receipt.html?inv=${encodeURIComponent(inv.invoiceNumber)}" class="btn btn-sm btn-outline-success ms-2 bg-body">Record Payment</a>
        </div>
      </div>
      ${dispatchHtml}
    `;
    paymentStatusBannerEl.classList.remove('d-none');
    updateReceiptBreakdown(stats);
  }

  function updateReceiptBreakdown(stats) {
    const payRow = document.getElementById('paymentBreakdownRow');
    const dueRow = document.getElementById('dueBreakdownRow');
    const paidEl = document.getElementById('paidAmountDisplay');
    const dueEl = document.getElementById('dueAmountDisplay');

    if (stats && (stats.paid > 0 || stats.due > 0)) {
      if (payRow) payRow.classList.remove('d-none');
      if (dueRow) dueRow.classList.remove('d-none');
      if (paidEl) paidEl.textContent = formatBDT(stats.paid);
      if (dueEl) dueEl.textContent = formatBDT(stats.due);
    } else {
      if (payRow) payRow.classList.add('d-none');
      if (dueRow) dueRow.classList.add('d-none');
    }
  }

  // Client Display Card synchronization
  function syncClientDisplay() {
    const name = clientNameEl ? clientNameEl.value.trim() : '';
    const addr = clientAddressEl ? clientAddressEl.value.trim() : '';
    const nameDisp = document.getElementById('clientNameDisplay');
    const contactDisp = document.getElementById('clientContactDisplay');
    const addrDisp = document.getElementById('clientAddressDisplay');
    const commsDisp = document.getElementById('clientCommsDisplay');
    const binDisp = document.getElementById('clientBinDisplay');

    if (!name) {
      if (nameDisp) nameDisp.textContent = '—';
      if (contactDisp) contactDisp.textContent = '';
      if (addrDisp) addrDisp.textContent = 'No client address specified';
      if (commsDisp) commsDisp.textContent = '';
      if (binDisp) binDisp.textContent = '';
      return;
    }

    let match = null;
    if (typeof loadClients === 'function') {
      match = loadClients().find(c => (c.name || '').toLowerCase() === name.toLowerCase());
    }

    if (nameDisp) nameDisp.textContent = name;
    if (addrDisp) addrDisp.textContent = addr || (match && match.address) || '';

    const contactParts = [];
    if (match && match.company && match.company.toLowerCase() !== name.toLowerCase()) {
      contactParts.push(match.company);
    }
    if (match && match.title) {
      contactParts.push(match.title);
    }
    if (contactDisp) {
      contactDisp.textContent = contactParts.length ? `Attn: ${contactParts.join(' • ')}` : '';
    }

    const commsParts = [];
    if (match && match.phone) commsParts.push(`Phone: ${match.phone}`);
    if (match && match.email) commsParts.push(`Email: ${match.email}`);
    if (commsDisp) {
      commsDisp.textContent = commsParts.length ? commsParts.join(' | ') : '';
    }
    if (binDisp) {
      binDisp.textContent = match && match.bin ? `Client BIN/TIN: ${match.bin}` : '';
    }
  }

  // Sync print-only labels and summary values
  function syncPrintDisplayValues() {
    syncClientDisplay();

    const invNumPrint = document.getElementById('invoiceNumberPrint');
    const invDatePrint = document.getElementById('invoiceDatePrint');
    const dueDatePrint = document.getElementById('dueDatePrint');
    const payMethodPrint = document.getElementById('paymentMethodPrint');
    const linkChPrint = document.getElementById('linkedChallanPrint');
    const poRefPrint = document.getElementById('poRefPrint');
    const docTitlePrint = document.getElementById('docTitlePrint');
    const subtotalEl = document.getElementById('subtotalDisplay');

    if (invNumPrint && invoiceNumberEl) invNumPrint.textContent = invoiceNumberEl.value || '—';
    if (invDatePrint && invoiceDateEl) {
      invDatePrint.textContent = typeof formatDisplayDate === 'function' ? formatDisplayDate(invoiceDateEl.value) : invoiceDateEl.value;
    }
    if (dueDatePrint && dueDateEl) {
      dueDatePrint.textContent = typeof formatDisplayDate === 'function' ? formatDisplayDate(dueDateEl.value) : dueDateEl.value;
    }
    if (payMethodPrint && paymentMethodEl) {
      payMethodPrint.textContent = paymentMethodEl.value || 'Cash';
    }
    if (linkChPrint) {
      let chVal = (linkedChallanEl && linkedChallanEl.value.trim()) ? linkedChallanEl.value.trim() : '';
      if (!chVal && invoiceNumberEl?.value && typeof getChallansByInvoiceNumber === 'function') {
        const linkedList = getChallansByInvoiceNumber(invoiceNumberEl.value);
        if (linkedList.length) chVal = linkedList.map(c => c.challanNumber).join(', ');
      }
      linkChPrint.textContent = chVal || '—';
    }
    if (poRefPrint) {
      poRefPrint.textContent = (poRefEl && poRefEl.value.trim()) ? poRefEl.value.trim() : '—';
    }
    if (docTitlePrint) {
      docTitlePrint.textContent = (docTitleInput && docTitleInput.value.trim()) ? docTitleInput.value.trim() : '—';
    }
    const totals = getInvoiceTotalsBreakdown();
    if (subtotalEl) {
      subtotalEl.textContent = formatBDT(totals.subtotal);
    }
    if (discountRateLabelEl) {
      discountRateLabelEl.textContent = totals.discountMode === 'percent' && totals.discountValue > 0
        ? `Discount (${totals.discountValue}%):`
        : 'Discount:';
    }
    if (discountPrintEl) {
      discountPrintEl.textContent = `-${formatBDT(totals.discount)}`;
    }
    if (discountRowEl) {
      discountRowEl.classList.toggle('no-print', totals.discount <= 0);
    }
    if (vatAmountDisplayEl) {
      vatAmountDisplayEl.textContent = formatBDT(totals.vatAmount);
    }
    if (vatRateLabelEl) {
      if (totals.vatRate > 0) {
        vatRateLabelEl.textContent = totals.vatInclusive ? `Incl. VAT (${totals.vatRate}%):` : `VAT (${totals.vatRate}%):`;
      } else {
        vatRateLabelEl.textContent = 'VAT (%):';
      }
    }
    if (vatRowEl) {
      vatRowEl.classList.toggle('no-print', totals.vatRate <= 0);
    }
  }

  let isDirty = false;
  const printAreaEl = document.getElementById('printArea');
  if (printAreaEl) {
    printAreaEl.addEventListener('input', () => { isDirty = true; });
  }
  window.addEventListener('beforeunload', (e) => {
    if (isDirty) {
      e.preventDefault();
      e.returnValue = '';
    }
  });

  const modeBadgeEl = document.getElementById('modeBadge');
  function updateModeBadge(isEditing, docNo) {
    if (!modeBadgeEl) return;
    if (isEditing) {
      modeBadgeEl.innerHTML = `<span class="badge bg-primary fs-6 px-3 py-2 shadow-sm">📝 Editing Invoice: ${escapeHTML(docNo)}</span>`;
    } else {
      modeBadgeEl.innerHTML = `<span class="badge bg-success fs-6 px-3 py-2 shadow-sm">✨ New Invoice</span>`;
    }
  }

  // Initialize Client Onboarding and Item Catalog
  let clientOnboarding = null;
  let itemCatalog = null;
  if (window.AutoInvoiceCatalog) {
    clientOnboarding = AutoInvoiceCatalog.setupClientOnboarding({
      selectId: 'clientSelect',
      datalistId: 'clientList',
      nameInputId: 'clientName',
      addressInputId: 'clientAddress',
      onClientSelected: (client) => {
        isDirty = true;
        syncPrintDisplayValues();
        debouncedRenderQR();
      }
    });

    itemCatalog = AutoInvoiceCatalog.setupItemCatalog({
      datalistId: 'itemList',
      onItemPicked: (item) => {
        addRowFromData({
          name: item.name || '',
          desc: item.desc || '',
          unit: item.unit || 'Pcs',
          unitPrice: item.unitPrice || 0,
          qty: 1
        });
      }
    });
  }

  function populateChallanDatalist() {
    const challanListEl = document.getElementById('challanList');
    if (!challanListEl || typeof loadChallans !== 'function') return;
    try {
      const challans = loadChallans();
      challanListEl.innerHTML = '';
      challans.forEach(ch => {
        if (!ch.challanNumber) return;
        const opt = document.createElement('option');
        opt.value = ch.challanNumber;
        opt.label = `${ch.challanNumber} — ${ch.client?.name || ''}`;
        challanListEl.appendChild(opt);
      });
    } catch (e) {
      console.warn('Failed to populate challan datalist', e);
    }
  }
  populateChallanDatalist();

  if (clientNameEl) {
    clientNameEl.addEventListener('input', () => {
      const val = clientNameEl.value.trim().toLowerCase();
      if (!val || typeof loadClients !== 'function') return;
      const match = loadClients().find(c => (c.name || '').toLowerCase() === val);
      if (match && match.address && clientAddressEl && !clientAddressEl.value) {
        clientAddressEl.value = match.address;
      }
      const clientSelect = document.getElementById('clientSelect');
      if (clientSelect && match) {
        clientSelect.value = match.name;
      }
    });
  }

  const debouncedRenderQR = debounce(() => renderQR(qrContainer, buildQRText()), 300);

  (async function initInvoicePage() {
    const params = parseQuery();
    if (params.no) {
      let inv = getInvoiceByNumber(params.no);
      if (!inv && typeof getDiskInvoiceByNumber === 'function') {
        try { inv = await getDiskInvoiceByNumber(params.no); } catch (e) {
          console.warn('Failed to load disk invoice', e);
        }
      }
      if (inv) {
        invoiceNumberEl.value = inv.invoiceNumber;
        invoiceDateEl.value = inv.date || '';
        clientNameEl.value = inv.client?.name || '';
        clientAddressEl.value = inv.client?.address || '';
        if (docTitleInput) docTitleInput.value = inv.title || '';
        if (docTitleHeader) docTitleHeader.textContent = inv.title || '';
        if (linkedChallanEl && inv.linkedChallan) linkedChallanEl.value = inv.linkedChallan;
        if (poRefEl) poRefEl.value = inv.poRef || '';
        if (paymentMethodEl && inv.paymentMethod) paymentMethodEl.value = inv.paymentMethod;
        if (dueDateEl && inv.dueDate) dueDateEl.value = inv.dueDate;
        if (discountModeEl) discountModeEl.value = inv.discountMode || 'bdt';
        if (discountInputEl) discountInputEl.value = String(inv.discountMode === 'percent' ? (inv.discountValue || 0) : (inv.discount || 0));
        if (vatModeEl) vatModeEl.value = inv.vatInclusive ? 'incl' : 'excl';
        if (vatRateInputEl) vatRateInputEl.value = String(inv.vatRate || 0);
        itemRowsEl.innerHTML = '';
        (inv.items || []).forEach(addRowFromData);
        updateGrandTotal();
        renderQR(qrContainer, inv.qrData || buildQRText());
        updateModeBadge(true, inv.invoiceNumber);
        if (inv.billerId || inv.company) {
          const invBiller = (typeof getBillerById === 'function' && inv.billerId ? getBillerById(inv.billerId) : null) || inv.company;
          if (invBiller) setCompanyHeader(invBiller);
        }
        renderPaymentStatusBanner(inv);
        // Check for isolated draft for this specific invoice
        const existingDraft = localStorage.getItem(`ai_invoice_draft_${inv.invoiceNumber}`);
        if (existingDraft) {
          try {
            const d = JSON.parse(existingDraft);
            if (d && confirm(`Unsaved edits found for invoice ${inv.invoiceNumber}. Would you like to restore them?`)) {
              clientNameEl.value = d.client?.name || clientNameEl.value;
              clientAddressEl.value = d.client?.address || clientAddressEl.value;
              if (docTitleInput && d.title) docTitleInput.value = d.title;
              if (docTitleHeader && d.title) docTitleHeader.textContent = d.title;
              if (linkedChallanEl && d.linkedChallan) linkedChallanEl.value = d.linkedChallan;
              if (poRefEl && d.poRef != null) poRefEl.value = d.poRef;
              if (paymentMethodEl && d.paymentMethod) paymentMethodEl.value = d.paymentMethod;
              if (dueDateEl && d.dueDate) dueDateEl.value = d.dueDate;
              if (discountModeEl && d.discountMode) discountModeEl.value = d.discountMode;
              if (discountInputEl && (d.discountValue != null || d.discount != null)) {
                discountInputEl.value = String(d.discountMode === 'percent' ? (d.discountValue || 0) : (d.discount || 0));
              }
              if (vatModeEl && d.vatInclusive != null) vatModeEl.value = d.vatInclusive ? 'incl' : 'excl';
              if (vatRateInputEl && d.vatRate != null) vatRateInputEl.value = String(d.vatRate);
              if (d.items && d.items.length) {
                itemRowsEl.innerHTML = '';
                d.items.forEach(addRowFromData);
              }
              updateGrandTotal();
              renderQR(qrContainer, buildQRText());
            } else {
              localStorage.removeItem(`ai_invoice_draft_${inv.invoiceNumber}`);
            }
          } catch (e) {
            localStorage.removeItem(`ai_invoice_draft_${inv.invoiceNumber}`);
          }
        }
        syncClientDisplay();
        syncPrintDisplayValues();
        return;
      }
    } else if (params.ch) {
      let ch = getChallanByNumber(params.ch);
      if (!ch && typeof getDiskChallanByNumber === 'function') {
        try { ch = await getDiskChallanByNumber(params.ch); } catch (e) {
          console.warn('Failed to load disk challan', e);
        }
      }
      if (ch) {
        if (ch.billerId) {
          sourceBillerId = ch.billerId;
          const chBiller = typeof getBillerById === 'function' ? getBillerById(ch.billerId) : null;
          if (chBiller) setCompanyHeader(chBiller);
        }
        invoiceNumberEl.value = peekNextInvoiceNumber(sourceBillerId);
        invoiceDateEl.value = ch.date || formatISO(new Date());
        if (dueDateEl) {
          const base = parseISO(invoiceDateEl.value);
          dueDateEl.value = formatISO(addWorkingDays(base, 15));
        }
        clientNameEl.value = ch.client?.name || '';
        clientAddressEl.value = ch.client?.address || ch.deliveryAddress || '';
        if (docTitleInput) docTitleInput.value = ch.title || '';
        if (docTitleHeader) docTitleHeader.textContent = ch.title || '';
        if (linkedChallanEl) linkedChallanEl.value = ch.challanNumber || params.ch;
        if (poRefEl && ch.poRef) poRefEl.value = ch.poRef;
        itemRowsEl.innerHTML = '';
        (ch.items || []).forEach(it => {
          const catItem = (typeof getItemByName === 'function' && it.name) ? getItemByName(it.name) : null;
          addRowFromData({
            name: it.name || '',
            desc: it.desc || (catItem?.desc || ''),
            qty: it.qty || 1,
            unit: it.unit || catItem?.unit || 'Pcs',
            unitPrice: it.unitPrice || catItem?.unitPrice || 0
          });
        });
        updateGrandTotal();
        renderQR(qrContainer, buildQRText());
        updateModeBadge(false);
        syncClientDisplay();
        syncPrintDisplayValues();
        return;
      }
    } else if (params.qtn) {
      const q = getQuotationByNumber(params.qtn);
      let loadQtn = !!q;
      if (q) {
        const qStats = typeof getQuotationStatus === 'function' ? getQuotationStatus(q) : null;
        if (qStats && qStats.isExpired) {
          const expDisplay = typeof formatDisplayDate === 'function' ? formatDisplayDate(qStats.validUntil) : qStats.validUntil;
          if (!confirm(`Warning: Quotation ${q.quotationNumber} expired on ${expDisplay}. Do you still want to load and convert it into an invoice?`)) {
            if (typeof history !== 'undefined' && window.location.search) {
              try { history.replaceState(null, '', window.location.pathname); } catch (_) { }
            }
            activeParams = {};
            loadQtn = false;
          }
        }
      }
      if (q && loadQtn) {
        const qBillerId = q.billerId || (typeof getActiveBillerId === 'function' ? getActiveBillerId() : 'biller_default');
        sourceBillerId = qBillerId;
        const qBiller = (typeof getBillerById === 'function' ? getBillerById(qBillerId) : null);
        if (qBiller) setCompanyHeader(qBiller);
        invoiceNumberEl.value = peekNextInvoiceNumber(qBillerId);
        invoiceDateEl.value = q.date || formatISO(new Date());
        if (dueDateEl) {
          const base = parseISO(invoiceDateEl.value);
          dueDateEl.value = formatISO(addWorkingDays(base, 15));
        }
        clientNameEl.value = q.to?.name || q.to?.company || '';
        clientAddressEl.value = q.to?.address || '';
        if (docTitleInput) docTitleInput.value = q.subject || '';
        if (docTitleHeader) docTitleHeader.textContent = q.subject || '';
        if (discountModeEl && q.discountMode) discountModeEl.value = q.discountMode;
        if (discountInputEl && (q.discountValue != null || q.discount != null)) {
          discountInputEl.value = String(q.discountMode === 'percent' ? (q.discountValue || 0) : (q.discount || 0));
        }
        if (vatModeEl && q.vatInclusive != null) vatModeEl.value = q.vatInclusive ? 'incl' : 'excl';
        if (vatRateInputEl && q.vatRate != null) vatRateInputEl.value = String(q.vatRate);
        itemRowsEl.innerHTML = '';
        (q.items || []).forEach(it => {
          let iName = it.name || '';
          let iDesc = it.desc || '';
          if (!iName && iDesc) {
            const idx = iDesc.indexOf(' - ');
            if (idx > 0) {
              iName = iDesc.slice(0, idx).trim();
              iDesc = iDesc.slice(idx + 3).trim();
            } else {
              iName = iDesc;
              iDesc = '';
            }
          }
          addRowFromData({ name: iName, desc: iDesc, qty: it.qty || 1, unit: it.unit || 'Pcs', unitPrice: it.unitPrice || 0 });
        });
        updateGrandTotal();
        renderQR(qrContainer, buildQRText());
        updateModeBadge(false);
        syncClientDisplay();
        syncPrintDisplayValues();
        return;
      }
    }

    // New document flow
    updateModeBadge(false);
    invoiceNumberEl.value = peekNextInvoiceNumber();

    const savedDraft = localStorage.getItem('ai_invoice_draft_new') || localStorage.getItem('ai_invoice_draft');
    if (savedDraft) {
      try {
        const draft = JSON.parse(savedDraft);
        if (draft && (draft.client?.name || (draft.items && draft.items.length))) {
          const restore = confirm('Unsaved invoice draft found. Would you like to restore it?');
          if (restore) {
            clientNameEl.value = draft.client?.name || '';
            clientAddressEl.value = draft.client?.address || '';
            if (docTitleInput) docTitleInput.value = draft.title || '';
            if (docTitleHeader) docTitleHeader.textContent = draft.title || '';
            if (paymentMethodEl && draft.paymentMethod) paymentMethodEl.value = draft.paymentMethod;
            if (linkedChallanEl && draft.linkedChallan) linkedChallanEl.value = draft.linkedChallan;
            if (poRefEl && draft.poRef) poRefEl.value = draft.poRef;
            if (discountModeEl && draft.discountMode) discountModeEl.value = draft.discountMode;
            if (discountInputEl && (draft.discountValue != null || draft.discount != null)) {
              discountInputEl.value = String(draft.discountMode === 'percent' ? (draft.discountValue || 0) : (draft.discount || 0));
            }
            if (vatModeEl && draft.vatInclusive != null) vatModeEl.value = draft.vatInclusive ? 'incl' : 'excl';
            if (vatRateInputEl && draft.vatRate != null) vatRateInputEl.value = String(draft.vatRate);
            const todayD = new Date();
            invoiceDateEl.value = draft.date || formatISO(todayD);
            dueDateEl.value = draft.dueDate || formatISO(addWorkingDays(todayD, 15));
            itemRowsEl.innerHTML = '';
            (draft.items || []).forEach(addRowFromData);
            updateGrandTotal();
            renderQR(qrContainer, buildQRText());
            syncClientDisplay();
            syncPrintDisplayValues();
            return;
          } else {
            clearDraft();
          }
        }
      } catch (e) {
        console.warn('Failed to parse draft', e);
        clearDraft();
      }
    }

    // Default dates and single empty row for fresh document
    const today = new Date();
    const todayIso = formatISO(today);
    invoiceDateEl.value = todayIso;
    dueDateEl.value = formatISO(addWorkingDays(today, 15));

    try {
      const lastClient = JSON.parse(localStorage.getItem(LAST_CLIENT_KEY) || '{}');
      if (lastClient.name) {
        clientNameEl.value = lastClient.name;
        clientAddressEl.value = lastClient.address || '';
      }
    } catch (e) {
      console.warn('Failed to load last client', e);
    }

    itemRowsEl.innerHTML = '';
    addRow();
    renderQR(qrContainer, buildQRText());
    syncClientDisplay();
    syncPrintDisplayValues();
  })();

  // Update due date when invoice date changes on unsaved/new invoices
  invoiceDateEl.addEventListener('change', () => {
    if (invoiceDateEl.value) {
      if (!activeParams?.no) {
        const base = parseISO(invoiceDateEl.value);
        dueDateEl.value = formatISO(addWorkingDays(base, 15));
      }
      debouncedRenderQR();
    }
    syncPrintDisplayValues();
  });

  dueDateEl.addEventListener('change', () => {
    syncPrintDisplayValues();
  });

  if (paymentMethodEl) {
    paymentMethodEl.addEventListener('change', () => {
      syncPrintDisplayValues();
    });
  }

  if (linkedChallanEl) {
    linkedChallanEl.addEventListener('input', () => {
      syncPrintDisplayValues();
    });
  }
  if (poRefEl) {
    poRefEl.addEventListener('input', () => {
      syncPrintDisplayValues();
    });
  }

  clientNameEl.addEventListener('input', () => {
    syncClientDisplay();
    debouncedRenderQR();
  });

  if (clientAddressEl) {
    clientAddressEl.addEventListener('input', () => {
      syncClientDisplay();
    });
  }

  addRowBtn.addEventListener('click', () => addRow());

  // Link Doc Title input to header display and print
  if (docTitleInput && docTitleHeader) {
    docTitleHeader.textContent = docTitleInput.value.trim();
    docTitleInput.addEventListener('input', () => {
      docTitleHeader.textContent = docTitleInput.value.trim();
      syncPrintDisplayValues();
      debouncedRenderQR();
    });
  }

  // Auto-save every 5s with draft isolation (only after user edits)
  setInterval(() => {
    if (!isDirty) return;
    const record = buildInvoiceRecord();
    localStorage.setItem(getDraftKey(), JSON.stringify(record));
  }, 5000);

  // Actions
  saveBtn.addEventListener('click', () => {
    const record = buildInvoiceRecord();
    const validMsg = validateRecord(record);
    if (validMsg) { showToast(validMsg, 'warning'); return; }
    saveInvoice(record);
    localStorage.setItem(LAST_CLIENT_KEY, JSON.stringify(record.client));
    finalizeInvoiceNumber(record.invoiceNumber, record.billerId);
    if (activeParams && activeParams.qtn && typeof getQuotationByNumber === 'function' && typeof saveQuotation === 'function') {
      const qtn = getQuotationByNumber(activeParams.qtn);
      if (qtn) {
        qtn.converted = true;
        qtn.convertedToInvoice = record.invoiceNumber;
        qtn.convertedAt = new Date().toISOString();
        saveQuotation(qtn);
      }
    }
    activeParams = { no: record.invoiceNumber };
    if (typeof history !== 'undefined' && history.replaceState) {
      try { history.replaceState(null, '', `?no=${encodeURIComponent(record.invoiceNumber)}`); } catch (_) { }
    }
    isDirty = false;
    clearDraft();
    updateModeBadge(true, record.invoiceNumber);
    renderPaymentStatusBanner(record);
    if (clientOnboarding) clientOnboarding.refresh(record.client?.name);
    if (typeof saveItem === 'function' && Array.isArray(record.items)) {
      record.items.forEach(it => {
        if (it.name) saveItem({ name: it.name, desc: it.desc, unitPrice: it.unitPrice, unit: it.unit || 'Pcs' });
      });
      if (itemCatalog) itemCatalog.refresh();
    }
    if (record.linkedChallan && typeof getChallanByNumber === 'function' && typeof saveChallan === 'function') {
      const ch = getChallanByNumber(record.linkedChallan);
      if (ch && !ch.linkedInvoice) {
        ch.linkedInvoice = record.invoiceNumber;
        saveChallan(ch);
      }
    }
    showToast('Invoice saved successfully.', 'success');
  });

  if (duplicateInvoiceBtn) {
    duplicateInvoiceBtn.addEventListener('click', () => {
      const nextNo = peekNextInvoiceNumber();
      invoiceNumberEl.value = nextNo;
      const today = new Date();
      const todayIso = formatISO(today);
      invoiceDateEl.value = todayIso;
      dueDateEl.value = formatISO(addWorkingDays(today, 15));
      isDirty = true;
      activeParams = {}; // switch to fresh draft scope
      sourceBillerId = null;
      clearDraft();
      updateModeBadge(false);
      if (paymentStatusBannerEl) paymentStatusBannerEl.classList.add('d-none');
      updateReceiptBreakdown(null);
      updateGrandTotal();
      syncPrintDisplayValues();
      renderQR(qrContainer, buildQRText());
      showToast(`Duplicated as new invoice ${nextNo}. Click Save when ready.`, 'info');
    });
  }

  // Global Ctrl+S shortcut to save
  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      saveBtn.click();
    }
  });

  const createReceiptBtn = document.getElementById('createReceiptBtn');
  if (createReceiptBtn) {
    createReceiptBtn.addEventListener('click', () => {
      const invNo = (invoiceNumberEl.value || '').trim();
      if (!invNo) {
        showToast('Please save or specify an invoice number first.', 'warning');
        return;
      }
      window.location.href = `receipt.html?inv=${encodeURIComponent(invNo)}`;
    });
  }

  const createChallanBtn = document.getElementById('createChallanBtn');
  if (createChallanBtn) {
    createChallanBtn.addEventListener('click', () => {
      const record = buildInvoiceRecord();
      const validMsg = validateRecord(record);
      if (validMsg) { showToast(`Cannot create challan: ${validMsg}`, 'warning'); return; }
      saveInvoice(record);
      finalizeInvoiceNumber(record.invoiceNumber, record.billerId);
      activeParams = { no: record.invoiceNumber };
      clearDraft();
      isDirty = false;
      updateModeBadge(true, record.invoiceNumber);
      renderPaymentStatusBanner(record);
      window.open(`challan.html?inv=${encodeURIComponent(record.invoiceNumber)}`, '_blank');
    });
  }

  if (discountInputEl) {
    discountInputEl.addEventListener('input', () => {
      updateGrandTotal();
      debouncedRenderQR();
    });
  }
  if (discountModeEl) {
    discountModeEl.addEventListener('change', () => {
      updateGrandTotal();
      debouncedRenderQR();
    });
  }
  if (vatRateInputEl) {
    vatRateInputEl.addEventListener('input', () => {
      updateGrandTotal();
      debouncedRenderQR();
    });
  }
  if (vatModeEl) {
    vatModeEl.addEventListener('change', () => {
      updateGrandTotal();
      debouncedRenderQR();
    });
  }
  printBtn.addEventListener('click', () => {
    prepareForPrint();
    window.print();
  });
  if (typeof initPdfDownloadButton === 'function') {
    initPdfDownloadButton('downloadPdfBtn', prepareForPrint, () => {
      if (typeof setPrintDocumentTitle === 'function') {
        return setPrintDocumentTitle(invoiceNumberEl?.value || 'Invoice', clientNameEl?.value || '');
      }
      return invoiceNumberEl?.value || 'Invoice';
    });
  }
  if (typeof runAutoPrintIfRequested === 'function') {
    runAutoPrintIfRequested(prepareForPrint);
  }

  const shareWhatsAppBtn = document.getElementById('shareWhatsAppBtn');
  const shareEmailBtn = document.getElementById('shareEmailBtn');

  function getShareData() {
    const record = buildInvoiceRecord();
    const stats = typeof getInvoicePaymentStats === 'function' ? getInvoicePaymentStats(record) : null;
    const regClient = (typeof loadClients === 'function' ? loadClients() : [])
      .find(c => (c.name || '').trim().toLowerCase() === (record.client?.name || '').trim().toLowerCase());
    return {
      number: record.invoiceNumber,
      date: record.date,
      dueDate: record.dueDate,
      clientName: record.client?.name || 'Customer',
      clientPhone: record.client?.phone || regClient?.phone || '',
      clientEmail: record.client?.email || regClient?.email || '',
      total: record.grandTotal,
      due: (stats && stats.status !== 'Unknown') ? stats.due : record.grandTotal,
      billerName: typeof getActiveBiller === 'function' ? getActiveBiller()?.name : ''
    };
  }

  if (shareWhatsAppBtn) {
    shareWhatsAppBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (typeof shareDocumentWhatsApp === 'function') {
        shareDocumentWhatsApp('invoice', getShareData());
      }
    });
  }

  if (shareEmailBtn) {
    shareEmailBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (typeof shareDocumentEmail === 'function') {
        shareDocumentEmail('invoice', getShareData());
      }
    });
  }
  resetBtn.addEventListener('click', () => {
    if (confirm('Clear all fields?')) {
      const csEl = document.getElementById('clientSelect');
      if (csEl) csEl.value = '';
      if (clientNameEl) clientNameEl.value = '';
      if (clientAddressEl) clientAddressEl.value = '';
      if (paymentMethodEl) paymentMethodEl.value = 'Cash';
      if (linkedChallanEl) linkedChallanEl.value = '';
      if (poRefEl) poRefEl.value = '';
      if (docTitleInput) docTitleInput.value = '';
      if (docTitleHeader) docTitleHeader.textContent = '';
      if (discountModeEl) discountModeEl.value = 'bdt';
      if (discountInputEl) discountInputEl.value = '0';
      if (vatModeEl) vatModeEl.value = 'excl';
      if (vatRateInputEl) vatRateInputEl.value = '0';
      const today = new Date();
      if (invoiceDateEl) invoiceDateEl.value = formatISO(today);
      if (dueDateEl) dueDateEl.value = formatISO(addWorkingDays(today, 15));
      itemRowsEl.innerHTML = '';
      addRow();
      updateGrandTotal();
      isDirty = false;
      activeParams = {};
      if (typeof history !== 'undefined' && window.location.search) {
        try { history.replaceState(null, '', window.location.pathname); } catch (_) { }
      }
      if (invoiceNumberEl) invoiceNumberEl.value = peekNextInvoiceNumber();
      renderQR(qrContainer, buildQRText());
      clearDraft();
      updateModeBadge(false);
      updateReceiptBreakdown(null);
      if (paymentStatusBannerEl) paymentStatusBannerEl.classList.add('d-none');
      if (typeof syncClientDisplay === 'function') syncClientDisplay();
      if (typeof syncPrintDisplayValues === 'function') syncPrintDisplayValues();
    }
  });
  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
      const record = buildInvoiceRecord();
      const titleSlug = slugify(record.title || '');
      const fname = `invoice_${record.invoiceNumber}${titleSlug ? '_' + titleSlug : ''}.json`;
      downloadJSON(fname, record);
      showToast('JSON downloaded. Move it to records/invoices and update index.json to preload in Search.', 'info');
    });
  }

  // Helpers
  function syncRowPrintMirrors(tr) {
    if (!tr) return;
    const nameVal = tr.querySelector('.item-name-input')?.value || '';
    const descVal = tr.querySelector('.item-desc-input')?.value || '';
    const qtyVal = tr.querySelector('.qty')?.value || '0';
    const unitVal = tr.querySelector('.unit')?.value || 'Pcs';
    const priceNum = parseFloat(String(tr.querySelector('.price')?.value || '0').replace(/[^0-9.]/g, '')) || 0;
    const nMir = tr.querySelector('.item-print-name');
    const dMir = tr.querySelector('.item-print-desc');
    const qMir = tr.querySelector('.item-print-qty');
    const uMir = tr.querySelector('.item-print-unit');
    const pMir = tr.querySelector('.item-print-price');
    if (nMir) nMir.textContent = nameVal;
    if (dMir) dMir.textContent = descVal;
    if (qMir) qMir.textContent = String(qtyVal);
    if (uMir) uMir.textContent = unitVal;
    if (pMir) pMir.textContent = formatBDT(priceNum);
  }

  function addRowFromData(row) {
    const tr = document.createElement('tr');
    const unitVal = row.unit || 'Pcs';
    const rowNum = itemRowsEl.children.length + 1;
    const qtyNum = row.qty || 0;
    const priceNum = row.unitPrice || 0;
    tr.innerHTML = `
      <td>
        <textarea class="form-control auto-grow no-print item-name-input" rows="1" placeholder="Item name" aria-label="Item name, row ${rowNum}">${escapeHTML(row.name || '')}</textarea>
        <div class="print-only item-print-name">${escapeHTML(row.name || '')}</div>
      </td>
      <td>
        <textarea class="form-control auto-grow no-print item-desc-input" rows="1" placeholder="Description" aria-label="Description, row ${rowNum}">${escapeHTML(row.desc || '')}</textarea>
        <div class="print-only item-print-desc">${escapeHTML(row.desc || '')}</div>
      </td>
      <td class="text-center">
        <input type="text" inputmode="decimal" class="form-control form-control-sm text-center qty no-print" aria-label="Quantity, row ${rowNum}" value="${escapeAttr(qtyNum)}" />
        <span class="print-only item-print-qty">${escapeHTML(String(qtyNum))}</span>
      </td>
      <td class="text-center">
        <input type="text" class="form-control form-control-sm text-center unit no-print" list="quickUnitOptions" aria-label="Unit, row ${rowNum}" value="${escapeAttr(unitVal)}" />
        <span class="print-only item-print-unit">${escapeHTML(unitVal)}</span>
      </td>
      <td class="text-end">
        <input type="text" inputmode="decimal" class="form-control form-control-sm text-end price no-print" aria-label="Unit price, row ${rowNum}" value="${escapeAttr(priceNum)}" />
        <span class="print-only item-print-price">${formatBDT(priceNum)}</span>
      </td>
      <td class="text-end total">${formatBDT(roundBDT(qtyNum * priceNum))}</td>
      <td class="action-col no-print"><button class="btn btn-sm btn-outline-danger" aria-label="Delete item, row ${rowNum}">Delete</button></td>
    `;
    attachRowEvents(tr);
    itemRowsEl.appendChild(tr);
    adjustColumnWidths();
  }

  function addRow() {
    addRowFromData({ qty: 0, unit: 'Pcs', unitPrice: 0 });
    updateGrandTotal();
    debouncedRenderQR();
  }

  function attachRowEvents(tr) {
    const qtyEl = tr.querySelector('.qty');
    const unitEl = tr.querySelector('.unit');
    const priceEl = tr.querySelector('.price');
    const delBtn = tr.querySelector('button');
    const totalCell = tr.querySelector('.total');
    // Auto-resize multi-line fields
    tr.querySelectorAll('.auto-grow').forEach(el => {
      const resize = () => { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; };
      resize();
      el.addEventListener('input', resize);
    });
    const recalc = () => {
      const qty = parseFloat((qtyEl.value || '0').replace(/[^0-9.]/g, '')) || 0;
      const price = parseFloat((priceEl.value || '0').replace(/[^0-9.]/g, '')) || 0;
      const total = roundBDT(qty * price);
      totalCell.textContent = formatBDT(total);
      syncRowPrintMirrors(tr);
      updateGrandTotal();
      debouncedRenderQR();
    };
    qtyEl.addEventListener('input', recalc);
    priceEl.addEventListener('input', recalc);
    if (unitEl) unitEl.addEventListener('input', () => syncRowPrintMirrors(tr));
    tr.querySelectorAll('textarea').forEach(el => el.addEventListener('input', () => {
      syncRowPrintMirrors(tr);
      adjustColumnWidths();
    }));
    const nameTextarea = tr.querySelector('.item-name-input');
    if (nameTextarea) {
      nameTextarea.addEventListener('change', () => {
        const val = nameTextarea.value.trim().toLowerCase();
        if (!val || typeof loadItems !== 'function') return;
        const matched = loadItems().find(it => (it.name || '').toLowerCase() === val);
        if (matched) {
          const descEl = tr.querySelector('.item-desc-input');
          if (descEl && (!descEl.value || descEl.value.trim() === '')) {
            descEl.value = matched.desc || '';
            descEl.style.height = 'auto';
            descEl.style.height = descEl.scrollHeight + 'px';
          }
          if (unitEl && matched.unit) unitEl.value = matched.unit;
          if (priceEl && (!priceEl.value || priceEl.value === '0')) {
            priceEl.value = String(matched.unitPrice || 0);
          }
          recalc();
        }
      });
    }

    delBtn.addEventListener('click', () => {
      const name = tr.querySelector('.item-name-input')?.value.trim() || '';
      const desc = tr.querySelector('.item-desc-input')?.value.trim() || '';
      const qty = parseFloat((qtyEl.value || '0').replace(/[^0-9.]/g, '')) || 0;
      const price = parseFloat((priceEl.value || '0').replace(/[^0-9.]/g, '')) || 0;
      if (name || desc || qty > 0 || price > 0) {
        if (!confirm('Are you sure you want to remove this item row?')) return;
      }
      tr.remove();
      isDirty = true;
      updateGrandTotal();
      debouncedRenderQR();
      adjustColumnWidths();
    });

    // Keyboard ergonomics: pressing Enter in the last row's price field appends a new row
    priceEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const rows = itemRowsEl.querySelectorAll('tr');
        if (rows[rows.length - 1] === tr) {
          e.preventDefault();
          addRow();
          const newRows = itemRowsEl.querySelectorAll('tr');
          const lastRow = newRows[newRows.length - 1];
          lastRow.querySelector('textarea')?.focus();
        }
      }
    });
  }

  function getInvoiceTotalsBreakdown() {
    let subtotal = 0;
    itemRowsEl.querySelectorAll('tr').forEach(tr => {
      const qty = parseFloat(String(tr.querySelector('.qty')?.value || '0').replace(/[^0-9.]/g, '')) || 0;
      const price = parseFloat(String(tr.querySelector('.price')?.value || '0').replace(/[^0-9.]/g, '')) || 0;
      subtotal = roundBDT(subtotal + roundBDT(qty * price));
    });
    const discountMode = discountModeEl ? discountModeEl.value : 'bdt';
    const discountValue = discountInputEl ? roundBDT(Math.max(0, parseFloat(String(discountInputEl.value || '0').replace(/[^0-9.]/g, '')) || 0)) : 0;
    let discount = discountValue;
    if (discountMode === 'percent') {
      discount = roundBDT(subtotal * (Math.min(discountValue, 100) / 100));
    }
    discount = Math.min(discount, subtotal);
    const vatRate = vatRateInputEl ? roundBDT(Math.max(0, parseFloat(String(vatRateInputEl.value || '0').replace(/[^0-9.]/g, '')) || 0)) : 0;
    const vatInclusive = vatModeEl ? vatModeEl.value === 'incl' : false;
    const afterDiscount = roundBDT(Math.max(0, subtotal - discount));
    let taxable = afterDiscount;
    let vatAmount = 0;
    let grandTotal = afterDiscount;
    if (vatRate > 0) {
      if (vatInclusive) {
        taxable = roundBDT(afterDiscount / (1 + vatRate / 100));
        vatAmount = roundBDT(afterDiscount - taxable);
        grandTotal = afterDiscount;
      } else {
        vatAmount = roundBDT(taxable * (vatRate / 100));
        grandTotal = roundBDT(taxable + vatAmount);
      }
    }
    return { subtotal, discountMode, discountValue, discount, vatRate, vatInclusive, taxable, vatAmount, grandTotal };
  }

  function updateGrandTotal() {
    const totals = getInvoiceTotalsBreakdown();
    grandTotalEl.textContent = formatBDT(totals.grandTotal);
    const subtotalEl = document.getElementById('subtotalDisplay');
    if (subtotalEl) subtotalEl.textContent = formatBDT(totals.subtotal);
    if (headerTotalEl) headerTotalEl.textContent = `Total: ${formatBDT(totals.grandTotal)}`;
    if (amountWordsEl) amountWordsEl.textContent = numberToWordsBDT(totals.grandTotal);
    if (typeof syncPrintDisplayValues === 'function') syncPrintDisplayValues();
  }

  function _resolveInvoiceBiller() {
    const existingInv = invoiceNumberEl.value ? getInvoiceByNumber(invoiceNumberEl.value) : null;
    const bId = existingInv?.billerId || sourceBillerId || (typeof getActiveBillerId === 'function' ? getActiveBillerId() : 'biller_default');
    const biller = (typeof getBillerById === 'function' && bId ? getBillerById(bId) : null)
      || existingInv?.company
      || (typeof getActiveBiller === 'function' ? getActiveBiller() : (typeof COMPANY !== 'undefined' ? COMPANY : {}));
    return { existingInv, bId, biller };
  }

  function buildQRText() {
    const num = invoiceNumberEl.value;
    const totalNum = getGrandTotalNumber();
    const client = clientNameEl.value || '';
    const { biller } = _resolveInvoiceBiller();
    return buildQRPayload('INV', {
      number: num,
      date: invoiceDateEl.value,
      amount: totalNum,
      client,
      company: biller.name || (typeof COMPANY !== 'undefined' ? COMPANY.name : '')
    });
  }

  renderQR(qrContainer, buildQRText());
  adjustColumnWidths();

  function buildInvoiceRecord() {
    const items = [];
    itemRowsEl.querySelectorAll('tr').forEach(tr => {
      items.push({
        name: (tr.querySelector('.item-name-input')?.value || '').trim(),
        desc: (tr.querySelector('.item-desc-input')?.value || '').trim(),
        qty: parseFloat(String(tr.querySelector('.qty')?.value || '0').replace(/[^0-9.]/g, '')) || 0,
        unit: (tr.querySelector('.unit')?.value || 'Pcs').trim() || 'Pcs',
        unitPrice: parseFloat(String(tr.querySelector('.price')?.value || '0').replace(/[^0-9.]/g, '')) || 0,
      });
    });
    const totals = getInvoiceTotalsBreakdown();
    const totalAmount = totals.grandTotal;
    const { existingInv, bId, biller } = _resolveInvoiceBiller();
    const companySnap = typeof slimCompanySnapshot === 'function' ? slimCompanySnapshot(biller) : biller;
    return {
      id: existingInv?.id,
      createdAt: existingInv?.createdAt,
      status: existingInv?.status,
      _type: 'invoice',
      billerId: bId,
      invoiceNumber: invoiceNumberEl.value,
      date: invoiceDateEl.value,
      title: docTitleInput ? docTitleInput.value.trim() : '',
      paymentMethod: paymentMethodEl ? paymentMethodEl.value : '',
      dueDate: dueDateEl ? dueDateEl.value : '',
      poRef: poRefEl ? poRefEl.value.trim() : '',
      client: { name: clientNameEl.value.trim(), address: clientAddressEl.value.trim() },
      linkedChallan: linkedChallanEl ? linkedChallanEl.value.trim() : '',
      items,
      subtotal: totals.subtotal,
      discountMode: totals.discountMode,
      discountValue: totals.discountValue,
      discount: totals.discount,
      vatRate: totals.vatRate,
      vatInclusive: totals.vatInclusive,
      vatAmount: totals.vatAmount,
      grandTotal: totalAmount,
      amountInWords: numberToWordsBDT(totalAmount),
      qrData: buildQRText(),
      company: companySnap
    };
  }

  function validateRecord(rec) {
    if (!rec.client?.name) return 'Bill To (client name) is required.';
    if (!rec.items?.length) return 'Add at least one item.';
    const hasQty = rec.items.some(it => Number(it.qty) > 0);
    if (!hasQty) return 'Item quantity must be greater than 0.';
    return '';
  }

  function getGrandTotalNumber() {
    return getInvoiceTotalsBreakdown().grandTotal;
  }

  // Dynamically adjust column widths based on content lengths
  function adjustColumnWidths() {
    try {
      const table = document.getElementById('itemsTable');
      if (!table) return;
      let itemLen = 0, descLen = 0, itemCount = 0, descCount = 0;
      table.querySelectorAll('tbody tr').forEach(tr => {
        const itemVal = (tr.children[0].querySelector('textarea')?.value || '').length;
        const descVal = (tr.children[1].querySelector('textarea')?.value || '').length;
        itemLen += itemVal; descLen += descVal; itemCount++; descCount++;
      });
      const avgItem = itemCount ? itemLen / itemCount : 0;
      const avgDesc = descCount ? descLen / descCount : 0;
      const free = 54;
      const minItem = 18, minDesc = 18;
      let wItem = free / 2, wDesc = free / 2;
      if (avgItem + avgDesc > 0) {
        const sItem = avgItem / (avgItem + avgDesc);
        const targetItem = Math.max(minItem, Math.min(free - minDesc, free * sItem));
        const targetDesc = free - targetItem;
        wItem = targetItem;
        wDesc = targetDesc;
      } else {
        wItem = Math.max(minItem, wItem);
        wDesc = Math.max(minDesc, free - wItem);
      }
      const tbl = document.querySelector('.invoice-table');
      if (tbl) {
        tbl.style.setProperty('--w-item', wItem + '%');
        tbl.style.setProperty('--w-desc', wDesc + '%');
        tbl.style.setProperty('--w-qty', '8%');
        tbl.style.setProperty('--w-uom', '9%');
        tbl.style.setProperty('--w-unit', '14%');
        tbl.style.setProperty('--w-total', '15%');
      }
    } catch (e) {
      console.warn('adjustColumnWidths failed', e);
    }
  }

  // Ensure textareas and print mirrors are synchronized before print
  function prepareForPrint() {
    itemRowsEl.querySelectorAll('tr').forEach(syncRowPrintMirrors);
    renderQR(qrContainer, buildQRText());
    if (typeof syncClientDisplay === 'function') syncClientDisplay();
    if (typeof syncPrintDisplayValues === 'function') syncPrintDisplayValues();
    if (typeof setPrintDocumentTitle === 'function') {
      setPrintDocumentTitle(invoiceNumberEl?.value || 'Invoice', clientNameEl?.value || '');
    }
    document.querySelectorAll('textarea').forEach(el => {
      el.style.height = 'auto';
      el.style.height = el.scrollHeight + 'px';
    });
    adjustColumnWidths();
  }
  window.addEventListener('beforeprint', prepareForPrint);

  // Date helpers delegating to shared js/utils.js local date functions
  function parseISO(iso) { return parseLocalISODate(iso) || new Date(); }
  function formatISO(date) { return toLocalISODate(date); }
  function addWorkingDays(startDate, days) { return addWorkingDaysLocal(startDate, days); }

  window.addEventListener('billerchange', () => {
    if (typeof setCompanyHeader === 'function') {
      setCompanyHeader();
    }
    const params = new URLSearchParams(window.location.search);
    const isEditing = params.get('no') || params.get('id') || params.get('load') || activeParams?.no;
    if (!isEditing && invoiceNumberEl) {
      invoiceNumberEl.value = peekNextInvoiceNumber();
    }
    renderQR(qrContainer, buildQRText());
    syncPrintDisplayValues();
  });
});
