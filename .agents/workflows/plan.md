---
name: plan
description: Plan a feature, bug fix, or milestone for AutoInvoice using Graphify, Ponytail, and Agency Planning Specialists
---

# Workflow: AutoInvoice Planning (`/plan`)

Follow this pipeline before implementing any non-trivial feature, bug fix, or architectural change in AutoInvoice:

## 1. Graphify Knowledge Graph Discovery
Query `graphify-out/` first to map call graphs and dependencies before reading raw files:
```bash
python -m graphify query "<feature or bug question>"
python -m graphify explain "<target symbol or module>"
```

## 2. Ponytail Minimalism Gate
Apply the **Simplicity Ladder** (`ponytail` skill):
1. **YAGNI**: Does this need to exist at all? Skip speculative features and unrequested configurability.
2. **Reuse**: Check `js/utils.js` (`roundBDT`, `formatBDT`, `numberToWordsBDT`, `escapeHTML`, `buildQRPayload`, `showToast`), `js/storage.js`, `js/constants.js`, and `db.js`.
3. **Native First**: Use vanilla ES6+, standard CSS, `<input type="date">`, `Intl.NumberFormat`, `localStorage`, and local SQLite (`node:sqlite`).
4. **Shortest Working Diff**: Plan the smallest change that solves the root cause.

## 3. Guardrail & Impact Check
Every plan must explicitly address:
- **Financial Precision**: All monetary calculations and accumulations wrapped in `roundBDT()`.
- **Monotonic Numbering**: Non-gapping `peekNext<Type>Number()` on load and `finalize<Type>Number()` on save.
- **Multi-Biller Isolation**: Respect active `billerId` scoping and custom numbering prefixes.
- **Print Layout Preservation**: Verify `@media print` in `css/print.css` and `20mm x 20mm` QR code quiet zones.
- **Test Coverage**: Identify which test file in `js/tests/*.test.js` or `tests/sqlite_db.test.js` will verify the change.

## 4. Phased Task Breakdown
Invoke `autoinvoice-planner` (or `agency-senior-project-manager` + `agency-ux-architect`) to output an atomic, phased task checklist with clear acceptance criteria.
