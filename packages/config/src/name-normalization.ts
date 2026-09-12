/**
 * Case-insensitive, whitespace-normalized comparison key for name/title
 * uniqueness checks (Templates, Audits, CAPAs, Documents). Trims, collapses
 * internal whitespace runs to a single space, and lowercases — so
 * "Internal Audit 2026", "internal audit 2026" and "  Internal Audit 2026  "
 * all normalize to the same key. Mirrors, in application code, the exact
 * value stored in each entity's `normalizedName`/`normalizedTitle` column.
 */
export function normalizeName(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ').toLowerCase();
}
