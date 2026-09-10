import { Injectable } from '@nestjs/common';
import JSZip from 'jszip';
import type { DocumentParser, ImportFileInput, ParsedDocument, SlideBullet, SlideData, SlideImage } from '../interfaces/document-parser.interface';
import { excerpt, extractKeywords, readOoxmlCoreProps, titleFromName } from './parsers.util';

const SLIDE_RE = /^ppt\/slides\/slide(\d+)\.xml$/;
const MAX_IMAGE_BYTES = 500_000;
const MAX_TOTAL_IMAGE_BYTES = 3_000_000;

function slideIndex(name: string): number {
  const m = name.match(SLIDE_RE);
  return m ? Number(m[1]) : Number.MAX_SAFE_INTEGER;
}

function decodeXml(s: string): string {
  return s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'");
}

/** Extract text content from all <a:t> runs within an XML fragment. */
function extractTextRuns(xml: string): string {
  return (xml.match(/<a:t[^>]*>([^<]*)<\/a:t>/g) ?? [])
    .map((r) => decodeXml(r.replace(/<[^>]+>/g, '')))
    .join(' ')
    .trim();
}

/** Parse paragraphs from a <p:txBody> or <a:txBody> XML fragment → bullets with levels. */
function parseParagraphs(xml: string): SlideBullet[] {
  const bullets: SlideBullet[] = [];
  const paragraphs = xml.split(/<\/a:p>/);
  for (const para of paragraphs) {
    const text = extractTextRuns(para);
    if (!text) continue;
    const lvlMatch = para.match(/<a:pPr[^>]*\blvl="(\d+)"/);
    const level = lvlMatch ? Math.min(Number(lvlMatch[1]), 4) : 0;
    bullets.push({ text, level });
  }
  return bullets;
}

/**
 * PowerPoint parser — reads each slide's shapes in XML order, preserving text
 * hierarchy (title/subtitle/body with indentation levels), extracting images as
 * base64 data URLs, and flagging unsupported objects (charts, tables, SmartArt).
 * Keeps the flat text corpus for search indexing.
 */
@Injectable()
export class PowerPointParser implements DocumentParser {
  readonly format = 'powerpoint' as const;
  readonly mimeTypes = [
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.ms-powerpoint',
  ];

  canHandle(input: ImportFileInput): boolean {
    return /\.(pptx|ppt)$/i.test(input.name);
  }

  async parse(input: ImportFileInput): Promise<ParsedDocument> {
    const zip = await JSZip.loadAsync(input.buffer);
    const slideNames = Object.keys(zip.files).filter((n) => SLIDE_RE.test(n)).sort((a, b) => slideIndex(a) - slideIndex(b));
    const notesNames = Object.keys(zip.files).filter((n) => /^ppt\/notesSlides\/notesSlide\d+\.xml$/.test(n)).sort((a, b) => slideIndex(a.replace('notesSlides/notesSlide', 'slides/slide')) - slideIndex(b.replace('notesSlides/notesSlide', 'slides/slide')));

    // Build a global media lookup: read all media files once, cap sizes
    const mediaFiles = await this.loadMedia(zip);

    const slideViews: SlideData[] = [];
    const flatSlides: string[] = [];

    for (let si = 0; si < slideNames.length; si++) {
      const slideFile = zip.file(slideNames[si]!);
      const slideXml = slideFile ? await slideFile.async('string') : '';

      // Parse relationships for this slide (rId → media path)
      const relsPath = slideNames[si]!.replace('ppt/slides/', 'ppt/slides/_rels/') + '.rels';
      const relsFile = zip.file(relsPath);
      const relsXml = relsFile ? await relsFile.async('string') : '';
      const relMap = this.parseRels(relsXml);

      const structured = this.parseSlide(slideXml, relMap, mediaFiles, si);
      slideViews.push(structured);

      // Flat text for search
      const parts = [structured.title, ...(structured.subtitle ? [structured.subtitle] : []), ...structured.bullets.map((b) => b.text)];
      flatSlides.push(parts.filter(Boolean).join(' '));
    }

    // Notes
    const flatNotes: string[] = [];
    for (const name of notesNames) {
      const file = zip.file(name);
      const xml = file ? await file.async('string') : '';
      flatNotes.push(this.extractAllText(xml));
    }

    // Assign notes to slides
    slideViews.forEach((sv, i) => { sv.notes = flatNotes[i] ?? ''; });

    const coreXml = zip.file('docProps/core.xml');
    const core = coreXml ? readOoxmlCoreProps(await coreXml.async('string')) : undefined;

    const perSlide = flatSlides.map((s, i) => `Slide ${i + 1}: ${s}`).join('\n');
    const notesBlock = flatNotes.length ? `\nNotes:\n${flatNotes.map((n, i) => `${i + 1}. ${n}`).join('\n')}` : '';
    const content = `${perSlide}${notesBlock}`;
    const firstTitle = slideViews[0]?.title;
    const title = core?.title || firstTitle || titleFromName(input.name);
    const headings = slideViews.map((s) => s.title).filter(Boolean).slice(0, 12);
    const totalImages = slideViews.reduce((sum, s) => sum + s.images.length, 0);

    return {
      title,
      author: core?.creator,
      description: excerpt(content),
      content,
      contentExcerpt: excerpt(content),
      pageCount: slideViews.length,
      imageCount: totalImages,
      headings,
      keywords: extractKeywords(content),
      slides: slideViews,
      metadata: { source: 'powerpoint', slides: slideViews.length, notes: flatNotes.length, images: totalImages, coreProps: core ?? {} },
    };
  }

