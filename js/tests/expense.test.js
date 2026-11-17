// Unit tests for Expense Tracking & Profit/Loss Management

test('loadExpenseCategories initializes defaults and saveExpenseCategory appends custom category', () => {
  localStorage.removeItem(STORAGE_KEYS.expenseCategories);
  const categories = loadExpenseCategories();
  const t1 = ok(Array.isArray(categories), 'Categories is an array');
  const t2 = ok(categories.length >= 10, 'Contains default expense categories');
  const t3 = ok(categories.includes('Hardware & Components'), 'Includes Hardware & Components');

  const added = saveExpenseCategory('PCB Prototyping');
  const updated = loadExpenseCategories();
  const t4 = ok(added === 'PCB Prototyping', 'Category name returned');
  const t5 = ok(updated.includes('PCB Prototyping'), 'Custom category successfully appended');

  // Case-insensitive duplicate prevention
  saveExpenseCategory('pcb prototyping');
  const afterDup = loadExpenseCategories();
  const dupCount = afterDup.filter(c => c.toLowerCase() === 'pcb prototyping').length;
  const t6 = ok(dupCount === 1, 'Duplicate category prevented');

  return [t1, t2, t3, t4, t5, t6];
});

test('saveExpense creates expense with monotonic voucher number and roundBDT precision', () => {
  localStorage.removeItem(STORAGE_KEYS.expenses);
  localStorage.removeItem(STORAGE_KEYS.lastExpenseNo);

  const exp1 = saveExpense({
    date: '2026-10-25',
    category: 'Hardware & Components',
    amount: 1450.555, // Should round to 1450.56
    payee: 'TechShop BD',
    paymentMethod: 'bKash',
    reference: 'TRX998811',
    notes: 'STM32 development boards'
  });

  const t1 = ok(exp1 !== null, 'Expense saved successfully');
  const t2 = ok(exp1.id && exp1.id.startsWith('EXP-'), 'Voucher ID generated with EXP prefix');
  const t3 = ok(exp1.amount === 1450.56, 'Amount rounded with roundBDT precision (1450.56)');
  const t4 = ok(exp1.payee === 'TechShop BD', 'Payee recorded');
  const t5 = ok(exp1.paymentMethod === 'bKash', 'Payment method recorded');

  // Second expense should increment sequence monotonically
  const exp2 = saveExpense({
    date: '2026-10-25',
    category: 'Tools & Lab Equipment',
    amount: 2500,
    payee: 'Dhaka Electronics Market'
  });

  const t6 = ok(exp2.id !== exp1.id, 'Distinct voucher numbers');
  const num1 = parseInt(exp1.id.split('-').pop(), 10);
  const num2 = parseInt(exp2.id.split('-').pop(), 10);
  const t7 = ok(num2 === num1 + 1, 'Monotonically increments voucher sequence');

  return [t1, t2, t3, t4, t5, t6, t7];
});

test('loadExpenses, getExpenseById, and update existing expense', () => {
  localStorage.removeItem(STORAGE_KEYS.expenses);

  const exp = saveExpense({
    date: '2026-10-20',
    category: 'Internet & Communication',
    amount: 1200,
    payee: 'AmberIT Broadband',
    paymentMethod: 'Bank'
  });

  const all = loadExpenses();
  const t1 = ok(all.length === 1, 'One expense loaded');

  const found = getExpenseById(exp.id);
  const t2 = ok(found !== null && found.id === exp.id, 'getExpenseById locates correct record');

  // Update amount & payee
  const updated = saveExpense({
    id: exp.id,
    date: exp.date,
    category: exp.category,
    amount: 1500,
    payee: 'AmberIT Fiber Gigabit',
    paymentMethod: 'Bank'
  });

  const allAfterUpdate = loadExpenses();
  const t3 = ok(allAfterUpdate.length === 1, 'Record count unchanged after edit');
  const t4 = ok(allAfterUpdate[0].amount === 1500, 'Updated amount persisted');
  const t5 = ok(allAfterUpdate[0].payee === 'AmberIT Fiber Gigabit', 'Updated payee persisted');

  return [t1, t2, t3, t4, t5];
});

