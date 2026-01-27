/**
 * Font metrics: unicode -> glyph index, glyph -> advance width.
 * Uses parsed TTF (parser).
 */

import type { TTFParsed } from './parser.js';

export interface FontMetrics {
  getGlyphIndex(codePoint: number): number;
  getAdvanceWidth(glyphId: number): number;
  unitsPerEm: number;
  numGlyphs: number;
}

export function createFontMetrics(parsed: TTFParsed): FontMetrics {
  const { head, hmtx, cmap, maxp } = parsed;
  const numGlyphs = maxp.numGlyphs;
  return {
    getGlyphIndex(codePoint: number): number {
      return cmap.getGlyphIndex(codePoint);
    },
    getAdvanceWidth(glyphId: number): number {
      if (glyphId < 0 || glyphId >= numGlyphs) return 0;
      return hmtx.advanceWidth[glyphId] ?? 0;
    },
    get unitsPerEm() {
      return head.unitsPerEm;
    },
    get numGlyphs() {
      return numGlyphs;
    },
  };
}
