export interface LayoutOptions {
    width?: number | string;
    height?: number | string;
    padding?: number | [number, number] | [number, number, number, number]; // uniform | [v, h] | [t, r, b, l]
    margin?: number | [number, number] | [number, number, number, number];
    gap?: number;
    align?: 'start' | 'center' | 'end' | 'space-between' | 'space-evenly';
    backgroundColor?: string;
    backgroundGradient?: { colors: { offset: number, color: string }[], direction?: 'vertical' | 'horizontal' };
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
    width?: number | string;
    lineHeight?: number;
}

export type LayoutElement = 
    | { type: 'text', content: string, options?: TextElementOptions }
    | { type: 'rect', width: number, height: number, options?: { style?: 'F'|'S'|'FD'|'N', color?: string, opacity?: number } }
    | { type: 'image', data: Uint8Array | string, imgType: 'jpeg' | 'png', width: number, height: number, options?: { align?: 'center' | 'end' | 'start', objectFit?: 'fill' | 'contain' | 'cover' } }
    | { type: 'svg', content: string, width: number, height: number, options?: { color?: string, scale?: number } }
    | { type: 'link', url: string, targetPage?: number, child: LayoutElement, options?: LayoutOptions }
    | { type: 'vstack' | 'hstack' | 'zstack', children: LayoutElement[], options?: LayoutOptions }
    | { type: 'table', headers: (string | LayoutElement)[], rows: (string | LayoutElement)[][], columnWidths?: number[], options?: TableOptions }
    | { type: 'box', child: LayoutElement, options?: LayoutOptions }
    | { type: 'spacer', size: number };

export interface TableOptions extends LayoutOptions {
    headerBackgroundColor?: string;
    headerTextColor?: string;
    alternateRowBackgroundColor?: string;
    rowPadding?: number;
    fontSize?: number;
}

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

function resolveValue(val: number | string | undefined, parentVal: number): number {
    if (val === undefined) return 0;
    if (typeof val === 'number') return val;
    if (typeof val === 'string' && val.endsWith('%')) {
        const percent = parseFloat(val.slice(0, -1));
        return (percent / 100) * parentVal;
    }
    return parseFloat(val) || 0;
}

export class LayoutEngine {
    constructor(private doc: any) {}

    render(element: LayoutElement, x: number, y: number, parentWidth: number = 595) {
        const { width, height } = this.calculateSize(element, parentWidth, false);
        this.drawElement(element, x, y, width, height, parentWidth);
    }

