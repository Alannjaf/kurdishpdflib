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

// Modern Color Palette
// Deep Premium Palette
const COLORS = {
    OBSIDIAN: '#020617',
    MIDNIGHT: '#0f172a',
    ELECTRIC: '#3b82f6',
    CYAN: '#06b6d4',
    GOLD: '#fbbf24',
    WHITE: '#f8fafc',
    SLATE: '#94a3b8',
    RED: '#ef4444'
};

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

    const W = 243, H = 153; // CR80 standard size
    await doc.init({ width: W, height: H });
    const layout = new LayoutEngine(doc);

    // ==========================================
    // FRONT SIDE (Page 1)
    // ==========================================
    
    // 1. Draw Background Gradient FIRST
    doc.saveGraphicsState();
    doc.rect(0, 0, W, H, 'N');
    doc.clip();
    // Vibrant Diagonal Gradient: Top-Right to Bottom-Left
    doc.gradient([{ offset: 0, color: COLORS.MIDNIGHT }, { offset: 1, color: COLORS.OBSIDIAN }], W, H, 0, 0);
    doc.restoreGraphicsState();

    // 2. Render Layout Content
    layout.render({
        type: 'zstack',
        options: { width: W, height: H },
        children: [
            // Layer 1: Watermark
            {
                type: 'box',
                options: { width: W, height: H, align: 'center', opacity: 0.05 },
                child: { type: 'svg', content: svgContent, width: 120, height: 120, options: { scale: 1.5 } }
            },
            // Layer 2: Content
            {
                type: 'vstack',
                options: { width: W, height: H, padding: 10, gap: 8 },
                children: [
                    {
                        type: 'hstack',
                        options: { align: 'space-between', height: 25 },
                        children: [
                            { type: 'svg', content: svgContent, width: 25, height: 25, options: { scale: 0.35, color: COLORS.ELECTRIC } },
                            {
                                type: 'vstack',
                                options: { align: 'end' },
                                children: [
                                    { type: 'text', content: 'GLOBAL MEMBER', options: { size: 8, color: COLORS.CYAN } },
                                    { type: 'text', content: 'ئەندامی جیهانی', options: { size: 7, color: COLORS.WHITE, rtl: true } }
                                ]
                            }
                        ]
                    },
                    { type: 'rect', width: 223, height: 1, options: { style: 'F', color: COLORS.ELECTRIC, opacity: 0.2 } },
                    {
                        type: 'hstack',
                        options: { gap: 10, align: 'start' },
                        children: [
                            {
                                type: 'box',
                                options: { width: 60, height: 75, borderRadius: 8, borderWidth: 1.2, borderColor: COLORS.GOLD, backgroundColor: COLORS.OBSIDIAN },
                                child: { type: 'image', data: photoBytes, imgType: 'jpeg', width: 60, height: 75, options: { objectFit: 'cover' } }
                            },
                            {
                                type: 'vstack',
                                options: { width: 140, gap: 4 },
                                children: [
                                    { type: 'text', content: 'ALAN JAFF', options: { size: 14, color: COLORS.WHITE } },
                                    { type: 'text', content: 'ئالان جاف', options: { size: 12, color: COLORS.SLATE, rtl: true } },
                                    { type: 'spacer', size: 2 },
                                    {
                                        type: 'box',
                                        options: { backgroundColor: COLORS.ELECTRIC, padding: [2, 8], borderRadius: 4 },
                                        child: { type: 'text', content: 'SENIOR DEVELOPER', options: { size: 7, color: COLORS.WHITE } }
                                    },
                                    { type: 'text', content: 'ID: 2396-59674', options: { size: 8, color: COLORS.SLATE } }
                                ]
                            }
                        ]
                    },
                    {
                        type: 'box',
                        options: { width: 223, height: 15, align: 'center', backgroundColor: COLORS.MIDNIGHT, borderRadius: 4 },
                        child: { type: 'text', content: 'Kurd-PDFLib Verified • ٢٠٢٦', options: { size: 7, color: COLORS.SLATE, rtl: true } }
                    }
                ]
            }
        ]
    }, 0, H);

    // ==========================================
    // BACK SIDE (Page 2)
    // ==========================================
    doc.addPage(W, H);
    doc.rect(0, 0, W, H, 'F', COLORS.OBSIDIAN);

    const termsText = `ئەم ناسنامەیە تەنها بۆ بەکارهێنانی فەرمییە. بەکارهێنانی ئەم سیستەمە نیشانەی لێهاتوویی پەرەپێدەرە. پەرەپێدانی ئەم کتێبخانەیە هەنگاوێکە بەرەو دیجیتاڵکردنی زمانی کوردی. ٢٠٢٦`;

    layout.render({
        type: 'vstack',
        options: { width: W, height: H, padding: 15, gap: 10 },
        children: [
            { type: 'text', content: 'TERMS AND CONDITIONS', options: { size: 8, color: COLORS.GOLD } },
            {
                type: 'box',
                options: { width: 213, padding: 8, backgroundColor: COLORS.MIDNIGHT, borderRadius: 6, align: 'center' },
                child: {
                    type: 'text',
                    content: termsText,
                    options: { size: 7, width: 197, align: 'justify', color: COLORS.SLATE, lineHeight: 1.5, rtl: true }
                }
            },
            {
                type: 'hstack',
                options: { align: 'space-between', padding: [10, 0, 0, 0] },
                children: [
                    {
                        type: 'box',
                        options: { width: 40, height: 40, backgroundColor: COLORS.WHITE, padding: 4, borderRadius: 4 },
                        child: { type: 'image', data: pngBytes, imgType: 'png', width: 32, height: 32, options: { objectFit: 'contain' } }
                    },
                    {
                        type: 'vstack',
                        options: { align: 'end', gap: 2 },
                        children: [
                            { type: 'text', content: 'AUTHORIZED SIGNATURE', options: { size: 6, color: COLORS.SLATE } },
                            { type: 'rect', width: 100, height: 0.5, options: { style: 'F', color: COLORS.GOLD } },
                            { type: 'text', content: 'واژۆی فەرمی', options: { size: 6, color: COLORS.SLATE, rtl: true } }
                        ]
                    }
                ]
            }
        ]
    }, 0, H);

    doc.save("ultimate-id-v2.pdf");
    console.log("Saved to ultimate-id-v2.pdf");
}

main().catch(console.error);
