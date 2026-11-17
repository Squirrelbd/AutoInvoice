// Money Receipt logic: editable amount, linkage to invoice, print and CSV download

document.addEventListener('DOMContentLoaded', () => {
  setCompanyHeader();

  const receiptNumberEl = document.getElementById('receiptNumber');
  const receiptDateEl = document.getElementById('receiptDate');
  const linkedInvoiceEl = document.getElementById('linkedInvoice');
  const clientNameEl = document.getElementById('clientName');
  const clientAddressEl = document.getElementById('clientAddress');
  const paymentMethodEl = document.getElementById('paymentMethod');
  const trxRefEl = document.getElementById('trxRef');
  const amountReceivedEl = document.getElementById('amountReceived');
  const amountWordsEl = document.getElementById('amountInWords');
  const linkedInvoiceInfoEl = document.getElementById('linkedInvoiceInfo');
  const invoiceListEl = document.getElementById('invoiceList');
  const clientListEl = document.getElementById('clientList');
  const dueAmountEl = document.getElementById('dueAmount');
  const dueMsgEl = document.getElementById('dueMsg');
  const zeroDueToggle = document.getElementById('zeroDueToggle');
  const adjustmentReasonEl = document.getElementById('adjustmentReason');
  const saveBtn = document.getElementById('saveReceiptBtn');
  const printBtn = document.getElementById('printBtn');
  const downloadCsvBtn = document.getElementById('downloadCsvBtn');
  const receiptQREl = document.getElementById('receiptQR');

  function parseAmt(str) {
    const raw = String(str || '').trim().replace(/,/g, '');
    if (!raw) return 0;
    const neg = /^-/.test(raw);
    const num = parseFloat(raw.replace(/[^0-9.]/g, ''));
    if (!isFinite(num)) return 0;
    return roundBDT(neg ? -num : num);
  }

  const modeBadgeEl = document.getElementById('modeBadge');
  function updateModeBadge(isEditing, docNo) {
    if (!modeBadgeEl) return;
    if (isEditing) {
      modeBadgeEl.innerHTML = `<span class="badge bg-primary fs-6 px-3 py-2 shadow-sm">📝 Editing Receipt: ${escapeHTML(docNo)}</span>`;
    } else {
      modeBadgeEl.innerHTML = `<span class="badge bg-success fs-6 px-3 py-2 shadow-sm">✨ New Receipt</span>`;
    }
  }

  // Client Display Synchronization
  function syncClientDisplay() {
    const name = (clientNameEl?.value || '').trim();
    const addr = (clientAddressEl?.value || '').trim();
    const nameDisp = document.getElementById('clientNameDisplay');
    const addrDisp = document.getElementById('clientAddressDisplay');
    const contactDisp = document.getElementById('clientContactDisplay');
    const commsDisp = document.getElementById('clientCommsDisplay');

    let match = null;
    if (typeof loadClients === 'function' && name) {
      match = loadClients().find(c => (c.name || '').toLowerCase() === name.toLowerCase());
    }

    if (nameDisp) nameDisp.textContent = name || '—';
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
    if (match && match.bin) commsParts.push(`BIN/TIN: ${match.bin}`);
    if (commsDisp) {
      commsDisp.textContent = commsParts.length ? commsParts.join(' | ') : '';
    }
  }

  // Synchronize All Print and Voucher Display Values
  function syncReceiptPrintValues() {
    syncClientDisplay();

    const rcptNumPrint = document.getElementById('receiptNumberPrint');
    const rcptDatePrint = document.getElementById('receiptDatePrint');
    const payMethodPrint = document.getElementById('paymentMethodPrint');
    const trxRefPrint = document.getElementById('trxRefPrint');
    const linkInvPrint = document.getElementById('linkedInvoicePrint');
    const amtReceivedDisp = document.getElementById('amountReceivedDisplay');
    const dueAmtDisp = document.getElementById('dueAmountDisplay');
    const particularsTitle = document.getElementById('receiptParticularsTitle');
    const particularsSub = document.getElementById('receiptParticularsSub');
    const particularsRow = document.getElementById('receiptParticularsRow');
    const invTotalCol = document.getElementById('receiptInvTotalCol');
    const payModeDesc = document.getElementById('receiptPaymentModeDesc');
    const dueDesc = document.getElementById('receiptDueDesc');
    const dueRow = document.getElementById('receiptDueRow');

    if (rcptNumPrint && receiptNumberEl) rcptNumPrint.textContent = receiptNumberEl.value || '—';
    if (rcptDatePrint && receiptDateEl) {
      rcptDatePrint.textContent = typeof formatDisplayDate === 'function' ? formatDisplayDate(receiptDateEl.value) : receiptDateEl.value;
    }
    const methodVal = paymentMethodEl?.value || 'Cash';
    const trxVal = (trxRefEl?.value || '').trim();
    if (payMethodPrint) {
      payMethodPrint.textContent = methodVal;
    }
    if (trxRefPrint) {
      trxRefPrint.textContent = trxVal || '—';
    }
    if (payModeDesc) {
      payModeDesc.textContent = trxVal ? `Received via ${methodVal} • Ref: ${trxVal}` : `Received via ${methodVal}`;
    }

    const invNo = (linkedInvoiceEl?.value || '').trim();
    if (linkInvPrint) {
      linkInvPrint.textContent = invNo || '— (Direct Payment)';
    }

    const amtNum = Math.max(0, parseAmt(amountReceivedEl?.value));
    if (amtReceivedDisp) {
      amtReceivedDisp.textContent = formatBDT(amtNum);
    }
    if (amountWordsEl) {
      amountWordsEl.textContent = numberToWordsBDT(amtNum);
    }

    if (invNo) {
      const inv = getInvoiceByNumber(invNo) || currentInvoiceFull;
      const stats = getInvoicePaymentStats(inv || invNo, currentReceiptNumber);
      const total = (stats && stats.status !== 'Unknown') ? stats.total : ((inv && inv.grandTotal != null) ? roundBDT(inv.grandTotal) : 0);
      const paid = stats ? stats.paid : 0;
      const dueVal = parseAmt(dueAmountEl?.value);

      if (particularsTitle) particularsTitle.textContent = `Payment for Commercial Invoice #${invNo}`;
      if (particularsSub) {
        particularsSub.innerHTML = `Total Invoiced: <strong>${formatBDT(total)}</strong> • Prior Collections: <strong>${formatBDT(paid)}</strong>`;
      }
      if (invTotalCol) invTotalCol.textContent = formatBDT(total);
      if (particularsRow) particularsRow.style.display = '';

      if (dueDesc) {
        if (zeroDueToggle && zeroDueToggle.checked) {
          const reason = adjustmentReasonEl?.value || 'Settlement Adjustment';
          dueDesc.textContent = `Settled & closed (${reason})`;
        } else {
          dueDesc.textContent = 'Outstanding balance after this receipt';
        }
      }

      if (dueAmtDisp) {
        if (inv && inv.status === 'Void') {
          dueAmtDisp.textContent = 'VOID INVOICE';
          dueAmtDisp.className = 'text-danger fw-bold font-monospace';
        } else if (dueVal <= 0 || (zeroDueToggle && zeroDueToggle.checked)) {
          dueAmtDisp.textContent = '৳0.00 (PAID IN FULL)';
          dueAmtDisp.className = 'text-success fw-bold font-monospace';
        } else {
          dueAmtDisp.textContent = formatBDT(dueVal);
          dueAmtDisp.className = 'text-danger fw-bold font-monospace';
        }
      }
      if (dueRow) dueRow.style.display = '';
    } else {
      if (particularsTitle) particularsTitle.textContent = 'Direct Payment / Official Service Receipt';
      if (particularsSub) particularsSub.textContent = 'Non-invoiced receipt / Direct cash receipt';
      if (invTotalCol) invTotalCol.textContent = formatBDT(amtNum);
      if (dueDesc) dueDesc.textContent = 'Outstanding balance after this receipt';
      if (dueAmtDisp) dueAmtDisp.textContent = '৳0.00';
      if (dueRow) dueRow.style.display = '';
    }
  }

  // Initialize Client Onboarding
  let clientOnboarding = null;
  if (window.AutoInvoiceCatalog) {
    clientOnboarding = AutoInvoiceCatalog.setupClientOnboarding({
      selectId: 'clientSelect',
      datalistId: 'clientList',
      nameInputId: 'clientName',
      addressInputId: 'clientAddress',
      onClientSelected: (client) => {
        syncReceiptPrintValues();
        updateReceiptSummaryAndQR();
      }
    });
  }

  if (clientNameEl) {
    clientNameEl.addEventListener('input', () => {
      const val = clientNameEl.value.trim().toLowerCase();
      if (!val || typeof loadClients !== 'function') {
        syncReceiptPrintValues();
        debouncedUpdateReceiptSummaryAndQR();
        return;
      }
      const match = loadClients().find(c => (c.name || '').toLowerCase() === val);
      if (match && match.address && clientAddressEl && !clientAddressEl.value) {
        clientAddressEl.value = match.address;
      }
      const clientSelect = document.getElementById('clientSelect');
      if (clientSelect && match) {
        clientSelect.value = match.name;
      }
      syncReceiptPrintValues();
      debouncedUpdateReceiptSummaryAndQR();
    });
  }

  if (clientAddressEl) {
    clientAddressEl.addEventListener('input', () => {
      syncReceiptPrintValues();
    });
  }

  const params = parseQuery();
  receiptDateEl.value = typeof toLocalISODate === 'function' ? toLocalISODate() : new Date().toISOString().slice(0, 10);

  // Populate invoice suggestions (local + disk summaries, excluding Void)
  (async function populateInvoiceList() {
    try {
      const local = loadInvoices();
      let disk = [];
      if (typeof loadDiskInvoicesSummaries === 'function') {
        disk = await loadDiskInvoicesSummaries();
        if (!disk.length && typeof autoDiscoverSummaries === 'function') {
          disk = await autoDiscoverSummaries('invoices');
        }
      }
      const byNo = new Map();
      [...(local || []), ...(disk || [])].forEach(inv => {
        if (inv.status === 'Void') return;
        const no = inv.invoiceNumber || inv.number;
        if (!no || byNo.has(no)) return;
        byNo.set(no, inv);
      });
      if (invoiceListEl) {
        invoiceListEl.innerHTML = '';
        for (const [no, inv] of byNo.entries()) {
          const opt = document.createElement('option');
          opt.value = no;
          opt.label = `${no} — ${(inv.title || '')} (${inv.date || ''})`;
          invoiceListEl.appendChild(opt);
        }
      }
    } catch (e) {
      console.warn('Failed to populate invoices datalist', e);
    }
  })();

  let currentInvoiceFull = null;
  function applyInvoiceData(inv) {
    if (!inv) return;
    currentInvoiceFull = inv;
    if (!currentReceiptNumber && inv.billerId && typeof getBillerById === 'function' && getBillerById(inv.billerId)) {
      if (typeof getActiveBillerId === 'function' && getActiveBillerId() !== inv.billerId && typeof setActiveBillerId === 'function') {
        setActiveBillerId(inv.billerId);
      }
    }
    if (inv.status === 'Void') {
      const invNo = inv.invoiceNumber || inv.number || '';
      if (linkedInvoiceInfoEl) {
        linkedInvoiceInfoEl.textContent = `${invNo} is VOID — Cannot accept payments`;
      }
      linkedInvoiceEl.classList.add('is-invalid');
      if (typeof showToast === 'function') showToast(`Invoice ${invNo} is Void and cannot be paid.`, 'warning');
      updateDue();
      syncReceiptPrintValues();
      return;
    }
    linkedInvoiceEl.classList.remove('is-invalid');
    clientNameEl.value = inv.client?.name || '';
    clientAddressEl.value = inv.client?.address || '';
    paymentMethodEl.value = inv.paymentMethod || 'Cash';
    const invNo = inv.invoiceNumber || inv.number || '';
    const stats = invNo && typeof getInvoicePaymentStats === 'function'
      ? getInvoicePaymentStats(inv, currentReceiptNumber)
      : null;
    const defaultAmt = (stats && stats.status !== 'Unknown') ? stats.due : roundBDT(inv.grandTotal || 0);
    amountReceivedEl.value = String(defaultAmt);
    const amt = Math.max(0, parseAmt(amountReceivedEl.value));
    amountWordsEl.textContent = numberToWordsBDT(amt);
    if (linkedInvoiceInfoEl) {
      const totalTxt = (inv.grandTotal != null) ? formatBDT(inv.grandTotal) : '';
      linkedInvoiceInfoEl.textContent = `${inv.invoiceNumber} • ${inv.title || ''} • ${inv.date || ''} ${totalTxt ? '• ' + totalTxt : ''}`.trim();
    }
    updateDue();
    syncReceiptPrintValues();
  }

  async function fetchInvoiceByNumber(no) {
    let inv = getInvoiceByNumber(no);
    if (!inv && typeof getDiskInvoiceByNumber === 'function') {
      try { inv = await getDiskInvoiceByNumber(no); } catch (e) {
        console.warn('Failed to fetch disk invoice', no, e);
      }
    }
    return inv;
  }

  let currentReceiptNumber = '';
  const rcptNo = params.rcpt || params.no;

  if (rcptNo) {
    const r = getReceiptByNumber(rcptNo);
    if (r) {
      currentReceiptNumber = r.receiptNumber;
      receiptNumberEl.value = r.receiptNumber;
      receiptDateEl.value = r.date || receiptDateEl.value;
      linkedInvoiceEl.value = r.invoiceNumber || '';
      clientNameEl.value = r.client?.name || '';
      clientAddressEl.value = r.client?.address || '';
      paymentMethodEl.value = r.paymentMethod || 'Cash';
      if (trxRefEl) trxRefEl.value = r.trxRef || '';
      amountReceivedEl.value = String(r.amount || 0);
      amountWordsEl.textContent = numberToWordsBDT(r.amount || 0);
      updateModeBadge(true, r.receiptNumber);
      if (r.billerId || r.company) {
        const rBiller = (typeof getBillerById === 'function' && r.billerId ? getBillerById(r.billerId) : null) || r.company;
        if (rBiller) setCompanyHeader(rBiller);
      }
      if (r.invoiceNumber) {
        (async () => {
          const inv = await fetchInvoiceByNumber(r.invoiceNumber);
          if (inv) {
            currentInvoiceFull = inv;
            if (linkedInvoiceInfoEl) {
              const totalTxt = (inv.grandTotal != null) ? formatBDT(inv.grandTotal) : '';
              linkedInvoiceInfoEl.textContent = `${inv.invoiceNumber} • ${inv.title || ''} • ${inv.date || ''} ${totalTxt ? '• ' + totalTxt : ''}`.trim();
            }
          }
          if (r.adjustment && r.adjustment.applied && zeroDueToggle) {
            zeroDueToggle.checked = true;
            if (adjustmentReasonEl) {
              adjustmentReasonEl.disabled = false;
              adjustmentReasonEl.value = r.adjustment.reason || 'Payment Settlement Rebate';
            }
          }
          updateDue();
          syncReceiptPrintValues();
          updateReceiptSummaryAndQR();
        })();
      } else {
        updateDue();
        syncReceiptPrintValues();
        updateReceiptSummaryAndQR();
      }
    } else {
      receiptNumberEl.value = peekNextReceiptNumber();
      updateModeBadge(false);
      updateDue();
      syncReceiptPrintValues();
    }
  } else if (params.inv) {
    receiptNumberEl.value = peekNextReceiptNumber();
    linkedInvoiceEl.value = params.inv;
    updateModeBadge(false);
    (async () => {
      const inv = await fetchInvoiceByNumber(params.inv);
      if (inv) applyInvoiceData(inv);
      syncReceiptPrintValues();
    })();
  } else if (params.qtn) {
    receiptNumberEl.value = peekNextReceiptNumber();
    updateModeBadge(false);
    const q = getQuotationByNumber(params.qtn);
    if (q) {
      clientNameEl.value = q.to?.company || q.to?.name || '';
      clientAddressEl.value = q.to?.address || '';
      paymentMethodEl.value = 'Cash';
      amountReceivedEl.value = String(q.grandTotal || 0);
      amountWordsEl.textContent = numberToWordsBDT(q.grandTotal || 0);
      linkedInvoiceEl.value = '';
      if (linkedInvoiceInfoEl) linkedInvoiceInfoEl.textContent = '';
      updateDue();
      syncReceiptPrintValues();
      updateReceiptSummaryAndQR();
    }
  } else {
    receiptNumberEl.value = peekNextReceiptNumber();
    updateModeBadge(false);
    updateDue();
    syncReceiptPrintValues();
  }
  currentReceiptNumber = receiptNumberEl.value;

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

  const debouncedUpdateReceiptSummaryAndQR = debounce(updateReceiptSummaryAndQR, 300);

  amountReceivedEl.addEventListener('input', () => {
    const amt = Math.max(0, parseAmt(amountReceivedEl.value));
    amountWordsEl.textContent = numberToWordsBDT(amt);
    updateDue();
    syncReceiptPrintValues();
    debouncedUpdateReceiptSummaryAndQR();
  });
  if (zeroDueToggle) {
    zeroDueToggle.addEventListener('change', () => {
      if (zeroDueToggle.checked) {
        const ok = confirm('Zero Due by Adjustment writes off any remaining balance on this linked invoice (or records AIT/VDS withholding), recording it as adjusted. Proceed?');
        if (!ok) {
          zeroDueToggle.checked = false;
        }
      }
      if (adjustmentReasonEl) adjustmentReasonEl.disabled = !zeroDueToggle.checked;
      updateDue();
      syncReceiptPrintValues();
    });
  }
  if (adjustmentReasonEl) {
    adjustmentReasonEl.addEventListener('change', () => {
      syncReceiptPrintValues();
    });
  }

  paymentMethodEl.addEventListener('change', () => {
    syncReceiptPrintValues();
  });
  if (trxRefEl) {
    trxRefEl.addEventListener('input', () => {
      syncReceiptPrintValues();
    });
  }

  async function handleLinkedInvoiceChange() {
    const no = (linkedInvoiceEl.value || '').trim();
    if (!no) {
      if (linkedInvoiceInfoEl) linkedInvoiceInfoEl.textContent = '';
      linkedInvoiceEl.classList.remove('is-invalid');
      dueAmountEl.value = '';
      if (dueMsgEl) dueMsgEl.textContent = '';
      const amt = Math.max(0, parseAmt(amountReceivedEl.value));
      amountWordsEl.textContent = numberToWordsBDT(amt);
      currentInvoiceFull = null;
      updateDue();
      syncReceiptPrintValues();
      return;
    }
    const inv = await fetchInvoiceByNumber(no);
    if (inv) {
      applyInvoiceData(inv);
      updateReceiptSummaryAndQR();
      syncReceiptPrintValues();
    } else {
      if (linkedInvoiceInfoEl) linkedInvoiceInfoEl.textContent = 'Invoice not found';
      linkedInvoiceEl.classList.add('is-invalid');
      updateDue();
      syncReceiptPrintValues();
    }
  }

  linkedInvoiceEl.addEventListener('change', handleLinkedInvoiceChange);
  linkedInvoiceEl.addEventListener('blur', handleLinkedInvoiceChange);

  clientNameEl.addEventListener('input', () => {
    debouncedUpdateReceiptSummaryAndQR();
  });
  receiptDateEl.addEventListener('input', () => {
    syncReceiptPrintValues();
    debouncedUpdateReceiptSummaryAndQR();
  });

  function buildInvoiceStyleQRForReceipt() {
    const tx = (receiptNumberEl.value || '').trim();
    const amtNum = Math.max(0, parseAmt(amountReceivedEl.value));
    const client = (clientNameEl.value || '').trim();
    const activeBiller = typeof getActiveBiller === 'function' ? getActiveBiller() : (typeof COMPANY !== 'undefined' ? COMPANY : {});
    return buildQRPayload('RCPT', {
      number: tx,
      date: receiptDateEl.value,
      amount: amtNum,
      client,
      company: activeBiller.name || (typeof COMPANY !== 'undefined' ? COMPANY.name : '')
    });
  }

  function updateReceiptSummaryAndQR() {
    if (receiptQREl) {
      const qrPayload = buildInvoiceStyleQRForReceipt();
      renderQR(receiptQREl, qrPayload);
      receiptQREl.dataset.text = qrPayload;
    }
  }

  // Initial populate
  updateReceiptSummaryAndQR();
  syncReceiptPrintValues();

  function updateDue() {
    const invNo = (linkedInvoiceEl.value || '').trim();
    const amtEntered = parseAmt(amountReceivedEl.value);
    const negative = amtEntered < 0;
    const inv = (invNo ? getInvoiceByNumber(invNo) : null) || (currentInvoiceFull && (currentInvoiceFull.invoiceNumber === invNo || currentInvoiceFull.number === invNo) ? currentInvoiceFull : null);
    if (!invNo) {
      if (dueAmountEl) dueAmountEl.value = '';
      if (dueMsgEl) { dueMsgEl.textContent = ''; dueMsgEl.classList.remove('text-success', 'text-warning', 'text-danger'); }
      amountReceivedEl.classList.toggle('is-invalid', negative);
      saveBtn.disabled = negative;
      if (typeof syncReceiptPrintValues === 'function') syncReceiptPrintValues();
      return;
    }
    if (inv && inv.status === 'Void') {
      if (dueAmountEl) dueAmountEl.value = '';
      if (dueMsgEl) {
        dueMsgEl.textContent = `Invoice ${invNo} is Void — payments are disabled.`;
        dueMsgEl.classList.remove('text-success', 'text-warning');
        dueMsgEl.classList.add('text-danger');
      }
      saveBtn.disabled = true;
      if (typeof syncReceiptPrintValues === 'function') syncReceiptPrintValues();
      return;
    }
    let stats = null;
    if (inv) {
      stats = getInvoicePaymentStats(inv, currentReceiptNumber);
    } else {
      if (dueAmountEl) dueAmountEl.value = '';
      if (dueMsgEl) { dueMsgEl.textContent = ''; dueMsgEl.classList.remove('text-success', 'text-warning', 'text-danger'); }
      amountReceivedEl.classList.toggle('is-invalid', negative);
      saveBtn.disabled = negative;
      if (typeof syncReceiptPrintValues === 'function') syncReceiptPrintValues();
      return;
    }
    const entered = amtEntered;
    const remainingBefore = roundBDT(Math.max(0, stats.total - stats.paid));
    const overpay = entered > remainingBefore;
    const adjustOn = !!(zeroDueToggle && zeroDueToggle.checked);
    const prevAdj = invNo ? getLatestAdjustmentForInvoice(invNo, currentReceiptNumber) : null;
    const prevAdjTxt = prevAdj ? ` • Prior Adj: ${formatBDT(prevAdj.amount || 0)}` : '';

    if (adjustOn) {
      if (dueAmountEl) dueAmountEl.value = '0.00';
      if (dueMsgEl) {
        const writeOff = roundBDT(Math.max(0, remainingBefore - entered));
        const reason = adjustmentReasonEl?.value || 'Settlement Rebate';
        dueMsgEl.textContent = `${reason} active • Adjustment: ${formatBDT(writeOff)}${prevAdjTxt}`;
        dueMsgEl.classList.remove('text-success', 'text-danger');
        dueMsgEl.classList.add('text-warning');
      }
    } else {
      const remainingAfter = roundBDT(Math.max(0, remainingBefore - entered));
      if (dueAmountEl) dueAmountEl.value = String(remainingAfter.toFixed(2));
      if (dueMsgEl) {
        const paidTxt = `Paid to date: ${formatBDT(stats.paid)}`;
        const beforeTxt = `Remaining before this receipt: ${formatBDT(remainingBefore)}`;
        const fullTxt = remainingAfter === 0 ? ' • Paid in full' : '';
        dueMsgEl.textContent = `${paidTxt} • ${beforeTxt}${fullTxt}${prevAdjTxt}${overpay ? ' • Overpayment detected, reduce amount' : ''}`;
        dueMsgEl.classList.toggle('text-success', remainingAfter === 0 && !overpay);
        if (remainingAfter !== 0) dueMsgEl.classList.remove('text-success');
        dueMsgEl.classList.remove('text-warning', 'text-danger');
      }
    }
    amountReceivedEl.classList.toggle('is-invalid', overpay || negative);
    saveBtn.disabled = overpay || negative;
    if (typeof syncReceiptPrintValues === 'function') syncReceiptPrintValues();
  }

  saveBtn.addEventListener('click', async () => {
    const invNo = (linkedInvoiceEl.value || '').trim();
    let inv = invNo ? getInvoiceByNumber(invNo) : null;
    if (!inv && invNo) { inv = await fetchInvoiceByNumber(invNo); }
    if (inv && inv.status === 'Void') {
      showToast(`Invoice ${invNo} is Void and cannot accept payments.`, 'danger');
      return;
    }
    const amt = parseAmt(amountReceivedEl.value);
    if (amt < 0) {
      showToast('Amount cannot be negative.', 'danger');
      amountReceivedEl.classList.add('is-invalid');
      return;
    }
    let remainingBefore = null;
    if (inv) {
      const stats = getInvoicePaymentStats(inv, currentReceiptNumber);
      remainingBefore = roundBDT(Math.max(0, stats.total - stats.paid));
      if (amt > remainingBefore) {
        showToast('Overpayment prevented. Reduce amount to remaining due.', 'warning');
        return;
      }
    }
    const adjustOn = !!(zeroDueToggle && zeroDueToggle.checked);
    if (adjustOn && inv) {
      const prevAdj = invNo ? getLatestAdjustmentForInvoice(invNo, currentReceiptNumber) : null;
      if (prevAdj) {
        const proceed = confirm(`This invoice already had an adjustment of ${formatBDT(prevAdj.amount || 0)} on ${prevAdj.timestamp?.slice(0, 10) || 'an earlier date'}. Are you sure you want to apply a new adjustment?`);
        if (!proceed) return;
      }
    }
    const existingRc = currentReceiptNumber ? getReceiptByNumber(currentReceiptNumber) : null;
    const linkedInvObj = inv || (invNo && typeof getInvoiceByNumber === 'function' ? getInvoiceByNumber(invNo) : null);
    const activeBillerId = existingRc?.billerId || linkedInvObj?.billerId || (typeof getActiveBillerId === 'function' ? getActiveBillerId() : 'biller_default');
    const activeBiller = (typeof getBillerById === 'function' && activeBillerId ? getBillerById(activeBillerId) : null)
      || (typeof getActiveBiller === 'function' ? getActiveBiller() : (typeof COMPANY !== 'undefined' ? COMPANY : {}));
    const qrData = buildInvoiceStyleQRForReceipt();
    const rc = {
      id: existingRc?.id,
      createdAt: existingRc?.createdAt,
      status: existingRc?.status,
      _type: 'receipt',
      billerId: activeBillerId,
      receiptNumber: receiptNumberEl.value,
      date: receiptDateEl.value,
      invoiceNumber: linkedInvoiceEl.value,
      client: { name: clientNameEl.value.trim(), address: clientAddressEl.value.trim() },
      paymentMethod: paymentMethodEl.value,
      trxRef: (trxRefEl?.value || '').trim(),
      amount: amt,
      amountInWords: numberToWordsBDT(amt),
      qrData,
      company: activeBiller
    };
    if (adjustOn && inv && remainingBefore != null) {
      const priorPaid = getTotalPaidForInvoice(invNo, currentReceiptNumber);
      const originalTotal = roundBDT(remainingBefore + priorPaid);
      const adjustmentAmt = roundBDT(Math.max(0, roundBDT(remainingBefore - amt)));
      rc.adjustment = {
        applied: true,
        reason: adjustmentReasonEl?.value || 'Payment Settlement Rebate',
        amount: adjustmentAmt,
        originalTotal,
        adjustedTotal: roundBDT(Math.max(0, roundBDT(originalTotal - adjustmentAmt))),
        timestamp: new Date().toISOString(),
        method: 'toggle'
      };
    }
    saveReceipt(rc);
    finalizeReceiptNumber(rc.receiptNumber);
    currentReceiptNumber = rc.receiptNumber;
    isDirty = false;
    updateModeBadge(true, rc.receiptNumber);
    if (clientOnboarding) clientOnboarding.refresh(rc.client?.name);
    showToast('Receipt saved successfully.', 'success');
    updateDue();
    syncReceiptPrintValues();
    updateReceiptSummaryAndQR();
  });

  function prepareForPrint() {
    try {
      updateReceiptSummaryAndQR();
      syncReceiptPrintValues();
      document.querySelectorAll('textarea').forEach(el => {
        el.style.height = 'auto';
        el.style.height = el.scrollHeight + 'px';
      });
    } catch (e) {
      console.warn('prepareForPrint error', e);
    }
  }
  window.addEventListener('beforeprint', () => {
    prepareForPrint();
    if (typeof setPrintDocumentTitle === 'function') {
      setPrintDocumentTitle(receiptNumberEl?.value || 'Receipt', clientNameEl?.value || '');
    }
  });

  function printWithGuard() {
    finalizeReceiptNumber(receiptNumberEl.value);
    prepareForPrint();
    let done = false;
    const onAfter = () => { done = true; window.removeEventListener('afterprint', onAfter); };
    window.addEventListener('afterprint', onAfter);
    try {
      window.print();
    } catch (e) {
      showToast('Print failed. Please use browser Print to PDF.', 'danger');
      return;
    }
    setTimeout(() => {
      if (!done) showToast('Print dialog closed or canceled. Use Ctrl+P to Print to PDF if needed.', 'info');
    }, 8000);
  }
  printBtn.addEventListener('click', printWithGuard);

  if (typeof initPdfDownloadButton === 'function') {
    initPdfDownloadButton('downloadPdfBtn', () => {
      finalizeReceiptNumber(receiptNumberEl.value);
      prepareForPrint();
    }, () => {
      if (typeof setPrintDocumentTitle === 'function') {
        return setPrintDocumentTitle(receiptNumberEl?.value || 'Receipt', clientNameEl?.value || '');
      }
      return receiptNumberEl?.value || 'Receipt';
    });
  }
  if (typeof runAutoPrintIfRequested === 'function') {
    runAutoPrintIfRequested(prepareForPrint);
  }

  // Global Ctrl+S shortcut to save
  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      saveBtn.click();
    }
  });

  downloadCsvBtn.addEventListener('click', () => {
    const rows = [
      ['Receipt Number', receiptNumberEl.value],
      ['Date', receiptDateEl.value],
      ['Invoice Number', linkedInvoiceEl.value],
      ['Client Name', clientNameEl.value],
      ['Client Address', clientAddressEl.value],
      ['Payment Method', paymentMethodEl.value],
      ['Transaction / Cheque Ref', trxRefEl?.value || ''],
      ['Amount', String(Math.max(0, parseAmt(amountReceivedEl.value)))]
    ];
    if (typeof downloadCSV === 'function') {
      downloadCSV(`receipt_${receiptNumberEl.value}.csv`, rows);
    }
  });

  const shareWhatsAppBtn = document.getElementById('shareWhatsAppBtn');
  const shareEmailBtn = document.getElementById('shareEmailBtn');

  function getShareData() {
    const amt = Math.max(0, parseAmt(amountReceivedEl?.value));
    const clientName = (clientNameEl?.value || '').trim() || 'Valued Customer';
    let clientPhone = '';
    let clientEmail = '';
    if (typeof loadClients === 'function') {
      const match = loadClients().find(c =>
        (c.name && c.name.toLowerCase() === clientName.toLowerCase()) ||
        (c.company && c.company.toLowerCase() === clientName.toLowerCase())
      );
      if (match) {
        clientPhone = match.phone || '';
        clientEmail = match.email || '';
      }
    }
    const dueAmtVal = Math.max(0, parseAmt(dueAmountEl?.value));
    return {
      number: receiptNumberEl?.value || '',
      date: receiptDateEl?.value || '',
      clientName: clientName,
      clientPhone: clientPhone,
      clientEmail: clientEmail,
      amount: amt,
      paymentMethod: paymentMethodEl?.value || 'Cash',
      linkedInvoice: (linkedInvoiceEl?.value || '').trim(),
      due: dueAmtVal,
      billerName: typeof getActiveBiller === 'function' ? getActiveBiller()?.name : ''
    };
  }

  if (shareWhatsAppBtn) {
    shareWhatsAppBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (typeof shareDocumentWhatsApp === 'function') {
        shareDocumentWhatsApp('receipt', getShareData());
      }
    });
  }

  if (shareEmailBtn) {
    shareEmailBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (typeof shareDocumentEmail === 'function') {
        shareDocumentEmail('receipt', getShareData());
      }
    });
  }

  // Optional QA mode: add visible outline and metrics when ?qrqa=1
  const qp = parseQuery();
  if (qp.qrqa === '1') {
    document.body.classList.add('qrqa');
    const panel = document.createElement('div');
    panel.className = 'qrqa-panel';
    const qr = document.getElementById('receiptQR');
    const block = document.getElementById('receiptQRBlock');
    if (qr && block) {
      const mmPerPx = 25.4 / 96;
      const csQR = getComputedStyle(qr);
      const csBlock = getComputedStyle(block);
      const qrWmm = parseFloat(csQR.width) * mmPerPx;
      const padLeftmm = parseFloat(csBlock.paddingLeft) * mmPerPx;
      const padRightmm = parseFloat(csBlock.paddingRight) * mmPerPx;
      panel.textContent = `QR≈${qrWmm.toFixed(1)}mm, quiet≈${Math.min(padLeftmm, padRightmm).toFixed(1)}mm (target: 20mm QR, 2mm quiet)`;
    } else {
      panel.textContent = 'QR QA active';
    }
    document.body.appendChild(panel);
  }

  window.addEventListener('billerchange', () => {
    if (typeof setCompanyHeader === 'function') {
      setCompanyHeader();
    }
    const params = new URLSearchParams(window.location.search);
    const isEditing = params.get('no') || params.get('id') || params.get('load') || params.get('rcpt') || currentReceiptNumber;
    if (!isEditing && receiptNumberEl) {
      receiptNumberEl.value = peekNextReceiptNumber();
    }
    syncReceiptPrintValues();
    updateReceiptSummaryAndQR();
  });
});