    renderFlow(element: LayoutElement, options: { 
        topMargin?: number, 
        bottomMargin?: number, 
        leftMargin?: number,
        header?: LayoutElement | ((page: number, total: number) => LayoutElement),
        footer?: LayoutElement | ((page: number, total: number) => LayoutElement)
    } = {}) {
        const top = options.topMargin ?? 50;
        const bottom = options.bottomMargin ?? 50;
        const left = options.leftMargin ?? 0;
        const pageHeight = 842;
        const pageWidth = 595;

        const getHeader = (page: number, total: number) => typeof options.header === 'function' ? options.header(page, total) : options.header;
        const getFooter = (page: number, total: number) => typeof options.footer === 'function' ? options.footer(page, total) : options.footer;

        const contentWidth = pageWidth - left;

        if (element.type === 'vstack') {
            const gap = element.options?.gap || 0;
            let pageNumber = 1;
            
            const pageTasks: { pageObj: any, pageIdx: number, yTop: number, yBottom: number }[] = [];
            const registerPage = (obj: any, idx: number) => {
                pageTasks.push({ pageObj: obj, pageIdx: idx, yTop: pageHeight - top, yBottom: bottom });
            };

            registerPage(this.doc.activePage, pageNumber);

            const originalAddPage = this.doc.addPage.bind(this.doc);
            this.doc.addPage = (width = 595, height = 842) => {
                const p = originalAddPage(width, height);
                pageNumber++;
                registerPage(p, pageNumber);
                return p;
            };

            const firstHeader = getHeader(1, 1);
            const firstFooter = getFooter(1, 1);
            const hSize = firstHeader ? this.calculateSize(firstHeader, contentWidth, false) : { width: 0, height: 0 };
            const fSize = firstFooter ? this.calculateSize(firstFooter, contentWidth, false) : { width: 0, height: 0 };

            let currentY = pageHeight - top - hSize.height;

            element.children.forEach((child) => {
                const { width, height } = this.calculateSize(child, contentWidth, false);
                if (currentY - height < bottom + fSize.height) {
                    this.doc.addPage();
                    currentY = pageHeight - top - hSize.height;
                }
                this.drawElement(child, left, currentY, width, height, contentWidth);
                currentY -= (height + gap);
            });

            this.doc.addPage = originalAddPage;

            const totalPages = pageNumber;
            pageTasks.forEach(task => {
                const prevPage = this.doc.activePage;
                this.doc.activePage = task.pageObj;

                const hEl = getHeader(task.pageIdx, totalPages);
                const fEl = getFooter(task.pageIdx, totalPages);

                if (hEl) {
                    const size = this.calculateSize(hEl, contentWidth, false);
                    this.drawElement(hEl, left, task.yTop, size.width, size.height, contentWidth);
                }
                if (fEl) {
                    const size = this.calculateSize(fEl, contentWidth, false);
                    this.drawElement(fEl, left, task.yBottom + size.height, size.width, size.height, contentWidth);
                }
                this.doc.activePage = prevPage;
            });
        } else {
            const totalPages = 1;
            const hEl = getHeader(1, totalPages);
            const fEl = getFooter(1, totalPages);
            const hSize = hEl ? this.calculateSize(hEl, contentWidth, false) : { width: 0, height: 0 };
            const fSize = fEl ? this.calculateSize(fEl, contentWidth, false) : { width: 0, height: 0 };

            if (hEl) this.drawElement(hEl, left, pageHeight - top, hSize.width, hSize.height, contentWidth);
            this.render(element, left, pageHeight - top - hSize.height, contentWidth);
            if (fEl) this.drawElement(fEl, left, bottom + fSize.height, fSize.width, fSize.height, contentWidth);
        }
    }

    getSize(element: LayoutElement, parentWidth: number = 595) {
        return this.calculateSize(element, parentWidth, false);
    }

