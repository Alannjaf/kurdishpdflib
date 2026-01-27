import { readFileSync } from 'fs';

const buf = readFileSync('assets/NotoSansArabic-Regular.ttf');
const numTables = buf.readUInt16BE(4);
console.log(`Tables: ${numTables}`);
for(let i=0; i<numTables; i++) {
    const o = 12 + i*16;
    const tag = buf.toString('utf8', o, o+4);
    console.log(tag);
}
