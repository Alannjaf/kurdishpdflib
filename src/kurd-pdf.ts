import { createDocument, type PDFDocument, type CreateDocumentOptions } from './document.js';
import type { Page, ShapedGlyph } from './page.js';
import { TextShaper, type Hb } from './shaper.js';
import { writeFileSync } from 'fs';
import { parseSVG } from './svg.js';
import { parsePNG } from './png.js';

export interface KurdPDFOptions {
    fonts?: Record<string, { fontBytes: Uint8Array, baseFontName: string }>;
    fallbackOrder?: string[];
}

export class KurdPDF {
    private doc: PDFDocument | null = null;
    private currentPage: Page | null = null;
    private shaper: TextShaper | null = null;
    private fonts: Record<string, { fontBytes: Uint8Array, baseFontName: string }> = {};
    private defaultFont: string | null = null;
    private fallbackOrder: string[] = [];

    constructor(options: KurdPDFOptions = {}) {
        this.fonts = options.fonts || {};
        const fontKeys = Object.keys(this.fonts);
        this.fallbackOrder = options.fallbackOrder || fontKeys;
        if (fontKeys.length > 0) {
            this.defaultFont = fontKeys[0];
        }
    }

    /**
     * Initialize HarfBuzz and the PDF document structure.
     * Must be called before adding text.
     */
    async init(initialPage?: { width: number, height: number }) {
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

    private getBestFontForChar(char: string): string {
        if (!this.shaper) return this.defaultFont || 'F1';
        
        for (const fontKey of this.fallbackOrder) {
            const font = this.fonts[fontKey];
            if (!font) continue;
            // Check if glyph exists (GID > 0)
            const gid = this.shaper.getGlyphIndex(font.fontBytes, char.codePointAt(0)!);
            if (gid > 0) return fontKey;
        }
        return this.defaultFont || 'F1';
    }

    private splitIntoRuns(text: string): { font: string, text: string, isRtl: boolean }[] {
        if (text.length === 0) return [];
        
        const runs: { font: string, text: string, isRtl: boolean }[] = [];
        let currentFont = this.getBestFontForChar(text[0]);
        let currentText = text[0];
        
        const isRtlChar = (char: string) => {
            const code = char.codePointAt(0)!;
            return (code >= 0x0600 && code <= 0x06FF) || (code >= 0x0750 && code <= 0x077F) || (code >= 0x08A0 && code <= 0x08FF) || (code >= 0xFB50 && code <= 0xFDFF) || (code >= 0xFE70 && code <= 0xFEFF);
        };

        for (let i = 1; i < text.length; i++) {
            const char = text[i];
            const font = this.getBestFontForChar(char);
            
            if (char === ' ' || char === '\n' || char === '\r' || char === '\t') {
                currentText += char;
                continue;
            }

            if (font !== currentFont) {
                runs.push({ font: currentFont, text: currentText, isRtl: isRtlChar(currentText.trim()[0] || ' ') });
                currentFont = font;
                currentText = char;
            } else {
                currentText += char;
            }
        }
        runs.push({ font: currentFont, text: currentText, isRtl: isRtlChar(currentText.trim()[0] || ' ') });
        return runs;
    }

    /**
     * Measure the width of a text string with the given font and size.
     */
    measureText(text: string, size: number, options: { font?: string, rtl?: boolean } = {}): number {
        if (!options.font) {
            const runs = this.splitIntoRuns(text);
            return runs.reduce((acc, run) => acc + this.measureText(run.text, size, { font: run.font, rtl: run.isRtl }), 0);
        }

        const fontKey = options.font || this.defaultFont || 'F1';
        const rtl = options.rtl ?? false;

        if (!this.fonts[fontKey] || !this.shaper) {
            console.warn(`Font "${fontKey}" not found or shaper not ready. Returning 0.`);
            return 0;
        }

        const fontBytes = this.fonts[fontKey].fontBytes;
        const foundUPM = this.shaper.getUPM(fontBytes);
        const UPM = foundUPM || 1000; 
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
    text(text: string, x: number, y: number, options: { font?: string, size?: number, rtl?: boolean, width?: number, align?: 'left' | 'right' | 'center' | 'justify', color?: string } = {}) {
        if (!this.currentPage) throw new Error("No page exists.");
        
        const size = options.size || 12;
        const maxWidth = options.width;
        const color = this.parseColorHex(options.color);

        if (!options.font) {
            if (maxWidth && maxWidth > 0) {
                 this.drawWrappedTextFallback(text, x, y, maxWidth, size, options.align || 'left', options.color);
            } else {
                 const runs = this.splitIntoRuns(text);
                 let currentX = x;
                 for (const run of runs) {
                     this.drawSingleLine(run.text, currentX, y, size, run.font, run.isRtl, color);
                     currentX += this.measureText(run.text, size, { font: run.font, rtl: run.isRtl });
                 }
            }
            return this;
        }

        const fontKey = options.font;
        const rtl = options.rtl ?? false;
        
        if (maxWidth && maxWidth > 0) {
            this.drawWrappedText(text, x, y, maxWidth, size, fontKey, rtl, options.align || (rtl ? 'right' : 'left'), color);
        } else {
            this.drawSingleLine(text, x, y, size, fontKey, rtl, color);
        }
        return this;
    }

    private parseColorHex(c?: string): [number, number, number] | undefined {
         if (!c) return undefined;
         if (c.startsWith('#')) {
             const r = parseInt(c.slice(1, 3), 16) / 255;
             const g = parseInt(c.slice(3, 5), 16) / 255;
             const b = parseInt(c.slice(5, 7), 16) / 255;
             return [r, g, b];
         }
         return undefined;
    }

    private drawWrappedTextFallback(text: string, x: number, y: number, maxWidth: number, size: number, align: string, color?: string) {
        const words = text.split(' ');
        let currentLine: string[] = [];
        let currentY = y;
        const lineHeight = size * 1.4;

        for (const word of words) {
            const testLine = [...currentLine, word].join(' ');
            const width = this.measureText(testLine, size);
            
            if (width > maxWidth && currentLine.length > 0) {
                this.drawRunsAligned(currentLine.join(' '), x, currentY, maxWidth, size, align, color);
                currentY -= lineHeight;
                currentLine = [word];
            } else {
                currentLine.push(word);
            }
        }
        if (currentLine.length > 0) {
            this.drawRunsAligned(currentLine.join(' '), x, currentY, maxWidth, size, align, color);
        }
    }

    private drawRunsAligned(text: string, x: number, y: number, maxWidth: number, size: number, align: string, color?: string) {
        const width = this.measureText(text, size);
        let drawX = x;
        if (align === 'center') drawX += (maxWidth - width) / 2;
        else if (align === 'right') drawX += (maxWidth - width);
        
        const runs = this.splitIntoRuns(text);
        let currentX = drawX;
        for (const run of runs) {
            this.drawSingleLine(run.text, currentX, y, size, run.font, run.isRtl, this.parseColorHex(color));
            currentX += this.measureText(run.text, size, { font: run.font, rtl: run.isRtl });
        }
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

    private drawWrappedText(text: string, x: number, y: number, maxWidth: number, size: number, fontKey: string, rtl: boolean, align: 'left' | 'right' | 'center' | 'justify', color?: [number, number, number]) {
        if (!this.fonts[fontKey] || !this.shaper) {
            this.drawSingleLine(text, x, y, size, fontKey, rtl, color);
            return;
        }

        const fontBytes = this.fonts[fontKey].fontBytes;
        const words = text.split(' ');
        let currentLine: string[] = [];
        let currentY = y;
        const lineHeight = size * 1.4; 

        const foundUPM = this.shaper!.getUPM(fontBytes);
        const UPM = foundUPM || 2048; 
        const scale = size / UPM;
        
        const measure = (s: string) => {
            const shaped = this.shaper!.shape(fontBytes, s, { rtl });
            const totalAdvance = shaped.reduce((acc, g) => acc + g.xAdvance, 0);
            return totalAdvance; 
        };

        for (const word of words) {
            const testLine = [...currentLine, word].join(' ');
            const width = measure(testLine) * scale;
            
            if (width > maxWidth && currentLine.length > 0) {
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

    rect(x: number, y: number, w: number, h: number, style: 'F' | 'S' | 'FD' | 'N' = 'S', color?: string, lineWidth?: number) {
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

        if (style === 'N') {
            this.currentPage.drawRect({ x, y, width: w, height: h, fill: false, stroke: false });
            return this;
        }
        
        this.currentPage.drawRect({
            x, y, width: w, height: h,
            fill: style.includes('F'),
            stroke: style.includes('S'),
            color: style.includes('F') ? rgb : undefined,
            strokeColor: style.includes('S') ? rgb : undefined, 
            strokeWidth: lineWidth
        });
        return this;
    }

    path(points: { x: number; y: number; type: 'M' | 'L' | 'C'; cp1?: {x:number, y:number}; cp2?: {x:number, y:number} }[], style: 'F' | 'S' | 'FD' | 'N' = 'S', color?: string, lineWidth?: number) {
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

        if (style === 'N') {
             this.currentPage.drawPath({ points, close: true, clip: true }); 
             return this;
        }

        this.currentPage.drawPath({
            points,
            close: true, 
            fill: style.includes('F'),
            stroke: style.includes('S'),
            color: style.includes('F') ? rgb : undefined,
            strokeColor: style.includes('S') ? rgb : undefined,
            strokeWidth: lineWidth
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

    clip(points?: any[]) {
        if (!this.currentPage) throw new Error("No page exists.");
        if (points) {
            this.currentPage.drawPath({
                points,
                close: true,
                clip: true
            });
        } else {
            this.currentPage.clip();
        }
        return this;
    }

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

    roundedRect(x: number, y: number, w: number, h: number, r: number, style: 'F' | 'S' | 'FD' | 'N' = 'S', color?: string, lineWidth?: number) {
        if (!this.currentPage) throw new Error("No page exists.");
        
        const k = 0.552284749831;
        const kr = r * k;
        const points = [
            { x: x, y: y + h - r, type: 'M' },
            { x: x, y: y + r, type: 'L' },
            { x: x + r, y: y, type: 'C', cp1: {x: x, y: y + r - kr}, cp2: {x: x + r - kr, y: y} },
            { x: x + w - r, y: y, type: 'L' },
            { x: x + w, y: y + r, type: 'C', cp1: {x: x + w - r + kr, y: y}, cp2: {x: x + w, y: y + r - kr} },
            { x: x + w, y: y + h - r, type: 'L' },
            { x: x + w - r, y: y + h, type: 'C', cp1: {x: x + w, y: y + h - r + kr}, cp2: {x: x + w - r + kr, y: y + h} },
            { x: x + r, y: y + h, type: 'L' },
            { x: x, y: y + h - r, type: 'C', cp1: {x: x + r - kr, y: y + h}, cp2: {x: x, y: y + h - r + kr} }
        ] as any;

        if (style === 'N') {
            this.clip(points);
        } else {
            this.path(points, style, color, lineWidth);
        }
        return this;
    }

    image(data: Uint8Array, type: 'jpeg' | 'png', x: number, y: number, w: number, h: number, originalWidth?: number, originalHeight?: number) {
        if (!this.doc || !this.currentPage) throw new Error("Document not initialized.");
        
        let pxW = originalWidth;
        let pxH = originalHeight;

        if (!pxW || !pxH) {
            const dims = this.getImageDimensions(data, type);
            pxW = dims.width;
            pxH = dims.height;
        }

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

    getImageDimensions(data: Uint8Array, type: 'jpeg' | 'png'): { width: number, height: number } {
        if (type === 'png') {
            try {
                const png = parsePNG(data);
                return { width: png.width, height: png.height };
            } catch (e) {}
        }
        
        // JPEG logic
        try {
            let pos = 2; // skip FFD8
            while (pos < data.length - 8) {
                if (data[pos] !== 0xFF) break;
                const marker = data[pos + 1];
                const len = (data[pos + 2] << 8) | data[pos + 3];
                
                if (marker >= 0xC0 && marker <= 0xC3) {
                    const height = (data[pos + 5] << 8) | data[pos + 6];
                    const width = (data[pos + 7] << 8) | data[pos + 8];
                    return { width, height };
                }
                pos += len + 2;
            }
        } catch (e) {}
        return { width: 100, height: 100 };
    }

    maskedCircleImage(data: Uint8Array, type: 'jpeg' | 'png', cx: number, cy: number, r: number) {
        if (!this.doc || !this.currentPage) throw new Error("Document not initialized.");
        
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

    svg(svgContent: string, x: number, y: number, options: { scale?: number, color?: string, style?: 'F'|'S'|'FD' } = {}) {
        if (!this.currentPage) throw new Error("No page exists.");
        
        const scale = options.scale || 1.0;
        
        const paths = parseSVG(svgContent);
        
        for (const path of paths) {
            const transformedPoints = path.points.map((p: any) => ({
                ...p,
                x: x + p.x * scale,
                y: y - p.y * scale, 
                cp1: p.cp1 ? { x: x + p.cp1.x * scale, y: y - p.cp1.y * scale } : undefined,
                cp2: p.cp2 ? { x: x + p.cp2.x * scale, y: y - p.cp2.y * scale } : undefined
            }));

            this.path(transformedPoints, 'F', options.color || path.color);
        }
        return this;
    }

    gradient(colors: { offset: number, color: string }[], x0: number, y0: number, x1: number, y1: number) {
        if (!this.doc || !this.currentPage) throw new Error("Document not initialized.");
        
        const parseColor = (c: string): [number, number, number] => {
             const r = parseInt(c.slice(1, 3), 16) / 255;
             const g = parseInt(c.slice(3, 5), 16) / 255;
             const b = parseInt(c.slice(5, 7), 16) / 255;
             return [r, g, b];
        };

        const stops = colors.map(s => ({ offset: s.offset, color: parseColor(s.color) }));
        const shading = this.doc.addShading(stops, [x0, y0, x1, y1]);
        
        this.currentPage.addShadingResource(shading.name, shading.ref);
        this.currentPage.drawShading(shading.name);
        return this;
    }

    setOpacity(opacity: number) {
        if (!this.doc || !this.currentPage) throw new Error("Document not initialized.");
        const gs = this.doc.getOpacityGState(opacity);
        this.currentPage.addExtGStateResource(gs.name, gs.ref);
        this.currentPage.setOpacity(gs.name);
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
