import { KurdPDF } from './index.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const logoPngPath = join(__dirname, '..', 'assets', 'logo.png');

async function main() {
    const logoPngBytes = new Uint8Array(readFileSync(logoPngPath));

    const doc = new KurdPDF();
    await doc.init();

    doc.text("PNG Test with Transparency", 50, 800, { size: 20 });
    
    // Draw a colored rectangle behind to see transparency
    doc.rect(40, 640, 120, 120, 'F', '#FF0000'); // Red box
    
    console.log("Adding PNG image...");
    doc.image(logoPngBytes, 'png', 50, 650, 100, 100);

    doc.save("out-png-test.pdf");
    console.log("Saved to out-png-test.pdf");
}

main().catch(console.error);
