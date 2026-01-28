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
}

export function parseSVG(svgContent: string): { paths: SVGPath[], viewBox?: { x: number, y: number, w: number, h: number } } {
    const paths: SVGPath[] = [];
    
    const viewBoxMatch = svgContent.match(/viewBox="([^"]+)"/);
    let viewBox;
    if (viewBoxMatch) {
        const parts = viewBoxMatch[1].trim().split(/[\s,]+/).map(parseFloat);
        if (parts.length === 4) {
            viewBox = { x: parts[0], y: parts[1], w: parts[2], h: parts[3] };
        }
    }

    const getStyle = (attributes: string): { fill?: string, stroke?: string, strokeWidth?: number } => {
        const fillMatch = attributes.match(/fill="([^"]+)"/);
        const strokeMatch = attributes.match(/stroke="([^"]+)"/);
        const strokeWidthMatch = attributes.match(/stroke-width="([^"]+)"/);
        
        const styleMatch = attributes.match(/style="([^"]+)"/);
        let fill = fillMatch ? fillMatch[1] : undefined;
        let stroke = strokeMatch ? strokeMatch[1] : undefined;
        let strokeWidth = strokeWidthMatch ? parseFloat(strokeWidthMatch[1]) : undefined;

        if (styleMatch) {
            const styles = styleMatch[1].split(';');
            for (const s of styles) {
                const [k, v] = s.split(':').map(x => x.trim());
                if (k === 'fill') fill = v;
                if (k === 'stroke') stroke = v;
                if (k === 'stroke-width') strokeWidth = parseFloat(v);
            }
        }

        // Handle named colors or "none"
        if (fill === 'none') fill = undefined;
        if (stroke === 'none') stroke = undefined;

        return { fill, stroke, strokeWidth };
    };
    
    // Path support
    const pathRegex = /<path\s+([^>]+)>/g;
    let match;
    while ((match = pathRegex.exec(svgContent)) !== null) {
        const attributes = match[1];
        const dMatch = attributes.match(/d="([^"]+)"/);
        if (!dMatch) continue;
        
        const style = getStyle(attributes);
        paths.push({
            points: parseSVGPathData(dMatch[1]),
            ...style
        });
    }
    
    // Polygon support
    const polyRegex = /<polygon\s+([^>]+)>/g;
    while ((match = polyRegex.exec(svgContent)) !== null) {
        const attributes = match[1];
        const ptsMatch = attributes.match(/points="([^"]+)"/);
        if (ptsMatch) {
             const pts = ptsMatch[1].trim().split(/[\s,]+/).map(parseFloat);
             const pathPoints: PathPoint[] = [];
             for(let i=0; i<pts.length; i+=2) {
                 pathPoints.push({ x: pts[i], y: pts[i+1], type: i===0 ? 'M' : 'L' });
             }
             if (pathPoints.length > 0) pathPoints.push({ x: pathPoints[0].x, y: pathPoints[0].y, type: 'L' });
             
             const style = getStyle(attributes);
             paths.push({ points: pathPoints, ...style });
        }
    }

    // Rect support
    const rectRegex = /<rect\s+([^>]+)>/g;
    while ((match = rectRegex.exec(svgContent)) !== null) {
        const attrs = match[1];
        const x = parseFloat(attrs.match(/x="([^"]+)"/)?.[1] || '0');
        const y = parseFloat(attrs.match(/y="([^"]+)"/)?.[1] || '0');
        const w = parseFloat(attrs.match(/width="([^"]+)"/)?.[1] || '0');
        const h = parseFloat(attrs.match(/height="([^"]+)"/)?.[1] || '0');
        
        const style = getStyle(attrs);
        paths.push({
            points: [
                { x, y, type: 'M' },
                { x: x + w, y, type: 'L' },
                { x: x + w, y: y + h, type: 'L' },
                { x, y: y + h, type: 'L' },
                { x, y: y, type: 'L' }
            ],
            ...style
        });
    }

    // Circle support
    const circleRegex = /<circle\s+([^>]+)>/g;
    while ((match = circleRegex.exec(svgContent)) !== null) {
        const attrs = match[1];
        const cx = parseFloat(attrs.match(/cx="([^"]+)"/)?.[1] || '0');
        const cy = parseFloat(attrs.match(/cy="([^"]+)"/)?.[1] || '0');
        const r = parseFloat(attrs.match(/r="([^"]+)"/)?.[1] || '0');
        
        const style = getStyle(attrs);
        
        // Convert circle to 4 cubic beziers
        const k = 0.552284749831;
        const kr = r * k;
        
        paths.push({
            points: [
                { x: cx + r, y: cy, type: 'M' },
                { x: cx + r, y: cy + kr, type: 'C', cp1: {x: cx + r, y: cy + kr}, cp2: {x: cx + kr, y: cy + r} },
                { x: cx, y: cy + r, type: 'L' },
                { x: cx - kr, y: cy + r, type: 'C', cp1: {x: cx - kr, y: cy + r}, cp2: {x: cx - r, y: cy + kr} },
                { x: cx - r, y: cy, type: 'L' },
                { x: cx - r, y: cy - kr, type: 'C', cp1: {x: cx - r, y: cy - kr}, cp2: {x: cx - kr, y: cy - r} },
                { x: cx, y: cy - r, type: 'L' },
                { x: cx + kr, y: cy - r, type: 'C', cp1: {x: cx + kr, y: cy - r}, cp2: {x: cx + r, y: cy - kr} },
                { x: cx + r, y: cy, type: 'L' }
            ],
            ...style
        });
    }

    return { paths, viewBox };
}