    calculateSize(el: LayoutElement, parentWidth: number, shrink: boolean): { width: number, height: number } {
        let w = 0, h = 0;

        const options = (el as any).options;
        const explicitWidth = options ? resolveValue(options.width, parentWidth) : undefined;
        const explicitHeight = options ? resolveValue(options.height, 0) : undefined;

        const pSides = parseSides(options?.padding);
        const resolvedWidth = explicitWidth || parentWidth;
        const childContextWidth = resolvedWidth - pSides.left - pSides.right;

        if (el.type === 'text') {
            const size = el.options?.size || 12;
            const measuredW = this.doc.measureText(el.content, size, { font: el.options?.font, rtl: el.options?.rtl });
            
            // Text defaults to filling width in block mode (so align: center works),
            // but shrinks to measured width in inline mode (hstack).
            w = explicitWidth || (shrink ? measuredW : childContextWidth);
            
            // Wrapping logic: always wrap to the content area of the resolved width
            const wrapW = w - pSides.left - pSides.right;
            const lines = this.wrapText(el.content, wrapW, size, el.options?.font, el.options?.rtl);
            h = explicitHeight || (lines.length * (size * (el.options?.lineHeight || 1.4)));
        } else if (el.type === 'rect' || el.type === 'image' || el.type === 'svg') {
            w = explicitWidth || el.width;
            h = explicitHeight || el.height;
        } else if (el.type === 'spacer') {
            w = el.size;
            h = el.size;
        } else if (el.type === 'vstack') {
            const gap = el.options?.gap || 0;
            // Children of vstack inherit the context width and can fill it
            const sizes = el.children.map(c => this.calculateSize(c, childContextWidth, false));
            w = explicitWidth || (shrink ? Math.max(...sizes.map(s => s.width), 0) : childContextWidth);
            h = explicitHeight || (sizes.reduce((acc, s) => acc + s.height, 0) + (el.children.length > 0 ? (el.children.length - 1) * gap : 0));
        } else if (el.type === 'hstack') {
            const gap = el.options?.gap || 0;
            // Children of hstack shrink to fit (inline behavior)
            const sizes = el.children.map(c => this.calculateSize(c, childContextWidth, true));
            w = explicitWidth || (sizes.reduce((acc, s) => acc + s.width, 0) + (el.children.length > 0 ? (el.children.length - 1) * gap : 0));
            h = explicitHeight || Math.max(...sizes.map(s => s.height), 0);
        } else if (el.type === 'zstack') {
            const sizes = el.children.map(c => this.calculateSize(c, childContextWidth, false));
            w = explicitWidth || (shrink ? Math.max(...sizes.map(s => s.width), 0) : childContextWidth);
            h = explicitHeight || Math.max(...sizes.map(s => s.height), 0);
        } else if (el.type === 'table') {
            w = explicitWidth || childContextWidth;
            const tableEl = this.tableToLayout(el, w);
            const size = this.calculateSize(tableEl, w, false);
            h = explicitHeight || size.height;
        } else if (el.type === 'box' || el.type === 'link') {
            const inner = this.calculateSize(el.child, childContextWidth, false);
            w = explicitWidth || (shrink ? inner.width : childContextWidth);
            h = explicitHeight || inner.height;
        }

        // Add padding/margin to total size if not already accounted for by explicitWidth
        if (options) {
            const m = parseSides(options.margin);
            if (!explicitWidth) w += pSides.left + pSides.right;
            if (!explicitHeight) h += pSides.top + pSides.bottom;
            w += m.left + m.right;
            h += m.top + m.bottom;
        }

        return { width: w, height: h };
    }

