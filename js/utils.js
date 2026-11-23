// Shared utility functions

// Round to 2 decimal places — prevents floating-point drift in financial calculations
function roundBDT(n) {
  const num = Number(n);
  if (!Number.isFinite(num) || Math.abs(num) < 1e-9) return 0;
  if (Math.abs(num) >= 1e15) return Math.round(num * 100) / 100;
  const sign = num < 0 ? -1 : 1;
  const abs = Math.abs(num);
  const absStr = String(abs);
  let res;
  if (absStr.includes('e') || absStr.includes('E')) {
    res = sign * (Math.round((abs + Number.EPSILON) * 100) / 100);
  } else {
    res = sign * Number(Math.round(Number(absStr + 'e2')) + 'e-2');
  }
  return res === 0 ? 0 : res;
}

/**
 * Shared commercial totals calculator (BDT / % discount + exclusive / inclusive VAT)
 * used by Invoice and Quotation calculators so conversion totals match to the Paisa.
 */
function computeTotalsBreakdown(subtotal, opts = {}) {
  const sub = roundBDT(Math.max(0, Number(subtotal) || 0));
  const dMode = opts.discountMode === 'percent' ? 'percent' : 'bdt';
  const dVal = roundBDT(Math.max(0, Number(opts.discountValue) || 0));
  let discount = dMode === 'percent' ? roundBDT(sub * (Math.min(dVal, 100) / 100)) : dVal;
  discount = Math.min(discount, sub);
  const vatRate = roundBDT(Math.max(0, Number(opts.vatRate) || 0));
  const vatInclusive = !!opts.vatInclusive;
  const afterDiscount = roundBDT(Math.max(0, sub - discount));
  let taxable = afterDiscount;
  let vatAmount = 0;
  let grandTotal = afterDiscount;
  if (vatRate > 0) {
    if (vatInclusive) {
      taxable = roundBDT(afterDiscount / (1 + vatRate / 100));
      vatAmount = roundBDT(afterDiscount - taxable);
      grandTotal = afterDiscount;
    } else {
      vatAmount = roundBDT(taxable * (vatRate / 100));
      grandTotal = roundBDT(taxable + vatAmount);
    }
  }
  return {
    subtotal: sub,
    discountMode: dMode,
    discountValue: dVal,
    discount,
    vatRate,
    vatInclusive,
    taxable,
    vatAmount,
    grandTotal
  };
}

function parseLocalISODate(iso) {
  if (iso instanceof Date) return new Date(iso.getTime());
  const s = String(iso || '').trim().slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (m) {
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  }
  const fallback = new Date(iso);
  return isNaN(fallback.getTime()) ? null : fallback;
}

function toLocalISODate(d = new Date()) {
  const dt = d instanceof Date ? d : parseLocalISODate(d);
  if (!dt || isNaN(dt.getTime())) return '';
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addWorkingDaysLocal(startDateStr, workingDays) {
  let d = parseLocalISODate(startDateStr);
  if (!d) d = new Date();
  let count = 0;
  const n = Number(workingDays || 0);
  while (count < n) {
    d.setDate(d.getDate() + 1);
    const day = d.getDay();
    if (day !== 5 && day !== 6) count++;
  }
  return toLocalISODate(d);
}

// Escape HTML to prevent XSS when interpolating user data into innerHTML or attributes
function escapeHTML(s) {
  const d = document.createElement('div');
  d.textContent = String(s ?? '');
  return d.innerHTML.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function escapeAttr(s) {
  if (s == null) return '';
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Unified toast notification system — replaces native blocking alert()
function showToast(message, type = 'info') {
  if (typeof document === 'undefined') return;
  let container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    container.className = 'toast-container position-fixed bottom-0 end-0 p-3 no-print';
    container.style.zIndex = '1100';
    document.body.appendChild(container);
  }

  const bgMap = {
    success: 'text-bg-success',
    danger: 'text-bg-danger',
    error: 'text-bg-danger',
    warning: 'text-bg-warning',
    info: 'text-bg-primary'
  };
  const iconMap = {
    success: '✅',
    danger: '❌',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️'
  };
  const bgClass = bgMap[type] || 'text-bg-primary';
  const icon = iconMap[type] || 'ℹ️';

  const toastEl = document.createElement('div');
  toastEl.className = `toast align-items-center ${bgClass} border-0 shadow`;
  toastEl.setAttribute('role', 'alert');
  toastEl.setAttribute('aria-live', 'assertive');
  toastEl.setAttribute('aria-atomic', 'true');

  toastEl.innerHTML = `
    <div class="d-flex">
      <div class="toast-body d-flex align-items-center gap-2">
        <span>${icon}</span>
        <span>${escapeHTML(message)}</span>
      </div>
      <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
    </div>
  `;

  container.appendChild(toastEl);
  if (typeof window !== 'undefined' && window.bootstrap && window.bootstrap.Toast) {
    try {
      const toast = new window.bootstrap.Toast(toastEl, { delay: 4000 });
      toast.show();
      toastEl.addEventListener('hidden.bs.toast', () => {
        toastEl.remove();
      });
      return;
    } catch (e) {
      console.warn('Bootstrap toast init failed, falling back', e);
    }
  }
  toastEl.classList.add('show');
  setTimeout(() => {
    toastEl.remove();
  }, 4000);
}

// Debounce helper to optimize live recalculations and QR generation
function debounce(fn, delay = 300) {
  let timeoutId = null;
  return function (...args) {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      fn.apply(this, args);
    }, delay);
  };
}

