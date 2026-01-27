import { KurdPDF } from './index.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const arabicFontPath = join(__dirname, '..', 'assets', 'NotoSansArabic-Regular.ttf');
const latinFontPath = join(__dirname, '..', 'assets', 'NotoSans-Regular.ttf');
const logoPath = join(__dirname, '..', 'assets', 'logo.jpg');
const photoPath = join(__dirname, '..', 'assets', 'photo.jpg');

const W = 242, H = 153;
const THEME_DARK = '#121212', THEME_ACCENT = '#ffca28', THEME_WHITE = '#FFFFFF', THEME_LABEL = '#888888';

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

    // PAGE 1: Front
    doc.rect(0, 0, W, H, 'F', THEME_DARK);
    doc.rect(0, H - 4, W, 4, 'F', THEME_ACCENT);

    // Header Capsule
    doc.roundedRect(80, H - 45, W - 70, 35, 17.5, 'F', THEME_WHITE);

    // LOGO: Masked circle
    doc.circle(25, H - 30, 20, 'F', THEME_WHITE);
    doc.maskedCircleImage(logoBytes, 'jpeg', 25, H - 30, 15);

    doc.text("سەندیکای پزیشکانی ڤێتێرنەری", 90, H - 22, { font: 'AR', size: 8, rtl: true, align: 'right', width: W - 100, color: THEME_DARK });
    doc.text("Veterinary Syndicate", 90, H - 34, { font: 'EN', size: 8, align: 'right', width: W - 100, color: THEME_DARK });

    // Photo
    doc.roundedRect(13, 13, 59, 74, 8, 'F', THEME_ACCENT);
    doc.image(photoBytes, 'jpeg', 15, 15, 55, 70);

    const detX = 85, detW = 145, rightEdge = detX + detW;
    let curY = H - 65;
    doc.text("دکتۆر ژیگر خورشید ابوزید", detX, curY, { font: 'AR', size: 12, rtl: true, align: 'right', width: detW, color: THEME_WHITE });
    curY -= 15;
    doc.text("Dr. Zhigger Khorsheed Abozaid", detX, curY, { font: 'EN', size: 9, align: 'right', width: detW, color: THEME_ACCENT });
    
    // FIXED: Using the new trilingualLine helper to avoid boxes
    curY -= 20;
    doc.trilingualLine(curY, "نازناوی پیشە", "", "Title", rightEdge, 7, THEME_LABEL);
    doc.text("Senior Veterinarian", detX, curY - 10, { font: 'EN', size: 9, align: 'right', width: detW, color: THEME_WHITE });
    
    curY -= 22;
    doc.trilingualLine(curY, "لەدایک بوون", "", "Date of Birth", rightEdge, 7, THEME_LABEL);
    doc.text("24/04/1996", detX, curY - 10, { font: 'EN', size: 9, align: 'right', width: detW, color: THEME_WHITE });

    // PAGE 2: Back
    doc.addPage(W, H);
    doc.rect(0, 0, W, H, 'F', THEME_DARK);
    doc.roundedRect(10, 10, W - 20, H - 20, 10, 'S', THEME_LABEL);
    
    doc.circle(W / 2, H - 40, 25, 'F', THEME_WHITE);
    doc.maskedCircleImage(logoBytes, 'jpeg', W / 2, H - 40, 20);

    doc.text("ID Number", 20, 50, { font: 'EN', size: 7, color: THEME_LABEL, align: 'center', width: W - 40 });
    doc.text("VET-1137-2026", 20, 38, { font: 'EN', size: 12, color: THEME_ACCENT, align: 'center', width: W - 40 });

    doc.save("out-modern-design.pdf");
    console.log("Verified Modern ID Design (Fixed Labels) saved.");
}

main();
