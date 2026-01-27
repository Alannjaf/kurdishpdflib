/**
 * Low-level PDF serialization: objects, xref, trailer.
 * No external libraries; uses only Uint8Array / Buffer and string ops.
 */

export type PdfRef = { id: number; gen: number };

/** PDF name object. Use for /Type, /Subtype, /BaseFont, /Encoding, etc. */
export function name(s: string): { __pdfName: string } {
  return { __pdfName: s };
}

function escapePdfName(s: string): string {
  return s.replace(/[#\s()<>[\]{}/%]/g, (c) => '#' + c.charCodeAt(0).toString(16).padStart(2, '0'));
}

export interface PdfWriterObject {
  id: number;
  gen: number;
  kind: 'dict' | 'stream';
  dict?: Record<string, unknown>;
  stream?: Uint8Array;
}

function encodeStr(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

function refStr(ref: PdfRef): string {
  return `${ref.id} ${ref.gen} R`;
}

function escapePdfString(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function serializeValue(v: unknown, refs: Map<number, PdfWriterObject>): string {
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'number') return String(Math.round(v) === v ? v : v);
  if (typeof v === 'object' && v !== null && '__pdfName' in v)
    return '/' + escapePdfName((v as { __pdfName: string }).__pdfName);
  if (typeof v === 'string') return '(' + escapePdfString(v) + ')';
  if (v instanceof Uint8Array) {
    const hex = Array.from(v)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    return '<' + hex + '>';
  }
  if (Array.isArray(v)) {
    const parts = v.map((x) => serializeValue(x, refs));
    return '[' + parts.join(' ') + ']';
  }
  if (typeof v === 'object' && v !== null && 'id' in v && 'gen' in v) {
    return refStr(v as PdfRef);
  }
  if (typeof v === 'object' && v !== null) {
    const dict = v as Record<string, unknown>;
    const parts: string[] = [];
    for (const k of Object.keys(dict).sort()) {
      const val = dict[k];
      if (val === undefined) continue;
      parts.push('/' + k + ' ' + serializeValue(val, refs));
    }
    return '<< ' + parts.join(' ') + ' >>';
  }
  return 'null';
}

/**
 * Serialize a dictionary to PDF representation.
 */
export function serializeDict(dict: Record<string, unknown>, refs: Map<number, PdfWriterObject>): string {
  return serializeValue(dict, refs);
}

/**
 * PDF writer: manages object IDs, collects objects, builds xref and trailer.
 */
export class PdfWriter {
  private nextId = 1;
  private objects: PdfWriterObject[] = [];
  private refs = new Map<number, PdfWriterObject>();

  allocId(): number {
    return this.nextId++;
  }

  addDict(dict: Record<string, unknown>): PdfRef {
    const id = this.allocId();
    const obj: PdfWriterObject = { id, gen: 0, kind: 'dict', dict };
    this.objects.push(obj);
    this.refs.set(id, obj);
    return { id, gen: 0 };
  }

  addStream(dict: Record<string, unknown>, body: Uint8Array): PdfRef {
    const id = this.allocId();
    const streamDict = { ...dict, Length: body.length } as Record<string, unknown>;
    const obj: PdfWriterObject = { id, gen: 0, kind: 'stream', dict: streamDict, stream: body };
    this.objects.push(obj);
    this.refs.set(id, obj);
    return { id, gen: 0 };
  }

  addImageXObject(data: Uint8Array, type: 'jpeg' | 'png', width: number, height: number): PdfRef {
      const dict: Record<string, unknown> = {
          Type: name('XObject'),
          Subtype: name('Image'),
          Width: width,
          Height: height,
          BitsPerComponent: 8,
          ColorSpace: name('DeviceRGB'),
      };

      if (type === 'jpeg') {
          dict.Filter = name('DCTDecode');
      } else if (type === 'png') {
          throw new Error("PNG support requires zlib/inflation. Only JPEG supported in zero-dependency mode for now.");
      }

      const id = this.allocId();
      const streamDict = { ...dict, Length: data.length } as Record<string, unknown>;
      const obj: PdfWriterObject = { id, gen: 0, kind: 'stream', dict: streamDict, stream: data };
      this.objects.push(obj);
      this.refs.set(id, obj);
      return { id, gen: 0 };
  }

  build(): Uint8Array {
    const chunks: Uint8Array[] = [];
    let currentOffset = 0;
    const push = (b: Uint8Array | string) => {
      const data = typeof b === 'string' ? encodeStr(b) : b;
      chunks.push(data);
      currentOffset += data.length;
    };

    push('%PDF-1.7\r\n');

    const xrefOffsets: number[] = []; // index 0 unused; index i = object id

    for (const obj of this.objects) {
      xrefOffsets[obj.id] = currentOffset;

      push(`${obj.id} ${obj.gen} obj\r\n`);
      if (obj.kind === 'dict') {
        push(serializeDict(obj.dict!, this.refs) + '\r\n');
      } else {
        push(serializeDict(obj.dict!, this.refs) + '\r\n');
        push('stream\n');
        push(obj.stream!);
        push('\nendstream\r\n');
      }
      push('endobj\r\n');
    }

    const size = this.nextId; 
    const xrefStart = currentOffset;

    push('xref\r\n');
    push(`0 ${size}\r\n`);
    push('0000000000 65535 f \r\n');
    for (let i = 1; i < this.nextId; i++) {
      const off = xrefOffsets[i] ?? 0;
      push(off.toString().padStart(10, '0') + ' 00000 n \r\n');
    }

    const catalog = this.objects.find(o => o.dict?.Type && (o.dict.Type as any).__pdfName === 'Catalog');
    const info = this.objects.find(o => o.dict?.Producer === '(kurd-pdflib)');
    const rootId = catalog ? catalog.id : 1;
    const infoId = info ? info.id : 2;
    
    push('trailer\r\n');
    push(`<< /Size ${size} /Root ${rootId} 0 R /Info ${infoId} 0 R >>\r\n`);
    push('startxref\r\n');
    push(xrefStart + '\r\n');
    push('%%EOF\r\n');

    const out = new Uint8Array(currentOffset);
    let pos = 0;
    for (const c of chunks) {
      out.set(c, pos);
      pos += c.length;
    }
    return out;
  }

  getRef(id: number): PdfRef {
    const o = this.refs.get(id);
    if (!o) throw new Error('PdfWriter: unknown object id ' + id);
    return { id, gen: 0 };
  }

  get objectsList(): PdfWriterObject[] {
    return this.objects;
  }

  get refsMap(): Map<number, PdfWriterObject> {
    return this.refs;
  }
}