function sanitizeQrField(v) {
  return String(v ?? '').replace(/[\r\n|]+/g, ' ').replace(/=/g, ':').trim();
}

// Unified QR code payload schema generator
function buildQRPayload(type, data = {}) {
  const t = sanitizeQrField((type || 'DOC').toUpperCase()) || 'DOC';
  const num = sanitizeQrField(data.number || '');
  const dt = sanitizeQrField(data.date || '');
  const activeComp = (typeof getActiveBiller === 'function' ? getActiveBiller() : (typeof COMPANY !== 'undefined' ? COMPANY : {}));
  const ben = sanitizeQrField(data.company || activeComp.name || '');
  const rec = sanitizeQrField(data.client || '');
  if (t === 'CHAL' || t === 'CHALLAN') {
    return `DOC=CHAL|TXID=${num}|DT=${dt}|BEN=${ben}|REC=${rec}|V=1`;
  }
  const amt = data.pending ? 0 : roundBDT(data.amount != null ? data.amount : (data.total || 0));
  if (data.pending) {
    return `DOC=${t}|TXID=${num}|DT=${dt}|AMT=${amt}|CCY=BDT|BEN=${ben}|REC=${rec}|ST=PENDING|V=1`;
  }
  return `DOC=${t}|TXID=${num}|DT=${dt}|AMT=${amt}|CCY=BDT|BEN=${ben}|REC=${rec}|V=1`;
}

function parseQRPayload(raw) {
  const text = String(raw || '').trim();
  const fields = {};
  if (!text) return { valid: false, version: null, docType: '', fields, raw: text };
  text.split('|').forEach(part => {
    const idx = part.indexOf('=');
    if (idx > 0) {
      fields[part.slice(0, idx).trim().toUpperCase()] = part.slice(idx + 1).trim();
    }
  });
  const valid = !!(fields.V === '1' && fields.DOC && fields.TXID);
  return { valid, version: fields.V || null, docType: fields.DOC || '', fields, raw: text };
}

function renderRemittanceBlock(biller) {
  if (typeof document === 'undefined') return;
  const box = document.getElementById('remittanceBox');
  const contentEl = document.getElementById('remittanceContent');
  if (!box || !contentEl) return;
  const rem = (biller && biller.remittance) || {};
  const lines = [];
  if (rem.bankName || rem.accountNo) {
    const bankParts = [rem.bankName, rem.branch ? `Branch: ${rem.branch}` : ''].filter(Boolean).join(' • ');
    if (bankParts) lines.push(`<div><strong>Bank:</strong> ${escapeHTML(bankParts)}</div>`);
    const acctParts = [rem.accountName ? `A/C Name: ${rem.accountName}` : '', rem.accountNo ? `A/C No: ${rem.accountNo}` : '', rem.routingNo ? `Routing: ${rem.routingNo}` : ''].filter(Boolean).join(' | ');
    if (acctParts) lines.push(`<div>${escapeHTML(acctParts)}</div>`);
  }
  const mfs = [];
  if (rem.bkash) mfs.push(`bKash: ${escapeHTML(rem.bkash)}`);
  if (rem.nagad) mfs.push(`Nagad: ${escapeHTML(rem.nagad)}`);
  if (rem.rocket) mfs.push(`Rocket: ${escapeHTML(rem.rocket)}`);
  if (mfs.length) lines.push(`<div><strong>MFS:</strong> ${mfs.join(' | ')}</div>`);
  if (rem.instructions) lines.push(`<div class="text-muted small">${escapeHTML(rem.instructions)}</div>`);

  if (!lines.length) {
    box.classList.add('d-none');
    contentEl.innerHTML = '';
  } else {
    contentEl.innerHTML = lines.join('');
    box.classList.remove('d-none');
  }
}

