import { createDocument, type PDFDocument, type CreateDocumentOptions, type EncryptionOptions, type PDFPermissions } from './document.js';
import type { Page, ShapedGlyph } from './page.js';
import { TextShaper, type Hb, type ShapedFont } from './shaper.js';
import { writeFileSync } from 'fs';
import { parseSVG } from './svg.js';
import { parsePNG } from './png.js';
import { generateQRCode, type QRCodeOptions, type QRCodeResult, type ErrorCorrectionLevel } from './qrcode.js';
import { generateCode128, generateEAN13, type BarcodeResult } from './barcode.js';

/**
 * Standard page sizes in points (1 point = 1/72 inch)
 */
export const PageSizes = {
    // ISO 216 A-series
    A3: { width: 842, height: 1191 },
    A4: { width: 595, height: 842 },
    A5: { width: 420, height: 595 },
    A6: { width: 298, height: 420 },

    // US sizes
    Letter: { width: 612, height: 792 },
    Legal: { width: 612, height: 1008 },
    Tabloid: { width: 792, height: 1224 },
    Ledger: { width: 1224, height: 792 },

    // Other common sizes
    Executive: { width: 522, height: 756 },
    B5: { width: 499, height: 709 },
} as const;

export type PageSizeName = keyof typeof PageSizes;
export type Orientation = 'portrait' | 'landscape';

export interface PageOptions {
    /** Named page size (e.g., 'A4', 'Letter') */
    size?: PageSizeName;
    /** Custom width in points (overrides size) */
    width?: number;
    /** Custom height in points (overrides size) */
    height?: number;
    /** Page orientation - swaps width/height if 'landscape' */
    orientation?: Orientation;
}

export interface KurdPDFOptions {
    fonts?: Record<string, { fontBytes: Uint8Array, baseFontName: string }>;
    fallbackOrder?: string[];
    title?: string;
    author?: string;
    subject?: string;
    /** Encryption options for password protection */
    encryption?: EncryptionOptions;
}

export type { EncryptionOptions, PDFPermissions };

export class KurdPDF {
    private doc: PDFDocument | null = null;
    private currentPage: Page | null = null;
    private shaper: TextShaper | null = null;
    private fonts: Record<string, { fontBytes: Uint8Array, baseFontName: string }> = {};
    private shapedFonts: Map<string, ShapedFont> = new Map();
    private defaultFont: string | null = null;
    private fallbackOrder: string[] = [];
    private options: KurdPDFOptions;
    private _pageCount: number = 0;
    private _currentPageNumber: number = 0;

    /** Get the total number of pages in the document */
    get pageCount(): number {
        return this._pageCount;
    }

