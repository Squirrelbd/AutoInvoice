// Multi-Biller UI Component & Modal Engine
// Provides navbar active biller switcher and management modal across all pages

(function () {
  const COLOR_PRESETS = [
    { label: 'Classic Navy', hex: '#0b3969' },
    { label: 'Emerald Teal', hex: '#0b8f8f' },
    { label: 'Royal Blue', hex: '#2563eb' },
    { label: 'Forest Green', hex: '#15803d' },
    { label: 'Deep Indigo', hex: '#6366f1' },
    { label: 'Crimson Ruby', hex: '#b91c1c' },
  ];

  function applyActiveTheme() {
    if (typeof getActiveBiller === 'function') {
      const active = getActiveBiller();
      if (active && active.themeColor) {
        document.documentElement.style.setProperty('--brand-color', active.themeColor);
        document.documentElement.style.setProperty('--color-primary', active.themeColor);
        document.documentElement.style.setProperty('--highlight-color', active.themeColor);
      }
    }
  }

  function renderNavbarSwitcher() {
    const navbarNav = document.querySelector('#mainNavbar .navbar-nav');
    const themeToggle = document.getElementById('themeToggle');
    const container = themeToggle?.parentElement || navbarNav?.parentElement;
    if (!container || document.getElementById('billerSwitcherContainer')) return;

    const wrap = document.createElement('div');
    wrap.id = 'billerSwitcherContainer';
    wrap.className = 'dropdown biller-dropdown no-print me-2';

    const active = typeof getActiveBiller === 'function' ? getActiveBiller() : null;
    const activeName = active?.name || 'Amirul Islam';
    const activeLogo = active?.logoDataUri || 'assets/logo.svg';

    wrap.innerHTML = `
      <button class="btn btn-outline-secondary btn-sm dropdown-toggle d-flex align-items-center gap-2 shadow-sm" type="button" id="billerDropdownBtn" data-bs-toggle="dropdown" aria-expanded="false" title="Switch active biller">
        <img id="navBillerLogo" src="${escapeAttr(activeLogo)}" width="18" height="18" class="rounded-1" alt="Logo" style="object-fit: contain;" />
        <span id="navBillerName" class="fw-semibold text-truncate" style="max-width: 140px;">${escapeHTML(activeName)}</span>
      </button>
      <ul class="dropdown-menu dropdown-menu-end shadow-sm" aria-labelledby="billerDropdownBtn" id="billerDropdownList" style="min-width: 220px;">
        <!-- Injected dynamically -->
      </ul>
    `;

    if (themeToggle) {
      container.insertBefore(wrap, themeToggle);
    } else {
      container.appendChild(wrap);
    }

    updateDropdownMenu();
  }

  function updateDropdownMenu() {
    const listEl = document.getElementById('billerDropdownList');
    if (!listEl || typeof loadBillers !== 'function') return;

    const billers = loadBillers();
    const activeId = typeof getActiveBillerId === 'function' ? getActiveBillerId() : '';

    let itemsHtml = `
      <li class="dropdown-header small text-uppercase fw-bold text-muted pb-1">🏢 Active Entity</li>
    `;

    billers.forEach(b => {
      const isSelected = b.id === activeId;
      const safeColor = typeof _safeHexColor === 'function' ? _safeHexColor(b.themeColor) : '#0b3969';
      itemsHtml += `
        <li>
          <a class="dropdown-item d-flex align-items-center justify-content-between py-2 biller-select-item ${isSelected ? 'active fw-semibold' : ''}" href="#" data-biller-id="${escapeAttr(b.id)}">
            <span class="d-flex align-items-center gap-2 text-truncate me-2">
              <span class="rounded-circle d-inline-block" style="width: 10px; height: 10px; background-color: ${escapeAttr(safeColor)};"></span>
              ${escapeHTML(b.name)}
            </span>
            ${isSelected ? '<span>✓</span>' : ''}
          </a>
        </li>
      `;
    });

    itemsHtml += `
      <li><hr class="dropdown-divider my-1"></li>
      <li>
        <button class="dropdown-item d-flex align-items-center gap-2 text-primary fw-medium" type="button" id="openNewBillerBtn">
          <span>➕</span> Add New Biller...
        </button>
      </li>
      <li>
        <button class="dropdown-item d-flex align-items-center gap-2" type="button" id="openManageBillersBtn">
          <span>⚙️</span> Manage All Billers...
        </button>
      </li>
    `;

    listEl.innerHTML = itemsHtml;

    // Attach listeners
    listEl.querySelectorAll('.biller-select-item').forEach(el => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        const id = el.getAttribute('data-biller-id');
        if (id && typeof setActiveBillerId === 'function') {
          setActiveBillerId(id);
          updateNavbarBrand();
          updateDropdownMenu();
          applyActiveTheme();
          if (typeof setCompanyHeader === 'function') {
            setCompanyHeader();
          }
          if (typeof showToast === 'function') {
            const b = getBillerById(id);
            showToast(`Switched active biller to "${b?.name || id}"`, 'success');
          }
        }
      });
    });

    const newBtn = document.getElementById('openNewBillerBtn');
    if (newBtn) {
      newBtn.addEventListener('click', () => openBillerModal(null));
    }
    const manageBtn = document.getElementById('openManageBillersBtn');
    if (manageBtn) {
      manageBtn.addEventListener('click', () => openBillerModal('list'));
    }
  }

  function updateNavbarBrand() {
    const active = typeof getActiveBiller === 'function' ? getActiveBiller() : null;
    if (!active) return;
    const nameEl = document.getElementById('navBillerName');
    const logoEl = document.getElementById('navBillerLogo');
    if (nameEl) nameEl.textContent = active.name;
    if (logoEl) logoEl.src = active.logoDataUri || 'assets/logo.svg';
  }

  function injectBillerModal() {
    if (document.getElementById('billerManageModal')) return;

    const modalHtml = `
      <div class="modal fade no-print" id="billerManageModal" tabindex="-1" aria-labelledby="billerManageModalLabel" aria-hidden="true">
        <div class="modal-dialog modal-lg modal-dialog-scrollable">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title fw-bold" id="billerManageModalLabel">🏢 Biller Profiles & Branding</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body p-4">
              <!-- View A: Profiles List -->
              <div id="billerListView">
                <div class="d-flex justify-content-between align-items-center mb-3">
                  <p class="text-muted small mb-0">Configure multiple companies, logos, themes, and isolated document numbering sequences.</p>
                  <div class="d-flex align-items-center gap-2">
                    <button type="button" class="btn btn-outline-secondary btn-sm" id="exportBillersBtn" title="Download JSON backup of billers">📥 Export</button>
                    <button type="button" class="btn btn-outline-secondary btn-sm" id="importBillersBtn" title="Import JSON backup of billers">📤 Import</button>
                    <input type="file" id="importBillersFileInput" accept=".json" style="display: none;" aria-label="Import biller profiles JSON file" />
                    <button type="button" class="btn btn-primary btn-sm" id="addNewBillerFormBtn">➕ Add Biller</button>
                  </div>
                </div>
                <div class="list-group mb-3" id="billerProfilesList">
                  <!-- Injected dynamically -->
                </div>
              </div>

              <!-- View B: Add / Edit Form -->
              <form id="billerEditForm" style="display: none;">
                <input type="hidden" id="billerFormId" value="" />
                
                <div class="d-flex justify-content-between align-items-center mb-3">
                  <h6 class="fw-bold mb-0 text-primary" id="billerFormTitle">New Biller Profile</h6>
                  <button type="button" class="btn btn-outline-secondary btn-sm" id="backToBillerListBtn">← Back to List</button>
                </div>

                <div class="row g-3">
                  <!-- Company Basic Info -->
                  <div class="col-md-7">
                    <label for="billerFormName" class="form-label small fw-semibold">Company / Biller Name *</label>
                    <input type="text" class="form-control" id="billerFormName" required placeholder="e.g. Apex Embedded Systems Ltd" />
                  </div>
                  <div class="col-md-5">
                    <label for="billerFormTaxId" class="form-label small fw-semibold">Tax ID / BIN / TIN</label>
                    <input type="text" class="form-control" id="billerFormTaxId" placeholder="e.g. BIN-001234567" />
                  </div>
                  <div class="col-12">
                    <label for="billerFormSlogan" class="form-label small fw-semibold">Tagline / Business Slogan</label>
                    <input type="text" class="form-control" id="billerFormSlogan" placeholder="e.g. Industrial Automation & Embedded Solutions" />
                  </div>
                  <div class="col-12">
                    <label for="billerFormAddress" class="form-label small fw-semibold">Registered Office Address</label>
                    <textarea class="form-control" id="billerFormAddress" rows="2" placeholder="e.g. Plot 12, Banasree, Rampura, Dhaka-1219"></textarea>
                  </div>
                  <div class="col-md-6">
                    <label for="billerFormPhone" class="form-label small fw-semibold">Contact Phone</label>
                    <input type="text" class="form-control" id="billerFormPhone" placeholder="e.g. +8801747144755" />
                  </div>
                  <div class="col-md-6">
                    <label for="billerFormEmail" class="form-label small fw-semibold">Billing Email</label>
                    <input type="email" class="form-control" id="billerFormEmail" placeholder="e.g. billing@company.com" />
                  </div>

                  <!-- Branding: Logo & Theme Color -->
                  <div class="col-12"><hr class="my-2"></div>
                  <div class="col-md-6">
                    <label for="billerLogoInput" class="form-label small fw-semibold d-block">Company Logo</label>
                    <div class="d-flex align-items-center gap-3">
                      <div class="p-2 border rounded bg-body shadow-sm d-flex align-items-center justify-content-center" style="width: 60px; height: 60px;">
                        <img id="billerLogoPreview" src="assets/logo.svg" alt="Logo Preview" style="max-width: 100%; max-height: 100%; object-fit: contain;" />
                      </div>
                      <div class="flex-grow-1">
                        <input type="file" class="form-control form-control-sm" id="billerLogoInput" accept="image/*" aria-label="Upload Company Logo Image" />
                        <div class="form-text small">PNG, SVG, or JPEG (saved locally in storage)</div>
                      </div>
                    </div>
                  </div>

                  <div class="col-md-6">
                    <label for="billerColorHex" class="form-label small fw-semibold d-block">Brand Accent Theme Color</label>
                    <div class="d-flex align-items-center gap-2 mb-2" id="colorPresetGroup">
                      ${COLOR_PRESETS.map(p => `
                        <button type="button" class="btn p-0 rounded-circle color-preset-btn border" data-color="${p.hex}" title="${p.label}" aria-label="Select theme color ${escapeAttr(p.label)}" style="width: 24px; height: 24px; background-color: ${p.hex};"></button>
                      `).join('')}
                    </div>
                    <div class="input-group input-group-sm" style="max-width: 180px;">
                      <input type="color" class="form-control form-control-color" id="billerColorPicker" value="#0b3969" title="Choose custom color" aria-label="Pick brand color" />
                      <input type="text" class="form-control" id="billerColorHex" value="#0b3969" maxlength="7" aria-label="Brand Accent Hex Color" />
                    </div>
                  </div>

                  <!-- Digital Signature & Authorized Signatory -->
                  <div class="col-12"><hr class="my-2"></div>
                  <div class="col-md-6">
                    <label for="billerSigInput" class="form-label small fw-semibold d-block">Digital Signature / Seal</label>
                    <div class="d-flex align-items-center gap-3">
                      <div class="p-2 border rounded bg-body shadow-sm d-flex align-items-center justify-content-center" style="width: 130px; height: 60px;">
                        <img id="billerSigPreview" src="" alt="Signature Preview" style="max-width: 100%; max-height: 100%; object-fit: contain;" class="d-none" />
                        <span id="billerSigPlaceholder" class="text-muted smaller">No signature</span>
                      </div>
                      <div class="flex-grow-1">
                        <input type="file" class="form-control form-control-sm mb-1" id="billerSigInput" accept="image/*" aria-label="Upload Digital Signature Image" />
                        <div class="d-flex align-items-center justify-content-between">
                          <span class="form-text small">PNG, SVG, or JPEG</span>
                          <button type="button" class="btn btn-link btn-sm text-danger p-0 text-decoration-none d-none" id="clearBillerSigBtn">Remove</button>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div class="col-md-6">
                    <div class="row g-2">
                      <div class="col-12">
                        <label for="billerSignatoryName" class="form-label small fw-semibold">Signatory Name</label>
                        <input type="text" class="form-control form-control-sm" id="billerSignatoryName" placeholder="e.g. Engr. Amirul Islam" />
                      </div>
                      <div class="col-12">
                        <label for="billerSignatoryTitle" class="form-label small fw-semibold">Signatory Designation / Title</label>
                        <input type="text" class="form-control form-control-sm" id="billerSignatoryTitle" placeholder="e.g. Managing Director / CEO" />
                      </div>
                    </div>
                  </div>

                  <!-- Numbering Prefixes -->
                  <div class="col-12"><hr class="my-2"></div>
                  <div class="col-12">
                    <label class="form-label small fw-semibold mb-1">Document Numbering Prefixes</label>
                    <div class="row g-2">
                      <div class="col-6 col-sm">
                        <label for="prefixInvoice" class="form-label text-muted small mb-0">Invoice</label>
                        <input type="text" class="form-control form-control-sm" id="prefixInvoice" value="INV" placeholder="INV" />
                      </div>
                      <div class="col-6 col-sm">
                        <label for="prefixChallan" class="form-label text-muted small mb-0">Challan</label>
                        <input type="text" class="form-control form-control-sm" id="prefixChallan" value="CH" placeholder="CH" />
                      </div>
                      <div class="col-6 col-sm">
                        <label for="prefixQuotation" class="form-label text-muted small mb-0">Quotation</label>
                        <input type="text" class="form-control form-control-sm" id="prefixQuotation" value="QTN" placeholder="QTN" />
                      </div>
                      <div class="col-6 col-sm">
                        <label for="prefixReceipt" class="form-label text-muted small mb-0">Receipt</label>
                        <input type="text" class="form-control form-control-sm" id="prefixReceipt" value="RCPT" placeholder="RCPT" />
                      </div>
                      <div class="col-6 col-sm">
                        <label for="prefixExpense" class="form-label text-muted small mb-0">Expense</label>
                        <input type="text" class="form-control form-control-sm" id="prefixExpense" value="EXP" placeholder="EXP" />
                      </div>
                    </div>
                  </div>

                  <!-- Bank & MFS Remittance Instructions -->
                  <div class="col-12"><hr class="my-2"></div>
                  <div class="col-12">
                    <label class="form-label small fw-semibold mb-1">Bank &amp; MFS Remittance Details (Shown on Invoices &amp; Statements)</label>
                    <div class="row g-2">
                      <div class="col-md-4">
                        <input type="text" class="form-control form-control-sm" id="remBankName" placeholder="Bank Name (e.g. BRAC Bank)" aria-label="Bank Name" />
                      </div>
                      <div class="col-md-4">
                        <input type="text" class="form-control form-control-sm" id="remAccountName" placeholder="Account Title" aria-label="Account Title" />
                      </div>
                      <div class="col-md-4">
                        <input type="text" class="form-control form-control-sm" id="remAccountNo" placeholder="Account Number" aria-label="Account Number" />
                      </div>
                      <div class="col-md-4">
                        <input type="text" class="form-control form-control-sm" id="remBranch" placeholder="Branch Name" aria-label="Bank Branch" />
                      </div>
                      <div class="col-md-4">
                        <input type="text" class="form-control form-control-sm" id="remRoutingNo" placeholder="Routing Number" aria-label="Bank Routing Number" />
                      </div>
                      <div class="col-md-4">
                        <input type="text" class="form-control form-control-sm" id="remBkash" placeholder="bKash Merchant/Personal #" aria-label="bKash Number" />
                      </div>
                      <div class="col-md-4">
                        <input type="text" class="form-control form-control-sm" id="remNagad" placeholder="Nagad #" aria-label="Nagad Number" />
                      </div>
                      <div class="col-md-4">
                        <input type="text" class="form-control form-control-sm" id="remRocket" placeholder="Rocket #" aria-label="Rocket Number" />
                      </div>
                      <div class="col-md-4">
                        <input type="text" class="form-control form-control-sm" id="remInstructions" placeholder="Extra remittance note" aria-label="Extra remittance instructions" />
                      </div>
                    </div>
                  </div>

                  <div class="col-12 mt-3">
                    <div class="form-check">
                      <input class="form-check-input" type="checkbox" id="billerIsDefault" />
                      <label class="form-check-label small" for="billerIsDefault">Set as Primary Default Biller</label>
                    </div>
                  </div>
                </div>

                <div class="d-flex justify-content-end gap-2 mt-4 pt-2 border-top">
                  <button type="button" class="btn btn-secondary btn-sm" id="cancelBillerEditBtn">Cancel</button>
                  <button type="submit" class="btn btn-primary btn-sm" id="saveBillerSubmitBtn">💾 Save Profile</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
    initModalEvents();
  }

  function initModalEvents() {
    const listContainer = document.getElementById('billerProfilesList');
    const listView = document.getElementById('billerListView');
    const editForm = document.getElementById('billerEditForm');
    const addBtn = document.getElementById('addNewBillerFormBtn');
    const backBtn = document.getElementById('backToBillerListBtn');
    const cancelBtn = document.getElementById('cancelBillerEditBtn');
    const logoInput = document.getElementById('billerLogoInput');
    const logoPreview = document.getElementById('billerLogoPreview');
    const colorPicker = document.getElementById('billerColorPicker');
    const colorHex = document.getElementById('billerColorHex');

    // Color sync
    if (colorPicker && colorHex) {
      colorPicker.addEventListener('input', () => { colorHex.value = colorPicker.value; });
      colorHex.addEventListener('input', () => {
        if (/^#[0-9A-Fa-f]{6}$/.test(colorHex.value)) {
          colorPicker.value = colorHex.value;
        }
      });
    }

    // Color presets
    document.querySelectorAll('#colorPresetGroup .color-preset-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const c = btn.getAttribute('data-color');
        if (c && colorPicker && colorHex) {
          colorPicker.value = c;
          colorHex.value = c;
        }
      });
    });

    // Logo upload
    if (logoInput && logoPreview) {
      logoInput.addEventListener('change', () => {
        const file = logoInput.files?.[0];
        if (!file) return;
        if (file.size > 2 * 1024 * 1024) {
          if (typeof showToast === 'function') showToast('Logo image must be under 2MB', 'warning');
          return;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
          logoPreview.src = e.target.result;
        };
        reader.readAsDataURL(file);
      });
    }

    // Digital Signature upload & removal
    const sigInput = document.getElementById('billerSigInput');
    const sigPreview = document.getElementById('billerSigPreview');
    const sigPlaceholder = document.getElementById('billerSigPlaceholder');
    const clearSigBtn = document.getElementById('clearBillerSigBtn');

    if (sigInput && sigPreview) {
      sigInput.addEventListener('change', () => {
        const file = sigInput.files?.[0];
        if (!file) return;
        if (file.size > 1.5 * 1024 * 1024) {
          if (typeof showToast === 'function') showToast('Signature image must be under 1.5MB', 'warning');
          return;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
          sigPreview.src = e.target.result;
          sigPreview.classList.remove('d-none');
          if (sigPlaceholder) sigPlaceholder.classList.add('d-none');
          if (clearSigBtn) clearSigBtn.classList.remove('d-none');
        };
        reader.readAsDataURL(file);
      });
    }

    if (clearSigBtn) {
      clearSigBtn.addEventListener('click', () => {
        if (sigPreview) {
          sigPreview.src = '';
          sigPreview.classList.add('d-none');
        }
        if (sigPlaceholder) sigPlaceholder.classList.remove('d-none');
        if (clearSigBtn) clearSigBtn.classList.add('d-none');
        if (sigInput) sigInput.value = '';
      });
    }

    // Export & Import Billers
    const exportBtn = document.getElementById('exportBillersBtn');
    const importBtn = document.getElementById('importBillersBtn');
    const importInput = document.getElementById('importBillersFileInput');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        const billers = typeof loadBillers === 'function' ? loadBillers() : [];
        downloadBlob(`autoinvoice_billers_${new Date().toISOString().slice(0, 10)}.json`, new Blob([JSON.stringify(billers, null, 2)], { type: 'application/json' }));
        if (typeof showToast === 'function') showToast('Biller profiles exported as JSON.', 'success');
      });
    }
    if (importBtn && importInput) {
      importBtn.addEventListener('click', () => importInput.click());
      importInput.addEventListener('change', () => {
        const file = importInput.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const parsed = JSON.parse(e.target.result);
            const arr = Array.isArray(parsed) ? parsed : (Array.isArray(parsed.billers) ? parsed.billers : null);
            if (!arr || !arr.length) {
              alert('Invalid file format: No biller array found.');
              return;
            }
            let added = 0;
            arr.forEach(b => {
              if (b && b.name && typeof saveBiller === 'function') {
                saveBiller(b);
                added++;
              }
            });
            showList();
            updateNavbarBrand();
            updateDropdownMenu();
            applyActiveTheme();
            if (typeof setCompanyHeader === 'function') setCompanyHeader();
            if (typeof showToast === 'function') showToast(`Imported ${added} biller profile(s)!`, 'success');
          } catch (err) {
            alert('Failed to parse billers JSON: ' + err.message);
          } finally {
            importInput.value = '';
          }
        };
        reader.readAsText(file);
      });
    }

    // Switch between list and form
    if (addBtn) addBtn.addEventListener('click', () => showForm(null));
    if (backBtn) backBtn.addEventListener('click', showList);
    if (cancelBtn) cancelBtn.addEventListener('click', showList);

    // Form submit
    if (editForm) {
      editForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const id = document.getElementById('billerFormId').value;
        const name = document.getElementById('billerFormName').value.trim();
        if (!name) return;

        const billerData = {
          id: id || undefined,
          name,
          taxId: document.getElementById('billerFormTaxId').value.trim(),
          slogan: document.getElementById('billerFormSlogan').value.trim(),
          address: document.getElementById('billerFormAddress').value.trim(),
          phone: document.getElementById('billerFormPhone').value.trim(),
          email: document.getElementById('billerFormEmail').value.trim(),
          logoDataUri: logoPreview.getAttribute('src') || 'assets/logo.svg',
          signatureDataUri: (sigPreview && !sigPreview.classList.contains('d-none') && sigPreview.getAttribute('src')) ? sigPreview.getAttribute('src') : '',
          signatoryName: (document.getElementById('billerSignatoryName')?.value || '').trim(),
          signatoryTitle: (document.getElementById('billerSignatoryTitle')?.value || '').trim(),
          themeColor: colorHex.value || '#0b3969',
          prefixes: {
            invoice: document.getElementById('prefixInvoice').value.trim() || 'INV',
            challan: document.getElementById('prefixChallan').value.trim() || 'CH',
            quotation: document.getElementById('prefixQuotation').value.trim() || 'QTN',
            receipt: document.getElementById('prefixReceipt').value.trim() || 'RCPT',
            expense: document.getElementById('prefixExpense')?.value.trim() || 'EXP'
          },
          remittance: {
            bankName: document.getElementById('remBankName')?.value.trim() || '',
            accountName: document.getElementById('remAccountName')?.value.trim() || '',
            accountNo: document.getElementById('remAccountNo')?.value.trim() || '',
            branch: document.getElementById('remBranch')?.value.trim() || '',
            routingNo: document.getElementById('remRoutingNo')?.value.trim() || '',
            bkash: document.getElementById('remBkash')?.value.trim() || '',
            nagad: document.getElementById('remNagad')?.value.trim() || '',
            rocket: document.getElementById('remRocket')?.value.trim() || '',
            instructions: document.getElementById('remInstructions')?.value.trim() || ''
          },
          isDefault: document.getElementById('billerIsDefault').checked
        };

        if (typeof saveBiller === 'function') {
          const saved = saveBiller(billerData);
          if (billerData.isDefault || !id) {
            setActiveBillerId(saved.id);
          } else if (typeof getActiveBillerId === 'function' && getActiveBillerId() === saved.id) {
            window.dispatchEvent(new CustomEvent('billerchange', { detail: { billerId: saved.id } }));
          }
          if (typeof showToast === 'function') {
            showToast(`Biller "${saved.name}" saved successfully!`, 'success');
          }
          updateNavbarBrand();
          updateDropdownMenu();
          applyActiveTheme();
          if (typeof setCompanyHeader === 'function') {
            setCompanyHeader();
          }
          showList();
        }
      });
    }
  }

  function showList() {
    const listView = document.getElementById('billerListView');
    const editForm = document.getElementById('billerEditForm');
    if (listView) listView.style.display = 'block';
    if (editForm) editForm.style.display = 'none';
    renderBillerListItems();
    const addBtn = document.getElementById('addNewBillerFormBtn');
    if (addBtn && typeof addBtn.focus === 'function') addBtn.focus();
  }

  function showForm(biller) {
    const listView = document.getElementById('billerListView');
    const editForm = document.getElementById('billerEditForm');
    if (listView) listView.style.display = 'none';
    if (editForm) editForm.style.display = 'block';
    const nameInput = document.getElementById('billerFormName');
    if (nameInput && typeof nameInput.focus === 'function') setTimeout(() => nameInput.focus(), 0);

    const titleEl = document.getElementById('billerFormTitle');
    const idEl = document.getElementById('billerFormId');
    const nameEl = document.getElementById('billerFormName');
    const taxIdEl = document.getElementById('billerFormTaxId');
    const sloganEl = document.getElementById('billerFormSlogan');
    const addrEl = document.getElementById('billerFormAddress');
    const phoneEl = document.getElementById('billerFormPhone');
    const emailEl = document.getElementById('billerFormEmail');
    const logoPreview = document.getElementById('billerLogoPreview');
    const logoInput = document.getElementById('billerLogoInput');
    const sigInput = document.getElementById('billerSigInput');
    const sigPreview = document.getElementById('billerSigPreview');
    const sigPlaceholder = document.getElementById('billerSigPlaceholder');
    const clearSigBtn = document.getElementById('clearBillerSigBtn');
    const sigNameEl = document.getElementById('billerSignatoryName');
    const sigTitleEl = document.getElementById('billerSignatoryTitle');
    const colorPicker = document.getElementById('billerColorPicker');
    const colorHex = document.getElementById('billerColorHex');
    const prefInv = document.getElementById('prefixInvoice');
    const prefCh = document.getElementById('prefixChallan');
    const prefQtn = document.getElementById('prefixQuotation');
    const prefRcpt = document.getElementById('prefixReceipt');
    const prefExp = document.getElementById('prefixExpense');
    const isDefEl = document.getElementById('billerIsDefault');
    const remFields = [
      ['remBankName', 'bankName'],
      ['remAccountName', 'accountName'],
      ['remAccountNo', 'accountNo'],
      ['remBranch', 'branch'],
      ['remRoutingNo', 'routingNo'],
      ['remBkash', 'bkash'],
      ['remNagad', 'nagad'],
      ['remRocket', 'rocket'],
      ['remInstructions', 'instructions']
    ];

    if (logoInput) logoInput.value = '';
    if (sigInput) sigInput.value = '';

    if (biller) {
      if (titleEl) titleEl.textContent = `Edit Biller: ${biller.name}`;
      if (idEl) idEl.value = biller.id;
      if (nameEl) nameEl.value = biller.name || '';
      if (taxIdEl) taxIdEl.value = biller.taxId || '';
      if (sloganEl) sloganEl.value = biller.slogan || '';
      if (addrEl) addrEl.value = biller.address || '';
      if (phoneEl) phoneEl.value = biller.phone || '';
      if (emailEl) emailEl.value = biller.email || '';
      if (logoPreview) logoPreview.src = biller.logoDataUri || 'assets/logo.svg';
      if (sigNameEl) sigNameEl.value = biller.signatoryName || '';
      if (sigTitleEl) sigTitleEl.value = biller.signatoryTitle || '';
      if (biller.signatureDataUri) {
        if (sigPreview) {
          sigPreview.src = biller.signatureDataUri;
          sigPreview.classList.remove('d-none');
        }
        if (sigPlaceholder) sigPlaceholder.classList.add('d-none');
        if (clearSigBtn) clearSigBtn.classList.remove('d-none');
      } else {
        if (sigPreview) {
          sigPreview.src = '';
          sigPreview.classList.add('d-none');
        }
        if (sigPlaceholder) sigPlaceholder.classList.remove('d-none');
        if (clearSigBtn) clearSigBtn.classList.add('d-none');
      }
      if (colorPicker) colorPicker.value = biller.themeColor || '#0b3969';
      if (colorHex) colorHex.value = biller.themeColor || '#0b3969';
      if (prefInv) prefInv.value = biller.prefixes?.invoice || 'INV';
      if (prefCh) prefCh.value = biller.prefixes?.challan || 'CH';
      if (prefQtn) prefQtn.value = biller.prefixes?.quotation || 'QTN';
      if (prefRcpt) prefRcpt.value = biller.prefixes?.receipt || 'RCPT';
      if (prefExp) prefExp.value = biller.prefixes?.expense || 'EXP';
      if (isDefEl) isDefEl.checked = !!biller.isDefault;
      remFields.forEach(([elId, key]) => {
        const el = document.getElementById(elId);
        if (el) el.value = biller.remittance?.[key] || '';
      });
    } else {
      if (titleEl) titleEl.textContent = 'Add New Biller Profile';
      if (idEl) idEl.value = '';
      if (nameEl) nameEl.value = '';
      if (taxIdEl) taxIdEl.value = '';
      if (sloganEl) sloganEl.value = '';
      if (addrEl) addrEl.value = '';
      if (phoneEl) phoneEl.value = '';
      if (emailEl) emailEl.value = '';
      if (logoPreview) logoPreview.src = 'assets/logo.svg';
      if (sigNameEl) sigNameEl.value = '';
      if (sigTitleEl) sigTitleEl.value = '';
      if (sigPreview) {
        sigPreview.src = '';
        sigPreview.classList.add('d-none');
      }
      if (sigPlaceholder) sigPlaceholder.classList.remove('d-none');
      if (clearSigBtn) clearSigBtn.classList.add('d-none');
      if (colorPicker) colorPicker.value = '#0b3969';
      if (colorHex) colorHex.value = '#0b3969';
      if (prefInv) prefInv.value = 'INV';
      if (prefCh) prefCh.value = 'CH';
      if (prefQtn) prefQtn.value = 'QTN';
      if (prefRcpt) prefRcpt.value = 'RCPT';
      if (prefExp) prefExp.value = 'EXP';
      if (isDefEl) isDefEl.checked = false;
      remFields.forEach(([elId]) => {
        const el = document.getElementById(elId);
        if (el) el.value = '';
      });
    }
  }

  function renderBillerListItems() {
    const listContainer = document.getElementById('billerProfilesList');
    if (!listContainer || typeof loadBillers !== 'function') return;

    const billers = loadBillers();
    const activeId = typeof getActiveBillerId === 'function' ? getActiveBillerId() : '';

    listContainer.innerHTML = '';

    billers.forEach(b => {
      const isSelected = b.id === activeId;
      const isDefault = !!b.isDefault;
      const item = document.createElement('div');
      item.className = `list-group-item list-group-item-action d-flex align-items-center justify-content-between p-3 ${isSelected ? 'border-primary' : ''}`;

      const safeCardColor = typeof _safeHexColor === 'function' ? _safeHexColor(b.themeColor) : '#0b3969';
      const safeCardLogo = typeof _safeLogoUri === 'function' ? _safeLogoUri(b.logoDataUri || b.logoPath) : (b.logoDataUri || 'assets/logo.svg');
      item.innerHTML = `
        <div class="d-flex align-items-center gap-3">
          <div class="p-1 border rounded bg-body shadow-sm d-flex align-items-center justify-content-center" style="width: 44px; height: 44px;">
            <img src="${escapeAttr(safeCardLogo)}" alt="Logo" style="max-width: 100%; max-height: 100%; object-fit: contain;" />
          </div>
          <div>
            <div class="d-flex align-items-center gap-2 flex-wrap">
              <span class="rounded-circle d-inline-block" style="width: 12px; height: 12px; background-color: ${escapeAttr(safeCardColor)};"></span>
              <strong class="mb-0">${escapeHTML(b.name)}</strong>
              ${isDefault ? '<span class="badge bg-primary-subtle text-primary border border-primary-subtle">Default</span>' : ''}
              ${isSelected ? '<span class="badge bg-success-subtle text-success border border-success-subtle">Active</span>' : ''}
              ${b.signatureDataUri ? '<span class="badge bg-secondary-subtle text-secondary border">✍️ Signed</span>' : ''}
            </div>
            <div class="text-muted small mt-1">
              ${b.phone ? `📞 ${escapeHTML(b.phone)} • ` : ''}
              ${b.email ? `✉️ ${escapeHTML(b.email)} • ` : ''}
              <span>Prefixes: ${escapeHTML(b.prefixes?.invoice || 'INV')}, ${escapeHTML(b.prefixes?.challan || 'CH')}</span>
            </div>
          </div>
        </div>
        <div class="d-flex align-items-center gap-2">
          ${!isSelected ? `
            <button type="button" class="btn btn-outline-success btn-sm select-biller-btn" data-id="${escapeAttr(b.id)}" aria-label="Activate biller ${escapeAttr(b.name)}">Activate</button>
          ` : ''}
          <button type="button" class="btn btn-outline-secondary btn-sm edit-biller-btn" data-id="${escapeAttr(b.id)}" aria-label="Edit biller ${escapeAttr(b.name)}">✏️ Edit</button>
          ${billers.length > 1 ? `
            <button type="button" class="btn btn-outline-danger btn-sm delete-biller-btn" data-id="${escapeAttr(b.id)}" aria-label="Delete biller ${escapeAttr(b.name)}">🗑️</button>
          ` : ''}
        </div>
      `;

      item.querySelector('.select-biller-btn')?.addEventListener('click', () => {
        setActiveBillerId(b.id);
        updateNavbarBrand();
        updateDropdownMenu();
        applyActiveTheme();
        if (typeof setCompanyHeader === 'function') {
          setCompanyHeader();
        }
        renderBillerListItems();
        if (typeof showToast === 'function') {
          showToast(`Active biller set to "${b.name}"`, 'success');
        }
      });

      item.querySelector('.edit-biller-btn')?.addEventListener('click', () => {
        showForm(b);
      });

      item.querySelector('.delete-biller-btn')?.addEventListener('click', () => {
        if (confirm(`Are you sure you want to delete profile "${b.name}"?`)) {
          const res = deleteBiller(b.id);
          if (res.success) {
            updateNavbarBrand();
            updateDropdownMenu();
            applyActiveTheme();
            if (typeof setCompanyHeader === 'function') {
              setCompanyHeader();
            }
            renderBillerListItems();
            if (typeof showToast === 'function') {
              showToast(`Biller "${b.name}" deleted.`, 'info');
            }
          } else {
            if (typeof showToast === 'function') {
              showToast(res.error || 'Failed to delete biller', 'danger');
            }
          }
        }
      });

      listContainer.appendChild(item);
    });
  }

  function openBillerModal(modeOrBillerId) {
    injectBillerModal();
    const modalEl = document.getElementById('billerManageModal');
    if (!modalEl || typeof bootstrap === 'undefined') return;

    if (modeOrBillerId && modeOrBillerId !== 'list') {
      const biller = typeof getBillerById === 'function' ? getBillerById(modeOrBillerId) : null;
      showForm(biller);
    } else if (modeOrBillerId === 'list') {
      showList();
    } else {
      showForm(null);
    }

    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
    modal.show();
  }

  // Hook into lifecycle
  document.addEventListener('DOMContentLoaded', () => {
    if (typeof syncBillersFromDisk === 'function') {
      syncBillersFromDisk().then(() => {
        applyActiveTheme();
        updateNavbarBrand();
        updateDropdownMenu();
        const q = typeof window !== 'undefined' && window.location ? new URLSearchParams(window.location.search) : null;
        const isViewingSavedDoc = !!(q && (q.get('no') || q.get('rcpt') || q.get('id') || q.get('load') || q.get('inv') || q.get('qtn') || q.get('ch')));
        if (!isViewingSavedDoc && typeof setCompanyHeader === 'function') setCompanyHeader();
      });
    }
    applyActiveTheme();
    renderNavbarSwitcher();
    injectBillerModal();

    // Hook dashboard manage button if present
    const dashBtn = document.getElementById('openBillerManageBtn');
    if (dashBtn) {
      dashBtn.addEventListener('click', () => openBillerModal('list'));
    }
  });

  window.addEventListener('billerchange', () => {
    applyActiveTheme();
    updateNavbarBrand();
    updateDropdownMenu();
    if (typeof setCompanyHeader === 'function') {
      setCompanyHeader();
    }
  });

  // Global exposure
  window.openBillerModal = openBillerModal;
  window.applyBillerTheme = applyActiveTheme;
})();
