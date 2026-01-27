export interface LayoutOptions {
    width?: number;
    height?: number;
    padding?: number | [number, number]; 
    gap?: number;
    align?: 'start' | 'center' | 'end';
}

export interface TextElementOptions {
    font?: string;
    size?: number;
    rtl?: boolean;
    color?: string;
    align?: 'left' | 'right' | 'center';
}

export type LayoutElement = 
    | { type: 'text', content: string, options?: TextElementOptions }
    | { type: 'rect', width: number, height: number, options?: { style?: 'F'|'S'|'FD', color?: string } }
    | { type: 'image', data: Uint8Array, imgType: 'jpeg' | 'png', width: number, height: number }
    | { type: 'vstack' | 'hstack', children: LayoutElement[], options?: LayoutOptions }
    | { type: 'spacer', size: number };

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
        if (el.type === 'text') {
            const size = el.options?.size || 12;
            const w = this.doc.measureText(el.content, size, { font: el.options?.font, rtl: el.options?.rtl });
            return { width: w, height: size * 1.2 };
        }
        if (el.type === 'rect' || el.type === 'image') {
            return { width: el.width, height: el.height };
        }
        if (el.type === 'spacer') {
            return { width: el.size, height: el.size };
        }
        if (el.type === 'vstack') {
            const gap = el.options?.gap || 0;
            const sizes = el.children.map(c => this.calculateSize(c));
            const width = Math.max(...sizes.map(s => s.width), el.options?.width || 0);
            const height = sizes.reduce((acc, s) => acc + s.height, 0) + (el.children.length - 1) * gap;
            return { width, height };
        }
        if (el.type === 'hstack') {
            const gap = el.options?.gap || 0;
            const sizes = el.children.map(c => this.calculateSize(c));
            const width = sizes.reduce((acc, s) => acc + s.width, 0) + (el.children.length - 1) * gap;
            const height = Math.max(...sizes.map(s => s.height), el.options?.height || 0);
            return { width, height };
        }
        return { width: 0, height: 0 };
    }

    private drawElement(el: LayoutElement, x: number, y: number, w: number, h: number) {
        if (el.type === 'text') {
            // PDF coordinates are bottom-left, but layout engine uses top-left for easier thinking
            this.doc.text(el.content, x, y - (el.options?.size || 12), el.options);
        } else if (el.type === 'rect') {
            this.doc.rect(x, y - h, w, h, el.options?.style, el.options?.color);
        } else if (el.type === 'image') {
            this.doc.image(el.data, el.imgType, x, y - h, w, h);
        } else if (el.type === 'vstack') {
            const gap = el.options?.gap || 0;
            let currentY = y;
            for (const child of el.children) {
                const size = this.calculateSize(child);
                let offsetX = 0;
                if (el.options?.align === 'center') offsetX = (w - size.width) / 2;
                else if (el.options?.align === 'end') offsetX = w - size.width;
                
                this.drawElement(child, x + offsetX, currentY, size.width, size.height);
                currentY -= (size.height + gap);
            }
        } else if (el.type === 'hstack') {
            const gap = el.options?.gap || 0;
            let currentX = x;
            for (const child of el.children) {
                const size = this.calculateSize(child);
                let offsetY = 0;
                if (el.options?.align === 'center') offsetY = (h - size.height) / 2;
                else if (el.options?.align === 'end') offsetY = h - size.height;

                this.drawElement(child, currentX, y - offsetY, size.width, size.height);
                currentX += (size.width + gap);
            }
        }
    }
}
