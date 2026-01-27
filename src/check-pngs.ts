import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { parsePNG } from './png.js';

const assetsDir = 'C:/Users/alan0/Desktop/Projects/kurd-pdflib/assets';
const files = readdirSync(assetsDir).filter(f => f.endsWith('.png'));

for (const file of files) {
    try {
        const data = new Uint8Array(readFileSync(join(assetsDir, file)));
        const png = parsePNG(data);
        console.log(`${file}: ColorType ${png.colorType}, Alpha: ${png.alphaData ? 'Yes' : 'No'}`);
    } catch (e: any) {
        console.log(`${file}: Error - ${e.message}`);
    }
}
