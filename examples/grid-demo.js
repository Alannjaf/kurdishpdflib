import { KurdPDF, LayoutEngine } from '../dist/index.js';
import { readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

async function runTest() {
    console.log("Starting comprehensive debug test...");

    try {
        const doc = new KurdPDF({
            fonts: {
                'AR': { fontBytes: readFileSync(path.join(projectRoot, 'assets/NotoSansArabic-Regular.ttf')), baseFontName: 'NotoSansArabic' },
                'EN': { fontBytes: readFileSync(path.join(projectRoot, 'assets/NotoSans-Regular.ttf')), baseFontName: 'NotoSans' },
                'EM': { fontBytes: readFileSync(path.join(projectRoot, 'assets/NotoEmoji-Regular.ttf')), baseFontName: 'NotoEmoji' }
            },
            fallbackOrder: ['EN', 'AR', 'EM'],
            title: 'Kurd-PDFLib Comprehensive Test',
            author: 'Astra'
        });
        await doc.init();

        const layout = new LayoutEngine(doc);

        // Long RTL paragraph for wrapping (Kurdish)
        const rtlLongParagraph = 'ئەمە تاقیکردنەوەیەکی کوردییە بۆ دڵنیابوونەوە لەوەی کە کتێبخانەکە بە باشی کار دەکات و دەقەکان بە ڕێکی نیشان دەدات. نووسینی ڕاست بۆ چەپ و پێچانەوەی دەق لە ناو سنوورەکەدا پشتیوانی دەکرێت. ژمارەکان وەک ١٢٣ لەگەڵ ئینگلیزی تێکەڵ دەبن.';

        const root = {
            type: 'vstack',
            options: { gap: 14, padding: 24 },
            children: [
                { type: 'text', content: 'Kurd-PDFLib Comprehensive Test', options: { font: 'EN', size: 20, align: 'center' } },
                { type: 'text', content: 'Grid Layout, RTL Wrapping, High-Range Unicode', options: { font: 'EN', size: 12, align: 'center', color: '#444' } },

                // --- 1. Grid Layout ---
                { type: 'text', content: '1. Grid Layout', options: { font: 'EN', size: 14, align: 'left' } },
                {
                    type: 'grid',
                    columns: 3,
                    options: { gap: 10, padding: 10, backgroundColor: '#eeeeee', borderRadius: 6 },
                    children: [
                        { type: 'box', options: { backgroundColor: '#ffcccc', padding: 8, borderRadius: 4 }, child: { type: 'text', content: 'Item 1', options: { font: 'EN', size: 10 } } },
                        { type: 'box', options: { backgroundColor: '#ccffcc', padding: 8, borderRadius: 4 }, child: { type: 'text', content: 'Item 2', options: { font: 'EN', size: 10 } } },
                        { type: 'box', options: { backgroundColor: '#ccccff', padding: 8, borderRadius: 4 }, child: { type: 'text', content: 'Item 3', options: { font: 'EN', size: 10 } } },
                        { type: 'box', options: { backgroundColor: '#ffffcc', padding: 8, borderRadius: 4 }, child: { type: 'text', content: 'کوردستان', options: { font: 'AR', size: 10, rtl: true } } },
                        { type: 'box', options: { backgroundColor: '#ffccff', padding: 8, borderRadius: 4 }, child: { type: 'text', content: 'Item 5', options: { font: 'EN', size: 10 } } },
                        { type: 'box', options: { backgroundColor: '#ccffff', padding: 8, borderRadius: 4 }, child: { type: 'text', content: 'Item 6', options: { font: 'EN', size: 10 } } }
                    ]
                },

                // --- 2. RTL text wrapping (narrow box so text wraps) ---
                { type: 'text', content: '2. RTL text wrapping', options: { font: 'EN', size: 14, align: 'left' } },
                {
                    type: 'box',
                    options: { backgroundColor: '#f0f8ff', padding: 12, borderRadius: 6, width: 260 },
                    child: {
                        type: 'text',
                        content: rtlLongParagraph,
                        options: { font: 'AR', size: 11, rtl: true, align: 'justify', lineHeight: 1.5 }
                    }
                },

                // --- 3. High-range Unicode (emoji + Arabic Extended / digits) ---
                { type: 'text', content: '3. High-range Unicode', options: { font: 'EN', size: 14, align: 'left' } },
                {
                    type: 'box',
                    options: { backgroundColor: '#f5f5f5', padding: 10, borderRadius: 5 },
                    child: {
                        type: 'vstack',
                        options: { gap: 6 },
                        children: [
                            { type: 'text', content: 'Emoji (supplementary plane): \uD83D\uDE00 \uD83C\uDF89 \u2705 \u2764', options: { font: 'EN', size: 12 } },
                            { type: 'text', content: 'Arabic-Indic digits: ٠١٢٣٤٥٦٧٨٩', options: { font: 'AR', size: 12, rtl: true } },
                            { type: 'text', content: 'Mixed: Hello ١٢٣ كوردی World \uD83D\uDE0A', options: { font: 'EN', size: 12 } }
                        ]
                    }
                },

                // --- 4. Color bars (existing) ---
                { type: 'text', content: '4. Shapes', options: { font: 'EN', size: 14, align: 'left' } },
                { type: 'hstack', options: { gap: 10 }, children: [
                    { type: 'rect', width: 50, height: 50, options: { color: '#ff0000', style: 'F' } },
                    { type: 'rect', width: 50, height: 50, options: { color: '#00ff00', style: 'F' } },
                    { type: 'rect', width: 50, height: 50, options: { color: '#0000ff', style: 'F' } }
                ]},

                // --- 5. Second grid with RTL in cells (wrapping inside grid) ---
                { type: 'text', content: '5. Grid with RTL cells', options: { font: 'EN', size: 14, align: 'left' } },
                {
                    type: 'grid',
                    columns: 2,
                    options: { gap: 8, padding: 8, backgroundColor: '#fafafa', borderRadius: 4 },
                    children: [
                        { type: 'box', options: { padding: 6 }, child: { type: 'text', content: 'ئەمە دەقێکی کوردییە لە ناو grid.', options: { font: 'AR', size: 10, rtl: true } } },
                        { type: 'box', options: { padding: 6 }, child: { type: 'text', content: 'LTR English in grid.', options: { font: 'EN', size: 10 } } }
                    ]
                }
            ]
        };

        layout.renderFlow(root);

        const pdfBytes = await doc.save();
        const outPath = path.join(projectRoot, 'test-output.pdf');
        writeFileSync(outPath, Buffer.from(pdfBytes));
        console.log("Test PDF generated: test-output.pdf");

    } catch (error) {
        console.error("Test failed:", error);
        throw error;
    }
}

runTest();
