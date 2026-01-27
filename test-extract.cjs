
const fs = require('fs');
const pdf = require('pdf-parse');

async function testExtraction() {
    const dataBuffer = fs.readFileSync('out.pdf');
    const data = await pdf(dataBuffer);
    console.log('--- Extracted Text ---');
    console.log(data.text);
    console.log('--- End ---');
}

testExtraction();
