const DEFAULT_VAT = parseFloat(process.env.DEFAULT_VAT_RATE || '0.05');

export function computeVat(subtotalOmr, vatRate = DEFAULT_VAT) {
  const subtotal = Number(subtotalOmr) || 0;
  const rate = Number(vatRate) || 0;
  const vat = Math.round(subtotal * rate * 1000) / 1000;
  const total = Math.round((subtotal + vat) * 1000) / 1000;
  return { subtotalOmr: subtotal, vatOmr: vat, totalOmr: total, vatRate: rate };
}
