import { KurdPDF } from './index.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const arabicFontPath = join(__dirname, '..', 'assets', 'NotoSansArabic-Regular.ttf');
const latinFontPath = join(__dirname, '..', 'assets', 'NotoSans-Regular.ttf');

async function main() {
    const arabicBytes = new Uint8Array(readFileSync(arabicFontPath));
    const latinBytes = new Uint8Array(readFileSync(latinFontPath));

    const doc = new KurdPDF({
        fonts: {
            'AR': { fontBytes: arabicBytes, baseFontName: 'NotoSansArabic' },
            'EN': { fontBytes: latinBytes, baseFontName: 'NotoSans' }
        }
    });

    await doc.init();

    // 1. English Paragraph (Left Aligned)
    const englishText = "This is a long paragraph of English text that should automatically wrap to the next line when it exceeds the specified width. It demonstrates the line wrapping capability of the library.";
    doc.text(englishText, 50, 750, { font: 'EN', size: 12, width: 300, align: 'left' });

    // 2. Kurdish Paragraph (Right Aligned - Standard for RTL)
    const kurdishText = "ئەمە دەقێکی درێژی کوردییە کە دەبێت بە شێوەیەکی ئۆتۆماتیکی بچێتە دێڕی داهاتوو کاتێک لە پانی دیاریکراو تێدەپەڕێت. ئەمە توانای پێچانی دێڕەکان نیشان دەدات.";
    doc.text(kurdishText, 50, 600, { font: 'AR', size: 14, width: 300, align: 'right', rtl: true });

    // 3. Center Aligned
    doc.text("Center Aligned Title", 50, 500, { font: 'EN', size: 16, width: 500, align: 'center' });
    doc.text("ناونیشانی ناوەڕاست", 50, 470, { font: 'AR', size: 16, width: 500, align: 'center', rtl: true });

    doc.save("out-wrap.pdf");
    console.log("Saved to out-wrap.pdf");
}

main();
