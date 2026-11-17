# AutoInvoice Test Suite

Automated in-browser unit tests for the AutoInvoice platform.

---

## 🚀 How to Run Tests

### In Any Browser
1. Start the local server:
   ```bash
   node server.js
   ```
2. Navigate to:
   [http://localhost:8080/tests/tests.html](http://localhost:8080/tests/tests.html)
3. The test runner will automatically execute all test suites and display real-time pass/fail status with diagnostic details.

---

## 🧪 Test Architecture & Isolation

All tests are located in [js/tests/](file:///e:/AutoInvoice/js/tests/):

- **[test-runner.js](file:///e:/AutoInvoice/js/tests/test-runner.js)**: Orchestrates the test queue, backs up browser `localStorage` before every test, executes the test asynchronously, and restores storage state immediately in a `finally` block to prevent pollution.
- **[utils.test.js](file:///e:/AutoInvoice/js/tests/utils.test.js)**: Verifies `roundBDT` 2-decimal arithmetic precision, XSS entity escaping (`escapeHTML`), Lakh/Crore formatted currency (`formatBDT`), BDT English words converter (`numberToWordsBDT`), and slugification.
- **[storage.test.js](file:///e:/AutoInvoice/js/tests/storage.test.js)**: Verifies monotonic sequencing (`peekNext*` vs `finalize*`), high-water mark retention on historical saves, input bounding and sanitization (`sanitizeRecord`), Client Address Book CRUD, and KPI aggregation.
- **[qr.test.js](file:///e:/AutoInvoice/js/tests/qr.test.js)**: Validates QR payload schema compliance across invoices, challans, receipts, and quotations.
- **[invoice.test.js](file:///e:/AutoInvoice/js/tests/invoice.test.js)**: Validates dynamic line calculations, grand total rounding, and client auto-save integration.
- **[receipt.test.js](file:///e:/AutoInvoice/js/tests/receipt.test.js)**: Validates live iframe integration with `receipt.html`, invoice linkage, payment deductions, "Zero Due by Adjustment" settlements, and A4 print dimensions.
