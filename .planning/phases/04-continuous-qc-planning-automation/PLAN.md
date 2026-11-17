# AutoInvoice v2.5 — Phased Implementation Plan (QA/QC Fixes, UI/UX Polish & Commercial Features)

**Plan Created:** November 17, 2026  
**Authors:** `autoinvoice-planner`, `autoinvoice-architect`, `autoinvoice-doc-finance`, `autoinvoice-implementer`, `autoinvoice-qc-auditor`  
**Discipline:** Ponytail Minimalism (`full` mode) + Continuous Dev-QA Loop

---

## 🎯 Scope & Objectives

Execute all 14 QA/QC & UI/Print remediation items from [AUDIT_REPORT.md](file:///e:/AutoInvoice/AUDIT_REPORT.md) and deliver all 6 approved Bangladeshi commercial workflow features across 4 atomic, test-verified waves.

---

## 📦 Phase 1: Critical SQLite Sync, Backup & Data-Loss Immunity
**Files Modified:** [db.js](file:///e:/AutoInvoice/db.js), [js/storage.js](file:///e:/AutoInvoice/js/storage.js), [server.js](file:///e:/AutoInvoice/server.js)

### Tasks
1. **`[QC-CRIT-01]` Prevent Empty `localStorage` from Wiping SQLite on Load (`db.js`, `js/storage.js`)**:
   - In `db.js` (`syncClientSnapshot`), only prune (`DELETE FROM <table>`) when the client snapshot contains at least 1 record overall OR `payload.forcePruneEmpty === true`. Never wipe populated SQLite tables when an uninitialized browser sends all-empty arrays.
   - In `js/storage.js` (`window.addEventListener('load')`), check if `localStorage` has 0 documents (`invoices`, `challans`, `quotations`, `receipts`, `expenses`). If empty and `/api/db/status` reports existing records on disk, automatically call `pullFromSQLite()` and dispatch `storagesync` instead of pushing an empty snapshot.
2. **`[QC-CRIT-02]` Fix SQLite Schema Mappings for Items, Expense Categories, Quotations & Receipts (`db.js`)**:
   - `upsertItem`: Resolve description as `item.name || item.desc || item.description || ''` and id as `item.id || (item.name || item.desc || item.description).toLowerCase().replace(/[^a-z0-9]/g, '_')`. Update `syncClientSnapshot` item ID extraction accordingly.
   - `upsertExpenseCategory`: Accept either a string (`"Hardware & Components"`) or an object (`{ id, name }`).
   - `upsertQuotation`: Resolve `client_name` as `qt.to?.name || qt.to?.company || qt.client?.name || qt.clientName || ''`.
   - `upsertReceipt`: Resolve `client_name` as `rcpt.client?.name || rcpt.receivedFrom || rcpt.clientName || ''`.
3. **`[QC-HIGH-05]` Full Sequence & Settings Sync in `exportAllData`, `importAllData` & `pullFromSQLite` (`js/storage.js`)**:
   - Export/snapshot all custom per-biller sequence keys (`ai_seq_*`) in `sequences: {}` inside `exportAllData()` and `getFullDataSnapshot()`.
   - In `importAllData(data)`, support both top-level fields and `data.settings` (parsing JSON strings from SQLite `settings_kv`) and merge `data.sequences` via `_mergeMaxSequence`.
4. **Harden `server.js` Directory Listing HTML Escaping**:
   - Escape `reqPath` and `f` in `server.js` directory index HTML.

---

## 🧮 Phase 2: Financial Math, Multi-Biller Isolation, Accounting & Ponytail Deduplication
**Files Modified:** [js/utils.js](file:///e:/AutoInvoice/js/utils.js), [js/storage.js](file:///e:/AutoInvoice/js/storage.js), [js/expenses.js](file:///e:/AutoInvoice/js/expenses.js), [js/statement.js](file:///e:/AutoInvoice/js/statement.js), [statement.html](file:///e:/AutoInvoice/statement.html), [js/receipt.js](file:///e:/AutoInvoice/js/receipt.js), [js/biller.js](file:///e:/AutoInvoice/js/biller.js), [js/dashboard.js](file:///e:/AutoInvoice/js/dashboard.js), [index.html](file:///e:/AutoInvoice/index.html)

### Tasks
1. **Shared Formula-Safe `downloadCSV` & PDF Filename Print Hook (`js/utils.js`)**:
   - Add `downloadCSV(filename, rows)` in `js/utils.js` with UTF-8 BOM (`\uFEFF`), `Blob` download (preventing `#` truncation), and `/^[=+\-@]/` formula-injection escaping.
   - Add `setPrintDocumentTitle(docNumber, clientName)` helper in `js/utils.js` that sets `document.title = "<DocNo>_<ClientSlug>"` before print and restores it on `afterprint`.
   - Update `setCompanyHeader()` in `js/utils.js` to display Biller `taxId` (`BIN/TIN: ...`) in `#companyContacts` when configured on the Biller profile.
   - Deduplicate `downloadCSV`, `escapeHTML`, `escapeAttr`, `roundBDT`, `formatBDT`, and `formatDisplayDate` across `js/statement.js`, `js/search.js`, `js/expenses.js`, `js/receipt.js`, and `js/biller.js`.
2. **`[QC-HIGH-01]` & `[QC-HIGH-02]` Fix Period Cash Inflow & Adjustment Reconciliation (`js/expenses.js`, `js/statement.js`, `js/search.js`)**:
   - In `js/expenses.js` (`renderFinancialKPIs`), compute `totalCollected` directly from period-filtered `rcpts` so it reconciles 100% with `renderMonthlyPnl()`.
   - In `js/expenses.js` (`renderMonthlyPnl`) and `js/search.js` (`buildRevenueBreakdown`), use `getInvoicePaymentStats(inv).total` (excluding `Void` invoices) so adjusted invoice totals match across all views.
   - In `js/statement.js`, record the original `inv.grandTotal` on the Invoice date and credit `rc.amount + (rc.adjustment?.applied ? Number(rc.adjustment.amount || 0) : 0)` on the Receipt settlement date so prior-period Opening Balances are never retroactively mutated.
3. **`[QC-MED-01]` Fix Partial Payment Pre-Fill in `receipt.html` (`js/receipt.js`)**:
   - In `applyInvoiceData(inv)`, pre-fill `amountReceivedEl` with `stats.due` (remaining balance) instead of `inv.grandTotal`.
4. **`[QC-MED-02]`, `[QC-MED-03]`, `[QC-MED-04]` & `[QC-HIGH-04]` Multi-Biller Completeness**:
   - Add `#billerFilter` `<select>` to `statement.html` and filter `allInvoices` / `allReceipts` by `billerId` in `js/statement.js`.
   - Add `prefixExpense` input to `js/biller.js` modal so custom expense prefixes are preserved on save.
   - Add Biller Scope selector (`#dashboardBillerFilter`: Consolidated vs Active Biller) and `billerchange` / `storagesync` listeners in `index.html` and `js/dashboard.js`.
   - Fix `billerchange` edit-mode detection (`params.get('no')`) in `js/invoice.js`, `js/challan.js`, `js/quotation.js`, and `js/receipt.js`.

---

## 🎨 Phase 3: UI/UX Polish & Print CSS (`@media print`) Hardening
**Files Modified:** [css/print.css](file:///e:/AutoInvoice/css/print.css), [css/styles.css](file:///e:/AutoInvoice/css/styles.css), [search.html](file:///e:/AutoInvoice/search.html), [challan.html](file:///e:/AutoInvoice/challan.html), [quotation.html](file:///e:/AutoInvoice/quotation.html), [expenses.html](file:///e:/AutoInvoice/expenses.html)

### Tasks
1. **`[UI-01]` Fix `search.html` Outstanding Receivables Table Header (`search.html`, `js/search.js`)**:
   - Add `<th>Biller</th>` and `<th class="text-end no-print">Action</th>` to `#outstandingBody`'s table in `search.html` so all columns align cleanly.
2. **`[UI-02]` Fix `.challan-table` 5-Column Screen & 4-Column Print Layout (`css/styles.css`, `css/print.css`, `js/challan.js`)**:
   - Define `--w-item`, `--w-desc`, `--w-qty`, `--w-unit`, `--w-action` across all 5 columns in `css/styles.css` and `js/challan.js`.
3. **`[UI-03]` & `[UI-06]` Fix Multi-Page Print Clipping & Remove Stray `@media print` (`css/print.css`, `css/styles.css`)**:
   - Remove `page-break-inside: avoid !important; break-inside: avoid !important;` from generic `.print-area, #printArea` in `css/print.css` (keeping it on `body.receipt-page #printArea` and inner header/meta/row/summary/signature blocks) so multi-page Statements, Quotations, and Invoices paginate cleanly without clipping.
   - Remove the conflicting `@media print` block from `css/styles.css:L551-L557`.
4. **`[UI-04]` & `[UI-05]` Upgrade Print Formatting on `challan.html`, `quotation.html` & `expenses.html`**:
   - Change `#deliveryAddress` in `challan.html` to wrap cleanly in print and add `.print-only` display spans where needed so long delivery addresses never clip horizontally.
   - Hide empty optional recipient fields (`Title`, `Company`) during print on `quotation.html`.
   - Add a `.print-only` Company/Biller Letterhead block (`#headerTop`) to `expenses.html` so `🖨️ Print Ledger` produces an official branded ledger report.

---

## 🚀 Phase 4: Bangladeshi Commercial Features & 5-Gate QC Verification
**Files Modified:** [invoice.html](file:///e:/AutoInvoice/invoice.html), [js/invoice.js](file:///e:/AutoInvoice/js/invoice.js), [challan.html](file:///e:/AutoInvoice/challan.html), [js/challan.js](file:///e:/AutoInvoice/js/challan.js), [quotation.html](file:///e:/AutoInvoice/quotation.html), [js/quotation.js](file:///e:/AutoInvoice/js/quotation.js), [js/search.js](file:///e:/AutoInvoice/js/search.js), [js/storage.js](file:///e:/AutoInvoice/js/storage.js), [tests/cli_test_runner.js](file:///e:/AutoInvoice/tests/cli_test_runner.js), [tests/sqlite_db.test.js](file:///e:/AutoInvoice/tests/sqlite_db.test.js)

### Tasks
1. **Feature 1 — Invoice Discount (৳), VAT % (Mushak-6.3 Ready) & BIN/TIN Support (`invoice.html`, `js/invoice.js`)**:
   - Add compact `Discount (৳)` and `VAT (%)` rows to `.summary-table` in `invoice.html` (auto-hidden in print via `.no-print` when `0`, shown in print when `> 0`).
   - Compute `subtotal`, `discount`, `vatRate`, `vatAmount = roundBDT((subtotal - discount) * (vatRate / 100))`, and `grandTotal = roundBDT(subtotal - discount + vatAmount)`. Persist fields in `InvoiceRecord` with full backward compatibility.
2. **Feature 2 — Complete 1-Click Document Pipeline (`Invoice → Challan`, `Quotation ↔ Invoice` Back-Link, Catalog Price Lookup)**:
   - Add `📦 Create Challan` button in `invoice.html` (`challan.html?inv=<invoiceNumber>`) and handle `params.inv` in `js/challan.js`.
   - When saving an invoice opened from `?qtn=QTN-...`, update the source quotation's `converted = true` and `convertedToInvoice = record.invoiceNumber`.
   - When loading `invoice.html?ch=CH-...`, auto-lookup `getItemByName(it.name)?.unitPrice || 0` and `unit`.
3. **Feature 3 & 5 — `Void / Cancel`, `Delete` & Overdue Reminder Controls in `search.html` (`js/search.js`, `js/storage.js`)**:
   - Add `deleteRecordByType(type, number)` and `toggleVoidRecord(type, number)` in `js/storage.js` (when an invoice is `status: 'Void'`, `getInvoicePaymentStats` returns `{ total: 0, paid: 0, due: 0, status: 'Void', isOverdue: false }`).
   - Add `🚫 Void / Restore` and `🗑️ Delete` actions in `search.html` results dropdown, plus `🧾 Pay` and `💬 Remind` quick actions in the `Outstanding Receivables` table.
4. **Feature 4 & 6 — Deterministic PDF Print Filenames & Unit of Measure (`Unit`) Support**:
   - Wire `setPrintDocumentTitle()` across `invoice.js`, `challan.js`, `quotation.js`, `receipt.js`, `statement.js`, and `expenses.js`.
   - Support item `unit` (`Pcs`, `Sets`, `Hours`, `Lot`, `Kg`) in `invoice.js` and `quotation.js` line items.
5. **Automated Test Expansion & 5-Gate Reality Checker Certification**:
   - Add unit tests in `js/tests/` and `tests/sqlite_db.test.js` covering SQLite item/category sync, empty-storage protection, invoice discount/VAT math, void/delete lifecycle, `Invoice → Challan` conversion, and period P&L cash inflow.
   - Run `python -m graphify update .`, `node tests/html_audit.js`, `node tests/cli_test_runner.js`, and `node tests/sqlite_db.test.js`.
