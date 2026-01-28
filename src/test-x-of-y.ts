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

    // Header showing "Page X of Y"
    const header = (page: number, total: number): any => ({
        type: 'box',
        options: { 
            backgroundColor: '#212529', 
            padding: 12,
            width: 595
        },
        child: {
            type: 'hstack',
            options: { align: 'space-between' },
            children: [
                { type: 'text', content: 'Kurd-PDFLib PRO REPORT', options: { font: 'EN', size: 10, color: '#ffffff' } },
                { type: 'text', content: `Page ${page} of ${total}`, options: { font: 'EN', size: 10, color: '#ffffff' } }
            ]
        }
    });

    // Simple items to force multiple pages
    const items = [];
    for (let i = 1; i <= 40; i++) {
        items.push({
            type: 'box',
            options: { padding: 15, backgroundColor: '#f8f9fa', borderColor: '#dee2e6', borderWidth: 1 },
            child: { type: 'text', content: `Report Entry Line #${i}`, options: { font: 'EN', size: 12 } }
        });
    }

    const root: any = {
        type: 'vstack',
        options: { gap: 10, padding: 20 },
        children: items
    };

    layout.renderFlow(root, { 
        topMargin: 0, 
        bottomMargin: 40,
        leftMargin: 40,
        header: header
    });

    doc.save('page-x-of-y.pdf');
    console.log('✅ Page X of Y test complete. Check page-x-of-y.pdf');
}

run();
