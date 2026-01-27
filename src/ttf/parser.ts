/**
 * Minimal TTF parsing from scratch. Reads offset table, then head, hhea, hmtx, maxp, cmap, loca.
 * No external libraries.
 */

export interface TTFOffsetTable {
  numTables: number;
  tables: Map<string, { offset: number; length: number }>;
}

export interface TTFHead {
  unitsPerEm: number;
  indexToLocFormat: number; // 0 = short, 1 = long
}

export interface TTFHhea {
  numOfLongHorMetrics: number;
}

export interface TTFMaxp {
  numGlyphs: number;
}

export interface TTFHmtx {
  advanceWidth: Uint16Array;
  leftSideBearing: Int16Array;
}

export interface TTFCmap {
  getGlyphIndex(codePoint: number): number;
}

export interface TTFLoca {
  offsets: Uint32Array; // numGlyphs + 1, byte offsets into glyf
}

function readUInt16BE(b: Uint8Array, o: number): number {
  return (b[o]! << 8) | b[o + 1]!;
}
function readInt16BE(b: Uint8Array, o: number): number {
  const u = readUInt16BE(b, o);
  return u > 0x7fff ? u - 0x10000 : u;
}
function readUInt32BE(b: Uint8Array, o: number): number {
  return (b[o]! << 24) | (b[o + 1]! << 16) | (b[o + 2]! << 8) | b[o + 3]!;
}

export function parseOffsetTable(data: Uint8Array): TTFOffsetTable {
  const numTables = readUInt16BE(data, 4);
  const tables = new Map<string, { offset: number; length: number }>();
  for (let i = 0; i < numTables; i++) {
    const base = 12 + i * 16;
    const tag = String.fromCharCode(data[base]!, data[base + 1]!, data[base + 2]!, data[base + 3]!);
    const offset = readUInt32BE(data, base + 8);
    const length = readUInt32BE(data, base + 12);
    tables.set(tag, { offset, length });
  }
  return { numTables, tables };
}

export function parseHead(data: Uint8Array, offset: number): TTFHead {
  const unitsPerEm = readUInt16BE(data, offset + 18);
  const indexToLocFormat = readUInt16BE(data, offset + 50);
  return { unitsPerEm, indexToLocFormat };
}

export function parseHhea(data: Uint8Array, offset: number): TTFHhea {
  const numOfLongHorMetrics = readUInt16BE(data, offset + 34);
  return { numOfLongHorMetrics };
}

export function parseMaxp(data: Uint8Array, offset: number): TTFMaxp {
  const numGlyphs = readUInt16BE(data, offset + 4);
  return { numGlyphs };
}

export function parseHmtx(
  data: Uint8Array,
  offset: number,
  numGlyphs: number,
  numOfLongHorMetrics: number
): TTFHmtx {
  const advanceWidth = new Uint16Array(numGlyphs);
  const leftSideBearing = new Int16Array(numGlyphs);
  let pos = offset;
  for (let i = 0; i < numOfLongHorMetrics; i++) {
    advanceWidth[i] = readUInt16BE(data, pos);
    leftSideBearing[i] = readInt16BE(data, pos + 2);
    pos += 4;
  }
  const lastAdv = numOfLongHorMetrics > 0 ? advanceWidth[numOfLongHorMetrics - 1]! : 0;
  for (let i = numOfLongHorMetrics; i < numGlyphs; i++) {
    advanceWidth[i] = lastAdv;
    leftSideBearing[i] = readInt16BE(data, pos);
    pos += 2;
  }
  return { advanceWidth, leftSideBearing };
}

function parseCmapFormat12(data: Uint8Array, base: number): TTFCmap {
  const numGroups = readUInt32BE(data, base + 12);
  const groups: { start: number; end: number; startGid: number }[] = [];
  for (let i = 0; i < numGroups; i++) {
    const o = base + 16 + i * 12;
    groups.push({
      start: readUInt32BE(data, o),
      end: readUInt32BE(data, o + 4),
      startGid: readUInt32BE(data, o + 8),
    });
  }
  return {
    getGlyphIndex(codePoint: number): number {
      for (const g of groups) {
        if (codePoint >= g.start && codePoint <= g.end) {
          return g.startGid + (codePoint - g.start);
        }
      }
      return 0;
    },
  };
}

