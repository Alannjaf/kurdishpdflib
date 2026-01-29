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

    const root: any = {
        type: 'vstack',
        options: { gap: 20, padding: 40, width: '100%' },
        children: [
            { type: 'text', content: 'BiDi Number Reversal Test', options: { font: 'EN', size: 20 } },
            
            // The problematic case
            { 
                type: 'text', 
                content: 'پڕۆژەی 36', 
                options: { font: 'AR', size: 24, color: '#000', align: 'right' } 
            },

            { 
                type: 'text', 
                content: 'ژمارە: 12345', 
                options: { font: 'AR', size: 24, color: '#000', align: 'right' } 
            },

            { 
                type: 'text', 
                content: 'Item 36 in English (Correct)', 
                options: { font: 'EN', size: 18 } 
            }
        ]
    };

    layout.render(root, 0, 842);

    doc.save('bidi-test.pdf');
    console.log('✅ BiDi test complete. Check bidi-test.pdf');
}

run();
