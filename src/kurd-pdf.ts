import { createDocument, type PDFDocument, type CreateDocumentOptions } from './document.js';
import type { Page, ShapedGlyph } from './page.js';
import { TextShaper, type Hb, type ShapedFont } from './shaper.js';
import { writeFileSync } from 'fs';
import { parseSVG } from './svg.js';
import { parsePNG } from './png.js';

export interface KurdPDFOptions {
    fonts?: Record<string, { fontBytes: Uint8Array, baseFontName: string }>;
    fallbackOrder?: string[];
    title?: string;
    author?: string;
    subject?: string;
}

export class KurdPDF {
    private doc: PDFDocument | null = null;
    private currentPage: Page | null = null;
    private shaper: TextShaper | null = null;
    private fonts: Record<string, { fontBytes: Uint8Array, baseFontName: string }> = {};
    private shapedFonts: Map<string, ShapedFont> = new Map();
    private defaultFont: string | null = null;
    private fallbackOrder: string[] = [];
    private options: KurdPDFOptions;

    constructor(options: KurdPDFOptions = {}) {
        this.options = options;
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
        
        // Initialize and cache fonts in HarfBuzz
        for (const [key, fontCfg] of Object.entries(this.fonts)) {
            this.shapedFonts.set(key, this.shaper.initFont(fontCfg.fontBytes));
        }

        this.doc = createDocument({
            fonts: this.fonts,
            title: this.options.title,
            author: this.options.author,
            subject: this.options.subject
        });
        
        // Start with one page automatically
        if (initialPage) {
            this.addPage(initialPage.width, initialPage.height);
        } else {
            this.addPage(); // Default A4
        }
    }

    /**
     * Clean up HarfBuzz objects from memory.
     */
    destroy() {
        if (this.shaper) {
            for (const sf of this.shapedFonts.values()) {
                this.shaper.destroyFont(sf);
            }
            this.shapedFonts.clear();
        }
    }

    setMetadata(title?: string, author?: string, subject?: string) {
        if (!this.doc) throw new Error("Document not initialized.");
        if (title) this.doc.setMetadata('Title', title);
        if (author) this.doc.setMetadata('Author', author);
        if (subject) this.doc.setMetadata('Subject', subject);
        return this;
    }

    get activePage(): Page | null {
        return this.currentPage;
    }

    set activePage(p: Page | null) {
        this.currentPage = p;
    }

    addBookmark(title: string, pageIdx: number) {
        if (!this.doc) throw new Error("Document not initialized.");
        this.doc.addOutline(title, pageIdx);
        return this;
    }

    addLink(url: string, x: number, y: number, width: number, height: number) {
        if (!this.currentPage) throw new Error("No page exists.");
        this.currentPage.addLink(url, x, y, width, height);
        return this;
    }

    addPageLink(pageIdx: number, x: number, y: number, width: number, height: number) {
        if (!this.currentPage) throw new Error("No page exists.");
        this.currentPage.addInternalLink(pageIdx, x, y, width, height);
        return this;
    }

