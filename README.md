# AutoInvoice (Bangladesh Format)

[![Offline-First](https://img.shields.io/badge/Architecture-Offline--First-success)](#-how-to-run)
[![Format](https://img.shields.io/badge/Format-Bangladesh%20BDT%20(Lakh%2FCrore)-blue)](#-data-integrity--financial-precision)
[![License](https://img.shields.io/badge/License-MIT-lightgrey)](#-license)
[![Zero-Dependencies](https://img.shields.io/badge/Dependencies-Zero%20(Vanilla%20JS)-orange)](#-architecture--technology-stack)

A robust, offline-first, multi-page business document management and printing platform tailored for Bangladeshi freelance engineers, contractors, and corporate operations. AutoInvoice generates, tracks, and prints **Quotations, Commercial Invoices, Delivery Challans, and Money Receipts** with automated non-gapping sequences, real-time receivables reconciliation, QR verification, client address book management, and accounting reports.

---

## 🌟 Key Features

### 1. Document Generation Suite
- **Quotation (`quotation.html`)**:
  - Structured proposal drafting with itemized breakdown, scope of work, and customizable commercial terms.
  - One-click workflow transitions: directly convert any quotation into a Commercial Invoice, Delivery Challan, or Money Receipt.
  - Automatic transfer of client profiles, line items, and quotation reference tags (`[Quotation: QTN-...]`).
- **Commercial Invoice (`invoice.html`)**:
  - Auto-incrementing non-gapping sequence (`INV-YYYY-####`).
  - Automatic due date calculation defaulting to **15 working days** (skipping Bangladesh weekend: Fridays & Saturdays).
  - Cross-document linking to Delivery Challan numbers.
  - Dynamic line items with real-time 2-decimal BDT rounding, grand total calculation, and Bangladeshi currency to words converter.
  - Payment status badge (`Paid`, `Partial`, `Unpaid`, `Overdue`).
  - Actions: Save, Duplicate as New, Create Money Receipt, Download JSON, and Clean Print to PDF.
- **Delivery Challan / Note (`challan.html`)**:
  - Dual sequencing mode: **Auto** (`CH-YYYY-####`) or **Manual** override.
  - Shipment details without pricing (Description, Quantity, Unit, Remarks/Serial numbers).
  - Client shipping and destination delivery address routing.
  - QR verification code and dual-signoff blocks (*Delivered by* / *Received by*).
- **Money Receipt (`receipt.html`)**:
  - Auto-incrementing sequence (`RCPT-YYYY-####`).
  - Direct linking to Commercial Invoices with live balance inspection.
  - Real-time receivables math: calculates total invoiced, cumulative previous payments, and pending dues.
  - Strict overpayment prevention: alerts if payment exceeds invoice due amount.
  - **"Zero Due by Adjustment"**: Supports negotiated debt discounts and full balance settlement with user confirmation and an automatic audit trail logged on the linked invoice.
- **Search & Reporting Hub (`search.html`)**:
  - Universal multi-criteria search across LocalStorage and preloaded disk records (`records/`).
  - Filter by document type, document number, client name, payment status (`Paid`, `Partial`, `Unpaid`, `Overdue`), validity (`Valid`, `Expired`), date ranges, amount ranges, and line item keywords.
  - Real-time **Outstanding Receivables Report** with one-click **CSV export**.
  - **Accounts Receivable Aging Analysis** bucketed into Current, 1–30 days, 31–60 days, 61–90 days, and 90+ days overdue with **CSV export**.

---

### 2. Dashboard & Financial Intelligence (`index.html`)
- **Real-Time Financial Intelligence KPIs**:
  - **Total Invoiced**: Cumulative value billed across all commercial invoices.
  - **Total Collected**: Total verified payments received via money receipts.
  - **Outstanding Dues**: Real-time pending balance across all active accounts.
  - **Active Records Counter**: Granular breakdown of Invoices, Challans, Quotations, and Receipts.
- **Client Address Book Modal**:
  - Centralized contact management accessible directly from the dashboard.
  - Full CRUD operations: search clients, create new profiles, edit designations/addresses, and delete obsolete entries.
  - Cross-document `<datalist>` auto-complete: auto-populates client data across Invoices, Challans, Quotations, and Receipts.
- **Backup, Restore & Quota Safeguards**:
  - **One-Click JSON Export (`exportAllData()`)**: Creates a complete timestamped backup archive of all documents, client contacts, and monotonic sequence counters.
  - **Restore Backup Modal (`importAllData()`)**: Validates backup schemas, provides a detailed content summary preview, and restores data safely.
  - **Proactive Storage Quota Monitor**: Alerts the user when browser `localStorage` exceeds 80% capacity to prevent data clipping or browser rejection.

---

### 3. Financial Precision & Numbering Integrity
- **BDT Financial Math (`roundBDT`)**:
  - Every calculation step is rounded to 2 decimal places to eliminate IEEE 754 floating-point drift.
- **Monotonic Sequencing (`peekNext*` / `finalize*`)**:
  - Next document numbers are previewed non-destructively on page load.
  - Counter increments are strictly finalized only upon saving the document. Discarding or navigating away leaves no gaps in numbering.
  - Sequence counters preserve high-water marks and never rewind when editing older documents.
- **South Asian Numbering (Lakh & Crore)**:
  - Formats numbers in standard Bangladeshi/Indian grouped currency (`৳15,00,000.00`).
  - `numberToWordsBDT()` accurately converts amounts into spoken English words with Lakh, Crore, and Paisa notation.

---

### 4. Standardized QR Code Verification
- Real-time debounced (300ms) QR code generation with high error correction (Level H) rendered as vector SVG.
- Standardized payload format across all documents:
  ```
  DOC=<TYPE>|TXID=<DocNumber>|DT=<YYYY-MM-DD>|AMT=<Amount>|CCY=BDT|BEN=<Company>|REC=<Client>|V=1
  ```
  *(Delivery Challans omit `AMT` and `CCY` to preserve commercial confidentiality during shipping).*

---

### 5. Modern UI, UX & Accessibility
- **Responsive Theme Engine**: Full support for dark and light themes with system preference detection and persistent toggle (`theme.js`).
- **Bootstrap 5 Toast Feedback**: Replaces native blocking browser `alert()` dialogs with non-intrusive, auto-dismissing toast notifications.
- **Unsaved Changes Guard**: Prevents accidental data loss by prompting the user if navigating away from an active form with unsaved changes (`beforeunload`).
- **Document Mode Badges**: Visual indicator displaying `📝 Editing [DocNo]` vs `✨ New Document`.
- **WCAG AA Compliance**: Skip-to-content links, explicit `aria-label` tags, and `role="status"` / `aria-live="polite"` feedback on dynamic financial alerts.

---

### 6. Precision Print & PDF Output (`css/print.css`)
- Calibrated strictly for standard **A4 paper** with **18mm margins**.
- Screen elements (navbars, theme switches, buttons, modals, badges) are cleanly hidden.
- Input elements automatically flatten into plain formatted text for crisp printing.
- Physical QR quiet zone preservation (20mm × 20mm with 2mm padding) to guarantee barcode readability.
- Page break optimization (`page-break-inside: avoid`) prevents broken table rows or orphan signature lines.

---

## 🚀 How to Run

### Method 1: Direct Browser Launch (100% Offline)
AutoInvoice has zero external server or build requirements. Simply double-click `index.html` or open it directly in any modern browser (Chrome, Edge, Firefox, Safari, Brave):
```text
file:///path/to/AutoInvoice/index.html
```

### Method 2: Local Node.js Static Server
For testing features that require `fetch` (such as loading pre-seeded disk records from `records/` or running iframe test suites):
```bash
# Start the built-in HTTP server (defaults to port 8080)
node server.js
```
Then visit:
- **Dashboard**: [http://localhost:8080/index.html](http://localhost:8080/index.html)
- **Invoice**: [http://localhost:8080/invoice.html](http://localhost:8080/invoice.html)
- **Challan**: [http://localhost:8080/challan.html](http://localhost:8080/challan.html)
- **Quotation**: [http://localhost:8080/quotation.html](http://localhost:8080/quotation.html)
- **Receipt**: [http://localhost:8080/receipt.html](http://localhost:8080/receipt.html)
- **Search & Reports**: [http://localhost:8080/search.html](http://localhost:8080/search.html)
- **Test Suite**: [http://localhost:8080/tests/tests.html](http://localhost:8080/tests/tests.html)

### Method 3: Docker & Docker Compose (Recommended for Containerized Environments)
AutoInvoice includes an ultra-lightweight, zero-dependency Alpine container setup with automatic host volume mounting for disk persistence:
```bash
# Start container in detached mode with persistent records storage
docker compose up -d

# Or build and run with Docker directly
docker build -t autoinvoice .
docker run -d -p 8080:8080 -v $(pwd)/records:/app/records --name autoinvoice autoinvoice
```
All documents, custom billers, and disk records in `records/` will persist safely on your host machine across container restarts and updates.

---

## 🧪 Automated Testing Guide

AutoInvoice includes a comprehensive browser-based unit test suite.
1. Run `node server.js` and navigate to [http://localhost:8080/tests/tests.html](http://localhost:8080/tests/tests.html) (or open `tests/tests.html` in your browser).
2. The test runner automatically backs up and restores `localStorage`, running tests across 5 key modules:
   - **`utils.test.js`**: `roundBDT` precision, XSS entity escaping (`escapeHTML`), Lakh/Crore formatting (`formatBDT`), BDT words conversion, and URL slugification.
   - **`storage.test.js`**: Monotonic peek/finalize non-gapping sequencing, historical edit counter retention, input sanitization bounds, client address book CRUD, and aggregate KPI math.
   - **`qr.test.js`**: QR payload schema compliance across invoices, challans, receipts, and quotations.
   - **`invoice.test.js`**: Dynamic row totals, grand total rounding, and client auto-save integration.
   - **`receipt.test.js`**: Live iframe integration, linked invoice balance reconciliation, "Zero Due by Adjustment" debt write-down math, and A4 print dimensions.

---

## 📁 Project Structure

```
AutoInvoice/
├── index.html                   # Main dashboard with KPIs, document hub, client modal & backup
├── quotation.html               # Quotation generator with 1-click conversion to Invoice/Challan
├── invoice.html                 # Commercial invoice generator with due dates & QR verification
├── challan.html                 # Delivery note / challan generator with auto/manual numbering
├── receipt.html                 # Money receipt generator with live invoice due reconciliation
├── search.html                  # Universal search, aging receivables report & CSV exports
├── server.js                    # Zero-dependency local Node.js static preview server
├── CHANGELOG.md                 # System version history and release notes
├── DEVELOPER_GUIDE.md           # Architecture, data schemas, API guide & technical reference
├── README.md                    # Primary user manual and project overview
├── assets/
│   ├── logo.svg                 # Vector brand mark
│   └── vendor/
│       ├── bootstrap.min.css    # Bootstrap 5 layout and grid
│       └── bootstrap.bundle.min.js # Bootstrap 5 modal and toast interactive components
├── css/
│   ├── styles.css               # Global typography, color variables, dark/light themes
│   └── print.css                # Precision A4 print stylesheet (@media print)
├── js/
│   ├── constants.js             # Company branding, storage keys, and number prefixes
│   ├── storage.js               # Persistence layer, monotonic counters, backup & KPIs
│   ├── utils.js                 # Financial math, word conversions, toasts, QR payload builder
│   ├── theme.js                 # Dark/light theme switcher with localStorage persistence
│   ├── dashboard.js             # Dashboard statistics, client CRUD modal & restore logic
│   ├── quotation.js             # Quotation form logic and cross-document conversions
│   ├── invoice.js               # Invoice form logic, row calculations, and payment tracking
│   ├── challan.js               # Delivery challan form logic and dynamic layout
│   ├── receipt.js               # Money receipt logic, due calculation & adjustments
│   ├── search.js                # Search queries, aging receivables analysis & CSV exporters
│   ├── records.js               # Disk-based index and record file discovery loaders
│   ├── vendor/
│   │   └── qrcode.min.js        # Vector QR code generator library
│   └── tests/                   # Modular unit test suites
│       ├── test-runner.js       # In-browser test runner with storage isolation
│       ├── utils.test.js        # Math and string utility tests
│       ├── storage.test.js      # Sequencing and storage persistence tests
│       ├── qr.test.js           # QR payload schema validation tests
│       ├── invoice.test.js      # Invoice math and client book tests
│       └── receipt.test.js      # Receipt lifecycle and iframe integration tests
├── records/                     # Pre-seeded disk-based records for search & demonstration
│   ├── invoices/
│   │   ├── index.json           # Invoices index manifest
│   │   └── invoice_INV-2025-0001_example.json
│   └── challans/
│       ├── index.json           # Challans index manifest
│       └── challan_CH-2025-0007_example.json
└── tests/
    └── tests.html               # Browser-based test suite UI runner
```

---

## 🏢 Company & Brand Customization

All company credentials, contact info, and signature labels are centralized in [js/constants.js](file:///e:/AutoInvoice/js/constants.js):

```javascript
const COMPANY = Object.freeze({
  name: "Amirul Islam",
  slogan: "Freelance Embedded Systems Service provider",
  address: "Banasree, Rampura, Dhaka, Bangladesh",
  contacts: ["+8801747144755"],
  phone: "+8801747144755",
  email: "mahadi.ma.ak@gmail.com",
  logoPath: "assets/logo.svg",
  signatureLabels: {
    deliveredBy: "Delivered by",
    receivedBy: "Received by"
  }
});
```

Modifying this file immediately updates all headers, footers, QR verification payloads, and printed documents across the entire platform.

---

## 📄 License

This project is licensed under the [MIT License](file:///e:/AutoInvoice/LICENSE).