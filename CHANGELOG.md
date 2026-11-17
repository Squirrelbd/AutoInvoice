# Changelog

All notable changes to the AutoInvoice platform are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [2.6.0] - 2026-11-17

### 🛡️ Security, Persistence & Test Isolation
- **Local Server & API Hardening (`server.js`, `db.js`)**: Defaulted bind host to `127.0.0.1` (`0.0.0.0` via `HOST` for Docker), replaced wildcard CORS `*` with local/same-host Origin checks, added null-byte path rejection, blocked sensitive repository files (`.db*`, `server.js`, `db.js`, dotfiles, `graphify-out/`), restricted directory listings to `/records/invoices` and `/records/challans`, enforced `application/json` on `POST` (`415`) and `405` on unsupported `/api/*` methods, fixed UTF-8 `Buffer` chunk handling in `readJsonBody()`, and required `X-AutoInvoice-Action: confirm` on `/api/clear` and `/api/reset`.
- **SQLite & Storage Integrity (`db.js`, `js/storage.js`)**: Added `AUTOINVOICE_DB_PATH` override for test isolation, Unicode/Bangla-safe `_slugKey()` primary keys, `db.replaceBillers()`, `db.clearAllTables()`, `loadBillers()` remittance preservation, zero zombie re-seeding on deleted catalog items/clients (`ai_clients_seeded` / `ai_items_seeded`), explicit empty-snapshot prune signaling (`_forceNextSyncPrune`), and whitespace/control-char CSV formula sanitization (`sanitizeCsvCell`).

### 🖨️ Dual-Tier A4 PDF Generation & Print Perfection
- **Tier 1 `@media print` & `?autoprint=1` (`css/print.css`, `css/styles.css`)**: Eliminated dark-mode variable/card/table inheritance in print, added `.print-only` wrapping text mirrors on Invoice/Challan/Quotation to prevent `<textarea>` clipping, locked `#headerTop` to a clean single-row side-by-side header, preserved A4 multi-column grids (`178mm`), maintained `20mm × 20mm` QR codes with quiet zones, hid Search `Actions` column in print, and refined Dark Mode (`--brand-ink`) + mobile (`<= 576px`) layouts.
- **Tier 2 One-Click A4 PDF API (`server.js`, `js/utils.js`)**: Added `GET /api/pdf/status` and `POST /api/pdf` (headless Edge/Chrome `--print-to-pdf`) wired to `#downloadPdfBtn` ("Save A4 PDF") across printable pages with automatic `window.print()` fallback when offline or headless browser is unavailable.

### 💰 Financial Accuracy & Date Normalization
- **Local Date Safety (`js/utils.js`)**: Added `parseLocalISODate`, `toLocalISODate`, and `addWorkingDaysLocal` across all modules to eliminate UTC timezone day-shift bugs.
- **Reconciliation & Ledger Parity (`js/storage.js`, `js/receipt.js`, `js/statement.js`, `js/expenses.js`, `js/search.js`)**: Unified statement computation via `computeClientStatementData()`, excluded the currently edited receipt in `getLatestAdjustmentForInvoice(invNo, excludeReceiptNo)`, blocked negative amounts and `Void` invoices in receipts, excluded `Void` records from KPI counts, and separated period expenses from category-filtered subsets in `expenses.js`.

