# 🏛️ AutoInvoice v2.5.0 — Data-Driven QA/QC, UI/UX, PDF Output & Feature Audit Report

**Audit Date:** November 17, 2026  
**Audited Target:** AutoInvoice (`e:\AutoInvoice`, post-v2.5.0)  
**Executed By:** Specialist Subagents (`autoinvoice-qc-auditor`, `autoinvoice-architect`, `autoinvoice-doc-finance`, `autoinvoice-test-engineer`, `autoinvoice-reality-checker`) + Graphify Knowledge Graph (`1,803 nodes`, `2,696 edges`) + Ponytail Minimalism Audit + Chrome CDP Visual/PDF Verification  

---

## 🚦 1. Executive Summary & Automated Test Baseline

| Verification Gate | Command / Method | Result | Critical Caveat |
| :--- | :--- | :---: | :--- |
| **Gate 1: HTML & WCAG Static Audit** | `node tests/html_audit.js` | ⚠️ **PASS (False Green)** | Always exits `0`; ignores dynamic modals, dark-mode contrast, and inline `@media print` styles |
| **Gate 2: CLI Unit & Integration** | `node tests/cli_test_runner.js` | ✅ **58 / 58 (100%)** | Uses mocked DOM; zero coverage of page controllers (`invoice.js`, `statement.js`, `expenses.js`, `search.js`) |
| **Gate 3: Live Browser Unit Suite** | `tests/tests.html` (Chrome CDP) | ⚠️ **PASS (Destructive)** | 0 console errors, **but** `clearAllData()` triggers `POST /api/clear` and **wipes live `records/autoinvoice.db`** |
| **Gate 4: SQLite WAL Persistence** | `node tests/sqlite_db.test.js` | ⚠️ **7 / 7 PASS (Non-Hermetic)** | Mutates live `records/autoinvoice.db` instead of an isolated temp DB |
| **Gate 5: Live Chrome PDF & UI Inspection** | Chrome CDP (`10` PDFs + `16` Desktop/Mobile captures) | ❌ **HOLD (`NEEDS WORK`)** | Visual inspection confirmed severe PDF text clipping, Dark-Mode-to-PDF ink/contrast failure, collapsed `col-md-*` grids, overlapping report headers, and persistence/security blockers |

> **Reality Checker Certification Verdict:** **`NEEDS WORK` (`HOLD`, Grade: C+)** — Resolve Blockers `[SEC-BLK-01..04]`, `[DATA-CRIT-01..04]`, `[FIN-BLK-01..03]`, and `[PDF-CRIT-01..04]` before shipping.

---

## 📄 2. PDF Generation Options & Generated PDF Visual Inspection

### Print & PDF Trigger Audit
- **Document Pages (`invoice.html`, `challan.html`, `quotation.html`, `receipt.html`)**: Trigger `window.print()` via `#printBtn` + `beforeprint`; `invoice.js` and `challan.js` invoke `prepareForPrint()` twice on button click; `quotation.js` `#prfBtn` (`Generate PRF Form`) uses a hardcoded `1000ms` `setTimeout` that removes `body.prf-mode` while browser print preview is still open.
- **Reports (`statement.html`, `expenses.html`, `search.html`)**: `statement.js` and `expenses.js` call `setPrintDocumentTitle` only on button click (missing `beforeprint` hook for `Ctrl+P`); `search.html` row `.printBtn` opens the document tab without auto-printing (`?autoprint=1` missing); `Ctrl+P` on `search.html` prints search controls and empty `Actions` columns.

