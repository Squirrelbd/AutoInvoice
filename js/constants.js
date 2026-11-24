// Company constants — hard-coded and shown on all documents
// Adjust these to match your actual company details.
const COMPANY = Object.freeze({
  id: "biller_default",
  name: "Amirul Islam",
  slogan: "Freelance Embedded Systems Service provider",
  address: "Banasree, Rampura, Dhaka, Bangladesh",
  contacts: ["+8801747144755"],
  phone: "+8801747144755",
  email: "mahadi.ma.ak@gmail.com",
  logoPath: "assets/logo.svg",
  themeColor: "#0b3969",
  prefixes: Object.freeze({
    invoice: "INV",
    challan: "CH",
    receipt: "RCPT",
    quotation: "QTN",
    expense: "EXP",
  }),
  signatureLabels: Object.freeze({
    deliveredBy: "Delivered by",
    receivedBy: "Received by",
    authorizedBy: "Authorized Signature",
  }),
  isDefault: true,
});

// Storage keys — keep consistent across pages
const STORAGE_KEYS = Object.freeze({
  lastInvoiceNo: "ai_last_invoice_number",
  lastChallanNo: "ai_last_challan_number",
  invoices: "ai_invoices",
  challans: "ai_challans",
  lastReceiptNo: "ai_last_receipt_number",
  receipts: "ai_receipts",
  lastQuotationNo: "ai_last_quotation_number",
  quotations: "ai_quotations",
  clients: "ai_clients",
  items: "ai_items",
  billers: "ai_billers",
  activeBillerId: "ai_active_biller_id",
  expenses: "ai_expenses",
  expenseCategories: "ai_expense_categories",
  lastExpenseNo: "ai_last_expense_number",
});

// Number formats — alias company prefixes to avoid duplicated definitions
const NUMBER_FORMATS = Object.freeze({
  invoicePrefix: COMPANY.prefixes.invoice,
  challanPrefix: COMPANY.prefixes.challan,
  receiptPrefix: COMPANY.prefixes.receipt,
  quotationPrefix: COMPANY.prefixes.quotation,
  expensePrefix: COMPANY.prefixes.expense,
});

// Standard Default Expense Categories
const DEFAULT_EXPENSE_CATEGORIES = Object.freeze([
  "Hardware & Components",
  "Tools & Lab Equipment",
  "Software & Cloud Hosting",
  "Office Rent & Utilities",
  "Internet & Communication",
  "Transport & Conveyance",
  "Salary & Contractor Fees",
  "Taxes & Government Fees",
  "Marketing & Advertising",
  "Meals & Refreshments",
  "Miscellaneous"
]);

// Expose to window for global access across scripts and test runners
if (typeof window !== "undefined") {
  window.COMPANY = COMPANY;
  window.STORAGE_KEYS = STORAGE_KEYS;
  window.NUMBER_FORMATS = NUMBER_FORMATS;
  window.DEFAULT_EXPENSE_CATEGORIES = DEFAULT_EXPENSE_CATEGORIES;
}

