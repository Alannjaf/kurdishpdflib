
import { parseTTF } from './src/ttf/parser.js';
import { readFileSync } from 'fs';

const fontBytes = new Uint8Array(readFileSync('assets/NotoSansArabic-Regular.ttf'));
const parsed = parseTTF(fontBytes);
const latinA = 'A'.codePointAt(0)!;
const gid = parsed.cmap.getGlyphIndex(latinA);
console.log('Latin A GID in Arabic font:', gid);
