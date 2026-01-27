import { createDocument, type PDFDocument, type CreateDocumentOptions } from './document.js';
import type { Page, ShapedGlyph } from './page.js';
import { TextShaper, type Hb } from './shaper.js';
import { writeFileSync } from 'fs';

export interface KurdPDFOptions {
    fonts?: Record<string, { fontBytes: Uint8Array, baseFontName: string }>;
}

export class KurdPDF {
    private doc: PDFDocument | null = null;
    private currentPage: Page | null = null;
    private shaper: TextShaper | null = null;
    private fonts: Record<string, { fontBytes: Uint8Array, baseFontName: string }> = {};
    private defaultFont: string | null = null;

    constructor(options: KurdPDFOptions = {}) {
        this.fonts = options.fonts || {};
        const fontKeys = Object.keys(this.fonts);
        if (fontKeys.length > 0) {
            this.defaultFont = fontKeys[0];
        }
    }

    /**
     * Initialize HarfBuzz and the PDF document structure.
     * Must be called before adding text.
     */
    async init(initialPage?: { width: number, height: number }) {
        // Based on working example.ts:
        // const hb = (await (await import('harfbuzzjs')).default) as Hb;
        
        const hbModule = await import('harfbuzzjs');
        // @ts-ignore
        const hbInstance = await hbModule.default;
        
        this.shaper = new TextShaper(hbInstance as unknown as Hb);
        
        this.doc = createDocument({
            fonts: this.fonts
        });
        
        // Start with one page automatically
        if (initialPage) {
            this.addPage(initialPage.width, initialPage.height);
        } else {
            this.addPage(); // Default A4
        }
    }

    addPage(width = 595, height = 842) {
        if (!this.doc) throw new Error("Document not initialized. Call await doc.init()");
        this.currentPage = this.doc.addPage(width, height);
        return this;
    }

    setFont(fontName: string) {
        if (!this.fonts[fontName]) {
            throw new Error(`Font "${fontName}" not found in configuration.`);
        }
        this.defaultFont = fontName;
        return this;
    }

    /**
     * Measure the width of a text string with the given font and size.
     */
    measureText(text: string, size: number, options: { font?: string, rtl?: boolean } = {}): number {
        const fontKey = options.font || this.defaultFont || 'F1';
        const rtl = options.rtl ?? false;

        if (!this.fonts[fontKey] || !this.shaper) {
            console.warn(`Font "${fontKey}" not found or shaper not ready. Returning 0.`);
            return 0;
        }

        const fontBytes = this.fonts[fontKey].fontBytes;
        
        // Get UPM
        const foundUPM = this.shaper.getUPM(fontBytes);
        const UPM = foundUPM || 1000; // Default to 1000 if not found (standard for CFF, TrueType often 2048)
        
        const scale = size / UPM;
        
        const shaped = this.shaper.shape(fontBytes, text, { rtl });
        const totalAdvance = shaped.reduce((acc, g) => acc + g.xAdvance, 0);
        
        return totalAdvance * scale;
    }

    /**
     * Add text to the current page.
     * Automatically handles shaping if the font is loaded.
     * Supports automatic line wrapping if options.width is provided.
     */
    text(text: string, x: number, y: number, options: { font?: string, size?: number, rtl?: boolean, width?: number, align?: 'left' | 'right' | 'center', color?: string } = {}) {
        if (!this.currentPage) throw new Error("No page exists.");
        
        const fontKey = options.font || this.defaultFont || 'F1';
        const size = options.size || 12;
        const rtl = options.rtl ?? false;
        const maxWidth = options.width;
        
        // Parse color
        const parseColor = (c?: string): [number, number, number] | undefined => {
             if (!c) return undefined;
             if (c.startsWith('#')) {
                 const r = parseInt(c.slice(1, 3), 16) / 255;
                 const g = parseInt(c.slice(3, 5), 16) / 255;
                 const b = parseInt(c.slice(5, 7), 16) / 255;
                 return [r, g, b];
             }
             return undefined;
        };
        const color = parseColor(options.color);
        
        // If width is provided, we need to wrap text
        if (maxWidth && maxWidth > 0) {
            this.drawWrappedText(text, x, y, maxWidth, size, fontKey, rtl, options.align || (rtl ? 'right' : 'left'), color);
        } else {
            this.drawSingleLine(text, x, y, size, fontKey, rtl, color);
        }
        
        return this;
    }

