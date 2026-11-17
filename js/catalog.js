// AutoInvoice - Catalog & Client Onboarding Service
// Reusable client selection dropdown, client onboarding modal, and item database picker

(function (window) {
  'use strict';

  /**
   * Populate a client dropdown <select> and datalist with registered clients
   */
  function populateClientDropdown(selectEl, datalistEl, selectedName = '') {
    if (typeof loadClients !== 'function') return;
    const clients = loadClients();
    clients.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    if (selectEl) {
      const current = selectEl.value;
      selectEl.innerHTML = `<option value="">-- Choose Existing Client (${clients.length}) --</option>`;
      clients.forEach(c => {
        if (!c.name) return;
        const opt = document.createElement('option');
        opt.value = c.name;
        const detail = [c.company, c.address].filter(Boolean).join(' • ');
        opt.textContent = `${c.name}${detail ? ' (' + detail + ')' : ''}`;
        if (selectedName && c.name.toLowerCase() === selectedName.toLowerCase()) {
          opt.selected = true;
        }
        selectEl.appendChild(opt);
      });
      if (!selectedName && current) {
        selectEl.value = current;
      }
    }

    if (datalistEl) {
      datalistEl.innerHTML = '';
      clients.forEach(c => {
        if (!c.name) return;
        const opt = document.createElement('option');
        opt.value = c.name;
        opt.label = `${c.name}${c.address ? ' — ' + c.address : ''}`;
        datalistEl.appendChild(opt);
      });
    }
  }

  /**
   * Populate item datalist for line-item autocomplete
   */
  function populateItemDatalist(datalistEl) {
    if (!datalistEl || typeof loadItems !== 'function') return;
    const items = loadItems();
    items.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    datalistEl.innerHTML = '';
    items.forEach(it => {
      if (!it.name) return;
      const opt = document.createElement('option');
      opt.value = it.name;
      const priceTxt = it.unitPrice != null ? `৳${Number(it.unitPrice).toLocaleString('en-BD')}` : '';
      opt.label = `${it.name}${priceTxt ? ' — ' + priceTxt : ''} (${it.unit || 'Pcs'})`;
      datalistEl.appendChild(opt);
    });
  }

  /**
   * Setup client onboarding modal and quick select dropdown on a document page
   */
  function setupClientOnboarding(options) {
    const {
      selectId = 'clientSelect',
      datalistId = 'clientList',
      nameInputId = 'clientName',
      addressInputId = 'clientAddress',
      companyInputId = '',
      titleInputId = '',
      onClientSelected = null
    } = options;

    const selectEl = document.getElementById(selectId);
    const datalistEl = document.getElementById(datalistId);
    const nameEl = document.getElementById(nameInputId);
    const addrEl = addressInputId ? document.getElementById(addressInputId) : null;
    const compEl = companyInputId ? document.getElementById(companyInputId) : null;
    const titleEl = titleInputId ? document.getElementById(titleInputId) : null;

    // Initial populate
    populateClientDropdown(selectEl, datalistEl);

    // When dropdown selection changes
    if (selectEl) {
      selectEl.addEventListener('change', () => {
        const val = selectEl.value.trim();
        if (!val) return;
        const clients = typeof loadClients === 'function' ? loadClients() : [];
        const client = clients.find(c => (c.name || '').toLowerCase() === val.toLowerCase());
        if (client) {
          applyClientToForm(client);
        }
      });
    }

    // When typing in name input, match with existing client
    if (nameEl) {
      nameEl.addEventListener('change', () => {
        const val = nameEl.value.trim().toLowerCase();
        if (!val) return;
        const clients = typeof loadClients === 'function' ? loadClients() : [];
        const client = clients.find(c => (c.name || '').toLowerCase() === val);
        if (client) {
          applyClientToForm(client);
          if (selectEl) selectEl.value = client.name;
        }
      });
    }

    function applyClientToForm(client) {
      if (nameEl) nameEl.value = client.name || '';
      if (addrEl && client.address) addrEl.value = client.address;
      if (compEl && client.company) compEl.value = client.company;
      if (titleEl && client.title) titleEl.value = client.title;
      if (typeof onClientSelected === 'function') {
        onClientSelected(client);
      }
    }

    // Wire Client Onboard Modal form
    const form = document.getElementById('quickClientForm');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = (document.getElementById('quickClientName')?.value || '').trim();
        const company = (document.getElementById('quickClientCompany')?.value || '').trim();
        const title = (document.getElementById('quickClientTitle')?.value || '').trim();
        const address = (document.getElementById('quickClientAddress')?.value || '').trim();
        const phone = (document.getElementById('quickClientPhone')?.value || '').trim();
        const email = (document.getElementById('quickClientEmail')?.value || '').trim();
        const bin = (document.getElementById('quickClientBin')?.value || '').trim();

        if (!name) return;

        const newClient = { name, company, title, address, phone, email, bin };
        if (typeof saveClient === 'function') {
          saveClient(newClient);
        }

        // Re-populate and select
        populateClientDropdown(selectEl, datalistEl, name);
        applyClientToForm(newClient);

        // Reset and close modal
        form.reset();
        const modalEl = document.getElementById('clientOnboardModal');
        if (modalEl && window.bootstrap) {
          const modal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
          modal.hide();
        }
      });
    }

    return {
      refresh: (nameToSelect = '') => populateClientDropdown(selectEl, datalistEl, nameToSelect)
    };
  }

  /**
   * Setup Item Catalog integration (datalist autocomplete + catalog picker modal)
   */
  function setupItemCatalog(options) {
    const {
      datalistId = 'itemList',
      onItemPicked = null
    } = options;

    const datalistEl = document.getElementById(datalistId);
    populateItemDatalist(datalistEl);

    // Render picker modal list
    const pickerListEl = document.getElementById('catalogPickerBody');
    const searchInputEl = document.getElementById('catalogSearchInput');

    function renderPickerList(filter = '') {
      if (!pickerListEl || typeof loadItems !== 'function') return;
      const items = loadItems();
      const q = (filter || '').trim().toLowerCase();
      const filtered = q
        ? items.filter(it => 
            (it.name && it.name.toLowerCase().includes(q)) ||
            (it.desc && it.desc.toLowerCase().includes(q)) ||
            (it.unit && it.unit.toLowerCase().includes(q))
          )
        : items;

      if (!filtered.length) {
        pickerListEl.innerHTML = `
          <tr>
            <td colspan="5" class="text-center text-muted py-3">
              ${q ? 'No catalog items match your search.' : 'Catalog is empty. Add items using the button above.'}
            </td>
          </tr>
        `;
        return;
      }

      pickerListEl.innerHTML = filtered.map(it => {
        const safeName = (typeof escapeHTML === 'function') ? escapeHTML(it.name || '') : it.name;
        const safeDesc = (typeof escapeHTML === 'function') ? escapeHTML(it.desc || '') : it.desc;
        const safeUnit = (typeof escapeHTML === 'function') ? escapeHTML(it.unit || 'Pcs') : it.unit;
        const price = Number(it.unitPrice) || 0;
        const priceFormatted = (typeof formatBDT === 'function') ? formatBDT(price) : '৳' + price.toFixed(2);

        return `
          <tr>
            <td><strong class="text-primary">${safeName}</strong></td>
            <td><span class="small text-muted">${safeDesc || '—'}</span></td>
            <td><span class="badge bg-body-tertiary text-body border">${safeUnit}</span></td>
            <td class="text-end fw-semibold">${priceFormatted}</td>
            <td class="text-end">
              <button type="button" class="btn btn-sm btn-primary py-0 px-2 pick-this-item-btn"
                      data-name="${escapeAttr(it.name || '')}"
                      data-desc="${escapeAttr(it.desc || '')}"
                      data-unit="${escapeAttr(it.unit || 'Pcs')}"
                      data-price="${price}">
                + Insert
              </button>
            </td>
          </tr>
        `;
      }).join('');

      // Wire pick buttons
      pickerListEl.querySelectorAll('.pick-this-item-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const item = {
            name: btn.getAttribute('data-name'),
            desc: btn.getAttribute('data-desc'),
            unit: btn.getAttribute('data-unit'),
            unitPrice: parseFloat(btn.getAttribute('data-price')) || 0
          };
          if (typeof onItemPicked === 'function') {
            onItemPicked(item);
          }
          const modalEl = document.getElementById('catalogPickerModal');
          if (modalEl && window.bootstrap) {
            const modal = bootstrap.Modal.getInstance(modalEl);
            if (modal) modal.hide();
          }
        });
      });
    }

    if (searchInputEl) {
      searchInputEl.addEventListener('input', (e) => renderPickerList(e.target.value));
    }

    const pickerModalEl = document.getElementById('catalogPickerModal');
    if (pickerModalEl) {
      pickerModalEl.addEventListener('show.bs.modal', () => {
        renderPickerList(searchInputEl ? searchInputEl.value : '');
      });
    }

    // Wire Quick Item Add Modal
    const quickItemForm = document.getElementById('quickItemForm');
    if (quickItemForm) {
      quickItemForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = (document.getElementById('quickItemName')?.value || '').trim();
        const desc = (document.getElementById('quickItemDesc')?.value || '').trim();
        const unit = (document.getElementById('quickItemUnit')?.value || 'Pcs').trim();
        const priceRaw = (document.getElementById('quickItemPrice')?.value || '0').replace(/[^0-9.]/g, '');
        const unitPrice = parseFloat(priceRaw) || 0;

        if (!name) return;

        const newItem = { name, desc, unit, unitPrice };
        if (typeof saveItem === 'function') {
          saveItem(newItem);
        }

        populateItemDatalist(datalistEl);
        renderPickerList(searchInputEl ? searchInputEl.value : '');

        if (typeof onItemPicked === 'function') {
          onItemPicked(newItem);
        }

        quickItemForm.reset();
        const modalEl = document.getElementById('itemOnboardModal');
        if (modalEl && window.bootstrap) {
          const modal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
          modal.hide();
        }
      });
    }

    return {
      refresh: () => {
        populateItemDatalist(datalistEl);
        renderPickerList(searchInputEl ? searchInputEl.value : '');
      }
    };
  }

  // Export to window
  window.AutoInvoiceCatalog = {
    populateClientDropdown,
    populateItemDatalist,
    setupClientOnboarding,
    setupItemCatalog
  };

})(window);
