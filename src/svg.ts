export interface PathPoint {
    x: number;
    y: number;
    type: 'M' | 'L' | 'C';
    cp1?: { x: number, y: number };
    cp2?: { x: number, y: number };
}

export interface SVGPath {
    points: PathPoint[];
    fill?: string;
    stroke?: string;
    strokeWidth?: number;
    opacity?: number;
}

interface SVGState {
    fill?: string;
    stroke?: string;
    strokeWidth?: number;
    opacity?: number;
    transform?: number[]; // 2x3 matrix [a, b, c, d, e, f]
}

export function parseSVG(svgContent: string): { paths: SVGPath[], viewBox?: { x: number, y: number, w: number, h: number } } {
    const paths: SVGPath[] = [];
    
    // 1. Extract ViewBox
    const viewBoxMatch = svgContent.match(/viewBox="([^"]+)"/);
    let viewBox;
    if (viewBoxMatch) {
        const parts = viewBoxMatch[1].trim().split(/[\s,]+/).map(parseFloat);
        if (parts.length === 4) {
            viewBox = { x: parts[0], y: parts[1], w: parts[2], h: parts[3] };
        }
    }

    // 2. Recursive Tag Parsing
    const parser = new SVGRecursiveParser((path) => paths.push(path));
    parser.parse(svgContent);

    return { paths, viewBox };
}

class SVGRecursiveParser {
    private onPath: (p: SVGPath) => void;

    constructor(onPath: (p: SVGPath) => void) {
        this.onPath = onPath;
    }

    parse(content: string) {
        // Simple XML-ish tag extraction
        const tagRegex = /<([a-z0-9]+)\s*([^>]*?)\s*(\/?>)/gi;
        const stack: SVGState[] = [{ transform: [1, 0, 0, 1, 0, 0] }];

        let match;
        const rootContent = content.replace(/<!--[\s\S]*?-->/g, ''); // strip comments

        // We process the string sequentially to handle nesting manually since we don't have a full DOM
        // For a light lib, we'll use a simplified stack approach for attributes
        const tags = Array.from(rootContent.matchAll(tagRegex));
        
        for (const tag of tags) {
            const tagName = tag[1].toLowerCase();
            const attrStr = tag[2];
            const isClosing = tag[3].startsWith('/');
            
            if (tagName === 'g') {
                if (isClosing) {
                    if (stack.length > 1) stack.pop();
                } else {
                    const parent = stack[stack.length - 1];
                    stack.push(this.deriveState(parent, attrStr));
                }
                continue;
            }

            if (tagName === 'path' || tagName === 'rect' || tagName === 'circle' || tagName === 'polygon' || tagName === 'polyline') {
                const state = this.deriveState(stack[stack.length - 1], attrStr);
                this.processShape(tagName, attrStr, state);
            }
        }
    }

    private deriveState(parent: SVGState, attrStr: string): SVGState {
        const state: SVGState = { ...parent };
        
        const fill = this.getAttr(attrStr, 'fill');
        if (fill && fill !== 'none') state.fill = fill;
        if (fill === 'none') state.fill = undefined;

        const stroke = this.getAttr(attrStr, 'stroke');
        if (stroke && stroke !== 'none') state.stroke = stroke;
        if (stroke === 'none') state.stroke = undefined;

        const sw = this.getAttr(attrStr, 'stroke-width');
        if (sw) state.strokeWidth = parseFloat(sw);

        const op = this.getAttr(attrStr, 'opacity');
        if (op) state.opacity = parseFloat(op);

        const transform = this.getAttr(attrStr, 'transform');
        if (transform) {
            state.transform = this.multiplyMatrices(parent.transform || [1, 0, 0, 1, 0, 0], this.parseTransform(transform));
        }

        return state;
    }

    private getAttr(str: string, name: string): string | undefined {
        const regex = new RegExp(`${name}\\s*=\\s*"([^"]+)"`, 'i');
        return str.match(regex)?.[1];
    }

    private parseTransform(str: string): number[] {
        let matrix = [1, 0, 0, 1, 0, 0];
        const transformRegex = /([a-z]+)\s*\(([^)]+)\)/gi;
        let tMatch;
        
