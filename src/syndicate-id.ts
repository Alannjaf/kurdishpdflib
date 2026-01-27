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

    const getCircle = (cx: number, cy: number, r: number) => {
        const k = 0.5522;
        const kr = r * k;
        return [
            { x: cx + r, y: cy, type: 'M' },
            { x: cx, y: cy + r, type: 'C', cp1: { x: cx + r, y: cy + kr }, cp2: { x: cx + kr, y: cy + r } },
            { x: cx - r, y: cy, type: 'C', cp1: { x: cx - kr, y: cy + r }, cp2: { x: cx - r, y: cy + kr } },
            { x: cx, y: cy - r, type: 'C', cp1: { x: cx - r, y: cy - kr }, cp2: { x: cx - kr, y: cy - r } },
            { x: cx + r, y: cy, type: 'C', cp1: { x: cx + kr, y: cy - r }, cp2: { x: cx + r, y: cy - kr } },
        ] as any[];
    };

    const drawTrilingual = (y: number, krd: string, ar: string, en: string, right: number, fontSize: number, col: string) => {
        let x = right;
        const slash = " / ";
        const drawPart = (text: string, font: 'AR' | 'EN', rtl: boolean) => {
            const w = doc.measureText(text, fontSize, { font, rtl });
            doc.text(text, x - w, y, { font, size: fontSize, rtl, color: col });
            return w;
        };
        if (krd) x -= drawPart(krd, 'AR', true);
        if (ar) { x -= drawPart(slash, 'EN', false); x -= drawPart(ar, 'AR', true); }
        if (en) { x -= drawPart(slash, 'EN', false); x -= drawPart(en, 'EN', false); }
    };

    // PAGE 1: Front
    doc.rect(0, 0, W, H, 'F', COLOR_BLUE);

    const hH = 56, hT = H - 15, hB = hT - hH, hX = 70, hR = 28, hK = hR * 0.5522;
    doc.path([
        { x: hX + hR, y: hT, type: 'M' },
        { x: W, y: hT, type: 'L' },
        { x: W, y: hB, type: 'L' },
        { x: hX + hR, y: hB, type: 'L' },
        { x: hX, y: hB + hR, type: 'C', cp1: { x: hX + hR - hK, y: hB }, cp2: { x: hX, y: hB + hR - hK } },
        { x: hX + hR, y: hT, type: 'C', cp1: { x: hX, y: hB + hR + hK }, cp2: { x: hX + hR - hK, y: hT } }
    ], 'F', COLOR_WHITE);

    const lR = 21, lCX = 18 + lR, lCY = hB + hR; 
    doc.saveGraphicsState();
    doc.clip(getCircle(lCX, lCY, lR));
    doc.rect(lCX - lR, lCY - lR, lR * 2, lR * 2, 'F', COLOR_WHITE);
    doc.image(logoBytes, 'jpeg', lCX - lR, lCY - lR, lR * 2, lR * 2);
    doc.restoreGraphicsState();

    const tCY = hB + 25; // Adjusted for perfect vertical centering (considering ascent/descent)
    doc.text("سەندیکای پزیشکانی ڤێتێرنەری کوردستان", hX + 5, tCY + 13, { font: 'AR', size: 9, rtl: true, align: 'right', width: W - hX - 25, color: COLOR_TEXT_BLUE });
    doc.text("نقابة الأطباء البيطريين كوردستان", hX + 5, tCY, { font: 'AR', size: 9, rtl: true, align: 'right', width: W - hX - 25, color: COLOR_TEXT_BLUE });
    doc.text("Kurdistan Veterinary Syndicate", hX + 5, tCY - 13, { font: 'EN', size: 9, align: 'right', width: W - hX - 25, color: COLOR_TEXT_BLUE });

    doc.rect(22, 12, 56, 71, 'F', COLOR_WHITE);
    doc.image(photoBytes, 'jpeg', 25, 15, 50, 65);

    const dW = 160, dX = W - 15 - dW, rE = dX + dW;
    let cY = hB - 15;
    doc.text("دکتۆر ژیگر خورشید ابوزید", dX, cY, { font: 'AR', size: 10, rtl: true, align: 'right', width: dW, color: COLOR_WHITE });
    cY -= 14; doc.text("Dr. Zhigger Khorsheed Abozaid", dX, cY, { font: 'EN', size: 9, align: 'right', width: dW, color: COLOR_WHITE });
    cY -= 20; drawTrilingual(cY, "نازناوی پیشە", "العنوان الوظيفي", "Title", rE, 7, COLOR_LABEL);
    cY -= 13; drawTrilingual(cY, "پزیشکی ڤێتێرنەری پێشکەوتوو", "طبيب بيطري متقدم", "", rE, 8, COLOR_WHITE);
    cY -= 11; doc.text("Senior Veterinarian", dX, cY, { font: 'EN', size: 8, align: 'right', width: dW, color: COLOR_WHITE });
    cY -= 18; drawTrilingual(cY, "لەدایک بوون", "تاريخ الميلاد", "Date of Birth", rE, 7, COLOR_LABEL);
    cY -= 11; doc.text("24/04/1996", dX, cY, { font: 'EN', size: 10, align: 'right', width: dW, color: COLOR_WHITE }); 

    // PAGE 2: Back
    doc.addPage(W, H);
    doc.rect(0, 0, W, H, 'F', COLOR_WHITE);
    
    doc.image(logoBytes, 'jpeg', 10, H - 60, 50, 50);
    
    doc.text("سەندیکای پزیشکانی ڤێتێرنەری کوردستان", 10, H - 20, { font: 'AR', size: 10, rtl: true, align: 'right', width: W - 20, color: COLOR_TEXT_BLUE });
    doc.text("نقابة الأطباء البيطريين كوردستان", 10, H - 32, { font: 'AR', size: 10, rtl: true, align: 'right', width: W - 20, color: COLOR_TEXT_BLUE });
    doc.text("Kurdistan Veterinary Syndicate", 10, H - 44, { font: 'EN', size: 10, align: 'right', width: W - 20, color: COLOR_TEXT_BLUE });
    
    doc.rect(15, 15, 48, 48, 'F', COLOR_BLUE);

    const bkR = W - 15; let bkY = H - 65;
    const bRow = (k: string, a: string, e: string, v: string) => {
        drawTrilingual(bkY, k, a, e, bkR, 7, '#333333'); // Even darker grey (almost black) for labels
        bkY -= 12; doc.text(v, bkR - 150, bkY, { font: 'EN', size: 11, align: 'right', width: 150, color: COLOR_TEXT_BLUE });
        bkY -= 22;
    };
    bRow("ژمارەی ناسنامە", "رقم الهوية", "ID. No.", "1137");
    bRow("ڕێکەوتی دەرچوون", "تاريخ الاصدار", "Date of Issue", "07/01/2024");
    bRow("ڕێکەوتی بەسەرچوون", "تاريخ النفاذ", "Date of Expiry", "31/12/2024");

    doc.save("out-syndicate-final.pdf");
}

main();
