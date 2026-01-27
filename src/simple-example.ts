import { KurdPDF } from './index.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const arabicFontPath = join(__dirname, '..', 'assets', 'NotoSansArabic-Regular.ttf');
const latinFontPath = join(__dirname, '..', 'assets', 'NotoSans-Regular.ttf');

async function main() {
    // 1. Load fonts (Node.js style)
    const arabicBytes = new Uint8Array(readFileSync(arabicFontPath));
    const latinBytes = new Uint8Array(readFileSync(latinFontPath));

    // 2. Initialize the High-Level Document
    const doc = new KurdPDF({
        fonts: {
            'AR': { fontBytes: arabicBytes, baseFontName: 'NotoSansArabic' },
            'EN': { fontBytes: latinBytes, baseFontName: 'NotoSans' }
        }
    });

    // 3. Must init (loads WASM)
    await doc.init();

    // 4. Use simple API
    // English (uses EN font by default if we select it or passed first)
    // Note: In our config, 'AR' is first so it might be default, let's be explicit
    doc.text("Kurdish PDF Library - Simple API", 50, 750, { font: 'EN', size: 24 });

    // Kurdish / Arabic (Automatic shaping!)
    doc.text("سڵاو لە هەمووان", 50, 650, { font: 'AR', size: 30, rtl: true });
    
    // Another line
    doc.text("ئەمە تێستێکە بۆ کتێبخانەی PDF", 50, 600, { font: 'AR', size: 20, rtl: true });

    // Save
    doc.save("out-simple.pdf");
    console.log("Saved to out-simple.pdf");
}

main();
