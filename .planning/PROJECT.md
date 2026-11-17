# AutoInvoice — Bangladeshi Commercial Document Suite

## What This Is
AutoInvoice is a zero-dependency, offline-first commercial document and financial management suite tailored for Bangladeshi businesses. It manages Quotations (`QTN`), Commercial Invoices (`INV`), Delivery Challans (`CH`), Money Receipts (`RCPT`), Client Account Statements (`statement.html`), Expense Tracking & Monthly P&L (`expenses.html`), and Search/Aging Reports (`search.html`).

## Core Value
Deliver deterministic Bangladeshi commercial accounting (`roundBDT`, Lakh/Crore `formatBDT`, `numberToWordsBDT`), non-gapping monotonic document sequences (`peekNext*`/`finalize*`), print-calibrated A4 documents (`css/print.css` with `20mm x 20mm` QR quiet zones), and dual-layer persistence (`localStorage` + native Node `node:sqlite`).

## Requirements
- **REQ-01**: Commercial Document Lifecycle (Quotation -> Invoice / Challan -> Receipt with `V=1` QR payloads)
- **REQ-02**: Financial Precision & Monotonic Sequencing (`roundBDT`, `formatBDT`, `peekNext*`/`finalize*`, multi-biller isolation)
- **REQ-03**: Receivables Aging, Client Statements, Expense Tracker & Monthly P&L
- **REQ-04**: Dual-Layer Persistence (`localStorage` + SQLite WAL in `db.js`) & Backup/Restore Integrity
- **REQ-05**: Continuous Quality Control & Automated Verification (`tests/html_audit.js`, `tests/cli_test_runner.js`, `tests/sqlite_db.test.js`, `tests/tests.html`)

## Core Architecture
- **Frontend**: Vanilla ES6+ JavaScript, HTML5, CSS3 (`css/styles.css`, `css/print.css`), locally vendored Bootstrap 5 and QRCode.js.
- **Persistence**: Primary client-side `localStorage` (`js/storage.js`) synchronized with a zero-dependency Node.js + native `node:sqlite` WAL backend (`server.js`, `db.js`).
- **Knowledge Graph**: Graphify AST/semantic graph in `graphify-out/`.
- **Development Discipline**: Ponytail Minimalism Protocol + Agency Specialist Agents + GSD Planning.
