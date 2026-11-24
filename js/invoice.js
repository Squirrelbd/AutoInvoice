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
  const downloadBlankBtn = document.getElementById('downloadBlankInvoiceBtn');
  const saveAndNextBlankBtn = document.getElementById('saveAndNextBlankBtn');
  const completePaymentCardEl = document.getElementById('completePaymentCard');
  const recordPaymentOnSaveEl = document.getElementById('recordPaymentOnSave');
  const completePaymentFieldsEl = document.getElementById('completePaymentFields');
  const quickPayAmountEl = document.getElementById('quickPayAmount');
  const quickPayMethodEl = document.getElementById('quickPayMethod');
  const quickPayRefEl = document.getElementById('quickPayRef');
  const quickPayTargetHintEl = document.getElementById('quickPayTargetHint');
  const exportBtn = document.getElementById('exportInvoiceBtn');
  const printBtn = document.getElementById('printBtn');
  const resetBtn = document.getElementById('resetBtn');
  const duplicateInvoiceBtn = document.getElementById('duplicateInvoiceBtn');
  const linkedChallanEl = document.getElementById('linkedChallan');
  const qrContainer = document.getElementById('qrContainer');
  const paymentStatusBannerEl = document.getElementById('paymentStatusBanner');
  const blankModeToggle = document.getElementById('blankInvoiceMode');
  const blankClientLinesEl = document.getElementById('blankClientLines');
  const clientDisplayBlockEl = document.getElementById('clientDisplayBlock');
  const blankReceivedRowEl = document.getElementById('blankReceivedRow');
  const blankDueRowEl = document.getElementById('blankDueRow');
  const invoiceDocFooterEl = document.getElementById('invoiceDocFooter');
  const LAST_CLIENT_KEY = 'ai_last_client_invoice';
  let activeParams = parseQuery();
  let sourceBillerId = null;

  function isBlankInvoiceMode() {
    return !!(blankModeToggle && blankModeToggle.checked);
  }

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

  function resetQuickPaymentPanel() {
    if (recordPaymentOnSaveEl) recordPaymentOnSaveEl.checked = false;
    if (completePaymentFieldsEl) completePaymentFieldsEl.classList.add('d-none');
    if (quickPayAmountEl) quickPayAmountEl.value = '';
    if (quickPayMethodEl) quickPayMethodEl.value = 'Cash';
    if (quickPayRefEl) quickPayRefEl.value = '';
    if (quickPayTargetHintEl) quickPayTargetHintEl.textContent = '';
    if (completePaymentCardEl) completePaymentCardEl.classList.add('d-none');
  }

  function syncCompletePaymentPanel(inv) {
    if (!completePaymentCardEl) return;
    const targetInv = inv || (invoiceNumberEl?.value ? getInvoiceByNumber(invoiceNumberEl.value) : null);
    const isPendingRec = !!(targetInv && targetInv.status !== 'Void' && (targetInv.status === 'Pending' || targetInv.amountPending));
    if (!isPendingRec) {
      resetQuickPaymentPanel();
      return;
    }
    completePaymentCardEl.classList.remove('d-none');
    const bId = targetInv.billerId || sourceBillerId || (typeof getActiveBillerId === 'function' ? getActiveBillerId() : 'biller_default');
    const pendingRc = typeof getReceiptsByInvoiceNumber === 'function'
      ? getReceiptsByInvoiceNumber(targetInv.invoiceNumber || targetInv.number, { includePending: true }).find(r => r.status === 'Pending' || r.amountPending)
      : null;
    if (quickPayTargetHintEl) {
      if (pendingRc) {
        quickPayTargetHintEl.textContent = `Will complete linked pending receipt ${pendingRc.receiptNumber}`;
      } else if (typeof peekNextReceiptNumber === 'function') {
        quickPayTargetHintEl.textContent = `Will issue new receipt ${peekNextReceiptNumber(bId)}`;
      } else {
        quickPayTargetHintEl.textContent = '';
      }
    }
  }

  if (recordPaymentOnSaveEl) {
    recordPaymentOnSaveEl.addEventListener('change', () => {
      const checked = !!recordPaymentOnSaveEl.checked;
      if (completePaymentFieldsEl) completePaymentFieldsEl.classList.toggle('d-none', !checked);
      if (checked) {
        if (quickPayMethodEl && paymentMethodEl && paymentMethodEl.value) {
          quickPayMethodEl.value = paymentMethodEl.value;
        }
        const gt = getGrandTotalNumber();
        if (quickPayAmountEl && !quickPayAmountEl.value.trim() && gt > 0) {
          quickPayAmountEl.value = gt.toFixed(2);
        }
      }
    });
  }

  function renderPaymentStatusBanner(inv) {
    if (!paymentStatusBannerEl) return;
    const stats = getInvoicePaymentStats(inv);
    syncCompletePaymentPanel(inv);
    if (stats.status === 'Pending') {
      paymentStatusBannerEl.className = 'alert alert-info p-3 mb-3 no-print shadow-sm';
      paymentStatusBannerEl.innerHTML = `
        <div class="d-flex flex-wrap align-items-center justify-content-between gap-2">
          <div>
            <span class="badge bg-info text-dark fs-6 me-2">⏳ Pending Amount (Blank / Fill-Later)</span>
            <span class="small">This unique invoice number is locked. Fill in item quantities/prices (and client info if blank) and click <strong>Complete &amp; Save Invoice</strong> to finalize, then record the received amount.</span>
          </div>
        </div>
      `;
      paymentStatusBannerEl.classList.remove('d-none');
      updateReceiptBreakdown(null);
      return;
    }
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
    const hasSettledRcpts = !!(stats.receipts && stats.receipts.length);
    const hasPendingRcpts = !!(stats.pendingReceipts && stats.pendingReceipts.length);
    if (hasSettledRcpts || hasPendingRcpts) {
      const settledHtml = (stats.receipts || []).map(r => `
        <a href="receipt.html?rcpt=${encodeURIComponent(r.receiptNumber)}" class="badge bg-primary-subtle text-primary border text-decoration-none p-1 me-1">
          🧾 ${escapeHTML(r.receiptNumber)} (${formatBDT(r.amount)})
        </a>
      `).join('');
      const pendingHtml = (stats.pendingReceipts || []).map(r => `
        <a href="receipt.html?rcpt=${encodeURIComponent(r.receiptNumber)}" class="badge bg-info-subtle text-info-emphasis border text-decoration-none p-1 me-1">
          ⏳ ${escapeHTML(r.receiptNumber)} (Pending)
        </a>
      `).join('');
      rcptLinks = settledHtml + pendingHtml;
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
            const cQty = roundBDT((c.items || []).reduce((s, it) => roundBDT(s + (parseFloat(String(it.qty || 0).replace(/,/g, '')) || 0)), 0));
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
    const isBlank = isBlankInvoiceMode();
    const useBlankLines = isBlank && !name;
    if (clientDisplayBlockEl) clientDisplayBlockEl.classList.toggle('d-none', useBlankLines);
    if (blankClientLinesEl) blankClientLinesEl.classList.toggle('d-none', !useBlankLines);

    const nameDisp = document.getElementById('clientNameDisplay');
    const contactDisp = document.getElementById('clientContactDisplay');
    const addrDisp = document.getElementById('clientAddressDisplay');
    const commsDisp = document.getElementById('clientCommsDisplay');
    const binDisp = document.getElementById('clientBinDisplay');

    if (!name) {
      if (nameDisp) nameDisp.textContent = '—';
      if (contactDisp) contactDisp.textContent = '';
      if (addrDisp) addrDisp.textContent = isBlank ? '' : 'No client address specified';
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

    const isBlank = isBlankInvoiceMode();
    if (printAreaEl) printAreaEl.classList.toggle('blank-doc-mode', isBlank);

    if (invNumPrint && invoiceNumberEl) invNumPrint.textContent = invoiceNumberEl.value || '—';
    if (invDatePrint && invoiceDateEl) {
      if (isBlank && !invoiceDateEl.value) invDatePrint.innerHTML = '<span class="blank-amt-line"></span>';
      else invDatePrint.textContent = typeof formatDisplayDate === 'function' ? formatDisplayDate(invoiceDateEl.value) : invoiceDateEl.value;
    }
    if (dueDatePrint && dueDateEl) {
      if (isBlank && !dueDateEl.value) dueDatePrint.innerHTML = '<span class="blank-amt-line"></span>';
      else dueDatePrint.textContent = typeof formatDisplayDate === 'function' ? formatDisplayDate(dueDateEl.value) : dueDateEl.value;
    }
    if (payMethodPrint && paymentMethodEl) {
      if (isBlank && !paymentMethodEl.value) payMethodPrint.innerHTML = '<span class="blank-amt-line"></span>';
      else payMethodPrint.textContent = paymentMethodEl.value || 'Cash';
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
    const blankTotals = isBlank && totals.grandTotal === 0;
    if (subtotalEl) {
      if (isBlank && totals.subtotal === 0) subtotalEl.innerHTML = '৳ <span class="blank-amt-line" style="min-width:85px;" aria-hidden="true"></span>';
      else subtotalEl.textContent = formatBDT(totals.subtotal);
    }
    if (grandTotalEl) {
      if (blankTotals) grandTotalEl.innerHTML = '৳ <span class="blank-amt-line" style="min-width:95px;" aria-hidden="true"></span>';
      else grandTotalEl.textContent = formatBDT(totals.grandTotal);
    }
    if (amountWordsEl) {
      if (blankTotals) amountWordsEl.innerHTML = '<span class="blank-words-line" aria-hidden="true"></span>';
      else amountWordsEl.textContent = numberToWordsBDT(totals.grandTotal);
    }
    if (blankReceivedRowEl) blankReceivedRowEl.classList.toggle('d-none', !isBlank);
    if (blankDueRowEl) blankDueRowEl.classList.toggle('d-none', !isBlank);
    if (invoiceDocFooterEl) {
      invoiceDocFooterEl.textContent = isBlank
        ? 'Blank / Provisional Commercial Invoice — Amounts and payment details to be finalized upon completion.'
        : 'This is a computer-generated commercial document issued by AutoInvoice.';
    }

    const existingInv = invoiceNumberEl.value ? getInvoiceByNumber(invoiceNumberEl.value) : null;
    const isEditingPending = !!(existingInv && (existingInv.status === 'Pending' || existingInv.amountPending));
    if (saveAndNextBlankBtn) {
      saveAndNextBlankBtn.classList.toggle('d-none', !isBlank);
    }
    if (saveBtn) {
      if (isBlank) saveBtn.textContent = '💾 Save Pending Invoice';
      else if (isEditingPending) saveBtn.textContent = '✅ Complete & Save Invoice';
      else saveBtn.textContent = '💾 Save Invoice';
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
    printAreaEl.addEventListener('change', () => { isDirty = true; });
  }
  window.addEventListener('beforeunload', (e) => {
    if (isDirty) {
      e.preventDefault();
      e.returnValue = '';
    }
  });

  const modeBadgeEl = document.getElementById('modeBadge');
  function updateModeBadge(isEditing, docNo, isPending = false) {
    if (!modeBadgeEl) return;
    if (isEditing && isPending) {
      modeBadgeEl.innerHTML = `<span class="badge bg-info text-dark fs-6 px-3 py-2 shadow-sm">⏳ Pending Invoice: ${escapeHTML(docNo)}</span>`;
    } else if (isEditing) {
      modeBadgeEl.innerHTML = `<span class="badge bg-primary fs-6 px-3 py-2 shadow-sm">📝 Editing Invoice: ${escapeHTML(docNo)}</span>`;
    } else if (isBlankInvoiceMode()) {
      modeBadgeEl.innerHTML = `<span class="badge bg-info text-dark fs-6 px-3 py-2 shadow-sm">📝 Blank / Pending Invoice</span>`;
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
        isDirty = true;
        const asBlank = isBlankInvoiceMode();
        addRowFromData({
          name: item.name || '',
          desc: item.desc || '',
          unit: item.unit || 'Pcs',
          unitPrice: asBlank ? 0 : (item.unitPrice || 0),
          qty: asBlank ? 0 : 1
        });
        updateGrandTotal();
        debouncedRenderQR();
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

  function resetInvoiceFieldsToNew(options = {}) {
    const asBlank = !!options.blank;
    if (blankModeToggle) blankModeToggle.checked = asBlank;
    const csEl = document.getElementById('clientSelect');
    if (csEl) csEl.value = '';
    if (clientNameEl) clientNameEl.value = '';
    if (clientAddressEl) clientAddressEl.value = '';
    if (paymentMethodEl) paymentMethodEl.value = asBlank ? '' : 'Cash';
    if (linkedChallanEl) linkedChallanEl.value = '';
    if (dueDateEl) dueDateEl.value = '';
    if (poRefEl) poRefEl.value = '';
    if (docTitleInput) docTitleInput.value = '';
    if (docTitleHeader) docTitleHeader.textContent = '';
    if (discountModeEl) discountModeEl.value = 'bdt';
    if (discountInputEl) discountInputEl.value = '0';
    if (vatModeEl) vatModeEl.value = 'excl';
    if (vatRateInputEl) vatRateInputEl.value = '0';
    sourceBillerId = null;
    if (typeof setCompanyHeader === 'function') setCompanyHeader();
    if (paymentStatusBannerEl) paymentStatusBannerEl.classList.add('d-none');
    resetQuickPaymentPanel();
    updateReceiptBreakdown(null);
  }

  async function loadEditorFromParams(params) {
    activeParams = Object.assign({}, params || {});
    const isBlankParam = activeParams.blank === '1' || activeParams.blank === 'true';
    resetInvoiceFieldsToNew({ blank: isBlankParam });
    if (params && params.no) {
      let inv = getInvoiceByNumber(params.no);
      if (!inv && typeof getDiskInvoiceByNumber === 'function') {
        try { inv = await getDiskInvoiceByNumber(params.no); } catch (e) {
          console.warn('Failed to load disk invoice', e);
        }
      }
      if (inv) {
        const isPendingInv = !!(inv.status === 'Pending' || inv.amountPending);
        if (blankModeToggle) blankModeToggle.checked = isPendingInv;
        invoiceNumberEl.value = inv.invoiceNumber;
        invoiceDateEl.value = inv.date || '';
        clientNameEl.value = inv.client?.name || '';
        clientAddressEl.value = inv.client?.address || '';
        if (docTitleInput) docTitleInput.value = inv.title || '';
        if (docTitleHeader) docTitleHeader.textContent = inv.title || '';
        if (linkedChallanEl) linkedChallanEl.value = inv.linkedChallan || '';
        if (poRefEl) poRefEl.value = inv.poRef || '';
        if (paymentMethodEl) paymentMethodEl.value = inv.paymentMethod != null ? inv.paymentMethod : (isPendingInv ? '' : 'Cash');
        if (dueDateEl) dueDateEl.value = inv.dueDate || '';
        if (discountModeEl) discountModeEl.value = inv.discountMode || 'bdt';
        if (discountInputEl) discountInputEl.value = String(inv.discountMode === 'percent' ? (inv.discountValue || 0) : (inv.discount || 0));
        if (vatModeEl) vatModeEl.value = inv.vatInclusive ? 'incl' : 'excl';
        if (vatRateInputEl) vatRateInputEl.value = String(inv.vatRate || 0);
        itemRowsEl.innerHTML = '';
        if (Array.isArray(inv.items) && inv.items.length) {
          inv.items.forEach(addRowFromData);
        } else {
          addRow();
        }
        updateGrandTotal();
        renderQR(qrContainer, inv.qrData || buildQRText());
        updateModeBadge(true, inv.invoiceNumber, isPendingInv);
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
              const dPending = !!(d.status === 'Pending' || d.amountPending);
              if (blankModeToggle) blankModeToggle.checked = dPending;
              clientNameEl.value = d.client?.name || clientNameEl.value;
              clientAddressEl.value = d.client?.address || clientAddressEl.value;
              if (docTitleInput && d.title) docTitleInput.value = d.title;
              if (docTitleHeader && d.title) docTitleHeader.textContent = d.title;
              if (linkedChallanEl && d.linkedChallan != null) linkedChallanEl.value = d.linkedChallan;
              if (poRefEl && d.poRef != null) poRefEl.value = d.poRef;
              if (paymentMethodEl && d.paymentMethod !== undefined) paymentMethodEl.value = d.paymentMethod;
              if (dueDateEl && d.dueDate !== undefined) dueDateEl.value = d.dueDate;
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
              updateModeBadge(true, inv.invoiceNumber, dPending);
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
              try { history.replaceState(null, '', '?new=1'); } catch (_) { }
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
    resetInvoiceFieldsToNew({ blank: isBlankParam });
    updateModeBadge(false);
    invoiceNumberEl.value = peekNextInvoiceNumber();

    const savedDraft = isBlankParam ? null : (localStorage.getItem('ai_invoice_draft_new') || localStorage.getItem('ai_invoice_draft'));
    if (savedDraft) {
      try {
        const draft = JSON.parse(savedDraft);
        if (draft && (draft.client?.name || (draft.items && draft.items.length))) {
          const restore = confirm('Unsaved invoice draft found. Would you like to restore it?');
          if (restore) {
            const dPending = !!(draft.status === 'Pending' || draft.amountPending);
            if (blankModeToggle) blankModeToggle.checked = dPending;
            clientNameEl.value = draft.client?.name || '';
            clientAddressEl.value = draft.client?.address || '';
            if (docTitleInput) docTitleInput.value = draft.title || '';
            if (docTitleHeader) docTitleHeader.textContent = draft.title || '';
            if (paymentMethodEl && draft.paymentMethod !== undefined) paymentMethodEl.value = draft.paymentMethod;
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
            dueDateEl.value = draft.dueDate !== undefined ? draft.dueDate : (dPending ? '' : formatISO(addWorkingDays(todayD, 15)));
            itemRowsEl.innerHTML = '';
            (draft.items || []).forEach(addRowFromData);
            updateModeBadge(false);
            updateGrandTotal();
            renderQR(qrContainer, buildQRText());
            syncClientDisplay();
            syncPrintDisplayValues();
            isDirty = true;
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
    dueDateEl.value = isBlankParam ? '' : formatISO(addWorkingDays(today, 15));

    if (!isBlankParam) {
      try {
        const lastClient = JSON.parse(localStorage.getItem(LAST_CLIENT_KEY) || '{}');
        if (lastClient.name) {
          clientNameEl.value = lastClient.name;
          clientAddressEl.value = lastClient.address || '';
        }
      } catch (e) {
        console.warn('Failed to load last client', e);
      }
    }

    itemRowsEl.innerHTML = '';
    addRow();
    updateGrandTotal();
    renderQR(qrContainer, buildQRText());
    syncClientDisplay();
    syncPrintDisplayValues();
    isDirty = false;
  }

  // Update due date when invoice date changes on unsaved/new invoices
  invoiceDateEl.addEventListener('change', () => {
    if (invoiceDateEl.value) {
      if (!activeParams?.no && !isBlankInvoiceMode()) {
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

  addRowBtn.addEventListener('click', () => { addRow(); isDirty = true; });

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

  function _clearInvoiceAmountsForBlank() {
    itemRowsEl.querySelectorAll('tr:not(.blank-filler-row)').forEach(tr => {
      const pEl = tr.querySelector('.price');
      if (pEl) pEl.value = '0';
      const totCell = tr.querySelector('.total');
      if (totCell) totCell.textContent = '';
    });
    if (discountInputEl) discountInputEl.value = '0';
    if (vatRateInputEl) vatRateInputEl.value = '0';
  }

  if (blankModeToggle) {
    blankModeToggle.addEventListener('change', () => {
      if (blankModeToggle.checked) {
        if (getGrandTotalNumber() > 0) {
          if (!confirm('Switching to Blank / Fill-Later Mode will clear item prices, discount, and VAT so totals stay blank. Proceed?')) {
            blankModeToggle.checked = false;
            return;
          }
          _clearInvoiceAmountsForBlank();
        }
        if (paymentMethodEl && paymentMethodEl.value === 'Cash') paymentMethodEl.value = '';
        if (!activeParams?.no && dueDateEl) dueDateEl.value = '';
      } else {
        if (paymentMethodEl && !paymentMethodEl.value) paymentMethodEl.value = 'Cash';
        if (dueDateEl && !dueDateEl.value && invoiceDateEl?.value) {
          dueDateEl.value = formatISO(addWorkingDays(parseISO(invoiceDateEl.value), 15));
        }
      }
      isDirty = true;
      const existingInv = invoiceNumberEl.value ? getInvoiceByNumber(invoiceNumberEl.value) : null;
      updateModeBadge(!!activeParams?.no, invoiceNumberEl.value, !!(existingInv && (existingInv.status === 'Pending' || existingInv.amountPending)));
      itemRowsEl.querySelectorAll('tr:not(.blank-filler-row)').forEach(syncRowPrintMirrors);
      updateGrandTotal();
      syncPrintDisplayValues();
      renderQR(qrContainer, buildQRText());
    });
  }

  // Actions
  function saveInvoiceRecord(opts = {}) {
    const isPendingSave = !!(opts && opts.forcePending) || isBlankInvoiceMode();
    const collectPaymentNow = !isPendingSave && !!(recordPaymentOnSaveEl && recordPaymentOnSaveEl.checked);
    if (recordPaymentOnSaveEl && recordPaymentOnSaveEl.checked && isPendingSave) {
      showToast('Enter item quantities and prices first before completing and collecting payment.', 'warning');
      return null;
    }
    if (!isPendingSave) {
      if (paymentMethodEl && !paymentMethodEl.value) paymentMethodEl.value = 'Cash';
      if (dueDateEl && !dueDateEl.value && invoiceDateEl?.value) {
        dueDateEl.value = formatISO(addWorkingDays(parseISO(invoiceDateEl.value), 15));
      }
    }
    const record = buildInvoiceRecord({ pending: isPendingSave });
    if (!isPendingSave) {
      const validMsg = validateRecord(record);
      if (validMsg) { showToast(validMsg, 'warning'); return null; }
    }
    let payAmt = 0;
    if (collectPaymentNow) {
      const rawPay = (quickPayAmountEl?.value || '').trim();
      payAmt = rawPay ? roundBDT(parseFloat(rawPay.replace(/[^0-9.]/g, '')) || 0) : record.grandTotal;
      const priorPaid = typeof getTotalPaidForInvoice === 'function'
        ? roundBDT(getTotalPaidForInvoice(record.invoiceNumber))
        : 0;
      const remainingPayable = roundBDT(Math.max(0, record.grandTotal - priorPaid));
      if (payAmt <= 0) {
        showToast('Enter a received amount greater than ৳0.00.', 'warning');
        return null;
      }
      if (payAmt > remainingPayable) {
        showToast(`Received amount (${formatBDT(payAmt)}) exceeds remaining balance (${formatBDT(remainingPayable)}).`, 'warning');
        return null;
      }
    }
    saveInvoice(record);
    if (!isPendingSave && record.client?.name) {
      localStorage.setItem(LAST_CLIENT_KEY, JSON.stringify(record.client));
    }
    finalizeInvoiceNumber(record.invoiceNumber, record.billerId);
    if (!isPendingSave && activeParams && activeParams.qtn && typeof getQuotationByNumber === 'function' && typeof saveQuotation === 'function') {
      const qtn = getQuotationByNumber(activeParams.qtn);
      if (qtn) {
        qtn.converted = true;
        qtn.convertedToInvoice = record.invoiceNumber;
        qtn.convertedAt = new Date().toISOString();
        saveQuotation(qtn);
      }
    }
    let completedRc = null;
    if (collectPaymentNow && typeof saveReceipt === 'function') {
      const existingPendingRc = typeof getReceiptsByInvoiceNumber === 'function'
        ? getReceiptsByInvoiceNumber(record.invoiceNumber, { includePending: true }).find(r => r.status === 'Pending' || r.amountPending)
        : null;
      const rcNo = existingPendingRc?.receiptNumber || (typeof peekNextReceiptNumber === 'function' ? peekNextReceiptNumber(record.billerId) : '');
      const rcDate = formatISO(new Date());
      const payMethod = (quickPayMethodEl?.value || record.paymentMethod || 'Cash');
      const trxRef = (quickPayRefEl?.value || '').trim();
      const rcItems = (existingPendingRc?.items && existingPendingRc.items.length)
        ? existingPendingRc.items
        : (record.items || []).map(it => ({ name: it.name || '', desc: it.desc || '' })).filter(it => it.name || it.desc);
      const rcQr = typeof buildQRPayload === 'function'
        ? buildQRPayload('RCPT', {
            number: rcNo,
            date: rcDate,
            amount: payAmt,
            client: record.client?.name || '',
            company: record.company?.name || (typeof COMPANY !== 'undefined' ? COMPANY.name : '')
          })
        : '';
      completedRc = {
        id: existingPendingRc?.id,
        createdAt: existingPendingRc?.createdAt,
        status: 'Saved',
        amountPending: false,
        _type: 'receipt',
        billerId: record.billerId,
        receiptNumber: rcNo,
        date: rcDate,
        invoiceNumber: record.invoiceNumber,
        client: { name: record.client?.name || '', address: record.client?.address || '' },
        paymentMethod: payMethod,
        trxRef,
        items: rcItems,
        amount: payAmt,
        amountInWords: typeof numberToWordsBDT === 'function' ? numberToWordsBDT(payAmt) : '',
        qrData: rcQr,
        company: record.company
      };
      saveReceipt(completedRc);
      if (typeof finalizeReceiptNumber === 'function') finalizeReceiptNumber(completedRc.receiptNumber, record.billerId);
    }
    activeParams = { no: record.invoiceNumber };
    if (typeof history !== 'undefined' && history.replaceState) {
      try { history.replaceState(null, '', `?no=${encodeURIComponent(record.invoiceNumber)}`); } catch (_) { }
    }
    isDirty = false;
    clearDraft();
    updateModeBadge(true, record.invoiceNumber, isPendingSave);
    renderPaymentStatusBanner(record);
    if (clientOnboarding && record.client?.name) clientOnboarding.refresh(record.client.name);
    if (typeof saveItem === 'function' && Array.isArray(record.items)) {
      record.items.forEach(it => {
        if (!it.name) return;
        if (isPendingSave) {
          saveItem({ name: it.name, desc: it.desc, unit: it.unit || 'Pcs', unitPrice: it.unitPrice || 0 }, { preserveExisting: true });
        } else {
          saveItem({ name: it.name, desc: it.desc, unitPrice: it.unitPrice, unit: it.unit || 'Pcs' });
        }
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
    if (!opts || !opts.silent) {
      if (completedRc) {
        showToast(`Invoice ${record.invoiceNumber} finalized & Receipt ${completedRc.receiptNumber} recorded (${formatBDT(payAmt)}).`, 'success');
      } else {
        showToast(isPendingSave ? `Pending invoice ${record.invoiceNumber} saved & number locked.` : 'Invoice saved successfully.', 'success');
      }
    }
    syncPrintDisplayValues();
    return record;
  }

  saveBtn.addEventListener('click', () => saveInvoiceRecord({}));

  if (duplicateInvoiceBtn) {
    duplicateInvoiceBtn.addEventListener('click', () => {
      if (typeof setCompanyHeader === 'function') setCompanyHeader();
      const nextNo = peekNextInvoiceNumber();
      invoiceNumberEl.value = nextNo;
      const today = new Date();
      const todayIso = formatISO(today);
      invoiceDateEl.value = todayIso;
      dueDateEl.value = formatISO(addWorkingDays(today, 15));
      if (linkedChallanEl) linkedChallanEl.value = '';
      if (blankModeToggle) blankModeToggle.checked = false;
      if (paymentMethodEl && !paymentMethodEl.value) paymentMethodEl.value = 'Cash';
      isDirty = true;
      activeParams = {}; // switch to fresh draft scope
      sourceBillerId = null;
      if (typeof history !== 'undefined' && history.replaceState) {
        try { history.replaceState(null, '', '?new=1'); } catch (_) { }
      }
      clearDraft();
      updateModeBadge(false);
      if (paymentStatusBannerEl) paymentStatusBannerEl.classList.add('d-none');
      resetQuickPaymentPanel();
      updateReceiptBreakdown(null);
      itemRowsEl.querySelectorAll('tr:not(.blank-filler-row)').forEach(syncRowPrintMirrors);
      updateGrandTotal();
      syncPrintDisplayValues();
      renderQR(qrContainer, buildQRText());
      showToast(`Duplicated as new invoice ${nextNo}. Click Save when ready.`, 'info');
    });
  }

  initSaveShortcut(saveBtn);

  const createReceiptBtn = document.getElementById('createReceiptBtn');
  if (createReceiptBtn) {
    createReceiptBtn.addEventListener('click', () => {
      const invNo = (invoiceNumberEl.value || '').trim();
      if (!invNo) {
        showToast('Please save or specify an invoice number first.', 'warning');
        return;
      }
      if (isBlankInvoiceMode()) {
        const saved = saveInvoiceRecord({ forcePending: true, silent: true });
        if (!saved) return;
        window.location.href = `receipt.html?inv=${encodeURIComponent(saved.invoiceNumber)}&blank=1`;
        return;
      }
      if (isDirty && !confirm('You have unsaved changes on this invoice. Continue to Receipt without saving these changes first?')) {
        return;
      }
      window.location.href = `receipt.html?inv=${encodeURIComponent(invNo)}`;
    });
  }

  const createChallanBtn = document.getElementById('createChallanBtn');
  if (createChallanBtn) {
    createChallanBtn.addEventListener('click', () => {
      const existingInv = invoiceNumberEl.value ? getInvoiceByNumber(invoiceNumberEl.value) : null;
      if (isBlankInvoiceMode() || (existingInv && (existingInv.status === 'Pending' || existingInv.amountPending))) {
        showToast('Complete and save final invoice amounts before creating a Delivery Challan.', 'warning');
        return;
      }
      const saved = saveInvoiceRecord({ silent: true });
      if (!saved) return;
      window.open(`challan.html?inv=${encodeURIComponent(saved.invoiceNumber)}`, '_blank');
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
    if (isBlankInvoiceMode()) {
      const saved = saveInvoiceRecord({ forcePending: true, silent: true });
      if (saved && typeof showToast === 'function') {
        showToast(`Reserved ${saved.invoiceNumber} as Pending Amount before printing.`, 'info');
      }
    }
    prepareForPrint();
    window.print();
  });
  if (downloadBlankBtn) {
    downloadBlankBtn.addEventListener('click', async () => {
      const existingInv = invoiceNumberEl.value ? getInvoiceByNumber(invoiceNumberEl.value) : null;
      const isFinalizedExisting = !!(existingInv && existingInv.status !== 'Pending' && !existingInv.amountPending);
      if (isFinalizedExisting) {
        if (!confirm(`Invoice ${existingInv.invoiceNumber} is already finalized. Create a NEW blank invoice with a fresh unique number instead (keeping selected client & item names)?`)) {
          return;
        }
        const { bId } = _resolveInvoiceBiller();
        activeParams = {};
        if (invoiceNumberEl) invoiceNumberEl.value = peekNextInvoiceNumber(bId);
        if (dueDateEl) dueDateEl.value = '';
        if (linkedChallanEl) linkedChallanEl.value = '';
        if (paymentStatusBannerEl) paymentStatusBannerEl.classList.add('d-none');
        updateReceiptBreakdown(null);
        _clearInvoiceAmountsForBlank();
      } else if (getGrandTotalNumber() > 0) {
        if (!confirm('This invoice currently has priced totals. Clear prices/totals and download as a Blank / Pending invoice?')) {
          return;
        }
        _clearInvoiceAmountsForBlank();
      }
      if (blankModeToggle) blankModeToggle.checked = true;
      if (paymentMethodEl && paymentMethodEl.value === 'Cash') paymentMethodEl.value = '';
      itemRowsEl.querySelectorAll('tr:not(.blank-filler-row)').forEach(syncRowPrintMirrors);
      updateGrandTotal();
      const saved = saveInvoiceRecord({ forcePending: true, silent: true });
      if (!saved) return;
      if (typeof showToast === 'function') {
        showToast(`Reserved ${saved.invoiceNumber} as Pending Amount. Reopen later to fill in amounts.`, 'info');
      }
      const getBlankFilename = () => (typeof setPrintDocumentTitle === 'function'
        ? `${setPrintDocumentTitle(invoiceNumberEl?.value || 'Invoice', clientNameEl?.value || '')}_Blank`
        : `${invoiceNumberEl?.value || 'Invoice'}_Blank`);
      if (typeof downloadRenderedPdf === 'function') {
        await downloadRenderedPdf(prepareForPrint, getBlankFilename, downloadBlankBtn);
      } else {
        prepareForPrint();
        window.print();
      }
    });
  }
  if (saveAndNextBlankBtn) {
    saveAndNextBlankBtn.addEventListener('click', () => {
      if (!isBlankInvoiceMode()) return;
      const saved = saveInvoiceRecord({ forcePending: true, silent: true });
      if (!saved) return;
      activeParams = {};
      resetInvoiceFieldsToNew({ blank: true });
      itemRowsEl.innerHTML = '';
      addRow();
      if (invoiceDateEl) invoiceDateEl.value = formatISO(new Date());
      if (invoiceNumberEl) invoiceNumberEl.value = peekNextInvoiceNumber();
      if (typeof history !== 'undefined' && history.replaceState) {
        try { history.replaceState(null, '', '?new=1&blank=1'); } catch (_) { }
      }
      clearDraft();
      updateModeBadge(false);
      updateGrandTotal();
      syncClientDisplay();
      syncPrintDisplayValues();
      renderQR(qrContainer, buildQRText());
      isDirty = false;
      if (typeof showToast === 'function') {
        showToast(`Reserved ${saved.invoiceNumber} — ready for next blank ${invoiceNumberEl?.value || ''}.`, 'success');
      }
    });
  }
  if (typeof initPdfDownloadButton === 'function') {
    initPdfDownloadButton('downloadPdfBtn', () => {
      if (isBlankInvoiceMode()) {
        saveInvoiceRecord({ forcePending: true, silent: true });
      }
      prepareForPrint();
    }, () => {
      const base = typeof setPrintDocumentTitle === 'function'
        ? setPrintDocumentTitle(invoiceNumberEl?.value || 'Invoice', clientNameEl?.value || '')
        : (invoiceNumberEl?.value || 'Invoice');
      return isBlankInvoiceMode() ? `${base}_Blank` : base;
    });
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
      if (isBlankInvoiceMode()) {
        showToast('Complete and save final amounts before sharing this invoice.', 'warning');
        return;
      }
      if (typeof shareDocumentWhatsApp === 'function') {
        shareDocumentWhatsApp('invoice', getShareData());
      }
    });
  }

  if (shareEmailBtn) {
    shareEmailBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (isBlankInvoiceMode()) {
        showToast('Complete and save final amounts before sharing this invoice.', 'warning');
        return;
      }
      if (typeof shareDocumentEmail === 'function') {
        shareDocumentEmail('invoice', getShareData());
      }
    });
  }
  resetBtn.addEventListener('click', () => {
    if (confirm('Clear all fields?')) {
      clearDraft();
      resetInvoiceFieldsToNew();
      const today = new Date();
      if (invoiceDateEl) invoiceDateEl.value = formatISO(today);
      if (dueDateEl) dueDateEl.value = formatISO(addWorkingDays(today, 15));
      itemRowsEl.innerHTML = '';
      addRow();
      updateGrandTotal();
      isDirty = false;
      activeParams = {};
      if (typeof history !== 'undefined' && window.location.search) {
        try { history.replaceState(null, '', '?new=1'); } catch (_) { }
      }
      if (invoiceNumberEl) invoiceNumberEl.value = peekNextInvoiceNumber();
      renderQR(qrContainer, buildQRText());
      updateModeBadge(false);
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
    if (!tr || tr.classList.contains('blank-filler-row')) return;
    const isBlank = isBlankInvoiceMode();
    const nameVal = tr.querySelector('.item-name-input')?.value || '';
    const descVal = tr.querySelector('.item-desc-input')?.value || '';
    const qtyRaw = tr.querySelector('.qty')?.value || '0';
    const qtyNum = parseFloat(String(qtyRaw).replace(/[^0-9.]/g, '')) || 0;
    const unitVal = tr.querySelector('.unit')?.value || 'Pcs';
    const priceNum = parseFloat(String(tr.querySelector('.price')?.value || '0').replace(/[^0-9.]/g, '')) || 0;
    const lineTotal = roundBDT(qtyNum * priceNum);
    const nMir = tr.querySelector('.item-print-name');
    const dMir = tr.querySelector('.item-print-desc');
    const qMir = tr.querySelector('.item-print-qty');
    const uMir = tr.querySelector('.item-print-unit');
    const pMir = tr.querySelector('.item-print-price');
    const totalCell = tr.querySelector('.total');
    if (nMir) nMir.textContent = nameVal;
    if (dMir) dMir.textContent = descVal;
    if (qMir) qMir.textContent = (isBlank && qtyNum === 0) ? '' : String(qtyRaw);
    if (uMir) uMir.textContent = (isBlank && !nameVal.trim() && !descVal.trim() && qtyNum === 0) ? '' : unitVal;
    if (pMir) pMir.textContent = (isBlank && priceNum === 0) ? '' : formatBDT(priceNum);
    if (totalCell) totalCell.textContent = (isBlank && lineTotal === 0) ? '' : formatBDT(lineTotal);
  }

  function syncBlankFillerRows() {
    if (!itemRowsEl) return;
    itemRowsEl.querySelectorAll('tr.blank-filler-row').forEach(r => r.remove());
    if (!isBlankInvoiceMode()) return;
    const existingCount = itemRowsEl.querySelectorAll('tr').length;
    const targetRows = 5;
    for (let i = existingCount; i < targetRows; i++) {
      const filler = document.createElement('tr');
      filler.className = 'blank-filler-row print-only';
      filler.innerHTML = '<td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td class="action-col no-print"></td>';
      itemRowsEl.appendChild(filler);
    }
  }

  function addRowFromData(row) {
    const tr = document.createElement('tr');
    const unitVal = row.unit || 'Pcs';
    const rowNum = itemRowsEl.children.length + 1;
    const qtyNum = row.qty || 0;
    const priceNum = row.unitPrice || 0;
    const isBlank = isBlankInvoiceMode();
    const lineTotal = roundBDT(qtyNum * priceNum);
    const showBlankQty = isBlank && qtyNum === 0;
    const showBlankPrice = isBlank && priceNum === 0;
    const showBlankTotal = isBlank && lineTotal === 0;
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
        <span class="print-only item-print-qty">${showBlankQty ? '' : escapeHTML(String(qtyNum))}</span>
      </td>
      <td class="text-center">
        <input type="text" class="form-control form-control-sm text-center unit no-print" list="quickUnitOptions" aria-label="Unit, row ${rowNum}" value="${escapeAttr(unitVal)}" />
        <span class="print-only item-print-unit">${(isBlank && !row.name && !row.desc && qtyNum === 0) ? '' : escapeHTML(unitVal)}</span>
      </td>
      <td class="text-end">
        <input type="text" inputmode="decimal" class="form-control form-control-sm text-end price no-print" aria-label="Unit price, row ${rowNum}" value="${escapeAttr(priceNum)}" />
        <span class="print-only item-print-price">${showBlankPrice ? '' : formatBDT(priceNum)}</span>
      </td>
      <td class="text-end total">${showBlankTotal ? '' : formatBDT(lineTotal)}</td>
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
      if (total > 0 && blankModeToggle && blankModeToggle.checked) {
        blankModeToggle.checked = false;
        if (paymentMethodEl && !paymentMethodEl.value) paymentMethodEl.value = 'Cash';
        const existingInv = invoiceNumberEl.value ? getInvoiceByNumber(invoiceNumberEl.value) : null;
        updateModeBadge(!!activeParams?.no, invoiceNumberEl.value, !!(existingInv && (existingInv.status === 'Pending' || existingInv.amountPending)));
        itemRowsEl.querySelectorAll('tr:not(.blank-filler-row)').forEach(r => { if (r !== tr) syncRowPrintMirrors(r); });
      }
      totalCell.textContent = (isBlankInvoiceMode() && total === 0) ? '' : formatBDT(total);
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
    itemRowsEl.querySelectorAll('tr:not(.blank-filler-row)').forEach(tr => {
      const qty = parseFloat(String(tr.querySelector('.qty')?.value || '0').replace(/[^0-9.]/g, '')) || 0;
      const price = parseFloat(String(tr.querySelector('.price')?.value || '0').replace(/[^0-9.]/g, '')) || 0;
      subtotal = roundBDT(subtotal + roundBDT(qty * price));
    });
    const discountMode = discountModeEl ? discountModeEl.value : 'bdt';
    const discountValue = discountInputEl ? roundBDT(Math.max(0, parseFloat(String(discountInputEl.value || '0').replace(/[^0-9.]/g, '')) || 0)) : 0;
    const vatRate = vatRateInputEl ? roundBDT(Math.max(0, parseFloat(String(vatRateInputEl.value || '0').replace(/[^0-9.]/g, '')) || 0)) : 0;
    const vatInclusive = vatModeEl ? vatModeEl.value === 'incl' : false;
    if (typeof computeTotalsBreakdown === 'function') {
      return computeTotalsBreakdown(subtotal, { discountMode, discountValue, vatRate, vatInclusive });
    }
    const disc = discountMode === 'percent' ? roundBDT(subtotal * (Math.min(discountValue, 100) / 100)) : discountValue;
    const discount = Math.min(disc, subtotal);
    const afterDiscount = roundBDT(Math.max(0, subtotal - discount));
    const vatAmount = vatRate > 0 ? (vatInclusive ? roundBDT(afterDiscount - roundBDT(afterDiscount / (1 + vatRate / 100))) : roundBDT(afterDiscount * (vatRate / 100))) : 0;
    const grandTotal = vatInclusive ? afterDiscount : roundBDT(afterDiscount + vatAmount);
    return { subtotal, discountMode, discountValue, discount, vatRate, vatInclusive, taxable: vatInclusive ? roundBDT(afterDiscount - vatAmount) : afterDiscount, vatAmount, grandTotal };
  }

  function updateGrandTotal() {
    const totals = getInvoiceTotalsBreakdown();
    const isBlank = isBlankInvoiceMode();
    if (isBlank && totals.grandTotal === 0) {
      grandTotalEl.innerHTML = '<span class="blank-amt-line" style="min-width:95px;"></span>';
    } else {
      grandTotalEl.textContent = formatBDT(totals.grandTotal);
    }
    const subtotalEl = document.getElementById('subtotalDisplay');
    if (subtotalEl) {
      if (isBlank && totals.subtotal === 0) subtotalEl.innerHTML = '<span class="blank-amt-line" style="min-width:85px;"></span>';
      else subtotalEl.textContent = formatBDT(totals.subtotal);
    }
    if (headerTotalEl) headerTotalEl.textContent = `Total: ${formatBDT(totals.grandTotal)}`;
    if (amountWordsEl) {
      if (isBlank && totals.grandTotal === 0) amountWordsEl.innerHTML = '<span class="blank-words-line"></span>';
      else amountWordsEl.textContent = numberToWordsBDT(totals.grandTotal);
    }
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
    const isBlank = isBlankInvoiceMode();
    const totalNum = isBlank ? 0 : getGrandTotalNumber();
    const client = clientNameEl.value || '';
    const { biller } = _resolveInvoiceBiller();
    return buildQRPayload('INV', {
      number: num,
      date: invoiceDateEl.value,
      amount: totalNum,
      pending: isBlank,
      client,
      company: biller.name || (typeof COMPANY !== 'undefined' ? COMPANY.name : '')
    });
  }

  renderQR(qrContainer, buildQRText());
  adjustColumnWidths();

  function buildInvoiceRecord(opts = {}) {
    const isPending = !!(opts && opts.pending) || isBlankInvoiceMode();
    const items = [];
    itemRowsEl.querySelectorAll('tr:not(.blank-filler-row)').forEach(tr => {
      const name = (tr.querySelector('.item-name-input')?.value || '').trim();
      const desc = (tr.querySelector('.item-desc-input')?.value || '').trim();
      const qty = parseFloat(String(tr.querySelector('.qty')?.value || '0').replace(/[^0-9.]/g, '')) || 0;
      const unit = (tr.querySelector('.unit')?.value || 'Pcs').trim() || 'Pcs';
      const unitPrice = roundBDT(parseFloat(String(tr.querySelector('.price')?.value || '0').replace(/[^0-9.]/g, '')) || 0);
      if (isPending && !name && !desc && qty === 0 && unitPrice === 0) return;
      items.push({ name, desc, qty, unit, unitPrice: isPending ? 0 : unitPrice });
    });
    const totals = getInvoiceTotalsBreakdown();
    const totalAmount = isPending ? 0 : totals.grandTotal;
    const { existingInv, bId, biller } = _resolveInvoiceBiller();
    const companySnap = typeof slimCompanySnapshot === 'function' ? slimCompanySnapshot(biller) : biller;
    const nextStatus = existingInv?.status === 'Void' ? 'Void' : (isPending ? 'Pending' : 'Saved');
    return {
      id: existingInv?.id,
      createdAt: existingInv?.createdAt,
      status: nextStatus,
      amountPending: isPending,
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
      subtotal: isPending ? 0 : totals.subtotal,
      discountMode: totals.discountMode,
      discountValue: totals.discountValue,
      discount: isPending ? 0 : totals.discount,
      vatRate: totals.vatRate,
      vatInclusive: totals.vatInclusive,
      vatAmount: isPending ? 0 : totals.vatAmount,
      grandTotal: totalAmount,
      amountInWords: isPending ? '' : numberToWordsBDT(totalAmount),
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
      table.querySelectorAll('tbody tr:not(.blank-filler-row)').forEach(tr => {
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
    syncBlankFillerRows();
    itemRowsEl.querySelectorAll('tr:not(.blank-filler-row)').forEach(syncRowPrintMirrors);
    renderQR(qrContainer, buildQRText());
    if (typeof syncClientDisplay === 'function') syncClientDisplay();
    if (typeof syncPrintDisplayValues === 'function') syncPrintDisplayValues();
    if (typeof setPrintDocumentTitle === 'function') {
      const base = setPrintDocumentTitle(invoiceNumberEl?.value || 'Invoice', clientNameEl?.value || '');
      if (isBlankInvoiceMode()) document.title = `${base}_Blank`;
    }
    document.querySelectorAll('textarea').forEach(el => {
      el.style.height = 'auto';
      el.style.height = el.scrollHeight + 'px';
    });
    adjustColumnWidths();
  }
  window.addEventListener('beforeprint', prepareForPrint);
  window.addEventListener('afterprint', () => {
    if (itemRowsEl) itemRowsEl.querySelectorAll('tr.blank-filler-row').forEach(r => r.remove());
  });

  // Date helpers delegating to shared js/utils.js local date functions
  function parseISO(iso) { return parseLocalISODate(iso) || new Date(); }
  function formatISO(date) { return toLocalISODate(date); }
  function addWorkingDays(startDate, days) { return addWorkingDaysLocal(startDate, days); }

  window.addEventListener('billerchange', () => {
    const params = new URLSearchParams(window.location.search);
    const isEditing = params.get('no') || params.get('id') || params.get('load') || activeParams?.no;
    if (isEditing) return;
    if (typeof setCompanyHeader === 'function') {
      setCompanyHeader();
    }
    if (invoiceNumberEl) {
      invoiceNumberEl.value = peekNextInvoiceNumber();
    }
    renderQR(qrContainer, buildQRText());
    syncPrintDisplayValues();
  });

  if (window.AutoInvoiceDocList && typeof window.AutoInvoiceDocList.connectWorkspace === 'function') {
    window.AutoInvoiceDocList.connectWorkspace({
      type: 'invoice',
      blankBtnId: 'listBlankInvoiceBtn',
      getRecords: () => (typeof loadInvoices === 'function' ? loadInvoices() : []),
      loadDiskSummaries: typeof loadDiskInvoicesSummaries === 'function'
        ? async () => {
          let r = await loadDiskInvoicesSummaries();
          if (!r.length && typeof autoDiscoverSummaries === 'function') r = await autoDiscoverSummaries('invoices');
          return r;
        }
        : null,
      isDirty: () => isDirty,
      resetDirty: () => { isDirty = false; },
      hasEditorParams: (p) => !!(p && (p.new === '1' || p.new === 'true' || p.blank === '1' || p.blank === 'true' || p.no || p.ch || p.qtn || p.id || p.load || p.autoprint === '1')),
      loadEditor: async (p) => { await loadEditorFromParams(p); },
      onEnterList: () => { clearDraft(); activeParams = {}; },
      onAfterMutate: (no, action) => {
        if (action === 'delete' && activeParams?.no === no) activeParams = {};
      },
      afterFirstLoad: () => {
        if (typeof runAutoPrintIfRequested === 'function') {
          runAutoPrintIfRequested(prepareForPrint);
        }
      }
    });
  } else {
    loadEditorFromParams(parseQuery()).then(() => {
      if (typeof runAutoPrintIfRequested === 'function') runAutoPrintIfRequested(prepareForPrint);
    });
  }
});
