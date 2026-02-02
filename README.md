# Kurd-PDFLib

A powerful, zero-dependency Node.js library for high-quality PDF generation, specifically optimized for **Kurdish (Sorani)** and **Arabic** scripts. It features a robust **Layout Engine** and advanced typography tools.

## ✨ Key Features

*   **🚀 Zero Dependency**: Built from the ground up for maximum speed and portability.
*   **🌍 Multi-Script Support**: Full HarfBuzz-powered text shaping for perfect Kurdish ligatures and RTL layout.
*   **🔐 PDF Encryption**:
    *   **AES-128 & RC4-128**: Modern encryption with legacy compatibility.
    *   **Password Protection**: User password (to open) and owner password (for full access).
    *   **Permission Controls**: Restrict printing, copying, modification, and more.
*   **🏗️ UI-Style Layout Engine**:
    *   Responsive `vstack`, `hstack`, `zstack`, and `grid` containers.
    *   Flexbox-style distribution: `space-between`, `space-evenly`, and `center`.
    *   Full styling: `padding`, `margin`, `border`, `backgroundColor`, and `borderRadius`.
*   **🖼️ Graphics Powerhouse**:
    *   **PNG Transparency**: Deep alpha-channel support (SMask).
    *   **SVG Vectors**: Natively render SVG paths directly in the PDF.
    *   **Object Fit**: Control image scaling with `cover` and `contain` modes.
*   **✍️ Professional Typography**:
    *   **Justified Text**: Even margins for both LTR and RTL text.
    *   **Wrapping**: Automatic line-breaking for long paragraphs.
    *   **Opacity**: True alpha transparency for shapes and icons.

## 📦 Installation

```bash
npm install
npm run build
```

## 📖 Usage

Comprehensive details are available in the **[GUIDE.md](./GUIDE.md)**.

### Quick Start Example

```typescript
import { KurdPDF, LayoutEngine } from './index.js';

const layout = new LayoutEngine(doc);

layout.render({
    type: 'box',
    options: {
        backgroundColor: '#f8f9fa',
        borderRadius: 15,
        padding: 30,
        borderColor: '#0d6efd',
        borderWidth: 2
    },
    child: {
        type: 'vstack',
        options: { gap: 15, align: 'center' },
        children: [
            { type: 'text', content: 'بەخێربێن بۆ Kurd-PDFLib', options: { font: 'AR', size: 24, rtl: true } },
            { type: 'text', content: 'Modern Layouts for Kurdish Texts', options: { font: 'EN', size: 14 } }
        ]
    }
}, 50, 750);
```

### Password Protection Example

```typescript
const doc = new KurdPDF({
    fonts: { /* ... */ },
    encryption: {
        userPassword: 'secret123',      // Required to open
        ownerPassword: 'admin456',      // Required for full access
        algorithm: 'aes',               // 'aes' (recommended) or 'rc4'
        permissions: {
            print: true,
            copy: false,                // Disable text copying
            modify: false,              // Disable modification
            annotate: true
        }
    }
});
```

## 📜 License

MIT