    private drawElement(el: LayoutElement, x: number, y: number, w: number, h: number, parentWidth: number) {
        const options: LayoutOptions = (el as any).options || {};
        const m = parseSides(options.margin);
        const p = parseSides(options.padding);

        const innerX = x + m.left;
        const innerY = y - m.top;
        const innerW = w - m.left - m.right;
        const innerH = h - m.top - m.bottom;

        if (options.backgroundColor || options.backgroundGradient) {
            const style = 'F';
            if (options.borderRadius) {
                this.doc.saveGraphicsState();
                if (this.doc.roundedRect) {
                    this.doc.roundedRect(innerX, innerY - innerH, innerW, innerH, options.borderRadius, 'N'); 
                    if (options.backgroundGradient) {
                        const dir = options.backgroundGradient.direction || 'vertical';
                        const coords: [number, number, number, number] = dir === 'vertical' ? [innerX, innerY, innerX, innerY - innerH] : [innerX, innerY, innerX + innerW, innerY];
                        this.doc.gradient(options.backgroundGradient.colors, coords[0], coords[1], coords[2], coords[3]);
                    } else {
                        this.doc.roundedRect(innerX, innerY - innerH, innerW, innerH, options.borderRadius, style, options.backgroundColor);
                    }
                }
            } else {
                if (options.backgroundGradient) {
                    const dir = options.backgroundGradient.direction || 'vertical';
                    const coords: [number, number, number, number] = dir === 'vertical' ? [innerX, innerY, innerX, innerY - innerH] : [innerX, innerY, innerX + innerW, innerY];
                    this.doc.saveGraphicsState();
                    this.doc.rect(innerX, innerY - innerH, innerW, innerH, 'N');
                    this.doc.clip();
                    this.doc.gradient(options.backgroundGradient.colors, coords[0], coords[1], coords[2], coords[3]);
                    this.doc.restoreGraphicsState();
                } else {
                    this.doc.rect(innerX, innerY - innerH, innerW, innerH, style, options.backgroundColor!);
                }
            }
        } else if (options.borderRadius) {
             this.doc.saveGraphicsState();
             this.doc.roundedRect(innerX, innerY - innerH, innerW, innerH, options.borderRadius, 'N');
        }

        const contentX = innerX + p.left;
        const contentY = innerY - p.top;
        const contentW = innerW - p.left - p.right;
        const contentH = innerH - p.top - p.bottom;

        if (options.opacity !== undefined) this.doc.setOpacity(options.opacity);

        if (el.type === 'text') {
            const size = el.options?.size || 12;
            const maxWidth = w; // Use the element's resolved width
            const lineHeightVal = el.options?.lineHeight || 1.4;
            const align = el.options?.align || 'left';
            const safetyInset = 2.0;

            const effectiveWidth = maxWidth - p.left - p.right - (safetyInset * 2);
            const lines = this.wrapText(el.content, effectiveWidth, size, el.options?.font, el.options?.rtl);
            const lineHeight = size * lineHeightVal;
            let currentY = contentY - size;
            
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                const isLastLine = i === lines.length - 1;
                this.doc.text(line, contentX, currentY, { ...el.options, width: maxWidth - p.left - p.right, align: isLastLine && align === 'justify' ? (el.options?.rtl ? 'right' : 'left') : align });
                currentY -= lineHeight;
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
                let drawW = contentW, drawH = contentH, offsetX = 0, offsetY = 0;
                if (fit === 'contain') {
                    if (imgRatio > containerRatio) { drawH = contentW / imgRatio; offsetY = (contentH - drawH) / 2; }
                    else { drawW = contentH * imgRatio; offsetX = (contentW - drawW) / 2; }
                    this.doc.image(el.data, el.imgType, contentX + offsetX, contentY - contentH + offsetY, drawW, drawH);
                } else if (fit === 'cover') {
                    if (imgRatio > containerRatio) { drawW = contentH * imgRatio; drawH = contentH; offsetX = (drawW - contentW) / 2; offsetY = 0; }
                    else { drawW = contentW; drawH = contentW / imgRatio; offsetX = 0; offsetY = (drawH - contentH) / 2; }
                    this.doc.saveGraphicsState();
                    this.doc.rect(contentX, contentY - contentH, contentW, contentH, 'N');
                    this.doc.clip();
                    this.doc.image(el.data, el.imgType, contentX - offsetX, contentY - contentH - offsetY, drawW, drawH);
                    this.doc.restoreGraphicsState();
                }
            }
        } else if (el.type === 'svg') {
            this.doc.svg(el.content, contentX, contentY, { width: contentW, height: contentH, scale: el.options?.scale, color: el.options?.color });
        } else if (el.type === 'vstack') {
            const gap = options.gap || 0;
            const childrenSizes = el.children.map(c => this.calculateSize(c, contentW, false));
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
                this.drawElement(child, contentX + offsetX, currentY, size.width, size.height, contentW);
                currentY -= (size.height + effectiveGap);
            });
        } else if (el.type === 'hstack') {
            const gap = options.gap || 0;
            const childrenSizes = el.children.map(c => this.calculateSize(c, contentW, true));
            let effectiveGap = gap;
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
                if (options.align === 'center') offsetY = (contentH - size.height) / 2;
                else if (options.align === 'end') offsetY = contentH - size.height;
                this.drawElement(child, currentX, contentY - offsetY, size.width, size.height, contentW);
                currentX += (size.width + effectiveGap);
            });
        } else if (el.type === 'zstack') {
            for (const child of el.children) {
                const size = this.calculateSize(child, contentW, false);
                let offsetX = 0, offsetY = 0;
                if (options.align === 'center') { offsetX = (contentW - size.width) / 2; offsetY = (contentH - size.height) / 2; }
                else if (options.align === 'end') { offsetX = contentW - size.width; offsetY = contentH - size.height; }
                this.drawElement(child, contentX + offsetX, contentY - offsetY, size.width, size.height, contentW);
            }
        } else if (el.type === 'table') {
            const tableEl = this.tableToLayout(el, w);
            const size = this.calculateSize(tableEl, w, false);
            this.drawElement(tableEl, x, y, size.width, size.height, parentWidth);
        } else if (el.type === 'link') {
            const size = this.calculateSize(el.child, contentW, false);
            if (el.targetPage !== undefined) {
                this.doc.addPageLink(el.targetPage, contentX, contentY - size.height, size.width, size.height);
            } else {
                this.doc.addLink(el.url, contentX, contentY - size.height, size.width, size.height);
            }
            this.drawElement(el.child, contentX, contentY, size.width, size.height, contentW);
        } else if (el.type === 'box') {
            const size = this.calculateSize(el.child, contentW, false);
            let childX = contentX, childY = contentY;
            if (options.align === 'center') { childX += (contentW - size.width) / 2; childY -= (contentH - size.height) / 2; }
            else if (options.align === 'end') { childX += contentW - size.width; childY -= contentH - size.height; }
            this.drawElement(el.child, childX, childY, size.width, size.height, contentW);
        }
        
        if (options.borderRadius) this.doc.restoreGraphicsState();
        if (options.opacity !== undefined) this.doc.setOpacity(1.0);
        if (options.borderColor && options.borderWidth) {
            if (options.borderRadius && this.doc.roundedRect) this.doc.roundedRect(innerX, innerY - innerH, innerW, innerH, options.borderRadius, 'S', options.borderColor, options.borderWidth);
            else this.doc.rect(innerX, innerY - innerH, innerW, innerH, 'S', options.borderColor, options.borderWidth);
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

    private tableToLayout(el: Extract<LayoutElement, { type: 'table' }>, parentWidth: number): LayoutElement {
        const { headers, rows, columnWidths, options = {} } = el;
        const fontSize = options.fontSize || 10;
        const padding = options.rowPadding || 8;
        const tableWidth = parentWidth;
        const colCount = headers.length;
        const colWidths = columnWidths || Array(colCount).fill(tableWidth / colCount);
        const createCell = (content: string | LayoutElement, isHeader: boolean, colIdx: number): LayoutElement => {
            const width = colWidths[colIdx];
            const baseOptions: any = { padding: padding, width: width, borderColor: options.borderColor || '#dee2e6', borderWidth: options.borderWidth || 0.5 };
            if (isHeader && options.headerBackgroundColor) baseOptions.backgroundColor = options.headerBackgroundColor;
            let child: LayoutElement;
            if (typeof content === 'string') {
                const isRtl = /[\u0600-\u06FF]/.test(content);
                child = { type: 'text', content, options: { font: isRtl ? 'AR' : 'EN', size: fontSize, rtl: isRtl, color: (isHeader && options.headerTextColor) ? options.headerTextColor : undefined, width: width - (padding * 2), align: isRtl ? 'right' : 'left' } };
            } else child = content;
            return { type: 'box', child, options: baseOptions };
        };
        const headerRow: LayoutElement = { type: 'hstack', children: headers.map((h, i) => createCell(h, true, i)) };
        const bodyRows: LayoutElement[] = rows.map((row, rowIdx) => {
            const rowOptions: any = {};
            if (options.alternateRowBackgroundColor && rowIdx % 2 !== 0) rowOptions.backgroundColor = options.alternateRowBackgroundColor;
            return { type: 'hstack', children: row.map((cell, colIdx) => {
                const cellEl = createCell(cell, false, colIdx);
                if (rowOptions.backgroundColor) (cellEl as any).options.backgroundColor = rowOptions.backgroundColor;
                return cellEl;
            }) };
        });
        return { type: 'vstack', options: { ...options, width: tableWidth }, children: [headerRow, ...bodyRows] };
    }
}