function setCompanyHeader(overrideBiller) {
  let c = overrideBiller || (typeof getActiveBiller === 'function' ? getActiveBiller() : (typeof COMPANY !== 'undefined' ? COMPANY : {}));
  if (overrideBiller && overrideBiller.id && typeof getBillerById === 'function' && (!overrideBiller.logoDataUri || overrideBiller.signatureDataUri === undefined)) {
    const liveBiller = getBillerById(overrideBiller.id);
    if (liveBiller) {
      c = Object.assign({}, liveBiller, overrideBiller, {
        logoDataUri: overrideBiller.logoDataUri || liveBiller.logoDataUri,
        signatureDataUri: overrideBiller.signatureDataUri !== undefined ? overrideBiller.signatureDataUri : liveBiller.signatureDataUri
      });
    }
  }
  const nameEl = document.getElementById('companyName');
  const addrEl = document.getElementById('companyAddress');
  const contactsEl = document.getElementById('companyContacts');
  const sloganEl = document.getElementById('companySlogan');
  const logoEl = document.getElementById('companyLogo');

  if (nameEl) nameEl.textContent = c.name || '';
  if (sloganEl) sloganEl.textContent = c.slogan || '';
  if (addrEl) addrEl.textContent = c.address || '';
  if (contactsEl) {
    const phoneText = c.phone || (c.contacts?.[0] || '');
    const emailText = c.email || '';
    const taxIdText = c.taxId || '';
    const parts = [];
    if (phoneText) parts.push(`Phone: ${escapeHTML(phoneText)}`);
    if (emailText) parts.push(`Email: ${escapeHTML(emailText)}`);
    if (taxIdText) parts.push(`BIN/TIN: ${escapeHTML(taxIdText)}`);
    contactsEl.innerHTML = parts.join(' | ');
  }
  if (logoEl) {
    logoEl.src = typeof _safeLogoUri === 'function' ? _safeLogoUri(c.logoDataUri || c.logoPath) : (c.logoDataUri || c.logoPath || 'assets/logo.svg');
  }
  const isReceipt = typeof document !== 'undefined' && document.body?.classList?.contains('receipt-page');
  if (!isReceipt) {
    const deliveredEl = document.getElementById('deliveredLabel');
    const receivedEl = document.getElementById('receivedLabel');
    const sigs = c.signatureLabels || (typeof COMPANY !== 'undefined' ? COMPANY.signatureLabels : {});
    if (deliveredEl && sigs) deliveredEl.textContent = sigs.deliveredBy || '';
    if (receivedEl && sigs) receivedEl.textContent = sigs.receivedBy || '';
  }
  renderBillerSignature(c);
  renderRemittanceBlock(c);
}

