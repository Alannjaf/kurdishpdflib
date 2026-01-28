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

    // Define Header function
    const header = (page: number): any => ({
        type: 'box',
        options: { 
            backgroundColor: '#0d6efd', 
            padding: 15,
            width: 595 // Full A4 width
        },
        child: {
            type: 'hstack',
            options: { align: 'space-between' },
            children: [
                { type: 'text', content: 'KOREK TELECOM PRODUCTION', options: { font: 'EN', size: 10, color: '#ffffff' } },
                { type: 'text', content: `Page ${page}`, options: { font: 'EN', size: 10, color: '#ffffff' } }
            ]
        }
    });

    // Define Footer function
    const footer = (page: number): any => ({
        type: 'vstack',
        options: { width: 515, gap: 5 },
        children: [
            { type: 'rect', width: 515, height: 1, options: { style: 'F', color: '#dee2e6' } },
            {
                type: 'hstack',
                options: { align: 'space-between' },
                children: [
                    { type: 'text', content: '© 2026 Multimedia Agency', options: { font: 'EN', size: 8, color: '#6c757d' } },
                    { type: 'text', content: 'هەموو مافەکان پارێزراون', options: { font: 'AR', size: 8, color: '#6c757d', rtl: true } }
                ]
            }
        ]
    });

    // Create a lot of content
    const items = [];
    for (let i = 1; i <= 30; i++) {
        items.push({
            type: 'box',
            options: { padding: 20, backgroundColor: '#fdfdfd', borderColor: '#eee', borderWidth: 1 },
            child: {
                type: 'vstack',
                options: { gap: 10 },
                children: [
                    { type: 'text', content: `Project Update #${i}`, options: { font: 'EN', size: 16, color: '#333' } },
                    { type: 'text', content: 'This is a detailed description of the production status for the current campaign.', options: { font: 'EN', size: 12, color: '#666', width: 400 } }
                ]
            }
        });
    }

    const root: any = {
        type: 'vstack',
        options: { gap: 15, padding: 20 },
        children: items
    };

    layout.renderFlow(root, { 
        topMargin: 0, // Header is absolute
        bottomMargin: 40,
        leftMargin: 40,
        header: header,
        footer: footer
    });

    doc.save('header-footer-test.pdf');
    console.log('✅ Header/Footer test complete. Check header-footer-test.pdf');
}

run();
