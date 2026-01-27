import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const pdfPath = "C:/Users/alan0/Downloads/Syndicate Membership (1).pdf";
const outDir = "C:/Users/alan0/Desktop/Projects/kurd-pdflib/assets";

const data = readFileSync(pdfPath);

// Naive PDF image extractor
// Looks for "/Subtype /Image" and "stream...endstream"
// This is very hacky but might work for simple PDFs.

// Better approach: Use a regex to find image objects.
// << ... /Type /XObject /Subtype /Image ... >> stream ... endstream

// But binary data in stream makes regex hard.
// Let's just look for JPEG headers (FF D8 ... FF D9) or PNG headers (89 50 4E 47).

let count = 0;

// Find JPEGs
let pos = 0;
while (pos < data.length) {
    const start = data.indexOf(Buffer.from([0xFF, 0xD8, 0xFF]), pos);
    if (start === -1) break;
    
    // Find end (FF D9)
    // JPEG end is FF D9. But thumbnails might have it too.
    // We scan forward.
    let end = data.indexOf(Buffer.from([0xFF, 0xD9]), start);
    if (end === -1) break;
    
    // Check if it looks like a valid JPEG block size (e.g. > 1KB)
    if (end - start > 1000) {
        const imgData = data.subarray(start, end + 2);
        const filename = join(outDir, `extracted_${count}.jpg`);
        writeFileSync(filename, imgData);
        console.log(`Saved ${filename} (${imgData.length} bytes)`);
        count++;
    }
    pos = end + 2;
}

// Find PNGs
pos = 0;
const pngHeader = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
while (pos < data.length) {
    const start = data.indexOf(pngHeader, pos);
    if (start === -1) break;
    
    // PNG ends with IEND chunk: 00 00 00 00 49 45 4E 44 AE 42 60 82
    const iend = Buffer.from([0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82]);
    let end = data.indexOf(iend, start);
    if (end === -1) break;
    
    // IEND is inside the chunk data usually? No, it's the chunk type.
    // The sequence is Length(4) Type(4) Data(0) CRC(4).
    // IEND chunk: 00 00 00 00 (Len) 49 45 4E 44 (IEND) AE 42 60 82 (CRC)
    
    const imgData = data.subarray(start, end + 8); // +8 for IEND+CRC
    const filename = join(outDir, `extracted_${count}.png`);
    writeFileSync(filename, imgData);
    console.log(`Saved ${filename} (${imgData.length} bytes)`);
    count++;
    pos = end + 8;
}
