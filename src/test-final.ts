import { KurdPDF } from './index.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const arabicFontPath = join(__dirname, '..', 'assets', 'NotoSansArabic-Regular.ttf');
const photoPath = join(__dirname, '..', 'assets', 'photo.jpg');

async function main() {
    const arabicBytes = new Uint8Array(readFileSync(arabicFontPath));
    const photoBytes = new Uint8Array(readFileSync(photoPath));

    const doc = new KurdPDF({
        fonts: {
            'AR': { fontBytes: arabicBytes, baseFontName: 'NotoSansArabic' }
        }
    });

    await doc.init();

    doc.text("Kurdish Image and Text Test", 50, 800, { size: 20 });
    
    // Testing Kurdish text
    doc.text("سڵاو جیهان! ئەمە تاقیکردنەوەیە.", 50, 750, { font: 'AR', size: 24, rtl: true });

    // Draw image twice to check if multiple images work
    console.log("Adding first image...");
    doc.image(photoBytes, 'jpeg', 50, 500, 200, 200);
    
    console.log("Adding second image (same bytes)...");
    doc.image(photoBytes, 'jpeg', 300, 500, 200, 200);

    doc.save("out-final-test.pdf");
    console.log("Saved to out-final-test.pdf");
}

main().catch(console.error);
