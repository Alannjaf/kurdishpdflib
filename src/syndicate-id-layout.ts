import { KurdPDF, LayoutEngine } from './index.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const arabicFontPath = join(__dirname, '..', 'assets', 'NotoSansArabic-Regular.ttf');
const latinFontPath = join(__dirname, '..', 'assets', 'NotoSans-Regular.ttf');
const logoPath = join(__dirname, '..', 'assets', 'logo.jpg');
const photoPath = join(__dirname, '..', 'assets', 'photo.jpg');

const W = 243, H = 153;
const COLOR_BLUE = '#0d1b3e', COLOR_WHITE = '#FFFFFF', COLOR_LABEL = '#999999', COLOR_TEXT_BLUE = '#0d1b3e';

async function main() {
    const arabicBytes = new Uint8Array(readFileSync(arabicFontPath));
    const latinBytes = new Uint8Array(readFileSync(latinFontPath));
    const logoBytes = new Uint8Array(readFileSync(logoPath));
    const photoBytes = new Uint8Array(readFileSync(photoPath));

    const doc = new KurdPDF({
        fonts: {
            'AR': { fontBytes: arabicBytes, baseFontName: 'NotoSansArabic' },
            'EN': { fontBytes: latinBytes, baseFontName: 'NotoSans' }
        }
    });

    await doc.init({ width: W, height: H });
    const layout = new LayoutEngine(doc);

    // Helper for Trilingual Rows (common in this ID)
    const trilingualRow = (krd: string, ar: string, en: string, fontSize: number, col: string): any => ({
        type: 'hstack',
        options: { gap: 2, align: 'center' },
        children: [
            { type: 'text', content: en, options: { font: 'EN', size: fontSize, color: col } },
            { type: 'text', content: ' / ', options: { font: 'EN', size: fontSize, color: col } },
            { type: 'text', content: ar, options: { font: 'AR', size: fontSize, rtl: true, color: col } },
            { type: 'text', content: ' / ', options: { font: 'EN', size: fontSize, color: col } },
            { type: 'text', content: krd, options: { font: 'AR', size: fontSize, rtl: true, color: col } },
        ]
    });

    // PAGE 1: Front
    doc.rect(0, 0, W, H, 'F', COLOR_BLUE);

    // Background Header Shape
    doc.path([
        { x: 98, y: H - 15, type: 'M' },
        { x: W, y: H - 15, type: 'L' },
        { x: W, y: H - 71, type: 'L' },
        { x: 98, y: H - 71, type: 'L' },
        { x: 70, y: H - 43, type: 'C', cp1: { x: 98 - 15.46, y: H - 71 }, cp2: { x: 70, y: H - 71 + 15.46 } },
        { x: 98, y: H - 15, type: 'C', cp1: { x: 70, y: H - 43 + 15.46 }, cp2: { x: 98 - 15.46, y: H - 15 } }
    ], 'F', COLOR_WHITE);

    // Logo (Top Left)
    doc.image(logoBytes, 'jpeg', 18, H - 70, 42, 42);

    // Header Text
    layout.render({
        type: 'vstack',
        options: { width: W - 95, gap: 1, align: 'end' },
        children: [
            { type: 'text', content: 'سەندیکای پزیشکانی ڤێتێرنەری کوردستان', options: { font: 'AR', size: 9, rtl: true, color: COLOR_TEXT_BLUE } },
            { type: 'text', content: 'نقابة الأطباء البيطريين كوردستان', options: { font: 'AR', size: 9, rtl: true, color: COLOR_TEXT_BLUE } },
            { type: 'text', content: 'Kurdistan Veterinary Syndicate', options: { font: 'EN', size: 9, color: COLOR_TEXT_BLUE } },
        ]
    }, 80, H - 25);

    // Photo
    doc.rect(22, 12, 56, 71, 'F', COLOR_WHITE);
    doc.image(photoBytes, 'jpeg', 25, 15, 50, 65);

    // Main Content
    layout.render({
        type: 'vstack',
        options: { width: 150, gap: 2, align: 'end' },
        children: [
            { type: 'text', content: 'دکتۆر ژیگر خورشید ابوزید', options: { font: 'AR', size: 10, rtl: true, color: COLOR_WHITE } },
            { type: 'text', content: 'Dr. Zhigger Khorsheed Abozaid', options: { font: 'EN', size: 9, color: COLOR_WHITE } },
            { type: 'spacer', size: 8 },
            trilingualRow("نازناوی پیشە", "العنوان الوظيفي", "Title", 7, COLOR_LABEL),
            { type: 'text', content: 'Senior Veterinarian', options: { font: 'EN', size: 8, color: COLOR_WHITE } },
            { type: 'spacer', size: 8 },
            trilingualRow("لەدایک بوون", "تاريخ الميلاد", "Date of Birth", 7, COLOR_LABEL),
            { type: 'text', content: '24/04/1996', options: { font: 'EN', size: 10, color: COLOR_WHITE } },
        ]
    }, W - 165, H - 85);

    // PAGE 2: Back
    doc.addPage(W, H);
    doc.rect(0, 0, W, H, 'F', COLOR_WHITE);
    
    // Header
    layout.render({
        type: 'vstack',
        options: { width: W - 20, gap: 2, align: 'end' },
        children: [
            { type: 'text', content: 'سەندیکای پزیشکانی ڤێتێرنەری کوردستان', options: { font: 'AR', size: 10, rtl: true, color: COLOR_TEXT_BLUE } },
            { type: 'text', content: 'نقابة الأطباء البيطريين كوردستان', options: { font: 'AR', size: 10, rtl: true, color: COLOR_TEXT_BLUE } },
            { type: 'text', content: 'Kurdistan Veterinary Syndicate', options: { font: 'EN', size: 10, color: COLOR_TEXT_BLUE } },
        ]
    }, 10, H - 20);

    doc.image(logoBytes, 'jpeg', 10, H - 60, 50, 50);
    doc.rect(15, 15, 48, 48, 'F', COLOR_BLUE);

    // ID Details
    const detailRow = (k: string, a: string, e: string, v: string): any => ({
        type: 'vstack',
        options: { align: 'end', gap: 2 },
        children: [
            trilingualRow(k, a, e, 7, '#333333'),
            { type: 'text', content: v, options: { font: 'EN', size: 11, color: COLOR_TEXT_BLUE } },
            { type: 'spacer', size: 5 }
        ]
    });

    layout.render({
        type: 'vstack',
        options: { width: 150, gap: 5, align: 'end' },
        children: [
            detailRow("ژمارەی ناسنامە", "رقم الهوية", "ID. No.", "1137"),
            detailRow("ڕێکەوتی دەرچوون", "تاريخ الاصدار", "Date of Issue", "07/01/2024"),
            detailRow("ڕێکەوتی بەسەرچوون", "تاريخ النفاذ", "Date of Expiry", "31/12/2024"),
        ]
    }, W - 165, H - 65);

    doc.save("out-syndicate-layout.pdf");
    console.log("Saved to out-syndicate-layout.pdf");
}

main();
