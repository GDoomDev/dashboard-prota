/**
 * Parses a number that may be in BR format ("1.234,56") or US format ("1,234.56").
 * Strips currency symbols and whitespace. Returns NaN for unparseable input.
 */
export function parseLocaleNumber(input: string | number | null | undefined): number {
  if (input == null) return NaN;
  if (typeof input === "number") return input;
  const cleaned = input.trim().replace(/[^\d.,\-]/g, "");
  if (!cleaned) return NaN;

  const lastComma = cleaned.lastIndexOf(",");
  const lastDot = cleaned.lastIndexOf(".");

  let normalized: string;
  if (lastComma === -1 && lastDot === -1) {
    normalized = cleaned;
  } else if (lastComma > lastDot) {
    normalized = cleaned.replace(/\./g, "").replace(",", ".");
  } else {
    normalized = cleaned.replace(/,/g, "");
  }
  return Number(normalized);
}

/** Parse "DD-MM-YYYY", "DD/MM/YYYY", "YYYY-MM-DD" or "YYYY/MM/DD" into ISO YYYY-MM-DD. */
export function parseDate(input: string): string {
  const s = input.trim();
  const isoMatch = /^(\d{4})[-/](\d{2})[-/](\d{2})$/.exec(s);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  const brMatch = /^(\d{2})[-/](\d{2})[-/](\d{4})$/.exec(s);
  if (brMatch) return `${brMatch[3]}-${brMatch[2]}-${brMatch[1]}`;
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return s;
}

/**
 * Minimal RFC4180-compatible CSV parser. Handles quoted fields with embedded
 * commas and escaped double quotes ("").
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else {
      if (c === '"') {
        inQuotes = true;
      } else if (c === ",") {
        row.push(field);
        field = "";
      } else if (c === "\n") {
        row.push(field);
        field = "";
        rows.push(row);
        row = [];
      } else if (c === "\r") {
        // skip
      } else {
        field += c;
      }
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((v) => v.trim().length > 0));
}