### Empirical Defects Verified in Generated A4 PDFs (Chrome `Page.printToPDF`)
1. **`[PDF-CRIT-01]` Dark Mode Print Blackout (`02_invoice_multipage_dark.pdf`)**: Unreset `--bs-*-rgb` variables and higher specificity `html[data-bs-theme="dark"] .table-light th` (`css/styles.css:L395`) vs `table.table thead th` (`css/print.css:L280`) print dark margins/headers and near-white textarea text on white cells.
2. **`[PDF-CRIT-02]` `<textarea>` Clipping & Scrollbar Arrows (`01_invoice`, `03_challan`, `04_quotation`)**: `css/print.css:L260` (`height: auto !important`) overrides `prepareForPrint()` pixel heights in Chromium print, rendering scrollbar arrows and clipping descriptions, `#deliveryAddress`, `#scopeText`, and `#termsText`.
3. **`[PDF-CRIT-03]` Collapsed `.col-md-*` Two-Column Print Grids**: A4 printable width (`178mm ≈ 672.8px < 768px`) collapses Bootstrap `.col-md-*` grids in `invoice.html`, `receipt.html`, `challan.html`, `quotation.html` (`Scope`/`Terms`/`Sign` & PRF), and `statement.html`, pushing 2-item invoices and small statements onto 2 pages.
4. **`[PDF-CRIT-04]` Overlapping Headers in `Expenses` & `Statement` PDFs (`07`, `08`, `09`, `10`)**: Global `table-layout: fixed !important` (`css/print.css:L271`) + `white-space: nowrap !important` (`css/styles.css:L494`) causes header text collisions on `expenses.html` (Register & Monthly P&L), `statement.html` (`Debit +৳` wrapping), and `invoice.html` (`UNIT PRICE (৳)` clipping). On `expenses.html`, `#headerTop` sits inside `#tab-register`, vanishing when printing Category Breakdown or Monthly P&L tabs.
5. **`[PDF-HIGH-05]` Receipt QR Box Overflow & Challan Label Bug**: `#receiptQR` (`20mm`) overflows `#receiptQRBlock` (`20mm` + `2mm` padding); `utils.js` `setCompanyHeader()` overwrites Receipt signature labels with `"Delivered by"` / `"Received by"`.

### Recommended PDF Architecture
- **Tier 1 (Mandatory):** Fix `@media print` CSS (`css/print.css`), add `.print-only` wrapping text spans instead of printing raw `<input>`/`<textarea>` controls, isolate `.invoice-table`/`.challan-table`/`.quotation-table` fixed layouts from generic report tables, and add `?autoprint=1`.
- **Tier 2 (Optional Zero-NPM Desktop Enhancement):** Probe host Chrome/Edge at server startup and expose `POST /api/pdf` (`--headless --print-to-pdf --no-pdf-header-footer`) for true 1-click `.pdf` file downloads without browser URL headers/footers, falling back seamlessly to Tier-1 `window.print()`.

---

## 🔴 3. Critical & High-Severity Data-Driven QA/QC Defects

