import { KurdPDF } from './index.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const arabicFontPath = join(__dirname, '..', 'assets', 'NotoSansArabic-Regular.ttf');
const latinFontPath = join(__dirname, '..', 'assets', 'NotoSans-Regular.ttf');
const logoPath = join(__dirname, '..', 'assets', 'logo.jpg');
const photoPath = join(__dirname, '..', 'assets', 'photo.jpg');

const W = 243, H = 153;
const COLOR_BLUE = '#0d1b3e', COLOR_WHITE = '#FFFFFF', COLOR_LABEL = '#bbbbbb', COLOR_TEXT_BLUE = '#0d1b3e';

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

    const getCirclePoints = (cx: number, cy: number, r: number) => {
        const k = 0.552284749831;
        const kr = r * k;
        return [
            { x: cx + r, y: cy, type: 'M' },
            { x: cx, y: cy + r, type: 'C', cp1: {x: cx + r, y: cy + kr}, cp2: {x: cx + kr, y: cy + r} },
            { x: cx - r, y: cy, type: 'C', cp1: {x: cx - kr, y: cy + r}, cp2: {x: cx - r, y: cy + kr} },
            { x: cx, y: cy - r, type: 'C', cp1: {x: cx - r, y: cy - kr}, cp2: {x: cx - kr, y: cy - r} },
            { x: cx + r, y: cy, type: 'C', cp1: {x: cx + kr, y: cy - r}, cp2: {x: cx + r, y: cy - kr} }
        ] as any[];
    };

    const drawTrilingualLine = (y: number, krd: string, ar: string, en: string, rightEdge: number, fontSize: number, color: string) => {
        let x = rightEdge;
        const slash = " / ";
        const dp = (t: string, f: 'AR' | 'EN', rtl: boolean) => {
            const w = doc.measureText(t, fontSize, { font: f, rtl });
            doc.text(t, x - w, y, { font: f, size: fontSize, rtl, color });
            return w;
        };
        if (krd) x -= dp(krd, 'AR', true);
        if (ar) { x -= dp(slash, 'EN', false); x -= dp(ar, 'AR', true); }
        if (en) { x -= dp(slash, 'EN', false); x -= dp(en, 'EN', false); }
    };

    // BG
    doc.rect(0, 0, W, H, 'F', COLOR_BLUE);

    // 1. HEADER AREA: MATHEMATICALLY PERFECT SEMI-CIRCLE
    const hHeight = 56;
    const hY = H - hHeight;
    const hX = 70; // Leftmost point of the curve
    const hR = hHeight / 2; // Radius = 28
    const hK = hR * 0.552284749831;

    doc.path([
        { x: hX + hR, y: H, type: 'M' },         // Start at top edge
        { x: W, y: H, type: 'L' },              // To Top-Right corner
        { x: W, y: hY, type: 'L' },             // To Bottom-Right corner
        { x: hX + hR, y: hY, type: 'L' },       // To start of bottom curve
        // Bottom-Left Quadrant
        { x: hX, y: hY + hR, type: 'C', 
            cp1: { x: hX + hR - hK, y: hY }, 
            cp2: { x: hX, y: hY + hR - hK } 
        },
        // Top-Left Quadrant
        { x: hX + hR, y: H, type: 'C', 
            cp1: { x: hX, y: hY + hR + hK }, 
            cp2: { x: hX + hR - hK, y: H } 
        }
    ], 'F', COLOR_WHITE);

    // 2. LOGO: Perfect masked circle
    const lR = 34, lCX = 15 + lR, lCY = H - 10 - lR;
    doc.saveGraphicsState();
    doc.clip(getCirclePoints(lCX, lCY, lR));
    doc.rect(lCX - lR, lCY - lR, lR * 2, lR * 2, 'F', COLOR_WHITE);
    doc.image(logoBytes, 'jpeg', lCX - lR, lCY - lR, lR * 2, lR * 2);
    doc.restoreGraphicsState();

    const hW = W - hX - 10;
    const headerTextX = hX + 10;
    doc.text("سەندیکای پزیشکانی ڤێتێرنەری کوردستان", headerTextX, H - 20, { font: 'AR', size: 9, rtl: true, align: 'right', width: hW, color: COLOR_TEXT_BLUE });
    doc.text("نقابة الأطباء البيطريين كوردستان", headerTextX, H - 32, { font: 'AR', size: 9, rtl: true, align: 'right', width: hW, color: COLOR_TEXT_BLUE });
    doc.text("Kurdistan Veterinary Syndicate", headerTextX, H - 44, { font: 'EN', size: 9, align: 'right', width: hW, color: COLOR_TEXT_BLUE });

    // 3. PHOTO
    const pX = 25, pY = 15, pW = 50, pH = 65;
    doc.rect(pX - 3, pY - 3, pW + 6, pH + 6, 'F', COLOR_WHITE);
    doc.image(photoBytes, 'jpeg', pX, pY, pW, pH);

    // 4. DETAILS
    const detW = 160, detX = W - 15 - detW, rEdge = detX + detW;
    let curY = H - 80;
    
    doc.text("دکتۆر ژیگر خورشید ابوزید", detX, curY, { font: 'AR', size: 10, rtl: true, align: 'right', width: detW, color: COLOR_WHITE });
    curY -= 14;
    doc.text("Dr. Zhigger Khorsheed Abozaid", detX, curY, { font: 'EN', size: 9, align: 'right', width: detW, color: COLOR_WHITE });
    curY -= 22;
    drawTrilingualLine(curY, "نازناوی پیشە", "العنوان الوظيفي", "Title", rEdge, 6, COLOR_LABEL);
    curY -= 13; 
    drawTrilingualLine(curY, "پزیشکی ڤێتێرنەری پێشکەوتوو", "طبيب بيطري متقدم", "", rEdge, 8, COLOR_WHITE);
    curY -= 11;
    doc.text("Senior Veterinarian", detX, curY, { font: 'EN', size: 8, align: 'right', width: detW, color: COLOR_WHITE });
    curY -= 18;
    drawTrilingualLine(curY, "لەدایک بوون", "تاريخ الميلاد", "Date of Birth", rEdge, 6, COLOR_LABEL);
    curY -= 11;
    doc.text("24/04/1996", detX, curY, { font: 'EN', size: 10, align: 'right', width: detW, color: COLOR_WHITE }); 

    doc.addPage(W, H);
    doc.rect(0, 0, W, H, 'F', COLOR_WHITE);
    doc.text("سەندیکای پزیشکانی ڤێتێرنەری کوردستان", 10, H - 20, { font: 'AR', size: 10, rtl: true, align: 'right', width: W - 20, color: COLOR_TEXT_BLUE });
    doc.text("نقابة الأطباء البيطريين كوردستان", 10, H - 32, { font: 'AR', size: 10, rtl: true, align: 'right', width: W - 20, color: COLOR_TEXT_BLUE });
    doc.text("Kurdistan Veterinary Syndicate", 10, H - 44, { font: 'EN', size: 10, align: 'right', width: W - 20, color: COLOR_TEXT_BLUE });
    doc.image(logoBytes, 'jpeg', 10, H - 60, 50, 50);
    doc.rect(15, 15, 48, 48, 'F', COLOR_BLUE);
    const bkR = W - 15; let bkY = H - 65;
    const row = (k: string, a: string, e: string, v: string) => {
        drawTrilingualLine(bkY, k, a, e, bkR, 6, COLOR_LABEL);
        bkY -= 12; doc.text(v, bkR - 150, bkY, { font: 'EN', size: 11, align: 'right', width: 150, color: COLOR_TEXT_BLUE });
        bkY -= 22;
    };
    row("ژمارەی ناسنامە", "رقم الهوية", "ID. No.", "1137");
    row("ڕێکەوتی دەرچوون", "تاريخ الاصدار", "Date of Issue", "07/01/2024");
    row("ڕێکەوتی بەسەرچوون", "تاريخ النفاذ", "Date of Expiry", "31/12/2024");

    doc.save("out-syndicate-final.pdf");
    console.log("Saved to out-syndicate-final.pdf");
}

main();
