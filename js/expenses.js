// AutoInvoice — Business Expenses & Cash Flow Controller
// Handles Expense CRUD, Category Analytics, Monthly P&L Ledger, and CSV Portability

document.addEventListener('DOMContentLoaded', () => {
  // DOM References — Controls
  const billerFilterEl = document.getElementById('filterBiller');
  const periodFilterEl = document.getElementById('filterPeriod');
  const fromDateEl = document.getElementById('filterFromDate');
  const toDateEl = document.getElementById('filterToDate');
  const fromDateWrap = document.getElementById('fromDateWrap');
  const toDateWrap = document.getElementById('toDateWrap');
  const categoryFilterEl = document.getElementById('filterCategory');
  const methodFilterEl = document.getElementById('filterMethod');
  const searchFilterEl = document.getElementById('filterSearch');
  const resetFiltersBtn = document.getElementById('resetFiltersBtn');

  // DOM References — KPIs
  const kpiEarnedEl = document.getElementById('kpiEarned');
  const kpiInvoicedSubEl = document.getElementById('kpiInvoicedSub');
  const kpiSpentEl = document.getElementById('kpiSpent');
  const kpiSpentSubEl = document.getElementById('kpiSpentSub');
  const kpiNetProfitEl = document.getElementById('kpiNetProfit');
  const kpiProfitBadgeEl = document.getElementById('kpiProfitBadge');
  const kpiNetProfitCardEl = document.getElementById('kpiNetProfitCard');
  const kpiMarginSubEl = document.getElementById('kpiMarginSub');
  const kpiBurnRateEl = document.getElementById('kpiBurnRate');
  const kpiBurnSubEl = document.getElementById('kpiBurnSub');

  // DOM References — Tables & Views
  const expensesTableBody = document.getElementById('expensesTableBody');
  const noExpensesMessage = document.getElementById('noExpensesMessage');
  const registerTotalAmount = document.getElementById('registerTotalAmount');
  const footerTotalAmount = document.getElementById('footerTotalAmount');
  const registerFilteredSummary = document.getElementById('registerFilteredSummary');
  const tabCountRegister = document.getElementById('tabCountRegister');
  const categoryCardsContainer = document.getElementById('categoryCardsContainer');
  const categoryTableBody = document.getElementById('categoryTableBody');
  const pnlTableBody = document.getElementById('pnlTableBody');
  const pnlTableFoot = document.getElementById('pnlTableFoot');

  // DOM References — Modal & Form
  const expenseModalEl = document.getElementById('expenseModal');
  const expenseModalLabel = document.getElementById('expenseModalLabel');
  const expenseForm = document.getElementById('expenseForm');
  const expenseEditId = document.getElementById('expenseEditId');
  const expenseVoucherNo = document.getElementById('expenseVoucherNo');
  const expenseDate = document.getElementById('expenseDate');
  const expenseBillerSelect = document.getElementById('expenseBillerSelect');
  const expenseCategorySelect = document.getElementById('expenseCategorySelect');
  const toggleNewCategoryBtn = document.getElementById('toggleNewCategoryBtn');
  const newCategoryWrap = document.getElementById('newCategoryWrap');
  const newCategoryInput = document.getElementById('newCategoryInput');
  const saveNewCategoryBtn = document.getElementById('saveNewCategoryBtn');
  const cancelNewCategoryBtn = document.getElementById('cancelNewCategoryBtn');
  const expenseAmount = document.getElementById('expenseAmount');
  const expenseVatAmount = document.getElementById('expenseVatAmount');
  const expenseAmountWords = document.getElementById('expenseAmountWords');
  const pnlNetVatToggle = document.getElementById('pnlNetVatToggle');
  const expensePayee = document.getElementById('expensePayee');
  const payeeDatalist = document.getElementById('payeeDatalist');
  const expensePaymentMethod = document.getElementById('expensePaymentMethod');
  const expenseReference = document.getElementById('expenseReference');
  const expenseNotes = document.getElementById('expenseNotes');

  // DOM References — Delete Modal
  const deleteExpenseModalEl = document.getElementById('deleteExpenseModal');
  const deleteExpenseVoucherNo = document.getElementById('deleteExpenseVoucherNo');
  const deleteExpenseAmount = document.getElementById('deleteExpenseAmount');
  const confirmDeleteExpenseBtn = document.getElementById('confirmDeleteExpenseBtn');

  // Buttons
  const openExpenseModalBtn = document.getElementById('openExpenseModalBtn');
  const exportExpensesCsvBtn = document.getElementById('exportExpensesCsvBtn');
  const exportPnlCsvBtn = document.getElementById('exportPnlCsvBtn');
  const printLedgerBtn = document.getElementById('printLedgerBtn');

  let expenseModalInstance = null;
  let deleteModalInstance = null;
  let pendingDeleteId = null;
  let currentFilteredExpenses = [];
  let currentPnlData = [];

  if (expenseModalEl && window.bootstrap) {
    expenseModalInstance = new bootstrap.Modal(expenseModalEl);
  }
  if (deleteExpenseModalEl && window.bootstrap) {
    deleteModalInstance = new bootstrap.Modal(deleteExpenseModalEl);
  }

  // Toast notifier
  const notify = (msg, type = 'info') => typeof showToast === 'function' ? showToast(msg, type) : alert(msg);

  // Initialize date filter fields
  function updatePeriodDates() {
    const period = periodFilterEl ? periodFilterEl.value : 'all';
    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = now.getMonth(); // 0-indexed

    const fmtDate = (d) => typeof toLocalISODate === 'function'
      ? toLocalISODate(d)
      : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    if (period === 'all') {
      if (fromDateEl) fromDateEl.value = '';
      if (toDateEl) toDateEl.value = '';
    } else if (period === 'this_month') {
      if (fromDateEl) fromDateEl.value = fmtDate(new Date(curYear, curMonth, 1));
      if (toDateEl) toDateEl.value = fmtDate(new Date(curYear, curMonth + 1, 0));
    } else if (period === 'last_month') {
      if (fromDateEl) fromDateEl.value = fmtDate(new Date(curYear, curMonth - 1, 1));
      if (toDateEl) toDateEl.value = fmtDate(new Date(curYear, curMonth, 0));
    } else if (period === 'this_quarter') {
      const qMonth = Math.floor(curMonth / 3) * 3;
      if (fromDateEl) fromDateEl.value = fmtDate(new Date(curYear, qMonth, 1));
      if (toDateEl) toDateEl.value = fmtDate(new Date(curYear, qMonth + 3, 0));
    } else if (period === 'this_fy') {
      const fyStart = curMonth >= 6 ? curYear : curYear - 1;
      if (fromDateEl) fromDateEl.value = `${fyStart}-07-01`;
      if (toDateEl) toDateEl.value = `${fyStart + 1}-06-30`;
    } else if (period === 'this_year') {
      if (fromDateEl) fromDateEl.value = `${curYear}-01-01`;
      if (toDateEl) toDateEl.value = `${curYear}-12-31`;
    }
  }

  // Populate Biller Dropdowns
  function populateBillerDropdowns() {
    if (typeof loadBillers !== 'function') return;
    const billers = loadBillers();
    const activeBillerId = typeof getActiveBillerId === 'function' ? getActiveBillerId() : 'biller_default';

    // 1. Filter Biller Dropdown
    if (billerFilterEl) {
      const currentVal = billerFilterEl.value || activeBillerId;
      let opts = '<option value="all">All Billers (Consolidated)</option>';
      billers.forEach(b => {
        opts += `<option value="${escapeAttr(b.id)}">${escapeHTML(b.name)}</option>`;
      });
      billerFilterEl.innerHTML = opts;
      billerFilterEl.value = currentVal;
    }

    // 2. Modal Biller Dropdown
    if (expenseBillerSelect) {
      let opts = '';
      billers.forEach(b => {
        opts += `<option value="${escapeAttr(b.id)}">${escapeHTML(b.name)}</option>`;
      });
      expenseBillerSelect.innerHTML = opts;
      expenseBillerSelect.value = activeBillerId;
    }
  }

  // Populate Categories Dropdowns
  function populateCategoryDropdowns(selectedCategory = null) {
    if (typeof loadExpenseCategories !== 'function') return;
    const categories = loadExpenseCategories();

    // 1. Filter Category Dropdown
    if (categoryFilterEl) {
      const currentFilter = categoryFilterEl.value || 'all';
      let fOpts = '<option value="all" selected>All Categories</option>';
      categories.forEach(c => {
        fOpts += `<option value="${escapeAttr(c)}">${escapeHTML(c)}</option>`;
      });
      categoryFilterEl.innerHTML = fOpts;
      categoryFilterEl.value = currentFilter;
    }

    // 2. Modal Form Category Dropdown
    if (expenseCategorySelect) {
      let mOpts = '';
      categories.forEach(c => {
        mOpts += `<option value="${escapeAttr(c)}">${escapeHTML(c)}</option>`;
      });
      expenseCategorySelect.innerHTML = mOpts;
      if (selectedCategory && categories.includes(selectedCategory)) {
        expenseCategorySelect.value = selectedCategory;
      }
    }
  }

  // Populate Payee Datalist
  function populatePayeeDatalist() {
    if (!payeeDatalist || typeof loadExpenses !== 'function') return;
    const expenses = loadExpenses();
    const payees = Array.from(new Set(expenses.map(e => e.payee).filter(Boolean))).sort();
    payeeDatalist.innerHTML = payees.map(p => `<option value="${escapeAttr(p)}">`).join('');
  }

  // Filter Expenses Logic
  function getFilteredExpenses() {
    if (typeof loadExpenses !== 'function') return [];
    let list = loadExpenses();

    const billerId = billerFilterEl ? billerFilterEl.value : 'all';
    const fromDate = fromDateEl ? fromDateEl.value : '';
    const toDate = toDateEl ? toDateEl.value : '';
    const category = categoryFilterEl ? categoryFilterEl.value : 'all';
    const method = methodFilterEl ? methodFilterEl.value : 'all';
    const search = searchFilterEl ? searchFilterEl.value.trim().toLowerCase() : '';

    // Filter by Biller
    if (billerId && billerId !== 'all') {
      list = list.filter(e => (e.billerId || 'biller_default') === billerId);
    }

    // Filter by Date Range
    if (fromDate) {
      list = list.filter(e => e.date >= fromDate);
    }
    if (toDate) {
      list = list.filter(e => e.date <= toDate);
    }

    // Filter by Category
    if (category && category !== 'all') {
      list = list.filter(e => e.category === category);
    }

    // Filter by Payment Method
    if (method && method !== 'all') {
      list = list.filter(e => (e.paymentMethod || '').toLowerCase() === method.toLowerCase());
    }

    // Filter by Keyword Search
    if (search) {
      list = list.filter(e => {
        return (
          (e.id || '').toLowerCase().includes(search) ||
          (e.payee || '').toLowerCase().includes(search) ||
          (e.notes || '').toLowerCase().includes(search) ||
          (e.reference || '').toLowerCase().includes(search) ||
          (e.category || '').toLowerCase().includes(search) ||
          String(e.amount || '').includes(search)
        );
      });
    }

    // Sort descending by date, then id
    list.sort((a, b) => {
      const cmpDate = (b.date || '').localeCompare(a.date || '');
      if (cmpDate !== 0) return cmpDate;
      return (b.id || '').localeCompare(a.id || '');
    });

    return list;
  }

  // Render Expense Register Table
  function renderExpenseRegister(expenses) {
    if (!expensesTableBody) return;
    expensesTableBody.innerHTML = '';
    currentFilteredExpenses = expenses;

    let totalAmount = 0;

    if (expenses.length === 0) {
      if (noExpensesMessage) noExpensesMessage.classList.remove('d-none');
    } else {
      if (noExpensesMessage) noExpensesMessage.classList.add('d-none');
      expenses.forEach(exp => {
        const amt = roundBDT(exp.amount || 0);
        totalAmount = roundBDT(totalAmount + amt);

        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${escapeHTML(formatDisplayDate(exp.date))}</td>
          <td><span class="font-monospace fw-semibold">${escapeHTML(exp.id)}</span></td>
          <td><span class="category-pill">${escapeHTML(exp.category || 'General')}</span></td>
          <td>
            <div class="fw-semibold text-body">${escapeHTML(exp.payee || '—')}</div>
          </td>
          <td><span class="badge bg-body-tertiary text-body border">${escapeHTML(exp.paymentMethod || 'Cash')}</span></td>
          <td>
            <div class="small text-muted text-truncate" style="max-width: 200px;" title="${escapeAttr(exp.notes || exp.reference || '')}">
              ${escapeHTML(exp.notes || (exp.reference ? `Ref: ${exp.reference}` : '—'))}
            </div>
          </td>
          <td class="text-end fw-bold text-danger">${formatBDT(amt)}</td>
          <td class="text-end no-print">
            <button class="btn btn-sm btn-outline-primary btn-edit-expense p-1 px-2" data-id="${escapeAttr(exp.id)}" title="Edit Voucher" aria-label="Edit Voucher ${escapeAttr(exp.id)}">✏️</button>
            <button class="btn btn-sm btn-outline-danger btn-delete-expense p-1 px-2 ms-1" data-id="${escapeAttr(exp.id)}" title="Delete Voucher" aria-label="Delete Voucher ${escapeAttr(exp.id)}">🗑️</button>
          </td>
        `;
        expensesTableBody.appendChild(tr);
      });
    }

    if (registerTotalAmount) registerTotalAmount.textContent = formatBDT(totalAmount);
    if (footerTotalAmount) footerTotalAmount.textContent = formatBDT(totalAmount);
    if (tabCountRegister) tabCountRegister.textContent = expenses.length;

    if (registerFilteredSummary) {
      const period = periodFilterEl ? periodFilterEl.options[periodFilterEl.selectedIndex]?.text : 'All Time';
      registerFilteredSummary.textContent = `Showing ${expenses.length} transaction${expenses.length === 1 ? '' : 's'} (${period})`;
    }
  }

  // Render Financial Overview KPIs (Earnings vs Spending)
  function renderFinancialKPIs(expenses) {
    const selectedBillerId = billerFilterEl ? billerFilterEl.value : 'all';
    const fromDate = fromDateEl ? fromDateEl.value : '';
    const toDate = toDateEl ? toDateEl.value : '';

    let invs = typeof loadInvoices === 'function' ? loadInvoices() : [];
    let rcpts = typeof loadReceipts === 'function' ? loadReceipts() : [];

    if (selectedBillerId && selectedBillerId !== 'all') {
      invs = invs.filter(x => (x.billerId || 'biller_default') === selectedBillerId);
      rcpts = rcpts.filter(x => (x.billerId || 'biller_default') === selectedBillerId);
    }

    if (fromDate) {
      invs = invs.filter(x => (x.date || x.invoiceDate || '') >= fromDate);
      rcpts = rcpts.filter(x => (x.date || '') >= fromDate);
    }
    if (toDate) {
      invs = invs.filter(x => (x.date || x.invoiceDate || '') <= toDate);
      rcpts = rcpts.filter(x => (x.date || '') <= toDate);
    }

    let totalInvoiced = 0;
    let totalCollected = 0;

    invs.forEach(inv => {
      if (inv.status === 'Void') return;
      if (typeof getInvoicePaymentStats === 'function') {
        const st = getInvoicePaymentStats(inv);
        const isTaxWithholding = /\b(AIT|VDS)\b/i.test(st.adjustmentReason || '');
        totalInvoiced = roundBDT(totalInvoiced + (isTaxWithholding ? st.originalTotal : st.total));
      } else {
        totalInvoiced = roundBDT(totalInvoiced + (Number(inv.grandTotal) || 0));
      }
    });

    // Cash Inflow strictly sums receipts dated in the selected period
    rcpts.forEach(r => {
      if (r.status === 'Void') return;
      totalCollected = roundBDT(totalCollected + (Number(r.amount) || 0));
    });

    let totalExpenses = 0;
    expenses.forEach(e => {
      totalExpenses = roundBDT(totalExpenses + (Number(e.amount) || 0));
    });

    // When category/method/search narrows the register, compute true period outflow for Profit & Absorption so KPIs don't distort
    const categoryVal = categoryFilterEl ? categoryFilterEl.value : 'all';
    const methodVal = methodFilterEl ? methodFilterEl.value : 'all';
    const searchVal = searchFilterEl ? searchFilterEl.value.trim() : '';
    const isSubFiltered = categoryVal !== 'all' || methodVal !== 'all' || searchVal !== '';

    let periodExpenses = totalExpenses;
    if (isSubFiltered && typeof loadExpenses === 'function') {
      let allExps = loadExpenses();
      if (selectedBillerId && selectedBillerId !== 'all') {
        allExps = allExps.filter(x => (x.billerId || 'biller_default') === selectedBillerId);
      }
      if (fromDate) allExps = allExps.filter(x => (x.date || '') >= fromDate);
      if (toDate) allExps = allExps.filter(x => (x.date || '') <= toDate);
      periodExpenses = allExps.reduce((s, x) => roundBDT(s + (Number(x.amount) || 0)), 0);
    }

    const netProfit = roundBDT(totalCollected - periodExpenses);
    const profitMargin = totalCollected > 0 ? roundBDT((netProfit / totalCollected) * 100) : 0;
    const burnRate = totalCollected > 0 ? roundBDT((periodExpenses / totalCollected) * 100) : (periodExpenses > 0 ? 100 : 0);

    if (kpiEarnedEl) kpiEarnedEl.textContent = formatBDT(totalCollected);
    if (kpiInvoicedSubEl) kpiInvoicedSubEl.textContent = `Total Invoiced: ${formatBDT(totalInvoiced)}`;
    if (kpiSpentEl) kpiSpentEl.textContent = formatBDT(totalExpenses);
    if (kpiSpentSubEl) {
      kpiSpentSubEl.textContent = isSubFiltered
        ? `${expenses.length} filtered (Period All: ${formatBDT(periodExpenses)})`
        : `${expenses.length} transaction${expenses.length === 1 ? '' : 's'}`;
    }

    if (kpiNetProfitEl) {
      const isDeficit = netProfit < 0;
      kpiNetProfitEl.textContent = formatBDT(netProfit);
      if (isDeficit) {
        kpiNetProfitEl.className = 'expense-kpi-value text-danger';
        if (kpiProfitBadgeEl) {
          kpiProfitBadgeEl.className = 'badge bg-danger-subtle text-danger';
          kpiProfitBadgeEl.textContent = 'Deficit / Loss';
        }
        if (kpiMarginSubEl) kpiMarginSubEl.textContent = `Operating Deficit (${profitMargin}%)`;
      } else {
        kpiNetProfitEl.className = 'expense-kpi-value text-success';
        if (kpiProfitBadgeEl) {
          kpiProfitBadgeEl.className = 'badge bg-success-subtle text-success';
          kpiProfitBadgeEl.textContent = 'Net Surplus';
        }
        if (kpiMarginSubEl) kpiMarginSubEl.textContent = `Net Cash Margin: ${profitMargin}%`;
      }
    }

    if (kpiBurnRateEl) kpiBurnRateEl.textContent = `${burnRate}%`;
    if (kpiBurnSubEl) {
      kpiBurnSubEl.textContent = totalCollected > 0
        ? (isSubFiltered ? `${burnRate}% period revenue consumed` : `${burnRate}% of collected revenue consumed`)
        : 'No earnings recorded in period';
    }
  }

  // Render Category Breakdown (Tab 2)
  function renderCategoryBreakdown(expenses) {
    if (!categoryCardsContainer || !categoryTableBody) return;
    categoryCardsContainer.innerHTML = '';
    categoryTableBody.innerHTML = '';

    const categoryMap = new Map();
    let grandTotal = 0;

    expenses.forEach(e => {
      const cat = e.category || 'Miscellaneous';
      const amt = roundBDT(e.amount || 0);
      grandTotal = roundBDT(grandTotal + amt);
      if (!categoryMap.has(cat)) {
        categoryMap.set(cat, { category: cat, total: 0, count: 0 });
      }
      const item = categoryMap.get(cat);
      item.total = roundBDT(item.total + amt);
      item.count += 1;
    });

    const categoryList = Array.from(categoryMap.values()).sort((a, b) => b.total - a.total);

    if (categoryList.length === 0) {
      categoryCardsContainer.innerHTML = `<div class="col-12 text-muted text-center py-4">No expense categories to display.</div>`;
      categoryTableBody.innerHTML = `<tr><td colspan="5" class="text-muted text-center py-3">No expenses recorded.</td></tr>`;
      return;
    }

    // Top 4 Category Cards
    categoryList.slice(0, 4).forEach(c => {
      const pct = grandTotal > 0 ? ((c.total / grandTotal) * 100).toFixed(1) : 0;
      const col = document.createElement('div');
      col.className = 'col-12 col-sm-6 col-xl-3';
      col.innerHTML = `
        <div class="card border p-3 h-100 shadow-sm bg-body">
          <div class="d-flex justify-content-between align-items-center mb-1">
            <span class="small fw-semibold text-muted text-truncate" title="${escapeAttr(c.category)}">${escapeHTML(c.category)}</span>
            <span class="badge bg-secondary-subtle text-secondary">${pct}%</span>
          </div>
          <div class="h5 fw-bold text-danger mb-2">${formatBDT(c.total)}</div>
          <div class="progress progress-stacked-bar mb-2">
            <div class="progress-bar bg-danger" role="progressbar" style="width: ${pct}%" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"></div>
          </div>
          <div class="small text-muted">${c.count} transaction${c.count === 1 ? '' : 's'}</div>
        </div>
      `;
      categoryCardsContainer.appendChild(col);
    });

    // Summary Table
    categoryList.forEach(c => {
      const pct = grandTotal > 0 ? ((c.total / grandTotal) * 100).toFixed(1) : 0;
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="fw-semibold"><span class="category-pill">${escapeHTML(c.category)}</span></td>
        <td class="text-center">${c.count}</td>
        <td class="text-end fw-bold text-danger">${formatBDT(c.total)}</td>
        <td class="text-end">${pct}%</td>
        <td>
          <div class="progress progress-stacked-bar">
            <div class="progress-bar bg-danger" role="progressbar" style="width: ${pct}%" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"></div>
          </div>
        </td>
      `;
      categoryTableBody.appendChild(tr);
    });
  }

  // Render Monthly P&L Ledger (Tab 3)
  function renderMonthlyPnl() {
    if (!pnlTableBody || !pnlTableFoot) return;
    pnlTableBody.innerHTML = '';
    pnlTableFoot.innerHTML = '';

    const selectedBillerId = billerFilterEl ? billerFilterEl.value : 'all';
    let invs = typeof loadInvoices === 'function' ? loadInvoices() : [];
    let rcpts = typeof loadReceipts === 'function' ? loadReceipts() : [];
    let exps = typeof loadExpenses === 'function' ? loadExpenses() : [];

    if (selectedBillerId && selectedBillerId !== 'all') {
      invs = invs.filter(x => (x.billerId || 'biller_default') === selectedBillerId);
      rcpts = rcpts.filter(x => (x.billerId || 'biller_default') === selectedBillerId);
      exps = exps.filter(x => (x.billerId || 'biller_default') === selectedBillerId);
    }

    const monthMap = new Map();

    const getMonthKey = (dStr) => {
      if (!dStr) return null;
      return String(dStr).slice(0, 7); // 'YYYY-MM'
    };

    const ensureMonth = (mKey) => {
      if (!monthMap.has(mKey)) {
        monthMap.set(mKey, { month: mKey, invoiced: 0, collected: 0, expenses: 0 });
      }
      return monthMap.get(mKey);
    };

    const exclVat = !!(pnlNetVatToggle && pnlNetVatToggle.checked);
    const invByNo = new Map(invs.map(i => [i.invoiceNumber || i.number, i]));

    // Invoices
    invs.forEach(inv => {
      if (inv.status === 'Void') return;
      const m = getMonthKey(inv.date || inv.invoiceDate);
      if (m) {
        const item = ensureMonth(m);
        const st = typeof getInvoicePaymentStats === 'function' ? getInvoicePaymentStats(inv) : null;
        const baseGross = roundBDT(Number(inv.grandTotal || 0) || 0);
        const isTaxWithholding = st && /\b(AIT|VDS)\b/i.test(st.adjustmentReason || '');
        const gross = isTaxWithholding ? baseGross : (st ? st.total : baseGross);
        const vat = roundBDT(Number(inv.vatAmount || 0) || 0);
        const vatScale = baseGross > 0 ? Math.min(1, gross / baseGross) : 0;
        const effectiveVat = roundBDT(vat * vatScale);
        const amt = exclVat ? roundBDT(Math.max(0, gross - effectiveVat)) : gross;
        item.invoiced = roundBDT(item.invoiced + (isFinite(amt) ? amt : 0));
      }
    });

    // Receipts (Actual cash collected, scaled net-of-VAT if toggle active and VDS wasn't already withheld)
    rcpts.forEach(rc => {
      if (rc.status === 'Void') return;
      const m = getMonthKey(rc.date);
      if (m) {
        const item = ensureMonth(m);
        let amt = Number(rc.amount || 0);
        const vdsWithheld = !!(rc.adjustment && rc.adjustment.applied && /\bVDS\b/i.test(rc.adjustment.reason || ''));
        if (exclVat && !vdsWithheld && rc.invoiceNumber && invByNo.has(rc.invoiceNumber)) {
          const linkedInv = invByNo.get(rc.invoiceNumber);
          const g = Number(linkedInv.grandTotal || 0);
          const v = Number(linkedInv.vatAmount || 0);
          if (g > 0 && v > 0) {
            amt = roundBDT(amt * (Math.max(0, g - v) / g));
          }
        }
        item.collected = roundBDT(item.collected + (isFinite(amt) ? amt : 0));
      }
    });

    // Expenses
    exps.forEach(e => {
      const m = getMonthKey(e.date);
      if (m) {
        const item = ensureMonth(m);
        const gross = Number(e.amount || 0);
        const vat = roundBDT(Number(e.vatAmount || 0) || 0);
        const amt = exclVat ? roundBDT(Math.max(0, gross - vat)) : gross;
        item.expenses = roundBDT(item.expenses + (isFinite(amt) ? amt : 0));
      }
    });

    const months = Array.from(monthMap.keys()).sort().reverse();
    currentPnlData = [];

    if (months.length === 0) {
      pnlTableBody.innerHTML = `<tr><td colspan="7" class="text-muted text-center py-4">No monthly cash flow activity recorded yet.</td></tr>`;
      return;
    }

    let gInvoiced = 0;
    let gCollected = 0;
    let gExpenses = 0;

    months.forEach(mKey => {
      const d = monthMap.get(mKey);
      const net = roundBDT(d.collected - d.expenses);
      const margin = d.collected > 0 ? roundBDT((net / d.collected) * 100) : 0;
      const isProfit = net >= 0;

      gInvoiced = roundBDT(gInvoiced + d.invoiced);
      gCollected = roundBDT(gCollected + d.collected);
      gExpenses = roundBDT(gExpenses + d.expenses);

      // Label month e.g. "October 2026"
      const [y, mNum] = mKey.split('-');
      const dateObj = new Date(parseInt(y, 10), parseInt(mNum, 10) - 1, 1);
      const monthLabel = dateObj.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

      currentPnlData.push({
        monthKey: mKey,
        monthLabel,
        invoiced: d.invoiced,
        collected: d.collected,
        expenses: d.expenses,
        net,
        margin,
        isProfit
      });

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="fw-bold">${escapeHTML(monthLabel)}</td>
        <td class="text-end">${formatBDT(d.invoiced)}</td>
        <td class="text-end text-success fw-semibold">${formatBDT(d.collected)}</td>
        <td class="text-end text-danger fw-semibold">${formatBDT(d.expenses)}</td>
        <td class="text-end fw-bold ${isProfit ? 'text-success' : 'text-danger'}">${isProfit ? '+' : ''}${formatBDT(net)}</td>
        <td class="text-center fw-semibold ${isProfit ? 'text-success' : 'text-danger'}">${margin}%</td>
        <td class="text-center">
          <span class="badge ${isProfit ? 'bg-success-subtle text-success border border-success-subtle' : 'bg-danger-subtle text-danger border border-danger-subtle'}">
            ${isProfit ? 'Surplus' : 'Deficit'}
          </span>
        </td>
      `;
      pnlTableBody.appendChild(tr);
    });

    const grandNet = roundBDT(gCollected - gExpenses);
    const grandMargin = gCollected > 0 ? roundBDT((grandNet / gCollected) * 100) : 0;
    const isGrandProfit = grandNet >= 0;

    pnlTableFoot.innerHTML = `
      <tr>
        <th class="fw-bold">Cumulative All-Time:</th>
        <th class="text-end fw-bold">${formatBDT(gInvoiced)}</th>
        <th class="text-end fw-bold text-success">${formatBDT(gCollected)}</th>
        <th class="text-end fw-bold text-danger">${formatBDT(gExpenses)}</th>
        <th class="text-end fw-bold ${isGrandProfit ? 'text-success' : 'text-danger'}">${isGrandProfit ? '+' : ''}${formatBDT(grandNet)}</th>
        <th class="text-center fw-bold ${isGrandProfit ? 'text-success' : 'text-danger'}">${grandMargin}%</th>
        <th class="text-center">
          <span class="badge ${isGrandProfit ? 'bg-success text-white' : 'bg-danger text-white'}">
            ${isGrandProfit ? 'Profitable' : 'Deficit'}
          </span>
        </th>
      </tr>
    `;
  }

  // Refresh entire UI
  function refreshExpensesUI() {
    const expenses = getFilteredExpenses();
    renderExpenseRegister(expenses);
    renderFinancialKPIs(expenses);
    renderCategoryBreakdown(expenses);
    renderMonthlyPnl();
    populatePayeeDatalist();
  }

  // Filter Event Listeners
  if (billerFilterEl) billerFilterEl.addEventListener('change', refreshExpensesUI);
  if (periodFilterEl) {
    periodFilterEl.addEventListener('change', () => {
      updatePeriodDates();
      refreshExpensesUI();
    });
  }
  if (fromDateEl) fromDateEl.addEventListener('change', refreshExpensesUI);
  if (toDateEl) toDateEl.addEventListener('change', refreshExpensesUI);
  if (pnlNetVatToggle) pnlNetVatToggle.addEventListener('change', renderMonthlyPnl);
  if (categoryFilterEl) categoryFilterEl.addEventListener('change', refreshExpensesUI);
  if (methodFilterEl) methodFilterEl.addEventListener('change', refreshExpensesUI);
  if (searchFilterEl) {
    searchFilterEl.addEventListener('input', () => {
      const expenses = getFilteredExpenses();
      renderExpenseRegister(expenses);
      renderFinancialKPIs(expenses);
      renderCategoryBreakdown(expenses);
    });
  }

  if (resetFiltersBtn) {
    resetFiltersBtn.addEventListener('click', () => {
      if (billerFilterEl) billerFilterEl.value = 'all';
      if (periodFilterEl) periodFilterEl.value = 'all';
      if (fromDateEl) fromDateEl.value = '';
      if (toDateEl) toDateEl.value = '';
      if (categoryFilterEl) categoryFilterEl.value = 'all';
      if (methodFilterEl) methodFilterEl.value = 'all';
      if (searchFilterEl) searchFilterEl.value = '';
      refreshExpensesUI();
      notify('Filters reset.', 'info');
    });
  }

  // Amount In Words Live Preview
  if (expenseAmount && expenseAmountWords) {
    expenseAmount.addEventListener('input', () => {
      const val = parseFloat(expenseAmount.value);
      if (!isNaN(val) && val > 0 && typeof numberToWordsBDT === 'function') {
        expenseAmountWords.textContent = numberToWordsBDT(roundBDT(val));
      } else {
        expenseAmountWords.textContent = 'Zero Taka only';
      }
    });
  }

  // New Category Inline Toggler
  if (toggleNewCategoryBtn && newCategoryWrap) {
    toggleNewCategoryBtn.addEventListener('click', () => {
      newCategoryWrap.classList.remove('d-none');
      if (newCategoryInput) newCategoryInput.focus();
    });
  }
  if (cancelNewCategoryBtn && newCategoryWrap) {
    cancelNewCategoryBtn.addEventListener('click', () => {
      newCategoryWrap.classList.add('d-none');
      if (newCategoryInput) newCategoryInput.value = '';
    });
  }
  if (saveNewCategoryBtn && newCategoryInput) {
    saveNewCategoryBtn.addEventListener('click', () => {
      const val = newCategoryInput.value.trim();
      if (!val) {
        notify('Please enter category name.', 'warning');
        return;
      }
      if (typeof saveExpenseCategory === 'function') {
        const added = saveExpenseCategory(val);
        populateCategoryDropdowns(added);
        notify(`Category "${added}" added.`, 'success');
        newCategoryInput.value = '';
        if (newCategoryWrap) newCategoryWrap.classList.add('d-none');
      }
    });
  }

  // Open Modal for New Expense
  function openNewExpenseModal() {
    if (expenseForm) expenseForm.reset();
    if (expenseEditId) expenseEditId.value = '';
    if (expenseModalLabel) expenseModalLabel.textContent = 'Record Business Expense Voucher';
    if (expenseDate) expenseDate.value = typeof toLocalISODate === 'function' ? toLocalISODate() : new Date().toISOString().slice(0, 10);
    if (expenseVatAmount) expenseVatAmount.value = '';
    if (expenseAmountWords) expenseAmountWords.textContent = 'Zero Taka only';
    if (newCategoryWrap) newCategoryWrap.classList.add('d-none');

    populateBillerDropdowns();
    populateCategoryDropdowns();
    populatePayeeDatalist();

    const billerId = expenseBillerSelect ? expenseBillerSelect.value : getActiveBillerId();
    if (expenseVoucherNo && typeof peekNextExpenseNumber === 'function') {
      expenseVoucherNo.value = peekNextExpenseNumber(billerId);
    }

    if (expenseModalInstance) expenseModalInstance.show();
  }

  if (openExpenseModalBtn) {
    openExpenseModalBtn.addEventListener('click', openNewExpenseModal);
  }

  // Update voucher sequence preview when biller changes in modal
  if (expenseBillerSelect) {
    expenseBillerSelect.addEventListener('change', () => {
      if (!expenseEditId.value && typeof peekNextExpenseNumber === 'function') {
        expenseVoucherNo.value = peekNextExpenseNumber(expenseBillerSelect.value);
      }
    });
  }

  // Open Modal for Editing Expense
  function openEditExpenseModal(id) {
    if (typeof getExpenseById !== 'function') return;
    const exp = getExpenseById(id);
    if (!exp) {
      notify('Expense record not found.', 'danger');
      return;
    }

    if (expenseEditId) expenseEditId.value = exp.id;
    if (expenseModalLabel) expenseModalLabel.textContent = `Edit Expense Voucher: ${exp.id}`;
    if (expenseVoucherNo) expenseVoucherNo.value = exp.id;
    if (expenseDate) expenseDate.value = exp.date || (typeof toLocalISODate === 'function' ? toLocalISODate() : new Date().toISOString().slice(0, 10));
    if (expenseAmount) expenseAmount.value = exp.amount;
    if (expenseVatAmount) expenseVatAmount.value = exp.vatAmount > 0 ? exp.vatAmount : '';
    if (expensePayee) expensePayee.value = exp.payee || '';
    if (expensePaymentMethod) expensePaymentMethod.value = exp.paymentMethod || 'Cash';
    if (expenseReference) expenseReference.value = exp.reference || '';
    if (expenseNotes) expenseNotes.value = exp.notes || '';

    if (expenseAmountWords && typeof numberToWordsBDT === 'function') {
      expenseAmountWords.textContent = numberToWordsBDT(roundBDT(exp.amount));
    }

    populateBillerDropdowns();
    if (expenseBillerSelect && exp.billerId) {
      expenseBillerSelect.value = exp.billerId;
    }

    populateCategoryDropdowns(exp.category);

    if (expenseModalInstance) expenseModalInstance.show();
  }

  // Save Expense Form
  if (expenseForm) {
    expenseForm.addEventListener('submit', (e) => {
      e.preventDefault();

      const rawAmount = parseFloat(expenseAmount.value);
      if (isNaN(rawAmount) || rawAmount <= 0) {
        notify('Please enter a valid expense amount.', 'warning');
        return;
      }

      const rawVat = parseFloat(expenseVatAmount?.value || '0');
      const vatAmount = isFinite(rawVat) && rawVat > 0 ? roundBDT(Math.min(rawVat, rawAmount)) : 0;

      const isEdit = !!expenseEditId.value;
      const billerId = expenseBillerSelect ? expenseBillerSelect.value : getActiveBillerId();
      const id = isEdit ? expenseEditId.value : (expenseVoucherNo.value || peekNextExpenseNumber(billerId));

      const payload = {
        id,
        billerId,
        date: expenseDate.value || (typeof toLocalISODate === 'function' ? toLocalISODate() : new Date().toISOString().slice(0, 10)),
        category: expenseCategorySelect.value || 'Miscellaneous',
        amount: roundBDT(rawAmount),
        vatAmount,
        payee: expensePayee.value.trim(),
        paymentMethod: expensePaymentMethod.value || 'Cash',
        reference: expenseReference ? expenseReference.value.trim() : '',
        notes: expenseNotes ? expenseNotes.value.trim() : ''
      };

      if (typeof saveExpense === 'function') {
        const saved = saveExpense(payload);
        if (saved) {
          notify(`Expense voucher ${saved.id} ${isEdit ? 'updated' : 'recorded'} successfully!`, 'success');
          if (expenseModalInstance) expenseModalInstance.hide();
          refreshExpensesUI();
        } else {
          notify('Failed to save expense voucher.', 'danger');
        }
      }
    });
  }

  // Table Action Delegation (Edit / Delete)
  if (expensesTableBody) {
    expensesTableBody.addEventListener('click', (e) => {
      const editBtn = e.target.closest('.btn-edit-expense');
      const delBtn = e.target.closest('.btn-delete-expense');

      if (editBtn) {
        const id = editBtn.dataset.id;
        openEditExpenseModal(id);
      } else if (delBtn) {
        const id = delBtn.dataset.id;
        const exp = typeof getExpenseById === 'function' ? getExpenseById(id) : null;
        if (!exp) return;
        pendingDeleteId = id;
        if (deleteExpenseVoucherNo) deleteExpenseVoucherNo.textContent = exp.id;
        if (deleteExpenseAmount) deleteExpenseAmount.textContent = formatBDT(exp.amount);
        if (deleteModalInstance) deleteModalInstance.show();
      }
    });
  }

  // Confirm Delete
  if (confirmDeleteExpenseBtn) {
    confirmDeleteExpenseBtn.addEventListener('click', () => {
      if (!pendingDeleteId) return;
      if (typeof deleteExpense === 'function') {
        const ok = deleteExpense(pendingDeleteId);
        if (ok) {
          notify(`Voucher ${pendingDeleteId} deleted.`, 'success');
          if (deleteModalInstance) deleteModalInstance.hide();
          pendingDeleteId = null;
          refreshExpensesUI();
        } else {
          notify('Failed to delete expense voucher.', 'danger');
        }
      }
    });
  }

  // Export Expenses CSV (uses shared downloadCSV from js/utils.js)
  if (exportExpensesCsvBtn) {
    exportExpensesCsvBtn.addEventListener('click', () => {
      if (!currentFilteredExpenses.length) {
        notify('No expenses available to export for selected filters.', 'info');
        return;
      }

      const billers = typeof loadBillers === 'function' ? loadBillers() : [];
      const billerMap = new Map(billers.map(b => [b.id, b.name]));

      const headers = ['Voucher No', 'Date', 'Biller / Company', 'Category', 'Payee / Vendor', 'Payment Mode', 'Reference', 'Notes', 'VAT Incl. (BDT)', 'Amount (BDT)'];
      const rows = [headers, ...currentFilteredExpenses.map(e => [
        e.id,
        e.date,
        billerMap.get(e.billerId) || 'Default',
        e.category,
        e.payee,
        e.paymentMethod,
        e.reference || '',
        e.notes || '',
        roundBDT(e.vatAmount || 0),
        e.amount
      ])];

      const todayStr = typeof toLocalISODate === 'function' ? toLocalISODate() : new Date().toISOString().slice(0, 10);
      const fname = `expenses_register_${todayStr}.csv`;
      downloadCSV(fname, rows);
      notify('Expense register exported to CSV.', 'success');
    });
  }

  // Export Monthly P&L CSV
  if (exportPnlCsvBtn) {
    exportPnlCsvBtn.addEventListener('click', () => {
      if (!currentPnlData.length) {
        notify('No monthly P&L data to export.', 'info');
        return;
      }
      const headers = ['Month', 'Invoiced (BDT)', 'Collected Inflow (BDT)', 'Expenses Outflow (BDT)', 'Net Balance (BDT)', 'Cash Margin (%)', 'Status'];
      const rows = [headers, ...currentPnlData.map(d => [
        d.monthLabel,
        d.invoiced,
        d.collected,
        d.expenses,
        d.net,
        d.margin,
        d.isProfit ? 'Surplus' : 'Deficit'
      ])];

      const todayStr = typeof toLocalISODate === 'function' ? toLocalISODate() : new Date().toISOString().slice(0, 10);
      const fname = `monthly_pnl_cashflow_${todayStr}.csv`;
      downloadCSV(fname, rows);
      notify('Monthly P&L exported to CSV.', 'success');
    });
  }

  function prepareExpensesForPrint() {
    if (typeof setCompanyHeader === 'function') setCompanyHeader();
    const todayStr = typeof toLocalISODate === 'function' ? toLocalISODate() : new Date().toISOString().slice(0, 10);
    if (typeof setPrintDocumentTitle === 'function') {
      return setPrintDocumentTitle('EXPENSE-LEDGER', todayStr);
    }
    return `EXPENSE-LEDGER_${todayStr}`;
  }

  window.addEventListener('beforeprint', prepareExpensesForPrint);

  // Print Ledger
  if (printLedgerBtn) {
    printLedgerBtn.addEventListener('click', () => {
      prepareExpensesForPrint();
      window.print();
    });
  }

  if (typeof initPdfDownloadButton === 'function') {
    initPdfDownloadButton('downloadPdfBtn', prepareExpensesForPrint, prepareExpensesForPrint);
  }
  if (typeof runAutoPrintIfRequested === 'function') {
    runAutoPrintIfRequested(prepareExpensesForPrint);
  }

  // Reactive listeners for multi-tab synchronization and biller switches
  window.addEventListener('billerchange', () => {
    populateBillerDropdowns();
    refreshExpensesUI();
  });

  window.addEventListener('storagesync', () => {
    populateCategoryDropdowns();
    refreshExpensesUI();
  });

  // Initial Boot
  populateBillerDropdowns();
  populateCategoryDropdowns();
  updatePeriodDates();
  refreshExpensesUI();
});
