// Quotation page logic

document.addEventListener('DOMContentLoaded', () => {
  setCompanyHeader();

  const quotationNumberEl = document.getElementById('quotationNumber');
  const dateEl = document.getElementById('quotationDate');
  const subjectEl = document.getElementById('subject');
  const subjectHeaderEl = document.getElementById('subjectHeader');
  const toNameEl = document.getElementById('toName');
  const toTitleEl = document.getElementById('toTitle');
  const toCompanyEl = document.getElementById('toCompany');
  const toAddressEl = document.getElementById('toAddress');
  const introTextEl = document.getElementById('introText');
  const scopeTextEl = document.getElementById('scopeText');
  const termsTextEl = document.getElementById('termsText');
  const closingNoteTextEl = document.getElementById('closingNoteText');
  const itemRowsEl = document.getElementById('itemRows');
  const addRowBtn = document.getElementById('addRowBtn');
  const grandTotalEl = document.getElementById('grandTotal');
  const subtotalDisplayEl = document.getElementById('subtotalDisplay');
  const discountRowEl = document.getElementById('discountRow');
  const discountRateLabelEl = document.getElementById('discountRateLabel');
  const discountModeEl = document.getElementById('discountMode');
  const discountInputEl = document.getElementById('quotationDiscount');
  const discountPrintEl = document.getElementById('discountDisplayPrint');
  const vatRowEl = document.getElementById('vatRow');
  const vatRateLabelEl = document.getElementById('vatRateLabel');
  const vatModeEl = document.getElementById('vatMode');
  const vatRateInputEl = document.getElementById('quotationVatRate');
  const vatAmountDisplayEl = document.getElementById('vatAmountDisplay');
  const amountInWordsEl = document.getElementById('amountInWords');
  const saveBtn = document.getElementById('saveQuotationBtn') || document.getElementById('saveBtn');
  const printBtn = document.getElementById('printBtn');
  const exportBtn = document.getElementById('exportQuotationBtn') || document.getElementById('exportBtn');
  const resetBtn = document.getElementById('resetBtn');
  const qrContainer = document.getElementById('qrContainer');
  const prfBtn = document.getElementById('prfBtn');
  const createChallanBtn = document.getElementById('createChallanBtn');
  const createInvoiceBtn = document.getElementById('createInvoiceBtn');
  const createReceiptBtn = document.getElementById('createReceiptBtn');
  const duplicateQuotationBtn = document.getElementById('duplicateQuotationBtn');
  const convBadgeEl = document.getElementById('conversionBadge');
  const validityBadgeEl = document.getElementById('validityBadge');
  const clientListEl = document.getElementById('clientList');
  const validityDaysEl = document.getElementById('validityDays');
  const validUntilEl = document.getElementById('validUntil');

  let currentQuotationRecord = null;
  let isDirty = false;

  function syncQuotationPrintValues() {
    const qNoPrint = document.getElementById('quotationNumberPrint');
    const qDatePrint = document.getElementById('quotationDatePrint');
    const validUntilPrint = document.getElementById('validUntilPrint');
    const subjPrint = document.getElementById('subjectPrint');
    const toNamePrint = document.getElementById('toNamePrint');
    const toTitleCoPrint = document.getElementById('toTitleCompanyPrint');
    const toAddrPrint = document.getElementById('toAddressPrint');
    const introPrint = document.getElementById('introTextPrint');
    const scopePrint = document.getElementById('scopeTextPrint');
    const termsPrint = document.getElementById('termsTextPrint');
    const closingNotePrint = document.getElementById('closingNoteTextPrint');

    if (qNoPrint) qNoPrint.textContent = quotationNumberEl?.value || '—';
    if (qDatePrint) qDatePrint.textContent = dateEl?.value ? (typeof formatDisplayDate === 'function' ? formatDisplayDate(dateEl.value) : dateEl.value) : '—';
    if (validUntilPrint) {
      validUntilPrint.textContent = validUntilEl?.value
        ? (typeof formatDisplayDate === 'function' ? formatDisplayDate(validUntilEl.value) : validUntilEl.value)
        : '—';
    }
    if (subjPrint) subjPrint.textContent = (subjectEl?.value || '').trim() || '—';
    if (toNamePrint) toNamePrint.textContent = (toNameEl?.value || '').trim() || '—';
    if (toTitleCoPrint) {
      toTitleCoPrint.textContent = [toTitleEl?.value?.trim(), toCompanyEl?.value?.trim()].filter(Boolean).join(' • ');
    }
    if (toAddrPrint) toAddrPrint.textContent = (toAddressEl?.value || '').trim();
    if (introPrint) introPrint.textContent = introTextEl?.value || '';
    if (scopePrint) scopePrint.textContent = scopeTextEl?.value || '';
    if (termsPrint) termsPrint.textContent = termsTextEl?.value || '';
    if (closingNotePrint) closingNotePrint.textContent = closingNoteTextEl?.value || '';

    const totals = typeof getQuotationTotalsBreakdown === 'function' ? getQuotationTotalsBreakdown() : null;
    if (totals) {
      if (subtotalDisplayEl) subtotalDisplayEl.textContent = formatBDT(totals.subtotal);
      if (discountRateLabelEl) {
        discountRateLabelEl.textContent = totals.discountMode === 'percent' && totals.discountValue > 0
          ? `Discount (${totals.discountValue}%):`
          : 'Discount:';
      }
      if (discountPrintEl) discountPrintEl.textContent = `-${formatBDT(totals.discount)}`;
      if (discountRowEl) discountRowEl.classList.toggle('no-print', totals.discount <= 0);
      if (vatAmountDisplayEl) vatAmountDisplayEl.textContent = formatBDT(totals.vatAmount);
      if (vatRateLabelEl) {
        vatRateLabelEl.textContent = totals.vatRate > 0
          ? (totals.vatInclusive ? `Incl. VAT (${totals.vatRate}%):` : `VAT (${totals.vatRate}%):`)
          : 'VAT (%):';
      }
      if (vatRowEl) vatRowEl.classList.toggle('no-print', totals.vatRate <= 0);
    }
  }

  function computeValidUntilFromDays() {
    const qDateStr = dateEl?.value || (typeof toLocalISODate === 'function' ? toLocalISODate() : new Date().toISOString().slice(0, 10));
    const days = parseInt(validityDaysEl?.value, 10);
    if (!isNaN(days) && days > 0 && qDateStr) {
      const dt = typeof parseLocalISODate === 'function' ? parseLocalISODate(qDateStr) : new Date(qDateStr);
      if (dt) {
        dt.setDate(dt.getDate() + days);
        if (validUntilEl) {
          validUntilEl.value = typeof toLocalISODate === 'function' ? toLocalISODate(dt) : dt.toISOString().slice(0, 10);
        }
      }
    }
    syncQuotationPrintValues();
    updateValidityBadge();
  }

  function computeDaysFromValidUntil() {
    const qDateStr = dateEl?.value;
    const untilStr = validUntilEl?.value;
    if (qDateStr && untilStr) {
      const dt1 = typeof parseLocalISODate === 'function' ? parseLocalISODate(qDateStr) : new Date(qDateStr);
      const dt2 = typeof parseLocalISODate === 'function' ? parseLocalISODate(untilStr) : new Date(untilStr);
      if (dt1 && dt2) {
        const diffDays = Math.round((dt2.getTime() - dt1.getTime()) / (1000 * 60 * 60 * 24));
        if (validityDaysEl) {
          validityDaysEl.value = diffDays > 0 ? diffDays : 1;
        }
      }
    }
    syncQuotationPrintValues();
    updateValidityBadge();
  }

  function updateValidityBadge(rec) {
    if (!validityBadgeEl) return;
    const q = rec || buildRecord();
    const stats = typeof getQuotationStatus === 'function' ? getQuotationStatus(q) : null;
    if (!stats || stats.isVoid || stats.isConverted) {
      validityBadgeEl.classList.add('d-none');
      validityBadgeEl.innerHTML = '';
      return;
    }
    validityBadgeEl.classList.remove('d-none');
    if (stats.isExpired) {
      const expDateDisplay = typeof formatDisplayDate === 'function' ? formatDisplayDate(stats.validUntil) : stats.validUntil;
      validityBadgeEl.className = 'alert alert-danger py-2 px-3 mb-2 no-print d-flex align-items-center justify-content-between';
      validityBadgeEl.innerHTML = `<div><strong>⚠️ Quotation Expired:</strong> This quotation was valid until ${escapeHTML(expDateDisplay)}.</div>`;
    } else {
      const untilDateDisplay = typeof formatDisplayDate === 'function' ? formatDisplayDate(stats.validUntil) : stats.validUntil;
      validityBadgeEl.className = 'alert alert-success py-2 px-3 mb-2 no-print d-flex align-items-center justify-content-between';
      validityBadgeEl.innerHTML = `<div><strong>✅ Quotation Valid:</strong> Valid until ${escapeHTML(untilDateDisplay)} <span class="badge bg-success ms-2">${stats.daysRemaining} days left</span></div>`;
    }
  }

  function updateConversionBadge(rec) {
    if (!convBadgeEl) return;
    if (rec && rec.converted) {
      convBadgeEl.className = 'alert alert-info py-2 px-3 mb-2 no-print d-flex align-items-center justify-content-between';
      convBadgeEl.innerHTML = `
        <div>
          <strong>🔗 Converted to Invoice:</strong> ${escapeHTML(rec.convertedToInvoice || 'Yes')}
          ${rec.convertedAt ? `<span class="text-muted ms-2">(${new Date(rec.convertedAt).toLocaleDateString()})</span>` : ''}
        </div>
        ${rec.convertedToInvoice ? `<a href="invoice.html?no=${encodeURIComponent(rec.convertedToInvoice)}" class="btn btn-sm btn-outline-primary bg-body">Open Invoice</a>` : ''}
      `;
      convBadgeEl.classList.remove('d-none');
    } else {
      convBadgeEl.classList.add('d-none');
      convBadgeEl.innerHTML = '';
    }
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

  const modeBadgeEl = document.getElementById('modeBadge');
  function updateModeBadge(isEditing, docNo) {
    if (!modeBadgeEl) return;
    if (isEditing) {
      modeBadgeEl.innerHTML = `<span class="badge bg-primary fs-6 px-3 py-2 shadow-sm">📝 Editing Quotation: ${escapeHTML(docNo)}</span>`;
    } else {
      modeBadgeEl.innerHTML = `<span class="badge bg-success fs-6 px-3 py-2 shadow-sm">✨ New Quotation</span>`;
    }
  }

  // Initialize Client Onboarding and Item Catalog
  let clientOnboarding = null;
  let itemCatalog = null;
  if (window.AutoInvoiceCatalog) {
    clientOnboarding = AutoInvoiceCatalog.setupClientOnboarding({
      selectId: 'clientSelect',
      datalistId: 'clientList',
      nameInputId: 'toName',
      addressInputId: 'toAddress',
      companyInputId: 'toCompany',
      titleInputId: 'toTitle',
      onClientSelected: (client) => {
        isDirty = true;
        syncQuotationPrintValues();
        debouncedRenderQR();
      }
    });

    itemCatalog = AutoInvoiceCatalog.setupItemCatalog({
      datalistId: 'itemList',
      onItemPicked: (item) => {
        isDirty = true;
        const fullDesc = item.name ? (item.name + (item.desc ? ' - ' + item.desc : '')) : (item.desc || '');
        addRowFromData({
          desc: fullDesc,
          unit: item.unit || 'Pcs',
          unitPrice: item.unitPrice || 0,
          qty: 1
        });
        updateGrandTotal();
        debouncedRenderQR();
      }
    });
  }

  if (toNameEl) {
    toNameEl.addEventListener('input', () => {
      const val = toNameEl.value.trim().toLowerCase();
      if (!val || typeof loadClients !== 'function') return;
      const match = loadClients().find(c => (c.name || '').toLowerCase() === val);
      if (match) {
        if (match.title && toTitleEl && !toTitleEl.value) toTitleEl.value = match.title;
        if (match.company && toCompanyEl && !toCompanyEl.value) toCompanyEl.value = match.company;
        if (match.address && toAddressEl && !toAddressEl.value) toAddressEl.value = match.address;
        const clientSelect = document.getElementById('clientSelect');
        if (clientSelect) clientSelect.value = match.name;
      }
    });
  }

  const defaultIntro = "I appreciate the opportunity to provide a quotation for the installation. Below is the detailed breakdown of the services and components required for the project.";
  const defaultScope = [
    "Research & Development (R&D) – System analysis, prototyping, and optimization.",
    "PCB Design & Production – Custom PCB design, fabrication, and processing.",
    "Component Sourcing & Soldering – High-quality electronic components and professional soldering.",
    "Controller & Firmware – Optimized firmware development for reliable operation.",
    "LED Display Unit – Supply of display modules.",
    "Wiring & Accessories – Ribbon cables and necessary wiring materials.",
    "System Integration – Ensure hardware and firmware work seamlessly together."
  ].join('\n');
  const defaultTerms = [
    "Installation will be carried out by your resources.",
    "Prices are inclusive of applicable taxes and transportation charges up to the head office.",
    "Payment Terms: 60% advance and 40% upon delivery, or 100% advance payment in cash.",
    "Quotation validity: 30 days."
  ].join('\n');
  const defaultClosingNote = "If you accept this quotation, please sign below to indicate your approval and email me a scanned copy.\nPlease let me know if you have any queries about the quotation. We look forward to collaborating on this project.";

  function resetQuotationFieldsToNew() {
    currentQuotationRecord = null;
    if (quotationNumberEl) quotationNumberEl.value = peekNextQuotationNumber();
    const csEl = document.getElementById('clientSelect');
    if (csEl) csEl.value = '';
    if (subjectEl) subjectEl.value = '';
    if (subjectHeaderEl) subjectHeaderEl.textContent = '';
    if (toNameEl) toNameEl.value = '';
    if (toTitleEl) toTitleEl.value = '';
    if (toCompanyEl) toCompanyEl.value = '';
    if (toAddressEl) toAddressEl.value = '';
    if (dateEl) dateEl.value = typeof toLocalISODate === 'function' ? toLocalISODate() : new Date().toISOString().slice(0, 10);
    if (validityDaysEl) validityDaysEl.value = 30;
    if (introTextEl) introTextEl.value = defaultIntro;
    if (scopeTextEl) scopeTextEl.value = defaultScope;
    if (termsTextEl) termsTextEl.value = defaultTerms;
    if (closingNoteTextEl) closingNoteTextEl.value = defaultClosingNote;
    if (discountModeEl) discountModeEl.value = 'bdt';
    if (discountInputEl) discountInputEl.value = '0';
    if (vatModeEl) vatModeEl.value = 'excl';
    if (vatRateInputEl) vatRateInputEl.value = '0';
    itemRowsEl.innerHTML = '';
    addRow();
    computeValidUntilFromDays();
    updateGrandTotal();
    updateConversionBadge(null);
    updateModeBadge(false);
    updateValidityBadge(null);
  }

  async function loadEditorFromParams(qParams) {
    const qp = qParams || {};
    if (typeof setCompanyHeader === 'function') setCompanyHeader();
    if (qp.no) {
      const q = getQuotationByNumber(qp.no);
      if (q) {
        currentQuotationRecord = q;
        quotationNumberEl.value = q.quotationNumber;
        dateEl.value = q.date || '';
        if (validityDaysEl) validityDaysEl.value = q.validityDays || 30;
        if (validUntilEl) {
          if (q.validUntil) {
            validUntilEl.value = q.validUntil;
          } else {
            computeValidUntilFromDays();
          }
        }
        subjectEl.value = q.subject || '';
        subjectHeaderEl.textContent = q.subject || '';
        toNameEl.value = q.to?.name || '';
        toTitleEl.value = q.to?.title || '';
        toCompanyEl.value = q.to?.company || '';
        toAddressEl.value = q.to?.address || '';
        const csEl = document.getElementById('clientSelect');
        if (csEl) csEl.value = q.to?.name || '';
        introTextEl.value = q.intro || defaultIntro;
        scopeTextEl.value = q.scope || defaultScope;
        termsTextEl.value = q.terms || defaultTerms;
        if (closingNoteTextEl) closingNoteTextEl.value = q.closingNote !== undefined ? q.closingNote : defaultClosingNote;
        if (discountModeEl) discountModeEl.value = q.discountMode || 'bdt';
        if (discountInputEl) {
          const dv = q.discountMode === 'percent' ? (q.discountValue || 0) : (q.discount != null ? q.discount : (q.discountValue || 0));
          discountInputEl.value = String(dv || 0);
        }
        if (vatModeEl) vatModeEl.value = q.vatInclusive ? 'incl' : 'excl';
        if (vatRateInputEl) vatRateInputEl.value = String(q.vatRate || 0);
        itemRowsEl.innerHTML = '';
        (q.items || []).forEach(r => addRowFromData({ desc: r.desc, qty: r.qty, unit: r.unit || 'Pcs', unitPrice: r.unitPrice }));
        if (!(q.items || []).length) addRow();
        updateGrandTotal();
        updateModeBadge(true, q.quotationNumber);
        updateConversionBadge(q);
        updateValidityBadge(q);
        if (q.billerId || q.company) {
          const qBiller = (typeof getBillerById === 'function' && q.billerId ? getBillerById(q.billerId) : null) || q.company;
          if (qBiller) setCompanyHeader(qBiller);
        }
      } else {
        resetQuotationFieldsToNew();
      }
    } else {
      resetQuotationFieldsToNew();
    }
    if (!dateEl.value) {
      dateEl.value = typeof toLocalISODate === 'function' ? toLocalISODate() : new Date().toISOString().slice(0, 10);
      computeValidUntilFromDays();
    }
    renderQR(qrContainer, buildQRText());
    syncQuotationPrintValues();
    isDirty = false;
  }

  const debouncedRenderQR = debounce(() => renderQR(qrContainer, buildQRText()), 300);

  [dateEl, toNameEl, toTitleEl, toCompanyEl, toAddressEl, introTextEl, scopeTextEl, termsTextEl, closingNoteTextEl, validityDaysEl, validUntilEl].forEach(el => {
    if (el) el.addEventListener('input', syncQuotationPrintValues);
  });

  if (dateEl) {
    dateEl.addEventListener('input', () => {
      computeValidUntilFromDays();
    });
  }
  if (validityDaysEl) {
    validityDaysEl.addEventListener('input', () => {
      computeValidUntilFromDays();
    });
  }
  if (validUntilEl) {
    validUntilEl.addEventListener('input', () => {
      computeDaysFromValidUntil();
    });
  }

  if (subjectEl && subjectHeaderEl) {
    subjectHeaderEl.textContent = subjectEl.value.trim();
    subjectEl.addEventListener('input', () => {
      subjectHeaderEl.textContent = subjectEl.value.trim();
      syncQuotationPrintValues();
      debouncedRenderQR();
    });
  }
  syncQuotationPrintValues();

  function syncQuotationRowMirrors(tr) {
    if (!tr) return;
    const dM = tr.querySelector('.qtn-print-desc');
    const qM = tr.querySelector('.qtn-print-qty');
    const uM = tr.querySelector('.qtn-print-unit');
    const pM = tr.querySelector('.qtn-print-price');
    const dEl = tr.querySelector('textarea');
    const qEl = tr.querySelector('.qty');
    const uEl = tr.querySelector('.unit');
    const pEl = tr.querySelector('.price');
    if (dM && dEl) dM.textContent = dEl.value;
    if (qM && qEl) qM.textContent = qEl.value || '0';
    if (uM && uEl) uM.textContent = uEl.value || 'Pcs';
    if (pM && pEl) pM.textContent = formatBDT(parseFloat((pEl.value || '0').replace(/[^0-9.]/g, '')) || 0);
  }

  function getRowIndex(tr) {
    return Array.from(itemRowsEl.children).indexOf(tr) + 1;
  }

  function addRowFromData(row) {
    const tr = document.createElement('tr');
    const rowNum = itemRowsEl.children.length + 1;
    const qtyVal = row.qty || 0;
    const unitVal = row.unit || 'Pcs';
    const priceVal = row.unitPrice || 0;
    tr.innerHTML = `
      <td>
        <textarea class="form-control no-print" rows="1" aria-label="Item description, row ${rowNum}">${escapeHTML(row.desc || '')}</textarea>
        <div class="print-only qtn-print-desc">${escapeHTML(row.desc || '')}</div>
      </td>
      <td class="text-center">
        <input type="text" inputmode="decimal" class="form-control form-control-sm text-center qty no-print" aria-label="Quantity, row ${rowNum}" value="${escapeAttr(qtyVal)}" />
        <span class="print-only qtn-print-qty">${escapeHTML(String(qtyVal))}</span>
      </td>
      <td class="text-center">
        <input type="text" class="form-control form-control-sm text-center unit no-print" list="unitSuggestions" aria-label="Unit, row ${rowNum}" value="${escapeAttr(unitVal)}" />
        <span class="print-only qtn-print-unit">${escapeHTML(unitVal)}</span>
      </td>
      <td class="text-end">
        <input type="text" inputmode="decimal" class="form-control form-control-sm text-end price no-print" aria-label="Unit price, row ${rowNum}" value="${escapeAttr(priceVal)}" />
        <span class="print-only qtn-print-price">${formatBDT(priceVal)}</span>
      </td>
      <td class="text-end total">${formatBDT(roundBDT(qtyVal * priceVal))}</td>
      <td class="action-col no-print"><button class="btn btn-sm btn-outline-danger" aria-label="Delete item, row ${rowNum}">Delete</button></td>
    `;
    attachRowEvents(tr);
    itemRowsEl.appendChild(tr);
    return tr;
  }

  function addRow() {
    const tr = addRowFromData({ qty: 0, unit: 'Pcs', unitPrice: 0 });
    updateGrandTotal();
    debouncedRenderQR();
    return tr;
  }

  function attachRowEvents(tr) {
    const qtyEl = tr.querySelector('.qty');
    const unitEl = tr.querySelector('.unit');
    const priceEl = tr.querySelector('.price');
    const delBtn = tr.querySelector('button');
    const totalCell = tr.querySelector('.total');
    const recalc = () => {
      const qty = parseFloat((qtyEl.value || '0').replace(/[^0-9.]/g, '')) || 0;
      const price = parseFloat((priceEl.value || '0').replace(/[^0-9.]/g, '')) || 0;
      const total = roundBDT(qty * price);
      totalCell.textContent = formatBDT(total);
      syncQuotationRowMirrors(tr);
      updateGrandTotal();
      debouncedRenderQR();
    };
    qtyEl.addEventListener('input', recalc);
    priceEl.addEventListener('input', recalc);
    if (unitEl) unitEl.addEventListener('input', () => syncQuotationRowMirrors(tr));
    const descTextarea = tr.querySelector('textarea');
    if (descTextarea) {
      descTextarea.addEventListener('input', () => syncQuotationRowMirrors(tr));
      descTextarea.addEventListener('change', () => {
        const val = descTextarea.value.trim().toLowerCase();
        if (!val || typeof loadItems !== 'function') return;
        const matched = loadItems().find(it => (it.name || '').toLowerCase() === val);
        if (matched) {
          if (matched.desc && descTextarea.value.trim() === matched.name) {
            descTextarea.value = `${matched.name} - ${matched.desc}`;
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
      const desc = tr.querySelector('textarea')?.value.trim() || '';
      const qty = parseFloat((qtyEl.value || '0').replace(/[^0-9.]/g, '')) || 0;
      if (desc || qty > 0) {
        if (!confirm('Are you sure you want to remove this item row?')) return;
      }
      tr.remove();
      isDirty = true;
      updateGrandTotal();
      debouncedRenderQR();
    });

    priceEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const rows = itemRowsEl.querySelectorAll('tr');
        if (rows[rows.length - 1] === tr) {
          e.preventDefault();
          const newTr = addRow();
          newTr.querySelector('textarea')?.focus();
        }
      }
    });
  }

  function getQuotationTotalsBreakdown() {
    let subtotal = 0;
    itemRowsEl.querySelectorAll('tr').forEach(tr => {
      const qtyEl = tr.querySelector('.qty');
      const priceEl = tr.querySelector('.price');
      const qty = parseFloat((qtyEl?.value || '0').replace(/[^0-9.]/g, '')) || 0;
      const price = parseFloat((priceEl?.value || '0').replace(/[^0-9.]/g, '')) || 0;
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

  function getGrandTotalNumber() {
    return getQuotationTotalsBreakdown().grandTotal;
  }

  function updateGrandTotal() {
    const totals = getQuotationTotalsBreakdown();
    if (subtotalDisplayEl) subtotalDisplayEl.textContent = formatBDT(totals.subtotal);
    grandTotalEl.textContent = formatBDT(totals.grandTotal);
    amountInWordsEl.textContent = numberToWordsBDT(totals.grandTotal);
    syncQuotationPrintValues();
  }

  addRowBtn.addEventListener('click', () => { addRow(); isDirty = true; });
  [discountModeEl, discountInputEl, vatModeEl, vatRateInputEl].forEach((el, idx) => {
    if (!el) return;
    const evt = (idx === 0 || idx === 2) ? 'change' : 'input';
    el.addEventListener(evt, () => {
      isDirty = true;
      updateGrandTotal();
      debouncedRenderQR();
    });
  });

  function buildRecord() {
    const items = [];
    itemRowsEl.querySelectorAll('tr').forEach(tr => {
      const desc = tr.querySelector('textarea')?.value.trim() || '';
      const qty = parseFloat((tr.querySelector('.qty')?.value || '0').replace(/[^0-9.]/g, '')) || 0;
      const unit = tr.querySelector('.unit')?.value.trim() || 'Pcs';
      const unitPrice = parseFloat((tr.querySelector('.price')?.value || '0').replace(/[^0-9.]/g, '')) || 0;
      items.push({ desc, qty, unit, unitPrice, total: roundBDT(qty * unitPrice) });
    });
    const totals = getQuotationTotalsBreakdown();
    const existingQ = currentQuotationRecord || (quotationNumberEl.value.trim() ? getQuotationByNumber(quotationNumberEl.value.trim()) : null);
    const vDays = parseInt(validityDaysEl?.value, 10) || 30;
    const vUntil = validUntilEl?.value || '';
    const bId = existingQ?.billerId || (typeof getActiveBillerId === 'function' ? getActiveBillerId() : 'biller_default');
    const targetBiller = (typeof getBillerById === 'function' && bId ? getBillerById(bId) : null)
      || existingQ?.company
      || (typeof getActiveBiller === 'function' ? getActiveBiller() : (typeof COMPANY !== 'undefined' ? COMPANY : {}));
    const companySnap = typeof slimCompanySnapshot === 'function' ? slimCompanySnapshot(targetBiller) : targetBiller;
    return {
      id: existingQ?.id,
      createdAt: existingQ?.createdAt,
      status: existingQ?.status,
      _type: 'quotation',
      quotationNumber: quotationNumberEl.value.trim(),
      date: dateEl.value,
      validityDays: vDays,
      validUntil: vUntil,
      subject: subjectEl.value.trim(),
      to: {
        name: toNameEl.value.trim(),
        title: toTitleEl.value.trim(),
        company: toCompanyEl.value.trim(),
        address: toAddressEl.value.trim()
      },
      intro: introTextEl.value.trim(),
      scope: scopeTextEl.value.trim(),
      terms: termsTextEl.value.trim(),
      closingNote: (closingNoteTextEl?.value || '').trim(),
      items,
      subtotal: totals.subtotal,
      discountMode: totals.discountMode,
      discountValue: totals.discountValue,
      discount: totals.discount,
      vatRate: totals.vatRate,
      vatInclusive: totals.vatInclusive,
      vatAmount: totals.vatAmount,
      grandTotal: totals.grandTotal,
      amountInWords: numberToWordsBDT(totals.grandTotal),
      qrData: buildQRText(),
      billerId: bId,
      company: companySnap,
      converted: !!currentQuotationRecord?.converted,
      convertedToInvoice: currentQuotationRecord?.convertedToInvoice || '',
      convertedAt: currentQuotationRecord?.convertedAt || ''
    };
  }

  function validateRecord(rec) {
    if (!rec.subject) return 'Subject is required.';
    if (!rec.to?.name) return 'Recipient name is required.';
    if (!rec.items?.length) return 'Add at least one item.';
    const hasQty = rec.items.some(it => Number(it.qty) > 0);
    if (!hasQty) return 'Item quantity must be greater than 0.';
    return '';
  }

  function buildQRText() {
    const num = quotationNumberEl.value;
    const totalNum = getGrandTotalNumber();
    const toWho = toCompanyEl.value || toNameEl.value || '';
    const existingQ = currentQuotationRecord || (quotationNumberEl.value ? getQuotationByNumber(quotationNumberEl.value) : null);
    const bId = existingQ?.billerId || (typeof getActiveBillerId === 'function' ? getActiveBillerId() : 'biller_default');
    const biller = (typeof getBillerById === 'function' && bId ? getBillerById(bId) : null)
      || existingQ?.company
      || (typeof getActiveBiller === 'function' ? getActiveBiller() : (typeof COMPANY !== 'undefined' ? COMPANY : {}));
    return buildQRPayload('QTN', {
      number: num,
      date: dateEl.value,
      amount: totalNum,
      client: toWho,
      company: biller.name || (typeof COMPANY !== 'undefined' ? COMPANY.name : '')
    });
  }

  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      const record = buildRecord();
      const validMsg = validateRecord(record);
      if (validMsg) { showToast(validMsg, 'warning'); return; }
      saveQuotation(record);
      finalizeQuotationNumber(record.quotationNumber, record.billerId);
      currentQuotationRecord = record;
      if (typeof history !== 'undefined' && history.replaceState) {
        try { history.replaceState(null, '', `?no=${encodeURIComponent(record.quotationNumber)}`); } catch (_) { }
      }
      isDirty = false;
      updateModeBadge(true, record.quotationNumber);
      updateValidityBadge(record);
      if (clientOnboarding) clientOnboarding.refresh(record.to?.name);
      if (typeof saveItem === 'function' && Array.isArray(record.items)) {
        record.items.forEach(it => {
          if (it.desc) {
            const parts = it.desc.split(' - ');
            saveItem({ name: parts[0], desc: it.desc, unitPrice: it.unitPrice, unit: it.unit || 'Pcs' });
          }
        });
        if (itemCatalog) itemCatalog.refresh();
      }
      syncQuotationPrintValues();
      showToast('Quotation saved successfully.', 'success');
    });
  }

  if (duplicateQuotationBtn) {
    duplicateQuotationBtn.addEventListener('click', () => {
      if (typeof setCompanyHeader === 'function') setCompanyHeader();
      const nextNo = peekNextQuotationNumber();
      quotationNumberEl.value = nextNo;
      dateEl.value = typeof toLocalISODate === 'function' ? toLocalISODate() : new Date().toISOString().slice(0, 10);
      if (validityDaysEl && !validityDaysEl.value) validityDaysEl.value = 30;
      computeValidUntilFromDays();
      currentQuotationRecord = null;
      if (typeof history !== 'undefined' && history.replaceState) {
        try { history.replaceState(null, '', '?new=1'); } catch (_) { }
      }
      updateModeBadge(false);
      updateConversionBadge(null);
      updateValidityBadge(null);
      isDirty = true;
      updateGrandTotal();
      syncQuotationPrintValues();
      renderQR(qrContainer, buildQRText());
      showToast(`Duplicated as new quotation ${nextNo}. Click Save when ready.`, 'info');
    });
  }

  initSaveShortcut(saveBtn);

  function prepareForPrint() {
    itemRowsEl.querySelectorAll('tr').forEach(syncQuotationRowMirrors);
    syncQuotationPrintValues();
    renderQR(qrContainer, buildQRText());
    if (typeof setPrintDocumentTitle === 'function') {
      setPrintDocumentTitle(quotationNumberEl?.value || 'Quotation', toCompanyEl?.value || toNameEl?.value || '');
    }
    const toggleBlankPrint = (elId) => {
      const el = document.getElementById(elId);
      if (el) el.classList.toggle('d-none', !el.textContent.trim());
    };
    toggleBlankPrint('toTitleCompanyPrint');

    document.querySelectorAll('textarea').forEach(el => {
      el.style.height = 'auto';
      el.style.height = el.scrollHeight + 'px';
    });
  }
  window.addEventListener('beforeprint', prepareForPrint);

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

  if (printBtn) {
    printBtn.addEventListener('click', printWithGuard);
  }
  if (typeof initPdfDownloadButton === 'function') {
    initPdfDownloadButton('downloadPdfBtn', () => {
      prepareForPrint();
    }, () => {
      if (typeof setPrintDocumentTitle === 'function') {
        return setPrintDocumentTitle(quotationNumberEl?.value || 'Quotation', toCompanyEl?.value || toNameEl?.value || '');
      }
      return quotationNumberEl?.value || 'Quotation';
    });
  }

  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
      const record = buildRecord();
      const titleSlug = slugify(record.subject || '');
      const fname = `quotation_${record.quotationNumber}${titleSlug ? '_' + titleSlug : ''}.json`;
      downloadJSON(fname, record);
      showToast('JSON downloaded. Move it to records/quotations and update index.json to preload in Search.', 'info');
    });
  }

  const shareWhatsAppBtn = document.getElementById('shareWhatsAppBtn');
  const shareEmailBtn = document.getElementById('shareEmailBtn');

  function getShareData() {
    const record = buildRecord();
    const clientName = record.to?.name || record.to?.company || 'Valued Customer';
    let clientPhone = '';
    let clientEmail = '';
    if (typeof loadClients === 'function') {
      const match = loadClients().find(c =>
        (c.name && c.name.toLowerCase() === clientName.toLowerCase()) ||
        (c.company && c.company.toLowerCase() === (record.to?.company || '').toLowerCase())
      );
      if (match) {
        clientPhone = match.phone || '';
        clientEmail = match.email || '';
      }
    }
    return {
      number: record.quotationNumber,
      date: record.date,
      clientName: clientName,
      clientPhone: clientPhone,
      clientEmail: clientEmail,
      total: record.grandTotal,
      billerName: typeof getActiveBiller === 'function' ? getActiveBiller()?.name : ''
    };
  }

  if (shareWhatsAppBtn) {
    shareWhatsAppBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (typeof shareDocumentWhatsApp === 'function') {
        shareDocumentWhatsApp('quotation', getShareData());
      }
    });
  }

  if (shareEmailBtn) {
    shareEmailBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (typeof shareDocumentEmail === 'function') {
        shareDocumentEmail('quotation', getShareData());
      }
    });
  }

  function openWithQtn(page) {
    const record = buildRecord();
    const validMsg = validateRecord(record);
    if (validMsg) { showToast(`Cannot open ${page}: ${validMsg}`, 'warning'); return; }

    if (page === 'invoice') {
      const qStats = typeof getQuotationStatus === 'function' ? getQuotationStatus(record) : null;
      if (qStats && qStats.isExpired) {
        const expDisplay = typeof formatDisplayDate === 'function' ? formatDisplayDate(qStats.validUntil) : qStats.validUntil;
        if (!confirm(`Warning: This quotation expired on ${expDisplay}. Do you still want to convert it to an invoice?`)) {
          return;
        }
      }
      if (record.converted) {
        if (!confirm(`This quotation was already converted to invoice (${record.convertedToInvoice || 'Yes'}). Create another invoice anyway?`)) {
          return;
        }
      }
    }

    saveQuotation(record);
    finalizeQuotationNumber(record.quotationNumber, record.billerId);
    currentQuotationRecord = record;
    isDirty = false;
    updateModeBadge(true, record.quotationNumber);
    const no = quotationNumberEl.value;
    const url = `${page}.html?qtn=${encodeURIComponent(no)}`;
    window.open(url, '_blank');
  }
  if (createChallanBtn) createChallanBtn.addEventListener('click', () => openWithQtn('challan'));
  if (createInvoiceBtn) createInvoiceBtn.addEventListener('click', () => openWithQtn('invoice'));
  if (createReceiptBtn) createReceiptBtn.addEventListener('click', () => openWithQtn('receipt'));

  if (prfBtn) {
    prfBtn.addEventListener('click', () => {
      const rec = buildRecord();
      const activeBiller = typeof getActiveBiller === 'function' ? getActiveBiller() : (typeof COMPANY !== 'undefined' ? COMPANY : {});
      const pName = document.getElementById('prfCompanyName');
      const pAddr = document.getElementById('prfCompanyAddress');
      const pNum = document.getElementById('prfQuotationNumber');
      const pDate = document.getElementById('prfDate');
      const pTo = document.getElementById('prfTo');
      const pTotal = document.getElementById('prfTotal');
      const pWords = document.getElementById('prfWords');

      if (pName) pName.textContent = activeBiller.name || '';
      if (pAddr) pAddr.textContent = activeBiller.address || '';
      if (pNum) pNum.textContent = rec.quotationNumber;
      if (pDate) pDate.textContent = typeof formatDisplayDate === 'function' ? formatDisplayDate(rec.date) : rec.date;
      if (pTo) pTo.textContent = `${rec.to.name} — ${rec.to.title} — ${rec.to.company}`;
      if (pTotal) pTotal.textContent = formatBDT(rec.grandTotal);
      if (pWords) pWords.textContent = rec.amountInWords;
      document.body.classList.add('prf-mode');
      const cleanupPrf = () => {
        document.body.classList.remove('prf-mode');
        window.removeEventListener('afterprint', cleanupPrf);
      };
      window.addEventListener('afterprint', cleanupPrf);
      window.print();
      setTimeout(() => {
        // Fallback cleanup only if browser blocks/skips afterprint event
        document.body.classList.remove('prf-mode');
      }, 30000);
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      if (confirm('Clear all fields?')) {
        resetQuotationFieldsToNew();
        if (typeof history !== 'undefined' && window.location.search) {
          try { history.replaceState(null, '', '?new=1'); } catch (_) { }
        }
        renderQR(qrContainer, buildQRText());
        syncQuotationPrintValues();
        isDirty = false;
      }
    });
  }

  window.addEventListener('billerchange', () => {
    const qs = new URLSearchParams(window.location.search);
    const isEditing = !!(qs.get('no') || qs.get('id') || qs.get('load') || currentQuotationRecord);
    if (isEditing) return;
    if (typeof setCompanyHeader === 'function') {
      setCompanyHeader();
    }
    if (quotationNumberEl) {
      quotationNumberEl.value = peekNextQuotationNumber();
    }
    syncQuotationPrintValues();
    renderQR(qrContainer, buildQRText());
  });

  if (window.AutoInvoiceDocList && typeof window.AutoInvoiceDocList.connectWorkspace === 'function') {
    window.AutoInvoiceDocList.connectWorkspace({
      type: 'quotation',
      getRecords: () => (typeof loadQuotations === 'function' ? loadQuotations() : []),
      loadDiskSummaries: null,
      isDirty: () => isDirty,
      resetDirty: () => { isDirty = false; },
      hasEditorParams: (p) => !!(p && (p.new === '1' || p.new === 'true' || p.no || p.id || p.load || p.autoprint === '1')),
      loadEditor: async (p) => { await loadEditorFromParams(p); },
      onEnterList: () => { currentQuotationRecord = null; },
      onAfterMutate: (no, action) => {
        if (action === 'delete' && currentQuotationRecord && currentQuotationRecord.quotationNumber === no) {
          currentQuotationRecord = null;
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
