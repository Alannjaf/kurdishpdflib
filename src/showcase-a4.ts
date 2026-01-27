import { KurdPDF, LayoutEngine } from './index.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
// Asset paths
const arabicFontPath = join(__dirname, '..', 'assets', 'NotoSansArabic-Regular.ttf');
const latinFontPath = join(__dirname, '..', 'assets', 'NotoSans-Regular.ttf');
const photoPath = join(__dirname, '..', 'assets', 'photo.jpg');
const pngPath = join(__dirname, '..', 'assets', 'transparent-sample.png'); 
const svgPath = join(__dirname, '..', 'assets', 'Logo.svg'); 

// Colors
const COL_PRIMARY = '#2c3e50'; 
const COL_ACCENT = '#e74c3c';
const COL_BG = '#ecf0f1';

async function main() {
    const arabicBytes = new Uint8Array(readFileSync(arabicFontPath));
    const latinBytes = new Uint8Array(readFileSync(latinFontPath));
    const photoBytes = new Uint8Array(readFileSync(photoPath));
    const pngBytes = new Uint8Array(readFileSync(pngPath));
    const svgContent = readFileSync(svgPath, 'utf-8');

    const doc = new KurdPDF({
        fonts: {
            'AR': { fontBytes: arabicBytes, baseFontName: 'NotoSansArabic' },
            'EN': { fontBytes: latinBytes, baseFontName: 'NotoSans' }
        }
    });

    // A4 Size: 595 x 842
    await doc.init({ width: 595, height: 842 });
    
    // FEATURE: Background Watermark (Opacity + SVG)
    doc.setOpacity(0.1);
    doc.svg(svgContent, 100, 400, { scale: 5.0 }); // Moved UP to y=400
    doc.setOpacity(1.0);

    const layout = new LayoutEngine(doc);

    layout.render({
        type: 'vstack',
        options: { width: 595, height: 842, padding: 0, gap: 20 },
        children: [
            // 1. HEADER (Flex Space-Between)
            {
                type: 'box',
                // Added align: 'center' to center the hstack vertically in the 80px high box
                options: { width: 595, height: 80, backgroundColor: COL_PRIMARY, padding: [0, 40], align: 'center' },
                child: {
                    type: 'hstack',
                    options: { width: 515, align: 'space-between' },
                    children: [
                        // Vector SVG Logo (Original Colors)
                        { type: 'svg', content: svgContent, width: 50, height: 50, options: { scale: 0.7 } },
                        { type: 'text', content: 'Kurd-PDFLib Showcase', options: { font: 'EN', size: 24, color: '#ffffff' } },
                        { type: 'text', content: '2026-01-28', options: { font: 'EN', size: 12, color: '#bdc3c7' } }
                    ]
                }
            },

            // 2. TYPOGRAPHY (Columns + Justify)
            {
                type: 'vstack',
                options: { padding: [0, 40], gap: 10 },
                children: [
                    { type: 'text', content: 'Advanced Typography', options: { font: 'EN', size: 18, color: COL_PRIMARY } },
                    { type: 'rect', width: 515, height: 2, options: { style: 'F', color: COL_ACCENT } },
                    {
                        type: 'hstack',
                        options: { gap: 35, align: 'start' },
                        children: [
                            // English Column
                            {
                                type: 'text',
                                content: "This text block demonstrates the library's ability to handle justified English text. Notice how the words are spaced to create perfectly even left and right margins, giving the document a professional, newspaper-like appearance. The line height is also set to 1.5 for better readability.",
                                options: { font: 'EN', size: 10, width: 240, align: 'justify', lineHeight: 1.5 }
                            },
                            // Kurdish Column
                            {
                                type: 'text',
                                content: "ئەم بەشە توانای کتێبخانەکە نیشان دەدات بۆ مامەڵەکردن لەگەڵ دەقی کوردی. تێبینی بکە چۆن وشەکان دابەش کراون بۆ ئەوەی پەراوێزەکان ڕێک بوەستن. ئەمەش شێوازێکی پرۆفیشناڵ دەبەخشێت بە بەڵگەنامەکە.",
                                options: { font: 'AR', size: 11, width: 240, align: 'justify', rtl: true, lineHeight: 1.6 }
                            }
                        ]
                    }
                ]
            },

            // 3. GRAPHICS & LAYOUT (Z-Stack + Transparency)
            {
                type: 'vstack',
                options: { padding: [0, 40], gap: 10 },
                children: [
                    { type: 'text', content: 'Graphics & Layering', options: { font: 'EN', size: 18, color: COL_PRIMARY } },
                    { type: 'rect', width: 515, height: 2, options: { style: 'F', color: COL_ACCENT } },
                    {
                        type: 'hstack',
                        options: { gap: 20 },
                        children: [
                            // Z-Stack Example
                            {
                                type: 'zstack',
                                options: { width: 240, height: 150 },
                                children: [
                                    // Layer 1: Pattern
                                    { type: 'rect', width: 240, height: 150, options: { style: 'F', color: '#bdc3c7' } },
                                    { type: 'rect', width: 50, height: 150, options: { style: 'F', color: '#95a5a6' } }, // Stripe
                                    // Layer 2: Transparent PNG (Directly, no wrapping box)
                                    { 
                                        type: 'image', 
                                        data: pngBytes, 
                                        imgType: 'png', 
                                        width: 100, 
                                        height: 100,
                                        options: { align: 'center' } // Center in Z-Stack logic
                                    }
                                ]
                            },
                            // Rounded Image Example
                            {
                                type: 'box',
                                options: { 
                                    width: 240, 
                                    height: 150, 
                                    backgroundColor: 'white', 
                                    borderWidth: 4, 
                                    borderColor: COL_PRIMARY, 
                                    borderRadius: 15, // Round corners
                                    align: 'center'
                                },
                                child: { type: 'image', data: photoBytes, imgType: 'jpeg', width: 240, height: 150 }
                            }
                        ]
                    }
                ]
            },

            // 4. GRID SYSTEM (Using V/H Stacks)
            {
                type: 'vstack',
                options: { padding: [0, 40], gap: 10 },
                children: [
                    { type: 'text', content: 'Grid Layout', options: { font: 'EN', size: 18, color: COL_PRIMARY } },
                    { type: 'rect', width: 515, height: 2, options: { style: 'F', color: COL_ACCENT } },
                    {
                        type: 'hstack',
                        options: { gap: 10, align: 'space-between' },
                        children: [
                            { type: 'box', options: { width: 160, height: 60, backgroundColor: '#3498db', borderRadius: 5, align: 'center' }, child: { type: 'text', content: 'Box 1', options: { font: 'EN', size: 14, color: 'white' } } },
                            { type: 'box', options: { width: 160, height: 60, backgroundColor: '#e74c3c', borderRadius: 5, align: 'center' }, child: { type: 'text', content: 'Box 2', options: { font: 'EN', size: 14, color: 'white' } } },
                            { type: 'box', options: { width: 160, height: 60, backgroundColor: '#2ecc71', borderRadius: 5, align: 'center' }, child: { type: 'text', content: 'Box 3', options: { font: 'EN', size: 14, color: 'white' } } }
                        ]
                    }
                ]
            }
        ]
    }, 0, 842); // A4 Top-Left

    doc.save("out-showcase-a4-v2.pdf");
    console.log("Saved to out-showcase-a4-v2.pdf");
}

main().catch(console.error);
