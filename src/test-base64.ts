import { KurdPDF, LayoutEngine } from './index.js';
import { readFileSync } from 'fs';

async function run() {
    const doc = new KurdPDF({
        fonts: {
            'AR': { fontBytes: readFileSync('assets/NotoSansArabic-Regular.ttf'), baseFontName: 'NotoSansArabic' },
            'EN': { fontBytes: readFileSync('assets/NotoSans-Regular.ttf'), baseFontName: 'NotoSans' }
        }
    });
    await doc.init();

    const layout = new LayoutEngine(doc);

    // Read a real PNG and convert to Base64 to simulate a web app scenario
    const pngBuffer = readFileSync('assets/logo.png');
    const base64Image = `data:image/png;base64,${pngBuffer.toString('base64')}`;

    const root: any = {
        type: 'vstack',
        options: { gap: 30, padding: 50, align: 'center' },
        children: [
            { type: 'text', content: 'Base64 Image Support Test', options: { font: 'EN', size: 24, color: '#0d6efd' } },
            {
                type: 'box',
                options: { 
                    borderColor: '#dee2e6', 
                    borderWidth: 1, 
                    borderRadius: 15,
                    backgroundColor: '#f8f9fa',
                    padding: 20
                },
                child: {
                    type: 'image',
                    data: base64Image, // Using Base64 string!
                    imgType: 'png',
                    width: 150,
                    height: 150,
                    options: { objectFit: 'contain' }
                }
            },
            { type: 'text', content: 'The image above was rendered from a Base64 string.', options: { font: 'EN', size: 14 } }
        ]
    };

    layout.render(root, 0, 842);

    doc.save('base64-test.pdf');
    console.log('✅ Base64 test complete. Check base64-test.pdf');
}

run();