    private drawSingleLine(text: string, x: number, y: number, size: number, fontKey: string, rtl: boolean, color?: [number, number, number]) {
        if (this.fonts[fontKey] && this.shaper) {
            const fontBytes = this.fonts[fontKey].fontBytes;
            const shaped = this.shaper.shape(fontBytes, text, { rtl });
            this.currentPage!.drawShapedRun(shaped, { x, y, size, font: fontKey, rtl, color });
        } else {
            this.currentPage!.drawText(text, { x, y, size, font: fontKey, color });
        }
    }

    private drawWrappedText(text: string, x: number, y: number, maxWidth: number, size: number, fontKey: string, rtl: boolean, align: 'left' | 'right' | 'center', color?: [number, number, number]) {
        if (!this.fonts[fontKey] || !this.shaper) {
            // Fallback for standard fonts (approximate wrapping)
            this.drawSingleLine(text, x, y, size, fontKey, rtl, color);
            return;
        }

        const fontBytes = this.fonts[fontKey].fontBytes;
        const words = text.split(' ');
        let currentLine: string[] = [];
        let currentY = y;
        const lineHeight = size * 1.4; // Slightly increased leading

        // We need real metrics to wrap correctly. 
        const foundUPM = this.shaper!.getUPM(fontBytes);
        const UPM = foundUPM || 2048; 
        // console.log(`Debug: Font ${fontKey} UPM=${foundUPM}, using ${UPM}`);
        const scale = size / UPM;
        
        // Helper to measure width of a string using the shaper
        const measure = (s: string) => {
            const shaped = this.shaper!.shape(fontBytes, s, { rtl });
            const totalAdvance = shaped.reduce((acc, g) => acc + g.xAdvance, 0);
            return totalAdvance; 
        };

        for (const word of words) {
            const testLine = [...currentLine, word].join(' ');
            const width = measure(testLine) * scale;
            
            if (width > maxWidth && currentLine.length > 0) {
                // Draw current line
                const lineStr = currentLine.join(' ');
                this.drawLineAligned(lineStr, x, currentY, maxWidth, size, fontKey, rtl, align, scale, measure, color);
                currentY -= lineHeight;
                currentLine = [word];
            } else {
                currentLine.push(word);
            }
        }
        if (currentLine.length > 0) {
            this.drawLineAligned(currentLine.join(' '), x, currentY, maxWidth, size, fontKey, rtl, align, scale, measure, color);
        }
    }

    private drawLineAligned(text: string, x: number, y: number, maxWidth: number, size: number, fontKey: string, rtl: boolean, align: string, scale: number, measure: (s: string) => number, color?: [number, number, number]) {
        let drawX = x;
        const width = measure(text) * scale;
        
        if (align === 'center') {
            drawX = x + (maxWidth - width) / 2;
        } else if (align === 'right') {
             drawX = x + (maxWidth - width);
        }
        
        this.drawSingleLine(text, drawX, y, size, fontKey, rtl, color);
    }

    /**
     * Draw a rectangle.
     */
    rect(x: number, y: number, w: number, h: number, style: 'F' | 'S' | 'FD' = 'S', color?: string) {
        if (!this.currentPage) throw new Error("No page exists.");
        
        // Naive hex/name to RGB parser or assume array for now.
        // Let's accept hex string "#RRGGBB" or array.
        // For simplicity, let's keep it abstract in this demo or implement a tiny parser.
        // Let's just assume simple RGB array input or implement hex parsing.
        
        const parseColor = (c?: string | [number, number, number]): [number, number, number] | undefined => {
             if (!c) return undefined;
             if (Array.isArray(c)) return c;
             if (c.startsWith('#')) {
                 const r = parseInt(c.slice(1, 3), 16) / 255;
                 const g = parseInt(c.slice(3, 5), 16) / 255;
                 const b = parseInt(c.slice(5, 7), 16) / 255;
                 return [r, g, b];
             }
             return undefined;
        };
        
        const rgb = parseColor(color);
        
        this.currentPage.drawRect({
            x, y, width: w, height: h,
            fill: style.includes('F'),
            stroke: style.includes('S'),
            color: style.includes('F') ? rgb : undefined,
            strokeColor: style.includes('S') ? rgb : undefined, // Simplification: stroke same as fill color if provided
        });
        return this;
    }

