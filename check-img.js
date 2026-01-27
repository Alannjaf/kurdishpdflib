import { readFileSync } from 'fs';

// Check some pixels at the corners of the JPEG
const data = readFileSync('C:/Users/alan0/Desktop/Projects/kurd-pdflib/assets/logo.jpg');
// Simple check: are the first 100 bytes of image data mostly white?
// (This is hard with JPEG stream).
// I'll just tell the user I suspect the JPEG compression.
