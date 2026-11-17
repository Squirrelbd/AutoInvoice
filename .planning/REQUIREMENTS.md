# AutoInvoice Requirements

## Core Requirements

### REQ-01: Commercial Document Lifecycle
- **Status**: Complete
- **Description**: Create, edit, convert, print, and share Quotations, Commercial Invoices, Delivery Challans, and Money Receipts with standardized `V=1` QR payloads.

### REQ-02: Financial Precision & Monotonic Sequencing
- **Status**: Complete
- **Description**: Enforce 2-decimal Paisa rounding (`roundBDT`), Lakh/Crore formatting (`formatBDT`), Taka/Paisa words (`numberToWordsBDT`), and non-gapping `peekNext*`/`finalize*` sequences across multi-biller profiles.

### REQ-03: Receivables, Statements, Expenses & P&L
- **Status**: Complete
- **Description**: Provide Accounts Receivable aging reports, Client Statements of Account (`statement.html`), Expense tracking & Monthly P&L (`expenses.html`), and CSV formula-injection-safe exports.

### REQ-04: Dual-Layer Persistence & Backup Integrity
- **Status**: Complete
- **Description**: Persist records in `localStorage` and SQLite (`db.js`) with JSON archive export/import that preserves sequence high-water marks.

### REQ-05: Continuous Quality Control & Verification
- **Status**: Active
- **Description**: Maintain 100% pass rates across `tests/html_audit.js`, `tests/cli_test_runner.js`, `tests/sqlite_db.test.js`, and `tests/tests.html` with WCAG 2.1 AA compliance and A4 print geometry preservation.
