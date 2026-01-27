import { PDFParse } from 'pdf-parse';
import fs from 'fs';

async function testWrapping() {
    console.log('Testing out-wrap.pdf...');
    const buffer = fs.readFileSync('out-wrap.pdf');
    try {
        const parser = new PDFParse({ data: buffer });
        const data = await parser.getText();
        console.log('--- Extracted Text ---');
        console.log(data.text);
        
        const hasEnglish = data.text.includes("This is a long paragraph");
        // Check for a known snippet of the Kurdish text
        // "دەبێت" might be split as "د ە ب ێ ت"
        const hasKurdish = data.text.length > 100; // Crude check for content

        console.log('English found:', hasEnglish);
        console.log('Content length good:', hasKurdish);

    } catch (e) {
        console.error('Extraction failed:', e);
    }
}

testWrapping();
