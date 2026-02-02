/**
 * Page: content stream buffer, drawText.
 */

import type { PdfRef } from './pdf-writer.js';
import { PdfWriter, name } from './pdf-writer.js';
import type { FontMetrics } from './ttf/metrics.js';
import { toGlyphIdHex } from './encoding.js';

export interface DrawTextOptions {
  x: number; y: number; size?: number; font?: string; color?: [number, number, number] | [number, number, number, number];
  wordSpacing?: number;
  letterSpacing?: number;
}

export interface ShapedGlyph {
  gid: number; xAdvance: number; yAdvance: number; xOffset?: number; yOffset?: number; unicode?: string;
}

export interface DrawShapedRunOptions {
  x: number; y: number; size?: number; font?: string; rtl?: boolean; color?: [number, number, number] | [number, number, number, number];
  wordSpacing?: number;
  letterSpacing?: number;
}

export interface DrawImageOptions {
  x: number; y: number; width: number; height: number;
}

export interface DrawRectOptions {
  x: number; y: number; width: number; height: number;
  color?: [number, number, number] | [number, number, number, number]; fill?: boolean; stroke?: boolean; strokeWidth?: number; strokeColor?: [number, number, number] | [number, number, number, number];
}

export interface DrawPathOptions {
  points: { x: number; y: number; type: 'M' | 'L' | 'C'; cp1?: {x:number, y:number}; cp2?: {x:number, y:number} }[];
  close?: boolean; fill?: boolean; stroke?: boolean; clip?: boolean;
  color?: [number, number, number] | [number, number, number, number]; strokeColor?: [number, number, number] | [number, number, number, number]; strokeWidth?: number;
}

export interface Page {
  drawText(text: string, options: DrawTextOptions): void;
  drawShapedRun(shaped: ShapedGlyph[], options: DrawShapedRunOptions): void;
  drawImage(imageRef: string, options: DrawImageOptions): void;
  drawRect(options: DrawRectOptions): void;
  drawPath(options: DrawPathOptions): void;
  addLink(url: string, x: number, y: number, width: number, height: number): void;
  addInternalLink(targetPageIdx: number, x: number, y: number, width: number, height: number): void;
  saveGraphicsState(): void;
  restoreGraphicsState(): void;
  clip(): void;
  setOpacity(refName: string): void;
  drawShading(refName: string): void;
  addImageResource(name: string, ref: PdfRef): void;
  addExtGStateResource(name: string, ref: PdfRef): void;
  addShadingResource(name: string, ref: PdfRef): void;
}

/** Internal page interface with methods used by the document system */
export interface PageInternal extends Page {
  _finalizeInternalLinks(pageRefs: PdfRef[]): void;
  _getContent(): Uint8Array;
  _contentRef: PdfRef;
}

export interface FontInfo { fontRef: PdfRef; metrics?: FontMetrics; usedGidToUnicode?: [number, string][]; }

export interface CreatePageOptions { fonts?: Record<string, FontInfo>; images?: Record<string, PdfRef>; extGStates?: Record<string, PdfRef>; shading?: Record<string, PdfRef>; }

const encoder = new TextEncoder();
function encodeStr(s: string): Uint8Array { return encoder.encode(s); }

