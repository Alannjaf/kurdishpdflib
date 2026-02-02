/**
 * QR Code and Barcode Demo - demonstrates QR codes, barcodes, and text styling
 */

import { KurdPDF } from '../dist/index.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load fonts
const notoSans = fs.readFileSync(path.join(__dirname, '../assets/NotoSans-Regular.ttf'));

console.log('=== QR Code, Barcode & Text Styling Demo ===\n');

async function generatePDF() {
    const pdf = new KurdPDF({
        fonts: {
            EN: { fontBytes: notoSans, baseFontName: 'NotoSans' }
        },
        title: 'QR Code and Barcode Demo',
        author: 'Kurd-PDFLib'
    });
    await pdf.init();

    const page = pdf.activePage;
    const pageHeight = 842; // A4 height
    let y = pageHeight - 50;

    // Title
    pdf.text('QR Code, Barcode & Text Styling Demo', 50, y, { font: 'EN', size: 24, color: '#2c3e50' });
    y -= 40;

    // Section: Text Styling
    pdf.text('1. Text Styling Features', 50, y, { font: 'EN', size: 16, color: '#3498db', underline: true });
    y -= 30;

    pdf.text('Normal text for comparison', 50, y, { font: 'EN', size: 12, color: '#333333' });
    y -= 20;

    pdf.text('Underlined text example', 50, y, { font: 'EN', size: 12, color: '#333333', underline: true });
    y -= 20;

    pdf.text('Strikethrough text example', 50, y, { font: 'EN', size: 12, color: '#333333', strikethrough: true });
    y -= 20;

    pdf.text('Both underline AND strikethrough', 50, y, { font: 'EN', size: 12, color: '#e74c3c', underline: true, strikethrough: true });
    y -= 30;

    // Subscript/Superscript examples
    pdf.text('Chemical formula: H', 50, y, { font: 'EN', size: 14, color: '#333333' });
    pdf.text('2', 112, y, { font: 'EN', size: 14, color: '#333333', subscript: true });
    pdf.text('O', 120, y, { font: 'EN', size: 14, color: '#333333' });
    y -= 20;

    pdf.text('Math expression: x', 50, y, { font: 'EN', size: 14, color: '#333333' });
    pdf.text('2', 70, y, { font: 'EN', size: 14, color: '#333333', superscript: true });
    pdf.text(' + y', 78, y, { font: 'EN', size: 14, color: '#333333' });
    pdf.text('2', 100, y, { font: 'EN', size: 14, color: '#333333', superscript: true });
    pdf.text(' = z', 108, y, { font: 'EN', size: 14, color: '#333333' });
    pdf.text('2', 133, y, { font: 'EN', size: 14, color: '#333333', superscript: true });
    y -= 20;

    pdf.text('Footnote reference', 50, y, { font: 'EN', size: 12, color: '#333333' });
    pdf.text('[1]', 142, y, { font: 'EN', size: 12, color: '#e74c3c', superscript: true });
    y -= 40;

    // Section: QR Codes
    pdf.text('2. QR Codes', 50, y, { font: 'EN', size: 16, color: '#3498db', underline: true });
    y -= 20;

    // QR Code examples
    pdf.text('URL QR Code:', 50, y, { font: 'EN', size: 10, color: '#666666' });
    pdf.qrCode('https://github.com', 50, y - 110, 100);
    pdf.text('github.com', 50, y - 120, { font: 'EN', size: 8, color: '#666666' });

    pdf.text('Text QR Code:', 180, y, { font: 'EN', size: 10, color: '#666666' });
    pdf.qrCode('Hello, World!', 180, y - 110, 100, { errorCorrection: 'H' });
    pdf.text('Hello, World!', 180, y - 120, { font: 'EN', size: 8, color: '#666666' });

    pdf.text('Colored QR Code:', 310, y, { font: 'EN', size: 10, color: '#666666' });
    pdf.qrCode('Kurd-PDFLib', 310, y - 110, 100, {
        color: '#2980b9',
        backgroundColor: '#ecf0f1'
    });
    pdf.text('Custom colors', 310, y - 120, { font: 'EN', size: 8, color: '#666666' });

    pdf.text('Transparent BG:', 440, y, { font: 'EN', size: 10, color: '#666666' });
    pdf.rect(440, y - 110, 100, 100, 'F', '#f1c40f'); // Yellow background
    pdf.qrCode('Transparent', 440, y - 110, 100, {
        color: '#2c3e50',
        backgroundColor: 'transparent'
    });
    pdf.text('No background', 440, y - 120, { font: 'EN', size: 8, color: '#666666' });

    y -= 170;

    // Section: Barcodes
    pdf.text('3. Barcodes', 50, y, { font: 'EN', size: 16, color: '#3498db', underline: true });
    y -= 20;

    // Code128 Barcodes
    pdf.text('Code128 Barcodes:', 50, y, { font: 'EN', size: 11, color: '#666666' });
    y -= 15;

    pdf.barcode('ABC-12345', 50, y - 70, { font: 'EN', height: 50 });
    pdf.barcode('PROD-001', 220, y - 70, { font: 'EN', height: 50, width: 150 });
    pdf.barcode('KURD-PDF', 400, y - 70, { font: 'EN', height: 50, color: '#2980b9' });

    y -= 100;

    // EAN-13 Barcodes
    pdf.text('EAN-13 Barcodes:', 50, y, { font: 'EN', size: 11, color: '#666666' });
    y -= 15;

    pdf.ean13('590123412345', 50, y - 90, { font: 'EN' });
    pdf.ean13('978020137962', 220, y - 90, { font: 'EN', width: 150, height: 60 });
    pdf.ean13('401234567890', 400, y - 90, { font: 'EN', color: '#27ae60' });

    y -= 130;

    // Section: Mixed styling
    pdf.text('4. Styled Text with Underlines', 50, y, { font: 'EN', size: 16, color: '#3498db', underline: true });
    y -= 25;

    pdf.text('Important:', 50, y, { font: 'EN', size: 12, color: '#e74c3c', underline: true });
    pdf.text(' This text has colored underlines', 108, y, { font: 'EN', size: 12, color: '#333333' });
    y -= 20;

    pdf.text('Deprecated:', 50, y, { font: 'EN', size: 12, color: '#95a5a6', strikethrough: true });
    pdf.text(' Use newMethod() instead', 118, y, { font: 'EN', size: 12, color: '#333333' });
    y -= 20;

    // Custom line color
    pdf.text('Custom line color', 50, y, { font: 'EN', size: 12, color: '#333333', underline: true, lineColor: '#e74c3c' });
    y -= 30;

    // Footer
    pdf.text('Generated with Kurd-PDFLib', 50, 30, { font: 'EN', size: 9, color: '#999999' });

    // Save PDF
    const pdfBytes = await pdf.save();
    const outputPath = path.join(__dirname, 'qrcode-barcode-demo.pdf');
    fs.writeFileSync(outputPath, Buffer.from(pdfBytes));

    console.log(`PDF created: ${outputPath}`);
    console.log(`File size: ${(pdfBytes.length / 1024).toFixed(1)} KB`);
    console.log('\nFeatures demonstrated:');
    console.log('  - Text underline');
    console.log('  - Text strikethrough');
    console.log('  - Subscript/superscript text');
    console.log('  - Custom underline/strikethrough colors');
    console.log('  - QR codes with custom colors');
    console.log('  - QR codes with transparent backgrounds');
    console.log('  - Code128 barcodes');
    console.log('  - EAN-13 barcodes');
}

generatePDF().catch(console.error);