function renderBillerSignature(overrideBiller) {
  if (typeof document === 'undefined') return;
  const b = overrideBiller || (typeof getActiveBiller === 'function' ? getActiveBiller() : (typeof COMPANY !== 'undefined' ? COMPANY : {}));
  const sigWrap = document.getElementById('billerSignatureWrap');
  const sigImg = document.getElementById('billerSignatureImg');
  const sigTitleEl = document.getElementById('signatoryTitleLabel');
  const sigBox = typeof document.querySelector === 'function' ? document.querySelector('.signature-box') : null;

  const sigUri = typeof _safeSignatureUri === 'function' ? _safeSignatureUri(b?.signatureDataUri) : (b?.signatureDataUri || '');

  if (sigImg) {
    if (sigUri) {
      sigImg.src = sigUri;
      sigImg.classList.remove('d-none');
      if (sigWrap) sigWrap.classList.remove('d-none');
    } else {
      sigImg.src = '';
      sigImg.classList.add('d-none');
    }
  }

  // Also support existing legacy .signature-box if present
  if (sigBox && !sigImg) {
    if (sigUri) {
      sigBox.innerHTML = `<img src="${escapeAttr(sigUri)}" alt="Authorized Signature" class="biller-signature-img" />`;
      sigBox.classList.remove('d-none');
    } else {
      sigBox.innerHTML = '';
      sigBox.classList.add('d-none');
    }
  }

  if (sigTitleEl) {
    const titleParts = [];
    if (b?.signatoryName) titleParts.push(b.signatoryName);
    if (b?.signatoryTitle) titleParts.push(b.signatoryTitle);
    if (titleParts.length) {
      sigTitleEl.textContent = titleParts.join(' • ');
      sigTitleEl.classList.remove('d-none');
    } else {
      sigTitleEl.textContent = '';
      sigTitleEl.classList.add('d-none');
    }
  }
}

function formatBDT(amount) {
  const num = roundBDT(amount);
  const formatted = Math.abs(num).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return num < 0 ? `-৳${formatted}` : `৳${formatted}`;
}

// Convert ISO date (YYYY-MM-DD) into readable commercial date (e.g. 08 Oct 2026)
function formatDisplayDate(isoDateStr) {
  if (!isoDateStr) return '—';
  try {
    const parts = String(isoDateStr).slice(0, 10).split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const monthIndex = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      if (!isNaN(year) && monthIndex >= 0 && monthIndex < 12 && !isNaN(day)) {
        return `${String(day).padStart(2, '0')} ${months[monthIndex]} ${year}`;
      }
    }
    const d = new Date(isoDateStr);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    }
  } catch (e) {
    // fallback
  }
  return isoDateStr;
}

function parseQuery() {
  const params = new URLSearchParams(window.location.search);
  const obj = {};
  for (const [k, v] of params.entries()) obj[k] = v;
  return obj;
}

function renderQR(containerEl, text) {
  if (!containerEl) return;
  containerEl.innerHTML = '';
  const payload = String(text || '').trim();
  if (!payload) return;
  containerEl.dataset.text = payload;

  // Compact ASCII-safe fallback when multi-byte UTF-8 text overflows qrcode.min.js version table
  const compactAsciiPayload = payload
    .split('|')
    .map(part => {
      if (/^(BEN|REC)=/.test(part)) {
        const eqIdx = part.indexOf('=');
        const key = part.slice(0, eqIdx + 1);
        const cleanVal = part.slice(eqIdx + 1).replace(/[^\x20-\x7E]/g, '').replace(/\s+/g, ' ').trim().slice(0, 20);
        return key + (cleanVal || 'Verified');
      }
      return part;
    })
    .join('|');
  const minimalPayload = payload
    .split('|')
    .filter(p => /^(DOC|TXID|DT|AMT|CCY|V)=/.test(p))
    .join('|') || payload.slice(0, 80);

  const attempts = [
    { txt: payload, lvl: QRCode.CorrectLevel.M },
    { txt: payload, lvl: QRCode.CorrectLevel.L },
    { txt: compactAsciiPayload, lvl: QRCode.CorrectLevel.L },
    { txt: minimalPayload, lvl: QRCode.CorrectLevel.L }
  ];

  let rendered = false;
  for (const att of attempts) {
    containerEl.innerHTML = '';
    try {
      new QRCode(containerEl, {
        text: att.txt,
        width: 128,
        height: 128,
        colorDark: '#000000',
        colorLight: '#ffffff',
        correctLevel: att.lvl
      });
      if (containerEl.querySelector('canvas')) {
        rendered = true;
        break;
      }
    } catch (_) {
      containerEl.innerHTML = '';
    }
  }
  if (!rendered) {
    containerEl.innerHTML = '';
    return;
  }

  // Synchronously copy canvas data to img to guarantee instant visibility on screen & in print
  const canvas = containerEl.querySelector('canvas');
  let img = containerEl.querySelector('img');
  if (canvas) {
    try {
      const dataUrl = canvas.toDataURL('image/png');
      if (!img) {
        img = document.createElement('img');
        containerEl.appendChild(img);
      }
      img.src = dataUrl;
      img.alt = 'Verification QR Code';
      img.style.display = 'block';
      img.style.width = '100%';
      img.style.height = '100%';
      canvas.remove();
    } catch (err) {
      // Fallback: keep canvas directly visible if toDataURL fails
      if (img) img.remove();
      canvas.style.display = 'block';
      canvas.style.width = '100%';
      canvas.style.height = '100%';
    }
  } else if (img) {
    img.style.display = 'block';
    img.style.width = '100%';
    img.style.height = '100%';
  }
}

