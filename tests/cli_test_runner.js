/**
 * AutoInvoice CLI Unit Test Runner
 * Emulates the browser harness in tests/tests.html
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

// In-memory localStorage implementation
function createMemoryStorage() {
  let store = {};
  return {
    getItem(k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
    setItem(k, v) { store[k] = String(v); },
    removeItem(k) { delete store[k]; },
    clear() { store = {}; },
    key(i) { return Object.keys(store)[i] || null; },
    get length() { return Object.keys(store).length; }
  };
}

const memStorage = createMemoryStorage();

// Mock DOM elements
function createElement(tag) {
  let _textContent = '';
  const el = {
    tagName: tag.toUpperCase(),
    id: '',
    className: '',
    innerHTML: '',
    outerHTML: '<div id="printArea">mock-print-area</div>',
    get textContent() { return _textContent; },
    set textContent(val) {
      _textContent = String(val ?? '');
      this.innerHTML = _textContent
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    },
    style: {
      setProperty() {},
      getPropertyValue() { return ''; }
    },
    dataset: { text: 'DOC=RCPT|TXID=RCPT-2026-0001|DT=2026-10-08|AMT=500|CCY=BDT|BEN=Amirul Islam|REC=John Doe|V=1' },
    children: [],
    appendChild(child) {
      this.children.push(child);
      return child;
    },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    setAttribute(k, v) { this[k] = v; },
    getAttribute(k) { return this[k] || null; },
    removeAttribute(k) { delete this[k]; },
    addEventListener() {},
    removeEventListener() {},
    classList: {
      add() {},
      remove() {},
      contains() { return false; }
    }
  };
  return el;
}

const mockElements = {
  receiptNumber: createElement('input'),
  receiptDate: createElement('input'),
  linkedInvoice: createElement('select'),
  clientName: createElement('input'),
  clientAddress: createElement('textarea'),
  paymentMethod: createElement('select'),
  amountReceived: createElement('input'),
  dueAmount: createElement('input'),
  amountInWords: createElement('input'),
  receiptQR: createElement('div'),
  printArea: createElement('div'),
  results: createElement('div')
};
mockElements.receiptQR.id = 'receiptQR';
mockElements.receiptQR.dataset.text = 'DOC=RCPT|TXID=RCPT-TEST-0001|DT=2025-12-02|AMT=300|CCY=BDT|BEN=Amirul Islam|REC=Test Co|V=1';
mockElements.printArea.id = 'printArea';
mockElements.printArea.outerHTML = '<section id="printArea" class="receipt-card"><div>Official Payment Voucher</div></section>';

const context = {
  console,
  setTimeout,
  clearTimeout,
  setInterval,
  clearInterval,
  Date,
  Math,
  Number,
  String,
  Boolean,
  Array,
  Object,
  RegExp,
  JSON,
  Blob: class Blob {
    constructor(parts) {
      this.size = parts.reduce((acc, p) => acc + Buffer.byteLength(String(p)), 0);
    }
  },
  fetch: async (url) => {
    const cleanUrl = url.replace(/^\.\.\//, '');
    const fullPath = path.join(__dirname, '..', cleanUrl);
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, 'utf8');
      return {
        text: async () => content,
        json: async () => JSON.parse(content)
      };
    }
    return {
      text: async () => '',
      json: async () => ({})
    };
  },
  TESTS: [],
  test(name, fn) {
    context.TESTS.push({ name, fn });
  },
  ok(condition, message) {
    return { pass: !!condition, message };
  }
};

context.window = context;
context.global = context;
context.localStorage = memStorage;

// Event listeners for window
const windowListeners = {};
context.addEventListener = (event, fn) => {
  if (!windowListeners[event]) windowListeners[event] = [];
  windowListeners[event].push(fn);
};
context.removeEventListener = (event, fn) => {
  if (!windowListeners[event]) return;
  windowListeners[event] = windowListeners[event].filter(h => h !== fn);
};
context.dispatchEvent = (evt) => {
  const handlers = windowListeners[evt.type] || [];
  handlers.forEach(h => h(evt));
  return true;
};
context.CustomEvent = class CustomEvent {
  constructor(type, init) {
    this.type = type;
    this.detail = init?.detail;
  }
};

const docListeners = {};
context.document = {
  createElement,
  getElementById(id) {
    if (id === 'receiptFrame') {
      return {
        contentWindow: context,
        contentDocument: { readyState: 'complete' }
      };
    }
    return mockElements[id] || createElement('div');
  },
  documentElement: createElement('html'),
  body: createElement('body'),
  querySelector(selector) { return null; },
  querySelectorAll(selector) { return []; },
  addEventListener(event, fn) {
    if (!docListeners[event]) docListeners[event] = [];
    docListeners[event].push(fn);
  },
  removeEventListener(event, fn) {
    if (!docListeners[event]) return;
    docListeners[event] = docListeners[event].filter(h => h !== fn);
  }
};

// Create VM context
vm.createContext(context);

// Files to load in sequence
const coreFiles = [
  'js/constants.js',
  'js/storage.js',
  'js/utils.js',
  'js/catalog.js',
  'js/biller.js',
  'js/receipt.js',
  'js/statement.js'
];

coreFiles.forEach(rel => {
  const code = fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
  vm.runInContext(code, context, { filename: rel });
});

// Test files to load in sequence
const testFiles = [
  'js/tests/utils.test.js',
  'js/tests/storage.test.js',
  'js/tests/qr.test.js',
  'js/tests/invoice.test.js',
  'js/tests/challan.test.js',
  'js/tests/quotation.test.js',
  'js/tests/receipt.test.js',
  'js/tests/biller.test.js',
  'js/tests/reports.test.js',
  'js/tests/statement.test.js',
  'js/tests/expense.test.js'
];

testFiles.forEach(rel => {
  const code = fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
  vm.runInContext(code, context, { filename: rel });
});

// Run tests
async function runAll() {
  console.log(`\n======================================================`);
  console.log(`   Running AutoInvoice Unit Test Suite (${context.TESTS.length} tests)`);
  console.log(`======================================================\n`);

  let passedCount = 0;
  let failedCount = 0;
  const failures = [];

  for (const t of context.TESTS) {
    memStorage.clear();
    try {
      const res = await t.fn();
      const assertions = Array.isArray(res) ? res : [res];
      const allPass = assertions.every(r => r.pass);

      if (allPass) {
        passedCount++;
        console.log(` PASS  ${t.name}`);
      } else {
        failedCount++;
        console.log(` FAIL  ${t.name}`);
        assertions.filter(r => !r.pass).forEach(f => {
          console.log(`   --> ${f.message}`);
        });
        failures.push({ name: t.name, assertions: assertions.filter(r => !r.pass) });
      }
    } catch (err) {
      failedCount++;
      console.log(` FAIL  ${t.name} (EXCEPTION)`);
      console.log(`   --> ${err.stack || err.message}`);
      failures.push({ name: t.name, error: err });
    }
  }

  console.log(`\n======================================================`);
  console.log(` Test Execution Summary:`);
  console.log(` Total Suites:    ${testFiles.length} files`);
  console.log(` Total Tests:     ${context.TESTS.length}`);
  console.log(` Passed:          ${passedCount} (${((passedCount / context.TESTS.length) * 100).toFixed(1)}%)`);
  console.log(` Failed:          ${failedCount}`);
  console.log(`======================================================\n`);

  if (failedCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runAll().catch(err => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
