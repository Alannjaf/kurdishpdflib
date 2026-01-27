import { KurdPDF, LayoutEngine } from './index.js';
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
    const layout = new LayoutEngine(doc);

    const longText = "This is a demonstration of the new justified text alignment feature. Justification creates clean edges on both the left and right sides of the paragraph, similar to newspapers and books. It achieves this by dynamically adjusting the space between words.";
    
    // Note: Kurdish justification needs careful testing with connected scripts, so we'll test English justification first to confirm the engine works.
    const kurdishText = "ئەمە تاقیکردنەوەیەکە بۆ دەرخستنی تایبەتمەندی نوێی ڕێکخستنی تێکست. ئەم تایبەتمەندییە یارمەتیدەرە بۆ ئەوەی دەقەکان بە شێوەیەکی جوانتر و ڕێکتر دەربکەون لەناو پەڕەکاندا.";

    layout.render({
        type: 'vstack',
        options: { gap: 30, padding: 40, align: 'center' },
        children: [
            { type: 'text', content: 'TYPOGRAPHY POLISH', options: { font: 'EN', size: 24, align: 'center' } },
            
            // Standard Left Align (Control)
            { 
                type: 'box',
                options: { width: 300, backgroundColor: '#f0f0f0', padding: 10, borderRadius: 5 },
                child: { 
                    type: 'text', 
                    content: "Left Aligned (Default):\n" + longText, 
                    options: { font: 'EN', size: 11, width: 280, align: 'left' } 
                }
            },

            // Justified Alignment
            { 
                type: 'box',
                options: { width: 300, backgroundColor: '#e8f4fd', padding: 10, borderRadius: 5, borderColor: '#2196F3', borderWidth: 1 },
                child: { 
                    type: 'text', 
                    content: "Justified Alignment:\n" + longText, 
                    options: { font: 'EN', size: 11, width: 280, align: 'justify' } // Using new 'justify' option
                }
            },

            // Line Height Control
            {
                type: 'hstack',
                options: { gap: 20, align: 'start' },
                children: [
                    {
                        type: 'box',
                        options: { width: 140, backgroundColor: '#fff0f0', padding: 5 },
                        child: { 
                            type: 'text', 
                            content: "Tight Line Height (1.0):\n" + longText.substring(0, 100) + "...", 
                            options: { font: 'EN', size: 9, width: 130, lineHeight: 1.0 } 
                        }
                    },
                    {
                        type: 'box',
                        options: { width: 140, backgroundColor: '#f0fff0', padding: 5 },
                        child: { 
                            type: 'text', 
                            content: "Loose Line Height (2.0):\n" + longText.substring(0, 100) + "...", 
                            options: { font: 'EN', size: 9, width: 130, lineHeight: 2.0 } 
                        }
                    }
                ]
            }
        ]
    }, 50, 800);

    doc.save("out-text-polish.pdf");
    console.log("Saved to out-text-polish.pdf");
}

main().catch(console.error);