  /** Load all media files from ppt/media/, capping individual + total sizes. Returns a map of path → data URL. */
  private async loadMedia(zip: JSZip): Promise<Map<string, SlideImage>> {
    const mediaMap = new Map<string, SlideImage>();
    const mediaPaths = Object.keys(zip.files).filter((n) => n.startsWith('ppt/media/'));
    let totalBytes = 0;
    for (const path of mediaPaths) {
      if (totalBytes >= MAX_TOTAL_IMAGE_BYTES) break;
      const file = zip.file(path);
      if (!file) continue;
      const buffer = await file.async('uint8array');
      if (buffer.byteLength > MAX_IMAGE_BYTES) continue;
      totalBytes += buffer.byteLength;
      const filename = path.split('/').pop() ?? path;
      const ext = (filename.split('.').pop() ?? '').toLowerCase();
      const mimeType = ext === 'png' ? 'image/png' : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'gif' ? 'image/gif' : ext === 'bmp' ? 'image/bmp' : ext === 'svg' ? 'image/svg+xml' : 'application/octet-stream';
      if (mimeType === 'application/octet-stream') continue; // skip unknown
      const base64 = bufferToBase64(buffer);
      mediaMap.set(path, { filename, mimeType, dataUrl: `data:${mimeType};base64,${base64}` });
    }
    return mediaMap;
  }

  /** Parse a slide's _rels file → map of rId → media path. */
  private parseRels(relsXml: string): Map<string, string> {
    const rels = new Map<string, string>();
    const matches = relsXml.matchAll(/<Relationship[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"/g);
    for (const m of matches) {
      const id = m[1]!;
      const target = m[2]!;
      if (target.includes('media/') || /\.(png|jpe?g|gif|bmp|svg|emf|wmf)$/i.test(target)) {
        // Resolve relative path from slide dir to media
        const resolved = target.startsWith('..') ? 'ppt/' + target.replace('../', '') : target;
        rels.set(id, resolved);
      }
    }
    return rels;
  }

  /** Parse a single slide's XML, extracting title, subtitle, bullets, images, and omitted objects. */
  private parseSlide(slideXml: string, relMap: Map<string, string>, media: Map<string, SlideImage>, slideIndex: number): SlideData {
    let title = '';
    let subtitle = '';
    const bullets: SlideBullet[] = [];
    const images: SlideImage[] = [];
    const omitted: string[] = [];

    // Split by shapes <p:sp> in order
    const shapes = slideXml.split(/<p:sp>/).slice(1); // first element is before the first <p:sp>
    for (const shapeXml of shapes) {
      const shapeContent = shapeXml.split(/<\/p:sp>/)[0] ?? shapeXml;
      const phMatch = shapeContent.match(/<p:ph[^>]*type="([^"]*)"/);
      const phType = phMatch?.[1] ?? '';
      const txBody = shapeContent.match(/<p:txBody>([\s\S]*?)<\/p:txBody>/)?.[1] ?? '';

      if (phType === 'title' || phType === 'ctrTitle') {
        title = extractTextRuns(txBody) || title;
      } else if (phType === 'subTitle') {
        subtitle = extractTextRuns(txBody) || subtitle;
      } else {
        // Body text — parse paragraphs with levels
        const parsed = parseParagraphs(txBody);
        if (parsed.length > 0) {
          // If no title found yet and this is the first body shape, treat first para as title
          if (!title && parsed.length > 0) {
            title = parsed[0]!.text;
            bullets.push(...parsed.slice(1));
          } else {
            bullets.push(...parsed);
          }
        }
      }
    }

    // Extract images from <p:pic> elements
    const picMatches = slideXml.matchAll(/<p:pic>([\s\S]*?)<\/p:pic>/g);
    for (const picMatch of picMatches) {
      const picXml = picMatch[1]!;
      const embedMatch = picXml.match(/r:embed="([^"]+)"/);
      if (!embedMatch) continue;
      const rId = embedMatch[1]!;
      const mediaPath = relMap.get(rId);
      if (!mediaPath) continue;
      const image = media.get(mediaPath);
      if (image) images.push(image);
    }

    // Detect unsupported objects
    // Charts
    if (/<c:chart>|<p:graphicFrame>[\s\S]*chart/i.test(slideXml)) {
      const chartCount = (slideXml.match(/<c:chart>/g) ?? []).length;
      for (let i = 0; i < chartCount; i++) omitted.push('Chart');
    }
    // Tables
    if (/<a:tbl>/.test(slideXml)) {
      const tblCount = (slideXml.match(/<a:tbl>/g) ?? []).length;
      for (let i = 0; i < tblCount; i++) omitted.push('Table');
    }
    // SmartArt / Diagrams
    if (/<p:graphicFrame>[\s\S]*dgm:|<dgm:/i.test(slideXml)) {
      omitted.push('SmartArt Diagram');
    }

    return {
      index: slideIndex,
      title: title || `Slide ${slideIndex + 1}`,
      subtitle: subtitle || undefined,
      bullets,
      notes: '',
      images,
      omittedObjects: omitted,
    };
  }

  /** Extract all text from a notes slide XML. */
  private extractAllText(xml: string): string {
    return xml
      .split(/<\/a:p>/)
      .map((p) => extractTextRuns(p))
      .filter(Boolean)
      .join('\n');
  }
}

/** Convert a Uint8Array to a base64 string (Node-compatible). */
function bufferToBase64(buffer: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < buffer.length; i += chunk) {
    const slice = buffer.subarray(i, Math.min(i + chunk, buffer.length));
    binary += String.fromCharCode.apply(null, Array.from(slice) as number[]);
  }
  return Buffer.from(binary, 'binary').toString('base64');
}
