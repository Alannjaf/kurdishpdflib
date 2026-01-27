import { KurdPDF } from './index.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const logoSvgPath = join(__dirname, '..', 'assets', 'Logo.svg');

async function main() {
    const svgContent = readFileSync(logoSvgPath, 'utf-8');

    const doc = new KurdPDF();
    await doc.init();

    doc.text("SVG Vector Rendering Test", 50, 800, { size: 20 });
    
    // Render SVG at (50, 600)
    // Note: The scale parameter (1.0) might need adjustment based on the SVG's viewBox
    doc.svg(svgContent, 50, 600, { scale: 1.0 });

    doc.save("out-svg-test.pdf");
    console.log("Saved to out-svg-test.pdf");
}

main().catch(console.error);
