import { KurdPDF, LayoutEngine } from './index.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const arabicFontPath = join(__dirname, '..', 'assets', 'NotoSansArabic-Regular.ttf');
const photoPath = join(__dirname, '..', 'assets', 'photo.jpg');

async function main() {
    const arabicBytes = new Uint8Array(readFileSync(arabicFontPath));
    const latinBytes = new Uint8Array(readFileSync(join(__dirname, '..', 'assets', 'NotoSans-Regular.ttf')));
    const photoBytes = new Uint8Array(readFileSync(photoPath));

    const doc = new KurdPDF({
        fonts: {
            'AR': { fontBytes: arabicBytes, baseFontName: 'NotoSansArabic' },
            'EN': { fontBytes: latinBytes, baseFontName: 'NotoSans' }
        }
    });

    await doc.init();
    const layout = new LayoutEngine(doc);

    // Advanced Layout Test
    layout.render({
        type: 'vstack',
        options: { 
            gap: 20, 
            align: 'center', 
            padding: 20, 
            backgroundColor: '#f0f0f0', 
            borderRadius: 10,
            borderColor: '#333333',
            borderWidth: 1
        },
        children: [
            { 
                type: 'box',
                options: { backgroundColor: '#0d1b3e', padding: [5, 15], borderRadius: 20 },
                child: { type: 'text', content: 'ADVANCED LAYOUT', options: { font: 'EN', size: 14, color: '#FFFFFF' } }
            },
            {
                type: 'hstack',
                options: { gap: 15 },
                children: [
                    { 
                        type: 'box', 
                        options: { borderColor: '#FF0000', borderWidth: 2, padding: 5, borderRadius: 5 },
                        child: { type: 'image', data: photoBytes, imgType: 'jpeg', width: 60, height: 60 }
                    },
                    {
                        type: 'vstack',
                        options: { gap: 5 },
                        children: [
                            { type: 'text', content: 'ناوی تەواو:', options: { font: 'AR', size: 10, rtl: true, color: '#666666' } },
                            { type: 'text', content: 'ئالان جاف', options: { font: 'AR', size: 16, rtl: true, color: '#000000' } },
                        ]
                    }
                ]
            },
            {
                type: 'box',
                options: { width: 200, height: 40, backgroundColor: '#e0ffe0', padding: 10, align: 'center' },
                child: { type: 'text', content: 'Status: Active', options: { font: 'EN', size: 12, color: '#008800' } }
            }
        ]
    }, 50, 800);

    doc.save("out-advanced-layout.pdf");
    console.log("Saved to out-advanced-layout.pdf");
}

main().catch(console.error);
