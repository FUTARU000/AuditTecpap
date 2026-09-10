'use client';
import type { DocumentPreviewDto } from '@tecpap/types';

export default function PdfViewer({ preview }: { preview: DocumentPreviewDto }) {
  return (
    <iframe title={preview.title} src={preview.fileUrl} className="h-[80vh] w-full rounded-md border-0" />
  );
}
