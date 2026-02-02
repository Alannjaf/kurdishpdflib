# Kurd-PDFLib Guide

A zero-dependency Node.js library for creating PDFs with advanced support for **Kurdish (Sorani)**, **Arabic**, and **English** text. It features a powerful **Layout Engine** inspired by modern UI frameworks.

## Core Features

- **Multi-script Support**: Seamlessly mix RTL (Kurdish/Arabic) and LTR (English) text in the same document.
- **Advanced Text Shaping**: Built-in HarfBuzz engine for correct Arabic/Kurdish ligature rendering.
- **Modern Layout Engine**: Build complex UIs using `vstack`, `hstack`, `zstack`, and `box` containers.
- **Rich Styling**: Support for `padding`, `margin`, `backgroundColor`, `borderColor`, `borderWidth`, and `borderRadius`.
- **Image Support**: JPEG and PNG support. PNGs automatically handle alpha-channel transparency using PDF Soft Masks (SMask).
- **Vector Graphics**: Full SVG path parsing and rendering directly into PDF vectors.
- **Typography Polish**: Automatic text wrapping, cross-script justification (LTR and RTL), and custom line height control.
- **Opacity**: True alpha transparency support for shapes, paths, and vectors.
- **Multi-Page Flow**: Automatically break content across pages.

## Getting Started

```typescript
import { KurdPDF, LayoutEngine } from './index.js';
import { readFileSync } from 'fs';

// 1. Initialize Document with Fonts & Metadata
const doc = new KurdPDF({
    fonts: {
        'AR': { fontBytes: readFileSync('NotoSansArabic.ttf'), baseFontName: 'NotoSansArabic' },
        'EN': { fontBytes: readFileSync('NotoSans.ttf'), baseFontName: 'NotoSans' }
    },
    title: 'Monthly Report',
    author: 'Alan Jaff'
});
await doc.init();

// 2. Initialize Layout Engine
const layout = new LayoutEngine(doc);

// 3. Render Content with Automatic Page Flow
const root = {
    type: 'vstack',
    options: { gap: 20, padding: 30 },
    children: [
        { type: 'text', content: 'Long Document Header', options: { font: 'EN', size: 24 } },
        // ... many more items ...
    ]
};
layout.renderFlow(root, { topMargin: 50, bottomMargin: 50 });

// 4. Save to File
doc.save('output.pdf');
```

---

## The Layout Engine

The `LayoutEngine` handles all coordinate math automatically, allowing you to focus on the structure of your document.

### Rendering Methods

*   **`render(element, x, y)`**: Renders an element at a specific A4 coordinate. Use this for fixed-position elements like headers, footers, or IDs.
*   **`renderFlow(element, options)`**: Automatically handles **multi-page flow**. It will break a `vstack` across multiple pages if it's too long to fit on one.
    *   `topMargin`: Space from the top of each page (default 50).
    *   `bottomMargin`: Space from the bottom before breaking to a new page (default 50).
    *   `leftMargin`: X-coordinate to start drawing from (default 0).

### Container Types

*   **`vstack`**: Arranges children vertically. Supports `align` (`start`, `center`, `end`, `space-between`, `space-evenly`) and `gap`.
*   **`hstack`**: Arranges children horizontally. Supports `align` and `gap`.
*   **`zstack`**: Overlays children on top of each other. Perfect for background patterns or text overlays.
*   **`grid`**: Arranges children in a fixed number of columns.
    *   **`columns`**: Number of columns (e.g., `3`).
    *   **`gap`**: Spacing between grid items.
    *   **`rowGap`** / **`columnGap`**: Override general gap for specific axes.
*   **`box`**: A wrapper for a single element. Used to apply styling (backgrounds, borders, padding) or to constrain an element's size.

### Global Styling Options (`LayoutOptions`)

Every element and container accepts these options:

| Option | Type | Description |
| :--- | :--- | :--- |
| `width`, `height` | `number` | Fix the dimensions of the element. |
| `padding` | `number \| [number, number]` | Internal spacing. `[vertical, horizontal]`. |
| `margin` | `number \| [number, number]` | External spacing around the element. |
| `backgroundColor` | `string` | Hex color (e.g., `#FF0000`). |
| `borderColor` | `string` | Hex color for the border stroke. |
| `borderWidth` | `number` | Thickness of the border. |
| `borderRadius` | `number` | Radius for rounded corners. **Content is automatically clipped** to this shape. |
| `opacity` | `number` | Alpha transparency (0.0 to 1.0). Affects the element and all its children. |
| `align` | `string` | Alignment for children (`start`, `center`, `end`, `space-between`, `space-evenly`). |

---

## Metadata

Set document properties like Title and Author either in the constructor or via `setMetadata`.

```typescript
doc.setMetadata('Monthly Invoice', 'Alan Jaff', 'Financials');
```

---

## Typography

