export interface LayoutOptions {
    width?: number;
    height?: number;
    padding?: number | [number, number] | [number, number, number, number]; // uniform | [v, h] | [t, r, b, l]
    margin?: number | [number, number] | [number, number, number, number];
    gap?: number;
    align?: 'start' | 'center' | 'end';
    backgroundColor?: string;
    borderColor?: string;
    borderWidth?: number;
    borderRadius?: number;
}

export interface TextElementOptions {
    font?: string;
    size?: number;
    rtl?: boolean;
    color?: string;
    align?: 'left' | 'right' | 'center' | 'justify';
    width?: number;
    lineHeight?: number;
}

export type LayoutElement = 
    | { type: 'text', content: string, options?: TextElementOptions }
    | { type: 'rect', width: number, height: number, options?: { style?: 'F'|'S'|'FD', color?: string } }
    | { type: 'image', data: Uint8Array, imgType: 'jpeg' | 'png', width: number, height: number }
    | { type: 'vstack' | 'hstack', children: LayoutElement[], options?: LayoutOptions }
    | { type: 'box', child: LayoutElement, options?: LayoutOptions }
    | { type: 'spacer', size: number };

interface SideValues {
    top: number;
    right: number;
    bottom: number;
    left: number;
}

function parseSides(val: number | [number, number] | [number, number, number, number] | undefined): SideValues {
    if (val === undefined) return { top: 0, right: 0, bottom: 0, left: 0 };
    if (typeof val === 'number') return { top: val, right: val, bottom: val, left: val };
    if (val.length === 2) return { top: val[0], right: val[1], bottom: val[0], left: val[1] };
    return { top: val[0], right: val[1], bottom: val[2], left: val[3] };
}

export class LayoutEngine {
    constructor(private doc: any) {}

    render(element: LayoutElement, x: number, y: number) {
        const { width, height } = this.calculateSize(element);
        this.drawElement(element, x, y, width, height);
    }

    getSize(element: LayoutElement) {
        return this.calculateSize(element);
    }

    calculateSize(el: LayoutElement): { width: number, height: number } {
        let w = 0, h = 0;

        if (el.type === 'text') {
            const size = el.options?.size || 12;
            const font = el.options?.font;
            const rtl = el.options?.rtl;
            const maxWidth = el.options?.width;

            if (maxWidth && maxWidth > 0) {
                // Multi-line wrapping calculation
                const lines = this.wrapText(el.content, maxWidth, size, font, rtl);
                w = maxWidth;
                h = lines.length * (size * 1.4);
            } else {
                // Single line
                w = this.doc.measureText(el.content, size, { font, rtl });
                h = size * 1.2;
            }
        } else if (el.type === 'rect' || el.type === 'image') {
            w = el.width;
            h = el.height;
        } else if (el.type === 'spacer') {
            w = el.size;
            h = el.size;
        } else if (el.type === 'vstack') {
            const gap = el.options?.gap || 0;
            const sizes = el.children.map(c => this.calculateSize(c));
            w = Math.max(...sizes.map(s => s.width), el.options?.width || 0);
            h = sizes.reduce((acc, s) => acc + s.height, 0) + (el.children.length > 0 ? (el.children.length - 1) * gap : 0);
        } else if (el.type === 'hstack') {
            const gap = el.options?.gap || 0;
            const sizes = el.children.map(c => this.calculateSize(c));
            w = sizes.reduce((acc, s) => acc + s.width, 0) + (el.children.length > 0 ? (el.children.length - 1) * gap : 0);
            h = Math.max(...sizes.map(s => s.height), el.options?.height || 0);
        } else if (el.type === 'box') {
            const inner = this.calculateSize(el.child);
            w = inner.width;
            h = inner.height;
        }

        // Add padding
        if ('options' in el && el.options) {
            const p = parseSides((el.options as any).padding);
            const m = parseSides((el.options as any).margin);
            w += p.left + p.right + m.left + m.right;
            h += p.top + p.bottom + m.top + m.bottom;

            // Override with fixed dimensions if provided
            if ((el.options as any).width) w = (el.options as any).width + m.left + m.right;
            if ((el.options as any).height) h = (el.options as any).height + m.top + m.bottom;
        }

        return { width: w, height: h };
    }

