import { PDFParse } from 'pdf-parse';
import fs from 'fs';

async function testExtraction() {
    console.log('Testing out-simple.pdf...');
    const buffer = fs.readFileSync('out-simple.pdf');
    try {
        const parser = new PDFParse({ data: buffer });
        const data = await parser.getText();
        console.log('--- Extracted Text ---');
        console.log(data.text);
        console.log('--- End ---');
        
        // Simple assertions
        if (data.text.includes('س\tڵ\tا\tو\t \tل\tە\t \tه\tە\tم\tو\tو\tا\tن')) console.log('✅ Kurdish text found');
        else console.log('❌ Kurdish text missing');

    } catch (e) {
        console.error('Extraction failed:', e);
    }
}

testExtraction();
