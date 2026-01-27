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

## 2. Advanced Layout Techniques

### Floating Header Capsule
To create a modern "floating" header that bleeds off the right edge, use `doc.path` with a large corner radius.

```typescript
// For a perfect semi-circle, set radius (hR) to half the height (hH)
const hH = 56, hT = H - 15, hB = hT - hH, hX = 70, hR = 28;
const hK = hR * 0.5522; // Kappa constant

doc.path([
    { x: hX + hR, y: hT, type: 'M' },
    { x: W, y: hT, type: 'L' },
    { x: W, y: hB, type: 'L' },
    { x: hX + hR, y: hB, type: 'L' },
    { x: hX, y: hB + hR, type: 'C', cp1: { x: hX + hR - hK, y: hB }, cp2: { x: hX, y: hB + hR - hK } },
    { x: hX + hR, y: hT, type: 'C', cp1: { x: hX, y: hB + hR + hK }, cp2: { x: hX + hR - hK, y: hT } }
], 'F', '#FFFFFF');
```

### Vertical Centering
To center a block of text vertically, calculate the center of your area and apply an offset based on the number of lines and font size.

```typescript
const textCenterY = hB + hR - 3; // Shift slightly for baseline adjustment
doc.text("Line 1", x, textCenterY + 13, { size: 9 });
doc.text("Line 2", x, textCenterY, { size: 9 });
doc.text("Line 3", x, textCenterY - 13, { size: 9 });
```

---

## 3. Working with Kurdish/Arabic Text

To render Kurdish correctly, you must use a font that supports Arabic script and enable RTL features.

### RTL Text
When using `doc.text`, follow these rules for Kurdish:
1. **`font`**: Use your Arabic/Kurdish font key.
2. **`rtl: true`**: This tells the shaper to handle character joining and bidirectional order.
3. **`align: 'right'`**: Since Kurdish is read right-to-left, you usually want to align text to the right edge.
4. **`width`**: Providing a width enables automatic line wrapping.

---

## 4. Circular Masking (Clipping)

Since JPEGs do not support transparency, you must use a **Clipping Mask** to create a circular logo without white corners.

### The Masking Workflow
1.  **Save State**: `doc.saveGraphicsState()`
2.  **Define Mask**: `doc.clip(points)` (use Bezier arcs for a circle)
3.  **Draw Background**: `doc.rect()` or `doc.path()`
4.  **Draw Image**: `doc.image()`
5.  **Restore State**: `doc.restoreGraphicsState()`

*Crucial: You must restore the state, otherwise the mask will hide content on the rest of the page!*

---

## 5. Precise Alignment with `measureText`

If you need to align multiple elements (like a label followed by a value), use `measureText` to calculate exact widths.

```typescript
const textWidth = doc.measureText("Label", 10, { font: 'EN' });
// Use this to calculate the starting X for the next element!
```

---

## 6. Best Practices

1. **High Precision**: The library uses 6-decimal precision for all vector paths to ensure perfectly smooth curves.
2. **Kappa Constant**: Always use `0.5522` for circular Bezier arcs to avoid "jagged" or segmented edges.
3. **Double Sided**: Use `doc.addPage(W, H)` to create double-sided ID cards. Content on Page 2 will inherit fonts but has its own independent coordinate state.