// Slugify strings for filenames
function slugify(text) {
  const t = (text || '').toString().trim().toLowerCase();
  if (!t) return '';
  return t
    .replace(/[^a-z0-9\s-_]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80);
}

// Convert number to words using Indian numbering (Crore/Lakh/Thousand)
function numberToWordsBDT(amount) {
  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  function twoDigits(n) {
    if (n < 20) return ones[n];
    const t = Math.floor(n / 10);
    const o = n % 10;
    return tens[t] + (o ? " " + ones[o] : "");
  }

  function threeDigits(n) {
    const h = Math.floor(n / 100);
    const r = n % 100;
    let str = "";
    if (h) str += ones[h] + " Hundred";
    if (r) str += (str ? " " : "") + twoDigits(r);
    return str;
  }

  function integerToWords(num) {
    if (num === 0) return "Zero";
    let str = "";
    const crore = Math.floor(num / 10000000); num %= 10000000;
    const lakh = Math.floor(num / 100000); num %= 100000;
    const thousand = Math.floor(num / 1000); num %= 1000;
    const hundredPart = num; // 0..999

    if (crore) {
      const croreWords = crore >= 100 ? integerToWords(crore) : twoDigits(crore);
      str += croreWords + " Crore";
    }
    if (lakh) str += (str ? " " : "") + twoDigits(lakh) + " Lakh";
    if (thousand) str += (str ? " " : "") + twoDigits(thousand) + " Thousand";
    if (hundredPart) str += (str ? " " : "") + threeDigits(hundredPart);
    return str;
  }

  const rounded = roundBDT(amount);
  const isNegative = rounded < 0;
  const abs = Math.abs(rounded);
  let intPart = Math.floor(abs);
  let paisa = Math.round((abs - intPart) * 100);
  if (paisa >= 100) {
    intPart += 1;
    paisa = 0;
  }

  const prefix = isNegative ? "Negative " : "";
  const intWords = integerToWords(intPart);
  if (paisa > 0) {
    return `${prefix}${intWords} Taka and ${twoDigits(paisa)} Paisa Only`;
  }
  return `${prefix}${intWords} Taka Only`;
}

