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

    // Page 1: Table of Contents
    const root: any = {
        type: 'vstack',
        options: { gap: 20, padding: 50 },
        children: [
            { type: 'text', content: 'Document Table of Contents', options: { font: 'EN', size: 24, color: '#333' } },
            {
                type: 'link',
                url: '',
                targetPage: 1, // Jump to Page 2
                child: {
                    type: 'box',
                    options: { backgroundColor: '#0d6efd', padding: 10, borderRadius: 5, width: 250 },
                    child: { type: 'text', content: '→ Go to Page 2 (Kurdish Content)', options: { font: 'EN', color: '#fff' } }
                }
            },
            {
                type: 'link',
                url: '',
                targetPage: 2, // Jump to Page 3
                child: {
                    type: 'box',
                    options: { backgroundColor: '#198754', padding: 10, borderRadius: 5, width: 250 },
                    child: { type: 'text', content: '→ Go to Page 3 (System Status)', options: { font: 'EN', color: '#fff' } }
                }
            }
        ]
    };
    layout.render(root, 0, 842);

    // Page 2: Kurdish Content
    doc.addPage();
    layout.render({
        type: 'vstack',
        options: { padding: 50, gap: 20 },
        children: [
            { type: 'text', content: 'لاپەڕەی دووەم: ناوەڕۆکی کوردی', options: { font: 'AR', size: 24, rtl: true } },
            { type: 'text', content: 'ئەمە نموونەیەکی بەستەری ناوخۆییە. دەتوانیت بگەڕێیتەوە بۆ لاپەڕەی یەکەم.', options: { font: 'AR', size: 14, rtl: true } },
            {
                type: 'link',
                url: '',
                targetPage: 0, // Jump back to Page 1
                child: {
                    type: 'box',
                    options: { borderColor: '#333', borderWidth: 1, padding: 10, borderRadius: 5, width: 200 },
                    child: { type: 'text', content: 'Back to Start', options: { font: 'EN', align: 'center' } }
                }
            }
        ]
    }, 0, 842);

    // Page 3: System Status
    doc.addPage();
    layout.render({
        type: 'vstack',
        options: { padding: 50, gap: 20 },
        children: [
            { type: 'text', content: 'Page 3: Technical Overview', options: { font: 'EN', size: 24 } },
            { type: 'rect', width: 400, height: 100, options: { color: '#eee', style: 'F' } },
            {
                type: 'link',
                url: '',
                targetPage: 0,
                child: { type: 'text', content: 'Return to Table of Contents', options: { font: 'EN', color: '#0000ff' } }
            }
        ]
    }, 0, 842);

    doc.save('page-jumps-test.pdf');
    console.log('✅ Page jumps test complete. Check page-jumps-test.pdf');
}

run();
