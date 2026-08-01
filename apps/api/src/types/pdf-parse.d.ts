declare module 'pdf-parse' {
  export interface PdfData {
    text: string;
    numpages: number;
    numrender: number;
    info: Record<string, unknown>;
    metadata: Record<string, unknown>;
    version: string;
  }
  const pdfParse: (data: Buffer, options?: Record<string, unknown>) => Promise<PdfData>;
  export default pdfParse;
}
