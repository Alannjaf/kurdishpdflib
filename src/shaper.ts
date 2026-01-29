import type { ShapedGlyph } from './page.js';

// We define a subset of the HarfBuzz interface we use
export type Hb = {
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

export interface ShapedFont {
  blob: { destroy: () => void };
  face: { destroy: () => void; upem?: number; getUpem?: () => number };
  font: { destroy: () => void };
  upem: number;
}

export class TextShaper {
  private hb: Hb;

  constructor(hbInstance: Hb) {
    this.hb = hbInstance;
  }

  initFont(fontBytes: Uint8Array): ShapedFont {
    const blob = this.hb.createBlob(fontBytes);
    const face = this.hb.createFace(blob, 0) as any;
    const font = this.hb.createFont(face);
    
    let upem = 1000;
    if ('upem' in face) {
        upem = face.upem;
    } else if ('getUpem' in face) {
        upem = face.getUpem();
    }

    return { blob, face, font, upem };
  }

  destroyFont(sf: ShapedFont) {
    sf.font.destroy();
    sf.face.destroy();
    sf.blob.destroy();
  }

  getGlyphIndex(sf: ShapedFont, code: number): number {
      const buffer = this.hb.createBuffer();
      
      buffer.addText(String.fromCodePoint(code));
      buffer.guessSegmentProperties();
      this.hb.shape(sf.font, buffer);
      
      const arr = buffer.json();
      const gid = arr.length > 0 ? arr[0].g : 0;

      buffer.destroy();
      return gid;
  }

  shape(sf: ShapedFont, text: string, options: { rtl?: boolean } = {}): ShapedGlyph[] {
    const buffer = this.hb.createBuffer();
    
    buffer.addText(text);
    if (options.rtl) {
      buffer.setDirection('rtl');
    } else {
      buffer.setDirection('ltr');
    }
    buffer.guessSegmentProperties();
    
    this.hb.shape(sf.font, buffer);
    const arr = buffer.json();
    
    // Cleanup
    buffer.destroy();

    // Reconstruct glyphs with mapping to original unicode for PDF extraction
    const clusterStarts = Array.from(new Set(arr.map(g => g.cl))).sort((a, b) => a - b);
    
    return arr.map((g, i) => {
      // Logic to attach the correct unicode char to the first glyph of a cluster
      const isFirstInCluster = !arr.slice(0, i).some(prev => prev.cl === g.cl);
      
      let unicode = "";
      if (isFirstInCluster) {
          const clusterIdx = clusterStarts.indexOf(g.cl);
          const clusterEnd = (clusterIdx < clusterStarts.length - 1) 
            ? clusterStarts[clusterIdx + 1] 
            : text.length;
          unicode = text.substring(g.cl, clusterEnd);
      }

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
}
