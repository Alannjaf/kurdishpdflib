export interface PathPoint {
    x: number;
    y: number;
    type: 'M' | 'L' | 'C';
    cp1?: { x: number, y: number };
    cp2?: { x: number, y: number };
}

export interface SVGPath {
    points: PathPoint[];
    color?: string;
}

const colorMap: Record<string, string> = {
    'cls-1': '#FFFFFF', // white
    'cls-2': '#939598', // grey
    'cls-3': '#010403', // black
    'cls-4': '#ed2224', // red
    'cls-5': '#3dc7f4', // blue
};

export function parseSVG(svgContent: string): SVGPath[] {
    const paths: SVGPath[] = [];
    
    const pathRegex = /<path\s+([^>]+)>/g;
    let match;

    while ((match = pathRegex.exec(svgContent)) !== null) {
        const attributes = match[1];
        
        const dMatch = attributes.match(/d="([^"]+)"/);
        if (!dMatch) continue;
        const d = dMatch[1];

        const classMatch = attributes.match(/class="([^"]+)"/);
        const className = classMatch ? classMatch[1] : '';
        const color = colorMap[className];

        paths.push({
            points: parseSVGPathData(d),
            color: color
        });
    }
    
    // Polygon support (points="x1 y1 x2 y2...")
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
             if (pathPoints.length > 0) {
                 // Close it
                 pathPoints.push({ x: pathPoints[0].x, y: pathPoints[0].y, type: 'L' });
             }
             
             const classMatch = attributes.match(/class="([^"]+)"/);
             const className = classMatch ? classMatch[1] : '';
             paths.push({ points: pathPoints, color: colorMap[className] });
        }
    }

    return paths;
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
