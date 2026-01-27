import { PDFParse } from 'pdf-parse';
import fs from 'fs';

async function testExtraction() {
    const buffer = fs.readFileSync('out.pdf');
    try {
        const parser = new PDFParse({ data: buffer });
        const data = await parser.getText();
        console.log('--- Extracted Text ---');
        console.log(data.text);
        console.log('--- End ---');
    } catch (e) {
        console.error('Extraction failed:', e);
    }
}

testExtraction();