// ==========================================
// 1-Click WhatsApp & Email Share Helpers
// ==========================================
function generateSharePayload(docType, data) {
  const billerName = data.billerName || (typeof getActiveBiller === 'function' ? getActiveBiller()?.name : '') || 'AutoInvoice';
  const clientName = data.clientName || 'Valued Customer';
  const phone = (data.clientPhone || '').replace(/[^0-9]/g, '');
  const email = data.clientEmail || '';

  let subject = '';
  let msg = '';
  let emailBody = '';

  if (docType === 'invoice') {
    const num = data.number || 'INV';
    const total = data.total != null ? formatBDT(data.total) : '৳0.00';
    const due = data.due != null ? formatBDT(data.due) : total;
    const date = data.date || '';
    const dueDate = data.dueDate || '';

    subject = `Commercial Invoice: ${num} — ${billerName}`;
    msg = `Dear ${clientName},\n\n` +
      `Please find Commercial Invoice *${num}* from *${billerName}*.\n\n` +
      `• Invoice No: ${num}\n` +
      `• Date: ${formatDisplayDate(date)}\n` +
      (dueDate ? `• Due Date: ${formatDisplayDate(dueDate)}\n` : '') +
      `• Grand Total: ${total}\n` +
      (data.due != null && data.due !== data.total ? `• Remaining Due: ${due}\n` : '') +
      `\nKindly review and arrange payment according to the invoice terms. Thank you for your partnership!`;

    emailBody = `Dear ${clientName},\n\n` +
      `Please find attached Commercial Invoice ${num} from ${billerName}.\n\n` +
      `Invoice Summary:\n` +
      `• Document Number: ${num}\n` +
      `• Billing Date: ${formatDisplayDate(date)}\n` +
      (dueDate ? `• Due Date: ${formatDisplayDate(dueDate)}\n` : '') +
      `• Grand Total: ${total}\n` +
      (data.due != null && data.due !== data.total ? `• Remaining Due: ${due}\n` : '') +
      `\nPlease inspect the document and feel free to reach out if you have any questions.\n\n` +
      `Warm regards,\n${billerName}`;
  } else if (docType === 'quotation') {
    const num = data.number || 'QTN';
    const total = data.total != null ? formatBDT(data.total) : '৳0.00';
    const date = data.date || '';

    subject = `Quotation: ${num} — ${billerName}`;
    msg = `Dear ${clientName},\n\n` +
      `Please find our Commercial Quotation *${num}* from *${billerName}*.\n\n` +
      `• Quotation No: ${num}\n` +
      `• Date: ${formatDisplayDate(date)}\n` +
      `• Total Estimated: ${total}\n` +
      `• Validity: 30 Days\n\n` +
      `Please feel free to reach out if you have any questions or require revisions.`;

    emailBody = `Dear ${clientName},\n\n` +
      `Thank you for your inquiry. Please find our Quotation ${num} from ${billerName}.\n\n` +
      `Quotation Summary:\n` +
      `• Number: ${num}\n` +
      `• Date: ${formatDisplayDate(date)}\n` +
      `• Total Estimate: ${total}\n` +
      `• Validity: 30 Business Days\n\n` +
      `We look forward to collaborating with you.\n\n` +
      `Best regards,\n${billerName}`;
  } else if (docType === 'challan') {
    const num = data.number || 'CH';
    const date = data.date || '';
    const itemsCount = data.itemCount != null ? data.itemCount : (Array.isArray(data.items) ? data.items.length : 0);

    subject = `Delivery Challan / Note: ${num} — ${billerName}`;
    msg = `Dear ${clientName},\n\n` +
      `Goods have been dispatched under Delivery Challan *${num}* from *${billerName}*.\n\n` +
      `• Challan No: ${num}\n` +
      `• Date: ${formatDisplayDate(date)}\n` +
      `• Items Dispatched: ${itemsCount} line item(s)\n\n` +
      `Kindly inspect and acknowledge receipt of goods. Thank you!`;

    emailBody = `Dear ${clientName},\n\n` +
      `Please be informed that the consignments under Delivery Challan ${num} have been dispatched from ${billerName}.\n\n` +
      `Delivery Summary:\n` +
      `• Challan Number: ${num}\n` +
      `• Dispatch Date: ${formatDisplayDate(date)}\n` +
      `• Line Items: ${itemsCount}\n\n` +
      `Please inspect upon arrival and return the signed acknowledgment copy.\n\n` +
      `Sincerely,\n${billerName}`;
  } else if (docType === 'receipt') {
    const num = data.number || 'RCPT';
    const amt = data.amount != null ? formatBDT(data.amount) : '৳0.00';
    const date = data.date || '';
    const method = data.paymentMethod || 'Payment';
    const invNo = data.linkedInvoice || data.invoiceNumber;
    const inv = invNo ? ` for Invoice ${invNo}` : '';
    const due = data.due != null ? formatBDT(data.due) : null;

    subject = `Money Receipt & Payment Acknowledgment: ${num} — ${billerName}`;
    msg = `Dear ${clientName},\n\n` +
      `Thank you for your payment! Money Receipt *${num}* has been issued by *${billerName}*.\n\n` +
      `• Receipt No: ${num}\n` +
      `• Date: ${formatDisplayDate(date)}\n` +
      `• Amount Received: ${amt}\n` +
      `• Method: ${method}${inv}\n` +
      (due != null ? `• Remaining Due: ${due}\n` : '') +
      `\nThis serves as official confirmation of your payment. Thank you!`;

    emailBody = `Dear ${clientName},\n\n` +
      `We gratefully acknowledge receipt of your payment under Money Receipt ${num} from ${billerName}.\n\n` +
      `Payment Particulars:\n` +
      `• Receipt Number: ${num}\n` +
      `• Date: ${formatDisplayDate(date)}\n` +
      `• Amount Received: ${amt}\n` +
      `• Payment Mode: ${method}${inv}\n` +
      (due != null ? `• Remaining Balance: ${due}\n` : '') +
      `\nThank you for doing business with us.\n\n` +
      `Sincerely,\n${billerName}`;
  }

  const whatsappUrl = phone
    ? `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`
    : `https://wa.me/?text=${encodeURIComponent(msg)}`;

  const mailtoUrl = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(emailBody)}`;

  return { whatsappUrl, mailtoUrl, subject, msg, emailBody };
}

function shareDocumentWhatsApp(docType, data) {
  const { whatsappUrl } = generateSharePayload(docType, data);
  window.open(whatsappUrl, '_blank');
}

function shareDocumentEmail(docType, data) {
  const { mailtoUrl } = generateSharePayload(docType, data);
  window.location.href = mailtoUrl;
}

function sanitizeCsvCell(cell) {
  let str = String(cell == null ? '' : cell);
  if (/^[\t\r\n]|^\s*[=+\-@]/.test(str)) {
    str = "'" + str;
  }
  return `"${str.replace(/"/g, '""')}"`;
}

