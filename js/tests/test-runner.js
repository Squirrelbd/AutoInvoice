// Minimal browser test runner
window.__IS_AUTOINVOICE_TESTING__ = true;
const TESTS = [];
function test(name, fn) { TESTS.push({ name, fn }); }
function ok(condition, message) { return { pass: !!condition, message }; }

function backupStorage() {
  const store = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      store[k] = localStorage.getItem(k);
    }
  } catch (e) {
    console.warn('Storage backup error', e);
  }
  return store;
}

function restoreStorage(store) {
  try {
    localStorage.clear();
    for (const [k, v] of Object.entries(store)) {
      localStorage.setItem(k, v);
    }
  } catch (e) {
    console.warn('Storage restore error', e);
  }
}

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

async function runTests() {
  const resultsEl = document.getElementById('results');
  const out = [];
  const realStorage = window.localStorage;
  const userStorage = backupStorage();
  const memStorage = createMemoryStorage();
  let mocked = false;
  const frame = document.getElementById('receiptFrame');
  let frameWin = frame?.contentWindow;
  let frameMocked = false;

  try {
    Object.defineProperty(window, 'localStorage', { value: memStorage, configurable: true });
    mocked = true;
  } catch (e) {
    console.warn('In-memory storage isolation unavailable, falling back to backup/restore', e);
  }

  window.__IS_AUTOINVOICE_TESTING__ = true;
  if (frame && !frame.getAttribute('src') && frame.dataset?.src) {
    await new Promise(resolve => {
      frame.addEventListener('load', resolve, { once: true });
      frame.src = frame.dataset.src;
    });
    frameWin = frame.contentWindow;
  }
  if (frameWin) {
    try {
      frameWin.__IS_AUTOINVOICE_TESTING__ = true;
      Object.defineProperty(frameWin, 'localStorage', { value: memStorage, configurable: true });
      frameMocked = true;
    } catch (e) {}
  }

  try {
    for (const t of TESTS) {
      try {
        memStorage.clear();
        const res = await t.fn();
        const pass = Array.isArray(res) ? res.every(r => r.pass) : !!res?.pass;
        out.push({ name: t.name, pass, details: Array.isArray(res) ? res : [res] });
      } catch (e) {
        out.push({ name: t.name, pass: false, details: [{ pass: false, message: String(e) }] });
      } finally {
        memStorage.clear();
      }
    }
  } finally {
    window.__IS_AUTOINVOICE_TESTING__ = false;
    if (frameWin) frameWin.__IS_AUTOINVOICE_TESTING__ = false;
    if (mocked) {
      try {
        Object.defineProperty(window, 'localStorage', { value: realStorage, configurable: true });
      } catch (e) {}
    } else {
      restoreStorage(userStorage);
    }
    if (frameMocked && frameWin) {
      try {
        Object.defineProperty(frameWin, 'localStorage', { value: realStorage, configurable: true });
      } catch (e) {}
    }
  }
  const ul = document.createElement('ul');
  ul.className = 'list-group';
  out.forEach(r => {
    const li = document.createElement('li');
    li.className = 'list-group-item';
    li.innerHTML = `<strong>${r.pass ? '✅' : '❌'} ${r.name}</strong>`;
    if (r.details?.length) {
      const dl = document.createElement('ul');
      dl.className = 'mt-2';
      r.details.forEach(d => {
        const di = document.createElement('li');
        di.textContent = `${d.pass ? 'PASS' : 'FAIL'} — ${d.message || ''}`;
        dl.appendChild(di);
      });
      li.appendChild(dl);
    }
    ul.appendChild(li);
  });
  resultsEl.innerHTML = '';
  resultsEl.appendChild(ul);
}

window.addEventListener('load', () => {
  const frame = document.getElementById('receiptFrame');
  if (frame && frame.contentDocument && frame.contentDocument.readyState === 'complete') {
    runTests();
  } else if (frame) {
    frame.addEventListener('load', () => runTests(), { once: true });
  } else {
    runTests();
  }
});

