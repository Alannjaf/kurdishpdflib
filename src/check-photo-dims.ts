import { readFileSync } from 'fs';
import { KurdPDF } from './kurd-pdf.js';

async function main() {
    const doc = new KurdPDF();
    const data = new Uint8Array(readFileSync('C:/Users/alan0/Desktop/Projects/kurd-pdflib/assets/photo.jpg'));
    console.log(doc.getImageDimensions(data, 'jpeg'));
}
main();