function parseCmapFormat4(data: Uint8Array, base: number): TTFCmap {
  const segCountX2 = readUInt16BE(data, base + 6);
  const segCount = segCountX2 >> 1;
  const endCountOffset = base + 14;
  const startCountOffset = endCountOffset + segCountX2 + 2; // +2 reserved
  const idDeltaOffset = startCountOffset + segCountX2;
  const idRangeOffsetOffset = idDeltaOffset + segCountX2;
  const glyphIdArrayOffset = idRangeOffsetOffset + segCountX2;

  const endCount: number[] = [];
  const startCount: number[] = [];
  const idDelta: number[] = [];
  const idRangeOffset: number[] = [];
  for (let i = 0; i < segCount; i++) {
    endCount.push(readUInt16BE(data, endCountOffset + i * 2));
    startCount.push(readUInt16BE(data, startCountOffset + i * 2));
    idDelta.push(readInt16BE(data, idDeltaOffset + i * 2));
    idRangeOffset.push(readUInt16BE(data, idRangeOffsetOffset + i * 2));
  }

  return {
    getGlyphIndex(codePoint: number): number {
      if (codePoint > 0xffff) return 0;
      let i = 0;
      for (; i < segCount && endCount[i]! < codePoint; i++);
      if (i >= segCount || codePoint < startCount[i]!) return 0;
      const delta = idDelta[i]!;
      const rangeOffset = idRangeOffset[i]!;
      if (rangeOffset === 0) {
        return (codePoint + delta) & 0xffff;
      }
      const idx = (idRangeOffsetOffset + i * 2 + rangeOffset) + (codePoint - startCount[i]!) * 2;
      const gid = readUInt16BE(data, idx);
      return gid === 0 ? 0 : (gid + delta) & 0xffff;
    },
  };
}

export function parseCmap(data: Uint8Array, offset: number): TTFCmap {
  const numTables = readUInt16BE(data, offset + 2);
  let bestFormat4: number | null = null;
  let bestFormat12: number | null = null;
  for (let i = 0; i < numTables; i++) {
    const base = offset + 4 + i * 8;
    const platformId = readUInt16BE(data, base);
    const encodingId = readUInt16BE(data, base + 2);
    const subOffset = readUInt32BE(data, base + 4);
    const sub = offset + subOffset;
    const format = readUInt16BE(data, sub);
    if (platformId === 3 && encodingId === 1 && format === 4) {
      bestFormat4 = sub;
    }
    if (platformId === 0 && (encodingId === 3 || encodingId === 4)) {
      if (format === 12) bestFormat12 = sub;
      else if (format === 4 && bestFormat4 === null) bestFormat4 = sub;
    }
  }
  if (bestFormat4 !== null) return parseCmapFormat4(data, bestFormat4);
  if (bestFormat12 !== null) return parseCmapFormat12(data, bestFormat12);
  return { getGlyphIndex: () => 0 };
}

export function parseLoca(
  data: Uint8Array,
  offset: number,
  indexToLocFormat: number,
  numGlyphs: number
): TTFLoca {
  const offsets = new Uint32Array(numGlyphs + 1);
  if (indexToLocFormat === 0) {
    for (let i = 0; i <= numGlyphs; i++) {
      offsets[i] = readUInt16BE(data, offset + i * 2) * 2;
    }
  } else {
    for (let i = 0; i <= numGlyphs; i++) {
      offsets[i] = readUInt32BE(data, offset + i * 4);
    }
  }
  return { offsets };
}

export interface TTFParsed {
  head: TTFHead;
  hhea: TTFHhea;
  maxp: TTFMaxp;
  hmtx: TTFHmtx;
  cmap: TTFCmap;
  loca: TTFLoca;
  tableOffsets: Map<string, { offset: number; length: number }>;
  data: Uint8Array;
}

export function parseTTF(data: Uint8Array): TTFParsed {
  const { tables } = parseOffsetTable(data);
  const headT = tables.get('head');
  const hheaT = tables.get('hhea');
  const maxpT = tables.get('maxp');
  const hmtxT = tables.get('hmtx');
  const cmapT = tables.get('cmap');
  const locaT = tables.get('loca');
  if (!headT || !hheaT || !maxpT || !hmtxT || !cmapT || !locaT) {
    throw new Error('TTF: missing required tables (head, hhea, maxp, hmtx, cmap, loca)');
  }
  const head = parseHead(data, headT.offset);
  const hhea = parseHhea(data, hheaT.offset);
  const maxp = parseMaxp(data, maxpT.offset);
  const hmtx = parseHmtx(data, hmtxT.offset, maxp.numGlyphs, hhea.numOfLongHorMetrics);
  const cmap = parseCmap(data, cmapT.offset);
  const loca = parseLoca(data, locaT.offset, head.indexToLocFormat, maxp.numGlyphs);
  return {
    head,
    hhea,
    maxp,
    hmtx,
    cmap,
    loca,
    tableOffsets: tables,
    data,
  };
}
