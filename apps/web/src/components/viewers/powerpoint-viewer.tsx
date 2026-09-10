'use client';
import { useEffect, useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, ImageIcon, MessageSquare, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import type { DocumentPreviewDto } from '@tecpap/types';

interface SlideBullet { text: string; level: number }
interface SlideImage { filename: string; mimeType: string; dataUrl: string }
interface SlideData {
  index: number;
  title: string;
  subtitle?: string;
  bullets: SlideBullet[];
  notes: string;
  images: SlideImage[];
  omittedObjects: string[];
}

const BULLET_STYLES: Record<number, { bullet: string; indent: string; size: string }> = {
  0: { bullet: '●', indent: 'ml-0', size: 'text-base' },
  1: { bullet: '○', indent: 'ml-6', size: 'text-sm' },
  2: { bullet: '▪', indent: 'ml-12', size: 'text-sm' },
  3: { bullet: '·', indent: 'ml-16', size: 'text-xs' },
  4: { bullet: '·', indent: 'ml-20', size: 'text-xs' },
};

export default function PowerPointViewer({ preview }: { preview: DocumentPreviewDto }) {
  const c = preview.content as { slides?: SlideData[]; text?: string; pages?: number; imageCount?: number };
  const slides = c.slides ?? [];
  const [current, setCurrent] = useState(0);
  const [notesOpen, setNotesOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'ArrowRight') setCurrent((i) => Math.min(i + 1, slides.length - 1));
      if (e.key === 'ArrowLeft') setCurrent((i) => Math.max(i - 1, 0));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [slides.length]);

  const stats = useMemo(() => {
    const data = c.slides ?? [];
    const withNotes = data.filter((s) => s.notes?.trim()).length;
    const totalImages = data.reduce((sum, s) => sum + s.images.length, 0);
    const totalOmitted = data.reduce((sum, s) => sum + s.omittedObjects.length, 0);
    return { slides: data.length, notes: withNotes, images: totalImages, omitted: totalOmitted };
  }, [c.slides]);

  if (slides.length === 0) {
    return <div className="max-h-[80vh] overflow-y-auto rounded-md border border-border bg-card p-8 text-sm text-muted-foreground">{c.text || 'No slide data available'}</div>;
  }

  const slide = slides[Math.min(current, slides.length - 1)]!;
  const bs = (level: number) => BULLET_STYLES[level] ?? BULLET_STYLES[4]!;

  return (
    <div className="flex max-h-[80vh] flex-col gap-2 overflow-hidden">
      {/* Metadata bar */}
      <div className="flex flex-wrap items-center gap-4 rounded-md border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">{stats.slides} slides</span>
        {stats.images > 0 ? <span className="inline-flex items-center gap-1"><ImageIcon className="size-3" /> {stats.images} images</span> : null}
        {stats.notes > 0 ? <span className="inline-flex items-center gap-1"><MessageSquare className="size-3" /> {stats.notes} with notes</span> : null}
        {stats.omitted > 0 ? <span className="inline-flex items-center gap-1 text-warning-fg"><AlertCircle className="size-3" /> {stats.omitted} objects omitted</span> : null}
      </div>

      <div className="flex min-h-0 flex-1 gap-3 overflow-hidden">
        {/* Slide list (thumbnails) */}
        <div className="hidden w-48 shrink-0 space-y-1.5 overflow-y-auto border-r border-border pr-2 scrollbar-thin md:block">
          {slides.map((s, i) => (
            <button key={s.index} type="button" onClick={() => setCurrent(i)} className={`flex w-full flex-col gap-1 rounded-md border p-2 text-left transition-colors ${i === current ? 'border-primary bg-primary/5' : 'border-border hover:bg-accent'}`}>
              {/* Mini thumbnail */}
              <div className={`flex aspect-video items-center justify-center rounded ${i === current ? 'bg-primary/10' : 'bg-muted/40'}`}>
                {s.images.length > 0 ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.images[0]!.dataUrl} alt="" className="max-h-full max-w-full object-contain" />
                ) : (
                  <span className="truncate px-1 text-[10px] font-medium text-muted-foreground">{s.title.slice(0, 30)}</span>
                )}
              </div>
              <span className={`truncate text-[10px] ${i === current ? 'font-semibold text-primary' : 'text-muted-foreground'}`}>{i + 1}. {s.title.slice(0, 25)}</span>
            </button>
          ))}
        </div>

        {/* Main stage */}
        <div className="flex min-w-0 flex-1 flex-col" role="region" aria-label={`Slide ${current + 1} of ${slides.length}`}>
          <div className="flex flex-1 items-center justify-center overflow-hidden rounded-lg bg-neutral-100 p-4">
            {/* 16:9 slide card */}
            <div className="aspect-video w-full max-w-3xl overflow-y-auto rounded-lg bg-white p-10 shadow-xl scrollbar-thin">
              {/* Title */}
              <h2 className="mb-2 text-2xl font-bold leading-tight" style={{ color: '#111827' }}>{slide.title}</h2>
              {/* Subtitle */}
              {slide.subtitle ? <p className="mb-4 text-base" style={{ color: '#6b7280' }}>{slide.subtitle}</p> : null}
              {/* Divider */}
              {(slide.subtitle || slide.bullets.length > 0 || slide.images.length > 0) && slide.title ? <div className="mb-4 border-t" style={{ borderColor: '#e5e7eb' }} /> : null}
              {/* Bullets with hierarchy */}
              {slide.bullets.length > 0 ? (
                <div className="space-y-2">
                  {slide.bullets.map((b, i) => {
                    const s = bs(b.level);
                    return (
                      <div key={i} className={`flex items-start gap-2 ${s.indent}`}>
                        <span className="mt-1 shrink-0 select-none" style={{ color: b.level === 0 ? '#3b82f6' : '#9ca3af', fontSize: b.level === 0 ? '10px' : '12px' }}>{s.bullet}</span>
                        <span className={`leading-relaxed ${s.size}`} style={{ color: b.level === 0 ? '#1f2937' : '#4b5563' }}>{b.text}</span>
                      </div>
                    );
                  })}
                </div>
              ) : null}
              {/* Images gallery */}
              {slide.images.length > 0 ? (
                <div className={`mt-5 grid gap-3 ${slide.images.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                  {slide.images.map((img, i) => (
                    <div key={i} className="overflow-hidden rounded-lg border" style={{ borderColor: '#e5e7eb' }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img.dataUrl} alt={img.filename} className="w-full object-contain" />
                    </div>
                  ))}
                </div>
              ) : null}
              {/* Omitted objects */}
              {slide.omittedObjects.length > 0 ? (
                <div className="mt-5 space-y-1">
                  {slide.omittedObjects.map((obj, i) => (
                    <div key={i} className="flex items-center gap-2 rounded-md border border-dashed px-3 py-2 text-xs" style={{ borderColor: '#d1d5db', color: '#6b7280', background: '#f9fafb' }}>
                      <AlertCircle className="size-3 shrink-0" />
                      <span><strong style={{ color: '#4b5563' }}>{obj}</strong> omitted — cannot render in browser viewer</span>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          {/* Collapsible Speaker Notes */}
          {slide.notes ? (
            <div className="mt-1.5">
              <button type="button" onClick={() => setNotesOpen((o) => !o)} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground">
                {notesOpen ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />} Speaker Notes
              </button>
              {notesOpen ? <p className="mt-1 max-h-32 overflow-y-auto rounded-md bg-muted/40 p-3 text-xs text-muted-foreground scrollbar-thin">{slide.notes}</p> : null}
            </div>
          ) : null}

          {/* Navigation */}
          <div className="mt-1.5 flex items-center justify-center gap-4">
            <button type="button" onClick={() => setCurrent((i) => Math.max(i - 1, 0))} disabled={current === 0} className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1 text-xs hover:bg-accent disabled:opacity-30" aria-label="Previous slide">
              <ChevronLeft className="size-4" /> Prev
            </button>
            <span className="text-xs font-medium tabular-nums text-muted-foreground" aria-live="polite">Slide {current + 1} / {slides.length}</span>
            <button type="button" onClick={() => setCurrent((i) => Math.min(i + 1, slides.length - 1))} disabled={current === slides.length - 1} className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1 text-xs hover:bg-accent disabled:opacity-30" aria-label="Next slide">
              Next <ChevronRight className="size-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
