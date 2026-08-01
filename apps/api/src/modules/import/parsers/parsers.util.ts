/**
 * Shared heuristics for the document parsers: code/revision/keyword extraction
 * and OOXML (docx/pptx) helpers. Pure functions, no I/O — easy to unit test.
 */
import { DOCUMENT_CODE_REGEX, REVISION_REGEX } from '@tecpap/config';

const STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'that', 'this', 'from', 'are', 'was', 'were', 'been',
  'have', 'has', 'will', 'shall', 'must', 'all', 'any', 'via', 'des', 'les', 'une',
  'le', 'la', 'et', 'de', 'pour', 'sur', 'par', 'aux', 'dans', 'sur', 'que', 'qui',
]);

/** Normalize a detected document code (e.g. "PROC 014" → "PROC-014"). */
export function extractDocumentCode(text: string): string | undefined {
  const m = text.match(DOCUMENT_CODE_REGEX);
  if (!m) return undefined;
  return `${m[1]}-${m[2]}`;
}

/** Extract a revision/version token ("Rev 5", "v2.1", "Version 03" → "5" | "2.1" | "03"). */
export function extractRevision(text: string): string | undefined {
  const m = text.match(REVISION_REGEX);
  return m ? m[1] : undefined;
}

/** Flatten all text inside `<tag>…</tag>` runs (OOXML drawingML paragraphs). */
export function extractRuns(xml: string, tag = 'a:t'): string[] {
  const re = new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`, 'g');
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    const t = decodeXml(m[1] ?? '').trim();
    if (t) out.push(t);
  }
  return out;
}

export interface OoxmlCoreProps {
  title?: string;
  creator?: string;
  lastModifiedBy?: string;
  revision?: string;
  created?: string;
  modified?: string;
}

/** Parse docProps/core.xml (shared by .docx and .pptx) for Dublin Core metadata. */
export function readOoxmlCoreProps(xml: string): OoxmlCoreProps {
  const pick = (ns: string, name: string): string | undefined => {
    const m = xml.match(new RegExp(`<(?:\\w+:)?${ns}:${name}[^>]*>([^<]*)</(?:\\w+:)?${ns}:${name}>`, 'i'));
    const v = m?.[1];
    return v ? decodeXml(v).trim() || undefined : undefined;
  };
  return {
    title: pick('dc', 'title'),
    creator: pick('dc', 'creator'),
    lastModifiedBy: pick('cp', 'lastModifiedBy'),
    revision: pick('cp', 'revision'),
    created: pick('dcterms', 'created'),
    modified: pick('dcterms', 'modified'),
  };
}

function decodeXml(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

/** Derive a human title from a filename ("PROC-014_bottle_blowing.docx" → "PROC 014 bottle blowing"). */
export function titleFromName(fileName: string): string {
  const base = fileName.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  return base ? base.charAt(0).toUpperCase() + base.slice(1) : fileName;
}

/** Frequency-based keyword extraction across the visible text. */
export function extractKeywords(text: string, max = 12): string[] {
  const freq = new Map<string, number>();
  for (const raw of text.toLowerCase().split(/[^a-zà-ÿ0-9]+/i)) {
    const w = raw.trim();
    if (w.length < 4 || STOPWORDS.has(w) || /^\d+$/.test(w)) continue;
    freq.set(w, (freq.get(w) ?? 0) + 1);
  }
  return [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, max).map(([w]) => w);
}

/** First ~280 chars of normalized text, for previews and FTS augmentation. */
export function excerpt(text: string, max = 280): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max)}…` : flat;
}