### 🚀 Bangladeshi Commercial Features & Workflows
- **B2B Tax & Compliance Pack (`invoice.html`, `receipt.html`, `js/invoice.js`, `js/receipt.js`, `js/dashboard.js`)**: Added client `BIN/TIN` across client onboarding/CRUD and documents, Invoice `PO / Work Order #`, `%` or `৳` discount toggle, `+VAT` Exclusive vs `Incl.` VAT Inclusive mode, and Receipt AIT/VDS withholding reason selector.
- **Remittance & MFS Rails (`js/biller.js`, `js/utils.js`, `invoice.html`, `quotation.html`, `statement.html`)**: Added Biller Bank & MFS (bKash/Nagad/Rocket) remittance settings and formatted remittance blocks on Invoices, Quotations, and Statements, plus `bKash`/`Nagad`/`Rocket`/`Card / POS` and `Trx / Cheque Ref` (`#trxRef`) fields on Invoices & Receipts.
- **Challan Logistics, Units & BD Fiscal Year (`challan.html`, `quotation.html`, `statement.html`, `expenses.html`, `search.html`)**: Added Consignee & Logistics tracking (`linkedInvoice`, `vehicleNo`, `driverInfo`, `packageCount`) with bidirectional `Invoice ↔ Challan` links, `Unit` column on Invoices & Quotations, Bangladeshi Fiscal Year (`Jul 1 – Jun 30`) presets on Statements & Expenses, Net-of-VAT P&L toggle on Expenses, and Offline `V=1` QR Payload Verifier modal on Search & Reports.

---

## [2.5.0] - 2026-11-17

### 🛡️ Data Integrity, SQLite Sync & Security Hardening (Phase 1)
- **Empty-Browser SQLite Wipe Guard (`js/storage.js`, `db.js`)**: Replaced unconditional `window.load` SQLite push with an intelligent emptiness check and `pullFromSQLite()` auto-hydration when `localStorage` is empty; hardened `db.syncClientSnapshot()` so empty payloads cannot prune populated SQLite tables unless `forcePruneEmpty: true`.
- **SQLite Client-Schema Normalization (`db.js`)**: Aligned `upsertItem` (`.name`, `.desc`, `.unitPrice`), `upsertExpenseCategory` (string & object categories), `upsertQuotation` (`to.name`), and `upsertReceipt` (`client.name`) with client `localStorage` schemas.
- **Per-Biller Sequence Persistence (`js/storage.js`)**: Added `_collectAllSequenceKeys()` to export, import, and SQLite-sync all `ai_seq_<billerId>_<type>` and legacy sequence counters.
- **Directory Listing XSS Sanitization (`server.js`)**: Escaped `reqPath` and filenames in static server HTML directory listings.

### 💰 Financial Accuracy & Multi-Biller Accounting (Phase 2)
- **Period Cash Inflow & P&L Accuracy (`js/expenses.js`)**: Fixed `renderFinancialKPIs` to sum period-filtered receipts directly instead of lifetime invoice payments; updated `renderMonthlyPnl` to use `getInvoicePaymentStats(inv).total` and exclude `Void` records.
- **Chronological Statement Settlement Credits (`js/statement.js`, `statement.html`)**: Added `#billerFilter` entity scope selector and recorded invoice settlement adjustments as a distinct `[Adjustment]` credit entry on the receipt settlement date, preserving historical prior-period invoice debits.
- **Formula-Safe Shared CSV Exporter (`js/utils.js`)**: Centralized `downloadCSV(filename, rows)` with UTF-8 BOM, `Blob` URL generation, and formula-injection protection across `statement.js`, `search.js`, `expenses.js`, and `receipt.js`.
- **Remaining Due Pre-fill (`js/receipt.js`)**: Updated `applyInvoiceData()` to pre-fill `amountReceived` with remaining `stats.due` on partially paid invoices.
- **Dashboard Entity Scope & Custom Expense Prefix (`index.html`, `js/dashboard.js`, `js/biller.js`)**: Added `#dashboardBillerFilter` ("All Entities" vs active biller) and `#prefixExpense` configuration in the Biller Modal.

### 🖨️ Print Fidelity & UI/UX Polish (Phase 3)
- **Multi-Page A4 Print Flow (`css/print.css`, `css/styles.css`)**: Removed `page-break-inside: avoid` from `.print-area, #printArea` so multi-page Invoices, Statements, Search reports, and Expense ledgers paginate cleanly without clipping; consolidated stray `@media print` rules into `css/print.css`.
- **BIN / TIN Header & Print Document Filenames (`js/utils.js`, `expenses.html`)**: Displayed biller `taxId` (`BIN/TIN`) in printed company headers, added `.print-only` `#headerTop` to `expenses.html`, and added `setPrintDocumentTitle(docNo, clientName)` for descriptive PDF save filenames across all 6 printable pages.
- **Challan Multi-line Address & 5-Column Widths (`challan.html`, `js/challan.js`, `css/styles.css`)**: Upgraded `#deliveryAddress` to an auto-growing `<textarea>` and aligned `.challan-table` 5-column CSS width variables.
- **Quotation Blank-Field Print Suppression (`js/quotation.js`)**: Automatically hides blank optional `#toTitle` and `#toCompany` rows during `@media print`.
- **Edit-Mode Biller Guard**: Prevented `billerchange` events from overwriting document numbers when editing saved records (`?no=`).

