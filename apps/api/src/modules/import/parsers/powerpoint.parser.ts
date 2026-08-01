import { Injectable } from '@nestjs/common';
import JSZip from 'jszip';
import type { DocumentParser, ImportFileInput, ParsedDocument } from '../interfaces/document-parser.interface';
import { excerpt, extractKeywords, readOoxmlCoreProps, titleFromName } from './parsers.util';

const SLIDE_RE = /^ppt\/slides\/slide(\d+)\.xml$/;

function slideIndex(name: string): number {
  const m = name.match(SLIDE_RE);
  return m ? Number(m[1]) : Number.MAX_SAFE_INTEGER;
}

/**
 * PowerPoint parser — reads each slide's text runs and speaker notes, then folds
 * them into a single indexed corpus so every slide is full-text searchable while
 * the original .pptx is preserved verbatim.
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
    const imageCount = Object.keys(zip.files).filter((n) => n.startsWith('ppt/media/')).length;

    const slides: string[] = [];
    const notes: string[] = [];
    for (const name of slideNames) {
      const file = zip.file(name);
      const xml = file ? await file.async('string') : '';
      slides.push(this.runs(xml));
    }
    for (const name of notesNames) {
      const file = zip.file(name);
      const xml = file ? await file.async('string') : '';
      notes.push(this.runs(xml));
    }

    const coreXml = zip.file('docProps/core.xml');
    const core = coreXml ? readOoxmlCoreProps(await coreXml.async('string')) : undefined;

    const perSlide = slides.map((s, i) => `Slide ${i + 1}: ${s}`).join('\n');
    const notesBlock = notes.length ? `\nNotes:\n${notes.map((n, i) => `${i + 1}. ${n}`).join('\n')}` : '';
    const content = `${perSlide}${notesBlock}`;
    const firstTitle = slides[0]?.split(/[|\-–—:]/)[0]?.trim();
    const title = core?.title || firstTitle || titleFromName(input.name);
    const headings = slides.map((s) => s.split('\n')[0] ?? '').filter(Boolean).slice(0, 12);

    return {
      title,
      author: core?.creator,
      description: excerpt(content),
      content,
      contentExcerpt: excerpt(content),
      pageCount: slides.length,
      imageCount,
      headings,
      keywords: extractKeywords(content),
      metadata: { source: 'powerpoint', slides: slides.length, notes: notes.length, coreProps: core ?? {} },
    };
  }

  private runs(xml: string): string {
    // Join drawingML text runs; each <a:p> paragraph becomes a line.
    return xml
      .split(/<\/a:p>/)
      .map((p) => (p.match(/<a:t[^>]*>([^<]*)<\/a:t>/g) ?? []).map((r) => r.replace(/<[^>]+>/g, '')).join(' '))
      .filter((line) => line.trim())
      .join('\n');
  }
}
