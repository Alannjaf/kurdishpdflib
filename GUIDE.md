# Kurd-PDFLib Guide

A zero-dependency Node.js library for creating PDFs with advanced support for **Kurdish (Sorani)**, **Arabic**, and **English** text. It features a powerful **Layout Engine** inspired by modern UI frameworks.

## Features

- **Multi-script Support**: Seamless mixing of RTL (Kurdish/Arabic) and LTR (English) text.
- **Advanced Text Shaping**: Uses HarfBuzz for correct Arabic ligature rendering.
- **Layout Engine**: Build UIs with `vstack`, `hstack`, `zstack`, and `box`.
- **Styling**: Support for `padding`, `margin`, `backgroundColor`, `borderColor`, and `borderRadius`.
- **Image Support**: JPEG and PNG (with alpha/transparency).
- **Vector Graphics**: Render SVG paths directly as vectors.
- **Typography**: Automatic text wrapping, justification, and custom line height.

## Getting Started

```typescript
import { KurdPDF, LayoutEngine } from './index.js';
import { readFileSync } from 'fs';

// 1. Initialize Document
const doc = new KurdPDF({
    fonts: {
        'AR': { fontBytes: fs.readFileSync('NotoSansArabic.ttf'), baseFontName: 'NotoSansArabic' },
        'EN': { fontBytes: fs.readFileSync('NotoSans.ttf'), baseFontName: 'NotoSans' }
    }
});
await doc.init();

// 2. Initialize Layout Engine
const layout = new LayoutEngine(doc);

// 3. Render Content
layout.render({
    type: 'vstack',
    options: { gap: 20, padding: 30, align: 'center' },
    children: [
        { type: 'text', content: 'Hello World', options: { font: 'EN', size: 24 } },
        { type: 'text', content: 'سڵاو لە جیهان', options: { font: 'AR', size: 24, rtl: true } }
    ]
}, 0, 842); // Render at top-left (0, 842) for A4

// 4. Save
doc.save('output.pdf');
```

## The Layout Engine

The `LayoutEngine` lets you build complex designs without manual coordinate math.

### Container Types

*   **`vstack`**: Stacks elements vertically.
*   **`hstack`**: Stacks elements horizontally.
*   **`zstack`**: Overlays elements on top of each other (useful for backgrounds).
*   **`box`**: Wraps a single element to add padding, borders, or background color.

### Common Options

All containers support `LayoutOptions`:

```typescript
options: {
    width: 200,             // Force width
    gap: 10,                // Space between children
    padding: 20,            // Padding around content (supports [v, h] or [t, r, b, l])
    margin: 10,             // Margin outside element
    align: 'center',        // 'start', 'center', 'end', 'space-between', 'space-evenly'
    backgroundColor: '#eee',// Hex color
    borderColor: 'red',     // Hex color
    borderWidth: 1,         // Border thickness
    borderRadius: 5         // Rounded corners
}
```

### Text Options

Text elements support advanced typography:

```typescript
{
    type: 'text',
    content: 'Long paragraph...',
    options: {
        font: 'EN',
        size: 12,
        width: 300,         // Width constraint for wrapping
        align: 'justify',   // 'left', 'right', 'center', 'justify'
        lineHeight: 1.5     // Multiplier (e.g. 1.5x spacing)
    }
}
```

## Images & Vectors

### PNG & JPEG
Use `type: 'image'` within a layout:

```typescript
{ 
    type: 'image', 
    data: pngBytes, 
    imgType: 'png', 
    width: 100, 
    height: 100 
}
```
*Note: PNG transparency is supported automatically.*

### SVG Vectors
You can render SVG paths directly using the low-level API:

```typescript
const svgContent = '<svg>...</svg>'; // or path data d="..."
doc.svg(svgContent, 100, 100, { scale: 0.5, color: '#FF0000' });
```

## Examples

Check the `src/` folder for complete examples:
- `syndicate-id-v2.ts`: Complex ID card with styling.
- `test-flex.ts`: Demonstrates `zstack` and `space-between`.
- `test-text-polish.ts`: Demonstrates text justification and wrapping.
