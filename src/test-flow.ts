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

    // Create a very long list of items to test page flow
    const items = [];
    for (let i = 1; i <= 50; i++) {
        items.push({
            type: 'box',
            options: { 
                padding: 15, 
                backgroundColor: i % 2 === 0 ? '#f8f9fa' : '#ffffff',
                borderColor: '#dee2e6',
                borderWidth: 1,
                width: 500
            },
            child: {
                type: 'hstack',
                options: { align: 'space-between' },
                children: [
                    { type: 'text', content: `Item Number ${i}`, options: { font: 'EN', size: 12 } },
                    { type: 'text', content: `بڕگەی ژمارە ${i}`, options: { font: 'AR', size: 12, rtl: true } }
                ]
            }
        });
    }

    const root: any = {
        type: 'vstack',
        options: { gap: 10, padding: 20 },
        children: [
            { type: 'text', content: 'Page Flow Test Report', options: { font: 'EN', size: 24, color: '#0d6efd' } },
            { type: 'rect', width: 500, height: 2, options: { style: 'F', color: '#0d6efd' } },
            { type: 'spacer', size: 20 },
            ...items
        ]
    };

    // Use the new renderFlow method!
    layout.renderFlow(root, { topMargin: 50, bottomMargin: 50, leftMargin: 40 });

    doc.save('page-flow-test.pdf');
    console.log('✅ Page flow test complete. Check page-flow-test.pdf');
}

run();
