export interface LayoutOptions {
    width?: number;
    height?: number;
    padding?: number | [number, number] | [number, number, number, number]; // uniform | [v, h] | [t, r, b, l]
    margin?: number | [number, number] | [number, number, number, number];
    gap?: number;
    align?: 'start' | 'center' | 'end' | 'space-between' | 'space-evenly';
    backgroundColor?: string;
    borderColor?: string;
    borderWidth?: number;
    borderRadius?: number;
    opacity?: number;
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
    | { type: 'rect', width: number, height: number, options?: { style?: 'F'|'S'|'FD'|'N', color?: string, opacity?: number } }
    | { type: 'image', data: Uint8Array | string, imgType: 'jpeg' | 'png', width: number, height: number, options?: { align?: 'center' | 'end' | 'start', objectFit?: 'fill' | 'contain' | 'cover' } }
    | { type: 'svg', content: string, width: number, height: number, options?: { color?: string, scale?: number } }
    | { type: 'link', url: string, child: LayoutElement, options?: LayoutOptions }
    | { type: 'vstack' | 'hstack' | 'zstack', children: LayoutElement[], options?: LayoutOptions }
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

    renderFlow(element: LayoutElement, options: { 
        topMargin?: number, 
        bottomMargin?: number, 
        leftMargin?: number,
        header?: LayoutElement | ((page: number) => LayoutElement),
        footer?: LayoutElement | ((page: number) => LayoutElement)
    } = {}) {
        const top = options.topMargin ?? 50;
        const bottom = options.bottomMargin ?? 50;
        const left = options.leftMargin ?? 0;
        const pageHeight = 842; // Standard A4

        const getHeader = (page: number) => typeof options.header === 'function' ? options.header(page) : options.header;
        const getFooter = (page: number) => typeof options.footer === 'function' ? options.footer(page) : options.footer;

        if (element.type === 'vstack') {
            const gap = element.options?.gap || 0;
            let pageNumber = 1;

            let headerEl = getHeader(pageNumber);
            let footerEl = getFooter(pageNumber);
            let headerSize = headerEl ? this.calculateSize(headerEl) : { width: 0, height: 0 };
            let footerSize = footerEl ? this.calculateSize(footerEl) : { width: 0, height: 0 };

            let currentY = pageHeight - top - headerSize.height;

            // Draw initial header
            if (headerEl) this.drawElement(headerEl, left, pageHeight - top, headerSize.width, headerSize.height);

            element.children.forEach((child) => {
                const { width, height } = this.calculateSize(child);
                
                // If child is too tall for current page, move to next page
                if (currentY - height < bottom + footerSize.height) {
                    // Draw current footer before leaving
                    if (footerEl) this.drawElement(footerEl, left, bottom + footerSize.height, footerSize.width, footerSize.height);

                    this.doc.addPage();
                    pageNumber++;

                    headerEl = getHeader(pageNumber);
                    footerEl = getFooter(pageNumber);
                    headerSize = headerEl ? this.calculateSize(headerEl) : { width: 0, height: 0 };
                    footerSize = footerEl ? this.calculateSize(footerEl) : { width: 0, height: 0 };

                    currentY = pageHeight - top - headerSize.height;
                    if (headerEl) this.drawElement(headerEl, left, pageHeight - top, headerSize.width, headerSize.height);
                }

                this.drawElement(child, left, currentY, width, height);
                currentY -= (height + gap);
            });

            // Draw the last page footer
            if (footerEl) this.drawElement(footerEl, left, bottom + footerSize.height, footerSize.width, footerSize.height);
        } else {
            // For non-vstack elements, just render normally at the top
            const headerEl = getHeader(1);
            const headerSize = headerEl ? this.calculateSize(headerEl) : { width: 0, height: 0 };
            if (headerEl) this.drawElement(headerEl, left, pageHeight - top, headerSize.width, headerSize.height);
            this.render(element, left, pageHeight - top - headerSize.height);
            const footerEl = getFooter(1);
            const footerSize = footerEl ? this.calculateSize(footerEl) : { width: 0, height: 0 };
            if (footerEl) this.drawElement(footerEl, left, bottom + footerSize.height, footerSize.width, footerSize.height);
        }
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
                h = lines.length * (size * (el.options?.lineHeight || 1.4));
            } else {
                // Single line
                w = this.doc.measureText(el.content, size, { font, rtl });
                h = size * (el.options?.lineHeight || 1.2); // slight buffer
            }
        } else if (el.type === 'rect' || el.type === 'image' || el.type === 'svg') {
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
        } else if (el.type === 'zstack') {
            const sizes = el.children.map(c => this.calculateSize(c));
            w = Math.max(...sizes.map(s => s.width), el.options?.width || 0);
            h = Math.max(...sizes.map(s => s.height), el.options?.height || 0);
        } else if (el.type === 'box' || el.type === 'link') {
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

        // 1. Draw Background (Fill only) - Drawn FIRST
        if (options.backgroundColor) {
            const style = 'F';
            if (options.borderRadius) {
                this.doc.saveGraphicsState();
                if (this.doc.roundedRect) {
                    this.doc.roundedRect(innerX, innerY - innerH, innerW, innerH, options.borderRadius, style, options.backgroundColor);
                    
                    // Create clipping path for child content
                    this.doc.roundedRect(innerX, innerY - innerH, innerW, innerH, options.borderRadius, 'N'); 
                }
            } else {
                this.doc.rect(innerX, innerY - innerH, innerW, innerH, style, options.backgroundColor);
            }
        } else if (options.borderRadius) {
             // If no background but rounded, we still need to clip
             this.doc.saveGraphicsState();
             this.doc.roundedRect(innerX, innerY - innerH, innerW, innerH, options.borderRadius, 'N');
        }

        const contentX = innerX + p.left;
        const contentY = innerY - p.top;
        const contentW = innerW - p.left - p.right;
        const contentH = innerH - p.top - p.bottom;

        // Apply Opacity
        if (options.opacity !== undefined) {
            this.doc.setOpacity(options.opacity);
        }

        if (el.type === 'text') {
            const size = el.options?.size || 12;
            const maxWidth = el.options?.width;
            const lineHeightVal = el.options?.lineHeight || 1.4;
            const align = el.options?.align || 'left';
            const safetyInset = 2.0; // Increased buffer for wrapping math

            if (maxWidth && maxWidth > 0) {
                const effectiveWidth = maxWidth - (safetyInset * 2);
                const lines = this.wrapText(el.content, effectiveWidth, size, el.options?.font, el.options?.rtl);
                const lineHeight = size * lineHeightVal;
                // Move first line down so it's not at the very top of the content area
                let currentY = contentY - size;
                
                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i];
                    const isLastLine = i === lines.length - 1;
                    
                    // Call doc.text with the alignment. Core doc.text now handles justification and Bidi reordering.
                    this.doc.text(line, contentX, currentY, { ...el.options, width: maxWidth, align: isLastLine && align === 'justify' ? (el.options?.rtl ? 'right' : 'left') : align });
                    currentY -= lineHeight;
                }
            } else {
                this.doc.text(el.content, contentX, contentY - (el.options?.size || 12), el.options);
            }
        } else if (el.type === 'rect') {
            this.doc.rect(contentX, contentY - contentH, contentW, contentH, el.options?.style, el.options?.color);
        } else if (el.type === 'image') {
            const fit = el.options?.objectFit || 'fill';
            
            if (fit === 'fill') {
                this.doc.image(el.data, el.imgType, contentX, contentY - contentH, contentW, contentH);
            } else {
                const dims = this.doc.getImageDimensions(el.data, el.imgType);
                const imgRatio = dims.width / dims.height;
                const containerRatio = contentW / contentH;
                
                let drawW = contentW;
                let drawH = contentH;
                let offsetX = 0;
                let offsetY = 0;
                
                if (fit === 'contain') {
                    if (imgRatio > containerRatio) {
                        drawH = contentW / imgRatio;
                        offsetY = (contentH - drawH) / 2;
                    } else {
                        drawW = contentH * imgRatio;
                        offsetX = (contentW - drawW) / 2;
                    }
                    this.doc.image(el.data, el.imgType, contentX + offsetX, contentY - contentH + offsetY, drawW, drawH);
                } else if (fit === 'cover') {
                    if (imgRatio > containerRatio) {
                        drawW = contentH * imgRatio;
                        drawH = contentH;
                        offsetX = (drawW - contentW) / 2;
                        offsetY = 0;
                    } else {
                        drawW = contentW;
                        drawH = contentW / imgRatio;
                        offsetX = 0;
                        offsetY = (drawH - contentH) / 2;
                    }
                    
                    this.doc.saveGraphicsState();
                    this.doc.rect(contentX, contentY - contentH, contentW, contentH, 'N');
                    this.doc.clip();
                    this.doc.image(el.data, el.imgType, contentX - offsetX, contentY - contentH - offsetY, drawW, drawH);
                    this.doc.restoreGraphicsState();
                }
            }
        } else if (el.type === 'svg') {
            this.doc.svg(el.content, contentX, contentY, { 
                scale: el.options?.scale, 
                color: el.options?.color 
            });
        } else if (el.type === 'vstack') {
            const gap = options.gap || 0;
            const childrenSizes = el.children.map(c => this.calculateSize(c));
            
            // Calculate Distribution Spacing
            let effectiveGap = gap;
            if (options.align === 'space-between' && el.children.length > 1) {
                const totalChildHeight = childrenSizes.reduce((a, b) => a + b.height, 0);
                effectiveGap = (contentH - totalChildHeight) / (el.children.length - 1);
            } else if (options.align === 'space-evenly' && el.children.length > 0) {
                const totalChildHeight = childrenSizes.reduce((a, b) => a + b.height, 0);
                effectiveGap = (contentH - totalChildHeight) / (el.children.length + 1);
            }

            let currentY = contentY;
            if (options.align === 'space-evenly') currentY -= effectiveGap;

            el.children.forEach((child, i) => {
                const size = childrenSizes[i];
                let offsetX = 0;
                if (options.align === 'center') offsetX = (contentW - size.width) / 2;
                else if (options.align === 'end') offsetX = contentW - size.width;
                
                this.drawElement(child, contentX + offsetX, currentY, size.width, size.height);
                currentY -= (size.height + effectiveGap);
            });
        } else if (el.type === 'hstack') {
            const childrenSizes = el.children.map(c => this.calculateSize(c));
            
            let effectiveGap = options.gap || 0;
            if (options.align === 'space-between' && el.children.length > 1) {
                const totalChildWidth = childrenSizes.reduce((a, b) => a + b.width, 0);
                effectiveGap = (contentW - totalChildWidth) / (el.children.length - 1);
            } else if (options.align === 'space-evenly' && el.children.length > 0) {
                const totalChildWidth = childrenSizes.reduce((a, b) => a + b.width, 0);
                effectiveGap = (contentW - totalChildWidth) / (el.children.length + 1);
            }

            let currentX = contentX;
            if (options.align === 'space-evenly') currentX += effectiveGap;

            el.children.forEach((child, i) => {
                const size = childrenSizes[i];
                let offsetY = 0;
                if (options.align !== 'space-between' && options.align !== 'space-evenly') {
                     if (options.align === 'center') offsetY = (contentH - size.height) / 2;
                     else if (options.align === 'end') offsetY = contentH - size.height;
                } else {
                    offsetY = (contentH - size.height) / 2;
                }

                this.drawElement(child, currentX, contentY - offsetY, size.width, size.height);
                currentX += (size.width + effectiveGap);
            });
        } else if (el.type === 'zstack') {
            for (const child of el.children) {
                const size = this.calculateSize(child);
                let offsetX = 0;
                let offsetY = 0;
                if (options.align === 'center') {
                    offsetX = (contentW - size.width) / 2;
                    offsetY = (contentH - size.height) / 2;
                } else if (options.align === 'end') {
                    offsetX = contentW - size.width;
                    offsetY = contentH - size.height;
                }
                this.drawElement(child, contentX + offsetX, contentY - offsetY, size.width, size.height);
            }
        } else if (el.type === 'link') {
            const size = this.calculateSize(el.child);
            this.doc.addLink(el.url, contentX, contentY - size.height, size.width, size.height);
            this.drawElement(el.child, contentX, contentY, size.width, size.height);
        } else if (el.type === 'box') {
            const size = this.calculateSize(el.child);
            let childX = contentX;
            let childY = contentY;
            
            if (options.align === 'center') {
                childX += (contentW - size.width) / 2;
                childY -= (contentH - size.height) / 2; 
            } else if (options.align === 'end') {
                childX += contentW - size.width;
                childY -= contentH - size.height; 
            }
            
            this.drawElement(el.child, childX, childY, size.width, size.height);
        }
        
        // Restore graphics state if we clipped
        if (options.borderRadius) {
            this.doc.restoreGraphicsState();
        }
        
        // Reset Opacity
        if (options.opacity !== undefined) {
            this.doc.setOpacity(1.0);
        }

        // Draw Border (Stroke only) - Drawn LAST (on top of content)
        if (options.borderColor && options.borderWidth) {
            const style = 'S';
            if (options.borderRadius && this.doc.roundedRect) {
                this.doc.roundedRect(innerX, innerY - innerH, innerW, innerH, options.borderRadius, style, options.borderColor, options.borderWidth);
            } else {
                this.doc.rect(innerX, innerY - innerH, innerW, innerH, style, options.borderColor, options.borderWidth);
            }
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