    private drawElement(el: LayoutElement, x: number, y: number, w: number, h: number) {
        const options: LayoutOptions = (el as any).options || {};
        const m = parseSides(options.margin);
        const p = parseSides(options.padding);

        const innerX = x + m.left;
        const innerY = y - m.top;
        const innerW = w - m.left - m.right;
        const innerH = h - m.top - m.bottom;

        // Draw Background and Border
        if (options.backgroundColor || (options.borderColor && options.borderWidth)) {
            const style = options.backgroundColor && options.borderColor ? 'FD' : (options.backgroundColor ? 'F' : 'S');
            
            if (options.borderRadius && this.doc.roundedRect) {
                this.doc.roundedRect(innerX, innerY - innerH, innerW, innerH, options.borderRadius, style, options.backgroundColor || options.borderColor);
                // Note: simplified color logic, assuming single color for both or doc handles it
            } else {
                this.doc.rect(innerX, innerY - innerH, innerW, innerH, style, options.backgroundColor || options.borderColor);
            }
        }

        const contentX = innerX + p.left;
        const contentY = innerY - p.top;
        const contentW = innerW - p.left - p.right;
        const contentH = innerH - p.top - p.bottom;

        if (el.type === 'text') {
            const size = el.options?.size || 12;
            const maxWidth = el.options?.width;
            const lineHeightVal = el.options?.lineHeight || 1.4;
            const align = el.options?.align || 'left';

            if (maxWidth && maxWidth > 0) {
                const lines = this.wrapText(el.content, maxWidth, size, el.options?.font, el.options?.rtl);
                let currentY = contentY;
                const lineHeight = size * lineHeightVal;
                
                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i];
                    const isLastLine = i === lines.length - 1;
                    
                    if (align === 'justify' && !isLastLine && !el.options?.rtl) {
                        // Implement manual justification for LTR text
                        const words = line.trim().split(/\s+/);
                        if (words.length > 1) {
                            const wordWidths = words.map(w => this.doc.measureText(w, size, { font: el.options?.font }));
                            const totalWordWidth = wordWidths.reduce((a, b) => a + b, 0);
                            const availableSpace = maxWidth - totalWordWidth;
                            const spacePerGap = availableSpace / (words.length - 1);
                            
                            let wordX = contentX;
                            for (let j = 0; j < words.length; j++) {
                                this.doc.text(words[j], wordX, currentY - size, el.options);
                                wordX += wordWidths[j] + spacePerGap;
                            }
                        } else {
                            this.doc.text(line, contentX, currentY - size, el.options);
                        }
                    } else if (align === 'center') {
                        const lineWidth = this.doc.measureText(line, size, { font: el.options?.font, rtl: el.options?.rtl });
                        const centerOffset = (maxWidth - lineWidth) / 2;
                        this.doc.text(line, contentX + centerOffset, currentY - size, el.options);
                    } else if (align === 'right' || (el.options?.rtl && align !== 'left')) {
                         const lineWidth = this.doc.measureText(line, size, { font: el.options?.font, rtl: el.options?.rtl });
                         const rightOffset = maxWidth - lineWidth;
                         this.doc.text(line, contentX + rightOffset, currentY - size, el.options);
                    } else {
                        // Left aligned (default)
                        this.doc.text(line, contentX, currentY - size, el.options);
                    }
                    currentY -= lineHeight;
                }
            } else {
                this.doc.text(el.content, contentX, contentY - (el.options?.size || 12), el.options);
            }
        } else if (el.type === 'rect') {
            this.doc.rect(contentX, contentY - contentH, contentW, contentH, el.options?.style, el.options?.color);
        } else if (el.type === 'image') {
            this.doc.image(el.data, el.imgType, contentX, contentY - contentH, contentW, contentH);
        } else if (el.type === 'vstack') {
            const gap = options.gap || 0;
            let currentY = contentY;
            for (const child of el.children) {
                const size = this.calculateSize(child);
                let offsetX = 0;
                const childW = size.width - parseSides((child as any).options?.margin).left - parseSides((child as any).options?.margin).right;
                if (options.align === 'center') offsetX = (contentW - size.width) / 2;
                else if (options.align === 'end') offsetX = contentW - size.width;
                
                this.drawElement(child, contentX + offsetX, currentY, size.width, size.height);
                currentY -= (size.height + gap);
            }
        } else if (el.type === 'hstack') {
            const gap = options.gap || 0;
            let currentX = contentX;
            for (const child of el.children) {
                const size = this.calculateSize(child);
                let offsetY = 0;
                if (options.align === 'center') offsetY = (contentH - size.height) / 2;
                else if (options.align === 'end') offsetY = contentH - size.height;

                this.drawElement(child, currentX, contentY - offsetY, size.width, size.height);
                currentX += (size.width + gap);
            }
        } else if (el.type === 'box') {
            const size = this.calculateSize(el.child);
            this.drawElement(el.child, contentX, contentY, size.width, size.height);
        }
    }

    private wrapText(text: string, maxWidth: number, size: number, font?: string, rtl?: boolean): string[] {
        const words = text.split(/\s+/);
        const lines: string[] = [];
        let currentLine: string[] = [];

        for (const word of words) {
            const testLine = [...currentLine, word].join(' ');
            const width = this.doc.measureText(testLine, size, { font, rtl });
            if (width > maxWidth && currentLine.length > 0) {
                lines.push(currentLine.join(' '));
                currentLine = [word];
            } else {
                currentLine.push(word);
            }
        }
        if (currentLine.length > 0) lines.push(currentLine.join(' '));
        return lines;
    }
}