        while ((tMatch = transformRegex.exec(str)) !== null) {
            const cmd = tMatch[1].toLowerCase();
            const args = tMatch[2].trim().split(/[\s,]+/).map(parseFloat);

            if (cmd === 'translate') {
                const tx = args[0] || 0;
                const ty = args[1] || 0;
                // Pre-multiply: matrix = current * new
                matrix = this.multiplyMatrices(matrix, [1, 0, 0, 1, tx, ty]);
            } else if (cmd === 'scale') {
                const sx = args[0] || 1;
                const sy = args[1] ?? sx;
                matrix = this.multiplyMatrices(matrix, [sx, 0, 0, sy, 0, 0]);
            } else if (cmd === 'rotate') {
                const angle = args[0] || 0;
                const rad = angle * Math.PI / 180;
                const cos = Math.cos(rad);
                const sin = Math.sin(rad);
                
                if (args.length === 3) {
                    const cx = args[1], cy = args[2];
                    matrix = this.multiplyMatrices(matrix, [1, 0, 0, 1, cx, cy]);
                    matrix = this.multiplyMatrices(matrix, [cos, sin, -sin, cos, 0, 0]);
                    matrix = this.multiplyMatrices(matrix, [1, 0, 0, 1, -cx, -cy]);
                } else {
                    matrix = this.multiplyMatrices(matrix, [cos, sin, -sin, cos, 0, 0]);
                }
            } else if (cmd === 'matrix') {
                matrix = this.multiplyMatrices(matrix, args);
            }
        }
        return matrix;
    }

    private multiplyMatrices(a: number[], b: number[]): number[] {
        return [
            a[0] * b[0] + a[2] * b[1],
            a[1] * b[0] + a[3] * b[1],
            a[0] * b[2] + a[2] * b[3],
            a[1] * b[2] + a[3] * b[3],
            a[0] * b[4] + a[2] * b[5] + a[4],
            a[1] * b[4] + a[3] * b[5] + a[5]
        ];
    }

    private applyMatrix(p: { x: number, y: number }, m: number[]): { x: number, y: number } {
        return {
            x: p.x * m[0] + p.y * m[2] + m[4],
            y: p.x * m[1] + p.y * m[3] + m[5]
        };
    }

    private processShape(type: string, attrs: string, state: SVGState) {
        let rawPoints: PathPoint[] = [];

        if (type === 'path') {
            const d = this.getAttr(attrs, 'd');
            if (d) rawPoints = parseSVGPathData(d);
        } else if (type === 'rect') {
            const x = parseFloat(this.getAttr(attrs, 'x') || '0');
            const y = parseFloat(this.getAttr(attrs, 'y') || '0');
            const w = parseFloat(this.getAttr(attrs, 'width') || '0');
            const h = parseFloat(this.getAttr(attrs, 'height') || '0');
            rawPoints = [
                { x, y, type: 'M' },
                { x: x + w, y, type: 'L' },
                { x: x + w, y: y + h, type: 'L' },
                { x, y: y + h, type: 'L' },
                { x, y, type: 'L' }
            ];
        } else if (type === 'circle') {
            const cx = parseFloat(this.getAttr(attrs, 'cx') || '0');
            const cy = parseFloat(this.getAttr(attrs, 'cy') || '0');
            const r = parseFloat(this.getAttr(attrs, 'r') || '0');
            
            const segments = 8;
            const angleStep = (Math.PI * 2) / segments;
            const k = (4/3) * Math.tan(angleStep / 4);
            const L = r * k;
            
            rawPoints = [];
            for (let i = 0; i < segments; i++) {
                const a1 = i * angleStep, a2 = (i + 1) * angleStep;
                const x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
                const x2 = cx + r * Math.cos(a2), y2 = cy + r * Math.sin(a2);
                const tx1 = -Math.sin(a1) * L, ty1 = Math.cos(a1) * L;
                const tx2 = -Math.sin(a2) * L, ty2 = Math.cos(a2) * L;
                
                if (i === 0) rawPoints.push({ x: x1, y: y1, type: 'M' });
                rawPoints.push({ 
                    x: x2, y: y2, type: 'C', 
                    cp1: { x: x1 + tx1, y: y1 + ty1 }, 
                    cp2: { x: x2 - tx2, y: y2 - ty2 } 
                });
            }
        } else if (type === 'polygon' || type === 'polyline') {
            const ptsStr = this.getAttr(attrs, 'points');
            if (ptsStr) {
                const pts = ptsStr.trim().split(/[\s,]+/).map(parseFloat);
                for (let i = 0; i < pts.length; i += 2) {
                    rawPoints.push({ x: pts[i], y: pts[i + 1], type: i === 0 ? 'M' : 'L' });
                }
                if (type === 'polygon' && rawPoints.length > 0) {
                    rawPoints.push({ x: rawPoints[0].x, y: rawPoints[0].y, type: 'L' });
                }
            }
        }

        if (rawPoints.length === 0) return;

        // Apply Global Transform Matrix to all points
        const transformed = rawPoints.map(p => {
            const pt = this.applyMatrix({ x: p.x, y: p.y }, state.transform!);
            const result: PathPoint = { x: pt.x, y: pt.y, type: p.type };
            if (p.cp1) {
                const c1 = this.applyMatrix({ x: p.cp1.x, y: p.cp1.y }, state.transform!);
                result.cp1 = { x: c1.x, y: c1.y };
            }
            if (p.cp2) {
                const c2 = this.applyMatrix({ x: p.cp2.x, y: p.cp2.y }, state.transform!);
                result.cp2 = { x: c2.x, y: c2.y };
            }
            return result;
        });

        this.onPath({
            points: transformed,
            fill: state.fill,
            stroke: state.stroke,
            strokeWidth: state.strokeWidth,
            opacity: state.opacity
        });
    }
}

