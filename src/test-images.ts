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

    doc.setFont('AR');
    doc.text("Kurdish Image Test - تێستی وێنە", 50, 800, { size: 20 });

    // Draw image twice to check if multiple images work
    console.log("Adding first image...");
    doc.image(photoBytes, 'jpeg', 50, 600, 100, 100);
    
    console.log("Adding second image (same bytes)...");
    doc.image(photoBytes, 'jpeg', 200, 600, 100, 100);

    doc.save("out-image-test.pdf");
    console.log("Saved to out-image-test.pdf");
}

main().catch(console.error);