### Text Wrapping
Provide a `width` to a text element to enable automatic multi-line wrapping.

```typescript
{
    type: 'text',
    content: 'Long Kurdish or English paragraph...',
    options: { 
        width: 300, 
        align: 'justify', // Clean edges on both sides
        lineHeight: 1.5,   // Set spacing between lines
        rtl: true          // Enable for Kurdish/Arabic
    }
}
```

### Justification
The library supports native **RTL Justification**. It automatically calculates word spacing to align both the right and left edges of Kurdish/Arabic text blocks.

---

## Images & Vectors

### Image Scaling (`objectFit`)
When placing an image in a fixed-size box, use `objectFit` to control how it scales:

- **`fill` (default)**: Stretches the image to fit exactly.
- **`contain`**: Scales the image to fit inside without cropping (maintains aspect ratio).
- **`cover`**: Zooms the image to fill the box entirely, cropping the excess (maintains aspect ratio).

```typescript
{ 
    type: 'image', 
    data: myImageBytes, 
    imgType: 'png', 
    width: 200, 
    height: 100, 
    options: { objectFit: 'cover' } 
}
```

### SVG Support
Render SVG path data as scalable vectors. Original colors from SVG classes (`cls-1`, `cls-2`, etc.) are respected.

```typescript
{
    type: 'svg',
    content: readFileSync('logo.svg', 'utf-8'),
    width: 50,
    height: 50,
    options: { scale: 1.2 }
}
```

---

## PDF Encryption

Kurd-PDFLib supports robust PDF encryption with both **AES-128** (recommended) and **RC4-128** (legacy compatibility) algorithms.

### Basic Password Protection

```typescript
const doc = new KurdPDF({
    fonts: { /* ... */ },
    encryption: {
        userPassword: 'secret123',     // Required to open the document
        ownerPassword: 'admin456',     // Required for full access (editing, removing restrictions)
        algorithm: 'aes'               // 'aes' (default, recommended) or 'rc4'
    }
});
```

### Permission Restrictions

You can create documents that open without a password but have restricted permissions:

```typescript
const doc = new KurdPDF({
    fonts: { /* ... */ },
    encryption: {
        userPassword: '',              // Empty = opens without password
        ownerPassword: 'owner-secret', // Password to remove restrictions
        algorithm: 'aes',
        permissions: {
            print: false,              // Disable printing
            copy: false,               // Disable text/image copying
            modify: false,             // Disable document modification
            annotate: true,            // Allow adding annotations
            fillForms: true,           // Allow form field filling
            extractForAccessibility: true,  // Allow accessibility extraction
            assemble: false,           // Disable page assembly
            highQualityPrint: false    // Disable high-quality printing
        }
    }
});
```

### Encryption Options Reference

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `userPassword` | `string` | `''` | Password required to open the document. Empty string = no password needed. |
| `ownerPassword` | `string` | (userPassword) | Password for full access. If not set, uses userPassword. |
| `algorithm` | `'aes' \| 'rc4'` | `'aes'` | Encryption algorithm. AES-128 is recommended for modern readers. |
| `permissions` | `PDFPermissions` | (all allowed) | Object controlling document permissions. |

### Permission Flags

| Permission | Description |
| :--- | :--- |
| `print` | Allow printing the document |
| `copy` | Allow copying text and images |
| `modify` | Allow modifying document content |
| `annotate` | Allow adding/editing annotations |
| `fillForms` | Allow filling form fields |
| `extractForAccessibility` | Allow text extraction for accessibility |
| `assemble` | Allow inserting, rotating, or deleting pages |
| `highQualityPrint` | Allow high-resolution printing |

### Algorithm Comparison

| Feature | AES-128 | RC4-128 |
| :--- | :--- | :--- |
| Security | High (modern standard) | Medium (legacy) |
| PDF Version | 1.5+ | 1.4+ |
| Compatibility | Most modern readers | Older PDF readers |
| Recommendation | **Use this** | Only for legacy support |

### Example: Kurdish Password

You can use non-ASCII passwords, including Kurdish/Arabic text:

```typescript
const doc = new KurdPDF({
    fonts: { /* ... */ },
    encryption: {
        userPassword: 'کوردستان',      // Kurdish password!
        ownerPassword: 'ئەدمین',
        algorithm: 'aes'
    }
});
```

---

## Advanced Usage

### True Transparency
Use `doc.setOpacity(alpha)` or the `opacity` option in layouts to create transparent overlays or watermarks.

### Background Watermarks
To create a watermark, use a `zstack` at the root of your page. Place a faint SVG or Image in the first layer and your content in the subsequent layers.

```typescript
{
    type: 'zstack',
    children: [
        { type: 'rect', options: { color: '#FFF' } }, // Background
        { type: 'svg', options: { opacity: 0.1 } },    // Watermark
        { type: 'vstack', children: [...] }            // Content
    ]
}
```
