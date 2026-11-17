---
name: qc
description: Run full Quality Control (QC), security, financial math, accessibility, and Reality Checker certification on AutoInvoice
---

# Workflow: AutoInvoice Quality Control (`/qc`)

Run this end-to-end Quality Control pipeline (`autoinvoice-qc-auditor`, `autoinvoice-test-engineer`, and `autoinvoice-reality-checker`) to certify any change or release:

## Gate 1: HTML, Asset & Accessibility Audit (`WCAG 2.1 AA`)
```bash
node tests/html_audit.js
```
- **Pass Criteria**: 0 duplicate IDs, 0 missing asset/script references, and 0 unlabelled interactive inputs across all 8 HTML documents (`index.html`, `invoice.html`, `challan.html`, `quotation.html`, `receipt.html`, `statement.html`, `search.html`, `expenses.html`).

## Gate 2: CLI Unit & Integration Test Suite
```bash
node tests/cli_test_runner.js
```
- **Pass Criteria**: 100% pass rate across all suites (`utils`, `storage`, `qr`, `invoice`, `challan`, `quotation`, `receipt`, `biller`, `reports`, `statement`, `expense`).

## Gate 3: SQLite & REST API Persistence Suite
```bash
node tests/sqlite_db.test.js
```
- **Pass Criteria**: 100% pass rate across SQLite WAL initialization, CRUD operations, and backup/restore sync.

## Gate 4: Security, Financial Math & Print Layout Audit
- **Financial Math (`agency-finance-tracker`)**: No raw unrounded float additions; `roundBDT()` used on all line totals, aging buckets, statements, and P&L calculations.
- **Security (`agency-application-security-engineer`)**: `escapeHTML()` on all DOM templates; CSV formula injection guard (`/^[=+\-@]/`) on all CSV exports; `path.relative()` traversal guard in `server.js`.
- **Print Geometry (`agency-ui-finish-gate-reviewer`)**: `css/print.css` rules scoped to `@media print`; A4 page layout and `20mm x 20mm` QR quiet zones intact.

## Gate 5: Reality Checker Certification (`agency-reality-checker`)
- Default verdict is **`NEEDS WORK`** until Gates 1–4 pass with empirical command output and `python -m graphify update .` is current.
