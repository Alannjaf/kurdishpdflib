import { KurdPDF, LayoutEngine } from './index.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const arabicFontPath = join(__dirname, '..', 'assets', 'NotoSansArabic-Regular.ttf');
const latinFontPath = join(__dirname, '..', 'assets', 'NotoSans-Regular.ttf');
const photoPath = join(__dirname, '..', 'assets', 'photo.jpg');
const pngPath = join(__dirname, '..', 'assets', 'transparent-sample.png');
const svgPath = join(__dirname, '..', 'assets', 'Logo.svg');

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
        },
        fallbackOrder: ['AR', 'EN']
    });

    const W = 595, H = 842;
    await doc.init({ width: W, height: H });
    const layout = new LayoutEngine(doc);

    // 1. GLOBAL BACKGROUND & BORDER
    // ---------------------------------------------------------
    // Draw a subtle gradient background for the whole page
    doc.saveGraphicsState();
    doc.roundedRect(20, 20, W - 40, H - 40, 20, 'N');
    doc.clip();
    doc.gradient([
        { offset: 0, color: '#f0f4f8' },
        { offset: 1, color: '#ffffff' }
    ], 0, H, 0, 0);
    doc.restoreGraphicsState();

    // Draw the main frame border
    doc.roundedRect(20, 20, W - 40, H - 40, 20, 'S', '#1a237e', 3);

    // 2. GIANT WATERMARK
    // ---------------------------------------------------------
    doc.setOpacity(0.05);
    doc.svg(svgContent, W / 2 - 150, H / 2 + 150, { scale: 4.0 });
    doc.setOpacity(1.0);

    // 3. MAIN LAYOUT
    // ---------------------------------------------------------
    layout.render({
        type: 'vstack',
        options: { width: W, height: H, padding: 50, gap: 40 },
        children: [
            // HEADER
            {
                type: 'hstack',
                options: { align: 'space-between', height: 80 },
                children: [
                    { type: 'svg', content: svgContent, width: 80, height: 80, options: { scale: 1.0 } },
                    {
                        type: 'vstack',
                        options: { align: 'end', gap: 5 },
                        children: [
                            { type: 'text', content: 'OFFICIAL CERTIFICATE', options: { size: 18, color: '#1a237e' } },
                            { type: 'text', content: 'بڕوانامەی فەرمی لێهاتوویی', options: { size: 16, color: '#1a237e', rtl: true } }
                        ]
                    }
                ]
            },

            // DIVIDER
            { type: 'rect', width: 495, height: 1, options: { style: 'F', color: '#1a237e', opacity: 0.2 } },

            // BODY: Name and Title
            {
                type: 'vstack',
                options: { align: 'center', gap: 15 },
                children: [
                    { type: 'text', content: 'THIS IS TO CERTIFY THAT', options: { size: 10, color: '#666' } },
                    { 
                        type: 'box',
                        options: { padding: [10, 30], backgroundColor: '#1a237e', borderRadius: 40 },
                        child: { type: 'text', content: 'ALAN JAFF • ئالان جاف', options: { size: 28, color: '#ffffff', rtl: true } }
                    },
                    { type: 'text', content: 'has successfully demonstrated expert mastery of the Kurd-PDFLib engine', options: { size: 11, color: '#333' } }
                ]
            },

            // DESCRIPTION: Justified Multi-script text
            {
                type: 'box',
                options: { width: 495, padding: 20, backgroundColor: '#ffffff', borderRadius: 10, borderColor: '#e0e0e0', borderWidth: 1 },
                child: {
                    type: 'text',
                    content: "ئەم بەڵگەنامەیە وەک تێستێکی گشتگیر (Comprehensive Test) ئامادەکراوە بۆ نیشاندانی هەموو تایبەتمەندییەکانی کتێبخانەکە. This project seamlessly integrates Kurdish scripts with modern design principles like Flexbox layouts, SVG vectors, and alpha-channel PNGs. بەکارهێنانی ئەم سیستەمە ڕێگە خۆشکەرە بۆ دروستکردنی دیزاینی پێشکەوتوو بە زمانی کوردی بە شێوەیەکی پرۆفیشناڵ.",
                    options: { size: 11, width: 455, align: 'justify', lineHeight: 1.7, rtl: true }
                }
            },

            // GRAPHICS SHOWCASE: Photo + Transparent Seal
            {
                type: 'hstack',
                options: { gap: 30, align: 'center' },
                children: [
                    // Member Photo with circular clip and cover fit
                    {
                        type: 'box',
                        options: { width: 140, height: 140, borderRadius: 70, borderWidth: 4, borderColor: '#1a237e' },
                        child: {
                            type: 'zstack',
                            options: { align: 'center' },
                            children: [
                                { type: 'image', data: photoBytes, imgType: 'jpeg', width: 140, height: 140, options: { objectFit: 'cover' } },
                                // Overlaid Transparent PNG (Seal)
                                {
                                    type: 'box',
                                    options: { align: 'end', padding: [-10, -10, 0, 0] },
                                    child: { type: 'image', data: pngBytes, imgType: 'png', width: 60, height: 60, options: { objectFit: 'contain' } }
                                }
                            ]
                        }
                    },
                    // Technical Details Grid
                    {
                        type: 'vstack',
                        options: { gap: 10 },
                        children: [
                            { type: 'text', content: 'TECHNICAL CAPABILITIES:', options: { size: 10, color: '#1a237e' } },
                            { type: 'text', content: '• Automated Font Fallback (Zero Tofu)', options: { size: 9, color: '#444' } },
                            { type: 'text', content: '• True Alpha Transparency (ExtGState)', options: { size: 9, color: '#444' } },
                            { type: 'text', content: '• Native SVG Path Rendering', options: { size: 9, color: '#444' } },
                            { type: 'text', content: '• Flex-distribution (Space-Between/Evenly)', options: { size: 9, color: '#444' } }
                        ]
                    }
                ]
            },

            // FOOTER
            {
                type: 'hstack',
                options: { align: 'space-between', padding: [20, 0, 0, 0] },
                children: [
                    {
                        type: 'vstack',
                        options: { gap: 5, align: 'center' },
                        children: [
                            { type: 'rect', width: 150, height: 1, options: { style: 'F', color: '#333' } },
                            { type: 'text', content: 'Authorized Signature', options: { size: 9, color: '#666' } }
                        ]
                    },
                    {
                        type: 'vstack',
                        options: { gap: 5, align: 'center' },
                        children: [
                            { type: 'rect', width: 150, height: 1, options: { style: 'F', color: '#333' } },
                            { type: 'text', content: 'مۆری فەرمی سەندیکا', options: { size: 9, color: '#666', rtl: true } }
                        ]
                    }
                ]
            }
        ]
    }, 0, H);

    doc.save("premium-certificate.pdf");
    console.log("Saved to premium-certificate.pdf");
}

main().catch(console.error);