### 🚀 Bangladeshi Commercial Features (Phase 4)
- **Invoice Discount (BDT) & VAT / Tax % (`invoice.html`, `js/invoice.js`)**: Added optional Discount (`৳`) and VAT (`%`) summary rows with `roundBDT()` precision, auto-hidden on print when `0`.
- **Bidirectional Document Conversion (`invoice.html`, `js/invoice.js`, `js/challan.js`)**: Added `📦 Create Challan` (`challan.html?inv=`) on saved invoices, Catalog price lookup when converting `Challan → Invoice` (`?ch=`), and automatic `convertedToInvoice` / `linkedChallan` cross-references.
- **Document Void / Cancel & Delete Controls (`js/storage.js`, `search.html`, `js/search.js`)**: Added `toggleVoidRecord()` and `deleteRecordByType()` with actions in Search & Reports.
- **Receivables Quick-Action Hub (`search.html`, `js/search.js`)**: Added one-click `🧾 Pay` (`receipt.html?inv=`) and `💬 Remind` (WhatsApp payment reminder) buttons in the Outstanding Receivables table.

---

## [2.3.0] - 2026-10-23

### 🏢 Multi-Biller Profiles & Dynamic Branding
- **Multi-Biller Architecture (`js/storage.js`, `js/constants.js`, `js/biller.js`)**: Full multi-company support with profile CRUD, persistent localStorage storage, and JSON backup/restore integration.
- **Navbar Active Entity Switcher (`js/biller.js`)**: Real-time dropdown switcher accessible on every page displaying the active company logo, name, color pill, and one-click access to add/manage billers.
- **Dynamic CSS Theming**: Switching billers dynamically updates CSS root variables (`--brand-color`, `--color-primary`, `--highlight-color`), navbar accents, and document headers without full page reload.
- **Isolated Monotonic Numbering Sequences**: Each biller maintains strictly isolated sequence counters and custom prefixes (e.g., `INV-` vs `NEX-`), preventing numbering overlap while preserving backwards compatibility for legacy documents.
- **Document Snapshot Binding**: Newly created invoices, challans, quotations, and receipts snapshot the active `billerId` and `company` metadata in localStorage and QR codes.

### 📊 Advanced Reports & Enhanced Downloads
- **Multi-Biller Filter in Search & Reports (`search.html`, `js/search.js`)**: Filter all documents, receivables, and aging reports by specific company or consolidated cross-company view.
- **Search Results CSV Exporter (`search.html`, `js/search.js`)**: One-click download of active search results containing type, document number, biller, date, client, amount, and payment status with CSV formula injection protection.
- **Client Statement of Account / Transaction Ledger (`search.html`, `js/search.js`)**: Chronological debit/credit account statement showing running balance across all client invoices and payment receipts, with dedicated statement CSV export.
- **Periodic Revenue Breakdown Table (`search.html`, `js/search.js`)**: Aggregates revenue, collection, and net due balances by Month or Quarter, displays collection recovery rate badges, and includes a periodic revenue CSV download.
- **Hermetic Test Suite Expansion (`js/tests/test-runner.js`, `js/tests/reports.test.js`)**: Hardened test runner with pristine per-test localStorage isolation; expanded automated test coverage to 44 suites (100% passing).

---

## [2.2.0] - 2026-10-23

