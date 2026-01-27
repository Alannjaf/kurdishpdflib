/**
 * Embed TTF in PDF: Font, FontDescriptor, FontFile2, CIDFontType2, CIDToGIDMap.
 * Uses Type0 + Identity-H; we send Unicode (UTF-16BE) as character codes.
 */

import type { PdfRef, PdfWriter } from '../pdf-writer.js';
import { name } from '../pdf-writer.js';
import { parseTTF, type TTFParsed } from './parser.js';
import { createFontMetrics, type FontMetrics } from './metrics.js';

function readUInt16BE(b: Uint8Array, o: number): number {
  return (b[o]! << 8) | b[o + 1]!;
}
function readInt16BE(b: Uint8Array, o: number): number {
  const u = readUInt16BE(b, o);
  return u > 0x7fff ? u - 0x10000 : u;
}

export interface EmbeddedFont {
  fontRef: PdfRef;
  metrics: FontMetrics;
  setToUnicode(ref: PdfRef): void;
}

/**
 * Read ascent, descent, bbox from hhea and head.
 */
function readFontMetrics(parsed: TTFParsed): { ascent: number; descent: number; bbox: number[] } {
  const { data, tableOffsets } = parsed;
  const head = tableOffsets.get('head')!;
  const hhea = tableOffsets.get('hhea')!;
  const ascent = readInt16BE(data, hhea.offset + 4);
  const descent = readInt16BE(data, hhea.offset + 6);
  const xMin = readInt16BE(data, head.offset + 36);
  const yMin = readInt16BE(data, head.offset + 38);
  const xMax = readInt16BE(data, head.offset + 40);
  const yMax = readInt16BE(data, head.offset + 42);
  return { ascent, descent, bbox: [xMin, yMin, xMax, yMax] };
}

/**
 * Embed TTF: add Font (Type0), CIDFontType2, FontDescriptor, FontFile2, CIDToGIDMap.
 * baseFontName: PostScript-style name, e.g. "NotoSans".
 */
export function embedFont(
  w: PdfWriter,
  ttfBytes: Uint8Array,
  baseFontName: string
): EmbeddedFont {
  const parsed = parseTTF(ttfBytes);
  const metrics = createFontMetrics(parsed);
  const { ascent, descent, bbox } = readFontMetrics(parsed);
  console.log(`DEBUG: Font ${baseFontName} BBox: ${bbox.join(', ')} Ascent: ${ascent} Descent: ${descent}`);

  const fontFileRef = w.addStream({ Length1: ttfBytes.length }, ttfBytes);

  const baseFont = name(baseFontName);

  const fontDescriptorRef = w.addDict({
    Type: name('FontDescriptor'),
    FontName: baseFont,
    FontFile2: fontFileRef,
    Flags: 4,
    FontBBox: bbox,
    Ascent: ascent,
    Descent: descent,
    CapHeight: ascent,
    ItalicAngle: 0,
    StemV: 0,
  });

  // Build the /W (Widths) array for all glyphs
  const widths: number[] = [];
  for (let i = 0; i < metrics.numGlyphs; i++) {
    widths.push(metrics.getAdvanceWidth(i));
  }

  const cidFontRef = w.addDict({
    Type: name('Font'),
    Subtype: name('CIDFontType2'),
    BaseFont: baseFont,
    CIDSystemInfo: { Registry: 'Adobe', Ordering: 'Identity', Supplement: 0 },
    FontDescriptor: fontDescriptorRef,
    CIDToGIDMap: name('Identity'),
    W: [0, widths], // [start-index [width0 width1 ...]]
  });

  const fontRef = w.addDict({
    Type: name('Font'),
    Subtype: name('Type0'),
    BaseFont: baseFont,
    Encoding: name('Identity-H'),
    DescendantFonts: [cidFontRef],
    ToUnicode: null as unknown as PdfRef,
  });

  const fontDict = w.refsMap.get(fontRef.id)!.dict as Record<string, unknown>;

  return {
    fontRef,
    metrics,
    setToUnicode(ref: PdfRef) {
      fontDict.ToUnicode = ref;
    },
  };
}
