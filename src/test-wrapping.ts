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
        }
    });

    await doc.init();
    const layout = new LayoutEngine(doc);

    const longKurdishText = "ئەمە تێکستێکی زۆر درێژە بۆ تاقیکردنەوەی سیستەمی نوێی وەرپینگ یان پێچاندنەوەی تێکست لەناو لییاوت ئەنجینەکەماندا. دەبێت تێکستەکە بە شێوەیەکی ئۆتۆماتیکی دابەش ببێت بۆ سەر چەند دێڕێکی جیاواز بەپێی ئەو پانییەی بۆی دیاری کراوە.";

    layout.render({
        type: 'vstack',
        options: { gap: 30, align: 'center', padding: 20 },
        children: [
            { type: 'text', content: 'TEXT WRAPPING TEST', options: { font: 'EN', size: 18 } },
            { 
                type: 'box',
                options: { backgroundColor: '#f9f9f9', padding: 15, borderRadius: 8, borderColor: '#dddddd', borderWidth: 1 },
                child: { 
                    type: 'text', 
                    content: longKurdishText, 
                    options: { font: 'AR', size: 14, rtl: true, width: 300, align: 'right' } 
                }
            },
            {
                type: 'box',
                options: { backgroundColor: '#eef2ff', padding: 15, borderRadius: 8 },
                child: {
                    type: 'text',
                    content: "This is a long English sentence intended to test the automatic wrapping logic for Latin scripts as well. It should flow naturally to the next line once it hits the 300px boundary.",
                    options: { font: 'EN', size: 12, width: 300 }
                }
            }
        ]
    }, 50, 800);

    doc.save("out-wrapping-test.pdf");
    console.log("Saved to out-wrapping-test.pdf");
}

main().catch(console.error);
