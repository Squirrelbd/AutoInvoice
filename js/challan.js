// Challan page logic: number mode, items (no pricing), QR, save, print

document.addEventListener('DOMContentLoaded', () => {
  setCompanyHeader();

  const numberModeEl = document.getElementById('numberMode');
  const challanNumberEl = document.getElementById('challanNumber');
  const challanDateEl = document.getElementById('challanDate');
  const clientNameEl = document.getElementById('clientName');
  const deliveryAddressEl = document.getElementById('deliveryAddress');
  const clientListEl = document.getElementById('clientList');
  const docTitleInput = document.getElementById('docTitle');
  const docTitleHeader = document.getElementById('docTitleHeader');
  const linkedInvoiceEl = document.getElementById('linkedInvoice');
  const vehicleNoEl = document.getElementById('vehicleNo');
  const driverInfoEl = document.getElementById('driverInfo');
  const packageCountEl = document.getElementById('packageCount');
  const itemRowsEl = document.getElementById('itemRows');
  const qrContainer = document.getElementById('qrContainer');
  const addRowBtn = document.getElementById('addRowBtn');

  function syncClientDisplay() {
    const name = clientNameEl ? clientNameEl.value.trim() : '';
    const addr = deliveryAddressEl ? deliveryAddressEl.value.trim() : '';
    const nameDisp = document.getElementById('clientNameDisplay');
    const contactDisp = document.getElementById('clientContactDisplay');
    const addrDisp = document.getElementById('clientAddressDisplay');
    const commsDisp = document.getElementById('clientCommsDisplay');
    if (!name) {
      if (nameDisp) nameDisp.textContent = '—';
      if (contactDisp) contactDisp.textContent = '';
      if (addrDisp) addrDisp.textContent = addr || 'No delivery address specified';
      if (commsDisp) commsDisp.textContent = '';
      return;
    }
    let match = null;
    if (typeof loadClients === 'function') {
      match = loadClients().find(c => (c.name || '').toLowerCase() === name.toLowerCase());
    }
    if (nameDisp) nameDisp.textContent = name;
    if (addrDisp) addrDisp.textContent = addr || (match && match.address) || '';
    const contactParts = [];
    if (match && match.company && match.company.toLowerCase() !== name.toLowerCase()) contactParts.push(match.company);
    if (match && match.title) contactParts.push(match.title);
    if (contactDisp) contactDisp.textContent = contactParts.length ? `Attn: ${contactParts.join(' • ')}` : '';
    const commsParts = [];
    if (match && match.phone) commsParts.push(`Phone: ${match.phone}`);
    if (match && match.email) commsParts.push(`Email: ${match.email}`);
    if (commsDisp) commsDisp.textContent = commsParts.length ? commsParts.join(' | ') : '';
  }

  function syncPrintDisplayValues() {
    syncClientDisplay();
    const mapText = [
      ['challanNumberPrint', challanNumberEl?.value || '—'],
      ['challanDatePrint', challanDateEl?.value ? (typeof formatDisplayDate === 'function' ? formatDisplayDate(challanDateEl.value) : challanDateEl.value) : '—'],
      ['linkedInvoicePrint', (linkedInvoiceEl?.value || '').trim() || '—'],
      ['docTitlePrint', (docTitleInput?.value || '').trim() || '—'],
      ['vehicleNoPrint', (vehicleNoEl?.value || '').trim() || '—'],
      ['driverInfoPrint', (driverInfoEl?.value || '').trim() || '—'],
      ['packageCountPrint', (packageCountEl?.value || '').trim() || '—']
    ];
    mapText.forEach(([id, txt]) => {
      const el = document.getElementById(id);
      if (el) el.textContent = txt;
    });
  }

  const saveBtn = document.getElementById('saveChallanBtn');
  const exportBtn = document.getElementById('exportChallanBtn');
  const printBtn = document.getElementById('printBtn');
  const resetBtn = document.getElementById('resetBtn');
  const createInvoiceBtn = document.getElementById('createInvoiceBtn');
  const duplicateChallanBtn = document.getElementById('duplicateChallanBtn');
  const LAST_CLIENT_KEY = 'ai_last_client_challan';
  let activeParams = parseQuery();

  function getDraftKey() {
    const num = (challanNumberEl ? challanNumberEl.value.trim() : '');
    const isNew = !activeParams || !activeParams.no;
    return isNew ? 'ai_challan_draft_new' : `ai_challan_draft_${num || activeParams.no}`;
  }

  function clearDraft() {
    try {
      localStorage.removeItem(getDraftKey());
      localStorage.removeItem('ai_challan_draft');
      if (challanNumberEl && challanNumberEl.value) {
        localStorage.removeItem(`ai_challan_draft_${challanNumberEl.value.trim()}`);
      }
      if (activeParams && activeParams.no) {
        localStorage.removeItem(`ai_challan_draft_${activeParams.no}`);
      }
    } catch (e) {
      console.warn('Failed to clear challan draft', e);
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
      modeBadgeEl.innerHTML = `<span class="badge bg-primary fs-6 px-3 py-2 shadow-sm">📝 Editing Challan: ${escapeHTML(docNo)}</span>`;
    } else {
      modeBadgeEl.innerHTML = `<span class="badge bg-success fs-6 px-3 py-2 shadow-sm">✨ New Challan</span>`;
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
      addressInputId: 'deliveryAddress',
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
          qty: 1
        });
      }
    });
  }

  if (clientNameEl) {
    clientNameEl.addEventListener('input', () => {
      const val = clientNameEl.value.trim().toLowerCase();
      if (!val || typeof loadClients !== 'function') return;
      const match = loadClients().find(c => (c.name || '').toLowerCase() === val);
      if (match && match.address && deliveryAddressEl && !deliveryAddressEl.value) {
        deliveryAddressEl.value = match.address;
      }
      const clientSelect = document.getElementById('clientSelect');
      if (clientSelect && match) {
        clientSelect.value = match.name;
      }
    });
  }

  const debouncedRenderQR = debounce(() => renderQR(qrContainer, buildQRText()), 300);

  (async function initChallanPage() {
    const params = parseQuery();
    if (params.no) {
      let ch = getChallanByNumber(params.no);
      if (!ch && typeof getDiskChallanByNumber === 'function') {
        try { ch = await getDiskChallanByNumber(params.no); } catch (e) {
          console.warn('Failed to load disk challan', e);
        }
      }
      if (ch) {
        challanNumberEl.value = ch.challanNumber;
        challanDateEl.value = ch.date || '';
        clientNameEl.value = ch.client?.name || '';
        deliveryAddressEl.value = ch.deliveryAddress || '';
        if (docTitleInput) docTitleInput.value = ch.title || '';
        if (docTitleHeader) docTitleHeader.textContent = ch.title || '';
        if (linkedInvoiceEl) linkedInvoiceEl.value = ch.linkedInvoice || '';
        if (vehicleNoEl) vehicleNoEl.value = ch.logistics?.vehicleNo || '';
        if (driverInfoEl) driverInfoEl.value = ch.logistics?.driverInfo || '';
        if (packageCountEl) packageCountEl.value = ch.logistics?.packageCount || '';
        itemRowsEl.innerHTML = '';
        (ch.items || []).forEach(addRowFromData);
        renderQR(qrContainer, ch.qrData || buildQRText());
        updateModeBadge(true, ch.challanNumber);
        if (ch.billerId || ch.company) {
          const chBiller = (typeof getBillerById === 'function' && ch.billerId ? getBillerById(ch.billerId) : null) || ch.company;
          if (chBiller) setCompanyHeader(chBiller);
        }
        const existingDraft = localStorage.getItem(`ai_challan_draft_${ch.challanNumber}`);
        if (existingDraft) {
          try {
            const d = JSON.parse(existingDraft);
            if (d && confirm(`Unsaved edits found for challan ${ch.challanNumber}. Would you like to restore them?`)) {
              clientNameEl.value = d.client?.name || clientNameEl.value;
              deliveryAddressEl.value = d.deliveryAddress || deliveryAddressEl.value;
              if (docTitleInput && d.title) docTitleInput.value = d.title;
              if (docTitleHeader && d.title) docTitleHeader.textContent = d.title;
              if (linkedInvoiceEl && d.linkedInvoice != null) linkedInvoiceEl.value = d.linkedInvoice;
              if (vehicleNoEl && d.logistics?.vehicleNo != null) vehicleNoEl.value = d.logistics.vehicleNo;
              if (driverInfoEl && d.logistics?.driverInfo != null) driverInfoEl.value = d.logistics.driverInfo;
              if (packageCountEl && d.logistics?.packageCount != null) packageCountEl.value = d.logistics.packageCount;
              if (d.items && d.items.length) {
                itemRowsEl.innerHTML = '';
                d.items.forEach(addRowFromData);
              }
              renderQR(qrContainer, buildQRText());
            } else {
              localStorage.removeItem(`ai_challan_draft_${ch.challanNumber}`);
            }
          } catch (e) {
            localStorage.removeItem(`ai_challan_draft_${ch.challanNumber}`);
          }
        }
        syncPrintDisplayValues();
        return;
      }
    } else if (params.qtn) {
      const q = getQuotationByNumber(params.qtn);
      if (q) {
        challanNumberEl.value = peekNextChallanNumber();
        challanDateEl.value = q.date || (typeof toLocalISODate === 'function' ? toLocalISODate() : '');
        clientNameEl.value = q.to?.company || q.to?.name || '';
        deliveryAddressEl.value = q.to?.address || '';
        if (docTitleInput) docTitleInput.value = q.subject || '';
        if (docTitleHeader) docTitleHeader.textContent = q.subject || '';
        itemRowsEl.innerHTML = '';
        (q.items || []).forEach(it => {
          addRowFromData({ name: it.name || it.desc || '', desc: it.name ? (it.desc || '') : '', qty: it.qty || 1, unit: it.unit || 'Pcs' });
        });
        renderQR(qrContainer, buildQRText());
        updateModeBadge(false);
        syncPrintDisplayValues();
        return;
      }
    } else if (params.inv) {
      let inv = getInvoiceByNumber(params.inv);
      if (!inv && typeof getDiskInvoiceByNumber === 'function') {
        try { inv = await getDiskInvoiceByNumber(params.inv); } catch (e) { }
      }
      if (inv) {
        if (inv.billerId && typeof setActiveBillerId === 'function' && getActiveBillerId() !== inv.billerId) {
          setActiveBillerId(inv.billerId);
        }
        challanNumberEl.value = peekNextChallanNumber(inv.billerId);
        challanDateEl.value = inv.date || (typeof toLocalISODate === 'function' ? toLocalISODate() : '');
        clientNameEl.value = inv.client?.name || '';
        deliveryAddressEl.value = inv.client?.address || '';
        if (docTitleInput) docTitleInput.value = inv.title || '';
        if (docTitleHeader) docTitleHeader.textContent = inv.title || '';
        if (linkedInvoiceEl) linkedInvoiceEl.value = inv.invoiceNumber || params.inv;
        itemRowsEl.innerHTML = '';
        (inv.items || []).forEach(it => {
          const catItem = (typeof getItemByName === 'function' && it.name) ? getItemByName(it.name) : null;
          addRowFromData({
            name: it.name || '',
            desc: it.desc || '',
            qty: it.qty || 1,
            unit: it.unit || catItem?.unit || 'Pcs'
          });
        });
        renderQR(qrContainer, buildQRText());
        updateModeBadge(false);
        syncPrintDisplayValues();
        return;
      }
    }

    // New document flow
    updateModeBadge(false);
    challanNumberEl.value = peekNextChallanNumber();

    const savedDraft = localStorage.getItem('ai_challan_draft_new') || localStorage.getItem('ai_challan_draft');
    if (savedDraft) {
      try {
        const draft = JSON.parse(savedDraft);
        if (draft && (draft.client?.name || (draft.items && draft.items.length))) {
          const restore = confirm('Unsaved challan draft found. Would you like to restore it?');
          if (restore) {
            challanNumberEl.value = draft.challanNumber || challanNumberEl.value;
            challanDateEl.value = draft.date || (typeof toLocalISODate === 'function' ? toLocalISODate() : '');
            clientNameEl.value = draft.client?.name || '';
            deliveryAddressEl.value = draft.deliveryAddress || '';
            if (docTitleInput) docTitleInput.value = draft.title || '';
            if (docTitleHeader) docTitleHeader.textContent = draft.title || '';
            if (linkedInvoiceEl && draft.linkedInvoice) linkedInvoiceEl.value = draft.linkedInvoice;
            if (vehicleNoEl && draft.logistics?.vehicleNo) vehicleNoEl.value = draft.logistics.vehicleNo;
            if (driverInfoEl && draft.logistics?.driverInfo) driverInfoEl.value = draft.logistics.driverInfo;
            if (packageCountEl && draft.logistics?.packageCount) packageCountEl.value = draft.logistics.packageCount;
            itemRowsEl.innerHTML = '';
            (draft.items || []).forEach(addRowFromData);
            renderQR(qrContainer, buildQRText());
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

    // Defaults for fresh document
    challanDateEl.value = typeof toLocalISODate === 'function' ? toLocalISODate() : new Date().toISOString().slice(0, 10);

    try {
      const lastClient = JSON.parse(localStorage.getItem(LAST_CLIENT_KEY) || '{}');
      if (lastClient.name) {
        clientNameEl.value = lastClient.name;
        deliveryAddressEl.value = lastClient.address || '';
      }
    } catch (e) {
      console.warn('Failed to load last client', e);
    }

    itemRowsEl.innerHTML = '';
    addRow();
    renderQR(qrContainer, buildQRText());
    syncPrintDisplayValues();
  })();

  // Toggle auto/manual numbering
  numberModeEl.addEventListener('change', () => {
    const isAuto = numberModeEl.value === 'auto';
    challanNumberEl.readOnly = isAuto;
    if (isAuto) {
      challanNumberEl.value = peekNextChallanNumber();
    }
    syncPrintDisplayValues();
  });

  challanNumberEl.addEventListener('input', () => {
    syncPrintDisplayValues();
    debouncedRenderQR();
  });
  challanDateEl.addEventListener('change', () => {
    syncPrintDisplayValues();
    debouncedRenderQR();
  });
  clientNameEl.addEventListener('input', () => {
    syncPrintDisplayValues();
    debouncedRenderQR();
  });
  if (deliveryAddressEl) {
    deliveryAddressEl.addEventListener('input', syncPrintDisplayValues);
  }
  [linkedInvoiceEl, vehicleNoEl, driverInfoEl, packageCountEl].forEach(el => {
    if (el) el.addEventListener('input', syncPrintDisplayValues);
  });

  if (addRowBtn) {
    addRowBtn.addEventListener('click', () => addRow());
  }

  // Auto-save every 5s with draft isolation (only after user edits)
  setInterval(() => {
    if (!isDirty) return;
    const record = buildChallanRecord();
    localStorage.setItem(getDraftKey(), JSON.stringify(record));
  }, 5000);

  // Sync title into header
  if (docTitleInput && docTitleHeader) {
    docTitleHeader.textContent = docTitleInput.value.trim();
    docTitleInput.addEventListener('input', () => {
      docTitleHeader.textContent = docTitleInput.value.trim();
      syncPrintDisplayValues();
      debouncedRenderQR();
    });
  }

  // Actions
  saveBtn.addEventListener('click', () => {
    const record = buildChallanRecord();
    const validMsg = validateRecord(record);
    if (validMsg) { showToast(validMsg, 'warning'); return; }
    saveChallan(record);
    localStorage.setItem(LAST_CLIENT_KEY, JSON.stringify(record.client));
    finalizeChallanNumber(record.challanNumber);
    activeParams = Object.assign({}, activeParams, { no: record.challanNumber });
    isDirty = false;
    clearDraft();
    updateModeBadge(true, record.challanNumber);
    if (clientOnboarding) clientOnboarding.refresh(record.client?.name);
    if (typeof saveItem === 'function' && Array.isArray(record.items)) {
      record.items.forEach(it => {
        if (it.name) saveItem({ name: it.name, desc: it.desc, unit: it.unit || 'Pcs' }, { preserveExisting: true });
      });
      if (itemCatalog) itemCatalog.refresh();
    }
    const targetInvNo = (record.linkedInvoice || activeParams?.inv || '').trim();
    if (targetInvNo && typeof getInvoiceByNumber === 'function' && typeof saveInvoice === 'function') {
      const linkedInv = getInvoiceByNumber(targetInvNo);
      if (linkedInv && !linkedInv.linkedChallan) {
        linkedInv.linkedChallan = record.challanNumber;
        saveInvoice(linkedInv);
      }
    }
    syncPrintDisplayValues();
    showToast('Challan saved successfully.', 'success');
  });

  if (createInvoiceBtn) {
    createInvoiceBtn.addEventListener('click', () => {
      const record = buildChallanRecord();
      const validMsg = validateRecord(record);
      if (validMsg) { showToast(`Cannot create invoice: ${validMsg}`, 'warning'); return; }
      saveChallan(record);
      finalizeChallanNumber(record.challanNumber);
      const url = `invoice.html?ch=${encodeURIComponent(record.challanNumber)}`;
      window.open(url, '_blank');
    });
  }

  if (duplicateChallanBtn) {
    duplicateChallanBtn.addEventListener('click', () => {
      const nextNo = peekNextChallanNumber();
      challanNumberEl.value = nextNo;
      const today = typeof toLocalISODate === 'function' ? toLocalISODate() : new Date().toISOString().slice(0, 10);
      challanDateEl.value = today;
      activeParams = {}; // switch to fresh draft scope
      clearDraft();
      updateModeBadge(false);
      isDirty = true;
      syncPrintDisplayValues();
      renderQR(qrContainer, buildQRText());
      showToast(`Duplicated as new challan ${nextNo}. Click Save when ready.`, 'info');
    });
  }

  // Global Ctrl+S shortcut to save
  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      saveBtn.click();
    }
  });

  printBtn.addEventListener('click', () => {
    prepareForPrint();
    window.print();
  });
  if (typeof initPdfDownloadButton === 'function') {
    initPdfDownloadButton('downloadPdfBtn', prepareForPrint, () => {
      if (typeof setPrintDocumentTitle === 'function') {
        return setPrintDocumentTitle(challanNumberEl?.value || 'Challan', clientNameEl?.value || '');
      }
      return challanNumberEl?.value || 'Challan';
    });
  }
  if (typeof runAutoPrintIfRequested === 'function') {
    runAutoPrintIfRequested(prepareForPrint);
  }
  resetBtn.addEventListener('click', () => {
    if (confirm('Clear all fields?')) {
      const csEl = document.getElementById('clientSelect');
      if (csEl) csEl.value = '';
      clientNameEl.value = '';
      deliveryAddressEl.value = '';
      if (docTitleInput) docTitleInput.value = '';
      if (docTitleHeader) docTitleHeader.textContent = '';
      if (linkedInvoiceEl) linkedInvoiceEl.value = '';
      if (vehicleNoEl) vehicleNoEl.value = '';
      if (driverInfoEl) driverInfoEl.value = '';
      if (packageCountEl) packageCountEl.value = '';
      challanDateEl.value = typeof toLocalISODate === 'function' ? toLocalISODate() : new Date().toISOString().slice(0, 10);
      itemRowsEl.innerHTML = '';
      addRow();
      isDirty = false;
      activeParams = {};
      if (typeof history !== 'undefined' && window.location.search) {
        try { history.replaceState(null, '', window.location.pathname); } catch (_) { }
      }
      if (challanNumberEl) challanNumberEl.value = peekNextChallanNumber();
      renderQR(qrContainer, buildQRText());
      clearDraft();
      updateModeBadge(false);
      syncPrintDisplayValues();
    }
  });
  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
      const record = buildChallanRecord();
      const titleSlug = slugify(record.title || '');
      const fname = `challan_${record.challanNumber}${titleSlug ? '_' + titleSlug : ''}.json`;
      downloadJSON(fname, record);
      showToast('JSON downloaded. Move it to records/challans and update index.json to preload in Search.', 'info');
    });
  }

  const shareWhatsAppBtn = document.getElementById('shareWhatsAppBtn');
  const shareEmailBtn = document.getElementById('shareEmailBtn');

  function getShareData() {
    const record = buildChallanRecord();
    const clientName = record.client?.name || 'Valued Customer';
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
    return {
      number: record.challanNumber,
      date: record.date,
      clientName: clientName,
      clientPhone: clientPhone,
      clientEmail: clientEmail,
      items: record.items || [],
      billerName: typeof getActiveBiller === 'function' ? getActiveBiller()?.name : ''
    };
  }

  if (shareWhatsAppBtn) {
    shareWhatsAppBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (typeof shareDocumentWhatsApp === 'function') {
        shareDocumentWhatsApp('challan', getShareData());
      }
    });
  }

  if (shareEmailBtn) {
    shareEmailBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (typeof shareDocumentEmail === 'function') {
        shareDocumentEmail('challan', getShareData());
      }
    });
  }

  function syncChallanRowMirrors(tr) {
    if (!tr) return;
    const nEl = tr.querySelector('.item-name-input');
    const dEl = tr.querySelector('.item-desc-input');
    const qEl = tr.querySelector('.qty');
    const uEl = tr.querySelector('.unit');
    const nM = tr.querySelector('.item-print-name');
    const dM = tr.querySelector('.item-print-desc');
    const qM = tr.querySelector('.item-print-qty');
    const uM = tr.querySelector('.item-print-unit');
    if (nM && nEl) nM.textContent = nEl.value;
    if (dM && dEl) dM.textContent = dEl.value;
    if (qM && qEl) qM.textContent = qEl.value || '0';
    if (uM && uEl) uM.textContent = uEl.value || 'Pcs';
  }

  function addRowFromData(row) {
    const tr = document.createElement('tr');
    const rowNum = itemRowsEl.children.length + 1;
    const qtyVal = row.qty || 0;
    const unitVal = row.unit || 'Pcs';
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
        <input type="text" inputmode="decimal" class="form-control form-control-sm text-center qty no-print" aria-label="Quantity, row ${rowNum}" value="${escapeAttr(qtyVal)}" />
        <span class="print-only item-print-qty">${escapeHTML(String(qtyVal))}</span>
      </td>
      <td class="text-center">
        <input type="text" class="form-control form-control-sm text-center unit no-print" list="unitSuggestions" placeholder="Pcs" aria-label="Unit, row ${rowNum}" value="${escapeAttr(unitVal)}" />
        <span class="print-only item-print-unit">${escapeHTML(unitVal)}</span>
      </td>
      <td class="action-col no-print"><button class="btn btn-sm btn-outline-danger" aria-label="Delete item, row ${rowNum}">Delete</button></td>
    `;
    attachRowEvents(tr);
    itemRowsEl.appendChild(tr);
    adjustColumnWidths();
  }

  function addRow() { addRowFromData({ qty: 0, unit: 'Pcs' }); }

  function attachRowEvents(tr) {
    const delBtn = tr.querySelector('button');
    tr.querySelectorAll('.auto-grow').forEach(el => {
      const resize = () => { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; };
      resize();
      el.addEventListener('input', resize);
    });
    const nameEl = tr.querySelector('.item-name-input');
    if (nameEl) {
      nameEl.addEventListener('change', () => {
        const val = nameEl.value.trim().toLowerCase();
        if (!val || typeof loadItems !== 'function') return;
        const matched = loadItems().find(it => (it.name || '').toLowerCase() === val);
        if (matched) {
          const descEl = tr.querySelector('.item-desc-input');
          if (descEl && (!descEl.value || descEl.value.trim() === '')) {
            descEl.value = matched.desc || '';
            descEl.style.height = 'auto';
            descEl.style.height = descEl.scrollHeight + 'px';
          }
          const unitInput = tr.querySelector('.unit');
          if (unitInput && (!unitInput.value || unitInput.value === 'Pcs')) {
            unitInput.value = matched.unit || 'Pcs';
          }
          syncChallanRowMirrors(tr);
        }
      });
    }
    delBtn.addEventListener('click', () => {
      const name = tr.querySelector('.item-name-input')?.value.trim() || '';
      const desc = tr.querySelector('.item-desc-input')?.value.trim() || '';
      const qty = parseFloat((tr.querySelector('.qty')?.value || '0').replace(/[^0-9.]/g, '')) || 0;
      if (name || desc || qty > 0) {
        if (!confirm('Are you sure you want to remove this item row?')) return;
      }
      tr.remove();
      debouncedRenderQR();
      adjustColumnWidths();
    });

    const unitEl = tr.querySelector('.unit');
    if (unitEl) {
      unitEl.addEventListener('keydown', (e) => {
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

    tr.querySelectorAll('input, textarea').forEach(el => el.addEventListener('input', () => {
      syncChallanRowMirrors(tr);
      debouncedRenderQR();
      adjustColumnWidths();
    }));
  }

  function buildQRText() {
    const num = challanNumberEl.value;
    const date = challanDateEl.value;
    const client = clientNameEl.value || '';
    const activeBiller = typeof getActiveBiller === 'function' ? getActiveBiller() : (typeof COMPANY !== 'undefined' ? COMPANY : {});
    return buildQRPayload('CHAL', {
      number: num,
      date,
      client,
      company: activeBiller.name || (typeof COMPANY !== 'undefined' ? COMPANY.name : '')
    });
  }

  renderQR(qrContainer, buildQRText());
  adjustColumnWidths();

  function buildChallanRecord() {
    const items = [];
    itemRowsEl.querySelectorAll('tr').forEach(tr => {
      const rawQty = String(tr.querySelector('.qty')?.value || '0').replace(/[^0-9.]/g, '');
      items.push({
        name: (tr.querySelector('.item-name-input')?.value || '').trim(),
        desc: (tr.querySelector('.item-desc-input')?.value || '').trim(),
        qty: parseFloat(rawQty) || 0,
        unit: (tr.querySelector('.unit')?.value || 'Pcs').trim() || 'Pcs',
      });
    });
    const existingCh = challanNumberEl.value ? getChallanByNumber(challanNumberEl.value) : null;
    const linkedInvNo = linkedInvoiceEl ? linkedInvoiceEl.value.trim() : '';
    const linkedInvObj = linkedInvNo && typeof getInvoiceByNumber === 'function' ? getInvoiceByNumber(linkedInvNo) : null;
    const activeBillerId = existingCh?.billerId || linkedInvObj?.billerId || (typeof getActiveBillerId === 'function' ? getActiveBillerId() : 'biller_default');
    const targetBiller = (typeof getBillerById === 'function' && activeBillerId ? getBillerById(activeBillerId) : null)
      || (typeof getActiveBiller === 'function' ? getActiveBiller() : (typeof COMPANY !== 'undefined' ? COMPANY : {}));
    return {
      id: existingCh?.id,
      createdAt: existingCh?.createdAt,
      status: existingCh?.status,
      _type: 'challan',
      billerId: activeBillerId,
      challanNumber: challanNumberEl.value,
      date: challanDateEl.value,
      linkedInvoice: linkedInvNo,
      logistics: {
        vehicleNo: vehicleNoEl ? vehicleNoEl.value.trim() : '',
        driverInfo: driverInfoEl ? driverInfoEl.value.trim() : '',
        packageCount: packageCountEl ? packageCountEl.value.trim() : ''
      },
      client: { name: clientNameEl.value.trim(), address: deliveryAddressEl.value.trim() },
      deliveryAddress: deliveryAddressEl.value.trim(),
      title: docTitleInput ? docTitleInput.value.trim() : '',
      items,
      qrData: buildQRText(),
      company: targetBiller
    };
  }

  // Dynamically adjust column widths based on content lengths (item vs desc)
  function adjustColumnWidths() {
    try {
      const table = document.getElementById('itemsTable');
      if (!table) return;
      let itemLen = 0, descLen = 0, itemCount = 0, descCount = 0;
      table.querySelectorAll('tbody tr').forEach(tr => {
        const itemVal = (tr.querySelector('.item-name-input')?.value || '').length;
        const descVal = (tr.querySelector('.item-desc-input')?.value || '').length;
        itemLen += itemVal; descLen += descVal; itemCount++; descCount++;
      });
      const avgItem = itemCount ? itemLen / itemCount : 0;
      const avgDesc = descCount ? descLen / descCount : 0;
      const free = 76;
      const minItem = 24, minDesc = 24;
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
      const tbl = document.querySelector('.challan-table');
      if (tbl) {
        tbl.style.setProperty('--w-item', wItem + '%');
        tbl.style.setProperty('--w-desc', wDesc + '%');
        tbl.style.setProperty('--w-qty', '12%');
        tbl.style.setProperty('--w-unit', '12%');
        tbl.style.setProperty('--w-action', '8%');
      }
    } catch (e) {
      console.warn('adjustColumnWidths (challan) failed', e);
    }
  }

  // Prepare for print: expand textareas, sync mirrors and adjust widths
  function prepareForPrint() {
    itemRowsEl.querySelectorAll('tr').forEach(syncChallanRowMirrors);
    syncPrintDisplayValues();
    renderQR(qrContainer, buildQRText());
    if (typeof setPrintDocumentTitle === 'function') {
      setPrintDocumentTitle(challanNumberEl?.value || 'Challan', clientNameEl?.value || '');
    }
    document.querySelectorAll('textarea').forEach(el => {
      el.style.height = 'auto';
      el.style.height = el.scrollHeight + 'px';
    });
    adjustColumnWidths();
  }
  window.addEventListener('beforeprint', prepareForPrint);

  function validateRecord(rec) {
    if (!rec.client?.name) return 'Bill To (client name) is required.';
    if (!rec.items?.length) return 'Add at least one item.';
    const hasQty = rec.items.some(it => Number(it.qty) > 0);
    if (!hasQty) return 'Item quantity must be greater than 0.';
    return '';
  }

  window.addEventListener('billerchange', () => {
    if (typeof setCompanyHeader === 'function') {
      setCompanyHeader();
    }
    const params = new URLSearchParams(window.location.search);
    const isEditing = params.get('no') || params.get('id') || params.get('load') || activeParams?.no;
    if (!isEditing && challanNumberEl) {
      challanNumberEl.value = peekNextChallanNumber();
    }
    syncPrintDisplayValues();
    renderQR(qrContainer, buildQRText());
  });
});