    addPage(width = 595, height = 842) {
        if (!this.doc) throw new Error("Document not initialized. Call await doc.init()");
        this.currentPage = this.doc.addPage(width, height);
        return this.currentPage;
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
            const sf = this.shapedFonts.get(fontKey);
            if (!sf) continue;
            // Check if glyph exists (GID > 0)
            const gid = this.shaper.getGlyphIndex(sf, char.codePointAt(0)!);
            if (gid > 0) return fontKey;
        }
        return this.defaultFont || 'F1';
    }

    private splitIntoRuns(text: string): { font: string, text: string, isRtl: boolean }[] {
        if (text.length === 0) return [];
        
        const runs: { font: string, text: string, isRtl: boolean }[] = [];
        
        const isRtlChar = (char: string) => {
            const code = char.codePointAt(0)!;
            // Basic RTL ranges (Arabic, Syriac, Thaana, etc.)
            return (code >= 0x0590 && code <= 0x05FF) || // Hebrew
                   (code >= 0x0600 && code <= 0x06FF) || // Arabic
                   (code >= 0x0750 && code <= 0x077F) || // Arabic Supp
                   (code >= 0x08A0 && code <= 0x08FF) || // Arabic Ext
                   (code >= 0xFB50 && code <= 0xFDFF) || // Arabic Pres A
                   (code >= 0xFE70 && code <= 0xFEFF);   // Arabic Pres B
        };

        const isDigit = (char: string) => {
            const code = char.codePointAt(0)!;
            return (code >= 0x0030 && code <= 0x0039) || // ASCII Digits
                   (code >= 0x0660 && code <= 0x0669) || // Arabic-Indic Digits
                   (code >= 0x06F0 && code <= 0x06F9);   // Ext Arabic-Indic Digits
        };

        const isNeutral = (char: string) => {
            return /[\s\.\-\/\(\)\•\:]/.test(char);
        };

        const getCharDir = (char: string): boolean => {
            if (isDigit(char)) return false; // Digits are ALWAYS LTR
            if (isRtlChar(char)) return true; // Kurdish/Arabic is RTL
            return false; // Default (English, etc.) is LTR
        };

        let currentFont = this.getBestFontForChar(text[0]);
        let currentIsRtl = getCharDir(text[0]);
        let currentText = text[0];

        for (let i = 1; i < text.length; i++) {
            const char = text[i];
            const font = this.getBestFontForChar(char);
            
            // Neutrals take the direction of the current run to prevent fragmentation
            const charDir = isNeutral(char) ? currentIsRtl : getCharDir(char);

            if (font !== currentFont || charDir !== currentIsRtl) {
                runs.push({ font: currentFont, text: currentText, isRtl: currentIsRtl });
                currentFont = font;
                currentIsRtl = charDir;
                currentText = char;
            } else {
                currentText += char;
            }
        }
        runs.push({ font: currentFont, text: currentText, isRtl: currentIsRtl });
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
        const sf = this.shapedFonts.get(fontKey);

        if (!sf || !this.shaper) {
            console.warn(`Font "${fontKey}" not found or shaper not ready. Returning 0.`);
            return 0;
        }

        const UPM = sf.upem || 1000; 
        const scale = size / UPM;
        const shaped = this.shaper.shape(sf, text, { rtl });
        const totalAdvance = shaped.reduce((acc, g) => acc + g.xAdvance, 0);
        return totalAdvance * scale;
    }

    /**
     * Add text to the current page.
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
                 const totalWidth = this.measureText(text, size);
                 const runs = this.splitIntoRuns(text);
                 const isLineRtl = runs.length > 0 && runs[0].isRtl;

                 if (isLineRtl) {
                     let currentX = x + totalWidth;
                     for (const run of runs) {
                         const runW = this.measureText(run.text, size, { font: run.font, rtl: run.isRtl });
                         this.drawSingleLine(run.text, currentX - runW, y, size, run.font, run.isRtl, color);
                         currentX -= runW;
                     }
                 } else {
                     let currentX = x;
                     for (const run of runs) {
                         this.drawSingleLine(run.text, currentX, y, size, run.font, run.isRtl, color);
                         currentX += this.measureText(run.text, size, { font: run.font, rtl: run.isRtl });
                     }
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

    private parseColorHex(c?: string): [number, number, number] | [number, number, number, number] | undefined {
         if (!c) return undefined;
         if (c.startsWith('#')) {
             let hex = c.slice(1);
             if (hex.length === 3) {
                 hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
             }
             if (hex.length === 6) {
                 const r = parseInt(hex.slice(0, 2), 16) / 255;
                 const g = parseInt(hex.slice(2, 4), 16) / 255;
                 const b = parseInt(hex.slice(4, 6), 16) / 255;
                 return [r, g, b];
             }
         }
         if (c.startsWith('cmyk(')) {
             // cmyk(100%, 0%, 50%, 10%)
             const parts = c.match(/cmyk\(\s*([\d\.]+)%?,\s*([\d\.]+)%?,\s*([\d\.]+)%?,\s*([\d\.]+)%?\s*\)/);
             if (parts) {
                 return [
                     parseFloat(parts[1]) / 100,
                     parseFloat(parts[2]) / 100,
                     parseFloat(parts[3]) / 100,
                     parseFloat(parts[4]) / 100
                 ];
             }
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
        // Add a tiny safety inset (1.0px) to prevent clipping artifacts at the edges
        const safetyInset = 1.0;
        const availableWidth = maxWidth - (safetyInset * 2);
        const startX = x + safetyInset;

        const totalWidth = this.measureText(text, size);
        let drawX = startX;
        
        if (align === 'center') drawX += (availableWidth - totalWidth) / 2;
        else if (align === 'right') drawX += (availableWidth - totalWidth);
        
        const runs = this.splitIntoRuns(text);
        // Better Line RTL detection: if ANY run is RTL, the whole line flows RTL
        const isLineRtl = runs.some(r => r.isRtl);

        let wordSpacing = 0;
        if (align === 'justify' && availableWidth > totalWidth) {
            const spaceCount = text.trim().split(/\s+/).length - 1;
            if (spaceCount > 0) {
                wordSpacing = (availableWidth - totalWidth) / spaceCount;
            }
        }

        if (isLineRtl) {
            let currentX = (align === 'justify') ? (startX + availableWidth) : (drawX + totalWidth);
            for (const run of runs) {
                const runW = this.measureText(run.text, size, { font: run.font, rtl: run.isRtl });
                const numSpaces = run.text.split(' ').length - 1;
                const justifiedRunW = runW + (numSpaces * wordSpacing);
                
                // Draw this segment using its own direction (run.isRtl)
                // This ensures numbers (isRtl: false) are shaped correctly LTR
                this.drawSingleLine(run.text, currentX - justifiedRunW, y, size, run.font, run.isRtl, this.parseColorHex(color), wordSpacing);
                currentX -= justifiedRunW;
            }
        } else {
            let currentX = drawX;
            for (const run of runs) {
                const runW = this.measureText(run.text, size, { font: run.font, rtl: run.isRtl });
                const numSpaces = run.text.split(' ').length - 1;
                const justifiedRunW = runW + (numSpaces * wordSpacing);

                this.drawSingleLine(run.text, currentX, y, size, run.font, run.isRtl, this.parseColorHex(color), wordSpacing);
                currentX += justifiedRunW;
            }
        }
    }

    private drawSingleLine(text: string, x: number, y: number, size: number, fontKey: string, rtl: boolean, color?: [number, number, number] | [number, number, number, number], wordSpacing: number = 0) {
        const sf = this.shapedFonts.get(fontKey);
        if (sf && this.shaper) {
            const shaped = this.shaper.shape(sf, text, { rtl });
            this.currentPage!.drawShapedRun(shaped, { x, y, size, font: fontKey, rtl, color, wordSpacing });
        } else {
            this.currentPage!.drawText(text, { x, y, size, font: fontKey, color });
        }
    }

    private drawWrappedText(text: string, x: number, y: number, maxWidth: number, size: number, fontKey: string, rtl: boolean, align: 'left' | 'right' | 'center' | 'justify', color?: [number, number, number] | [number, number, number, number]) {
        const sf = this.shapedFonts.get(fontKey);
        if (!sf || !this.shaper) {
            this.drawSingleLine(text, x, y, size, fontKey, rtl, color);
            return;
        }

        const words = text.split(' ');
        let currentLine: string[] = [];
        let currentY = y;
        const lineHeight = size * 1.4; 

        const UPM = sf.upem || 2048; 
        const scale = size / UPM;
        
        const measure = (s: string) => {
            const shaped = this.shaper!.shape(sf, s, { rtl });
            const totalAdvance = shaped.reduce((acc, g) => acc + g.xAdvance, 0);
            return totalAdvance * scale; 
        };

        for (let i=0; i < words.length; i++) {
            const word = words[i];
            const testLine = [...currentLine, word].join(' ');
            const width = measure(testLine);
            
            if (width > maxWidth && currentLine.length > 0) {
                const lineStr = currentLine.join(' ');
                this.drawLineAligned(lineStr, x, currentY, maxWidth, size, fontKey, rtl, align, color);
                currentY -= lineHeight;
                currentLine = [word];
            } else {
                currentLine.push(word);
            }
        }
        if (currentLine.length > 0) {
            this.drawLineAligned(currentLine.join(' '), x, currentY, maxWidth, size, fontKey, rtl, align, color);
        }
    }

    private drawLineAligned(text: string, x: number, y: number, maxWidth: number, size: number, fontKey: string, rtl: boolean, align: string, color?: [number, number, number] | [number, number, number, number]) {
        const totalWidth = this.measureText(text, size, { font: fontKey, rtl });
        
        // Safety inset matches drawRunsAligned
        const safetyInset = 1.0;
        const availableWidth = maxWidth - (safetyInset * 2);
        let drawX = x + safetyInset;

        if (align === 'center') drawX += (availableWidth - totalWidth) / 2;
        else if (align === 'right') drawX += (availableWidth - totalWidth);

        const runs = this.splitIntoRuns(text);
        const isLineRtl = runs.some(r => r.isRtl);

        let wordSpacing = 0;
        if (align === 'justify' && availableWidth > totalWidth) {
            const spaceCount = text.trim().split(/\s+/).length - 1;
            if (spaceCount > 0) {
                wordSpacing = (availableWidth - totalWidth) / spaceCount;
            }
        }

        if (isLineRtl) {
            let currentX = (align === 'justify') ? (x + safetyInset + availableWidth) : (drawX + totalWidth);
            for (const run of runs) {
                const runW = this.measureText(run.text, size, { font: run.font, rtl: run.isRtl });
                const numSpaces = run.text.split(' ').length - 1;
                const justifiedRunW = runW + (numSpaces * wordSpacing);
                
                this.drawSingleLine(run.text, currentX - justifiedRunW, y, size, run.font, run.isRtl, color, wordSpacing);
                currentX -= justifiedRunW;
            }
        } else {
            let currentX = drawX;
            for (const run of runs) {
                const runW = this.measureText(run.text, size, { font: run.font, rtl: run.isRtl });
                const numSpaces = run.text.split(' ').length - 1;
                const justifiedRunW = runW + (numSpaces * wordSpacing);

                this.drawSingleLine(run.text, currentX, y, size, run.font, run.isRtl, color, wordSpacing);
                currentX += justifiedRunW;
            }
        }
    }

    rect(x: number, y: number, w: number, h: number, style: 'F' | 'S' | 'FD' | 'N' = 'S', color?: string, lineWidth?: number) {
        if (!this.currentPage) throw new Error("No page exists.");
        
        const parseColor = (c?: string | [number, number, number] | [number, number, number, number]): [number, number, number] | [number, number, number, number] | undefined => {
             if (!c) return undefined;
             if (Array.isArray(c)) return c;
             if (c.startsWith('#')) {
                 const r = parseInt(c.slice(1, 3), 16) / 255;
                 const g = parseInt(c.slice(3, 5), 16) / 255;
                 const b = parseInt(c.slice(5, 7), 16) / 255;
                 return [r, g, b];
             }
             if (c.startsWith('cmyk(')) {
                 const parts = c.match(/cmyk\(\s*([\d\.]+)%?,\s*([\d\.]+)%?,\s*([\d\.]+)%?,\s*([\d\.]+)%?\s*\)/);
                 if (parts) {
                     return [
                         parseFloat(parts[1]) / 100,
                         parseFloat(parts[2]) / 100,
                         parseFloat(parts[3]) / 100,
                         parseFloat(parts[4]) / 100
                     ];
                 }
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

         const parseColor = (c?: string | [number, number, number] | [number, number, number, number]): [number, number, number] | [number, number, number, number] | undefined => {
             if (!c) return undefined;
             if (Array.isArray(c)) return c;
             if (c.startsWith('#')) {
                 const r = parseInt(c.slice(1, 3), 16) / 255;
                 const g = parseInt(c.slice(3, 5), 16) / 255;
                 const b = parseInt(c.slice(5, 7), 16) / 255;
                 return [r, g, b];
             }
             if (c.startsWith('cmyk(')) {
                 const parts = c.match(/cmyk\(\s*([\d\.]+)%?,\s*([\d\.]+)%?,\s*([\d\.]+)%?,\s*([\d\.]+)%?\s*\)/);
                 if (parts) {
                     return [
                         parseFloat(parts[1]) / 100,
                         parseFloat(parts[2]) / 100,
                         parseFloat(parts[3]) / 100,
                         parseFloat(parts[4]) / 100
                     ];
                 }
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

    roundedRect(x: number, y: number, w: number, h: number, r: number | number[], style: 'F' | 'S' | 'FD' | 'N' = 'S', color?: string, lineWidth?: number) {
        if (!this.currentPage) throw new Error("No page exists.");
        
        const k = 0.552284749831;
        
        // Handle asymmetric corners if r is an array [tl, tr, br, bl]
        let rs: number[];
        if (Array.isArray(r)) {
            rs = r.map(v => typeof v === 'number' ? v : 0);
        } else {
            const val = typeof r === 'number' ? r : 0;
            rs = [val, val, val, val];
        }
        
        const [rtl, rtr, rbr, rbl] = rs;

        const points = [
            // Start at top-left (after the curve)
            { x: x, y: y + h - rtl, type: 'M' },
            // Left edge to bottom-left
            { x: x, y: y + rbl, type: 'L' },
            // Bottom-left curve
            { x: x + rbl, y: y, type: 'C', cp1: {x: x, y: y + rbl - rbl * k}, cp2: {x: x + rbl - rbl * k, y: y} },
            // Bottom edge to bottom-right
            { x: x + w - rbr, y: y, type: 'L' },
            // Bottom-right curve
            { x: x + w, y: y + rbr, type: 'C', cp1: {x: x + w - rbr + rbr * k, y: y}, cp2: {x: x + w, y: y + rbr - rbr * k} },
            // Right edge to top-right
            { x: x + w, y: y + h - rtr, type: 'L' },
            // Top-right curve
            { x: x + w - rtr, y: y + h, type: 'C', cp1: {x: x + w, y: y + h - rtr + rtr * k}, cp2: {x: x + w - rtr + rtr * k, y: y + h} },
            // Top edge to top-left
            { x: x + rtl, y: y + h, type: 'L' },
            // Top-left curve
            { x: x, y: y + h - rtl, type: 'C', cp1: {x: x + rtl - rtl * k, y: y + h}, cp2: {x: x, y: y + h - rtl + rtl * k} }
        ] as any;

        // Validation pass to prevent crashes
        for (const p of points) {
            if (typeof p.x !== 'number' || isNaN(p.x)) p.x = 0;
            if (typeof p.y !== 'number' || isNaN(p.y)) p.y = 0;
            if (p.type === 'C') {
                if (!p.cp1 || typeof p.cp1.x !== 'number' || isNaN(p.cp1.x)) p.cp1 = { x: 0, y: 0 };
                if (!p.cp1 || typeof p.cp1.y !== 'number' || isNaN(p.cp1.y)) p.cp1.y = 0;
                if (!p.cp2 || typeof p.cp2.x !== 'number' || isNaN(p.cp2.x)) p.cp2 = { x: 0, y: 0 };
                if (!p.cp2 || typeof p.cp2.y !== 'number' || isNaN(p.cp2.y)) p.cp2.y = 0;
            }
        }

        if (style === 'N') {
            this.clip(points);
        } else {
            this.path(points, style, color, lineWidth);
        }
        return this;
    }

    image(data: Uint8Array | string, type: 'jpeg' | 'png', x: number, y: number, w: number, h: number, originalWidth?: number, originalHeight?: number) {
        if (!this.doc || !this.currentPage) throw new Error("Document not initialized.");
        
        let bytes: Uint8Array;
        if (typeof data === 'string') {
            // Remove data:image/...;base64, prefix if present
            const base64 = data.replace(/^data:image\/\w+;base64,/, '');
            bytes = new Uint8Array(Buffer.from(base64, 'base64'));
        } else {
            bytes = data;
        }

        let pxW = originalWidth;
        let pxH = originalHeight;

        if (!pxW || !pxH) {
            const dims = this.getImageDimensions(bytes, type);
            pxW = dims.width;
            pxH = dims.height;
        }

        const id = this.doc.addImage(bytes, type, pxW, pxH);
        
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

    svg(svgContent: string, x: number, y: number, options: { width?: number, height?: number, scale?: number, color?: string } = {}) {
        if (!this.currentPage) throw new Error("No page exists.");
        
        const { paths, viewBox } = parseSVG(svgContent);
        
        let scaleX = options.scale || 1.0;
        let scaleY = options.scale || 1.0;

        if (viewBox && options.width) {
            scaleX = options.width / viewBox.w;
            scaleY = options.height ? options.height / viewBox.h : scaleX;
        }

        const offsetX = viewBox ? viewBox.x : 0;
        const offsetY = viewBox ? viewBox.y : 0;
        
        for (const path of paths) {
            const transformedPoints = path.points.map((p: any) => ({
                ...p,
                x: x + (p.x - offsetX) * scaleX,
                y: y - (p.y - offsetY) * scaleY, 
                cp1: p.cp1 ? { x: x + (p.cp1.x - offsetX) * scaleX, y: y - (p.cp1.y - offsetY) * scaleY } : undefined,
                cp2: p.cp2 ? { x: x + (p.cp2.x - offsetX) * scaleX, y: y - (p.cp2.y - offsetY) * scaleY } : undefined
            }));

            const fill = options.color || path.fill;
            const stroke = path.stroke;
            const style = (fill && stroke) ? 'FD' : fill ? 'F' : 'S';

            this.path(transformedPoints, style, fill || stroke, path.strokeWidth || 1);
        }
        return this;
    }

    gradient(colors: { offset: number, color: string }[], x0: number, y0: number, x1: number, y1: number) {
        if (!this.doc || !this.currentPage) throw new Error("Document not initialized.");
        
        const parseColor = (c: string): [number, number, number] => {
             let hex = c.startsWith('#') ? c.slice(1) : c;
             if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
             const r = parseInt(hex.slice(0, 2), 16) / 255;
             const g = parseInt(hex.slice(2, 4), 16) / 255;
             const b = parseInt(hex.slice(4, 6), 16) / 255;
             return [r, g, b];
        };

        const stops = colors.map(s => ({ offset: s.offset, color: parseColor(s.color) }));
        const shading = this.doc.addShading(stops, [x0, y0, x1, y1]);
        
        this.currentPage.addShadingResource(shading.name, shading.ref);
        this.currentPage.drawShading(shading.name);
        return this;
    }

    radialGradient(colors: { offset: number, color: string }[], x0: number, y0: number, r0: number, x1: number, y1: number, r1: number) {
        if (!this.doc || !this.currentPage) throw new Error("Document not initialized.");
        
        const parseColor = (c: string): [number, number, number] => {
             let hex = c.startsWith('#') ? c.slice(1) : c;
             if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
             const r = parseInt(hex.slice(0, 2), 16) / 255;
             const g = parseInt(hex.slice(2, 4), 16) / 255;
             const b = parseInt(hex.slice(4, 6), 16) / 255;
             return [r, g, b];
        };

        const stops = colors.map(s => ({ offset: s.offset, color: parseColor(s.color) }));
        const shading = this.doc.addRadialShading(stops, [x0, y0, r0, x1, y1, r1]);
        
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
