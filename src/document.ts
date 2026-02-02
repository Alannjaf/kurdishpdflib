/**
 * PDF document: owns PdfWriter, builds Catalog / Info / Pages, adds pages.
 * Supports multiple embedded fonts for multi-script support.
 */

import type { PdfRef } from './pdf-writer.js';
import { PdfWriter, name } from './pdf-writer.js';
import { createPage, finalizePageContent, type Page, type PageInternal, type FontInfo } from './page.js';
import { embedFont, type EmbeddedFont } from './ttf/embed.js';
import { buildToUnicodeCMapFromGidPairs, encodeToUnicodeStream } from './encoding.js';
import { parsePNG } from './png.js';
import { deflateSync } from 'node:zlib';
import {
  initEncryption,
  generateFileId,
  type EncryptionOptions,
  type PDFPermissions,
  type EncryptionState
} from './encryption.js';

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
  /** Metadata */
  title?: string;
  author?: string;
  subject?: string;
  /** Encryption options */
  encryption?: EncryptionOptions;
}

export type { EncryptionOptions, PDFPermissions };

export interface PDFDocument {
  addPage(width: number, height: number): Page;
  addImage(data: Uint8Array, type: 'jpeg' | 'png', width: number, height: number): string;
  getImageRef(id: string): PdfRef | undefined;
  getOpacityGState(opacity: number): { name: string, ref: PdfRef };
  addShading(colors: { offset: number, color: [number, number, number] }[], coords: [number, number, number, number]): { name: string, ref: PdfRef };
  addRadialShading(colors: { offset: number, color: [number, number, number] }[], coords: [number, number, number, number, number, number]): { name: string, ref: PdfRef };
  setMetadata(key: string, value: string): void;
  addOutline(title: string, pageIdx: number): void;
  save(): Uint8Array;
}

export function createDocument(opts: CreateDocumentOptions = {}): PDFDocument {
  const w = new PdfWriter();

  // Generate file ID (needed for encryption and recommended for all PDFs)
  const fileId = generateFileId();

  // Initialize encryption if options provided
  let encryptionState: EncryptionState | null = null;
  if (opts.encryption) {
    encryptionState = initEncryption(opts.encryption, fileId);
    w.setEncryption(encryptionState, fileId);
  }

  w.addDict({
    Type: name('Catalog'),
    Pages: null as unknown as PdfRef,
    Outlines: null as unknown as PdfRef,
  });
  const infoRef = w.addDict({
    Producer: 'kurd-pdflib',
    CreationDate: datestamp(),
    Title: opts.title ?? '',
    Author: opts.author ?? '',
    Subject: opts.subject ?? '',
  });

  const pageRefs: PdfRef[] = [];
  const pagesRef = w.addDict({
    Type: name('Pages'),
    Kids: [] as PdfRef[],
    Count: 0,
  });

  const catalog = w.refsMap.get(1)!.dict as Record<string, unknown>;
  catalog.Pages = pagesRef;

  const outlines: { title: string, pageIdx: number }[] = [];

  const pages: PageInternal[] = [];
  const embeddedFonts: Record<string, EmbeddedFont & { usedGidToUnicode: [number, string][] }> = {};
  const embeddedImages: Record<string, PdfRef> = {};
  const extGStates: Record<string, PdfRef> = {};
  const shadingRefs: Record<string, PdfRef> = {};
  let imageCount = 0;
  let gsCount = 0;
  let shadingCount = 0;

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
      const page = createPage(width, height, w, pagesRef, pageRefs, { fonts, images: embeddedImages, extGStates, shading: shadingRefs });
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
    getOpacityGState(opacity: number): { name: string, ref: PdfRef } {
        const key = 'GS' + Math.round(opacity * 100);
        if (!extGStates[key]) {
            gsCount++;
            const ref = w.addExtGState(opacity);
            extGStates[key] = ref;
        }
        return { name: key, ref: extGStates[key] };
    },
    addShading(colors: { offset: number, color: [number, number, number] }[], coords: [number, number, number, number]): { name: string, ref: PdfRef } {
        shadingCount++;
        const id = 'SH' + shadingCount;
        const ref = w.addAxialShading(colors, coords);
        shadingRefs[id] = ref;
        return { name: id, ref };
    },
    addRadialShading(colors: { offset: number, color: [number, number, number] }[], coords: [number, number, number, number, number, number]): { name: string, ref: PdfRef } {
        shadingCount++;
        const id = 'SH' + shadingCount;
        const ref = w.addRadialShading(colors, coords);
        shadingRefs[id] = ref;
        return { name: id, ref };
    },
    setMetadata(key: string, value: string): void {
        const dict = w.refsMap.get(infoRef.id)!.dict as Record<string, unknown>;
        dict[key] = value;
    },
    addOutline(title: string, pageIdx: number): void {
        outlines.push({ title, pageIdx });
    },
    save(): Uint8Array {
      for (const p of pages) {
          finalizePageContent(p, w);
          p._finalizeInternalLinks(pageRefs);
      }

      // Handle Outlines (Bookmarks)
      if (outlines.length > 0) {
          const rootOutlineRef = w.allocId();
          const firstOutlineRef = w.allocId();
          const lastOutlineRef = w.allocId();

          const outlineRefs: PdfRef[] = outlines.map(() => ({ id: w.allocId(), gen: 0 }));

          for (let i = 0; i < outlines.length; i++) {
              const item = outlines[i];
              const currentRef = outlineRefs[i];
              const dict: any = {
                  Title: item.title,
                  Parent: { id: rootOutlineRef, gen: 0 },
                  Dest: [pageRefs[item.pageIdx], name('Fit')],
              };
              if (i > 0) dict.Prev = outlineRefs[i - 1];
              if (i < outlines.length - 1) dict.Next = outlineRefs[i + 1];

              w.objectsList.push({ id: currentRef.id, gen: 0, kind: 'dict', dict });
              w.refsMap.set(currentRef.id, w.objectsList[w.objectsList.length - 1]);
          }

          const rootOutlineDict = {
              Type: name('Outlines'),
              First: outlineRefs[0],
              Last: outlineRefs[outlineRefs.length - 1],
              Count: outlines.length,
          };
          w.objectsList.push({ id: rootOutlineRef, gen: 0, kind: 'dict', dict: rootOutlineDict });
          w.refsMap.set(rootOutlineRef, w.objectsList[w.objectsList.length - 1]);
          
          catalog.Outlines = { id: rootOutlineRef, gen: 0 };
      }
      
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
