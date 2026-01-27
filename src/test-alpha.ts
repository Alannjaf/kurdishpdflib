import { KurdPDF } from './index.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pngPath = join(__dirname, '..', 'assets', 'transparent-sample.png');

async function main() {
    const pngBytes = new Uint8Array(readFileSync(pngPath));

    const doc = new KurdPDF();
    await doc.init();

    doc.text("PNG Alpha Transparency Test", 50, 800, { size: 20 });
    
    // Draw a black background rectangle
    doc.rect(40, 590, 320, 150, 'F', '#000000'); 
    
    doc.text("Behind the image is a solid black box.", 50, 570, { size: 12 });
    
    console.log("Adding transparent PNG image...");
    // Render the image over the black box
    doc.image(pngBytes, 'png', 100, 600, 200, 120);

    doc.save("out-alpha-test.pdf");
    console.log("Saved to out-alpha-test.pdf");
}

main().catch(console.error);