test('deleteExpense removes record and handles non-existent gracefully', () => {
  localStorage.removeItem(STORAGE_KEYS.expenses);

  const exp = saveExpense({
    date: '2026-10-21',
    category: 'Meals & Refreshments',
    amount: 350,
    payee: 'Local Cafe'
  });

  const t1 = ok(loadExpenses().length === 1, 'Expense exists before deletion');
  const delSuccess = deleteExpense(exp.id);
  const t2 = ok(delSuccess === true, 'deleteExpense returns true on success');
  const t3 = ok(loadExpenses().length === 0, 'Expense array empty after deletion');

  const delNonExistent = deleteExpense('EXP-NON-EXISTENT');
  const t4 = ok(delNonExistent === false, 'deleteExpense returns false for unknown ID');

  return [t1, t2, t3, t4];
});

test('Multi-biller expense sequence isolation and custom prefix support', () => {
  localStorage.removeItem(STORAGE_KEYS.billers);
  localStorage.removeItem(STORAGE_KEYS.activeBillerId);

  const billerA = saveBiller({
    name: 'Biller Alpha Solutions',
    prefixes: { expense: 'ALPHA-EXP' }
  });

  const billerB = saveBiller({
    name: 'Biller Beta Embedded',
    prefixes: { expense: 'BETA-EXP' }
  });

  const expA = saveExpense({
    billerId: billerA.id,
    category: 'Hardware & Components',
    amount: 5000,
    payee: 'Mouser Electronics'
  });

  const expB = saveExpense({
    billerId: billerB.id,
    category: 'Software & Cloud Hosting',
    amount: 2500,
    payee: 'DigitalOcean'
  });

  const t1 = ok(expA.id.startsWith('ALPHA-EXP-'), 'Biller A voucher uses custom prefix ALPHA-EXP');
  const t2 = ok(expB.id.startsWith('BETA-EXP-'), 'Biller B voucher uses custom prefix BETA-EXP');
  const t3 = ok(expA.billerId === billerA.id, 'Biller A ID retained');
  const t4 = ok(expB.billerId === billerB.id, 'Biller B ID retained');

  return [t1, t2, t3, t4];
});

test('getDashboardKPIs calculates totalExpenses, netProfit, and profitMargin accurately', () => {
  localStorage.removeItem(STORAGE_KEYS.invoices);
  localStorage.removeItem(STORAGE_KEYS.receipts);
  localStorage.removeItem(STORAGE_KEYS.expenses);

  // Setup invoice for 10,000 BDT
  saveInvoice({
    invoiceNumber: 'INV-2026-9001',
    billerId: 'biller_default',
    grandTotal: 10000,
    client: { name: 'Acme Corp' }
  });

  // Collect 6,000 BDT via Money Receipt
  saveReceipt({
    receiptNumber: 'RCPT-2026-9001',
    invoiceNumber: 'INV-2026-9001',
    billerId: 'biller_default',
    amount: 6000,
    date: '2026-10-25'
  });

  // Record expenses of 2,500 BDT
  saveExpense({
    billerId: 'biller_default',
    category: 'Tools & Lab Equipment',
    amount: 1500,
    payee: 'Hardware Mart'
  });

  saveExpense({
    billerId: 'biller_default',
    category: 'Internet & Communication',
    amount: 1000,
    payee: 'ISP Provider'
  });

  const kpis = getDashboardKPIs('biller_default');

  const t1 = ok(kpis.totalInvoiced === 10000, 'Total invoiced is 10,000 BDT');
  const t2 = ok(kpis.totalCollected === 6000, 'Total collected is 6,000 BDT');
  const t3 = ok(kpis.totalDue === 4000, 'Total due is 4,000 BDT');
  const t4 = ok(kpis.totalExpenses === 2500, 'Total expenses is 2,500 BDT');
  // Net Profit = Cash Collected (6000) - Total Expenses (2500) = 3500 BDT
  const t5 = ok(kpis.netProfit === 3500, 'Net profit is 3,500 BDT');
  // Margin % = (3500 / 6000) * 100 = 58.33%
  const t6 = ok(kpis.profitMargin === 58.33, 'Profit margin is 58.33%');
  const t7 = ok(kpis.counts.expenses === 2, 'Expense count is 2');

  return [t1, t2, t3, t4, t5, t6, t7];
});
