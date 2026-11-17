const fs = require('fs');
const path = require('path');

const htmlFiles = [
  'index.html',
  'invoice.html',
  'challan.html',
  'quotation.html',
  'receipt.html',
  'statement.html',
  'search.html',
  'expenses.html'
];

console.log('====================================================');
console.log('   AutoInvoice HTML & Accessibility Quality Audit');
console.log('====================================================\n');

let totalFailures = 0;

htmlFiles.forEach(file => {
  const filePath = path.join(__dirname, '..', file);
  if (!fs.existsSync(filePath)) {
    console.log(`[FAIL] File missing: ${file}`);
    totalFailures++;
    return;
  }
  const content = fs.readFileSync(filePath, 'utf8');
  console.log(`--- Audit: ${file} ---`);

  // 1. Check duplicate IDs
  const idRegex = /id=["']([^"']+)["']/g;
  let match;
  const ids = {};
  const dups = [];
  while ((match = idRegex.exec(content)) !== null) {
    const id = match[1];
    if (ids[id]) dups.push(id);
    else ids[id] = true;
  }
  if (dups.length) {
    console.log(`  [FAIL] Duplicate IDs (${dups.length}):`, [...new Set(dups)]);
    totalFailures++;
  } else {
    console.log(`  [PASS] No duplicate IDs (${Object.keys(ids).length} unique IDs)`);
  }

  // 2. Check local script and stylesheet links
  const srcRegex = /(?:src|href)=["']([^"'#?]+)["']/g;
  const missingFiles = [];
  while ((match = srcRegex.exec(content)) !== null) {
    const target = match[1];
    if (
      target.startsWith('http') ||
      target.startsWith('data:') ||
      target.startsWith('mailto:') ||
      target.startsWith('tel:') ||
      target.startsWith('javascript:')
    ) continue;
    const resolved = path.join(__dirname, '..', target);
    if (!fs.existsSync(resolved)) {
      missingFiles.push(target);
    }
  }
  if (missingFiles.length) {
    console.log(`  [FAIL] Missing referenced assets (${missingFiles.length}):`, missingFiles);
    totalFailures++;
  } else {
    console.log(`  [PASS] All local asset and script references exist`);
  }

  // 3. Check print stylesheet link & no stray inline @media print or low-contrast dark buttons
  const hasPrintCss = /href=["']css\/print\.css["']/i.test(content);
  const hasInlinePrint = /@media\s+print/i.test(content);
  if (file !== 'index.html' && !hasPrintCss) {
    console.log(`  [FAIL] Missing css/print.css link`);
    totalFailures++;
  } else if (hasInlinePrint) {
    console.log(`  [FAIL] Inline @media print found (consolidate into css/print.css)`);
    totalFailures++;
  } else {
    console.log(`  [PASS] Print stylesheet & layout separation clean`);
  }

  // 4. Check form inputs without labels/aria-label
  const inputRegex = /<(?:input|select|textarea)([^>]+)>/gi;
  const unlabelled = [];
  while ((match = inputRegex.exec(content)) !== null) {
    const attrs = match[1];
    const typeMatch = attrs.match(/type=["']([^"']+)["']/i);
    const type = typeMatch ? typeMatch[1].toLowerCase() : 'text';
    if (type === 'hidden' || type === 'submit' || type === 'button') continue;

    const idMatch = attrs.match(/id=["']([^"']+)["']/i);
    const ariaMatch = attrs.match(/aria-label=["']([^"']+)["']/i);
    const ariaLabelledBy = attrs.match(/aria-labelledby=["']([^"']+)["']/i);
    const titleMatch = attrs.match(/title=["']([^"']+)["']/i);
    const id = idMatch ? idMatch[1] : null;

    let hasLabel = false;
    if (ariaMatch || ariaLabelledBy || titleMatch) hasLabel = true;
    if (id) {
      const labelRegex = new RegExp('<label[^>]+for=["\']' + id + '["\']', 'i');
      if (labelRegex.test(content)) hasLabel = true;
    }
    if (!hasLabel) {
      unlabelled.push(id || attrs.slice(0, 50).trim());
    }
  }
  if (unlabelled.length) {
    console.log(`  [FAIL] Inputs without explicit label/aria-label/title (${unlabelled.length}):`, unlabelled);
    totalFailures += unlabelled.length;
  } else {
    console.log(`  [PASS] All interactive form inputs have labels or aria descriptors`);
  }

  // 5. Check <h1> landmark heading presence
  const h1Count = (content.match(/<h1\b/gi) || []).length;
  if (h1Count !== 1) {
    console.log(`  [FAIL] Expected exactly 1 <h1> landmark heading (found ${h1Count})`);
    totalFailures++;
  } else {
    console.log(`  [PASS] Exactly 1 <h1> landmark heading present`);
  }
  console.log('');
});

if (totalFailures > 0) {
  console.error(`❌ HTML Audit failed with ${totalFailures} blocking issue(s).`);
  process.exit(1);
} else {
  console.log('✅ All HTML Audit checks passed with 0 blocking issues.');
}
