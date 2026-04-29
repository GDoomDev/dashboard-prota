const usd = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const usdDetailed = usd;

const intFmt = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });

export function formatUSD(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return usd.format(n);
}

export function formatUSDPrecise(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return usdDetailed.format(n);
}

export function formatInt(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return intFmt.format(n);
}

export function formatShortDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}`;
}

const PALETTE = [
  "#4f46e5",
  "#06b6d4",
  "#16a34a",
  "#f59e0b",
  "#ef4444",
  "#a855f7",
  "#0ea5e9",
  "#dc2626",
  "#65a30d",
  "#db2777",
];

export function colorFor(index: number): string {
  return PALETTE[index % PALETTE.length];
}

const BRAND_COLORS: Record<string, string> = {
  phoenix: "#FF6600",
  falco: "#0080FF",
  astra: "#C300FF",
};

/** Returns the brand color for known teams/channels, falling back to the generic palette. */
export function colorForEntity(id: string, fallbackIndex: number): string {
  const lower = id.toLowerCase();
  for (const [name, color] of Object.entries(BRAND_COLORS)) {
    if (lower.includes(name)) return color;
  }
  return PALETTE[fallbackIndex % PALETTE.length];
}
