# Developer Guide: Building with Kurd-PDFLib

This guide explains how to use `Kurd-PDFLib` to build professional-grade documents, like the **Kurdistan Veterinary Syndicate ID Card**.

---

## 1. Getting Started

Kurd-PDFLib uses **HarfBuzz** for text shaping, which allows it to handle complex scripts like Kurdish (Central/Sorani and Northern/Kurmanji) correctly.

### Initialization
Always initialize the document with the fonts you intend to use. For trilingual documents, we recommend at least one Arabic/Kurdish font and one Latin font.

```typescript
const doc = new KurdPDF({
    fonts: {
        'AR': { fontBytes: arabicBytes, baseFontName: 'NotoSansArabic' },
        'EN': { fontBytes: latinBytes, baseFontName: 'NotoSans' }
    }
});
await doc.init({ width: 243, height: 153 }); // ID Card size in points
```

---

## 2. The Coordinate System

The library uses the standard PDF coordinate system:
- **(0,0)** is the **Bottom-Left** corner.
- **X** increases to the right.
- **Y** increases upwards.

*Tip: When designing an ID card, it's often easier to define variables for `W` (Width) and `H` (Height) and calculate positions relative to them (e.g., `H - 20` for a header).*

---

## 3. Working with Kurdish/Arabic Text

To render Kurdish correctly, you must use a font that supports Arabic script and enable RTL features.

### RTL Text
When using `doc.text`, follow these rules for Kurdish:
1. **`font`**: Use your Arabic/Kurdish font key.
2. **`rtl: true`**: This tells the shaper to handle character joining and bidirectional order.
3. **`align: 'right'`**: Since Kurdish is read right-to-left, you usually want to align text to the right edge of your bounding box.
4. **`width`**: Providing a width enables automatic line wrapping.

```typescript
doc.text("سەندیکای پزیشکانی ڤێتێرنەری", W - 10, H - 20, { 
    font: 'AR', 
    size: 10, 
    rtl: true, 
    align: 'right', 
    width: 170 
});
```

---

## 4. Advanced Graphics & Branding

### Drawing Complex Shapes
The `doc.path` method allows you to create custom shapes using Move (`M`), Line (`L`), and Cubic Bezier Curve (`C`) commands.

**Example: The Wavy Header**
```typescript
doc.path([
    { x: 0, y: H, type: 'M' },        // Move to top-left
    { x: W, y: H, type: 'L' },        // Line to top-right
    { x: W, y: H - 40, type: 'L' },   // Line down
    { x: 0, y: H - 40, type: 'C',     // Curve back to left
        cp1: { x: W * 0.7, y: H - 65 }, 
        cp2: { x: W * 0.3, y: H - 65 } 
    }
], 'F', '#FFFFFF'); // 'F' for Fill
```

### Adding Images
The library supports JPEG images. It automatically detects the original pixel dimensions to ensure high-quality rendering.

```typescript
doc.image(photoBytes, 'jpeg', x, y, displayWidth, displayHeight);
```

---

## 5. Precise Layout with `measureText`

If you need to align multiple elements (like a label followed by a value), use `measureText` to calculate exact widths.

```typescript
const textWidth = doc.measureText("Label", 10, { font: 'EN' });
// Now you know exactly where to start the next element!
```

---

## 6. Best Practices

1. **Font Choice**: Use Google Fonts like **Noto Sans Arabic** for the best Kurdish rendering.
2. **Color Contrast**: Use Hex codes (e.g., `#1a237e`) to match brand guidelines.
3. **Double Sided**: Use `doc.addPage(W, H)` to create double-sided ID cards or multi-page documents.
4. **Safety First**: Wrap your text blocks in `q` and `Q` (handled automatically by `doc.text`) to ensure font and color settings don't leak between elements.
