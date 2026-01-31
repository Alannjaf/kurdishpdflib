import { KurdPDF, LayoutEngine } from '../dist/index.js';
import { readFileSync, writeFileSync } from 'fs';
import path from 'path';

async function runTest() {
    console.log("Starting debug test...");
    
    try {
        const doc = new KurdPDF({
            fonts: {
                'AR': { fontBytes: readFileSync('assets/NotoSansArabic-Regular.ttf'), baseFontName: 'NotoSansArabic' },
                'EN': { fontBytes: readFileSync('assets/NotoSans-Regular.ttf'), baseFontName: 'NotoSans' }
            },
            title: 'Debug Test',
            author: 'Astra'
        });
        await doc.init();

        const layout = new LayoutEngine(doc);

        const root = {
            type: 'vstack',
            options: { gap: 10, padding: 20 },
            children: [
                { type: 'text', content: 'Kurd-PDFLib Debug Test', options: { font: 'EN', size: 18, align: 'center' } },
                { type: 'box', options: { backgroundColor: '#f0f0f0', padding: 10, borderRadius: 5 }, child: {
                    type: 'text', 
                    content: 'ئەمە تاقیکردنەوەیەکی کوردییە بۆ دڵنیابوونەوە لەوەی کە کتێبخانەکە بە باشی کار دەکات و دەقەکان بە ڕێکی نیشان دەدات.',
                    options: { font: 'AR', size: 14, rtl: true, align: 'justify' }
                }},
                { type: 'hstack', options: { gap: 10 }, children: [
                    { type: 'rect', width: 50, height: 50, options: { color: '#ff0000', style: 'F' } },
                    { type: 'rect', width: 50, height: 50, options: { color: '#00ff00', style: 'F' } },
                    { type: 'rect', width: 50, height: 50, options: { color: '#0000ff', style: 'F' } }
                ]},
                { type: 'text', content: 'Grid Layout Test:', options: { font: 'EN', size: 14, align: 'left' } },
                {
                    type: 'grid',
                    columns: 3,
                    options: { gap: 10, padding: 10, backgroundColor: '#eeeeee' },
                    children: [
                        { type: 'box', options: { backgroundColor: '#ffcccc', padding: 5 }, child: { type: 'text', content: 'Item 1', options: { font: 'EN', size: 10 } } },
                        { type: 'box', options: { backgroundColor: '#ccffcc', padding: 5 }, child: { type: 'text', content: 'Item 2', options: { font: 'EN', size: 10 } } },
                        { type: 'box', options: { backgroundColor: '#ccccff', padding: 5 }, child: { type: 'text', content: 'Item 3', options: { font: 'EN', size: 10 } } },
                        { type: 'box', options: { backgroundColor: '#ffffcc', padding: 5 }, child: { type: 'text', content: 'کوردستان', options: { font: 'AR', size: 10, rtl: true } } },
                        { type: 'box', options: { backgroundColor: '#ffccff', padding: 5 }, child: { type: 'text', content: 'Item 5', options: { font: 'EN', size: 10 } } },
                        { type: 'box', options: { backgroundColor: '#ccffff', padding: 5 }, child: { type: 'text', content: 'Item 6', options: { font: 'EN', size: 10 } } }
                    ]
                }
            ]
        };

        layout.renderFlow(root);
        
        const pdfBytes = await doc.save();
        writeFileSync('test-output.pdf', Buffer.from(pdfBytes));
        console.log("Test PDF generated: test-output.pdf");
        
    } catch (error) {
        console.error("Test failed:", error);
    }
}

runTest();