### 🛡️ Security & Mathematical Precision
- **Exponential Rounding Precision (`js/utils.js`)**: Upgraded `roundBDT()` with exponential decimal rounding (`Number(Math.round(Number(num + 'e2')) + 'e-2')`) to eliminate IEEE-754 half-up truncation errors.
- **Signed BDT Currency Formatting (`js/utils.js`)**: Fixed `formatBDT()` to format negative currency as `-৳500.00` instead of `৳-500.00`.
- **CSV Formula Injection Sanitization (`js/receipt.js`)**: Hardened receipt CSV export against spreadsheet injection attacks by prefixing formula trigger characters (`=`, `+`, `-`, `@`) with a single quote.
- **Path Traversal Protection (`server.js`)**: Hardened static server path checks using `path.relative()` to prevent path traversal attacks, and added directory listing support for records auto-discovery.
- **Aging Receivables Precision (`js/search.js`)**: Wrapped invoice aging and outstanding calculations in `roundBDT()`.

### ♿ Accessibility & UI Consistency
- **WCAG 2.1 AA Compliance**: Added explicit labels and `aria-label` attributes across all form inputs in `invoice.html`, `challan.html`, `quotation.html`, and `receipt.html`.
- **Search Empty State Colspan Fix (`js/search.js`)**: Corrected empty message row to span all 7 table columns (`colspan="7"`).
- **Search Filter Execution Fix (`js/search.js`)**: Resolved bug where clicking the search button passed event objects into `runSearch`, causing search filters to be ignored.

### 🪚 Ponytail Minimalism & Codebase Pruning
- Removed orphaned `Quotation_template.html` (-13.5 KB), unused `assets/Modern, professional.svg` (-470 KB), and `assets/logo2.svg` (-523 B).
- Removed 11 Windows `desktop.ini` files and updated `.gitignore` with recursive patterns.
- Simplified `notify()` helper in `js/dashboard.js`.
- Verified all 35 browser-based unit tests passing at 100% in `tests/tests.html`.

---

## [2.1.0] - 2026-10-08

### 🚀 Added
- **Client Address Book Full CRUD Modal (`index.html`)**: Added dedicated modal dialog to manage all client contacts directly from the dashboard:
  - Live client filtering and search by client name, company, or address.
  - In-place client creation, editing, and deletion.
  - Real-time client count badges and synchronization with storage.
- **Backup & Restore System (`index.html`, `js/storage.js`)**:
  - Added JSON backup file importer with schema validation.
  - Interactive restore confirmation modal summarizing counts of invoices, challans, quotations, receipts, and client records prior to importing.
  - High-water mark sequence preservation during restore.
- **Receivables & Aging CSV Exporters (`search.html`, `js/search.js`)**:
  - One-click CSV export for filtered **Outstanding Receivables** (`exportOutstandingCsvBtn`).
  - One-click CSV export for **Accounts Receivable Aging Analysis** (`exportAgingCsvBtn`).
- **Local Static Preview Server (`server.js`)**:
  - Zero-dependency Node.js HTTP server configured with correct MIME type dispatching and cache headers.
  - Built-in path traversal security protection blocking requests outside the project directory.
  - Formatted terminal launch outputs linking directly to all document pages.
- **Storage Quota Safeguard**: Proactive 80% usage monitoring that triggers a non-intrusive warning alert when localStorage approaches browser storage ceilings.
- **Comprehensive Technical Reference Documentation**: Added `DEVELOPER_GUIDE.md` detailing architecture, data models, lifecycle state transitions, URL protocols, and print CSS rules.

### 🔄 Changed
- Enhanced Dashboard Financial Intelligence section with responsive 4-card metric grid: Total Invoiced, Total Collected, Outstanding Dues, and Total Active Records breakdown.
- Synchronized client `<datalist>` elements across all forms immediately following modal edits.
- Improved invoice status detection to differentiate between `Paid`, `Partial`, `Unpaid`, and `Overdue` states based on working day due dates.

---

## [2.0.0] - 2026-10-08

