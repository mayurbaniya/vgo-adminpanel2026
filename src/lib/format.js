const inrInt = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
const inrShort = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 });

export function formatCount(n) {
  return inrInt.format(Math.round(Number(n) || 0));
}

// Indian short form: K (thousand), L (lakh, 1e5), Cr (crore, 1e7).
export function formatINR(n) {
  const num = Number(n) || 0;
  if (num >= 1_00_00_000) return `₹${inrShort.format(num / 1_00_00_000)}Cr`;
  if (num >= 1_00_000) return `₹${inrShort.format(num / 1_00_000)}L`;
  if (num >= 1_000) return `₹${inrShort.format(num / 1_000)}K`;
  return `₹${inrInt.format(num)}`;
}
