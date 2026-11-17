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
  const pickInvoiceBtn = document.getElementById('pickInvoiceBtn');
  const adjustedInvoiceTotalEl = document.getElementById('adjustedInvoiceTotal');
  const adjustedInvoiceHintEl = document.getElementById('adjustedInvoiceHint');
  const receiptItemsRefEl = document.getElementById('receiptInvoiceItemsRef');
  const receiptItemsCountEl = document.getElementById('receiptInvItemsCount');
  const receiptItemsTbodyEl = document.getElementById('receiptInvItemsTbody');
  const clientListEl = document.getElementById('clientList');
  const dueAmountEl = document.getElementById('dueAmount');
  const dueMsgEl = document.getElementById('dueMsg');
  const zeroDueToggle = document.getElementById('zeroDueToggle');
  const adjustmentReasonEl = document.getElementById('adjustmentReason');
  const saveBtn = document.getElementById('saveReceiptBtn');
  const printBtn = document.getElementById('printBtn');
  const downloadCsvBtn = document.getElementById('downloadCsvBtn');
  const duplicateReceiptBtn = document.getElementById('duplicateReceiptBtn');
  const exportReceiptBtn = document.getElementById('exportReceiptBtn');
  const resetBtn = document.getElementById('resetBtn');
  const receiptQREl = document.getElementById('receiptQR');

  let isDirty = false;
  let currentReceiptNumber = '';
  let currentInvoiceFull = null;
  let _lastAppliedInvNo = '';

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
      const baseTotal = inv && inv.grandTotal != null ? roundBDT(inv.grandTotal) : (stats ? stats.originalTotal || stats.total : 0);
      const liveAdjusted = (adjustedInvoiceTotalEl && !adjustedInvoiceTotalEl.disabled && adjustedInvoiceTotalEl.value.trim() !== '')
        ? roundBDT(parseAmt(adjustedInvoiceTotalEl.value))
        : ((stats && stats.status !== 'Unknown') ? stats.total : baseTotal);
      const total = Math.max(0, liveAdjusted);
      const paid = stats ? stats.paid : 0;
      const dueVal = parseAmt(dueAmountEl?.value);
      const adjVariance = roundBDT(baseTotal - total);
      const isAdjusted = Math.abs(adjVariance) > 0 || !!(zeroDueToggle && zeroDueToggle.checked);
      const reason = adjustmentReasonEl?.value || 'Settlement Adjustment';

      if (particularsTitle) particularsTitle.textContent = `Payment for Commercial Invoice #${invNo}`;
      if (particularsSub) {
        if (Math.abs(adjVariance) > 0) {
          particularsSub.innerHTML = `Agreed Total: <strong>${formatBDT(total)}</strong> <span class="text-muted">(Orig: ${formatBDT(baseTotal)} • ${escapeHTML(reason)})</span> • Prior Collections: <strong>${formatBDT(paid)}</strong>`;
        } else {
          particularsSub.innerHTML = `Total Invoiced: <strong>${formatBDT(total)}</strong> • Prior Collections: <strong>${formatBDT(paid)}</strong>`;
        }
      }
      if (invTotalCol) invTotalCol.textContent = formatBDT(total);
      if (particularsRow) particularsRow.style.display = '';

      if (dueDesc) {
        if (zeroDueToggle && zeroDueToggle.checked) {
          dueDesc.textContent = `Settled & closed (${reason})`;
        } else if (Math.abs(adjVariance) > 0 && dueVal <= 0) {
          dueDesc.textContent = `Settled via adjusted amount (${reason})`;
        } else if (Math.abs(adjVariance) > 0) {
          const kind = adjVariance > 0 ? 'rebate' : 'surcharge';
          dueDesc.textContent = `Remaining due after ${formatBDT(Math.abs(adjVariance))} ${kind} (${reason})`;
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
        isDirty = true;
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

  receiptDateEl.value = typeof toLocalISODate === 'function' ? toLocalISODate() : new Date().toISOString().slice(0, 10);

  // Populate invoice suggestions (local + disk summaries, excluding Void)
  async function populateInvoiceList() {
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
  }
  populateInvoiceList();
  window.addEventListener('storagesync', populateInvoiceList);

  function _setSelectReasonSafe(val) {
    if (!adjustmentReasonEl || !val) return;
    const exists = Array.from(adjustmentReasonEl.options).some(o => o.value === val);
    if (!exists) {
      const opt = document.createElement('option');
      opt.value = val;
      opt.textContent = val;
      adjustmentReasonEl.appendChild(opt);
    }
    adjustmentReasonEl.value = val;
  }

  function renderInvoiceItemsRef(inv) {
    if (!receiptItemsRefEl || !receiptItemsTbodyEl) return;
    const items = (inv && inv.status !== 'Void' && Array.isArray(inv.items)) ? inv.items : [];
    if (!items.length) {
      receiptItemsTbodyEl.innerHTML = '';
      if (receiptItemsCountEl) receiptItemsCountEl.textContent = '0';
      receiptItemsRefEl.open = false;
      receiptItemsRefEl.classList.add('d-none');
      return;
    }
    if (receiptItemsCountEl) receiptItemsCountEl.textContent = String(items.length);
    receiptItemsTbodyEl.innerHTML = items.map(it => {
      const name = escapeHTML(it.name || 'Item');
      const desc = it.desc ? `<div class="text-muted" style="font-size:0.85em">${escapeHTML(it.desc)}</div>` : '';
      const qty = roundBDT(Number(it.qty || 0) || 0);
      const unit = escapeHTML(it.unit || 'Pcs');
      const price = roundBDT(Number(it.unitPrice || it.rate || 0) || 0);
      const lineTotal = roundBDT(it.total != null ? Number(it.total) : (qty * price));
      return `
        <tr>
          <td><div class="fw-semibold">${name}</div>${desc}</td>
          <td class="text-center">${escapeHTML(String(qty))}</td>
          <td class="text-center">${unit}</td>
          <td class="text-end font-monospace">${escapeHTML(formatBDT(price))}</td>
          <td class="text-end font-monospace fw-semibold">${escapeHTML(formatBDT(lineTotal))}</td>
        </tr>
      `;
    }).join('');
    receiptItemsRefEl.classList.remove('d-none');
  }

  function _resolveEffectiveInvoiceState(inv, amtEntered) {
    const invNo = inv ? (inv.invoiceNumber || inv.number || '') : '';
    const baseTotal = inv ? roundBDT(Number(inv.grandTotal || 0) || 0) : 0;
    const priorPaid = invNo ? roundBDT(getTotalPaidForInvoice(invNo, currentReceiptNumber)) : 0;
    const prevAdj = invNo ? getLatestAdjustmentForInvoice(invNo, currentReceiptNumber) : null;
    const storedTotal = (prevAdj && isFinite(Number(prevAdj.adjustedTotal)))
      ? roundBDT(Number(prevAdj.adjustedTotal))
      : baseTotal;

    let effectiveTotal = storedTotal;
    if (zeroDueToggle && zeroDueToggle.checked) {
      effectiveTotal = roundBDT(priorPaid + Math.max(0, amtEntered || 0));
    } else if (adjustedInvoiceTotalEl && !adjustedInvoiceTotalEl.disabled && adjustedInvoiceTotalEl.value.trim() !== '') {
      effectiveTotal = roundBDT(parseAmt(adjustedInvoiceTotalEl.value));
    }

    const adjVariance = roundBDT(baseTotal - effectiveTotal);
    const remainingBefore = roundBDT(Math.max(0, effectiveTotal - priorPaid));
    return { invNo, baseTotal, priorPaid, prevAdj, storedTotal, effectiveTotal, adjVariance, remainingBefore };
  }

  function applyInvoiceData(inv) {
    if (!inv) return;
    currentInvoiceFull = inv;
    if (!currentReceiptNumber && inv.billerId && typeof getBillerById === 'function') {
      const invBiller = getBillerById(inv.billerId) || inv.company;
      if (invBiller && typeof setCompanyHeader === 'function') setCompanyHeader(invBiller);
      if (receiptNumberEl) receiptNumberEl.value = peekNextReceiptNumber(inv.billerId);
    }
    if (inv.status === 'Void') {
      const invNo = inv.invoiceNumber || inv.number || '';
      if (linkedInvoiceInfoEl) {
        linkedInvoiceInfoEl.textContent = `${invNo} is VOID — Cannot accept payments`;
      }
      linkedInvoiceEl.classList.add('is-invalid');
      if (adjustedInvoiceTotalEl) {
        adjustedInvoiceTotalEl.value = '';
        adjustedInvoiceTotalEl.disabled = true;
      }
      renderInvoiceItemsRef(null);
      if (typeof showToast === 'function') showToast(`Invoice ${invNo} is Void and cannot be paid.`, 'warning');
      updateDue();
      syncReceiptPrintValues();
      return;
    }
    linkedInvoiceEl.classList.remove('is-invalid');
    clientNameEl.value = inv.client?.name || '';
    const csEl = document.getElementById('clientSelect');
    if (csEl) csEl.value = inv.client?.name || '';
    clientAddressEl.value = inv.client?.address || '';
    paymentMethodEl.value = inv.paymentMethod || 'Cash';
    if (zeroDueToggle) zeroDueToggle.checked = false;

    const st = _resolveEffectiveInvoiceState(inv, 0);
    if (adjustedInvoiceTotalEl) {
      adjustedInvoiceTotalEl.disabled = false;
      adjustedInvoiceTotalEl.value = st.storedTotal.toFixed(2);
    }
    if (adjustmentReasonEl && st.prevAdj && Math.abs(st.baseTotal - st.storedTotal) > 0 && st.prevAdj.reason && st.prevAdj.reason !== 'Adjustment Removed / Restored') {
      _setSelectReasonSafe(st.prevAdj.reason);
    } else if (adjustmentReasonEl) {
      adjustmentReasonEl.value = 'Payment Settlement Rebate';
    }
    const defaultAmt = roundBDT(Math.max(0, st.storedTotal - st.priorPaid));
    amountReceivedEl.value = String(defaultAmt);
    const amt = Math.max(0, parseAmt(amountReceivedEl.value));
    amountWordsEl.textContent = numberToWordsBDT(amt);
    if (linkedInvoiceInfoEl) {
      const totalTxt = (inv.grandTotal != null) ? formatBDT(inv.grandTotal) : '';
      linkedInvoiceInfoEl.textContent = `${inv.invoiceNumber || inv.number} • ${inv.title || ''} • ${inv.date || ''} ${totalTxt ? '• ' + totalTxt : ''}`.trim();
    }
    renderInvoiceItemsRef(inv);
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

  function resetReceiptFieldsToNew() {
    currentReceiptNumber = '';
    currentInvoiceFull = null;
    if (typeof setCompanyHeader === 'function') setCompanyHeader();
    if (receiptNumberEl) receiptNumberEl.value = peekNextReceiptNumber();
    if (receiptDateEl) receiptDateEl.value = typeof toLocalISODate === 'function' ? toLocalISODate() : new Date().toISOString().slice(0, 10);
    if (linkedInvoiceEl) {
      linkedInvoiceEl.value = '';
      linkedInvoiceEl.classList.remove('is-invalid');
    }
    if (linkedInvoiceInfoEl) linkedInvoiceInfoEl.textContent = '';
    if (adjustedInvoiceTotalEl) {
      adjustedInvoiceTotalEl.value = '';
      adjustedInvoiceTotalEl.disabled = true;
      adjustedInvoiceTotalEl.classList.remove('is-invalid');
    }
    if (adjustedInvoiceHintEl) {
      adjustedInvoiceHintEl.textContent = 'Link an invoice to edit total.';
      adjustedInvoiceHintEl.className = 'form-text small';
    }
    renderInvoiceItemsRef(null);
    const csEl = document.getElementById('clientSelect');
    if (csEl) csEl.value = '';
    if (clientNameEl) clientNameEl.value = '';
    if (clientAddressEl) clientAddressEl.value = '';
    if (paymentMethodEl) paymentMethodEl.value = 'Cash';
    if (trxRefEl) trxRefEl.value = '';
    if (amountReceivedEl) amountReceivedEl.value = '';
    if (amountWordsEl) amountWordsEl.textContent = numberToWordsBDT(0);
    if (zeroDueToggle) zeroDueToggle.checked = false;
    if (adjustmentReasonEl) {
      adjustmentReasonEl.disabled = true;
      adjustmentReasonEl.value = 'Payment Settlement Rebate';
    }
    updateModeBadge(false);
    updateDue();
    syncReceiptPrintValues();
    updateReceiptSummaryAndQR();
  }

  async function loadEditorFromParams(p, navOpts) {
    const params = p || {};
    const preselectedInv = navOpts && navOpts._selectedInvoice;
    const rcptNo = params.rcpt || params.no;

    if (rcptNo) {
      const r = getReceiptByNumber(rcptNo);
      if (r) {
        currentReceiptNumber = r.receiptNumber;
        receiptNumberEl.value = r.receiptNumber;
        receiptDateEl.value = r.date || (typeof toLocalISODate === 'function' ? toLocalISODate() : new Date().toISOString().slice(0, 10));
        linkedInvoiceEl.value = r.invoiceNumber || '';
        linkedInvoiceEl.classList.remove('is-invalid');
        if (linkedInvoiceInfoEl) linkedInvoiceInfoEl.textContent = '';
        clientNameEl.value = r.client?.name || '';
        const csEl = document.getElementById('clientSelect');
        if (csEl) csEl.value = r.client?.name || '';
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
        if (zeroDueToggle) {
          zeroDueToggle.checked = !!(r.adjustment && r.adjustment.applied && r.adjustment.method !== 'editable_total');
        }
        if (adjustmentReasonEl) {
          adjustmentReasonEl.disabled = !(r.adjustment && r.adjustment.applied);
          _setSelectReasonSafe((r.adjustment && r.adjustment.reason) || 'Payment Settlement Rebate');
        }
        if (r.invoiceNumber) {
          const inv = await fetchInvoiceByNumber(r.invoiceNumber);
          if (inv) {
            currentInvoiceFull = inv;
            renderInvoiceItemsRef(inv);
            if (linkedInvoiceInfoEl) {
              const totalTxt = (inv.grandTotal != null) ? formatBDT(inv.grandTotal) : '';
              linkedInvoiceInfoEl.textContent = `${inv.invoiceNumber || r.invoiceNumber} • ${inv.title || ''} • ${inv.date || ''} ${totalTxt ? '• ' + totalTxt : ''}`.trim();
            }
            if (adjustedInvoiceTotalEl) {
              if (inv.status === 'Void') {
                adjustedInvoiceTotalEl.value = '';
                adjustedInvoiceTotalEl.disabled = true;
              } else {
                adjustedInvoiceTotalEl.disabled = false;
                const st = _resolveEffectiveInvoiceState(inv, r.amount || 0);
                const restoredTotal = (r.adjustment && r.adjustment.applied && isFinite(Number(r.adjustment.adjustedTotal)))
                  ? roundBDT(Number(r.adjustment.adjustedTotal))
                  : st.storedTotal;
                adjustedInvoiceTotalEl.value = restoredTotal.toFixed(2);
              }
            }
          } else {
            currentInvoiceFull = null;
            renderInvoiceItemsRef(null);
            if (adjustedInvoiceTotalEl) { adjustedInvoiceTotalEl.value = ''; adjustedInvoiceTotalEl.disabled = true; }
          }
        } else {
          currentInvoiceFull = null;
          renderInvoiceItemsRef(null);
          if (adjustedInvoiceTotalEl) { adjustedInvoiceTotalEl.value = ''; adjustedInvoiceTotalEl.disabled = true; }
        }
        updateDue();
        syncReceiptPrintValues();
        updateReceiptSummaryAndQR();
      } else {
        resetReceiptFieldsToNew();
      }
    } else if (params.inv || preselectedInv) {
      resetReceiptFieldsToNew();
      const inv = preselectedInv || await fetchInvoiceByNumber(params.inv);
      if (inv) {
        linkedInvoiceEl.value = inv.invoiceNumber || inv.number || params.inv || '';
        applyInvoiceData(inv);
      } else if (params.inv) {
        linkedInvoiceEl.value = params.inv;
      }
      syncReceiptPrintValues();
    } else if (params.qtn) {
      resetReceiptFieldsToNew();
      const q = getQuotationByNumber(params.qtn);
      if (q) {
        clientNameEl.value = q.to?.company || q.to?.name || '';
        clientAddressEl.value = q.to?.address || '';
        paymentMethodEl.value = 'Cash';
        amountReceivedEl.value = String(q.grandTotal || 0);
        amountWordsEl.textContent = numberToWordsBDT(q.grandTotal || 0);
        updateDue();
        syncReceiptPrintValues();
        updateReceiptSummaryAndQR();
      }
    } else {
      resetReceiptFieldsToNew();
    }
    _lastAppliedInvNo = (linkedInvoiceEl?.value || '').trim();
    isDirty = false;
  }

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

  const debouncedUpdateReceiptSummaryAndQR = debounce(updateReceiptSummaryAndQR, 300);

  amountReceivedEl.addEventListener('input', () => {
    const amt = Math.max(0, parseAmt(amountReceivedEl.value));
    amountWordsEl.textContent = numberToWordsBDT(amt);
    updateDue();
    syncReceiptPrintValues();
    debouncedUpdateReceiptSummaryAndQR();
  });
  if (adjustedInvoiceTotalEl) {
    adjustedInvoiceTotalEl.addEventListener('input', () => {
      if (zeroDueToggle && zeroDueToggle.checked) {
        zeroDueToggle.checked = false;
      }
      const invNo = (linkedInvoiceEl?.value || '').trim();
      const inv = (invNo && typeof getInvoiceByNumber === 'function' ? getInvoiceByNumber(invNo) : null) || currentInvoiceFull;
      if (inv && adjustmentReasonEl && adjustmentReasonEl.value === 'Payment Settlement Rebate') {
        const enteredTot = roundBDT(parseAmt(adjustedInvoiceTotalEl.value));
        const baseTot = roundBDT(Number(inv.grandTotal || 0) || 0);
        if (enteredTot > baseTot) adjustmentReasonEl.value = 'Agreed Invoice Revision';
      }
      updateDue();
      syncReceiptPrintValues();
      debouncedUpdateReceiptSummaryAndQR();
    });
  }
  if (zeroDueToggle) {
    zeroDueToggle.addEventListener('change', () => {
      const invNo = (linkedInvoiceEl?.value || '').trim();
      const inv = (invNo && typeof getInvoiceByNumber === 'function' ? getInvoiceByNumber(invNo) : null) || currentInvoiceFull;
      if (zeroDueToggle.checked) {
        const ok = confirm('Zero Due by Adjustment writes off any remaining balance on this linked invoice (or records AIT/VDS withholding), recording it as adjusted. Proceed?');
        if (!ok) {
          zeroDueToggle.checked = false;
        } else if (inv && adjustedInvoiceTotalEl && !adjustedInvoiceTotalEl.disabled) {
          const priorPaid = invNo ? roundBDT(getTotalPaidForInvoice(invNo, currentReceiptNumber)) : 0;
          const enteredAmt = Math.max(0, parseAmt(amountReceivedEl.value));
          adjustedInvoiceTotalEl.value = roundBDT(priorPaid + enteredAmt).toFixed(2);
        }
      } else if (inv && adjustedInvoiceTotalEl && !adjustedInvoiceTotalEl.disabled) {
        const baseSt = _resolveEffectiveInvoiceState(inv, 0);
        adjustedInvoiceTotalEl.value = baseSt.storedTotal.toFixed(2);
      }
      updateDue();
      syncReceiptPrintValues();
    });
  }
  if (adjustmentReasonEl) {
    adjustmentReasonEl.addEventListener('change', () => {
      updateDue();
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

  _lastAppliedInvNo = (linkedInvoiceEl.value || '').trim();
  async function handleLinkedInvoiceChange(e) {
    const no = (linkedInvoiceEl.value || '').trim();
    if (e && e.type === 'blur' && no === _lastAppliedInvNo) return;
    _lastAppliedInvNo = no;
    if (!no) {
      if (linkedInvoiceInfoEl) linkedInvoiceInfoEl.textContent = '';
      linkedInvoiceEl.classList.remove('is-invalid');
      dueAmountEl.value = '';
      if (dueMsgEl) dueMsgEl.textContent = '';
      if (zeroDueToggle) zeroDueToggle.checked = false;
      if (adjustedInvoiceTotalEl) {
        adjustedInvoiceTotalEl.value = '';
        adjustedInvoiceTotalEl.disabled = true;
        adjustedInvoiceTotalEl.classList.remove('is-invalid');
      }
      if (adjustedInvoiceHintEl) {
        adjustedInvoiceHintEl.textContent = 'Link an invoice to edit total.';
        adjustedInvoiceHintEl.className = 'form-text small';
      }
      if (adjustmentReasonEl) adjustmentReasonEl.disabled = true;
      renderInvoiceItemsRef(null);
      const amt = Math.max(0, parseAmt(amountReceivedEl.value));
      amountWordsEl.textContent = numberToWordsBDT(amt);
      currentInvoiceFull = null;
      if (!currentReceiptNumber) {
        if (typeof setCompanyHeader === 'function') setCompanyHeader();
        if (receiptNumberEl) receiptNumberEl.value = peekNextReceiptNumber();
      }
      updateDue();
      syncReceiptPrintValues();
      updateReceiptSummaryAndQR();
      return;
    }
    const inv = await fetchInvoiceByNumber(no);
    if (inv) {
      applyInvoiceData(inv);
      updateReceiptSummaryAndQR();
      syncReceiptPrintValues();
    } else {
      currentInvoiceFull = null;
      renderInvoiceItemsRef(null);
      if (adjustedInvoiceTotalEl) { adjustedInvoiceTotalEl.value = ''; adjustedInvoiceTotalEl.disabled = true; }
      if (linkedInvoiceInfoEl) linkedInvoiceInfoEl.textContent = 'Invoice not found';
      linkedInvoiceEl.classList.add('is-invalid');
      updateDue();
      syncReceiptPrintValues();
    }
  }

  linkedInvoiceEl.addEventListener('change', handleLinkedInvoiceChange);
  linkedInvoiceEl.addEventListener('blur', handleLinkedInvoiceChange);
  if (pickInvoiceBtn && window.AutoInvoiceDocList && typeof window.AutoInvoiceDocList.openInvoicePicker === 'function') {
    pickInvoiceBtn.addEventListener('click', () => {
      window.AutoInvoiceDocList.openInvoicePicker({
        mode: 'receipt',
        onSelect: (inv) => {
          if (!inv) return;
          if (linkedInvoiceEl) linkedInvoiceEl.value = inv.invoiceNumber || inv.number || '';
          _lastAppliedInvNo = (linkedInvoiceEl?.value || '').trim();
          applyInvoiceData(inv);
          updateReceiptSummaryAndQR();
          syncReceiptPrintValues();
          isDirty = true;
        }
      });
    });
  }

  clientNameEl.addEventListener('input', () => {
    debouncedUpdateReceiptSummaryAndQR();
  });
  receiptDateEl.addEventListener('input', () => {
    syncReceiptPrintValues();
    debouncedUpdateReceiptSummaryAndQR();
  });

  function _resolveReceiptBiller() {
    const existingRc = currentReceiptNumber ? getReceiptByNumber(currentReceiptNumber) : null;
    const invNo = (linkedInvoiceEl?.value || '').trim();
    const linkedInvObj = currentInvoiceFull || (invNo && typeof getInvoiceByNumber === 'function' ? getInvoiceByNumber(invNo) : null);
    const bId = existingRc?.billerId || linkedInvObj?.billerId || (typeof getActiveBillerId === 'function' ? getActiveBillerId() : 'biller_default');
    const biller = (typeof getBillerById === 'function' && bId ? getBillerById(bId) : null)
      || existingRc?.company
      || (typeof getActiveBiller === 'function' ? getActiveBiller() : (typeof COMPANY !== 'undefined' ? COMPANY : {}));
    return { existingRc, bId, biller };
  }

  function buildInvoiceStyleQRForReceipt() {
    const tx = (receiptNumberEl.value || '').trim();
    const amtNum = Math.max(0, parseAmt(amountReceivedEl.value));
    const client = (clientNameEl.value || '').trim();
    const { biller } = _resolveReceiptBiller();
    return buildQRPayload('RCPT', {
      number: tx,
      date: receiptDateEl.value,
      amount: amtNum,
      client,
      company: biller.name || (typeof COMPANY !== 'undefined' ? COMPANY.name : '')
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
    if (!invNo || !inv || inv.status === 'Void') {
      if (inv && inv.status === 'Void') {
        if (dueAmountEl) dueAmountEl.value = '';
        if (dueMsgEl) {
          dueMsgEl.textContent = `Invoice ${invNo} is Void — payments are disabled.`;
          dueMsgEl.classList.remove('text-success', 'text-warning');
          dueMsgEl.classList.add('text-danger');
        }
        saveBtn.disabled = true;
      } else {
        if (dueAmountEl) dueAmountEl.value = '';
        if (dueMsgEl) { dueMsgEl.textContent = ''; dueMsgEl.classList.remove('text-success', 'text-warning', 'text-danger'); }
        amountReceivedEl.classList.toggle('is-invalid', negative);
        saveBtn.disabled = negative;
      }
      if (adjustedInvoiceTotalEl) {
        adjustedInvoiceTotalEl.value = '';
        adjustedInvoiceTotalEl.disabled = true;
        adjustedInvoiceTotalEl.classList.remove('is-invalid');
      }
      if (adjustedInvoiceHintEl) {
        adjustedInvoiceHintEl.textContent = inv && inv.status === 'Void' ? 'Void invoice cannot be adjusted.' : 'Link an invoice to edit total.';
        adjustedInvoiceHintEl.className = 'form-text small';
      }
      if (adjustmentReasonEl && !zeroDueToggle?.checked) adjustmentReasonEl.disabled = true;
      if (typeof syncReceiptPrintValues === 'function') syncReceiptPrintValues();
      return;
    }

    const entered = Math.max(0, amtEntered);
    const adjustOn = !!(zeroDueToggle && zeroDueToggle.checked);
    const st = _resolveEffectiveInvoiceState(inv, entered);
    if (adjustOn && adjustedInvoiceTotalEl && !adjustedInvoiceTotalEl.disabled) {
      adjustedInvoiceTotalEl.value = st.effectiveTotal.toFixed(2);
    }

    const invalidAdjusted = !!(adjustedInvoiceTotalEl && !adjustedInvoiceTotalEl.disabled && adjustedInvoiceTotalEl.value.trim() !== '')
      && (st.effectiveTotal < 0 || st.effectiveTotal < st.priorPaid);
    const remainingBefore = st.remainingBefore;
    const overpay = !adjustOn && !invalidAdjusted && (entered > remainingBefore);
    const prevAdjTxt = st.prevAdj ? ` • Prior Adj: ${formatBDT(st.prevAdj.amount || 0)}` : '';
    const hasAdj = adjustOn || Math.abs(st.adjVariance) > 0;

    if (adjustmentReasonEl) adjustmentReasonEl.disabled = !hasAdj;

    if (adjustedInvoiceHintEl) {
      if (invalidAdjusted) {
        adjustedInvoiceHintEl.textContent = `Cannot be less than prior payments (${formatBDT(st.priorPaid)})`;
        adjustedInvoiceHintEl.className = 'form-text small text-danger fw-semibold';
      } else if (st.adjVariance > 0) {
        adjustedInvoiceHintEl.textContent = `-${formatBDT(st.adjVariance)} rebate vs orig ${formatBDT(st.baseTotal)}`;
        adjustedInvoiceHintEl.className = 'form-text small text-warning-emphasis';
      } else if (st.adjVariance < 0) {
        adjustedInvoiceHintEl.textContent = `+${formatBDT(Math.abs(st.adjVariance))} surcharge vs orig ${formatBDT(st.baseTotal)}`;
        adjustedInvoiceHintEl.className = 'form-text small text-primary';
      } else {
        adjustedInvoiceHintEl.textContent = `Matches original ${formatBDT(st.baseTotal)}`;
        adjustedInvoiceHintEl.className = 'form-text small text-muted';
      }
    }

    if (adjustOn) {
      if (dueAmountEl) dueAmountEl.value = '0.00';
      if (dueMsgEl) {
        const reason = adjustmentReasonEl?.value || 'Settlement Rebate';
        dueMsgEl.textContent = `${reason} active • Cumulative Variance: ${formatBDT(st.adjVariance)}${prevAdjTxt}`;
        dueMsgEl.classList.remove('text-success', 'text-danger');
        dueMsgEl.classList.add('text-warning');
      }
    } else {
      const remainingAfter = invalidAdjusted ? 0 : roundBDT(Math.max(0, remainingBefore - entered));
      if (dueAmountEl) dueAmountEl.value = invalidAdjusted ? '—' : String(remainingAfter.toFixed(2));
      if (dueMsgEl) {
        const paidTxt = `Paid to date: ${formatBDT(st.priorPaid)}`;
        const beforeTxt = `Remaining before this receipt: ${formatBDT(remainingBefore)}`;
        const fullTxt = !invalidAdjusted && remainingAfter === 0 && !overpay ? ' • Paid in full' : '';
        dueMsgEl.textContent = `${paidTxt} • ${beforeTxt}${fullTxt}${prevAdjTxt}${overpay ? ' • Overpayment detected, reduce amount' : ''}`;
        dueMsgEl.classList.toggle('text-success', !invalidAdjusted && remainingAfter === 0 && !overpay);
        if (invalidAdjusted || remainingAfter !== 0 || overpay) dueMsgEl.classList.remove('text-success');
        dueMsgEl.classList.toggle('text-danger', overpay || invalidAdjusted);
        dueMsgEl.classList.remove('text-warning');
      }
    }
    if (adjustedInvoiceTotalEl) adjustedInvoiceTotalEl.classList.toggle('is-invalid', invalidAdjusted);
    amountReceivedEl.classList.toggle('is-invalid', overpay || negative);
    saveBtn.disabled = overpay || negative || invalidAdjusted;
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
    const adjustOn = !!(zeroDueToggle && zeroDueToggle.checked);
    let resolvedState = null;
    if (inv) {
      resolvedState = _resolveEffectiveInvoiceState(inv, amt);
      if (resolvedState.effectiveTotal < resolvedState.priorPaid) {
        showToast(`Agreed invoice total cannot be less than prior payments (${formatBDT(resolvedState.priorPaid)}).`, 'danger');
        if (adjustedInvoiceTotalEl) adjustedInvoiceTotalEl.classList.add('is-invalid');
        return;
      }
      if (!adjustOn && amt > resolvedState.remainingBefore) {
        showToast('Overpayment prevented. Reduce amount to remaining due or adjust Agreed Invoice Amt.', 'warning');
        return;
      }
      if (resolvedState.prevAdj) {
        const prevEff = isFinite(Number(resolvedState.prevAdj.adjustedTotal))
          ? roundBDT(Number(resolvedState.prevAdj.adjustedTotal))
          : resolvedState.baseTotal;
        if (Math.abs(roundBDT(prevEff - resolvedState.effectiveTotal)) > 0) {
          const proceed = confirm(`This invoice already has an adjustment (${formatBDT(resolvedState.prevAdj.amount || 0)}, Agreed Total ${formatBDT(prevEff)}). Update agreed total to ${formatBDT(resolvedState.effectiveTotal)}?`);
          if (!proceed) return;
        }
      }
    }
    const { existingRc, bId: activeBillerId, biller: activeBiller } = _resolveReceiptBiller();
    const companySnap = typeof slimCompanySnapshot === 'function' ? slimCompanySnapshot(activeBiller) : activeBiller;
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
      company: companySnap
    };
    if (inv && resolvedState) {
      const hasAdj = adjustOn || Math.abs(resolvedState.adjVariance) > 0;
      if (hasAdj || resolvedState.prevAdj) {
        rc.adjustment = {
          applied: true,
          reason: !hasAdj && resolvedState.prevAdj
            ? 'Adjustment Removed / Restored'
            : (adjustmentReasonEl?.value || (resolvedState.adjVariance < 0 ? 'Agreed Invoice Revision' : 'Payment Settlement Rebate')),
          amount: resolvedState.adjVariance,
          originalTotal: resolvedState.baseTotal,
          adjustedTotal: resolvedState.effectiveTotal,
          timestamp: new Date().toISOString(),
          method: adjustOn ? 'toggle' : 'editable_total'
        };
      }
    }
    saveReceipt(rc);
    finalizeReceiptNumber(rc.receiptNumber, rc.billerId);
    currentReceiptNumber = rc.receiptNumber;
    if (typeof history !== 'undefined' && history.replaceState) {
      try { history.replaceState(null, '', `?rcpt=${encodeURIComponent(rc.receiptNumber)}`); } catch (_) { }
    }
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
      prepareForPrint();
    }, () => {
      if (typeof setPrintDocumentTitle === 'function') {
        return setPrintDocumentTitle(receiptNumberEl?.value || 'Receipt', clientNameEl?.value || '');
      }
      return receiptNumberEl?.value || 'Receipt';
    });
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

  if (duplicateReceiptBtn) {
    duplicateReceiptBtn.addEventListener('click', () => {
      currentReceiptNumber = '';
      const { bId, biller } = _resolveReceiptBiller();
      if (typeof setCompanyHeader === 'function') setCompanyHeader(biller);
      const nextNo = peekNextReceiptNumber(bId);
      receiptNumberEl.value = nextNo;
      receiptDateEl.value = typeof toLocalISODate === 'function' ? toLocalISODate() : new Date().toISOString().slice(0, 10);
      isDirty = true;
      updateModeBadge(false);
      updateDue();
      syncReceiptPrintValues();
      updateReceiptSummaryAndQR();
      showToast(`Duplicated as new receipt ${nextNo}. Click Save when ready.`, 'info');
    });
  }

  if (exportReceiptBtn) {
    exportReceiptBtn.addEventListener('click', () => {
      const rcNo = (receiptNumberEl?.value || 'receipt').trim();
      const existingRc = currentReceiptNumber ? getReceiptByNumber(currentReceiptNumber) : null;
      const amt = Math.max(0, parseAmt(amountReceivedEl?.value));
      const payload = existingRc || {
        _type: 'receipt',
        receiptNumber: rcNo,
        date: receiptDateEl?.value || '',
        invoiceNumber: (linkedInvoiceEl?.value || '').trim(),
        client: { name: (clientNameEl?.value || '').trim(), address: (clientAddressEl?.value || '').trim() },
        paymentMethod: paymentMethodEl?.value || 'Cash',
        trxRef: (trxRefEl?.value || '').trim(),
        amount: amt,
        amountInWords: numberToWordsBDT(amt)
      };
      const slug = slugify(payload.client?.name || '');
      downloadJSON(`receipt_${rcNo}${slug ? '_' + slug : ''}.json`, payload);
      showToast('Receipt JSON downloaded.', 'info');
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      if (confirm('Clear all fields?')) {
        resetReceiptFieldsToNew();
        if (typeof history !== 'undefined' && window.location.search) {
          try { history.replaceState(null, '', '?new=1'); } catch (_) { }
        }
        isDirty = false;
      }
    });
  }

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

  if (window.AutoInvoiceDocList && typeof window.AutoInvoiceDocList.connectWorkspace === 'function') {
    window.AutoInvoiceDocList.connectWorkspace({
      type: 'receipt',
      getRecords: () => (typeof loadReceipts === 'function' ? loadReceipts() : []),
      loadDiskSummaries: null,
      isDirty: () => isDirty,
      resetDirty: () => { isDirty = false; },
      hasEditorParams: (p) => !!(p && (p.new === '1' || p.new === 'true' || p.no || p.rcpt || p.inv || p.qtn || p.id || p.load || p.autoprint === '1')),
      loadEditor: async (p, navOpts) => { await loadEditorFromParams(p, navOpts); },
      onEnterList: () => { currentReceiptNumber = ''; currentInvoiceFull = null; },
      onGenerateFromInvoice: async (inv, ctx) => {
        if (!inv) return;
        await ctx.openEditor({ inv: inv.invoiceNumber || inv.number }, { _selectedInvoice: inv });
      },
      onAfterMutate: (no, action) => {
        if (action === 'delete' && currentReceiptNumber === no) {
          currentReceiptNumber = '';
          currentInvoiceFull = null;
        }
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