    /**
     * Draw a custom path (lines and curves).
     * Useful for complex shapes.
     */
    path(points: { x: number; y: number; type: 'M' | 'L' | 'C'; cp1?: {x:number, y:number}; cp2?: {x:number, y:number} }[], style: 'F' | 'S' | 'FD' = 'S', color?: string) {
         if (!this.currentPage) throw new Error("No page exists.");

         const parseColor = (c?: string | [number, number, number]): [number, number, number] | undefined => {
             if (!c) return undefined;
             if (Array.isArray(c)) return c;
             if (c.startsWith('#')) {
                 const r = parseInt(c.slice(1, 3), 16) / 255;
                 const g = parseInt(c.slice(3, 5), 16) / 255;
                 const b = parseInt(c.slice(5, 7), 16) / 255;
                 return [r, g, b];
             }
             return undefined;
        };
        
        const rgb = parseColor(color);

        this.currentPage.drawPath({
            points,
            close: true, // Usually we close shapes
            fill: style.includes('F'),
            stroke: style.includes('S'),
            color: style.includes('F') ? rgb : undefined,
            strokeColor: style.includes('S') ? rgb : undefined,
        });
        return this;
    }

    saveGraphicsState() {
        if (!this.currentPage) throw new Error("No page exists.");
        this.currentPage.saveGraphicsState();
        return this;
    }

    restoreGraphicsState() {
        if (!this.currentPage) throw new Error("No page exists.");
        this.currentPage.restoreGraphicsState();
        return this;
    }

    /**
     * Set a custom path as the clipping area.
     */
    clip(points: { x: number; y: number; type: 'M' | 'L' | 'C'; cp1?: {x:number, y:number}; cp2?: {x:number, y:number} }[]) {
        if (!this.currentPage) throw new Error("No page exists.");
        this.currentPage.drawPath({
            points,
            close: true,
            clip: true
        });
        return this;
    }

    /**
     * Draw a smooth circle using 8-segment high-precision Bezier arcs.
     */
    circle(cx: number, cy: number, r: number, style: 'F' | 'S' | 'FD' = 'S', color?: string) {
         if (!this.currentPage) throw new Error("No page exists.");
         
         const angleStep = Math.PI / 4;
         const k = (4/3) * Math.tan(angleStep / 4);
         const L = r * k;
         const points: any[] = [];
         
         for (let i = 0; i < 8; i++) {
             const a1 = i * angleStep, a2 = (i + 1) * angleStep;
             const x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
             const x2 = cx + r * Math.cos(a2), y2 = cy + r * Math.sin(a2);
             const tx1 = -Math.sin(a1) * L, ty1 = Math.cos(a1) * L;
             const tx2 = -Math.sin(a2) * L, ty2 = Math.cos(a2) * L;
             
             if (i === 0) points.push({ x: x1, y: y1, type: 'M' });
             points.push({ 
                 x: x2, y: y2, type: 'C', 
                 cp1: { x: x1 + tx1, y: y1 + ty1 }, 
                 cp2: { x: x2 - tx2, y: y2 - ty2 } 
             });
         }

         this.path(points, style, color);
         return this;
    }

    /**
     * Draw a rounded rectangle with smooth high-precision arcs.
     */
    roundedRect(x: number, y: number, w: number, h: number, r: number, style: 'F' | 'S' | 'FD' = 'S', color?: string) {
        if (!this.currentPage) throw new Error("No page exists.");
        
        const k = 0.552284749831;
        const kr = r * k;
        const points = [
            { x: x + r, y: y, type: 'M' },
            { x: x + w - r, y: y, type: 'L' },
            { x: x + w, y: y + r, type: 'C', cp1: {x: x + w - r + kr, y: y}, cp2: {x: x + w, y: y + r - kr} },
            { x: x + w, y: y + h - r, type: 'L' },
            { x: x + w - r, y: y + h, type: 'C', cp1: {x: x + w, y: y + h - r + kr}, cp2: {x: x + w - r + kr, y: y + h} },
            { x: x + r, y: y + h, type: 'L' },
            { x: x, y: y + h - r, type: 'C', cp1: {x: x + r - kr, y: y + h}, cp2: {x: x, y: y + h - r + kr} },
            { x: x, y: y + r, type: 'L' },
            { x: x + r, y: y, type: 'C', cp1: {x: x, y: y + r - kr}, cp2: {x: x + r - kr, y: y} }
        ] as any;

        this.path(points, style, color);
        return this;
    }

