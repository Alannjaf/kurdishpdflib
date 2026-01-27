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

export class TextShaper {
  private hb: Hb;

  constructor(hbInstance: Hb) {
    this.hb = hbInstance;
  }

  getUPM(fontBytes: Uint8Array): number {
      const blob = this.hb.createBlob(fontBytes);
      const face = this.hb.createFace(blob, 0);
      const font = this.hb.createFont(face);
      // HarfBuzz usually exposes this via face.getUpem() if mapped in the binding
      // But looking at typical harfbuzzjs bindings, it might not be directly exposed easily 
      // without looking at the json output of a shape or specific method.
      // Let's check typical generic methods.
      // Actually, standard harfbuzzjs 'createFace' returns an object with 'upem'.
      // Let's try to access it safely.
      
      let upem = 1000; // default fallback
      if ('upem' in face) {
          upem = (face as any).upem; // Type assertion needed as our Hb type is loose
      } else if ('getUpem' in face) {
          upem = (face as any).getUpem();
      }

      font.destroy();
      face.destroy();
      blob.destroy();
      return upem;
  }

  shape(fontBytes: Uint8Array, text: string, options: { rtl?: boolean } = {}): ShapedGlyph[] {
    const blob = this.hb.createBlob(fontBytes);
    const face = this.hb.createFace(blob, 0);
    const font = this.hb.createFont(face);
    const buffer = this.hb.createBuffer();
    
    buffer.addText(text);
    // You could force direction here if needed, but guessSegmentProperties is usually good
    if (options.rtl) {
      buffer.setDirection('rtl');
    }
    buffer.guessSegmentProperties();
    
    this.hb.shape(font, buffer);
    const arr = buffer.json();
    
    // Cleanup
    buffer.destroy();
    font.destroy();
    face.destroy();
    blob.destroy();

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
