'use client';

import dynamic from 'next/dynamic';
import type { DocumentPreviewDto } from '@tecpap/types';

const PdfViewer = dynamic(() => import('./pdf-viewer'), { ssr: false, loading: () => <div className="h-[75vh] animate-pulse rounded-md bg-muted" /> });
const WordViewer = dynamic(() => import('./word-viewer'), { ssr: false, loading: () => <div className="h-[75vh] animate-pulse rounded-md bg-muted" /> });
const ExcelViewer = dynamic(() => import('./excel-viewer'), { ssr: false, loading: () => <div className="h-[75vh] animate-pulse rounded-md bg-muted" /> });
const PowerPointViewer = dynamic(() => import('./powerpoint-viewer'), { ssr: false, loading: () => <div className="h-[75vh] animate-pulse rounded-md bg-muted" /> });
const CsvViewer = dynamic(() => import('./csv-viewer'), { ssr: false, loading: () => <div className="h-[75vh] animate-pulse rounded-md bg-muted" /> });
const TextViewer = dynamic(() => import('./text-viewer'), { ssr: false, loading: () => <div className="h-[75vh] animate-pulse rounded-md bg-muted" /> });
const ImageViewer = dynamic(() => import('./image-viewer'), { ssr: false, loading: () => <div className="h-[75vh] animate-pulse rounded-md bg-muted" /> });
const LegacyFallback = dynamic(() => import('./legacy-fallback'), { ssr: false, loading: () => <div className="h-[40vh] animate-pulse rounded-md bg-muted" /> });
const UnsupportedFallback = dynamic(() => import('./unsupported-fallback'), { ssr: false, loading: () => <div className="h-[40vh] animate-pulse rounded-md bg-muted" /> });

export function PreviewRouter({ preview, metadata }: { preview: DocumentPreviewDto; metadata: Record<string, unknown> }) {
  switch (preview.format) {
    case 'pdf': return <PdfViewer preview={preview} />;
    case 'word': return <WordViewer preview={preview} />;
    case 'excel': return <ExcelViewer preview={preview} />;
    case 'powerpoint': return <PowerPointViewer preview={preview} />;
    case 'csv': return <CsvViewer preview={preview} />;
    case 'text': return <TextViewer preview={preview} />;
    case 'image': return <ImageViewer preview={preview} />;
    case 'legacy': return <LegacyFallback preview={preview} metadata={metadata} />;
    default: return <UnsupportedFallback preview={preview} metadata={metadata} />;
  }
}
