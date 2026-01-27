# Kurd-PDFLib

A powerful, zero-dependency PDF generation library for Node.js, specialized for **Kurdish** and **Arabic** content. It includes a modern **Layout Engine** for building complex UIs with ease.

## Key Features

*   **Zero External Dependencies**: Built from scratch (except for dev-tools).
*   **Kurdish & Arabic Support**: Full HarfBuzz-based text shaping for correct ligatures and RTL.
*   **Flex-like Layout Engine**:
    *   `vstack`, `hstack`, `zstack`
    *   Alignment: `center`, `space-between`, `space-evenly`
    *   Styling: `padding`, `margin`, `border`, `backgroundColor`, `borderRadius`
*   **Advanced Typography**:
    *   Automatic text wrapping
    *   Justified alignment
    *   Custom line height
*   **Graphics**:
    *   **PNG** (with transparency/alpha) and **JPEG** support.
    *   **SVG** vector rendering.

## Installation

```bash
npm install
npm run build
```

## Usage

See `GUIDE.md` for full documentation on the Layout Engine and API.

### Quick Example

```typescript
import { KurdPDF, LayoutEngine } from './index.js';

// ... setup fonts ...

const layout = new LayoutEngine(doc);

layout.render({
    type: 'box',
    options: { 
        backgroundColor: '#f0f0f0', 
        borderRadius: 10, 
        padding: 20 
    },
    child: {
        type: 'vstack',
        options: { gap: 10, align: 'center' },
        children: [
            { type: 'text', content: 'Kurdish PDF', options: { size: 20 } },
            { type: 'text', content: 'With Layout Engine', options: { size: 14 } }
        ]
    }
}, 50, 700);

doc.save('output.pdf');
```

## License

MIT