function parseSVGPathData(d: string): PathPoint[] {
    const points: PathPoint[] = [];
    const commands = d.match(/([a-zA-Z])|([-+]?\d*\.?\d+(?:e[-+]?\d+)?)/gi);
    
    if (!commands) return points;

    let i = 0;
    let currentX = 0;
    let currentY = 0;
    let startX = 0;
    let startY = 0;
    
    let lastCmd = '';
    let lastType = ''; // M, L, C, etc.
    let isRelative = false;

    while (i < commands.length) {
        let cmd = commands[i];
        
        // If it's a number, it's an implicit repetition of the last command
        if (!isNaN(parseFloat(cmd))) {
            if (lastCmd === 'M' || lastCmd === 'm') {
                // Subsequent pairs after M are treated as L
                cmd = lastCmd === 'm' ? 'l' : 'L';
            } else {
                cmd = lastCmd;
            }
            // Backtrack index so we process this number as an arg
            // BUT we just set cmd, so we don't increment i yet? 
            // Wait, standard structure is [CMD] [ARG1] [ARG2]... [CMD2]
            // My regex splits everything.
            // If commands[i] is number, we synthesize the command.
        } else {
            // It is a letter command
            i++; // Consume the command letter
        }

        lastCmd = cmd;
        const type = cmd.toUpperCase();
        isRelative = cmd === cmd.toLowerCase();

        switch (type) {
            case 'M': {
                const x = parseFloat(commands[i++]);
                const y = parseFloat(commands[i++]);
                currentX = isRelative ? currentX + x : x;
                currentY = isRelative ? currentY + y : y;
                startX = currentX;
                startY = currentY;
                points.push({ x: currentX, y: currentY, type: 'M' });
                break;
            }
            case 'L': {
                const x = parseFloat(commands[i++]);
                const y = parseFloat(commands[i++]);
                currentX = isRelative ? currentX + x : x;
                currentY = isRelative ? currentY + y : y;
                points.push({ x: currentX, y: currentY, type: 'L' });
                break;
            }
            case 'H': {
                const x = parseFloat(commands[i++]);
                currentX = isRelative ? currentX + x : x;
                points.push({ x: currentX, y: currentY, type: 'L' });
                break;
            }
            case 'V': {
                const y = parseFloat(commands[i++]);
                currentY = isRelative ? currentY + y : y;
                points.push({ x: currentX, y: currentY, type: 'L' });
                break;
            }
            case 'C': {
                const x1 = parseFloat(commands[i++]);
                const y1 = parseFloat(commands[i++]);
                const x2 = parseFloat(commands[i++]);
                const y2 = parseFloat(commands[i++]);
                const x = parseFloat(commands[i++]);
                const y = parseFloat(commands[i++]);
                
                const cp1x = isRelative ? currentX + x1 : x1;
                const cp1y = isRelative ? currentY + y1 : y1;
                const cp2x = isRelative ? currentX + x2 : x2;
                const cp2y = isRelative ? currentY + y2 : y2;
                currentX = isRelative ? currentX + x : x;
                currentY = isRelative ? currentY + y : y;

                points.push({ 
                    x: currentX, y: currentY, type: 'C',
                    cp1: { x: cp1x, y: cp1y },
                    cp2: { x: cp2x, y: cp2y }
                });
                break;
            }
            case 'S': {
                // Smooth curve: cp1 is reflection of previous cp2
                const x2 = parseFloat(commands[i++]);
                const y2 = parseFloat(commands[i++]);
                const x = parseFloat(commands[i++]);
                const y = parseFloat(commands[i++]);

                let cp1x = currentX;
                let cp1y = currentY;
                
                const lastPoint = points[points.length - 1];
                if (lastPoint && lastPoint.type === 'C' && lastPoint.cp2) {
                    // Reflect cp2 around current point
                    cp1x = currentX + (currentX - lastPoint.cp2.x);
                    cp1y = currentY + (currentY - lastPoint.cp2.y);
                }

                const cp2x = isRelative ? currentX + x2 : x2;
                const cp2y = isRelative ? currentY + y2 : y2;
                currentX = isRelative ? currentX + x : x;
                currentY = isRelative ? currentY + y : y;

                points.push({
                    x: currentX, y: currentY, type: 'C',
                    cp1: { x: cp1x, y: cp1y },
                    cp2: { x: cp2x, y: cp2y }
                });
                break;
            }
            case 'Z': {
                points.push({ x: startX, y: startY, type: 'L' });
                currentX = startX;
                currentY = startY;
                break;
            }
        }
    }
    return points;
}