function parseSVGPathData(d: string): PathPoint[] {
    const points: PathPoint[] = [];
    // Enhanced regex to handle scientific notation and negative numbers
    const commands = d.match(/([a-df-z])|([-+]?\d*\.?\d+(?:e[-+]?\d+)?)/gi);
    
    if (!commands) return points;

    let i = 0;
    let curX = 0, curY = 0;
    let startX = 0, startY = 0;
    let lastCmd = '';

    while (i < commands.length) {
        let cmd = commands[i];
        let isImplicit = false;

        if (!/^[a-z]$/i.test(cmd)) {
            // Repetition of previous command
            cmd = (lastCmd === 'M' || lastCmd === 'm') ? (lastCmd === 'm' ? 'l' : 'L') : lastCmd;
            isImplicit = true;
        } else {
            i++;
        }

        const type = cmd.toUpperCase();
        const rel = cmd === cmd.toLowerCase();
        lastCmd = cmd;

        const nextNum = () => parseFloat(commands[i++]);

        switch (type) {
            case 'M':
                curX = rel ? curX + nextNum() : nextNum();
                curY = rel ? curY + nextNum() : nextNum();
                startX = curX; startY = curY;
                points.push({ x: curX, y: curY, type: 'M' });
                break;
            case 'L':
                curX = rel ? curX + nextNum() : nextNum();
                curY = rel ? curY + nextNum() : nextNum();
                points.push({ x: curX, y: curY, type: 'L' });
                break;
            case 'H':
                curX = rel ? curX + nextNum() : nextNum();
                points.push({ x: curX, y: curY, type: 'L' });
                break;
            case 'V':
                curY = rel ? curY + nextNum() : nextNum();
                points.push({ x: curX, y: curY, type: 'L' });
                break;
            case 'C': {
                const x1 = rel ? curX + nextNum() : nextNum();
                const y1 = rel ? curY + nextNum() : nextNum();
                const x2 = rel ? curX + nextNum() : nextNum();
                const y2 = rel ? curY + nextNum() : nextNum();
                curX = rel ? curX + nextNum() : nextNum();
                curY = rel ? curY + nextNum() : nextNum();
                points.push({ x: curX, y: curY, type: 'C', cp1: {x: x1, y: y1}, cp2: {x: x2, y: y2} });
                break;
            }
            case 'S': {
                // Smooth curve
                const x2 = rel ? curX + nextNum() : nextNum();
                const y2 = rel ? curY + nextNum() : nextNum();
                const nx = rel ? curX + nextNum() : nextNum();
                const ny = rel ? curY + nextNum() : nextNum();
                
                let cp1x = curX, cp1y = curY;
                const prev = points[points.length - 1];
                if (prev && prev.type === 'C' && prev.cp2) {
                    cp1x = curX + (curX - prev.cp2.x);
                    cp1y = curY + (curY - prev.cp2.y);
                }
                curX = nx; curY = ny;
                points.push({ x: curX, y: curY, type: 'C', cp1: {x: cp1x, y: cp1y}, cp2: {x: x2, y: y2} });
                break;
            }
            case 'Z':
                points.push({ x: startX, y: startY, type: 'L' });
                curX = startX; curY = startY;
                break;
        }
    }
    return points;
}
