'use client';
import { useState } from 'react';
import { Download, Maximize2, Minus, Plus, RotateCcw } from 'lucide-react';
import type { DocumentPreviewDto } from '@tecpap/types';

export default function ImageViewer({ preview }: { preview: DocumentPreviewDto }) {
  const c = preview.content as { src?: string; alt?: string };
  const src = c.src ?? preview.fileUrl;
  const [zoom, setZoom] = useState(1);
  const [fullscreen, setFullscreen] = useState(false);

  return (
    <div className="flex max-h-[80vh] flex-col overflow-hidden rounded-md border border-border bg-card">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-border bg-muted/50 px-3 py-1.5">
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => setZoom((z) => Math.max(0.25, z - 0.25))} className="inline-flex size-7 items-center justify-center rounded-md hover:bg-accent" aria-label="Zoom out"><Minus className="size-4" /></button>
          <span className="min-w-12 text-center text-xs tabular-nums text-muted-foreground">{Math.round(zoom * 100)}%</span>
          <button type="button" onClick={() => setZoom((z) => Math.min(5, z + 0.25))} className="inline-flex size-7 items-center justify-center rounded-md hover:bg-accent" aria-label="Zoom in"><Plus className="size-4" /></button>
          <button type="button" onClick={() => setZoom(1)} className="inline-flex size-7 items-center justify-center rounded-md hover:bg-accent" aria-label="Reset zoom"><RotateCcw className="size-4" /></button>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => setFullscreen(true)} className="inline-flex size-7 items-center justify-center rounded-md hover:bg-accent" aria-label="Fullscreen"><Maximize2 className="size-4" /></button>
          <a href={src} download className="inline-flex size-7 items-center justify-center rounded-md hover:bg-accent" aria-label="Download"><Download className="size-4" /></a>
        </div>
      </div>

      {/* Image */}
      <div className="flex flex-1 items-center justify-center overflow-auto bg-[repeating-conic-gradient(hsl(var(--muted))_0%_25%,transparent_0%_50%)] bg-[length:20px_20px] p-4 scrollbar-thin">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={c.alt ?? preview.title} style={{ transform: `scale(${zoom})`, transition: 'transform 0.15s ease-out' }} className="max-w-none select-none" draggable={false} />
      </div>

      {/* Fullscreen overlay */}
      {fullscreen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setFullscreen(false)} role="dialog" aria-modal="true">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={c.alt ?? preview.title} className="max-h-full max-w-full object-contain" />
          <button type="button" className="absolute right-4 top-4 inline-flex size-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20" onClick={() => setFullscreen(false)} aria-label="Close fullscreen"><Maximize2 className="size-5 rotate-180" /></button>
        </div>
      ) : null}
    </div>
  );
}
