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
  const downloadBlankBtn = document.getElementById('downloadBlankReceiptBtn');
  const saveAndNextBlankBtn = document.getElementById('saveAndNextBlankBtn');
  const printBtn = document.getElementById('printBtn');
  const downloadCsvBtn = document.getElementById('downloadCsvBtn');
  const duplicateReceiptBtn = document.getElementById('duplicateReceiptBtn');
  const exportReceiptBtn = document.getElementById('exportReceiptBtn');
  const resetBtn = document.getElementById('resetBtn');
  const receiptQREl = document.getElementById('receiptQR');
  const blankModeToggle = document.getElementById('blankReceiptMode');
  const pendingBannerEl = document.getElementById('pendingReceiptBanner');
  const blankClientLinesEl = document.getElementById('blankClientLines');
  const clientDisplayBlockEl = document.getElementById('clientDisplayBlock');
  const receiptTableEl = document.getElementById('receiptTable') || document.getElementById('receiptItemsPrintTable');
  const receiptItemsPrintTableEl = receiptTableEl;
  const receiptItemsPrintTbodyEl = document.getElementById('receiptItemsPrintTbody');
  const receiptCustomItemsWrapEl = document.getElementById('receiptCustomItemsWrap');
  const receiptCustomItemsBodyEl = document.getElementById('receiptCustomItemsBody');
  const receiptItemListEl = document.getElementById('receiptItemList');
  const addReceiptItemBtn = document.getElementById('addReceiptItemBtn');
  const importInvItemsBtn = document.getElementById('importInvItemsBtn');
  const receiptDocFooterEl = document.getElementById('receiptDocFooter');

  let isDirty = false;
  let currentReceiptNumber = '';
  let currentInvoiceFull = null;
  let _lastAppliedInvNo = '';

  function isBlankReceiptMode() {
    return !!(blankModeToggle && blankModeToggle.checked);
  }

  function _getActiveReceiptRecord() {
    return currentReceiptNumber && typeof getReceiptByNumber === 'function'
      ? getReceiptByNumber(currentReceiptNumber)
      : null;
  }

  function populateReceiptItemDatalist() {
    if (!receiptItemListEl || typeof loadItems !== 'function') return;
    try {
      receiptItemListEl.innerHTML = '';
      (loadItems() || []).forEach(it => {
        if (!it || !it.name) return;
        const opt = document.createElement('option');
        opt.value = it.name;
        receiptItemListEl.appendChild(opt);
      });
    } catch (_) { }
  }
  populateReceiptItemDatalist();
  window.addEventListener('storagesync', populateReceiptItemDatalist);

  function getReceiptCustomItems() {
    if (!receiptCustomItemsBodyEl) return [];
    const items = [];
    receiptCustomItemsBodyEl.querySelectorAll('tr').forEach(tr => {
      const name = (tr.querySelector('.rcpt-item-name')?.value || '').trim();
      const desc = (tr.querySelector('.rcpt-item-desc')?.value || '').trim();
      if (name || desc) items.push({ name, desc });
    });
    return items;
  }

  function _updateCustomItemsVisibility() {
    if (!receiptCustomItemsWrapEl || !receiptCustomItemsBodyEl) return;
    receiptCustomItemsWrapEl.classList.toggle('d-none', receiptCustomItemsBodyEl.children.length === 0);
  }

  function addReceiptItemRow(item = {}) {
    if (!receiptCustomItemsBodyEl) return;
    const tr = document.createElement('tr');
    const rowIdx = receiptCustomItemsBodyEl.children.length + 1;
    tr.innerHTML = `
      <td style="width: 44%;">
        <input type="text" class="form-control form-control-sm rcpt-item-name" list="receiptItemList" placeholder="Item / Service name" aria-label="Receipt item name, row ${rowIdx}" value="${escapeAttr(item.name || '')}" />
      </td>
      <td>
        <input type="text" class="form-control form-control-sm rcpt-item-desc" placeholder="Optional details / qty" aria-label="Receipt item details, row ${rowIdx}" value="${escapeAttr(item.desc || '')}" />
      </td>
      <td style="width: 1%;" class="text-end">
        <button type="button" class="btn btn-sm btn-outline-danger rcpt-item-del" aria-label="Remove item row ${rowIdx}">&times;</button>
      </td>
    `;
    const nameInput = tr.querySelector('.rcpt-item-name');
    const descInput = tr.querySelector('.rcpt-item-desc');
    const delBtn = tr.querySelector('.rcpt-item-del');
    const onEdit = () => {
      isDirty = true;
      renderReceiptItemsPrintTable();
    };
    if (nameInput) {
      nameInput.addEventListener('input', onEdit);
      nameInput.addEventListener('change', () => {
        if (descInput && !descInput.value.trim() && typeof getItemByName === 'function') {
          const matched = getItemByName(nameInput.value);
          if (matched && matched.desc) descInput.value = matched.desc;
        }
        onEdit();
      });
    }
    if (descInput) descInput.addEventListener('input', onEdit);
    if (delBtn) {
      delBtn.addEventListener('click', () => {
        tr.remove();
        isDirty = true;
        _updateCustomItemsVisibility();
        renderReceiptItemsPrintTable();
      });
    }
    receiptCustomItemsBodyEl.appendChild(tr);
    _updateCustomItemsVisibility();
    renderReceiptItemsPrintTable();
  }

  function clearReceiptCustomItems() {
    if (!receiptCustomItemsBodyEl) return;
    receiptCustomItemsBodyEl.innerHTML = '';
    _updateCustomItemsVisibility();
  }

  function _setReceiptTableColumns(hasItems) {
    const thNo = document.getElementById('receiptThNo');
    const thPart = document.getElementById('receiptThParticulars');
    const partCell = document.getElementById('receiptParticularsCell');
    const amtCell = document.getElementById('receiptAmountCell');
    const dueCell = document.getElementById('receiptDueCell');
    const tbodyItems = document.getElementById('receiptItemsPrintTbody');

    if (thNo) thNo.style.display = hasItems ? '' : 'none';
    if (thPart) thPart.textContent = hasItems ? 'Item Name / Particulars' : 'Description / Payment Particulars';
    if (partCell) partCell.colSpan = hasItems ? 2 : 1;
    if (amtCell) amtCell.colSpan = hasItems ? 2 : 1;
    if (dueCell) dueCell.colSpan = hasItems ? 2 : 1;
    if (tbodyItems) tbodyItems.style.display = hasItems ? '' : 'none';
  }

  function renderReceiptItemsPrintTable() {
    if (!receiptItemsPrintTbodyEl) return;
    const isBlank = isBlankReceiptMode();
    const customItems = getReceiptCustomItems();
    const invItems = (!customItems.length && isBlank && currentInvoiceFull && currentInvoiceFull.status !== 'Void' && Array.isArray(currentInvoiceFull.items))
      ? currentInvoiceFull.items.filter(it => it && (it.name || it.desc))
      : [];
    const itemsToShow = customItems.length ? customItems : invItems;

    if (itemsToShow.length > 0) {
      const rowsHtml = itemsToShow.map((it, idx) => {
        const name = escapeHTML(it.name || 'Item');
        const desc = it.desc ? `<div class="small text-muted">${escapeHTML(it.desc)}</div>` : '';
        const amtCell = isBlank ? '<span class="blank-amt-line" style="min-width: 75px;"></span>' : '<span class="text-muted">—</span>';
        return `
          <tr>
            <td class="text-center text-muted rcpt-col-no">${idx + 1}</td>
            <td class="rcpt-col-particulars"><div class="fw-semibold">${name}</div>${desc}</td>
            <td class="text-end font-monospace rcpt-col-amount">${amtCell}</td>
          </tr>
        `;
      }).join('');
      receiptItemsPrintTbodyEl.innerHTML = rowsHtml;
      _setReceiptTableColumns(true);
      return;
    }

    if (isBlank) {
      let blankRows = '';
      for (let i = 1; i <= 4; i++) {
        blankRows += `
          <tr class="blank-filler-row">
            <td class="text-center text-muted rcpt-col-no">${i}</td>
            <td class="rcpt-col-particulars">&nbsp;</td>
            <td class="text-end rcpt-col-amount">&nbsp;</td>
          </tr>
        `;
      }
      receiptItemsPrintTbodyEl.innerHTML = blankRows;
      _setReceiptTableColumns(true);
      return;
    }

    receiptItemsPrintTbodyEl.innerHTML = '';
    _setReceiptTableColumns(false);
  }

  function parseAmt(str) {
    const raw = String(str || '').trim().replace(/,/g, '');
    if (!raw) return 0;
    const neg = /^-/.test(raw);
    const num = parseFloat(raw.replace(/[^0-9.]/g, ''));
    if (!isFinite(num)) return 0;
    return roundBDT(neg ? -num : num);
  }

  const modeBadgeEl = document.getElementById('modeBadge');
  function updateModeBadge(isEditing, docNo, isPending = false) {
    if (!modeBadgeEl) return;
    if (isEditing && isPending) {
      modeBadgeEl.innerHTML = `<span class="badge bg-info text-dark fs-6 px-3 py-2 shadow-sm">⏳ Pending Receipt: ${escapeHTML(docNo)}</span>`;
    } else if (isEditing) {
      modeBadgeEl.innerHTML = `<span class="badge bg-primary fs-6 px-3 py-2 shadow-sm">📝 Editing Receipt: ${escapeHTML(docNo)}</span>`;
    } else if (isBlankReceiptMode()) {
      modeBadgeEl.innerHTML = `<span class="badge bg-info text-dark fs-6 px-3 py-2 shadow-sm">📝 Blank / Pending Receipt</span>`;
    } else {
      modeBadgeEl.innerHTML = `<span class="badge bg-success fs-6 px-3 py-2 shadow-sm">✨ New Receipt</span>`;
    }
    if (pendingBannerEl) {
      pendingBannerEl.classList.toggle('d-none', !(isEditing && isPending));
    }
  }

  // Client Display Synchronization
  function syncClientDisplay() {
    const name = (clientNameEl?.value || '').trim();
    const addr = (clientAddressEl?.value || '').trim();
    const isBlank = isBlankReceiptMode();
    const useBlankLines = isBlank && !name;
    if (clientDisplayBlockEl) clientDisplayBlockEl.classList.toggle('d-none', useBlankLines);
    if (blankClientLinesEl) blankClientLinesEl.classList.toggle('d-none', !useBlankLines);

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

    const isBlank = isBlankReceiptMode();
    const printArea = document.getElementById('printArea');
    if (printArea) printArea.classList.toggle('blank-doc-mode', isBlank);
    renderReceiptItemsPrintTable();

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
      if (isBlank && !receiptDateEl.value) {
        rcptDatePrint.innerHTML = '<span class="blank-amt-line"></span>';
      } else {
        rcptDatePrint.textContent = typeof formatDisplayDate === 'function' ? formatDisplayDate(receiptDateEl.value) : receiptDateEl.value;
      }
    }
    const methodVal = paymentMethodEl ? paymentMethodEl.value : 'Cash';
    const trxVal = (trxRefEl?.value || '').trim();
    if (payMethodPrint) {
      if (isBlank && !methodVal) {
        payMethodPrint.innerHTML = '<span class="blank-amt-line"></span>';
      } else {
        payMethodPrint.textContent = methodVal || 'Cash';
      }
    }
    if (trxRefPrint) {
      if (isBlank && !trxVal) {
        trxRefPrint.innerHTML = '<span class="blank-amt-line"></span>';
      } else {
        trxRefPrint.textContent = trxVal || '—';
      }
    }
    if (payModeDesc) {
      if (isBlank && !methodVal) {
        const refSuffix = trxVal ? ` • Ref: ${escapeHTML(trxVal)}` : '';
        payModeDesc.innerHTML = `Payment Method: <span class="blank-amt-line" style="min-width: 90px;" aria-hidden="true"></span>${refSuffix}`;
      } else {
        const effMethod = methodVal || 'Cash';
        payModeDesc.textContent = trxVal ? `Received via ${effMethod} • Ref: ${trxVal}` : `Received via ${effMethod}`;
      }
    }

    const invNo = (linkedInvoiceEl?.value || '').trim();
    if (linkInvPrint) {
      if (isBlank && !invNo) {
        linkInvPrint.innerHTML = '<span class="blank-amt-line"></span>';
      } else {
        linkInvPrint.textContent = invNo || '— (Direct Payment)';
      }
    }

    const amtNum = Math.max(0, parseAmt(amountReceivedEl?.value));
    const showBlankAmount = isBlank && amtNum === 0;
    if (amtReceivedDisp) {
      if (showBlankAmount) {
        amtReceivedDisp.innerHTML = '৳ <span class="blank-amt-line"></span>';
      } else {
        amtReceivedDisp.textContent = formatBDT(amtNum);
      }
    }
    if (amountWordsEl) {
      if (showBlankAmount) {
        amountWordsEl.innerHTML = '<span class="blank-words-line"></span><span class="blank-words-line"></span>';
      } else {
        amountWordsEl.textContent = numberToWordsBDT(amtNum);
      }
    }

    if (receiptDocFooterEl) {
      receiptDocFooterEl.textContent = isBlank
        ? 'Blank / Provisional Money Receipt — Amount and signature to be completed upon payment collection.'
        : 'Thank you for your payment. This is a computer-generated money receipt.';
    }

    const existingRc = _getActiveReceiptRecord();
    const isEditingPending = !!(existingRc && (existingRc.status === 'Pending' || existingRc.amountPending));
    if (saveAndNextBlankBtn) {
      saveAndNextBlankBtn.classList.toggle('d-none', !isBlank);
    }
    if (saveBtn) {
      if (isBlank) saveBtn.textContent = '💾 Save Pending Receipt';
      else if (isEditingPending) saveBtn.textContent = '✅ Complete & Save Receipt';
      else saveBtn.textContent = 'Save Receipt';
    }

    if (invNo) {
      const inv = getInvoiceByNumber(invNo) || currentInvoiceFull;
      const isPendingInv = !!(inv && (inv.status === 'Pending' || inv.amountPending));
      const stats = getInvoicePaymentStats(inv || invNo, currentReceiptNumber);
      const baseTotal = inv && inv.grandTotal != null ? roundBDT(inv.grandTotal) : (stats ? stats.originalTotal || stats.total : 0);
      const liveAdjusted = (adjustedInvoiceTotalEl && !adjustedInvoiceTotalEl.disabled && adjustedInvoiceTotalEl.value.trim() !== '')
        ? roundBDT(parseAmt(adjustedInvoiceTotalEl.value))
        : ((stats && stats.status !== 'Unknown') ? stats.total : baseTotal);
      const total = Math.max(0, liveAdjusted);
      const paid = stats ? stats.paid : 0;
      const dueVal = parseAmt(dueAmountEl?.value);
      const adjVariance = roundBDT(baseTotal - total);
      const reason = adjustmentReasonEl?.value || 'Settlement Adjustment';

      if (particularsTitle) particularsTitle.textContent = `Payment for Commercial Invoice #${invNo}`;
      if (particularsSub) {
        if (isPendingInv && total === 0) {
          particularsSub.textContent = 'Linked invoice amount pending — enter agreed/received amount upon settlement';
        } else if (Math.abs(adjVariance) > 0) {
          particularsSub.innerHTML = `Agreed Total: <strong>${formatBDT(total)}</strong> <span class="text-muted">(Orig: ${formatBDT(baseTotal)} • ${escapeHTML(reason)})</span> • Prior Collections: <strong>${formatBDT(paid)}</strong>`;
        } else {
          particularsSub.innerHTML = `Total Invoiced: <strong>${formatBDT(total)}</strong> • Prior Collections: <strong>${formatBDT(paid)}</strong>`;
        }
      }
      if (invTotalCol) {
        invTotalCol.innerHTML = (isBlank && total === 0) ? '৳ <span class="blank-amt-line" style="min-width:85px;"></span>' : formatBDT(total);
      }
      if (particularsRow) particularsRow.style.display = '';

      if (dueDesc) {
        if (showBlankAmount) {
          dueDesc.textContent = 'Remaining balance to be calculated upon payment';
        } else if (zeroDueToggle && zeroDueToggle.checked) {
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
        } else if (showBlankAmount) {
          dueAmtDisp.innerHTML = '৳ <span class="blank-amt-line" style="min-width:85px;"></span>';
          dueAmtDisp.className = 'fw-bold font-monospace';
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
      if (particularsSub) particularsSub.textContent = isBlank ? 'Blank / Fill-later official receipt' : 'Non-invoiced receipt / Direct cash receipt';
      if (invTotalCol) {
        invTotalCol.innerHTML = showBlankAmount ? '৳ <span class="blank-amt-line" style="min-width:85px;"></span>' : formatBDT(amtNum);
      }
      if (particularsRow) particularsRow.style.display = isBlank ? 'none' : '';
      if (dueDesc) dueDesc.textContent = 'Outstanding balance after this receipt';
      if (dueAmtDisp) {
        if (showBlankAmount) {
          dueAmtDisp.innerHTML = '৳ <span class="blank-amt-line" style="min-width:85px;"></span>';
          dueAmtDisp.className = 'fw-bold font-monospace';
        } else {
          dueAmtDisp.textContent = '৳0.00';
          dueAmtDisp.className = 'fw-bold font-monospace';
        }
      }
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
    if (importInvItemsBtn) {
      const hasInvItems = !!(inv && inv.status !== 'Void' && Array.isArray(inv.items) && inv.items.length);
      importInvItemsBtn.classList.toggle('d-none', !hasInvItems);
    }
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
    paymentMethodEl.value = inv.paymentMethod || (isBlankReceiptMode() ? '' : 'Cash');
    if (zeroDueToggle) zeroDueToggle.checked = false;

    const isPendingInv = !!(inv.status === 'Pending' || inv.amountPending);
    const st = _resolveEffectiveInvoiceState(inv, 0);
    if (adjustedInvoiceTotalEl) {
      adjustedInvoiceTotalEl.disabled = isPendingInv;
      adjustedInvoiceTotalEl.value = isPendingInv ? '' : st.storedTotal.toFixed(2);
    }
    if (adjustmentReasonEl && st.prevAdj && Math.abs(st.baseTotal - st.storedTotal) > 0 && st.prevAdj.reason && st.prevAdj.reason !== 'Adjustment Removed / Restored') {
      _setSelectReasonSafe(st.prevAdj.reason);
    } else if (adjustmentReasonEl) {
      adjustmentReasonEl.value = 'Payment Settlement Rebate';
    }
    if (isBlankReceiptMode() || isPendingInv) {
      amountReceivedEl.value = '';
      amountWordsEl.textContent = '';
    } else {
      const defaultAmt = roundBDT(Math.max(0, st.storedTotal - st.priorPaid));
      amountReceivedEl.value = String(defaultAmt);
      const amt = Math.max(0, parseAmt(amountReceivedEl.value));
      amountWordsEl.textContent = numberToWordsBDT(amt);
    }
    if (linkedInvoiceInfoEl) {
      const totalTxt = isPendingInv ? 'Pending Amount' : ((inv.grandTotal != null) ? formatBDT(inv.grandTotal) : '');
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

  function resetReceiptFieldsToNew(options = {}) {
    const asBlank = !!options.blank;
    currentReceiptNumber = '';
    currentInvoiceFull = null;
    _lastAppliedInvNo = '';
    if (blankModeToggle) blankModeToggle.checked = asBlank;
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
    clearReceiptCustomItems();
    const csEl = document.getElementById('clientSelect');
    if (csEl) csEl.value = '';
    if (clientNameEl) clientNameEl.value = '';
    if (clientAddressEl) clientAddressEl.value = '';
    if (paymentMethodEl) paymentMethodEl.value = asBlank ? '' : 'Cash';
    if (trxRefEl) trxRefEl.value = '';
    if (amountReceivedEl) amountReceivedEl.value = '';
    if (amountWordsEl) amountWordsEl.textContent = asBlank ? '' : numberToWordsBDT(0);
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
    const isBlankParam = params.blank === '1' || params.blank === 'true';

    if (rcptNo) {
      const r = getReceiptByNumber(rcptNo);
      if (r) {
        const isPendingRc = !!(r.status === 'Pending' || r.amountPending);
        currentReceiptNumber = r.receiptNumber;
        if (blankModeToggle) blankModeToggle.checked = isPendingRc;
        receiptNumberEl.value = r.receiptNumber;
        receiptDateEl.value = isPendingRc ? (r.date || '') : (r.date || (typeof toLocalISODate === 'function' ? toLocalISODate() : new Date().toISOString().slice(0, 10)));
        linkedInvoiceEl.value = r.invoiceNumber || '';
        linkedInvoiceEl.classList.remove('is-invalid');
        if (linkedInvoiceInfoEl) linkedInvoiceInfoEl.textContent = '';
        clientNameEl.value = r.client?.name || '';
        const csEl = document.getElementById('clientSelect');
        if (csEl) csEl.value = r.client?.name || '';
        clientAddressEl.value = r.client?.address || '';
        paymentMethodEl.value = r.paymentMethod != null ? r.paymentMethod : (isPendingRc ? '' : 'Cash');
        if (trxRefEl) trxRefEl.value = r.trxRef || '';
        clearReceiptCustomItems();
        if (Array.isArray(r.items)) {
          r.items.forEach(it => addReceiptItemRow(it));
        }
        amountReceivedEl.value = isPendingRc ? '' : String(r.amount || 0);
        amountWordsEl.textContent = isPendingRc ? '' : numberToWordsBDT(r.amount || 0);
        updateModeBadge(true, r.receiptNumber, isPendingRc);
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
              if (inv.status === 'Void' || inv.status === 'Pending' || inv.amountPending) {
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
      resetReceiptFieldsToNew({ blank: isBlankParam });
      const inv = preselectedInv || await fetchInvoiceByNumber(params.inv);
      if (inv) {
        linkedInvoiceEl.value = inv.invoiceNumber || inv.number || params.inv || '';
        applyInvoiceData(inv);
      } else if (params.inv) {
        linkedInvoiceEl.value = params.inv;
      }
      syncReceiptPrintValues();
    } else if (params.qtn) {
      resetReceiptFieldsToNew({ blank: isBlankParam });
      const q = getQuotationByNumber(params.qtn);
      if (q) {
        clientNameEl.value = q.to?.company || q.to?.name || '';
        clientAddressEl.value = q.to?.address || '';
        paymentMethodEl.value = isBlankParam ? '' : 'Cash';
        if (!isBlankParam) {
          amountReceivedEl.value = String(q.grandTotal || 0);
          amountWordsEl.textContent = numberToWordsBDT(q.grandTotal || 0);
        }
        updateDue();
        syncReceiptPrintValues();
        updateReceiptSummaryAndQR();
      }
    } else {
      resetReceiptFieldsToNew({ blank: isBlankParam });
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
    if (amt > 0 && blankModeToggle && blankModeToggle.checked) {
      blankModeToggle.checked = false;
      if (paymentMethodEl && !paymentMethodEl.value) paymentMethodEl.value = 'Cash';
      const activeRc = _getActiveReceiptRecord();
      updateModeBadge(!!currentReceiptNumber, currentReceiptNumber, !!(activeRc && (activeRc.status === 'Pending' || activeRc.amountPending)));
    }
    amountWordsEl.textContent = numberToWordsBDT(amt);
    updateDue();
    syncReceiptPrintValues();
    debouncedUpdateReceiptSummaryAndQR();
  });

  if (blankModeToggle) {
    blankModeToggle.addEventListener('change', () => {
      if (blankModeToggle.checked) {
        if (parseAmt(amountReceivedEl?.value) > 0) {
          if (!confirm('Switching to Blank / Fill-Later Mode will clear Amount Received so the receipt stays blank. Proceed?')) {
            blankModeToggle.checked = false;
            return;
          }
          amountReceivedEl.value = '';
          if (zeroDueToggle) zeroDueToggle.checked = false;
        }
        if (paymentMethodEl && paymentMethodEl.value === 'Cash') paymentMethodEl.value = '';
      } else if (paymentMethodEl && !paymentMethodEl.value) {
        paymentMethodEl.value = 'Cash';
      }
      isDirty = true;
      const activeRc = _getActiveReceiptRecord();
      updateModeBadge(!!currentReceiptNumber, currentReceiptNumber, !!(activeRc && (activeRc.status === 'Pending' || activeRc.amountPending)));
      updateDue();
      syncReceiptPrintValues();
      updateReceiptSummaryAndQR();
    });
  }

  if (addReceiptItemBtn) {
    addReceiptItemBtn.addEventListener('click', () => {
      addReceiptItemRow({});
      isDirty = true;
    });
  }

  if (importInvItemsBtn) {
    importInvItemsBtn.addEventListener('click', () => {
      if (!currentInvoiceFull || !Array.isArray(currentInvoiceFull.items)) return;
      const existingNames = new Set(getReceiptCustomItems().map(it => `${it.name}||${it.desc}`.toLowerCase()));
      let added = 0;
      currentInvoiceFull.items.forEach(it => {
        if (!it || (!it.name && !it.desc)) return;
        const k = `${(it.name || '').trim()}||${(it.desc || '').trim()}`.toLowerCase();
        if (!existingNames.has(k)) {
          addReceiptItemRow({ name: it.name || '', desc: it.desc || '' });
          existingNames.add(k);
          added++;
        }
      });
      if (added > 0) {
        isDirty = true;
        if (typeof showToast === 'function') showToast(`Imported ${added} item(s) from invoice.`, 'info');
      } else if (typeof showToast === 'function') {
        showToast('All invoice items are already listed.', 'info');
      }
    });
  }
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
    const isBlank = isBlankReceiptMode();
    const amtNum = isBlank ? 0 : Math.max(0, parseAmt(amountReceivedEl.value));
    const client = (clientNameEl.value || '').trim();
    const { biller } = _resolveReceiptBiller();
    return buildQRPayload('RCPT', {
      number: tx,
      date: receiptDateEl.value,
      amount: amtNum,
      pending: isBlank,
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
    const isBlank = isBlankReceiptMode();
    const inv = (invNo ? getInvoiceByNumber(invNo) : null) || (currentInvoiceFull && (currentInvoiceFull.invoiceNumber === invNo || currentInvoiceFull.number === invNo) ? currentInvoiceFull : null);
    const isPendingInv = !!(inv && (inv.status === 'Pending' || inv.amountPending));
    if (!invNo || !inv || inv.status === 'Void' || isPendingInv) {
      if (inv && inv.status === 'Void') {
        if (dueAmountEl) dueAmountEl.value = '';
        if (dueMsgEl) {
          dueMsgEl.textContent = `Invoice ${invNo} is Void — payments are disabled.`;
          dueMsgEl.classList.remove('text-success', 'text-warning');
          dueMsgEl.classList.add('text-danger');
        }
        saveBtn.disabled = true;
      } else if (isPendingInv) {
        if (dueAmountEl) dueAmountEl.value = '';
        if (dueMsgEl) {
          dueMsgEl.textContent = isBlank
            ? `Linked invoice ${invNo} is Pending Amount — receipt will also be saved as Pending.`
            : `Linked invoice ${invNo} is Pending Amount — finalize invoice amounts first before collecting payment.`;
          dueMsgEl.classList.remove('text-success', isBlank ? 'text-danger' : 'text-warning');
          dueMsgEl.classList.add(isBlank ? 'text-warning' : 'text-danger');
        }
        amountReceivedEl.classList.toggle('is-invalid', negative || (!isBlank && amtEntered > 0));
        saveBtn.disabled = !isBlank || negative;
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
        adjustedInvoiceHintEl.textContent = inv && inv.status === 'Void'
          ? 'Void invoice cannot be adjusted.'
          : (isPendingInv ? 'Linked invoice is Pending — finalize invoice amounts first.' : 'Link an invoice to edit total.');
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

  async function saveReceiptRecord(opts = {}) {
    const invNo = (linkedInvoiceEl.value || '').trim();
    let inv = invNo ? getInvoiceByNumber(invNo) : null;
    if (!inv && invNo) { inv = await fetchInvoiceByNumber(invNo); }
    if (inv && inv.status === 'Void') {
      showToast(`Invoice ${invNo} is Void and cannot accept payments.`, 'danger');
      return null;
    }
    const amt = parseAmt(amountReceivedEl.value);
    if (amt < 0) {
      showToast('Amount cannot be negative.', 'danger');
      amountReceivedEl.classList.add('is-invalid');
      return null;
    }
    const adjustOn = !!(zeroDueToggle && zeroDueToggle.checked);
    let resolvedState = null;
    const isPendingSave = !!(opts && opts.forcePending) || isBlankReceiptMode();
    if (!isPendingSave) {
      if (inv && (inv.status === 'Pending' || inv.amountPending)) {
        showToast(`Linked invoice ${invNo} is still Pending Amount. Finalize the invoice amounts first before completing this receipt.`, 'warning');
        return null;
      }
      if (!clientNameEl.value.trim()) {
        showToast('Client / Company Name is required (or enable Blank Mode to save as Pending).', 'warning');
        return null;
      }
      if (amt <= 0) {
        showToast('Enter Amount Received > 0 (or enable Blank Mode to save as Pending).', 'warning');
        amountReceivedEl.classList.add('is-invalid');
        return null;
      }
    }
    if (inv && !isPendingSave) {
      resolvedState = _resolveEffectiveInvoiceState(inv, amt);
      if (resolvedState.effectiveTotal < resolvedState.priorPaid) {
        showToast(`Agreed invoice total cannot be less than prior payments (${formatBDT(resolvedState.priorPaid)}).`, 'danger');
        if (adjustedInvoiceTotalEl) adjustedInvoiceTotalEl.classList.add('is-invalid');
        return null;
      }
      if (!adjustOn && amt > resolvedState.remainingBefore) {
        showToast('Overpayment prevented. Reduce amount to remaining due or adjust Agreed Invoice Amt.', 'warning');
        return null;
      }
      if (resolvedState.prevAdj) {
        const prevEff = isFinite(Number(resolvedState.prevAdj.adjustedTotal))
          ? roundBDT(Number(resolvedState.prevAdj.adjustedTotal))
          : resolvedState.baseTotal;
        if (Math.abs(roundBDT(prevEff - resolvedState.effectiveTotal)) > 0) {
          const proceed = confirm(`This invoice already has an adjustment (${formatBDT(resolvedState.prevAdj.amount || 0)}, Agreed Total ${formatBDT(prevEff)}). Update agreed total to ${formatBDT(resolvedState.effectiveTotal)}?`);
          if (!proceed) return null;
        }
      }
    }
    const { existingRc, bId: activeBillerId, biller: activeBiller } = _resolveReceiptBiller();
    if (!isPendingSave && paymentMethodEl && !paymentMethodEl.value) {
      paymentMethodEl.value = 'Cash';
    }
    const effectiveAmt = isPendingSave ? 0 : amt;
    const companySnap = typeof slimCompanySnapshot === 'function' ? slimCompanySnapshot(activeBiller) : activeBiller;
    if (!receiptNumberEl.value) {
      receiptNumberEl.value = peekNextReceiptNumber(activeBillerId);
    }
    const qrData = buildInvoiceStyleQRForReceipt();
    const rc = {
      id: existingRc?.id,
      createdAt: existingRc?.createdAt,
      status: existingRc?.status === 'Void' ? 'Void' : (isPendingSave ? 'Pending' : 'Saved'),
      amountPending: isPendingSave,
      _type: 'receipt',
      billerId: activeBillerId,
      receiptNumber: receiptNumberEl.value,
      date: receiptDateEl.value,
      invoiceNumber: linkedInvoiceEl.value,
      client: { name: clientNameEl.value.trim(), address: clientAddressEl.value.trim() },
      paymentMethod: isPendingSave ? (paymentMethodEl.value || '') : (paymentMethodEl.value || 'Cash'),
      trxRef: (trxRefEl?.value || '').trim(),
      items: getReceiptCustomItems(),
      amount: effectiveAmt,
      amountInWords: isPendingSave ? '' : numberToWordsBDT(effectiveAmt),
      qrData,
      company: companySnap
    };
    if (!isPendingSave && inv && resolvedState) {
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
    updateModeBadge(true, rc.receiptNumber, isPendingSave);
    if (clientOnboarding && rc.client?.name) clientOnboarding.refresh(rc.client.name);
    if (!opts || !opts.silent) {
      showToast(isPendingSave ? `Pending receipt ${rc.receiptNumber} saved & number locked.` : 'Receipt saved successfully.', 'success');
    }
    updateDue();
    syncReceiptPrintValues();
    updateReceiptSummaryAndQR();
    return rc;
  }

  saveBtn.addEventListener('click', () => saveReceiptRecord({}));

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
      const base = setPrintDocumentTitle(receiptNumberEl?.value || 'Receipt', clientNameEl?.value || '');
      if (isBlankReceiptMode()) document.title = `${base}_Blank`;
    }
  });

  async function printWithGuard() {
    if (isBlankReceiptMode()) {
      const saved = await saveReceiptRecord({ forcePending: true, silent: true });
      if (saved && typeof showToast === 'function') {
        showToast(`Reserved ${saved.receiptNumber} as Pending Amount before printing.`, 'info');
      }
    }
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

  if (downloadBlankBtn) {
    downloadBlankBtn.addEventListener('click', async () => {
      const invNo = (linkedInvoiceEl?.value || '').trim();
      const linkedInv = invNo ? (getInvoiceByNumber(invNo) || await fetchInvoiceByNumber(invNo)) : null;
      if (linkedInv && linkedInv.status === 'Void') {
        showToast(`Invoice ${invNo} is Void and cannot accept payments.`, 'danger');
        return;
      }
      const existingRc = _getActiveReceiptRecord();
      const isFinalizedExisting = !!(existingRc && existingRc.status !== 'Pending' && !existingRc.amountPending);
      if (isFinalizedExisting) {
        if (!confirm(`Receipt ${existingRc.receiptNumber} is already finalized. Create a NEW blank receipt with a fresh unique number instead (keeping selected client & item names)?`)) {
          return;
        }
        const { bId } = _resolveReceiptBiller();
        currentReceiptNumber = '';
        if (receiptNumberEl) receiptNumberEl.value = peekNextReceiptNumber(bId);
        if (amountReceivedEl) amountReceivedEl.value = '';
        if (zeroDueToggle) zeroDueToggle.checked = false;
      } else if (parseAmt(amountReceivedEl?.value) > 0) {
        if (!confirm('Amount Received is currently filled. Clear amount and download as a Blank / Pending receipt?')) {
          return;
        }
        amountReceivedEl.value = '';
        if (zeroDueToggle) zeroDueToggle.checked = false;
      }
      if (blankModeToggle) blankModeToggle.checked = true;
      if (paymentMethodEl && paymentMethodEl.value === 'Cash') paymentMethodEl.value = '';
      const saved = await saveReceiptRecord({ forcePending: true, silent: true });
      if (!saved) return;
      if (typeof showToast === 'function') {
        showToast(`Reserved ${saved.receiptNumber} as Pending Amount. Reopen later to enter received amount.`, 'info');
      }
      const getBlankFilename = () => (typeof setPrintDocumentTitle === 'function'
        ? `${setPrintDocumentTitle(receiptNumberEl?.value || 'Receipt', clientNameEl?.value || '')}_Blank`
        : `${receiptNumberEl?.value || 'Receipt'}_Blank`);
      if (typeof downloadRenderedPdf === 'function') {
        await downloadRenderedPdf(prepareForPrint, getBlankFilename, downloadBlankBtn);
      } else {
        printWithGuard();
      }
    });
  }
  if (saveAndNextBlankBtn) {
    saveAndNextBlankBtn.addEventListener('click', async () => {
      if (!isBlankReceiptMode()) return;
      const saved = await saveReceiptRecord({ forcePending: true, silent: true });
      if (!saved) return;
      resetReceiptFieldsToNew({ blank: true });
      if (typeof history !== 'undefined' && history.replaceState) {
        try { history.replaceState(null, '', '?new=1&blank=1'); } catch (_) { }
      }
      updateModeBadge(false);
      updateDue();
      syncReceiptPrintValues();
      updateReceiptSummaryAndQR();
      isDirty = false;
      if (typeof showToast === 'function') {
        showToast(`Reserved ${saved.receiptNumber} — ready for next blank ${receiptNumberEl?.value || ''}.`, 'success');
      }
    });
  }

  if (typeof initPdfDownloadButton === 'function') {
    initPdfDownloadButton('downloadPdfBtn', async () => {
      if (isBlankReceiptMode()) {
        await saveReceiptRecord({ forcePending: true, silent: true });
      }
      prepareForPrint();
    }, () => {
      const base = typeof setPrintDocumentTitle === 'function'
        ? setPrintDocumentTitle(receiptNumberEl?.value || 'Receipt', clientNameEl?.value || '')
        : (receiptNumberEl?.value || 'Receipt');
      return isBlankReceiptMode() ? `${base}_Blank` : base;
    });
  }

  initSaveShortcut(saveBtn);

  downloadCsvBtn.addEventListener('click', () => {
    const isBlank = isBlankReceiptMode();
    const itemsList = getReceiptCustomItems().map(it => it.desc ? `${it.name} (${it.desc})` : it.name).filter(Boolean).join('; ');
    const rows = [
      ['Receipt Number', receiptNumberEl.value],
      ['Status', isBlank ? 'Pending Amount' : 'Saved'],
      ['Date', receiptDateEl.value],
      ['Invoice Number', linkedInvoiceEl.value],
      ['Client Name', clientNameEl.value],
      ['Client Address', clientAddressEl.value],
      ['Payment Method', paymentMethodEl.value],
      ['Transaction / Cheque Ref', trxRefEl?.value || ''],
      ['Items', itemsList],
      ['Amount', isBlank ? 'Pending' : String(Math.max(0, parseAmt(amountReceivedEl.value)))]
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
      if (zeroDueToggle) zeroDueToggle.checked = false;
      if (blankModeToggle) blankModeToggle.checked = false;
      if (paymentMethodEl && !paymentMethodEl.value) paymentMethodEl.value = 'Cash';
      if (typeof history !== 'undefined' && history.replaceState) {
        try { history.replaceState(null, '', '?new=1'); } catch (_) { }
      }
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
      const isBlank = isBlankReceiptMode();
      const amt = isBlank ? 0 : Math.max(0, parseAmt(amountReceivedEl?.value));
      const payload = {
        ...(existingRc || {}),
        _type: 'receipt',
        status: existingRc?.status === 'Void' ? 'Void' : (isBlank ? 'Pending' : 'Saved'),
        amountPending: isBlank,
        receiptNumber: rcNo,
        date: receiptDateEl?.value || '',
        invoiceNumber: (linkedInvoiceEl?.value || '').trim(),
        client: { name: (clientNameEl?.value || '').trim(), address: (clientAddressEl?.value || '').trim() },
        paymentMethod: isBlank ? (paymentMethodEl?.value || '') : (paymentMethodEl?.value || 'Cash'),
        trxRef: (trxRefEl?.value || '').trim(),
        items: getReceiptCustomItems(),
        amount: amt,
        amountInWords: isBlank ? '' : numberToWordsBDT(amt)
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
      if (isBlankReceiptMode()) {
        showToast('Enter and save the received amount before sharing this receipt.', 'warning');
        return;
      }
      if (typeof shareDocumentWhatsApp === 'function') {
        shareDocumentWhatsApp('receipt', getShareData());
      }
    });
  }

  if (shareEmailBtn) {
    shareEmailBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (isBlankReceiptMode()) {
        showToast('Enter and save the received amount before sharing this receipt.', 'warning');
        return;
      }
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
    const params = new URLSearchParams(window.location.search);
    const isEditing = params.get('no') || params.get('id') || params.get('load') || params.get('rcpt') || currentReceiptNumber;
    if (isEditing) return;
    if (typeof setCompanyHeader === 'function') {
      setCompanyHeader();
    }
    if (receiptNumberEl) {
      receiptNumberEl.value = peekNextReceiptNumber();
    }
    syncReceiptPrintValues();
    updateReceiptSummaryAndQR();
  });

  if (window.AutoInvoiceDocList && typeof window.AutoInvoiceDocList.connectWorkspace === 'function') {
    window.AutoInvoiceDocList.connectWorkspace({
      type: 'receipt',
      blankBtnId: 'listBlankReceiptBtn',
      getRecords: () => (typeof loadReceipts === 'function' ? loadReceipts() : []),
      loadDiskSummaries: null,
      isDirty: () => isDirty,
      resetDirty: () => { isDirty = false; },
      hasEditorParams: (p) => !!(p && (p.new === '1' || p.new === 'true' || p.blank === '1' || p.blank === 'true' || p.no || p.rcpt || p.inv || p.qtn || p.id || p.load || p.autoprint === '1')),
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
