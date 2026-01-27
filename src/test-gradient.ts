import { KurdPDF, LayoutEngine } from './index.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const arabicFontPath = join(__dirname, '..', 'assets', 'NotoSansArabic-Regular.ttf');
const latinFontPath = join(__dirname, '..', 'assets', 'NotoSans-Regular.ttf');

async function main() {
    const arabicBytes = new Uint8Array(readFileSync(arabicFontPath));
    const latinBytes = new Uint8Array(readFileSync(latinFontPath));

    const doc = new KurdPDF({
        fonts: {
            'AR': { fontBytes: arabicBytes, baseFontName: 'NotoSansArabic' },
            'EN': { fontBytes: latinBytes, baseFontName: 'NotoSans' }
        },
        fallbackOrder: ['AR', 'EN'] // Automatically check Arabic then Latin
    });

    await doc.init();
    
    // Test 1: Automatic Font Fallback (Mixing scripts in one call without picking fonts)
    doc.text("ئالان جاف (Alan Jaf) - Font Fallback Test", 50, 800, { size: 24 });
    
    // Test 2: Gradient
    doc.saveGraphicsState();
    doc.rect(50, 600, 500, 150, 'N');
    doc.clip();
    doc.gradient([
        { offset: 0, color: '#0000FF' },
        { offset: 1, color: '#FF0000' }
    ], 50, 600, 550, 600);
    doc.restoreGraphicsState();

    doc.text("Below is a justified fallback text containing Kurdish (ئەمە دەقێکی کوردییە) and English (this is English).", 50, 550, { size: 12, width: 500, align: 'justify' });

    doc.save("out-gradient-fallback-test.pdf");
    console.log("Saved to out-gradient-fallback-test.pdf");
}

main().catch(console.error);