### 🔴 Critical Fixes (Phase 1)
- **Auto-Receipt Removed**: Disabled unintentional auto-generation of money receipts upon saving an invoice. Replaced with dedicated "Create Receipt" action button.
- **Financial Precision**: Implemented `roundBDT()` and `_safeRound()` to guarantee 2-decimal arithmetic across all line item calculations, running totals, and payment stats, eliminating IEEE 754 floating-point drift.
- **Monotonic Non-Gapping Sequencing**: Added non-consuming `peekNextInvoiceNumber()`, `peekNextChallanNumber()`, `peekNextQuotationNumber()`, and `peekNextReceiptNumber()`. Numbers are previewed on load and strictly finalized upon save. Sequence counters no longer rewind when editing older documents.
- **XSS Protection**: Implemented `escapeHTML()` and sanitized all user-supplied template literal interpolations across invoices, challans, quotations, and search views.
- **Print CSS**: Scoped leaking print stylesheet rules strictly inside `@media print` in `css/print.css`.
- **HTML Validation**: Removed duplicate `#qrContainer` in `challan.html`.
- **Receipt Lifecycle**: Moved QA diagnostics code inside `DOMContentLoaded` and removed premature receipt finalization on browser `beforeprint`.

### 🟠 High Severity & Integrity (Phase 2)
- **Quotation Navigation**: Fixed Search page "Open Page" action to properly route quotations to `quotation.html?no=`.
- **Unsaved Changes Guard**: Added `beforeunload` warning listeners with `isDirty` state tracking across all document pages.
- **Silent Failure Elimination**: Replaced empty `catch {}` blocks across all scripts with structured `console.warn()` statements.
- **Race Condition Prevention**: Resolved draft vs. URL-parameter collisions in invoice and challan initialization.
- **Adjustment System Hardening**: Added user confirmation on "Zero Due by Adjustment", previous adjustment collision warnings, and visual audit trail notes on linked invoices.
- **Storage Quota & Full Backup**: Added proactive `checkStorageQuota()` monitoring with warning banner and `exportAllData()` one-click JSON backup on dashboard.
- **Save Before Navigate**: Implemented mandatory validation and save before navigating from quotation to invoice, challan, or receipt.
- **Input Sanitization**: Enforced 10,000 character limits, trimming, and type validation before persisting records to `localStorage`.

### 🟡 Architecture & Code Quality (Phase 3)
- **Unified QR Code Schema**: Standardized QR payloads to `DOC=<TYPE>|TXID=<number>|DT=<date>|AMT=<amount>|CCY=BDT|BEN=<company>|REC=<client>|V=1` across all document types.
- **QR Debouncing**: Added 300ms debounce to live input events to prevent UI lag on rapid keystrokes.
- **Modern Toast Notifications**: Built Bootstrap 5 Toast notification component (`showToast()`), replacing native blocking browser `alert()` popups.
- **BDT Words & Currency**: Fixed edge cases in `numberToWordsBDT()` (crores ≥ 100, negative amounts, paisa clamping) and updated `formatBDT()` to `en-IN` for authentic South Asian Lakh/Crore grouping.

### 🟢 UX, Navigation & Accessibility (Phase 4)
- **Unified Navbar**: Standardized navigation bar across all HTML pages with active link indication.
- **Mode Badge**: Added visual `📝 Editing [DocNo]` vs `✨ New [Doc]` status badge on all document pages.
- **Accessibility (WCAG AA)**: Added skip-to-content links, `aria-label` tags on all dynamically generated table rows, and `role="status"` / `aria-live="polite"` on due message and invoice linkage alerts.
- **Search Toggle**: Replaced one-way View button in Search with toggleable View/Hide row behavior.

### 🧪 Test Suite Expansion (Phase 5)
- Added browser-based unit test suites: `utils.test.js`, `storage.test.js`, `qr.test.js`, `invoice.test.js`, and iframe-isolated `receipt.test.js` runnable in `tests/tests.html`.

---

## [1.0.0] - 2025-06-25

### Initial Release
- Multi-page application structure for generating Invoices, Quotations, Challans, and Receipts.
- Basic localStorage persistence for documents and sequences.
- Initial printable layouts with dynamic line items and QR codes.
- Pre-seeded example JSON records for invoices and challans.