    /** Get the current page number (1-indexed) */
    get currentPageNumber(): number {
        return this._currentPageNumber;
    }

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
            subject: this.options.subject,
            encryption: this.options.encryption
        });
        
        // Start with one page automatically
        if (initialPage) {
            this.addPage({ width: initialPage.width, height: initialPage.height });
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

    /**
     * Add a new page to the document.
     * @param options - Page size options (named size, custom dimensions, orientation)
     * @example
     * // Using named size
     * pdf.addPage({ size: 'Letter' });
     * pdf.addPage({ size: 'A4', orientation: 'landscape' });
     *
     * // Using custom dimensions (in points, 1 inch = 72 points)
     * pdf.addPage({ width: 400, height: 600 });
     *
     * // Default is A4 portrait
     * pdf.addPage();
     */
    addPage(options: PageOptions = {}) {
        if (!this.doc) throw new Error("Document not initialized. Call await doc.init()");

        let width: number;
        let height: number;

        if (options.width !== undefined && options.height !== undefined) {
            // Custom dimensions take priority
            width = options.width;
            height = options.height;
        } else {
            // Use named size or default to A4
            const sizeName = options.size || 'A4';
            const size = PageSizes[sizeName];
            width = size.width;
            height = size.height;
        }

        // Apply orientation (swap dimensions for landscape)
        if (options.orientation === 'landscape') {
            [width, height] = [height, width];
        }

        this.currentPage = this.doc.addPage(width, height);
        this._pageCount++;
        this._currentPageNumber = this._pageCount;
        return this.currentPage;
    }

    /**
     * Replace page number placeholders in text.
     * Placeholders: {pageNum}, {totalPages}, {page}/{total}
     * Note: {totalPages} and {total} are only accurate after all pages are added.
     */
    formatPageText(text: string, pageNum?: number, totalPages?: number): string {
        const pn = pageNum ?? this._currentPageNumber;
        const tp = totalPages ?? this._pageCount;
        return text
            .replace(/\{pageNum\}/g, String(pn))
            .replace(/\{totalPages\}/g, String(tp))
            .replace(/\{page\}/g, String(pn))
            .replace(/\{total\}/g, String(tp));
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
        
        // Always prefer the explicitly set default font if it has the glyph
        const preferred = [this.defaultFont, ...this.fallbackOrder.filter(f => f !== this.defaultFont)];

        for (const fontKey of preferred) {
            if (!fontKey) continue;
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

        // Use Array.from to correctly split by code points (handles surrogate pairs)
        const chars = Array.from(text);
        if (chars.length === 0) return [];

        let currentFont = this.getBestFontForChar(chars[0]);
        let currentIsRtl = getCharDir(chars[0]);
        let currentText = chars[0];

        for (let i = 1; i < chars.length; i++) {
            const char = chars[i];
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
    measureText(text: string, size: number, options: { font?: string, rtl?: boolean, letterSpacing?: number } = {}): number {
        const letterSpacing = options.letterSpacing || 0;

        if (!options.font) {
            const runs = this.splitIntoRuns(text);
            return runs.reduce((acc, run) => acc + this.measureText(run.text, size, { font: run.font, rtl: run.isRtl, letterSpacing }), 0);
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
        
        // Add letterSpacing for each glyph
        const totalLS = letterSpacing * shaped.length;
        
        return (totalAdvance * scale) + totalLS;
    }

    /**
     * Add text to the current page.
     * @param text - The text to draw
     * @param x - X position
     * @param y - Y position (baseline)
     * @param options - Text styling options
     */
    text(text: string, x: number, y: number, options: {
        font?: string,
        size?: number,
        rtl?: boolean,
        width?: number,
        align?: 'left' | 'right' | 'center' | 'justify',
        color?: string,
        wordSpacing?: number,
        letterSpacing?: number,
        /** Draw underline below text */
        underline?: boolean,
        /** Draw line through text */
        strikethrough?: boolean,
        /** Render as subscript (smaller, below baseline) */
        subscript?: boolean,
        /** Render as superscript (smaller, above baseline) */
        superscript?: boolean,
        /** Color for underline/strikethrough (defaults to text color) */
        lineColor?: string
    } = {}) {
        if (!this.currentPage) throw new Error("No page exists.");

        // Handle subscript/superscript: adjust size and position
        let actualSize = options.size || 12;
        let actualY = y;
        if (options.subscript) {
            actualSize = actualSize * 0.65;  // 65% of original size
            actualY = y - actualSize * 0.3;  // Move down
        } else if (options.superscript) {
            actualSize = actualSize * 0.65;  // 65% of original size
            actualY = y + (options.size || 12) * 0.4;  // Move up
        }

        const size = actualSize;
        const maxWidth = options.width;
        const color = this.parseColor(options.color);
        const ws = options.wordSpacing || 0;
        const ls = options.letterSpacing || 0;

        // Calculate text width for underline/strikethrough
        let textWidth = 0;
        if (options.underline || options.strikethrough) {
            textWidth = this.measureText(text, size, { font: options.font, letterSpacing: ls });
        }

        if (!options.font) {
            if (maxWidth && maxWidth > 0) {
                 this.drawWrappedTextFallback(text, x, actualY, maxWidth, size, options.align || 'left', options.color, ws, ls);
            } else {
                 const totalWidth = this.measureText(text, size, { letterSpacing: ls });
                 textWidth = totalWidth;
                 const runs = this.splitIntoRuns(text);
                 const isLineRtl = runs.length > 0 && runs[0].isRtl;

                 if (isLineRtl) {
                     let currentX = x + totalWidth;
                     for (const run of runs) {
                         const runW = this.measureText(run.text, size, { font: run.font, rtl: run.isRtl, letterSpacing: ls });
                         this.drawSingleLine(run.text, currentX - runW, actualY, size, run.font, run.isRtl, color, ws, ls);
                         currentX -= runW;
                     }
                 } else {
                     let currentX = x;
                     for (const run of runs) {
                         this.drawSingleLine(run.text, currentX, actualY, size, run.font, run.isRtl, color, ws, ls);
                         currentX += this.measureText(run.text, size, { font: run.font, rtl: run.isRtl, letterSpacing: ls });
                     }
                 }
            }
        } else {
            const fontKey = options.font;
            const rtl = options.rtl ?? false;

            if (maxWidth && maxWidth > 0) {
                this.drawWrappedText(text, x, actualY, maxWidth, size, fontKey, rtl, options.align || (rtl ? 'right' : 'left'), color, ws, ls);
            } else {
                textWidth = this.measureText(text, size, { font: fontKey, rtl, letterSpacing: ls });
                this.drawSingleLine(text, x, actualY, size, fontKey, rtl, color, ws, ls);
            }
        }

        // Draw underline
        if (options.underline && textWidth > 0) {
            const lineColor = this.parseColor(options.lineColor || options.color) || [0, 0, 0];
            const lineY = actualY - size * 0.15;  // Slightly below baseline
            const lineThickness = Math.max(0.5, size * 0.05);
            this.currentPage.drawRect({
                x, y: lineY, width: textWidth, height: lineThickness,
                color: lineColor as [number, number, number], fill: true, stroke: false
            });
        }

        // Draw strikethrough
        if (options.strikethrough && textWidth > 0) {
            const lineColor = this.parseColor(options.lineColor || options.color) || [0, 0, 0];
            const lineY = actualY + size * 0.3;  // Middle of text
            const lineThickness = Math.max(0.5, size * 0.05);
            this.currentPage.drawRect({
                x, y: lineY, width: textWidth, height: lineThickness,
                color: lineColor as [number, number, number], fill: true, stroke: false
            });
        }

        return this;
    }

    /**
     * Parse color from various formats: hex (#FFF, #FFFFFF), cmyk(), named colors, or RGB/CMYK arrays.
     * Returns RGB [r, g, b] or CMYK [c, m, y, k] tuple, or undefined if invalid.
     */
    private parseColor(c?: string | [number, number, number] | [number, number, number, number]): [number, number, number] | [number, number, number, number] | undefined {
        if (!c) return undefined;
        if (Array.isArray(c)) return c;

        // Handle named colors
        const namedColors: Record<string, string> = {
            'red': '#ff0000', 'green': '#00ff00', 'blue': '#0000ff',
            'black': '#000000', 'white': '#ffffff', 'gold': '#ffd700'
        };
        const target = namedColors[c.toLowerCase()] || c;

        if (target.startsWith('#')) {
            let hex = target.slice(1);
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

    private drawWrappedTextFallback(text: string, x: number, y: number, maxWidth: number, size: number, align: string, color?: string, wordSpacing?: number, letterSpacing?: number) {
        const words = text.split(' ');
        let currentLine: string[] = [];
        let currentY = y;
        const lineHeight = size * 1.4;

        for (const word of words) {
            const testLine = [...currentLine, word].join(' ');
            const width = this.measureText(testLine, size, { letterSpacing });
            
            if (width > maxWidth && currentLine.length > 0) {
                this.drawRunsAligned(currentLine.join(' '), x, currentY, maxWidth, size, align, color, wordSpacing, letterSpacing);
                currentY -= lineHeight;
                currentLine = [word];
            } else {
                currentLine.push(word);
            }
        }
        if (currentLine.length > 0) {
            this.drawRunsAligned(currentLine.join(' '), x, currentY, maxWidth, size, align, color, wordSpacing, letterSpacing);
        }
    }

    private drawRunsAligned(text: string, x: number, y: number, maxWidth: number, size: number, align: string, color?: string, explicitWordSpacing: number = 0, letterSpacing: number = 0) {
        // Add a tiny safety inset (1.0px) to prevent clipping artifacts at the edges
        const safetyInset = 1.0;
        const availableWidth = maxWidth - (safetyInset * 2);
        const startX = x + safetyInset;

        const totalWidth = this.measureText(text, size, { letterSpacing });
        let drawX = startX;
        
        if (align === 'center') drawX += (availableWidth - totalWidth) / 2;
        else if (align === 'right') drawX += (availableWidth - totalWidth);
        
        const runs = this.splitIntoRuns(text);
        // Determine base direction based on the first strong character
        const firstStrongRun = runs.find(r => r.text.trim().length > 0);
        const isLineRtl = firstStrongRun ? firstStrongRun.isRtl : false;

        let wordSpacing = explicitWordSpacing;
        if (align === 'justify' && availableWidth > totalWidth) {
            const spaceCount = text.trim().split(/\s+/).length - 1;
            if (spaceCount > 0) {
                wordSpacing += (availableWidth - totalWidth) / spaceCount;
            }
        }

        if (isLineRtl) {
            let currentX = (align === 'justify') ? (startX + availableWidth) : (drawX + totalWidth);
            for (const run of runs) {
                const runW = this.measureText(run.text, size, { font: run.font, rtl: run.isRtl, letterSpacing });
                const numSpaces = run.text.split(' ').length - 1;
                const justifiedRunW = runW + (numSpaces * wordSpacing);
                
                // Draw this segment using its own direction (run.isRtl)
                // This ensures numbers (isRtl: false) are shaped correctly LTR
                this.drawSingleLine(run.text, currentX - justifiedRunW, y, size, run.font, run.isRtl, this.parseColor(color), wordSpacing, letterSpacing);
                currentX -= justifiedRunW;
            }
        } else {
            let currentX = drawX;
            for (const run of runs) {
                const runW = this.measureText(run.text, size, { font: run.font, rtl: run.isRtl, letterSpacing });
                const numSpaces = run.text.split(' ').length - 1;
                const justifiedRunW = runW + (numSpaces * wordSpacing);

                this.drawSingleLine(run.text, currentX, y, size, run.font, run.isRtl, this.parseColor(color), wordSpacing, letterSpacing);
                currentX += justifiedRunW;
            }
        }
    }

    private drawSingleLine(text: string, x: number, y: number, size: number, fontKey: string, rtl: boolean, color?: [number, number, number] | [number, number, number, number], wordSpacing: number = 0, letterSpacing: number = 0) {
        const sf = this.shapedFonts.get(fontKey);
        if (sf && this.shaper) {
            const shaped = this.shaper.shape(sf, text, { rtl });
            this.currentPage!.drawShapedRun(shaped, { x, y, size, font: fontKey, rtl, color, wordSpacing, letterSpacing });
        } else {
            this.currentPage!.drawText(text, { x, y, size, font: fontKey, color, wordSpacing, letterSpacing });
        }
    }

    private drawWrappedText(text: string, x: number, y: number, maxWidth: number, size: number, fontKey: string, rtl: boolean, align: 'left' | 'right' | 'center' | 'justify', color?: [number, number, number] | [number, number, number, number], wordSpacing?: number, letterSpacing?: number) {
        const sf = this.shapedFonts.get(fontKey);
        if (!sf || !this.shaper) {
            this.drawSingleLine(text, x, y, size, fontKey, rtl, color, wordSpacing, letterSpacing);
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
            return (totalAdvance * scale) + ((letterSpacing || 0) * shaped.length); 
        };

        for (let i=0; i < words.length; i++) {
            const word = words[i];
            const testLine = [...currentLine, word].join(' ');
            const width = measure(testLine);
            
            if (width > maxWidth && currentLine.length > 0) {
                const lineStr = currentLine.join(' ');
                this.drawLineAligned(lineStr, x, currentY, maxWidth, size, fontKey, rtl, align, color, wordSpacing, letterSpacing);
                currentY -= lineHeight;
                currentLine = [word];
            } else {
                currentLine.push(word);
            }
        }
        if (currentLine.length > 0) {
            this.drawLineAligned(currentLine.join(' '), x, currentY, maxWidth, size, fontKey, rtl, align, color, wordSpacing, letterSpacing);
        }
    }

    private drawLineAligned(text: string, x: number, y: number, maxWidth: number, size: number, fontKey: string, rtl: boolean, align: string, color?: [number, number, number] | [number, number, number, number], explicitWordSpacing: number = 0, letterSpacing: number = 0) {
        const totalWidth = this.measureText(text, size, { font: fontKey, rtl, letterSpacing });
        
        // Safety inset matches drawRunsAligned
        const safetyInset = 1.0;
        const availableWidth = maxWidth - (safetyInset * 2);
        let drawX = x + safetyInset;

        if (align === 'center') drawX += (availableWidth - totalWidth) / 2;
        else if (align === 'right') drawX += (availableWidth - totalWidth);

        const runs = this.splitIntoRuns(text);
        // Determine base direction based on the first strong character
        const firstStrongRun = runs.find(r => r.text.trim().length > 0);
        const isLineRtl = firstStrongRun ? firstStrongRun.isRtl : false;

        let wordSpacing = explicitWordSpacing;
        if (align === 'justify' && availableWidth > totalWidth) {
            const spaceCount = text.trim().split(/\s+/).length - 1;
            if (spaceCount > 0) {
                wordSpacing += (availableWidth - totalWidth) / spaceCount;
            }
        }

        if (isLineRtl) {
            let currentX = (align === 'justify') ? (x + safetyInset + availableWidth) : (drawX + totalWidth);
            for (const run of runs) {
                const runW = this.measureText(run.text, size, { font: run.font, rtl: run.isRtl, letterSpacing });
                const numSpaces = run.text.split(' ').length - 1;
                const justifiedRunW = runW + (numSpaces * wordSpacing);
                
                this.drawSingleLine(run.text, currentX - justifiedRunW, y, size, run.font, run.isRtl, color, wordSpacing, letterSpacing);
                currentX -= justifiedRunW;
            }
        } else {
            let currentX = drawX;
            for (const run of runs) {
                const runW = this.measureText(run.text, size, { font: run.font, rtl: run.isRtl, letterSpacing });
                const numSpaces = run.text.split(' ').length - 1;
                const justifiedRunW = runW + (numSpaces * wordSpacing);

                this.drawSingleLine(run.text, currentX, y, size, run.font, run.isRtl, color, wordSpacing, letterSpacing);
                currentX += justifiedRunW;
            }
        }
    }

    rect(x: number, y: number, w: number, h: number, style: 'F' | 'S' | 'FD' | 'N' = 'S', color?: string, lineWidth?: number) {
        if (!this.currentPage) throw new Error("No page exists.");

        const rgb = this.parseColor(color);

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

        const rgb = this.parseColor(color);

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

            if (path.opacity !== undefined) {
                this.saveGraphicsState();
                this.setOpacity(path.opacity);
                this.path(transformedPoints, style, fill || stroke, path.strokeWidth || 1);
                this.restoreGraphicsState();
            } else {
                this.path(transformedPoints, style, fill || stroke, path.strokeWidth || 1);
            }
        }
        return this;
    }

    gradient(colors: { offset: number, color: string }[], x0: number, y0: number, x1: number, y1: number) {
        if (!this.doc || !this.currentPage) throw new Error("Document not initialized.");

        const stops = colors.map(s => ({ offset: s.offset, color: (this.parseColor(s.color) || [0, 0, 0]) as [number, number, number] }));
        const shading = this.doc.addShading(stops, [x0, y0, x1, y1]);
        
        this.currentPage.addShadingResource(shading.name, shading.ref);
        this.currentPage.drawShading(shading.name);
        return this;
    }

    radialGradient(colors: { offset: number, color: string }[], x0: number, y0: number, r0: number, x1: number, y1: number, r1: number) {
        if (!this.doc || !this.currentPage) throw new Error("Document not initialized.");

        const stops = colors.map(s => ({ offset: s.offset, color: (this.parseColor(s.color) || [0, 0, 0]) as [number, number, number] }));
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

    /**
     * Draw a QR code on the current page.
     * @param text - The text/URL to encode
     * @param x - X position (left edge)
     * @param y - Y position (bottom edge)
     * @param size - Size of the QR code in points
     * @param options - QR code options
     * @example
     * pdf.qrCode('https://example.com', 100, 500, 100);
     * pdf.qrCode('Hello World', 50, 400, 80, { errorCorrection: 'H', color: '#333333' });
     */
    qrCode(text: string, x: number, y: number, size: number, options: {
        /** Error correction level: L (7%), M (15%), Q (25%), H (30%) */
        errorCorrection?: ErrorCorrectionLevel;
        /** Module color (default: black) */
        color?: string;
        /** Background color (default: white, use 'transparent' for none) */
        backgroundColor?: string;
    } = {}) {
        if (!this.currentPage) throw new Error("No page exists.");

        const qr = generateQRCode(text, { errorCorrection: options.errorCorrection || 'M' });
        const moduleSize = size / qr.size;
        const color = this.parseColor(options.color) || [0, 0, 0];
        const bgColor = options.backgroundColor === 'transparent' ? null : (this.parseColor(options.backgroundColor) || [1, 1, 1]);

        // Draw background
        if (bgColor) {
            this.currentPage.drawRect({
                x, y, width: size, height: size,
                fill: true, stroke: false,
                color: bgColor as [number, number, number]
            });
        }

        // Draw QR modules (black squares)
        for (let row = 0; row < qr.size; row++) {
            for (let col = 0; col < qr.size; col++) {
                if (qr.matrix[row][col]) {
                    const moduleX = x + col * moduleSize;
                    // PDF y-axis is from bottom, QR matrix row 0 is at top
                    const moduleY = y + size - (row + 1) * moduleSize;
                    this.currentPage.drawRect({
                        x: moduleX, y: moduleY,
                        width: moduleSize, height: moduleSize,
                        fill: true, stroke: false,
                        color: color as [number, number, number]
                    });
                }
            }
        }

        return this;
    }

    /**
     * Draw a Code128 barcode on the current page.
     * @param text - The text to encode (supports ASCII characters)
     * @param x - X position (left edge)
     * @param y - Y position (bottom edge)
     * @param options - Barcode display options
     * @example
     * pdf.barcode('ABC-12345', 100, 500);
     * pdf.barcode('12345678', 50, 400, { width: 200, height: 50 });
     */
    barcode(text: string, x: number, y: number, options: {
        /** Total width in points (default: auto based on content) */
        width?: number;
        /** Height in points (default: 50) */
        height?: number;
        /** Bar color (default: black) */
        color?: string;
        /** Background color (default: white, use 'transparent' for none) */
        backgroundColor?: string;
        /** Show text below barcode (default: true) */
        showText?: boolean;
        /** Font for text label */
        font?: string;
        /** Font size for text label (default: 10) */
        fontSize?: number;
    } = {}) {
        if (!this.currentPage) throw new Error("No page exists.");

        const bc = generateCode128(text);
        const height = options.height || 50;
        const color = this.parseColor(options.color) || [0, 0, 0];
        const bgColor = options.backgroundColor === 'transparent' ? null : (this.parseColor(options.backgroundColor) || [1, 1, 1]);
        const showText = options.showText !== false;
        const fontSize = options.fontSize || 10;

        // Calculate module width
        const totalModules = bc.width;
        const targetWidth = options.width || totalModules * 1.5; // default ~1.5 points per module
        const moduleWidth = targetWidth / totalModules;

        // Draw background
        const totalHeight = showText ? height + fontSize + 4 : height;
        if (bgColor) {
            this.currentPage.drawRect({
                x, y, width: targetWidth, height: totalHeight,
                fill: true, stroke: false,
                color: bgColor as [number, number, number]
            });
        }

        // Draw bars
        let currentX = x;
        let isBlack = true; // Code128 starts with a black bar

        for (const barWidth of bc.bars) {
            if (isBlack) {
                this.currentPage.drawRect({
                    x: currentX,
                    y: showText ? y + fontSize + 4 : y,
                    width: barWidth * moduleWidth,
                    height: height,
                    fill: true, stroke: false,
                    color: color as [number, number, number]
                });
            }
            currentX += barWidth * moduleWidth;
            isBlack = !isBlack;
        }

        // Draw text label
        if (showText) {
            const textWidth = this.measureText(text, fontSize, { font: options.font });
            const textX = x + (targetWidth - textWidth) / 2;
            this.text(text, textX, y + 2, {
                font: options.font,
                size: fontSize,
                color: options.color
            });
        }

        return this;
    }

    /**
     * Draw an EAN-13 barcode on the current page.
     * @param digits - 12 or 13 digit number (check digit auto-calculated if 12)
     * @param x - X position (left edge)
     * @param y - Y position (bottom edge)
     * @param options - Barcode display options
     * @example
     * pdf.ean13('5901234123457', 100, 500);
     * pdf.ean13('590123412345', 50, 400, { width: 150, height: 60 });
     */
    ean13(digits: string, x: number, y: number, options: {
        /** Total width in points (default: 143 - standard width) */
        width?: number;
        /** Height in points (default: 70) */
        height?: number;
        /** Bar color (default: black) */
        color?: string;
        /** Background color (default: white, use 'transparent' for none) */
        backgroundColor?: string;
        /** Show digits below barcode (default: true) */
        showText?: boolean;
        /** Font for text label */
        font?: string;
        /** Font size for text label (default: 10) */
        fontSize?: number;
    } = {}) {
        if (!this.currentPage) throw new Error("No page exists.");

        const bc = generateEAN13(digits);
        const height = options.height || 70;
        const color = this.parseColor(options.color) || [0, 0, 0];
        const bgColor = options.backgroundColor === 'transparent' ? null : (this.parseColor(options.backgroundColor) || [1, 1, 1]);
        const showText = options.showText !== false;
        const fontSize = options.fontSize || 10;

        // EAN-13 has 95 modules total width
        const targetWidth = options.width || 143; // Standard EAN-13 width at 1.5x
        const moduleWidth = targetWidth / 95;

        // Draw background
        const totalHeight = showText ? height + fontSize + 4 : height;
        if (bgColor) {
            this.currentPage.drawRect({
                x, y, width: targetWidth, height: totalHeight,
                fill: true, stroke: false,
                color: bgColor as [number, number, number]
            });
        }

        // Draw bars
        let currentX = x;
        let isBlack = true; // EAN-13 starts with a black bar (start guard)

        for (const barWidth of bc.bars) {
            if (isBlack) {
                this.currentPage.drawRect({
                    x: currentX,
                    y: showText ? y + fontSize + 4 : y,
                    width: barWidth * moduleWidth,
                    height: height,
                    fill: true, stroke: false,
                    color: color as [number, number, number]
                });
            }
            currentX += barWidth * moduleWidth;
            isBlack = !isBlack;
        }

        // Draw text label (EAN-13 format: first digit outside, then groups of 6)
        if (showText) {
            const fullDigits = bc.text;
            // First digit (slightly to the left of barcode)
            this.text(fullDigits[0], x - fontSize * 0.8, y + 2, {
                font: options.font, size: fontSize, color: options.color
            });
            // Left group (digits 2-7)
            const leftGroup = fullDigits.slice(1, 7);
            const leftX = x + 11 * moduleWidth;
            this.text(leftGroup, leftX, y + 2, {
                font: options.font, size: fontSize, color: options.color, letterSpacing: moduleWidth * 1.2
            });
            // Right group (digits 8-13)
            const rightGroup = fullDigits.slice(7, 13);
            const rightX = x + 50 * moduleWidth;
            this.text(rightGroup, rightX, y + 2, {
                font: options.font, size: fontSize, color: options.color, letterSpacing: moduleWidth * 1.2
            });
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

/**
 * Helper interface for header/footer text options
 */
export interface HeaderFooterOptions {
    text: string;
    font?: string;
    size?: number;
    color?: string;
    align?: 'left' | 'center' | 'right';
}

/**
 * Create a simple text-based header/footer element for use with LayoutEngine.renderFlow()
 * Supports placeholders: {pageNum}, {totalPages}, {page}, {total}
 *
 * @example
 * layout.renderFlow(content, {
 *     footer: createPageFooter({ text: 'Page {pageNum} of {totalPages}', align: 'center' })
 * });
 */
export function createPageFooter(options: HeaderFooterOptions): (page: number, total: number) => any {
    const { text, font = 'F1', size = 10, color = '#666666', align = 'center' } = options;

    return (page: number, total: number) => ({
        type: 'text',
        content: text
            .replace(/\{pageNum\}/g, String(page))
            .replace(/\{totalPages\}/g, String(total))
            .replace(/\{page\}/g, String(page))
            .replace(/\{total\}/g, String(total)),
        options: { font, size, color, align }
    });
}

/**
 * Create a simple text-based header element for use with LayoutEngine.renderFlow()
 * Supports placeholders: {pageNum}, {totalPages}, {page}, {total}
 *
 * @example
 * layout.renderFlow(content, {
 *     header: createPageHeader({ text: 'My Document - Page {pageNum}', align: 'right' })
 * });
 */
export function createPageHeader(options: HeaderFooterOptions): (page: number, total: number) => any {
    return createPageFooter(options); // Same implementation, different name for clarity
}

// ============================================
// Unit Conversion Helpers
// ============================================
// PDF uses points as the base unit (1 point = 1/72 inch)

/**
 * Convert millimeters to PDF points
 * @param value - Length in millimeters
 * @returns Length in points
 * @example
 * pdf.addPage({ width: mm(210), height: mm(297) }); // A4 size
 */
export function mm(value: number): number {
    return value * (72 / 25.4);
}

/**
 * Convert centimeters to PDF points
 * @param value - Length in centimeters
 * @returns Length in points
 * @example
 * pdf.rect(cm(1), cm(1), cm(5), cm(2));
 */
export function cm(value: number): number {
    return value * (72 / 2.54);
}

/**
 * Convert inches to PDF points
 * @param value - Length in inches
 * @returns Length in points
 * @example
 * pdf.addPage({ width: inches(8.5), height: inches(11) }); // US Letter
 */
export function inches(value: number): number {
    return value * 72;
}

/**
 * Convert PDF points to millimeters
 * @param value - Length in points
 * @returns Length in millimeters
 */
export function toMm(value: number): number {
    return value * (25.4 / 72);
}

/**
 * Convert PDF points to centimeters
 * @param value - Length in points
 * @returns Length in centimeters
 */
export function toCm(value: number): number {
    return value * (2.54 / 72);
}

/**
 * Convert PDF points to inches
 * @param value - Length in points
 * @returns Length in inches
 */
export function toInches(value: number): number {
    return value / 72;
}
