/**
 * kurd-pdflib: from-scratch PDF generation with Unicode support.
 * No external dependencies.
 */

export { createDocument } from './document.js';
export { KurdPDF, PageSizes, createPageHeader, createPageFooter, mm, cm, inches, toMm, toCm, toInches } from './kurd-pdf.js';
export { LayoutEngine } from './layout.js';
export { generateQRCode } from './qrcode.js';
export { generateCode128, generateEAN13 } from './barcode.js';
export type { PDFDocument, CreateDocumentOptions, EncryptionOptions, PDFPermissions } from './document.js';
export type { PageSizeName, Orientation, PageOptions, HeaderFooterOptions } from './kurd-pdf.js';
export type {
  Page,
  DrawTextOptions,
  DrawShapedRunOptions,
  ShapedGlyph,
} from './page.js';
export type { QRCodeOptions, QRCodeResult, ErrorCorrectionLevel } from './qrcode.js';
export type { BarcodeResult } from './barcode.js';
