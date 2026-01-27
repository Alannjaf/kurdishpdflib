import { KurdPDF, LayoutEngine } from './index.js';
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
    const layout = new LayoutEngine(doc);

    // Using the new Layout API!
    layout.render({
        type: 'vstack',
        options: { gap: 10, align: 'center' },
        children: [
            { type: 'text', content: 'Layout Engine Test', options: { font: 'AR', size: 20 } },
            { 
                type: 'hstack', 
                options: { gap: 20, align: 'center' },
                children: [
                    { type: 'image', data: photoBytes, imgType: 'jpeg', width: 50, height: 50 },
                    { type: 'image', data: photoBytes, imgType: 'jpeg', width: 50, height: 50 },
                    { type: 'image', data: photoBytes, imgType: 'jpeg', width: 50, height: 50 }
                ]
            },
            { type: 'text', content: 'ئەمە تێستێکی نوێیە بۆ لییاوت', options: { font: 'AR', size: 16, rtl: true } },
            { type: 'rect', width: 200, height: 2, options: { style: 'F', color: '#0d1b3e' } },
            { type: 'text', content: 'Automatic spacing and alignment!', options: { font: 'AR', size: 12 } }
        ]
    }, 50, 800);

    doc.save("out-layout-test.pdf");
    console.log("Saved to out-layout-test.pdf");
}

main().catch(console.error);