// Unified Formula-Safe CSV Exporter (UTF-8 BOM + Blob to prevent # truncation)
function downloadCSV(filename, rows) {
  if (typeof document === 'undefined' || !Array.isArray(rows)) return;
  const csvContent = '\uFEFF' + rows.map(r => (Array.isArray(r) ? r : [r]).map(sanitizeCsvCell).join(',')).join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Deterministic PDF filename setter during browser print dialog
let _savedDocumentTitle = null;
let _activeAfterPrintRestore = null;
function setPrintDocumentTitle(docNumber, clientName) {
  if (typeof document === 'undefined') return;
  if (_savedDocumentTitle === null) {
    _savedDocumentTitle = document.title;
  }
  const numPart = String(docNumber || 'Document').trim().replace(/[^a-zA-Z0-9_-]/g, '-');
  const clientPart = slugify(clientName || '');
  const targetTitle = clientPart ? `${numPart}_${clientPart}` : numPart;
  document.title = targetTitle;

  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    if (_activeAfterPrintRestore) {
      window.removeEventListener('afterprint', _activeAfterPrintRestore);
    }
    _activeAfterPrintRestore = () => {
      if (_savedDocumentTitle !== null) {
        document.title = _savedDocumentTitle;
        _savedDocumentTitle = null;
      }
      window.removeEventListener('afterprint', _activeAfterPrintRestore);
      _activeAfterPrintRestore = null;
    };
    window.addEventListener('afterprint', _activeAfterPrintRestore);
  }
  return targetTitle;
}

let _pdfStatusPromise = null;
function checkPdfEndpointAvailable() {
  const isTesting = !!(window.__IS_AUTOINVOICE_TESTING__ || (typeof window !== 'undefined' && window.parent && window.parent !== window && window.parent.__IS_AUTOINVOICE_TESTING__));
  if (typeof window === 'undefined' || typeof fetch === 'undefined' || window.location?.protocol === 'file:' || isTesting) {
    return Promise.resolve({ available: false });
  }
  if (!_pdfStatusPromise) {
    _pdfStatusPromise = fetch('/api/pdf/status', { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : { available: false }))
      .catch(() => ({ available: false }));
  }
  return _pdfStatusPromise;
}

