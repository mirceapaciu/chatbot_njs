declare module 'pdf-parse/lib/pdf-parse.js' {
  type PDFParseResult = {
    text?: string;
    numpages?: number;
    numrender?: number;
    info?: unknown;
    metadata?: unknown;
    version?: string;
  };

  const pdfParse: (data: Buffer | Uint8Array, options?: unknown) => Promise<PDFParseResult>;
  export default pdfParse;
}
