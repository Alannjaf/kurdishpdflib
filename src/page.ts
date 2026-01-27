/**
 * Page: content stream buffer, drawText.
 * Uses embedded fonts + Unicode when provided; else built-in Helvetica.
 */

import type { PdfRef } from './pdf-writer.js';
import { PdfWriter, name } from './pdf-writer.js';
import type { FontMetrics } from './ttf/metrics.js';
import { toGlyphIdHex } from './encoding.js';

export interface DrawTextOptions {
  x: number;
  y: number;
  size?: number;
  font?: string; // e.g. "F1", "F2"
  color?: [number, number, number];
}

/**
 * One glyph from a shaper (e.g. HarfBuzz). Units are in font design space.
 * `unicode` is used for the ToUnicode CMap when provided.
 */
export interface ShapedGlyph {
  gid: number;
  xAdvance: number;
  yAdvance: number;
  xOffset?: number;
  yOffset?: number;
  unicode?: string;
}

export interface DrawShapedRunOptions {
  x: number;
  y: number;
  size?: number;
  font?: string; // e.g. "F1", "F2"
  /** 
   * If true, glyphs are reversed in the PDF stream to ensure logical copy-paste.
   * HarfBuzz returns RTL glyphs in visual order (left-to-right).
   */
  rtl?: boolean;
  color?: [number, number, number];
}