function buildPrintableHtmlSnapshot() {
  const clone = document.documentElement.cloneNode(true);
  // Force light print color-scheme on cloned root
  clone.setAttribute('data-bs-theme', 'light');
  clone.style.colorScheme = 'light';

  // Mirror live form values and convert live canvases (QR codes, charts) to inline PNG images
  const srcCanvases = document.querySelectorAll('canvas');
  const dstCanvases = clone.querySelectorAll('canvas');
  srcCanvases.forEach((canvas, idx) => {
    const target = dstCanvases[idx];
    if (!target || !target.parentNode) return;
    try {
      const dataUrl = canvas.toDataURL('image/png');
      const img = document.createElement('img');
      img.src = dataUrl;
      img.alt = canvas.getAttribute('aria-label') || 'Canvas graphic';
      img.className = canvas.className;
      img.style.cssText = canvas.style.cssText;
      if (!img.style.maxWidth) img.style.maxWidth = '100%';
      target.parentNode.replaceChild(img, target);
    } catch (_) { }
  });

  const srcInputs = document.querySelectorAll('input, textarea, select');
  const dstInputs = clone.querySelectorAll('input, textarea, select');
  srcInputs.forEach((el, idx) => {
    const d = dstInputs[idx];
    if (!d) return;
    if (el.tagName === 'TEXTAREA') {
      d.textContent = el.value;
    } else if (el.tagName === 'SELECT') {
      Array.from(d.options || []).forEach((opt, oi) => {
        if (oi === el.selectedIndex) opt.setAttribute('selected', 'selected');
        else opt.removeAttribute('selected');
      });
    } else if (el.type === 'checkbox' || el.type === 'radio') {
      if (el.checked) d.setAttribute('checked', 'checked');
      else d.removeAttribute('checked');
    } else {
      d.setAttribute('value', el.value || '');
    }
  });

  clone.querySelectorAll('script').forEach(s => s.remove());
  return '<!doctype html>\n' + clone.outerHTML;
}

async function downloadRenderedPdf(prepareFn, filenameBase, triggerBtn) {
  if (typeof window === 'undefined') return;
  let originalHtml = null;
  let afterPrintDispatched = false;
  if (triggerBtn) {
    originalHtml = triggerBtn.innerHTML;
    triggerBtn.disabled = true;
    triggerBtn.innerHTML = '⏳ Generating PDF...';
  }
  try {
    await Promise.resolve(prepareFn && prepareFn());
    const resolvedBase = typeof filenameBase === 'function' ? filenameBase() : filenameBase;
    const st = await checkPdfEndpointAvailable();
    if (!st || !st.available) {
      window.print();
      afterPrintDispatched = true;
      return;
    }
    const html = buildPrintableHtmlSnapshot();
    window.dispatchEvent(new Event('afterprint'));
    afterPrintDispatched = true;
    const cleanName = (String(resolvedBase || document.title || 'AutoInvoice_Document').replace(/[^a-zA-Z0-9._-]/g, '_') || 'AutoInvoice_Document') + '.pdf';
    const res = await fetch('/api/pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ html, filename: cleanName })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = cleanName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    if (typeof showToast === 'function') showToast(`Downloaded ${cleanName}`, 'success');
  } catch (err) {
    console.warn('Direct PDF endpoint failed, opening browser print dialog:', err);
    window.print();
  } finally {
    if (!afterPrintDispatched) {
      window.dispatchEvent(new Event('afterprint'));
    }
    if (triggerBtn) {
      triggerBtn.disabled = false;
      triggerBtn.innerHTML = originalHtml;
    }
  }
}

function initPdfDownloadButton(btnId, prepareFn, filenameFn) {
  if (typeof document === 'undefined') return;
  const btn = document.getElementById(btnId);
  if (!btn) return;
  checkPdfEndpointAvailable().then(st => {
    if (st && st.available) {
      btn.classList.remove('d-none');
      btn.title = `Save exact A4 PDF via headless ${st.browser || 'browser'}`;
    }
  });
  btn.addEventListener('click', () => {
    downloadRenderedPdf(prepareFn, filenameFn, btn);
  });
}

function runAutoPrintIfRequested(prepareFn) {
  if (typeof window === 'undefined') return;
  const q = parseQuery();
  if (q.autoprint !== '1' && q.autoprint !== 'true') return;
  setTimeout(() => {
    try {
      if (typeof prepareFn === 'function') prepareFn();
      window.print();
    } catch (_) { }
  }, 350);
}

// Auto-select placeholder "0" / "0.00" on numeric inputs so typing immediately replaces instead of prefixing "0"
if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
  document.addEventListener('focusin', (e) => {
    const el = e && e.target;
    if (!el || el.tagName !== 'INPUT' || el.readOnly || el.disabled) return;
    if (el.getAttribute('inputmode') !== 'decimal' && el.type !== 'number') return;
    const v = String(el.value || '').trim();
    if (v === '0' || v === '0.00') {
      const raf = typeof requestAnimationFrame === 'function' ? requestAnimationFrame : (fn) => setTimeout(fn, 0);
      raf(() => {
        try {
          if (document.activeElement === el && typeof el.select === 'function') el.select();
        } catch (_) { }
      });
    }
  });
}


