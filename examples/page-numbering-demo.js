/**
 * Page Numbering Demo - demonstrates headers/footers with page numbers
 */

import { KurdPDF, LayoutEngine, createPageFooter, createPageHeader } from '../dist/index.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load fonts
const notoSans = fs.readFileSync(path.join(__dirname, '../assets/NotoSans-Regular.ttf'));
const notoArabic = fs.readFileSync(path.join(__dirname, '../assets/NotoSansArabic-Regular.ttf'));

console.log('=== Page Numbering Demo ===\n');

async function generatePDF() {
    const pdf = new KurdPDF({
        fonts: {
            EN: { fontBytes: notoSans, baseFontName: 'NotoSans' },
            AR: { fontBytes: notoArabic, baseFontName: 'NotoSansArabic' }
        },
        title: 'Page Numbering Demo',
        author: 'Kurd-PDFLib'
    });
    await pdf.init();

    const layout = new LayoutEngine(pdf);

    // Create content that spans multiple pages
    const paragraphs = [];
    for (let i = 1; i <= 15; i++) {
        paragraphs.push({
            type: 'box',
            options: { backgroundColor: i % 2 === 0 ? '#f0f0f0' : '#ffffff', padding: 15, borderRadius: 4 },
            child: {
                type: 'vstack',
                options: { gap: 8 },
                children: [
                    { type: 'text', content: `Section ${i}`, options: { font: 'EN', size: 16, color: '#333333' } },
                    {
                        type: 'text',
                        content: `This is paragraph ${i} of the document. It contains some sample text to demonstrate how the layout engine handles multi-page documents with automatic page breaking. The header and footer will be repeated on each page with the correct page numbers.`,
                        options: { font: 'EN', size: 11, color: '#666666', lineHeight: 1.5 }
                    }
                ]
            }
        });
    }

    const content = {
        type: 'vstack',
        options: { gap: 15, padding: 20 },
        children: [
            // Title
            { type: 'text', content: 'Page Numbering Demo', options: { font: 'EN', size: 24, align: 'center', color: '#2c3e50' } },
            { type: 'text', content: 'Demonstrating headers and footers with automatic page numbers', options: { font: 'EN', size: 12, align: 'center', color: '#7f8c8d' } },
            // Spacer
            { type: 'box', options: { height: 20 }, child: { type: 'text', content: '', options: { font: 'EN', size: 1 } } },
            // Content sections
            ...paragraphs
        ]
    };

    // Render with header and footer
    layout.renderFlow(content, {
        topMargin: 60,
        bottomMargin: 60,
        leftMargin: 50,
        rightMargin: 50,
        header: createPageHeader({
            text: 'Kurd-PDFLib Documentation',
            font: 'EN',
            size: 10,
            color: '#999999',
            align: 'left'
        }),
        footer: createPageFooter({
            text: 'Page {pageNum} of {totalPages}',
            font: 'EN',
            size: 10,
            color: '#666666',
            align: 'center'
        })
    });

    // Save PDF
    const pdfBytes = await pdf.save();
    const outputPath = path.join(__dirname, 'page-numbering-demo.pdf');
    fs.writeFileSync(outputPath, Buffer.from(pdfBytes));

    console.log(`PDF created: ${outputPath}`);
    console.log(`Total pages: ${pdf.pageCount}`);
    console.log(`File size: ${(pdfBytes.length / 1024).toFixed(1)} KB`);
    console.log('\nFeatures demonstrated:');
    console.log('  - Automatic page breaking');
    console.log('  - Header on each page');
    console.log('  - Footer with "Page X of Y" format');
    console.log('  - {pageNum} and {totalPages} placeholders');
}

generatePDF().catch(console.error);
