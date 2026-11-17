// Unit tests for invoice calculations and data handling

test('Invoice line total and grand total rounding calculations', () => {
  const items = [
    { qty: 3, unitPrice: 0.33 },
    { qty: 1.5, unitPrice: 20.10 },
    { qty: 2, unitPrice: 100.05 }
  ];
  // 3 * 0.33 = 0.99
  // 1.5 * 20.10 = 30.15
  // 2 * 100.05 = 200.10
  // Total = 0.99 + 30.15 + 200.10 = 231.24
  const lineTotals = items.map(it => roundBDT(it.qty * it.unitPrice));
  const t1 = ok(lineTotals[0] === 0.99, `Line 1 rounded to 0.99 (got ${lineTotals[0]})`);
  const t2 = ok(lineTotals[1] === 30.15, `Line 2 rounded to 30.15 (got ${lineTotals[1]})`);
  const t3 = ok(lineTotals[2] === 200.10, `Line 3 rounded to 200.10 (got ${lineTotals[2]})`);

  const grandTotal = lineTotals.reduce((sum, line) => roundBDT(sum + line), 0);
  const t4 = ok(grandTotal === 231.24, `Grand total is 231.24 (got ${grandTotal})`);
  return [t1, t2, t3, t4];
});

test('Invoice client auto-saving and retrieval in address book', () => {
  saveClient({ name: 'Acme Test Corp', address: 'Banani, Dhaka', company: 'Acme International' });
  const clients = loadClients();
  const match = clients.find(c => c.name === 'Acme Test Corp');
  const t1 = ok(!!match, 'Saved client found in address book');
  const t2 = ok(match?.address === 'Banani, Dhaka', 'Client address matches');

  // Updating existing client
  saveClient({ name: 'Acme Test Corp', address: 'Gulshan 2, Dhaka' });
  const clientsUpdated = loadClients();
  const updatedMatch = clientsUpdated.find(c => c.name === 'Acme Test Corp');
  const t3 = ok(updatedMatch?.address === 'Gulshan 2, Dhaka', 'Client address updated without duplication');
  return [t1, t2, t3];
});

test('Invoice Discount (BDT) and VAT (%) calculation with roundBDT precision', () => {
  const subtotal = roundBDT(12500.50);
  const discount = roundBDT(500.50);
  const vatRate = 15; // 15% Mushak standard VAT
  const taxable = Math.max(0, roundBDT(subtotal - discount));
  const vatAmount = roundBDT(taxable * (vatRate / 100));
  const grandTotal = roundBDT(taxable + vatAmount);

  const t1 = ok(taxable === 12000, `Taxable amount after discount is 12000 (got ${taxable})`);
  const t2 = ok(vatAmount === 1800, `15% VAT on 12000 is 1800 (got ${vatAmount})`);
  const t3 = ok(grandTotal === 13800, `Grand total with VAT is 13800 (got ${grandTotal})`);
  return [t1, t2, t3];
});

test('Invoice Percentage Discount & VAT Inclusive extraction maintain Paisa accuracy', () => {
  const subtotal = roundBDT(10000);
  const discPct = 10; // 10%
  const discount = roundBDT(subtotal * (discPct / 100)); // 1000
  const grossAfterDisc = roundBDT(subtotal - discount); // 9000 VAT-inclusive
  const vatRate = 15;
  const netTaxable = roundBDT(grossAfterDisc / (1 + vatRate / 100)); // 7826.09
  const vatIncluded = roundBDT(grossAfterDisc - netTaxable); // 1173.91
  const t1 = ok(discount === 1000, `10% discount is 1000 (got ${discount})`);
  const t2 = ok(netTaxable === 7826.09 && vatIncluded === 1173.91 && roundBDT(netTaxable + vatIncluded) === grossAfterDisc, 'VAT-inclusive split sums cleanly back to gross');
  return [t1, t2];
});
