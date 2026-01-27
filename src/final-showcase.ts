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
        }
    });

    // A4 Size: 595 x 842
    await doc.init({ width: 595, height: 842 });
    const layout = new LayoutEngine(doc);

    layout.render({
        type: 'zstack',
        options: { width: 595, height: 842 },
        children: [
            // Layer 1: Global Watermark (Opacity + SVG)
            {
                type: 'box',
                options: { width: 595, height: 842, align: 'center', opacity: 0.1 },
                child: { type: 'svg', content: svgContent, width: 400, height: 400, options: { scale: 5.0 } }
            },

            // Layer 2: Document Content
            {
                type: 'vstack',
                options: { width: 595, height: 842, padding: 0, gap: 30 },
                children: [
                    // Header (HStack + Space-Between)
                    {
                        type: 'box',
                        options: { width: 595, height: 100, backgroundColor: '#1a237e', padding: [0, 40], align: 'center' },
                        child: {
                            type: 'hstack',
                            options: { width: 515, align: 'space-between' },
                            children: [
                                { type: 'svg', content: svgContent, width: 60, height: 60, options: { scale: 0.8 } },
                                {
                                    type: 'vstack',
                                    options: { align: 'center', gap: 5 },
                                    children: [
                                        { type: 'text', content: 'Kurd-PDFLib Final Showcase', options: { font: 'EN', size: 22, color: '#FFFFFF' } },
                                        { type: 'text', content: 'نیشاندانی تایبەتمەندییە نوێیەکانی کتێبخانەکە', options: { font: 'AR', size: 14, color: '#FFFFFF', rtl: true } }
                                    ]
                                },
                                { type: 'text', content: '2026-01-28', options: { font: 'EN', size: 10, color: '#bbdefb' } }
                            ]
                        }
                    },

                    // Main Columns (HStack + Justify)
                    {
                        type: 'box',
                        options: { padding: [0, 40] },
                        child: {
                            type: 'hstack',
                            options: { gap: 30, align: 'start' },
                            children: [
                                // English Justified
                                {
                                    type: 'vstack',
                                    options: { width: 240, gap: 10 },
                                    children: [
                                        { type: 'text', content: 'Professional Typography', options: { font: 'EN', size: 16, color: '#1a237e' } },
                                        { type: 'text', content: 'This paragraph demonstrates the power of the new layout engine. It supports automatic word wrapping and full justification. The margins are clean on both sides, and the line height is adjusted to 1.5 for a modern, readable look.', options: { font: 'EN', size: 10, width: 240, align: 'justify', lineHeight: 1.5 } }
                                    ]
                                },
                                // Kurdish Justified (RTL)
                                {
                                    type: 'vstack',
                                    options: { width: 240, gap: 10 },
                                    children: [
                                        { type: 'text', content: 'شێوازی تێکستی کوردی', options: { font: 'AR', size: 16, color: '#1a237e', rtl: true } },
                                        { type: 'text', content: 'لێرەدا دەبینیت کە کتێبخانەکەمان بە شێوەیەکی زۆر ورد مامەڵە لەگەڵ تێکستی کوردی و عەرەبی دەکات. تایبەتمەندی ڕێکخستنی وشەکان بۆ زمانی کوردی چالاک کراوە بۆ ئەوەی دەقەکان زۆر بە جوانی و ڕێکی لەناو پەڕەکەدا دەربکەون.', options: { font: 'AR', size: 11, width: 240, align: 'justify', rtl: true, lineHeight: 1.6 } }
                                    ]
                                }
                            ]
                        }
                    },

                    // Graphics Section (Z-Stack + Clipping + ObjectFit)
                    {
                        type: 'vstack',
                        options: { padding: [0, 40], gap: 15 },
                        children: [
                            { type: 'text', content: 'Advanced Graphics Support', options: { font: 'EN', size: 16, color: '#1a237e' } },
                            {
                                type: 'hstack',
                                options: { gap: 20 },
                                children: [
                                    // Z-Stack with Transparency
                                    {
                                        type: 'zstack',
                                        options: { width: 160, height: 160, backgroundColor: '#f5f5f5', borderRadius: 10, borderColor: '#ddd', borderWidth: 1 },
                                        children: [
                                            { type: 'rect', width: 40, height: 160, options: { style: 'F', color: '#1a237e', opacity: 0.2 } },
                                            { type: 'image', data: pngBytes, imgType: 'png', width: 120, height: 120, options: { align: 'center', objectFit: 'contain' } }
                                        ]
                                    },
                                    // Object Fit: Cover (Clipped)
                                    {
                                        type: 'box',
                                        options: { width: 160, height: 160, borderRadius: 80, borderColor: '#ff6f00', borderWidth: 4, align: 'center' },
                                        child: { type: 'image', data: photoBytes, imgType: 'jpeg', width: 160, height: 160, options: { objectFit: 'cover' } }
                                    },
                                    // Object Fit: Contain
                                    {
                                        type: 'box',
                                        options: { width: 160, height: 160, backgroundColor: '#eceff1', borderRadius: 10, align: 'center' },
                                        child: { type: 'image', data: photoBytes, imgType: 'jpeg', width: 160, height: 160, options: { objectFit: 'contain' } }
                                    }
                                ]
                            }
                        ]
                    },

                    // Footer
                    {
                        type: 'box',
                        options: { width: 595, height: 40, backgroundColor: '#1a237e', align: 'center' },
                        child: {
                            type: 'hstack',
                            options: { gap: 10, align: 'center' },
                            children: [
                                { type: 'text', content: 'BUILDING TOOLS FOR KURDISH DEVELOPERS', options: { font: 'EN', size: 9, color: '#FFFFFF' } },
                                { type: 'text', content: '•', options: { font: 'EN', size: 9, color: '#FFFFFF' } },
                                { type: 'text', content: 'کتێبخانەی تایبەت بە پەرەپێدەرانی کورد', options: { font: 'AR', size: 9, color: '#FFFFFF', rtl: true } }
                            ]
                        }
                    }
                ]
            }
        ]
    }, 0, 842);

    doc.save("final-showcase-a4.pdf");
    console.log("Saved to final-showcase-a4.pdf");
}

main().catch(console.error);
