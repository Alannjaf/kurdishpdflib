import { KurdPDF, LayoutEngine } from './index.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const photoPath = join(__dirname, '..', 'assets', 'photo.jpg');
const logoPath = join(__dirname, '..', 'assets', 'logo.png');

async function main() {
    const photoBytes = new Uint8Array(readFileSync(photoPath));
    const logoBytes = new Uint8Array(readFileSync(logoPath));
    const latinBytes = new Uint8Array(readFileSync(join(__dirname, '..', 'assets', 'NotoSans-Regular.ttf')));

    const doc = new KurdPDF({
        fonts: {
            'F1': { fontBytes: latinBytes, baseFontName: 'NotoSans' } // Map default F1 to NotoSans
        }
    });
    await doc.init();
    const layout = new LayoutEngine(doc);

    layout.render({
        type: 'vstack',
        options: { gap: 40, padding: 30 },
        children: [
            { type: 'text', content: 'FLEX LAYOUT FEATURES', options: { size: 24 } },

            // 1. Z-Stack Test (Overlay)
            {
                type: 'zstack',
                options: { width: 200, height: 150, align: 'center' },
                children: [
                    // Background Image
                    { type: 'image', data: photoBytes, imgType: 'jpeg', width: 200, height: 150 },
                    // Overlay Box
                    { 
                        type: 'box', 
                        options: { backgroundColor: '#000000', padding: 5, borderRadius: 4 },
                        child: { type: 'text', content: 'Z-STACK OVERLAY', options: { color: '#FFFFFF', size: 14 } }
                    }
                ]
            },

            // 2. Space Between (Header Example)
            {
                type: 'box',
                options: { width: 500, height: 50, backgroundColor: '#eeeeee', padding: [0, 10] },
                child: {
                    type: 'hstack',
                    options: { width: 480, height: 50, align: 'space-between' }, // Pushes items to edges
                    children: [
                        { type: 'image', data: logoBytes, imgType: 'png', width: 40, height: 40 },
                        { type: 'text', content: 'Centered Title?', options: { size: 16 } },
                        { type: 'text', content: 'Right Item', options: { size: 12, color: '#666666' } }
                    ]
                }
            },

            // 3. Space Evenly
            {
                type: 'box',
                options: { width: 500, height: 60, backgroundColor: '#e0e0ff', padding: 0 },
                child: {
                    type: 'hstack',
                    options: { width: 500, height: 60, align: 'space-evenly' },
                    children: [
                        { type: 'rect', width: 50, height: 30, options: { style: 'F', color: '#ff0000' } },
                        { type: 'rect', width: 50, height: 30, options: { style: 'F', color: '#00ff00' } },
                        { type: 'rect', width: 50, height: 30, options: { style: 'F', color: '#0000ff' } }
                    ]
                }
            }
        ]
    }, 50, 800);

    doc.save("out-flex-test.pdf");
    console.log("Saved to out-flex-test.pdf");
}

main().catch(console.error);
