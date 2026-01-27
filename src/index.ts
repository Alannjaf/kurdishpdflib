/**
 * kurd-pdflib: from-scratch PDF generation with Unicode support.
 * No external dependencies.
 */

export { createDocument } from './document.js';
export { KurdPDF } from './kurd-pdf.js';
export type { PDFDocument, CreateDocumentOptions } from './document.js';
export type {
  Page,
  DrawTextOptions,
  DrawShapedRunOptions,
  ShapedGlyph,
} from './page.js';
