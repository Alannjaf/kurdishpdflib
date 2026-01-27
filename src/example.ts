/**
 * Example: create a PDF with shaped Arabic/Kurdish and Latin using multiple fonts.
 * Run: npm run build && node dist/example.js
 * Requires: npm install harfbuzzjs
 */

import { createDocument, type ShapedGlyph } from './index.js';
import { writeFileSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const arabicFontPath = join(__dirname, '..', 'assets', 'NotoSansArabic-Regular.ttf');
const latinFontPath = join(__dirname, '..', 'assets', 'NotoSans-Regular.ttf');
const outPath = join(__dirname, '..', 'out.pdf');

type Hb = {
  createBlob: (b: ArrayBuffer | Uint8Array) => { destroy: () => void };
  createFace: (blob: unknown, i: number) => { destroy: () => void };
  createFont: (face: unknown) => { destroy: () => void };
  createBuffer: () => {
    addText: (t: string) => void;
    setDirection: (d: string) => void;
    setScript: (s: string) => void;
    setLanguage: (l: string) => void;
    guessSegmentProperties: () => void;
    json: () => { g: number; cl: number; ax: number; ay: number; dx: number; dy: number }[];
    destroy: () => void;
  };
  shape: (font: unknown, buffer: unknown, features?: string) => void;
};

/**
 * Shape text with HarfBuzz. Returns ShapedGlyph[] for drawShapedRun.
 */
function shapeWithHarfBuzz(hb: Hb, fontBytes: Uint8Array, text: string): ShapedGlyph[] {
  const blob = hb.createBlob(fontBytes);
  const face = hb.createFace(blob, 0);
  const font = hb.createFont(face);
  const buffer = hb.createBuffer();
  
  buffer.addText(text);
  buffer.guessSegmentProperties();
  hb.shape(font, buffer);
  
  const arr = buffer.json();
  buffer.destroy();
  font.destroy();
  face.destroy();
  blob.destroy();

  // Find all unique cluster start points to determine character ranges
  const clusterStarts = Array.from(new Set(arr.map(g => g.cl))).sort((a, b) => a - b);

  return arr.map((g, i) => {
    // Determine which characters belong to this glyph's cluster.
    const clusterIdx = clusterStarts.indexOf(g.cl);
    const clusterEnd = (clusterIdx < clusterStarts.length - 1) 
      ? clusterStarts[clusterIdx + 1] 
      : text.length;
    
    // Distribution: only the first glyph representing a cluster gets the Unicode text.
    // This prevents duplicated text on copy-paste when one cluster results in multiple glyphs.
    const isFirstInCluster = !arr.slice(0, i).some(prev => prev.cl === g.cl);
    const unicode = isFirstInCluster ? text.substring(g.cl, clusterEnd) : "";

    return {
      gid: g.g,
      xAdvance: g.ax,
      yAdvance: g.ay,
      xOffset: g.dx,
      yOffset: g.dy,
      unicode,
    };
  });
}

async function main() {
  const hb = (await (await import('harfbuzzjs')).default) as Hb;

  const arabicBytes = new Uint8Array(readFileSync(arabicFontPath));
  const latinBytes = new Uint8Array(readFileSync(latinFontPath));
  
  // Create document with two fonts
  const doc = createDocument({
    fonts: {
      AR: { fontBytes: arabicBytes, baseFontName: 'NotoSansArabic' },
      EN: { fontBytes: latinBytes, baseFontName: 'NotoSans' },
    }
  });
  
  const page = doc.addPage(595, 842);

  // 1. English Header (using EN font)
  const sHeader = shapeWithHarfBuzz(hb, latinBytes, 'Kurdish & Arabic PDF Library');
  page.drawShapedRun(sHeader, { x: 72, y: 780, size: 24, font: 'EN' });

  // 2. Arabic/Kurdish (using AR font, with rtl: true)
  // We avoid mixing English characters inside the AR run because the AR font lacks them.
  const sArabic = shapeWithHarfBuzz(hb, arabicBytes, 'مرحبا');
  const sKurdish = shapeWithHarfBuzz(hb, arabicBytes, 'سڵاو ئالان');

  page.drawShapedRun(sArabic, { x: 72, y: 720, size: 40, font: 'AR', rtl: true });
  page.drawShapedRun(sKurdish, { x: 72, y: 660, size: 40, font: 'AR', rtl: true });

  // 3. Mixed demonstration using separate runs
  page.drawText('Mixing fonts on the same line:', { x: 72, y: 600, size: 14, font: 'EN' });
  
  // Drawing "Welcome (بەخێربێن)" by switching fonts
  page.drawText('Welcome (', { x: 72, y: 570, size: 16, font: 'EN' });
  
  const sWelcome = shapeWithHarfBuzz(hb, arabicBytes, 'بەخێربێن');
  // Position it after the parenthesis - moved from 135 to 155 to give more space
  page.drawShapedRun(sWelcome, { x: 155, y: 570, size: 16, font: 'AR', rtl: true });
  
  // Moved closing parenthesis from 215 to 235
  page.drawText(')', { x: 235, y: 570, size: 16, font: 'EN' });

  const pdf = doc.save();
  writeFileSync(outPath, pdf);
  console.log('Successfully wrote', outPath);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
