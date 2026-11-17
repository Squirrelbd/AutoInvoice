// AutoInvoice Dashboard Logic
// Handles live KPI calculations, Client Address Book, and Backup Export/Restore

document.addEventListener('DOMContentLoaded', () => {
  // Footer year
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // Toast helper (delegates to shared showToast utility)
  const notify = (msg, type = 'info') => typeof showToast === 'function' ? showToast(msg, type) : alert(msg);

  // ==========================================
  // 1. KPI Calculation & Rendering
  // ==========================================
  const dashboardBillerFilterEl = document.getElementById('dashboardBillerFilter');

  function populateDashboardBillerFilter() {
    if (!dashboardBillerFilterEl || typeof loadBillers !== 'function') return;
    const current = dashboardBillerFilterEl.value || 'all';
    const billers = loadBillers();
    let opts = '<option value="all">All Billers (Consolidated)</option>';
    billers.forEach(b => {
      opts += `<option value="${escapeAttr(b.id)}">${escapeHTML(b.name)}</option>`;
    });
    dashboardBillerFilterEl.innerHTML = opts;
    dashboardBillerFilterEl.value = billers.some(b => b.id === current) ? current : 'all';
  }

  function syncHeroBillerLogo() {
    const logoEl = document.getElementById('companyLogo');
    if (!logoEl || typeof getActiveBiller !== 'function') return;
    const active = getActiveBiller();
    if (active && active.logoDataUri) {
      logoEl.src = active.logoDataUri;
    }
  }

  function refreshKPIs() {
    try {
      if (typeof getDashboardKPIs !== 'function') return;
      const scopeId = dashboardBillerFilterEl ? dashboardBillerFilterEl.value : 'all';
      const kpi = getDashboardKPIs(scopeId);
      syncHeroBillerLogo();

      const totalInvoicedEl = document.getElementById('kpiTotalInvoiced');
      const totalCollectedEl = document.getElementById('kpiTotalCollected');
      const totalDueEl = document.getElementById('kpiTotalDue');
      const totalExpensesEl = document.getElementById('kpiTotalExpenses');
      const netProfitEl = document.getElementById('kpiNetProfit');
      const netProfitCardEl = document.getElementById('kpiNetProfitCard');
      const netProfitSubtextEl = document.getElementById('kpiNetProfitSubtext');
      const expensesSubtextEl = document.getElementById('kpiExpensesSubtext');
      const totalDocsEl = document.getElementById('kpiTotalDocs');
      const docsBreakdownEl = document.getElementById('kpiDocsBreakdown');

      if (totalInvoicedEl) totalInvoicedEl.textContent = formatBDT(kpi.totalInvoiced);
      if (totalCollectedEl) totalCollectedEl.textContent = formatBDT(kpi.totalCollected);
      if (totalDueEl) totalDueEl.textContent = formatBDT(kpi.totalDue);
      if (totalExpensesEl) totalExpensesEl.textContent = formatBDT(kpi.totalExpenses || 0);

      if (netProfitEl) {
        const profit = kpi.netProfit || 0;
        const isLoss = profit < 0;
        netProfitEl.textContent = `${isLoss ? '-' : ''}${formatBDT(Math.abs(profit))}`;
        if (isLoss) {
          netProfitEl.classList.remove('text-success');
          netProfitEl.classList.add('text-danger');
          if (netProfitCardEl) {
            netProfitCardEl.classList.remove('metric-profit');
            netProfitCardEl.classList.add('metric-loss');
          }
          if (netProfitSubtextEl) netProfitSubtextEl.textContent = `Operating Deficit (${kpi.profitMargin}%)`;
        } else {
          netProfitEl.classList.remove('text-danger');
          netProfitEl.classList.add('text-success');
          if (netProfitCardEl) {
            netProfitCardEl.classList.remove('metric-loss');
            netProfitCardEl.classList.add('metric-profit');
          }
          if (netProfitSubtextEl) netProfitSubtextEl.textContent = `Net Cash Margin: ${kpi.profitMargin}%`;
        }
      }

      if (expensesSubtextEl) {
        const expCount = kpi.counts.expenses || 0;
        expensesSubtextEl.textContent = `${expCount} voucher${expCount === 1 ? '' : 's'} recorded`;
      }

      const totalDocs = (kpi.counts.invoices || 0) + (kpi.counts.challans || 0) + (kpi.counts.quotations || 0) + (kpi.counts.receipts || 0) + (kpi.counts.expenses || 0);
      if (totalDocsEl) totalDocsEl.textContent = `${totalDocs} Records`;
      if (docsBreakdownEl) {
        docsBreakdownEl.textContent = `${kpi.counts.invoices} Invs, ${kpi.counts.challans} Chs, ${kpi.counts.quotations} Qtns, ${kpi.counts.receipts} Rcpts, ${kpi.counts.expenses || 0} Exps`;
      }

      const storageBadgeEl = document.getElementById('storageUsageBadge');
      if (storageBadgeEl && typeof getStorageUsage === 'function') {
        const bytes = getStorageUsage();
        const kb = (bytes / 1024).toFixed(1);
        const percent = Math.min(100, (bytes / (5 * 1024 * 1024)) * 100).toFixed(1);
        storageBadgeEl.textContent = `💾 Storage: ${kb} KB used (${percent}%)`;
      }
    } catch (e) {
      console.warn('Failed to refresh KPIs', e);
    }
  }

  populateDashboardBillerFilter();
  refreshKPIs();

  if (dashboardBillerFilterEl) {
    dashboardBillerFilterEl.addEventListener('change', refreshKPIs);
  }
  window.addEventListener('billerchange', () => {
    populateDashboardBillerFilter();
    refreshKPIs();
  });
  window.addEventListener('storagesync', () => {
    populateDashboardBillerFilter();
    refreshKPIs();
    renderClientTable();
    renderItemTable();
  });

  const refreshBtn = document.getElementById('refreshDashboardBtn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      refreshKPIs();
      renderClientTable();
      renderItemTable();
      notify('Dashboard metrics refreshed.', 'success');
    });
  }

  // ==========================================
  // 2. Backup Export & Restore
  // ==========================================
  const exportAllBtn = document.getElementById('exportAllBtn');
  if (exportAllBtn) {
    exportAllBtn.addEventListener('click', () => {
      if (typeof exportAllData === 'function') {
        exportAllData();
        notify('Backup downloaded successfully.', 'success');
      }
    });
  }

  const clearDatabaseBtn = document.getElementById('clearDatabaseBtn');
  if (clearDatabaseBtn) {
    clearDatabaseBtn.addEventListener('click', () => {
      const confirmed = confirm('⚠️ Are you sure you want to clear the entire AutoInvoice database?\n\nThis will remove all stored documents, client contacts, items, and secondary billers, resetting to a clean fresh slate.\n\nTip: Click "Export" first if you want to keep a backup!');
      if (!confirmed) return;
      if (typeof clearAllData === 'function') {
        clearAllData();
      } else {
        localStorage.clear();
      }
      notify('Database cleared successfully! Reloading...', 'success');
      setTimeout(() => {
        window.location.reload();
      }, 700);
    });
  }

  const restoreBackupBtn = document.getElementById('restoreBackupBtn');
  const restoreFileInput = document.getElementById('restoreFileInput');
  const restoreModalEl = document.getElementById('restoreModal');
  const confirmRestoreBtn = document.getElementById('confirmRestoreBtn');
  let pendingBackupData = null;
  let restoreModalInstance = null;

  if (restoreModalEl && window.bootstrap) {
    restoreModalInstance = new bootstrap.Modal(restoreModalEl);
  }

  if (restoreBackupBtn && restoreFileInput) {
    restoreBackupBtn.addEventListener('click', () => {
      restoreFileInput.value = '';
      restoreFileInput.click();
    });

    restoreFileInput.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const parsed = JSON.parse(event.target.result);
          if (!parsed || typeof parsed !== 'object') {
            throw new Error('File does not contain a valid JSON object.');
          }

          pendingBackupData = parsed;

          // Populate restore summary modal
          const invCount = Array.isArray(parsed.invoices) ? parsed.invoices.length : 0;
          const chCount = Array.isArray(parsed.challans) ? parsed.challans.length : 0;
          const qtnCount = Array.isArray(parsed.quotations) ? parsed.quotations.length : 0;
          const rcptCount = Array.isArray(parsed.receipts) ? parsed.receipts.length : 0;
          const clientCount = Array.isArray(parsed.clients) ? parsed.clients.length : 0;
          const itemCount = Array.isArray(parsed.items) ? parsed.items.length : 0;

          const invEl = document.getElementById('restoreInvCount');
          const chEl = document.getElementById('restoreChCount');
          const qtnEl = document.getElementById('restoreQtnCount');
          const rcptEl = document.getElementById('restoreRcptCount');
          const clientEl = document.getElementById('restoreClientCount');
          const itemEl = document.getElementById('restoreItemCount');
          const metaTextEl = document.getElementById('restoreMetaText');

          if (invEl) invEl.textContent = invCount;
          if (chEl) chEl.textContent = chCount;
          if (qtnEl) qtnEl.textContent = qtnCount;
          if (rcptEl) rcptEl.textContent = rcptCount;
          if (clientEl) clientEl.textContent = clientCount;
          if (itemEl) itemEl.textContent = itemCount;

          if (metaTextEl) {
            const dateStr = parsed.exportedAt ? new Date(parsed.exportedAt).toLocaleString() : 'Unknown';
            metaTextEl.textContent = `File: ${file.name} | Export Date: ${dateStr}`;
          }

          if (restoreModalInstance) {
            restoreModalInstance.show();
          } else {
            if (confirm(`Restore backup with ${invCount} invoices, ${chCount} challans, ${qtnCount} quotations, ${rcptCount} receipts, and ${itemCount} items?`)) {
              executeRestore();
            }
          }
        } catch (err) {
          notify(`Failed to read backup file: ${err.message}`, 'danger');
        }
      };
      reader.readAsText(file);
    });
  }

  function executeRestore() {
    if (!pendingBackupData) return;
    try {
      const counts = importAllData(pendingBackupData);
      if (restoreModalInstance) restoreModalInstance.hide();
      refreshKPIs();
      renderClientTable();
      renderItemTable();
      notify(`Restore successful! Loaded ${counts.invoices} invoices, ${counts.challans} challans, ${counts.quotations} quotations, ${counts.receipts} receipts, and ${counts.items || 0} items.`, 'success');
      pendingBackupData = null;
    } catch (err) {
      notify(`Error restoring backup: ${err.message}`, 'danger');
    }
  }

  if (confirmRestoreBtn) {
    confirmRestoreBtn.addEventListener('click', executeRestore);
  }

  // SQLite Status & Manual Sync
  const sqliteStatusLabel = document.getElementById('sqliteStatusLabel');
  const manualSyncDbBtn = document.getElementById('manualSyncDbBtn');

  async function refreshSqliteBadge() {
    if (!sqliteStatusLabel) return;
    try {
      if (typeof checkSQLiteStatus !== 'function') {
        sqliteStatusLabel.innerHTML = '<span class="badge bg-secondary-subtle text-secondary">Browser Storage</span>';
        return;
      }
      const status = await checkSQLiteStatus();
      if (status && status.available) {
        const totalDocs = (status.counts?.invoices || 0) + (status.counts?.challans || 0) + (status.counts?.quotations || 0) + (status.counts?.receipts || 0) + (status.counts?.expenses || 0);
        const kb = Math.round((status.sizeBytes || 0) / 1024);
        sqliteStatusLabel.innerHTML = `<span class="badge bg-success-subtle text-success border border-success-subtle">● SQLite Active</span> <span class="text-secondary ms-1">${totalDocs} docs (${kb} KB)</span>`;
      } else {
        sqliteStatusLabel.innerHTML = '<span class="badge bg-secondary-subtle text-secondary">Browser Storage</span>';
      }
    } catch (e) {
      sqliteStatusLabel.innerHTML = '<span class="badge bg-secondary-subtle text-secondary">Offline / Local</span>';
    }
  }

  if (manualSyncDbBtn) {
    manualSyncDbBtn.addEventListener('click', async () => {
      manualSyncDbBtn.disabled = true;
      manualSyncDbBtn.textContent = 'Syncing...';
      try {
        if (typeof syncWithSQLite === 'function') {
          const res = await syncWithSQLite(false);
          if (res && res.success) {
            notify('Database synchronized successfully to SQLite!', 'success');
            refreshSqliteBadge();
          } else {
            notify('Sync note: SQLite server is currently offline or unreachable.', 'warning');
          }
        }
      } catch (err) {
        notify('Failed to sync: ' + err.message, 'danger');
      } finally {
        manualSyncDbBtn.disabled = false;
        manualSyncDbBtn.textContent = 'Sync Now';
      }
    });
  }

  refreshSqliteBadge();
  window.addEventListener('autoinvoice:db-synced', () => {
    refreshSqliteBadge();
  });


  // ==========================================
  // 3. Client Address Book Directory
  // ==========================================
  const clientSearchInput = document.getElementById('clientSearchInput');
  const clientTableBody = document.getElementById('clientTableBody');
  const clientCountBadge = document.getElementById('clientCountBadge');
  const clientForm = document.getElementById('clientForm');
  const clientFormHeader = document.getElementById('clientFormHeader');
  const clientFormOriginalName = document.getElementById('clientFormOriginalName');
  const clientFormName = document.getElementById('clientFormName');
  const clientFormCompany = document.getElementById('clientFormCompany');
  const clientFormTitle = document.getElementById('clientFormTitle');
  const clientFormAddress = document.getElementById('clientFormAddress');
  const clientFormPhone = document.getElementById('clientFormPhone');
  const clientFormEmail = document.getElementById('clientFormEmail');
  const clientFormBin = document.getElementById('clientFormBin');
  const clientFormCancelBtn = document.getElementById('clientFormCancelBtn');
  const addClientCollapseEl = document.getElementById('addClientCollapse');

  function renderClientTable(filterQuery = '') {
    if (!clientTableBody) return;
    const clients = typeof loadClients === 'function' ? loadClients() : [];
    const q = (filterQuery || '').trim().toLowerCase();

    const filtered = q
      ? clients.filter(c => 
          (c.name && c.name.toLowerCase().includes(q)) ||
          (c.company && c.company.toLowerCase().includes(q)) ||
          (c.title && c.title.toLowerCase().includes(q)) ||
          (c.phone && c.phone.toLowerCase().includes(q)) ||
          (c.email && c.email.toLowerCase().includes(q)) ||
          (c.address && c.address.toLowerCase().includes(q))
        )
      : clients;

    if (clientCountBadge) {
      clientCountBadge.textContent = `${clients.length} clients stored (${filtered.length} shown)`;
    }

    if (!filtered.length) {
      clientTableBody.innerHTML = `
        <tr>
          <td colspan="5" class="text-center text-muted py-4">
            ${q ? 'No clients match your search.' : 'No clients saved in address book yet.'}
          </td>
        </tr>
      `;
      return;
    }

    // Sort alphabetically by name
    filtered.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    clientTableBody.innerHTML = filtered.map(c => {
      const safeName = escapeHTML(c.name || '');
      const safeComp = escapeHTML(c.company || '');
      const safeTitle = escapeHTML(c.title || '');
      const safeAddr = escapeHTML(c.address || '');
      const safePhone = escapeHTML(c.phone || '');
      const safeEmail = escapeHTML(c.email || '');
      const safeBin = escapeHTML(c.bin || '');

      const contactInfo = [safeComp, safeTitle, safeBin ? `BIN: ${safeBin}` : ''].filter(Boolean).join(' • ') || '<span class="text-muted">—</span>';
      const comms = [
        safePhone ? `<span title="Phone">📞 ${safePhone}</span>` : '',
        safeEmail ? `<span title="Email">✉️ ${safeEmail}</span>` : ''
      ].filter(Boolean).join('<br>') || '<span class="text-muted">—</span>';

      return `
        <tr>
          <td><strong class="text-primary">${safeName}</strong></td>
          <td>${contactInfo}</td>
          <td><span class="small">${comms}</span></td>
          <td><span class="small text-muted">${safeAddr || '—'}</span></td>
          <td class="text-end text-nowrap">
            <a href="statement.html?client=${encodeURIComponent(c.name)}" class="btn btn-sm btn-outline-primary py-0 px-2 me-1" title="View Client Statement of Account">
              📑 Statement
            </a>
            <button class="btn btn-sm btn-outline-secondary py-0 px-2 me-1 edit-client-btn" 
                    data-name="${escapeAttr(c.name || '')}" 
                    data-company="${escapeAttr(c.company || '')}" 
                    data-title="${escapeAttr(c.title || '')}" 
                    data-address="${escapeAttr(c.address || '')}"
                    data-phone="${escapeAttr(c.phone || '')}"
                    data-email="${escapeAttr(c.email || '')}"
                    data-bin="${escapeAttr(c.bin || '')}"
                    aria-label="Edit client ${escapeAttr(c.name || '')}">
              ✏️ Edit
            </button>
            <button class="btn btn-sm btn-outline-danger py-0 px-2 delete-client-btn" 
                    data-name="${escapeAttr(c.name || '')}"
                    aria-label="Delete client ${escapeAttr(c.name || '')}">
              🗑️
            </button>
          </td>
        </tr>
      `;
    }).join('');

    // Attach row events
    clientTableBody.querySelectorAll('.edit-client-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const name = btn.getAttribute('data-name');
        const company = btn.getAttribute('data-company');
        const title = btn.getAttribute('data-title');
        const address = btn.getAttribute('data-address');
        const phone = btn.getAttribute('data-phone') || '';
        const email = btn.getAttribute('data-email') || '';
        const bin = btn.getAttribute('data-bin') || '';

        if (clientFormOriginalName) clientFormOriginalName.value = name;
        if (clientFormName) clientFormName.value = name;
        if (clientFormCompany) clientFormCompany.value = company;
        if (clientFormTitle) clientFormTitle.value = title;
        if (clientFormAddress) clientFormAddress.value = address;
        if (clientFormPhone) clientFormPhone.value = phone;
        if (clientFormEmail) clientFormEmail.value = email;
        if (clientFormBin) clientFormBin.value = bin;
        if (clientFormHeader) clientFormHeader.textContent = `Edit Client: ${name}`;

        if (addClientCollapseEl && window.bootstrap) {
          const collapse = bootstrap.Collapse.getOrCreateInstance(addClientCollapseEl);
          collapse.show();
        }
        if (clientFormName) clientFormName.focus();
      });
    });

    clientTableBody.querySelectorAll('.delete-client-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const name = btn.getAttribute('data-name');
        if (confirm(`Are you sure you want to delete client "${name}" from your address book?`)) {
          if (typeof deleteClient === 'function') {
            deleteClient(name);
            renderClientTable(clientSearchInput ? clientSearchInput.value : '');
            refreshKPIs();
            notify(`Client "${name}" deleted.`, 'info');
          }
        }
      });
    });
  }

  // Client search input listener
  if (clientSearchInput) {
    clientSearchInput.addEventListener('input', (e) => {
      renderClientTable(e.target.value);
    });
  }

  // Client form submission
  if (clientForm) {
    clientForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const origName = clientFormOriginalName ? clientFormOriginalName.value.trim() : '';
      const name = clientFormName ? clientFormName.value.trim() : '';
      const company = clientFormCompany ? clientFormCompany.value.trim() : '';
      const title = clientFormTitle ? clientFormTitle.value.trim() : '';
      const address = clientFormAddress ? clientFormAddress.value.trim() : '';
      const phone = clientFormPhone ? clientFormPhone.value.trim() : '';
      const email = clientFormEmail ? clientFormEmail.value.trim() : '';
      const bin = clientFormBin ? clientFormBin.value.trim() : '';

      if (!name) {
        notify('Client name is required.', 'warning');
        return;
      }

      // If renamed, remove original
      if (origName && origName.toLowerCase() !== name.toLowerCase()) {
        if (typeof deleteClient === 'function') deleteClient(origName);
      }

      if (typeof saveClient === 'function') {
        saveClient({ name, company, title, address, phone, email, bin }, { replace: true });
        resetClientForm();
        renderClientTable(clientSearchInput ? clientSearchInput.value : '');
        refreshKPIs();
        notify(`Client "${name}" saved to address book.`, 'success');
      }
    });
  }

  function resetClientForm() {
    if (clientForm) clientForm.reset();
    if (clientFormOriginalName) clientFormOriginalName.value = '';
    if (clientFormPhone) clientFormPhone.value = '';
    if (clientFormEmail) clientFormEmail.value = '';
    if (clientFormBin) clientFormBin.value = '';
    if (clientFormHeader) clientFormHeader.textContent = 'Add New Client';
    if (addClientCollapseEl && window.bootstrap) {
      const collapse = bootstrap.Collapse.getOrCreateInstance(addClientCollapseEl);
      collapse.hide();
    }
  }

  if (clientFormCancelBtn) {
    clientFormCancelBtn.addEventListener('click', resetClientForm);
  }

  // Initialize client table on modal open or load
  const clientModalEl = document.getElementById('clientModal');
  if (clientModalEl) {
    clientModalEl.addEventListener('show.bs.modal', () => {
      renderClientTable(clientSearchInput ? clientSearchInput.value : '');
    });
  }

  // ==========================================
  // 4. Item / Product Catalog Database
  // ==========================================
  const itemSearchInput = document.getElementById('itemSearchInput');
  const itemTableBody = document.getElementById('itemTableBody');
  const itemCountBadge = document.getElementById('itemCountBadge');
  const itemForm = document.getElementById('itemForm');
  const itemFormHeader = document.getElementById('itemFormHeader');
  const itemFormOriginalName = document.getElementById('itemFormOriginalName');
  const itemFormName = document.getElementById('itemFormName');
  const itemFormUnit = document.getElementById('itemFormUnit');
  const itemFormPrice = document.getElementById('itemFormPrice');
  const itemFormDesc = document.getElementById('itemFormDesc');
  const itemFormCancelBtn = document.getElementById('itemFormCancelBtn');
  const addItemCollapseEl = document.getElementById('addItemCollapse');

  function renderItemTable(filterQuery = '') {
    if (!itemTableBody) return;
    const items = typeof loadItems === 'function' ? loadItems() : [];
    const q = (filterQuery || '').trim().toLowerCase();

    const filtered = q
      ? items.filter(it =>
          (it.name && it.name.toLowerCase().includes(q)) ||
          (it.desc && it.desc.toLowerCase().includes(q)) ||
          (it.unit && it.unit.toLowerCase().includes(q))
        )
      : items;

    if (itemCountBadge) {
      itemCountBadge.textContent = `${items.length} items in database (${filtered.length} shown)`;
    }

    if (!filtered.length) {
      itemTableBody.innerHTML = `
        <tr>
          <td colspan="5" class="text-center text-muted py-4">
            ${q ? 'No items match your search.' : 'No items saved in database yet.'}
          </td>
        </tr>
      `;
      return;
    }

    filtered.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    itemTableBody.innerHTML = filtered.map(it => {
      const safeName = escapeHTML(it.name || '');
      const safeDesc = escapeHTML(it.desc || '');
      const safeUnit = escapeHTML(it.unit || 'Pcs');
      const safePrice = Number(it.unitPrice) || 0;
      const formattedRate = typeof formatBDT === 'function' ? formatBDT(safePrice) : `৳${safePrice.toFixed(2)}`;

      return `
        <tr>
          <td><strong class="text-success">${safeName}</strong></td>
          <td><span class="small text-muted">${safeDesc || '—'}</span></td>
          <td><span class="badge bg-secondary-subtle text-secondary">${safeUnit}</span></td>
          <td class="text-end fw-semibold">${formattedRate}</td>
          <td class="text-end">
            <button class="btn btn-sm btn-outline-secondary py-0 px-2 me-1 edit-item-btn" 
                    data-id="${escapeAttr(it.id || '')}"
                    data-name="${escapeAttr(it.name || '')}" 
                    data-desc="${escapeAttr(it.desc || '')}" 
                    data-unit="${escapeAttr(it.unit || 'Pcs')}" 
                    data-price="${safePrice}"
                    aria-label="Edit item ${escapeAttr(it.name || '')}">
              ✏️ Edit
            </button>
            <button class="btn btn-sm btn-outline-danger py-0 px-2 delete-item-btn" 
                    data-id="${escapeAttr(it.id || '')}"
                    data-name="${escapeAttr(it.name || '')}"
                    aria-label="Delete item ${escapeAttr(it.name || '')}">
              🗑️
            </button>
          </td>
        </tr>
      `;
    }).join('');

    itemTableBody.querySelectorAll('.edit-item-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const name = btn.getAttribute('data-name');
        const desc = btn.getAttribute('data-desc');
        const unit = btn.getAttribute('data-unit');
        const price = btn.getAttribute('data-price');

        if (itemFormOriginalName) itemFormOriginalName.value = name;
        if (itemFormName) itemFormName.value = name;
        if (itemFormDesc) itemFormDesc.value = desc;
        if (itemFormUnit) itemFormUnit.value = unit || 'Pcs';
        if (itemFormPrice) itemFormPrice.value = price || '';
        if (itemFormHeader) itemFormHeader.textContent = `Edit Catalog Item: ${name}`;

        if (addItemCollapseEl && window.bootstrap) {
          const collapse = bootstrap.Collapse.getOrCreateInstance(addItemCollapseEl);
          collapse.show();
        }
        if (itemFormName) itemFormName.focus();
      });
    });

    itemTableBody.querySelectorAll('.delete-item-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const name = btn.getAttribute('data-name');
        if (confirm(`Are you sure you want to delete item "${name}" from your catalog database?`)) {
          if (typeof deleteItem === 'function') {
            deleteItem(id || name);
            renderItemTable(itemSearchInput ? itemSearchInput.value : '');
            refreshKPIs();
            notify(`Item "${name}" removed from database.`, 'info');
          }
        }
      });
    });
  }

  if (itemSearchInput) {
    itemSearchInput.addEventListener('input', (e) => {
      renderItemTable(e.target.value);
    });
  }

  if (itemForm) {
    itemForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const origName = itemFormOriginalName ? itemFormOriginalName.value.trim() : '';
      const name = itemFormName ? itemFormName.value.trim() : '';
      const desc = itemFormDesc ? itemFormDesc.value.trim() : '';
      const unit = itemFormUnit ? itemFormUnit.value.trim() : 'Pcs';
      const unitPrice = itemFormPrice ? parseFloat(itemFormPrice.value) || 0 : 0;

      if (!name) {
        notify('Item name is required.', 'warning');
        return;
      }

      if (origName && origName.toLowerCase() !== name.toLowerCase()) {
        if (typeof deleteItem === 'function') deleteItem(origName);
      }

      if (typeof saveItem === 'function') {
        saveItem({ name, desc, unit, unitPrice }, { replace: true });
        resetItemForm();
        renderItemTable(itemSearchInput ? itemSearchInput.value : '');
        refreshKPIs();
        notify(`Item "${name}" saved to database.`, 'success');
      }
    });
  }

  function resetItemForm() {
    if (itemForm) itemForm.reset();
    if (itemFormOriginalName) itemFormOriginalName.value = '';
    if (itemFormHeader) itemFormHeader.textContent = 'Add New Catalog Item';
    if (itemFormUnit) itemFormUnit.value = 'Pcs';
    if (addItemCollapseEl && window.bootstrap) {
      const collapse = bootstrap.Collapse.getOrCreateInstance(addItemCollapseEl);
      collapse.hide();
    }
  }

  if (itemFormCancelBtn) {
    itemFormCancelBtn.addEventListener('click', resetItemForm);
  }

  const itemCatalogModalEl = document.getElementById('itemCatalogModal');
  if (itemCatalogModalEl) {
    itemCatalogModalEl.addEventListener('show.bs.modal', () => {
      renderItemTable(itemSearchInput ? itemSearchInput.value : '');
    });
  }
});
