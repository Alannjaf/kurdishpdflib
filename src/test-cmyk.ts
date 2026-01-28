import { KurdPDF } from './kurd-pdf.js';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

async function main() {
    console.log("Generating CMYK test PDF...");

    const notoBytes = readFileSync(join('assets', 'NotoSans-Regular.ttf'));

    const doc = new KurdPDF({
        fonts: {
            'EN': { fontBytes: notoBytes, baseFontName: 'NotoSans' },
        }
    });

    await doc.init();

    // init() creates the first page automatically
    const p = doc.activePage!;
    
    // 1. CMYK Text
    // Cyan: 100%, Magenta: 0%, Yellow: 0%, Key: 0%
    doc.text("This is pure Cyan (100, 0, 0, 0)", 50, 750, { 
        size: 18, 
        color: "cmyk(100%, 0%, 0%, 0%)" 
    });

    // Magenta: 0%, 100%, 0%, 0%
    doc.text("This is pure Magenta (0, 100, 0, 0)", 50, 720, { 
        size: 18, 
        color: "cmyk(0%, 100%, 0%, 0%)" 
    });

    // Yellow: 0%, 0%, 100%, 0%
    doc.text("This is pure Yellow (0, 0, 100, 0)", 50, 690, { 
        size: 18, 
        color: "cmyk(0%, 0%, 100%, 0%)" 
    });

    // Rich Black: 60%, 40%, 40%, 100% (Common rich black)
    doc.text("This is Rich Black (60, 40, 40, 100)", 50, 660, { 
        size: 18, 
        color: "cmyk(60%, 40%, 40%, 100%)" 
    });

    // 2. CMYK Rectangles
    doc.rect(50, 600, 100, 50, 'F', "cmyk(100%, 0%, 0%, 0%)"); // Cyan
    doc.rect(160, 600, 100, 50, 'F', "cmyk(0%, 100%, 0%, 0%)"); // Magenta
    doc.rect(270, 600, 100, 50, 'F', "cmyk(0%, 0%, 100%, 0%)"); // Yellow
    doc.rect(380, 600, 100, 50, 'F', "cmyk(0%, 0%, 0%, 100%)"); // Black

    doc.rect(50, 540, 100, 50, 'S', "cmyk(100%, 0%, 0%, 0%)", 3); // Cyan Stroke
    doc.rect(160, 540, 100, 50, 'S', "cmyk(0%, 100%, 0%, 0%)", 3); // Magenta Stroke

    // 3. CMYK Paths/Circles
    doc.circle(100, 450, 40, 'F', "cmyk(50%, 0%, 100%, 0%)"); // Lime Greenish
    doc.circle(210, 450, 40, 'F', "cmyk(0%, 50%, 100%, 0%)"); // Orange

    const buffer = doc.save();
    writeFileSync('cmyk-test.pdf', buffer);
    console.log("Saved cmyk-test.pdf");
}

main().catch(console.error);