- **`[SEC-BLK-01]` Unauthenticated Destructive APIs & CORS `*` ([server.js](file:///e:/AutoInvoice/server.js))**: Binds `0.0.0.0` with `Access-Control-Allow-Origin: *`, exposes raw `records/autoinvoice.db`, and allows unauthenticated cross-origin `POST /api/clear` & `/api/reset`.
- **`[SEC-BLK-02]` Null-Byte Server Crash ([server.js:L54,L337](file:///e:/AutoInvoice/server.js#L337))**: `GET /index.html%00.txt` throws uncaught `ERR_INVALID_ARG_VALUE` in `fs.stat` and crashes Node.
- **`[SEC-BLK-03]` `readJsonBody` UTF-8 Chunk Corruption & Error Crash ([server.js:L27-49](file:///e:/AutoInvoice/server.js#L27-L49))**: String concatenation corrupts split `৳` characters; callers skip `if (err) return;`.
- **`[SEC-BLK-04]` Incomplete CSV Formula Guard ([js/utils.js:L438](file:///e:/AutoInvoice/js/utils.js#L438))**: `/^[=+\-@]/` misses leading `\t`, `\r`, `\n`, or whitespace before formula triggers.
- **`[DATA-CRIT-01]` Last-Record Delete Resurrects From SQLite ([db.js:L496-516](file:///e:/AutoInvoice/db.js#L496-L516), [js/storage.js:L1295,L1433](file:///e:/AutoInvoice/js/storage.js#L1295))**: `canPruneEmpty` is `false` when `totalIncoming === 0`, leaving deleted items in SQLite which auto-hydrate back on reload.
- **`[DATA-CRIT-02]` Deleted Billers & `/api/clear` Resurrect Billers ([server.js:L217,L292](file:///e:/AutoInvoice/server.js#L217))**: `/api/billers` only upserts; `/api/clear` omits `billers` and `expense_categories`.
- **`[DATA-CRIT-03]` `tests/tests.html` Wipes Live SQLite ([js/storage.js:L282](file:///e:/AutoInvoice/js/storage.js#L282))**: `clearAllData()` calls `/api/clear` without checking `window.__IS_AUTOINVOICE_TESTING__`.
- **`[DATA-BLK-04]` Saving Docs Wipes Client Metadata & Catalog Prices ([js/storage.js:L1048,L1110](file:///e:/AutoInvoice/js/storage.js#L1048), [js/challan.js:L309](file:///e:/AutoInvoice/js/challan.js#L309), [js/quotation.js:L380](file:///e:/AutoInvoice/js/quotation.js#L380))**: Saving invoices/receipts/challans overwrites client `phone`/`email`/`company`/`title` to `""`; saving challans zeroes catalog `unitPrice`.
- **`[DATA-HIGH-05]` Ghost Rows & Local+Disk Duplicates in Search ([js/records.js:L69](file:///e:/AutoInvoice/js/records.js#L69), [js/search.js:L124](file:///e:/AutoInvoice/js/search.js#L124))**: `autoDiscoverSummaries()` parses `index.json` itself into blank ghost rows; `invLocal.concat(invDisk)` double-counts edited disk examples.
- **`[DB-WARN-06]` Bangla PK Collisions in SQLite ([db.js:L355,L374](file:///e:/AutoInvoice/db.js#L355))**: Stripping non-ASCII overwrites equal-length Bengali client/catalog names.
- **`[FIN-BLK-01]` Adjusted Receipt Re-Edit Zeros Write-Offs ([js/storage.js:L1250-1275](file:///e:/AutoInvoice/js/storage.js#L1250-L1275), [js/receipt.js:L550](file:///e:/AutoInvoice/js/receipt.js#L550))**: `getLatestAdjustmentForInvoice()` ignores `excludeReceiptNo`, corrupting write-off balances on re-save.
- **`[FIN-BLK-02]` Receipt Bypasses `Void` Invoices ([js/receipt.js:L516](file:///e:/AutoInvoice/js/receipt.js#L516))**: `!stats.total` treats `Void` (`0`) as unknown and accepts new payments.
- **`[FIN-BLK-03]` `search.js` Ledger & CSV `Void` Mismatches ([js/search.js:L247,L803](file:///e:/AutoInvoice/js/search.js#L803))**: Inline statement includes Void docs and splits adjustments differently from `statement.html`; CSV marks Void docs active.
- **`[FIN-HIGH-04]` `UTC+6` Off-by-One Date Shift ([js/expenses.js:L101-122](file:///e:/AutoInvoice/js/expenses.js#L101-L122))**: `.toISOString()` shifts local Dhaka midnight presets backward 1 day.
- **`[FIN-HIGH-05]` Negative-Input Regex Flip & Missing Due Date on Conversion ([js/invoice.js:L379,L735](file:///e:/AutoInvoice/js/invoice.js#L735), [js/challan.js:L532](file:///e:/AutoInvoice/js/challan.js#L532))**.

---

## 🎨 4. UI/UX, Accessibility & New Feature Summary

- **UI/UX Fixes**: Fix mobile `390px` `#headerTop` overflow (`flex-wrap`), fix Dark Mode `#0b3969` `--brand-color` & `btn-outline-dark` contrast, remove dead `#itemList` `<datalist>`, sync `Reset` / `duplicateInvoiceBtn` completely, and add `aria-label`/`for` in dynamic modals (`js/biller.js`, `js/dashboard.js`).
- **Recommended Bangladeshi Commercial Features**:
  1. **Tier-1 Print Fix + Optional Tier-2 1-Click PDF Server Export (`POST /api/pdf`)**
  2. **Mushak-6.3 & B2B Tax Pack** (Client BIN/TIN, PO/Work Order Ref, Inclusive/Exclusive VAT, AIT/VDS Withholding Reasons)
  3. **Remittance Bank / MFS Details & Receipt `TrxID` / Cheque #**
  4. **Challan Logistics Fields (`linkedInvoice`, Vehicle, Driver, Cartons) + Wrapped Card Layout**
  5. **BD Fiscal Year (`Jul 1 – Jun 30`) Preset & Net-of-VAT P&L Toggle**
  6. **Invoice/Quotation Line `Unit` Column & Offline QR `V=1` Verifier Modal**
  7. **Hermetic Test Suite (`html_audit` exit code, isolated SQLite temp DB, live page controller tests)**