export interface DrawImageOptions {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DrawRectOptions {
  x: number;
  y: number;
  width: number;
  height: number;
  color?: [number, number, number]; // RGB 0-1 or 0-255? Let's say 0-1 for PDF standard, but 0-255 is friendlier.
  fill?: boolean;
  stroke?: boolean;
  strokeWidth?: number;
  strokeColor?: [number, number, number];
}

export interface DrawPathOptions {
  points: { x: number; y: number; type: 'M' | 'L' | 'C'; cp1?: {x:number, y:number}; cp2?: {x:number, y:number} }[];
  close?: boolean;
  fill?: boolean;
  stroke?: boolean;
  clip?: boolean;
  color?: [number, number, number];
  strokeColor?: [number, number, number];
  strokeWidth?: number;
}

export interface Page {
  drawText(text: string, options: DrawTextOptions): void;
  drawShapedRun(shaped: ShapedGlyph[], options: DrawShapedRunOptions): void;
  drawImage(imageRef: string, options: DrawImageOptions): void;
  drawRect(options: DrawRectOptions): void;
  drawPath(options: DrawPathOptions): void;
  saveGraphicsState(): void;
  restoreGraphicsState(): void;
  addImageResource(name: string, ref: PdfRef): void;
}

export interface FontInfo {
  fontRef: PdfRef;
  metrics?: FontMetrics;
  usedGidToUnicode?: [number, string][];
}

export interface CreatePageOptions {
  fonts?: Record<string, FontInfo>;
  images?: Record<string, PdfRef>;
}

const encoder = new TextEncoder();

function encodeStr(s: string): Uint8Array {
  return encoder.encode(s);
}

/**
 * Create a page, add Page dict + content stream to writer, update Pages /Kids and /Count.
 */
export function createPage(
  width: number,
  height: number,
  w: PdfWriter,
  pagesRef: PdfRef,
  pageRefs: PdfRef[],
  options: CreatePageOptions = {}
): Page {
  const { fonts = {}, images = {} } = options;
  const contentChunks: Uint8Array[] = [];
  const push = (s: string) => contentChunks.push(encodeStr(s));

  const fontDict: Record<string, unknown> = {};
  for (const [key, info] of Object.entries(fonts)) {
    fontDict[key] = info.fontRef;
  }
  
  const xObjectDict: Record<string, unknown> = {};
  for (const [key, ref] of Object.entries(images)) {
    xObjectDict[key] = ref;
  }

        // Default Helvetica if no fonts provided
        if (Object.keys(fontDict).length === 0) {
            fontDict.F1 = w.addDict({
                Type: name('Font'),
                Subtype: name('Type1'),
                BaseFont: name('Helvetica'),
            });
        }

  const pageDict = w.addDict({
    Type: name('Page'),
    Parent: pagesRef,
    MediaBox: [0, 0, width, height],
    Contents: null as unknown as PdfRef,
    Resources: { 
        Font: fontDict,
        XObject: xObjectDict
    },
  });

  const contentsRef = w.addStream({}, new Uint8Array(0));
  (w.refsMap.get(pageDict.id)!.dict as Record<string, unknown>).Contents = contentsRef;

  const pagesObj = w.refsMap.get(pagesRef.id)!;
  const kids = (pagesObj.dict as Record<string, unknown>).Kids as PdfRef[];
  kids.push(pageDict);
  (pagesObj.dict as Record<string, unknown>).Count = kids.length;
  pageRefs.push(pageDict);

  function drawText(text: string, opts: DrawTextOptions): void {
    const { x, y, size = 12, font = 'F1', color } = opts;
    const info = fonts[font];
    
    push('q ');
    if (color) {
        const [r, g, b] = color.map(c => c > 1 ? c / 255 : c);
        push(`${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} rg `);
    }
    push('BT ');
    push(`/${font} ${size} Tf ${x} ${y} Td `);
    
    if (info && info.metrics && info.usedGidToUnicode) {
      const gids: number[] = [];
      for (const char of text) {
        const cp = char.codePointAt(0)!;
        const gid = info.metrics.getGlyphIndex(cp);
        gids.push(gid);
        info.usedGidToUnicode.push([gid, char]);
      }
      push(toGlyphIdHex(gids) + ' Tj ET Q\n');
    } else {
      push('(' + escapePdfLiteral(text) + ') Tj ET Q\n');
    }
  }

  function drawRect(opts: DrawRectOptions): void {
      const { x, y, width, height, color, strokeColor, fill = true, stroke = false, strokeWidth = 1 } = opts;
      push('q\n');
      
      if (strokeWidth !== 1) {
          push(`${strokeWidth} w\n`);
      }
      
      if (color) {
          // Normalize 0-255 to 0-1
          const [r, g, b] = color.map(c => c > 1 ? c / 255 : c);
          push(`${r} ${g} ${b} rg\n`); // Non-stroking (fill) color
      }
      
      if (strokeColor) {
           const [r, g, b] = strokeColor.map(c => c > 1 ? c / 255 : c);
           push(`${r} ${g} ${b} RG\n`); // Stroking color
      }
      
      push(`${x} ${y} ${width} ${height} re\n`);
      
      if (fill && stroke) push('B\n');
      else if (fill) push('f\n');
      else if (stroke) push('S\n');
      
      push('Q\n');
  }

  function drawPath(opts: DrawPathOptions): void {
      const { points, close, fill = true, stroke = false, clip = false, color, strokeColor, strokeWidth = 1 } = opts;
      if (points.length === 0) return;

      push('q\n');
      
      if (strokeWidth !== 1) push(`${strokeWidth} w\n`);
      
      if (color) {
          const [r, g, b] = color.map(c => c > 1 ? c / 255 : c);
          push(`${r} ${g} ${b} rg\n`);
      }
      
      if (strokeColor) {
           const [r, g, b] = strokeColor.map(c => c > 1 ? c / 255 : c);
           push(`${r} ${g} ${b} RG\n`);
      }

      // Draw operations
      for (let i = 0; i < points.length; i++) {
          const p = points[i];
          const px = p.x.toFixed(6);
          const py = p.y.toFixed(6);
          if (p.type === 'M') {
              push(`${px} ${py} m\n`);
          } else if (p.type === 'L') {
              push(`${px} ${py} l\n`);
          } else if (p.type === 'C' && p.cp1 && p.cp2) {
              const cp1x = p.cp1.x.toFixed(6);
              const cp1y = p.cp1.y.toFixed(6);
              const cp2x = p.cp2.x.toFixed(6);
              const cp2y = p.cp2.y.toFixed(6);
              push(`${cp1x} ${cp1y} ${cp2x} ${cp2y} ${px} ${py} c\n`);
          }
      }

      if (close) push('h\n'); // close path

      if (clip) push('W n\n'); 
      else if (fill && stroke) push('B\n');
      else if (fill) push('f\n');
      else if (stroke) push('S\n');
      
      if (!clip) push('Q\n'); // If clipping, we DON'T close state here! User must call something to restore later or we rely on explicit Q.
      // Wait, that's messy. Let's make it more standard.
      // Actually, PDF clipping stays active until the state is popped.
  }

  function drawImage(imageRef: string, opts: DrawImageOptions): void {
      // PDF images are drawn in a 1x1 unit square at (0,0) by default.
      // We must scale and translate the CTM (Current Transformation Matrix).
      const { x, y, width, height } = opts;
      const refName = imageRef.startsWith('/') ? imageRef.substring(1) : imageRef;
      
      // If resource not in local dict but exists in images pass, we trust it or warn.
      // However, we need to ensure it IS in the resource dict.
      if (!xObjectDict[refName]) {
          // If we have global images map passed in options, check that
          if (images[refName]) {
              xObjectDict[refName] = images[refName];
          } else {
              console.warn(`Image reference ${refName} not found in page resources.`);
              // Proceed anyway, maybe it was added late via addImageResource?
          }
      }

      push('q\n');
      // Matrix: width 0 0 height x y
      // cm operator
      push(`${width} 0 0 ${height} ${x} ${y} cm\n`);
      push(`/${refName} Do\n`);
      push('Q\n');
  }

  function addImageResource(name: string, ref: PdfRef) {
      xObjectDict[name] = ref;
  }

  function saveGraphicsState() {
      push('q\n');
  }

  function restoreGraphicsState() {
      push('Q\n');
  }

  function drawShapedRun(shaped: ShapedGlyph[], opts: DrawShapedRunOptions): void {
    const { x, y, size = 12, font = 'F1', rtl = false, color } = opts;
    const info = fonts[font];
    
    if (!info || !info.metrics) {
      throw new Error(`drawShapedRun requires an embedded font for "${font}"`);
    }
    
    console.log(`DEBUG: Font ${font} UPM: ${info.metrics.unitsPerEm}, Size: ${size}, Scale: ${size / info.metrics.unitsPerEm}, Glyphs: ${shaped.length}`);
    console.log(`DEBUG: First few GIDs: ${shaped.slice(0, 5).map(g => g.gid).join(', ')}`);

    const scale = size / info.metrics.unitsPerEm;
    push('q ');
    
    if (color) {
        const [r, g, b] = color.map(c => c > 1 ? c / 255 : c);
        push(`${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} rg `);
    }
    
    push('BT ');
    push(`/${font} ${size} Tf `);
    
    // 1. Calculate absolute positions for all glyphs
    const glyphsWithPos = [];
    let cx = x;
    let cy = y;
    for (const g of shaped) {
      const xOff = (g.xOffset ?? 0) * scale;
      const yOff = (g.yOffset ?? 0) * scale;
      glyphsWithPos.push({ 
        g, 
        tx: cx + xOff, 
        ty: cy + yOff 
      });
      cx += scale * g.xAdvance;
      cy += scale * g.yAdvance;
    }

    // 2. Reverse order if RTL to ensure logical character stream for copy-paste
    if (rtl) {
      glyphsWithPos.reverse();
    }

    // 3. Write glyphs to stream
    for (const item of glyphsWithPos) {
      const { g, tx, ty } = item;
      // console.log(`DEBUG: GID ${g.gid} at ${tx}, ${ty}`);
      push(`1 0 0 1 ${tx.toFixed(3)} ${ty.toFixed(3)} Tm ${toGlyphIdHex([g.gid])} Tj `);
      
      if (g.unicode != null && info.usedGidToUnicode) {
        info.usedGidToUnicode.push([g.gid, g.unicode]);
      }
    }
    
    push('ET Q\n');
  }

  function escapePdfLiteral(s: string): string {
    return s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  }

  const page: Page = { drawText, drawShapedRun, drawRect, drawImage, drawPath, addImageResource, saveGraphicsState, restoreGraphicsState };

  const getContent = (): Uint8Array => {
    const total = contentChunks.reduce((acc, c) => acc + c.length, 0);
    const out = new Uint8Array(total);
    let pos = 0;
    for (const c of contentChunks) {
      out.set(c, pos);
      pos += c.length;
    }
    return out;
  };

  (page as { _getContent?: () => Uint8Array; _contentRef?: PdfRef })._getContent = getContent;
  (page as { _contentRef?: PdfRef })._contentRef = contentsRef;

  return page;
}

/**
 * Build final content stream and update the Contents stream object in the writer.
 */
export function finalizePageContent(page: Page, w: PdfWriter): void {
  const p = page as { _getContent?: () => Uint8Array; _contentRef?: PdfRef };
  const fn = p._getContent;
  const ref = p._contentRef;
  if (!fn || !ref) return;
  const body = fn();
  const obj = w.refsMap.get(ref.id);
  if (!obj || obj.kind !== 'stream') return;
  (obj as { stream?: Uint8Array }).stream = body;
  (obj.dict as Record<string, unknown>).Length = body.length;
}
