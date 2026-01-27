# KurdPDF

A lightweight, from-scratch PDF generation library for Node.js/Browser with first-class support for **Kurdish**, **Arabic**, and **English** text mixing.

## Features

- **No heavy dependencies** (Uses `harfbuzzjs` for shaping, otherwise zero-dep).
- **Unicode Shaping**: Correctly connects Arabic/Kurdish letters and handles RTL direction.
- **Easy API**: `jsPDF`-like syntax (`doc.text`, `doc.rect`, `doc.image`).
- **Layout**: Automatic **text wrapping**, **alignment** (Left/Right/Center), and **vertical centering** helpers.
- **Graphics**: Draw rectangles, smooth circular arcs, **clipping masks**, and embed JPEG images.
- **Precision**: High-precision vector coordinates for professional-grade printing.
- **Custom Fonts**: Embed any TrueType (.ttf) font.

## Installation

```bash
npm install kurd-pdflib
# (Local development)
npm install
npm run build
```

## Usage

```typescript
import { KurdPDF } from './dist/index.js';
import { readFileSync } from 'fs';

// 1. Initialize
const doc = new KurdPDF({
    fonts: {
        'AR': { fontBytes: readFileSync('NotoSansArabic.ttf'), baseFontName: 'NotoSansArabic' },
        'EN': { fontBytes: readFileSync('NotoSans.ttf'), baseFontName: 'NotoSans' }
    }
});

// 2. Load WASM
await doc.init({ width: 595, height: 842 }); // A4

// 3. Draw
doc.rect(50, 50, 200, 100, 'F', '#E6F0FF'); // Blue box
doc.text("سڵاو لە هەمووان", 240, 80, { 
    font: 'AR', 
    size: 18, 
    rtl: true, 
    align: 'right', 
    width: 180,
    color: '#1a237e' 
});

// 4. Save
doc.save("output.pdf");
```

## Examples

- **`src/simple-example.ts`**: Basic text and shaping.
- **`src/wrap-example.ts`**: Text wrapping and alignment.
- **`src/id-card-example.ts`**: Simple ID card layout.
- **`src/syndicate-id.ts`**: Complex membership card replica (Shapes, Logo, Trilingual).

## Documentation

For a deep dive into how to build professional documents (like ID cards) with this library, check out our **[Developer Guide](GUIDE.md)**.

## License

MIT
