/**
 * Glyph ID hex encoding and ToUnicode CMap generation.
 * We send GIDs in the content stream and use /Identity CIDToGIDMap.
 */

/**
 * Encode glyph IDs as 2-byte big-endian hex for PDF <...> string.
 */
export function toGlyphIdHex(gids: number[]): string {
  const parts = gids.map((g) => (g & 0xffff).toString(16).padStart(4, '0'));
  return '<' + parts.join('') + '>';
}

/**
 * Build a ToUnicode CMap that maps character codes (GIDs we send) to Unicode.
 * pairs: [gid, unicodeString][] from drawText/drawShapedRun.
 */
export function buildToUnicodeCMapFromGidPairs(pairs: [number, string][]): string {
  const uniq = new Map<number, string>();
  for (const [gid, unicode] of pairs) {
    if (!uniq.has(gid)) uniq.set(gid, unicode);
  }
  const entries = [...uniq.entries()].sort((a, b) => a[0] - b[0]);
  
  if (entries.length === 0) {
    return `/CIDInit /ProcSet findresource begin
12 dict begin
begincmap
/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def
/CMapName /Identity-H def
1 begincodespacerange
<0000> <FFFF>
endcodespacerange
endcmap
CMapName currentdict /CMap defineresource pop
end
end`;
  }
  
  const lines: string[] = [];
  lines.push(`/CIDInit /ProcSet findresource begin`);
  lines.push(`12 dict begin`);
  lines.push(`begincmap`);
  lines.push(`/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def`);
  lines.push(`/CMapName /Identity-H def`);
  lines.push(`1 begincodespacerange`);
  lines.push(`<0000> <FFFF>`);
  lines.push(`endcodespacerange`);
  lines.push(`${entries.length} beginbfchar`);
  
  for (const [gid, unicode] of entries) {
    const gh = (gid & 0xffff).toString(16).padStart(4, '0');
    // Encode string as hex UTF-16BE (handling surrogates for high codepoints)
    let hex = '';
    for (const char of unicode) {
      const code = char.codePointAt(0)!;
      if (code > 0xFFFF) {
        const high = Math.floor((code - 0x10000) / 0x400) + 0xD800;
        const low = ((code - 0x10000) % 0x400) + 0xDC00;
        hex += high.toString(16).padStart(4, '0') + low.toString(16).padStart(4, '0');
      } else {
        hex += code.toString(16).padStart(4, '0');
      }
    }
    lines.push(`<${gh}> <${hex}>`);
  }
  
  lines.push(`endbfchar`);
  lines.push(`endcmap`);
  lines.push(`CMapName currentdict /CMap defineresource pop`);
  lines.push(`end`);
  lines.push(`end`);
  return lines.join('\n');
}

const encoder = new TextEncoder();

export function encodeToUnicodeStream(cmap: string): Uint8Array {
  return encoder.encode(cmap);
}