export function createPage(width: number, height: number, w: PdfWriter, pagesRef: PdfRef, pageRefs: PdfRef[], options: CreatePageOptions = {}): PageInternal {
  const { fonts = {}, images = {}, extGStates = {}, shading = {} } = options;
  const contentChunks: Uint8Array[] = [];
  const push = (s: string) => contentChunks.push(encodeStr(s));
  const annotations: PdfRef[] = [];
  const internalLinks: { annotRef: PdfRef, targetIdx: number }[] = [];

  const fontDict: Record<string, unknown> = {};
  for (const [key, info] of Object.entries(fonts)) fontDict[key] = info.fontRef;
  const xObjectDict: Record<string, unknown> = {};
  for (const [key, ref] of Object.entries(images)) xObjectDict[key] = ref;
  const extGStateDict: Record<string, unknown> = {};
  for (const [key, ref] of Object.entries(extGStates)) extGStateDict[key] = ref;
  const shadingDict: Record<string, unknown> = {};
  for (const [key, ref] of Object.entries(shading)) shadingDict[key] = ref;

  if (Object.keys(fontDict).length === 0) {
    fontDict.F1 = w.addDict({ Type: name('Font'), Subtype: name('Type1'), BaseFont: name('Helvetica') });
  }

  const pageDict = w.addDict({
    Type: name('Page'), Parent: pagesRef, MediaBox: [0, 0, width, height],
    Contents: null as unknown as PdfRef,
    Resources: { Font: fontDict, XObject: xObjectDict, ExtGState: extGStateDict, Shading: shadingDict },
    Annots: annotations,
  });

  const contentsRef = w.addStream({}, new Uint8Array(0));
  (w.refsMap.get(pageDict.id)!.dict as Record<string, unknown>).Contents = contentsRef;

  const pagesObj = w.refsMap.get(pagesRef.id)!;
  const kids = (pagesObj.dict as Record<string, unknown>).Kids as PdfRef[];
  kids.push(pageDict);
  (pagesObj.dict as Record<string, unknown>).Count = kids.length;
  pageRefs.push(pageDict);

  function addLink(url: string, x: number, y: number, width: number, height: number): void {
      const annotRef = w.addDict({
          Type: name('Annot'),
          Subtype: name('Link'),
          Rect: [x, y, x + width, y + height],
          Border: [0, 0, 0], // Invisible border
          A: {
              Type: name('Action'),
              S: name('URI'),
              URI: url,
          },
      });
      annotations.push(annotRef);
  }

  function addInternalLink(targetIdx: number, x: number, y: number, width: number, height: number): void {
      const annotRef = w.addDict({
          Type: name('Annot'),
          Subtype: name('Link'),
          Rect: [x, y, x + width, y + height],
          Border: [0, 0, 0],
          Dest: null as any, // Resolved later
      });
      annotations.push(annotRef);
      internalLinks.push({ annotRef, targetIdx });
  }

  function drawText(text: string, opts: DrawTextOptions): void {
    const { x, y, size = 12, font = 'F1', color, wordSpacing, letterSpacing } = opts;
    const info = fonts[font];
    push('q ');
    if (color) {
        if (color.length === 4) {
            const [c, m, y, k] = color.map(val => val > 1 ? val / 100 : val);
            push(`${c.toFixed(3)} ${m.toFixed(3)} ${y.toFixed(3)} ${k.toFixed(3)} k `);
        } else {
            const [r, g, b] = color.map(c => c > 1 ? c / 255 : c);
            push(`${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} rg `);
        }
    }
    if (wordSpacing) push(`${wordSpacing} Tw `);
    if (letterSpacing) push(`${letterSpacing} Tc `);

    push('BT ');
    push(`/${font} ${size} Tf ${x} ${y} Td `);
    if (info && info.metrics && info.usedGidToUnicode) {
      const gids: number[] = [];
      for (const char of text) {
        const gid = info.metrics.getGlyphIndex(char.codePointAt(0)!);
        gids.push(gid);
        info.usedGidToUnicode.push([gid, char]);
      }
      push(toGlyphIdHex(gids) + ' Tj ET Q\n');
    } else {
      push('(' + text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)') + ') Tj ET Q\n');
    }
  }

  function drawRect(opts: DrawRectOptions): void {
      const { x, y, width, height, color, fill = true, stroke = false, strokeWidth = 1, strokeColor } = opts;
      push('q\n');
      if (strokeWidth !== 1) push(`${strokeWidth} w\n`);
      if (color) { 
          if (color.length === 4) {
              const [c, m, y, k] = color.map(val => val > 1 ? val / 100 : val);
              push(`${c} ${m} ${y} ${k} k\n`);
          } else {
              const [r, g, b] = color.map(c => c > 1 ? c / 255 : c); 
              push(`${r} ${g} ${b} rg\n`); 
          }
      }
      if (strokeColor) { 
          if (strokeColor.length === 4) {
              const [c, m, y, k] = strokeColor.map(val => val > 1 ? val / 100 : val);
              push(`${c} ${m} ${y} ${k} K\n`);
          } else {
              const [r, g, b] = strokeColor.map(c => c > 1 ? c / 255 : c); 
              push(`${r} ${g} ${b} RG\n`); 
          }
      }
      push(`${x} ${y} ${width} ${height} re\n`);
      if (fill && stroke) push('B\n'); else if (fill) push('f\n'); else if (stroke) push('S\n');
      push('Q\n');
  }

  function drawPath(opts: DrawPathOptions): void {
      const { points, close, fill = true, stroke = false, clip = false, color, strokeColor, strokeWidth = 1 } = opts;
      if (points.length === 0) return;
      
      if (!clip) push('q\n'); 
      
      if (strokeWidth !== 1) push(`${strokeWidth} w\n`);
      if (color) { 
          if (color.length === 4) {
              const [c, m, y, k] = color.map(val => val > 1 ? val / 100 : val);
              push(`${c} ${m} ${y} ${k} k\n`);
          } else {
              const [r, g, b] = color.map(c => c > 1 ? c / 255 : c); 
              push(`${r} ${g} ${b} rg\n`); 
          }
      }
      if (strokeColor) { 
          if (strokeColor.length === 4) {
              const [c, m, y, k] = strokeColor.map(val => val > 1 ? val / 100 : val);
              push(`${c} ${m} ${y} ${k} K\n`);
          } else {
              const [r, g, b] = strokeColor.map(c => c > 1 ? c / 255 : c); 
              push(`${r} ${g} ${b} RG\n`); 
          }
      }
      
      for (const p of points) {
          const px = p.x.toFixed(6), py = p.y.toFixed(6);
          if (p.type === 'M') push(`${px} ${py} m\n`);
          else if (p.type === 'L') push(`${px} ${py} l\n`);
          else if (p.type === 'C' && p.cp1 && p.cp2) push(`${p.cp1.x.toFixed(6)} ${p.cp1.y.toFixed(6)} ${p.cp2.x.toFixed(6)} ${p.cp2.y.toFixed(6)} ${px} ${py} c\n`);
      }
      
      if (close) push('h\n');
      
      if (clip) {
          push('W n\n'); // Set clip but DON'T Q
      } else {
          if (fill && stroke) push('B\n'); 
          else if (fill) push('f\n'); 
          else if (stroke) push('S\n');
          push('Q\n');
      }
  }

  function drawImage(imageRef: string, opts: DrawImageOptions): void {
      const { x, y, width, height } = opts;
      const refName = imageRef.startsWith('/') ? imageRef.substring(1) : imageRef;
      push('q\n');
      push(`${width} 0 0 ${height} ${x} ${y} cm\n`);
      push(`/${refName} Do\n`);
      push('Q\n');
  }

  const page: Page = {
      drawText, drawRect, drawImage, drawPath, addLink, addInternalLink, addImageResource: (n, r) => { xObjectDict[n] = r; },
      addExtGStateResource: (n, r) => { extGStateDict[n] = r; },
      addShadingResource: (n, r) => { shadingDict[n] = r; },
      saveGraphicsState: () => push('q\n'), restoreGraphicsState: () => push('Q\n'), clip: () => push('W n\n'),
      setOpacity: (refName) => {
          push(`/${refName} gs\n`);
      },
      drawShading: (refName) => {
          push(`/${refName} sh\n`);
      },
      drawShapedRun: (shaped, opts) => {
          const { x, y, size = 12, font = 'F1', rtl = false, color, wordSpacing = 0, letterSpacing = 0 } = opts;
          const info = fonts[font];
          if (!info || !info.metrics) return;
          const scale = size / info.metrics.unitsPerEm;
          push('q ');
          if (color) { 
              if (color.length === 4) {
                  const [c, m, y, k] = color.map(val => val > 1 ? val / 100 : val);
                  push(`${c.toFixed(3)} ${m.toFixed(3)} ${y.toFixed(3)} ${k.toFixed(3)} k `);
              } else {
                  const [r, g, b] = color.map(c => c > 1 ? c / 255 : c); 
                  push(`${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} rg `); 
              }
          }
          push('BT ');
          push(`/${font} ${size} Tf `);
          let cx = x, cy = y;
          const glyphsWithPos = shaped.map(g => {
              const tx = cx + (g.xOffset ?? 0) * scale, ty = cy + (g.yOffset ?? 0) * scale;
              // Apply letter spacing to advance
              cx += (scale * g.xAdvance) + letterSpacing; 
              cy += scale * g.yAdvance;
              
              // Apply word spacing if this glyph represents a space
              if (g.unicode === ' ') {
                  cx += wordSpacing;
              }
              
              return { g, tx, ty };
          });
          
          for (const item of glyphsWithPos) {
              push(`1 0 0 1 ${item.tx.toFixed(3)} ${item.ty.toFixed(3)} Tm ${toGlyphIdHex([item.g.gid])} Tj `);
              if (item.g.unicode != null && info.usedGidToUnicode) info.usedGidToUnicode.push([item.g.gid, item.g.unicode]);
          }
          push('ET Q\n');
      }
  };

  const pageInternal: PageInternal = {
      ...page,
      _finalizeInternalLinks: (pRefs: PdfRef[]) => {
          for (const link of internalLinks) {
              const obj = w.refsMap.get(link.annotRef.id);
              if (obj && obj.dict && pRefs[link.targetIdx]) {
                  obj.dict.Dest = [pRefs[link.targetIdx], name('Fit')];
              }
          }
      },
      _getContent: () => {
          const total = contentChunks.reduce((acc, c) => acc + c.length, 0);
          const out = new Uint8Array(total);
          let pos = 0;
          for (const c of contentChunks) { out.set(c, pos); pos += c.length; }
          return out;
      },
      _contentRef: contentsRef
  };

  return pageInternal;
}

import { deflate } from 'pako';

export function finalizePageContent(page: Page | PageInternal, w: PdfWriter): void {
  // Check if page has internal methods
  const p = page as PageInternal;
  if (!p._getContent || !p._contentRef) return;
  const body = p._getContent();
  const obj = w.refsMap.get(p._contentRef.id);
  if (!obj || obj.kind !== 'stream') return;

  // Check if the stream was intended to be compressed
  if (obj.dict && (obj.dict.Filter as any)?.__pdfName === 'FlateDecode') {
      const compressed = deflate(body);
      (obj as any).stream = compressed;
      (obj.dict as any).Length = compressed.length;
  } else {
      (obj as any).stream = body;
      (obj.dict as any).Length = body.length;
  }
}
