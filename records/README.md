# Disk Records Storage & Indexing

This directory contains pre-seeded and archived JSON records that can be discovered and queried by AutoInvoice's universal search view (`search.html`).

---

## 📁 Directory Structure

```
records/
├── invoices/
│   ├── index.json                        # Manifest catalog of available invoice JSON files
│   └── invoice_INV-2025-0001_example.json # Example archived invoice record
└── challans/
    ├── index.json                        # Manifest catalog of available challan JSON files
    └── challan_CH-2025-0007_example.json # Example archived challan record
```

---

## 📄 Manifest Catalog Format (`index.json`)

The `index.json` file in each directory registers files that should be loaded when running on a local web server (such as `node server.js`):

```json
{
  "version": 1,
  "records": [
    {
      "number": "INV-2025-0001",
      "date": "2025-06-23",
      "client": { "name": "Saiham Knit (Suits Unit)" },
      "file": "invoice_INV-2025-0001_example.json"
    }
  ]
}
```

---

## 🔍 How AutoInvoice Reads Disk Records

The disk record loader in [js/records.js](file:///e:/AutoInvoice/js/records.js) executes the following strategy:
1. **Primary Index (`loadDiskIndex`)**: Fetches `records/<type>/index.json`.
2. **Directory Listing Fallback (`autoDiscoverSummaries`)**: If served by a static server that provides standard HTML directory listings, `records.js` discovers all `.json` files and parses summaries automatically.
3. **Seamless Search Integration**: In [search.html](file:///e:/AutoInvoice/search.html), disk-based records are merged with browser `localStorage` records, enabling unified filtering, viewing, and cross-referencing.
