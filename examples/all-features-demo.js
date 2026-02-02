/**
 * Comprehensive Demo: All Features of Kurd-PDFLib
 */

import { KurdPDF, LayoutEngine } from '../dist/index.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load fonts
const notoSans = fs.readFileSync(path.join(__dirname, '../assets/NotoSans-Regular.ttf'));
const notoArabic = fs.readFileSync(path.join(__dirname, '../assets/NotoSansArabic-Regular.ttf'));
const notoEmoji = fs.readFileSync(path.join(__dirname, '../assets/NotoEmoji-Regular.ttf'));

// Load images
const pngImage = fs.readFileSync(path.join(__dirname, '../assets/transparent-sample.png'));
const jpegImage = fs.readFileSync(path.join(__dirname, '../assets/photo.jpg'));

console.log('=== Kurd-PDFLib: All Features Demo ===\n');

async function generatePDF() {
    const pdf = new KurdPDF({
        fonts: {
            F1: { fontBytes: notoSans, baseFontName: 'NotoSans' },
            F2: { fontBytes: notoArabic, baseFontName: 'NotoSansArabic' },
            F3: { fontBytes: notoEmoji, baseFontName: 'NotoEmoji' }
        },
        title: 'Kurd-PDFLib Feature Showcase',
        author: 'Kurdish PDF Library',
        subject: 'Comprehensive demonstration of all library features'
    });
    await pdf.init();

    // ============================================
    // PAGE 1: Typography & Text Features
    // ============================================
    pdf.addPage();
    pdf.addBookmark('Typography & Text', 0);

    // Title with gradient background
    pdf.rect(0, 792 - 80, 595, 80, 'F', '#2c3e50');
    pdf.text('Kurd-PDFLib Feature Showcase', 50, 792 - 50, { font: 'F1', size: 28, color: '#ffffff' });

    let y = 792 - 120;

    // Section: Multi-Script Support
    pdf.text('1. Multi-Script Support', 50, y, { font: 'F1', size: 16, color: '#e74c3c' });
    y -= 30;

    pdf.text('English: The quick brown fox jumps over the lazy dog.', 50, y, { font: 'F1', size: 12, color: '#333333' });
    y -= 20;

    pdf.text('سۆرانی کوردی: زمانی کوردی زمانێکی زۆر جوانە', 50, y, { font: 'F2', size: 14, rtl: true, color: '#333333' });
    y -= 20;

    pdf.text('العربية: اللغة العربية من أجمل اللغات في العالم', 50, y, { font: 'F2', size: 14, rtl: true, color: '#333333' });
    y -= 40;

    // Section: Text Alignment & Wrapping
    pdf.text('2. Text Alignment & Wrapping', 50, y, { font: 'F1', size: 16, color: '#e74c3c' });
    y -= 25;

    // Left aligned
    pdf.rect(50, y - 50, 230, 55, 'F', '#ecf0f1');
    pdf.text('Left aligned text that wraps nicely within a constrained width box.', 55, y - 5, {
        font: 'F1', size: 10, width: 220, align: 'left', color: '#333333'
    });

    // Right aligned
    pdf.rect(310, y - 50, 230, 55, 'F', '#ecf0f1');
    pdf.text('Right aligned text that wraps nicely within a constrained width box.', 315, y - 5, {
        font: 'F1', size: 10, width: 220, align: 'right', color: '#333333'
    });
    y -= 70;

    // Center aligned
    pdf.rect(50, y - 50, 230, 55, 'F', '#ecf0f1');
    pdf.text('Center aligned text that wraps nicely within a constrained width box.', 55, y - 5, {
        font: 'F1', size: 10, width: 220, align: 'center', color: '#333333'
    });

    // Justified
    pdf.rect(310, y - 50, 230, 55, 'F', '#ecf0f1');
    pdf.text('Justified text spreads words evenly across the full width of the line.', 315, y - 5, {
        font: 'F1', size: 10, width: 220, align: 'justify', color: '#333333'
    });
    y -= 80;

    // Section: Emoji Support
    pdf.text('3. Emoji Support', 50, y, { font: 'F1', size: 16, color: '#e74c3c' });
    y -= 25;
    pdf.text('Emojis work great! 😀 🎉 🚀 ❤️ 🌟 🎨 📚 💻', 50, y, { font: 'F3', size: 16, color: '#333333' });
    y -= 40;

    // Section: Letter & Word Spacing
    pdf.text('4. Letter & Word Spacing', 50, y, { font: 'F1', size: 16, color: '#e74c3c' });
    y -= 25;
    pdf.text('Normal spacing: Hello World', 50, y, { font: 'F1', size: 12, color: '#333333' });
    y -= 18;
    pdf.text('Letter spacing +2: Hello World', 50, y, { font: 'F1', size: 12, color: '#333333', letterSpacing: 2 });
    y -= 18;
    pdf.text('Word spacing +10: Hello World', 50, y, { font: 'F1', size: 12, color: '#333333', wordSpacing: 10 });
    y -= 40;

    // Section: Color Formats
    pdf.text('5. Color Formats', 50, y, { font: 'F1', size: 16, color: '#e74c3c' });
    y -= 25;
    pdf.text('Hex 6-digit: #3498db', 50, y, { font: 'F1', size: 12, color: '#3498db' });
    pdf.text('Hex 3-digit: #f00', 180, y, { font: 'F1', size: 12, color: '#f00' });
    pdf.text('Named: gold', 280, y, { font: 'F1', size: 12, color: 'gold' });
    y -= 18;
    pdf.rect(50, y - 15, 80, 20, 'F', 'cmyk(100%, 0%, 0%, 0%)');
    pdf.text('CMYK Cyan', 55, y - 3, { font: 'F1', size: 10, color: '#ffffff' });
    pdf.rect(140, y - 15, 80, 20, 'F', 'cmyk(0%, 100%, 0%, 0%)');
    pdf.text('CMYK Magenta', 145, y - 3, { font: 'F1', size: 10, color: '#ffffff' });
    pdf.rect(230, y - 15, 80, 20, 'F', 'cmyk(0%, 0%, 100%, 0%)');
    pdf.text('CMYK Yellow', 235, y - 3, { font: 'F1', size: 10, color: '#333333' });

    // ============================================
    // PAGE 2: Graphics & Shapes
    // ============================================
    pdf.addPage();
    pdf.addBookmark('Graphics & Shapes', 1);

    // Title
    pdf.rect(0, 792 - 80, 595, 80, 'F', '#27ae60');
    pdf.text('Graphics & Shapes', 50, 792 - 50, { font: 'F1', size: 28, color: '#ffffff' });

    y = 792 - 120;

    // Section: Rectangles
    pdf.text('1. Rectangles & Borders', 50, y, { font: 'F1', size: 16, color: '#27ae60' });
    y -= 30;

    // Filled rect
    pdf.rect(50, y - 50, 80, 50, 'F', '#3498db');
    pdf.text('Filled', 75, y - 60, { font: 'F1', size: 10, color: '#ffffff' });

    // Stroked rect
    pdf.rect(150, y - 50, 80, 50, 'S', '#e74c3c', 2);
    pdf.text('Stroked', 172, y - 28, { font: 'F1', size: 10, color: '#e74c3c' });

    // Fill + Stroke
    pdf.rect(250, y - 50, 80, 50, 'FD', '#f1c40f', 3);
    pdf.text('Fill+Stroke', 265, y - 28, { font: 'F1', size: 10, color: '#333333' });

    y -= 80;

    // Section: Custom Paths
    pdf.text('2. Custom Paths & Bezier Curves', 50, y, { font: 'F1', size: 16, color: '#27ae60' });
    y -= 30;

    // Triangle
    pdf.path([
        { x: 90, y: y - 60, type: 'M' },
        { x: 50, y: y, type: 'L' },
        { x: 130, y: y, type: 'L' },
    ], 'F', '#e74c3c');
    pdf.text('Triangle', 65, y + 15, { font: 'F1', size: 10, color: '#333333' });

    // Star shape
    const starCx = 200, starCy = y - 30, starOuter = 30, starInner = 12;
    const starPoints = [];
    for (let i = 0; i < 10; i++) {
        const angle = (i * Math.PI / 5) - Math.PI / 2;
        const r = i % 2 === 0 ? starOuter : starInner;
        starPoints.push({
            x: starCx + r * Math.cos(angle),
            y: starCy + r * Math.sin(angle),
            type: i === 0 ? 'M' : 'L'
        });
    }
    pdf.path(starPoints, 'F', '#f1c40f');
    pdf.text('Star', 185, y + 15, { font: 'F1', size: 10, color: '#333333' });

    // Bezier curve
    pdf.path([
        { x: 280, y: y, type: 'M' },
        { x: 350, y: y - 60, type: 'C', cp1: { x: 280, y: y - 80 }, cp2: { x: 350, y: y + 20 } },
    ], 'S', '#3498db', 3);
    pdf.text('Bezier', 300, y + 15, { font: 'F1', size: 10, color: '#333333' });

    // Heart shape
    const hx = 420, hy = y - 25;
    pdf.path([
        { x: hx, y: hy - 15, type: 'M' },
        { x: hx + 25, y: hy - 35, type: 'C', cp1: { x: hx, y: hy - 35 }, cp2: { x: hx + 25, y: hy - 35 } },
        { x: hx + 25, y: hy - 10, type: 'C', cp1: { x: hx + 25, y: hy - 20 }, cp2: { x: hx + 25, y: hy - 10 } },
        { x: hx, y: hy + 15, type: 'C', cp1: { x: hx + 25, y: hy + 5 }, cp2: { x: hx + 10, y: hy + 15 } },
        { x: hx - 25, y: hy - 10, type: 'C', cp1: { x: hx - 10, y: hy + 15 }, cp2: { x: hx - 25, y: hy + 5 } },
        { x: hx - 25, y: hy - 35, type: 'C', cp1: { x: hx - 25, y: hy - 20 }, cp2: { x: hx - 25, y: hy - 35 } },
        { x: hx, y: hy - 15, type: 'C', cp1: { x: hx - 25, y: hy - 35 }, cp2: { x: hx, y: hy - 35 } },
    ], 'F', '#e74c3c');
    pdf.text('Heart', 405, y + 15, { font: 'F1', size: 10, color: '#333333' });

    y -= 90;

    // Section: Gradients
    pdf.text('3. Gradients (Linear & Radial)', 50, y, { font: 'F1', size: 16, color: '#27ae60' });
    y -= 30;

    // Linear gradient - use clipping path
    pdf.rect(50, y - 60, 150, 60, 'N');
    pdf.gradient([
        { offset: 0, color: '#3498db' },
        { offset: 0.5, color: '#9b59b6' },
        { offset: 1, color: '#e74c3c' }
    ], 50, y - 60, 200, y);
    pdf.restoreGraphicsState();
    pdf.text('Linear Gradient', 80, y + 10, { font: 'F1', size: 10, color: '#333333' });

    // Radial gradient
    pdf.rect(250, y - 60, 150, 60, 'N');
    pdf.radialGradient([
        { offset: 0, color: '#f1c40f' },
        { offset: 0.5, color: '#e67e22' },
        { offset: 1, color: '#c0392b' }
    ], 325, y - 30, 0, 325, y - 30, 75);
    pdf.restoreGraphicsState();
    pdf.text('Radial Gradient', 280, y + 10, { font: 'F1', size: 10, color: '#333333' });

    y -= 90;

    // Section: Opacity
    pdf.text('4. Opacity / Transparency', 50, y, { font: 'F1', size: 16, color: '#27ae60' });
    y -= 30;

    // Base rectangles
    pdf.rect(50, y - 50, 60, 50, 'F', '#3498db');
    pdf.rect(80, y - 40, 60, 50, 'F', '#e74c3c');

    // With opacity
    pdf.rect(200, y - 50, 60, 50, 'F', '#3498db');
    pdf.setOpacity(0.5);
    pdf.rect(230, y - 40, 60, 50, 'F', '#e74c3c');
    pdf.restoreGraphicsState();

    pdf.text('No opacity', 60, y + 10, { font: 'F1', size: 10, color: '#333333' });
    pdf.text('50% opacity', 205, y + 10, { font: 'F1', size: 10, color: '#333333' });

    // ============================================
    // PAGE 3: Images & Layout Engine
    // ============================================
    pdf.addPage();
    pdf.addBookmark('Images & Layout', 2);

    // Title
    pdf.rect(0, 792 - 80, 595, 80, 'F', '#9b59b6');
    pdf.text('Images & Layout Engine', 50, 792 - 50, { font: 'F1', size: 28, color: '#ffffff' });

    y = 792 - 120;

    // Section: Images
    pdf.text('1. Image Support (PNG & JPEG)', 50, y, { font: 'F1', size: 16, color: '#9b59b6' });
    y -= 20;

    // PNG image
    pdf.image(pngImage, 'png', 50, y - 100, 120, 100);
    pdf.text('PNG with transparency', 55, y - 110, { font: 'F1', size: 10, color: '#333333' });

    // JPEG image
    pdf.image(jpegImage, 'jpeg', 200, y - 100, 120, 100);
    pdf.text('JPEG image', 225, y - 110, { font: 'F1', size: 10, color: '#333333' });

    // Circular masked image
    pdf.maskedCircleImage(pngImage, 'png', 410, y - 50, 50);
    pdf.text('Circular mask', 385, y - 110, { font: 'F1', size: 10, color: '#333333' });

    y -= 140;

    // Section: Layout Engine
    pdf.text('2. Layout Engine Demo', 50, y, { font: 'F1', size: 16, color: '#9b59b6' });
    y -= 20;

    // Use LayoutEngine for complex layouts
    const layout = new LayoutEngine(pdf);

    const layoutRoot = {
        type: 'vstack',
        options: { gap: 10, padding: 0 },
        children: [
            // HStack with flex
            {
                type: 'hstack',
                options: { gap: 10 },
                children: [
                    { type: 'box', options: { flex: 1, backgroundColor: '#3498db', padding: 10, borderRadius: 4 },
                      child: { type: 'text', content: 'Box 1 (flex:1)', options: { font: 'F1', size: 10, color: '#ffffff' } } },
                    { type: 'box', options: { flex: 2, backgroundColor: '#e74c3c', padding: 10, borderRadius: 4 },
                      child: { type: 'text', content: 'Box 2 (flex:2)', options: { font: 'F1', size: 10, color: '#ffffff' } } },
                    { type: 'box', options: { flex: 1, backgroundColor: '#27ae60', padding: 10, borderRadius: 4 },
                      child: { type: 'text', content: 'Box 3 (flex:1)', options: { font: 'F1', size: 10, color: '#ffffff' } } }
                ]
            },
            // Grid
            {
                type: 'grid',
                columns: 3,
                options: { gap: 5, padding: 5, backgroundColor: '#ecf0f1', borderRadius: 4 },
                children: [
                    { type: 'box', options: { backgroundColor: '#1abc9c', padding: 8, borderRadius: 4 },
                      child: { type: 'text', content: 'Grid 1', options: { font: 'F1', size: 10, color: '#ffffff' } } },
                    { type: 'box', options: { backgroundColor: '#2ecc71', padding: 8, borderRadius: 4 },
                      child: { type: 'text', content: 'Grid 2', options: { font: 'F1', size: 10, color: '#ffffff' } } },
                    { type: 'box', options: { backgroundColor: '#3498db', padding: 8, borderRadius: 4 },
                      child: { type: 'text', content: 'Grid 3', options: { font: 'F1', size: 10, color: '#ffffff' } } },
                    { type: 'box', options: { backgroundColor: '#9b59b6', padding: 8, borderRadius: 4 },
                      child: { type: 'text', content: 'Grid 4', options: { font: 'F1', size: 10, color: '#ffffff' } } },
                    { type: 'box', options: { backgroundColor: '#e74c3c', padding: 8, borderRadius: 4 },
                      child: { type: 'text', content: 'Grid 5', options: { font: 'F1', size: 10, color: '#ffffff' } } },
                    { type: 'box', options: { backgroundColor: '#f39c12', padding: 8, borderRadius: 4 },
                      child: { type: 'text', content: 'Grid 6', options: { font: 'F1', size: 10, color: '#333333' } } }
                ]
            }
        ]
    };

    layout.render(layoutRoot, 50, y, 495);

    y -= 130;

    // Section: Table
    pdf.text('3. Table Rendering', 50, y, { font: 'F1', size: 16, color: '#9b59b6' });
    y -= 10;

    const tableRoot = {
        type: 'table',
        headers: ['Name', 'Description', 'Price', 'Stock'],
        rows: [
            ['Widget A', 'Basic widget', '$10.00', '150'],
            ['Widget B', 'Advanced widget', '$25.00', '75'],
            ['Widget C', 'Premium widget', '$50.00', '30'],
            ['Widget D', 'Enterprise', '$100.00', '10']
        ],
        options: {
            headerBackgroundColor: '#34495e',
            headerTextColor: '#ffffff',
            headerFont: 'F1',
            headerFontSize: 11,
            alternateRowBackgroundColor: '#ecf0f1',
            padding: 8
        }
    };

    layout.render(tableRoot, 50, y, 400);

    // ============================================
    // PAGE 4: Links & Interactive Features
    // ============================================
    pdf.addPage();
    pdf.addBookmark('Links & Interactivity', 3);

    // Title
    pdf.rect(0, 792 - 80, 595, 80, 'F', '#e67e22');
    pdf.text('Links & Interactive Features', 50, 792 - 50, { font: 'F1', size: 28, color: '#ffffff' });

    y = 792 - 120;

    // Section: External Links
    pdf.text('1. External Links (Click to open)', 50, y, { font: 'F1', size: 16, color: '#e67e22' });
    y -= 30;

    pdf.text('Visit GitHub Repository', 50, y, { font: 'F1', size: 12, color: '#3498db' });
    pdf.addLink('https://github.com', 50, y - 5, 150, 20);
    y -= 25;

    pdf.text('Anthropic Website', 50, y, { font: 'F1', size: 12, color: '#3498db' });
    pdf.addLink('https://anthropic.com', 50, y - 5, 120, 20);
    y -= 40;

    // Section: Internal Links
    pdf.text('2. Internal Links (Jump to pages)', 50, y, { font: 'F1', size: 16, color: '#e67e22' });
    y -= 30;

    pdf.text('Go to Page 1: Typography', 50, y, { font: 'F1', size: 12, color: '#9b59b6' });
    pdf.addPageLink(0, 50, y - 5, 150, 20);
    y -= 25;

    pdf.text('Go to Page 2: Graphics', 50, y, { font: 'F1', size: 12, color: '#9b59b6' });
    pdf.addPageLink(1, 50, y - 5, 130, 20);
    y -= 25;

    pdf.text('Go to Page 3: Images & Layout', 50, y, { font: 'F1', size: 12, color: '#9b59b6' });
    pdf.addPageLink(2, 50, y - 5, 160, 20);
    y -= 50;

    // Section: Bookmarks
    pdf.text('3. Bookmarks/Outlines', 50, y, { font: 'F1', size: 16, color: '#e67e22' });
    y -= 30;
    pdf.text('This PDF has bookmarks! Check the PDF reader\'s bookmark panel', 50, y, { font: 'F1', size: 12, color: '#333333' });
    pdf.text('to see the document outline with links to each section.', 50, y - 18, { font: 'F1', size: 12, color: '#333333' });
    y -= 60;

    // Section: Metadata
    pdf.text('4. Document Metadata', 50, y, { font: 'F1', size: 16, color: '#e67e22' });
    y -= 30;
    pdf.text('This PDF includes metadata:', 50, y, { font: 'F1', size: 12, color: '#333333' });
    y -= 20;
    pdf.text('Title: Kurd-PDFLib Feature Showcase', 70, y, { font: 'F1', size: 11, color: '#666666' });
    y -= 18;
    pdf.text('Author: Kurdish PDF Library', 70, y, { font: 'F1', size: 11, color: '#666666' });
    y -= 18;
    pdf.text('Subject: Comprehensive demonstration of all library features', 70, y, { font: 'F1', size: 11, color: '#666666' });
    y -= 40;

    // Final section: Feature Summary
    pdf.text('5. Feature Summary', 50, y, { font: 'F1', size: 16, color: '#e67e22' });
    y -= 25;

    const features = [
        'Multi-script text (EN, KU, AR)',
        'RTL text with HarfBuzz shaping',
        'Text alignment (left/right/center/justify)',
        'Emoji support with surrogate pairs',
        'Color formats (hex, named, CMYK)',
        'Shapes (rectangles, paths, bezier)',
        'Linear & radial gradients',
        'Transparency/opacity',
        'PNG images with alpha channel',
        'JPEG images',
        'Circular image masking',
        'Flexbox-like layout engine',
        'Grid layout system',
        'Table rendering',
        'External & internal links',
        'Bookmarks/outlines',
        'Document metadata',
        'PDF encryption (AES/RC4)'
    ];

    for (let i = 0; i < features.length; i++) {
        const col = i < 9 ? 0 : 1;
        const row = i < 9 ? i : i - 9;
        pdf.text(`- ${features[i]}`, 50 + col * 270, y - row * 16, { font: 'F1', size: 10, color: '#333333' });
    }

    // Save PDF
    const pdfBytes = await pdf.save();
    const outputPath = path.join(__dirname, 'all-features-demo.pdf');
    fs.writeFileSync(outputPath, Buffer.from(pdfBytes));

    console.log(`PDF created: ${outputPath}`);
    console.log(`File size: ${(pdfBytes.length / 1024).toFixed(1)} KB`);
    console.log('\nFeatures demonstrated:');
    console.log('  - Multi-script typography (English, Kurdish, Arabic)');
    console.log('  - Text alignment and wrapping');
    console.log('  - Emoji support');
    console.log('  - Color formats (hex, named, CMYK)');
    console.log('  - Shapes and paths');
    console.log('  - Gradients (linear & radial)');
    console.log('  - Opacity/transparency');
    console.log('  - Images (PNG, JPEG, circular mask)');
    console.log('  - Layout engine (vstack, hstack, grid, table)');
    console.log('  - Links (external & internal)');
    console.log('  - Bookmarks/outlines');
    console.log('  - Document metadata');
}

generatePDF().catch(console.error);
