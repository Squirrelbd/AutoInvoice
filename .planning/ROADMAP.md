# AutoInvoice Roadmap

## Milestone v2.4: Multi-Biller, Statements, Expenses, SQLite & Full QC Suite

### Phase 1: Core Financial & Security Hardening
- **Goal**: Harden `roundBDT` exponential precision, fix `window` constant exports, sanitize CSV exports, and enforce `server.js` path traversal boundaries.
- **Requirements**: REQ-01, REQ-02
- **Status**: Complete

### Phase 2: Multi-Biller Profiles & Advanced Reporting
- **Goal**: Add isolated multi-biller profiles, dynamic CSS branding, Client Statements of Account, and Periodic Revenue Breakdown exports.
- **Requirements**: REQ-02, REQ-03
- **Status**: Complete

### Phase 3: Expense Tracker, Monthly P&L & SQLite Backend
- **Goal**: Deliver `expenses.html` P&L tracking and `db.js` native SQLite WAL persistence with automated CLI and SQLite test suites.
- **Requirements**: REQ-03, REQ-04
- **Status**: Complete

### Phase 4: Continuous Quality Control, Planning & Implementation Automation
- **Goal**: Orchestrate Planning, Implementation, and QC workflows using Agency Specialists, Ponytail Minimalism, Graphify, and automated test gates.
- **Requirements**: REQ-05
- **Status**: In Progress
