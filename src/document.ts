/**
 * PDF document: owns PdfWriter, builds Catalog / Info / Pages, adds pages.
 * Supports multiple embedded fonts for multi-script support.
 */

import type { PdfRef } from './pdf-writer.js';
import { PdfWriter, name } from './pdf-writer.js';
import { createPage, finalizePageContent, type Page, type FontInfo } from './page.js';
import { embedFont, type EmbeddedFont } from './ttf/embed.js';
import { buildToUnicodeCMapFromGidPairs, encodeToUnicodeStream } from './encoding.js';
import { parsePNG } from './png.js';
import { deflateSync } from 'node:zlib';

export interface FontConfig {
  fontBytes: Uint8Array;
  /** PostScript base font name (e.g. 'NotoSansArabic'). */
  baseFontName: string;
}

export interface CreateDocumentOptions {
  /** Map of font keys to font configurations (e.g. { F1: { fontBytes, baseFontName } }) */
  fonts?: Record<string, FontConfig>;
  /** Legacy single font support */
  fontBytes?: Uint8Array;
  baseFontName?: string;
}

export interface PDFDocument {
  addPage(width: number, height: number): Page;
  addImage(data: Uint8Array, type: 'jpeg' | 'png', width: number, height: number): string;
  getImageRef(id: string): PdfRef | undefined;
  save(): Uint8Array;
}

export function createDocument(opts: CreateDocumentOptions = {}): PDFDocument {
  const w = new PdfWriter();

  w.addDict({
    Type: name('Catalog'),
    Pages: null as unknown as PdfRef,
  });
  w.addDict({
    Producer: 'kurd-pdflib',
    CreationDate: datestamp(),
  });

  const pageRefs: PdfRef[] = [];
  const pagesRef = w.addDict({
    Type: name('Pages'),
    Kids: [] as PdfRef[],
    Count: 0,
  });

  (w.refsMap.get(1)!.dict as Record<string, unknown>).Pages = pagesRef;

  const pages: Page[] = [];
  const embeddedFonts: Record<string, EmbeddedFont & { usedGidToUnicode: [number, string][] }> = {};
  const embeddedImages: Record<string, PdfRef> = {};
  let imageCount = 0;

  // Handle fonts
  const fontConfigs = opts.fonts ?? {};
  if (opts.fontBytes) {
    fontConfigs.F1 = { fontBytes: opts.fontBytes, baseFontName: opts.baseFontName ?? 'NotoSans' };
  }

  for (const [key, config] of Object.entries(fontConfigs)) {
    const embedded = embedFont(w, config.fontBytes, config.baseFontName);
    embeddedFonts[key] = { ...embedded, usedGidToUnicode: [] };
  }

  return {
    addPage(width: number, height: number): Page {
      const fonts: Record<string, FontInfo> = {};
      for (const [key, val] of Object.entries(embeddedFonts)) {
        fonts[key] = {
          fontRef: val.fontRef,
          metrics: val.metrics,
          usedGidToUnicode: val.usedGidToUnicode,
        };
      }
      const page = createPage(width, height, w, pagesRef, pageRefs, { fonts, images: embeddedImages });
      pages.push(page);
      return page;
    },
    addImage(data: Uint8Array, type: 'jpeg' | 'png', width: number, height: number): string {
        imageCount++;
        const id = 'I' + imageCount;
        
        let ref: PdfRef;
        if (type === 'png') {
            const png = parsePNG(data);
            let smaskRef: PdfRef | undefined;
            
            if (png.alphaData) {
                // Add SMask image
                smaskRef = w.addStream({
                    Type: name('XObject'),
                    Subtype: name('Image'),
                    Width: png.width,
                    Height: png.height,
                    BitsPerComponent: 8,
                    ColorSpace: name('DeviceGray'),
                    Filter: name('FlateDecode'),
                }, deflateSync(png.alphaData));
            }
            
            ref = w.addImageXObject(deflateSync(png.pixelData), 'png', png.width, png.height, { smask: smaskRef });
        } else {
            ref = w.addImageXObject(data, type, width, height);
        }
        
        embeddedImages[id] = ref;
        return id;
    },
    getImageRef(id: string): PdfRef | undefined {
        return embeddedImages[id];
    },
    save(): Uint8Array {
      for (const p of pages) finalizePageContent(p, w);
      
      for (const embedded of Object.values(embeddedFonts)) {
        if (embedded.usedGidToUnicode.length > 0) {
          const cmap = buildToUnicodeCMapFromGidPairs(embedded.usedGidToUnicode);
          const streamRef = w.addStream({}, encodeToUnicodeStream(cmap));
          embedded.setToUnicode(streamRef);
        }
      }
      
      return w.build();
    },
  };
}

function datestamp(): string {
  const d = new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');
  const s =
    'D:' +
    d.getUTCFullYear() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    'Z';
  return s;
}