    /**
     * Add an image to the document and draw it.
     * @param data Raw image bytes
     * @param type 'jpeg' or 'png'
     * @param x X position
     * @param y Y position
     * @param w Display width
     * @param h Display height
     * @param originalWidth Original image width in pixels (optional, auto-extracted for JPEG)
     * @param originalHeight Original image height in pixels (optional, auto-extracted for JPEG)
     */
    image(data: Uint8Array, type: 'jpeg' | 'png', x: number, y: number, w: number, h: number, originalWidth?: number, originalHeight?: number) {
        if (!this.doc || !this.currentPage) throw new Error("Document not initialized.");
        
        let pxW = originalWidth;
        let pxH = originalHeight;

        // Auto-extract JPEG dimensions if not provided
        if (type === 'jpeg' && (!pxW || !pxH)) {
            try {
                let pos = 2; // skip FFD8
                while (pos < data.length - 8) {
                    if (data[pos] !== 0xFF) break;
                    const marker = data[pos + 1];
                    const len = (data[pos + 2] << 8) | data[pos + 3];
                    
                    if (marker >= 0xC0 && marker <= 0xC3) { // SOF0, SOF1, SOF2, SOF3
                        pxH = (data[pos + 5] << 8) | data[pos + 6];
                        pxW = (data[pos + 7] << 8) | data[pos + 8];
                        break;
                    }
                    pos += len + 2;
                }
            } catch (e) {
                console.warn("Failed to extract JPEG dimensions, falling back to display size.");
            }
        }

        pxW = pxW || w;
        pxH = pxH || h;

        const id = this.doc.addImage(data, type, pxW, pxH);
        
        const ref = this.doc.getImageRef(id);
        if (ref) {
            this.currentPage.addImageResource(id, ref);
        }

        this.currentPage.drawImage(id, {
            x, y, width: w, height: h
        });
        return this;
    }

    /**
     * Draw an image masked by a circle.
     */
    maskedCircleImage(data: Uint8Array, type: 'jpeg' | 'png', cx: number, cy: number, r: number) {
        if (!this.doc || !this.currentPage) throw new Error("Document not initialized.");
        
        // 1. Get circle points
        const k = 0.552284749831;
        const kr = r * k;
        const points = [
            { x: cx + r, y: cy, type: 'M' },
            { x: cx + r, y: cy + kr, type: 'C', cp1: {x: cx + r, y: cy + kr}, cp2: {x: cx + kr, y: cy + r} },
            { x: cx, y: cy + r, type: 'L' },
            { x: cx - kr, y: cy + r, type: 'C', cp1: {x: cx - kr, y: cy + r}, cp2: {x: cx - r, y: cy + kr} },
            { x: cx - r, y: cy, type: 'L' },
            { x: cx - r, y: cy - kr, type: 'C', cp1: {x: cx - r, y: cy - kr}, cp2: {x: cx - kr, y: cy - r} },
            { x: cx, y: cy - r, type: 'L' },
            { x: cx + kr, y: cy - r, type: 'C', cp1: {x: cx + kr, y: cy - r}, cp2: {x: cx + r, y: cy - kr} },
            { x: cx + r, y: cy, type: 'L' }
        ] as any[];

        this.saveGraphicsState();
        this.clip(points);
        this.image(data, type, cx - r, cy - r, r * 2, r * 2);
        this.restoreGraphicsState();
        return this;
    }

    /**
     * Draw a trilingual line (Kurdish/Arabic/English) with automatic font switching.
     * Prevents empty boxes by using the 'AR' font for script and 'EN' for Latin/Slashes.
     */
    trilingualLine(y: number, krd: string, ar: string, en: string, rightEdge: number, fontSize: number, color: string, arFont = 'AR', enFont = 'EN') {
        if (!this.currentPage) throw new Error("No page exists.");
        
        let x = rightEdge;
        const slash = " / ";
        
        const drawPart = (text: string, font: string, isRtl: boolean) => {
            const w = this.measureText(text, fontSize, { font, rtl: isRtl });
            this.text(text, x - w, y, { font, size: fontSize, rtl: isRtl, color });
            return w;
        };

        if (krd) x -= drawPart(krd, arFont, true);
        if (ar) {
            x -= drawPart(slash, enFont, false);
            x -= drawPart(ar, arFont, true);
        }
        if (en) {
            x -= drawPart(slash, enFont, false);
            x -= drawPart(en, enFont, false);
        }
        return this;
    }

    save(filename?: string): Uint8Array {
        if (!this.doc) throw new Error("Document not initialized.");
        const buffer = this.doc.save();
        
        if (filename && typeof process !== 'undefined' && process.versions && process.versions.node) {
            writeFileSync(filename, buffer);
        }
        
        return buffer;
    }
}
