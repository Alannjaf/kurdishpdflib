import { KurdPDF, LayoutEngine } from './index.js';
import { readFileSync } from 'fs';

async function run() {
    const doc = new KurdPDF({
        fonts: {
            'AR': { fontBytes: readFileSync('assets/NotoSansArabic-Regular.ttf'), baseFontName: 'NotoSansArabic' },
            'EN': { fontBytes: readFileSync('assets/NotoSans-Regular.ttf'), baseFontName: 'NotoSans' }
        },
        title: 'Bookmarks Test'
    });
    await doc.init();

    const layout = new LayoutEngine(doc);

    // Page 1
    doc.addBookmark('Introduction', 0);
    layout.render({ type: 'text', content: 'Welcome to Bookmarks (Outlines) Test', options: { font: 'EN', size: 24 } }, 50, 750);

    // Page 2
    doc.addPage();
    doc.addBookmark('Kurdish Support', 1);
    layout.render({ type: 'text', content: 'سڵاو، ئەمە لاپەڕەی دووەمە', options: { font: 'AR', size: 24, rtl: true } }, 50, 750);

    // Page 3
    doc.addPage();
    doc.addBookmark('Technical Specs', 2);
    layout.render({ type: 'text', content: 'Here you would put some numbers or charts.', options: { font: 'EN', size: 18 } }, 50, 750);

    doc.save('bookmarks-test.pdf');
    console.log('✅ Bookmarks test complete. Check bookmarks-test.pdf');
}

run();
