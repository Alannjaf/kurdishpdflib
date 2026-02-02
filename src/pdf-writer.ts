import { deflate } from 'pako';
import type { EncryptionState } from './encryption.js';
import { encryptStream, encryptString, buildEncryptDict } from './encryption.js';

// PDF requires binary strings for streams, and proper encoding.
// We'll use TextEncoder for strings, but for compressed data we must be careful.

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

interface SerializeContext {
  refs: Map<number, PdfWriterObject>;
  encryptionState?: EncryptionState | null;
  objectId?: number;
  generation?: number;
}

function serializeValue(v: unknown, ctx: SerializeContext): string {
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'number') return String(Math.round(v) === v ? v : v);
  if (typeof v === 'object' && v !== null && '__pdfName' in v)
    return '/' + escapePdfName((v as { __pdfName: string }).__pdfName);
  if (typeof v === 'string') {
    // Encrypt string if encryption is enabled and we have object context
    if (ctx.encryptionState && ctx.objectId !== undefined) {
      const strBytes = new TextEncoder().encode(v);
      const encrypted = encryptString(strBytes, ctx.encryptionState, ctx.objectId, ctx.generation ?? 0);
      const hex = Array.from(encrypted)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
      return '<' + hex + '>';
    }
    return '(' + escapePdfString(v) + ')';
  }
  if (v instanceof Uint8Array) {
    const hex = Array.from(v)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    return '<' + hex + '>';
  }
  if (Array.isArray(v)) {
    const parts = v.map((x) => serializeValue(x, ctx));
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
      parts.push('/' + k + ' ' + serializeValue(val, ctx));
    }
    return '<< ' + parts.join(' ') + ' >>';
  }
  return 'null';
}

// Legacy overload for backward compatibility
function serializeValueLegacy(v: unknown, refs: Map<number, PdfWriterObject>): string {
  return serializeValue(v, { refs });
}

/**
 * Serialize a dictionary to PDF representation.
 */
export function serializeDict(
  dict: Record<string, unknown>,
  refs: Map<number, PdfWriterObject>,
  encryptionState?: EncryptionState | null,
  objectId?: number,
  generation?: number
): string {
  return serializeValue(dict, { refs, encryptionState, objectId, generation });
}

/**
 * PDF writer: manages object IDs, collects objects, builds xref and trailer.
 */
export class PdfWriter {
  private nextId = 1;
  private objects: PdfWriterObject[] = [];
  private refs = new Map<number, PdfWriterObject>();
  private encryptionState: EncryptionState | null = null;
  private fileId: Uint8Array | null = null;

  /**
   * Set encryption state for the document.
   */
  setEncryption(state: EncryptionState, fileId: Uint8Array): void {
    this.encryptionState = state;
    this.fileId = fileId;
  }

  /**
   * Check if encryption is enabled.
   */
  isEncrypted(): boolean {
    return this.encryptionState !== null;
  }

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
    // Use raw pako.deflate (zlib format by default)
    // IMPORTANT: Ensure the output is Uint8Array
    const compressed = deflate(body);
    
    // We must ensure the Length is exactly the byte length of the compressed data
    const streamDict = { 
        ...dict, 
        Length: compressed.length,
        Filter: name('FlateDecode') 
    } as Record<string, unknown>;
    
    const obj: PdfWriterObject = { id, gen: 0, kind: 'stream', dict: streamDict, stream: compressed };
    this.objects.push(obj);
    this.refs.set(id, obj);
    return { id, gen: 0 };
  }

  addExtGState(opacity: number): PdfRef {
      const dict = {
          Type: name('ExtGState'),
          ca: opacity, // Non-stroking alpha (fill)
          CA: opacity  // Stroking alpha (stroke)
      };
      return this.addDict(dict);
  }

  addAxialShading(colors: { offset: number, color: [number, number, number] }[], coords: [number, number, number, number]): PdfRef {
      const functionRef = this.buildGradientFunction(colors);

      const shadingDict = {
          ShadingType: 2, // Axial
          ColorSpace: name('DeviceRGB'),
          Coords: coords, // [x0, y0, x1, y1]
          Function: functionRef,
          Extend: [true, true]
      };

      return this.addDict(shadingDict);
  }

  addRadialShading(colors: { offset: number, color: [number, number, number] }[], coords: [number, number, number, number, number, number]): PdfRef {
      const functionRef = this.buildGradientFunction(colors);

      const shadingDict = {
          ShadingType: 3, // Radial
          ColorSpace: name('DeviceRGB'),
          Coords: coords, // [x0, y0, r0, x1, y1, r1]
          Function: functionRef,
          Extend: [true, true]
      };

      return this.addDict(shadingDict);
  }

  private buildGradientFunction(colors: { offset: number, color: [number, number, number] }[]): PdfRef {
      // Sort colors by offset
      const sorted = [...colors].sort((a, b) => a.offset - b.offset);
      
      if (sorted.length === 2) {
          return this.addDict({
              FunctionType: 2,
              Domain: [0, 1],
              C0: sorted[0].color,
              C1: sorted[1].color,
              N: 1
          });
      }

      // Multiple stops: Type 3 Stitching Function
      const functions: PdfRef[] = [];
      const bounds: number[] = [];
      const encode: number[] = [];

      for (let i = 0; i < sorted.length - 1; i++) {
          functions.push(this.addDict({
              FunctionType: 2,
              Domain: [0, 1],
              C0: sorted[i].color,
              C1: sorted[i+1].color,
              N: 1
          }));

          if (i > 0) {
              bounds.push(sorted[i].offset);
          }
          encode.push(0, 1);
      }

      return this.addDict({
          FunctionType: 3,
          Domain: [0, 1],
          Functions: functions,
          Bounds: bounds,
          Encode: encode
      });
  }

  addImageXObject(data: Uint8Array, type: 'jpeg' | 'png', width: number, height: number, options: { smask?: PdfRef } = {}): PdfRef {
      const dict: Record<string, unknown> = {
          Type: name('XObject'),
          Subtype: name('Image'),
          Width: width,
          Height: height,
          BitsPerComponent: 8,
          ColorSpace: name('DeviceRGB'),
      };

      if (options.smask) {
          dict.SMask = options.smask;
      }

      let streamData = data;
      if (type === 'jpeg') {
          dict.Filter = name('DCTDecode');
      } else if (type === 'png') {
          dict.Filter = name('FlateDecode');
          // PNGs are handled by decompressing/splitting in document.ts, 
          // then passed here as raw pixel data (deflated again or left raw).
          // We'll use deflated data for PNG.
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
    // Add binary marker for binary-safe PDF
    push(new Uint8Array([0x25, 0xE2, 0xE3, 0xCF, 0xD3, 0x0D, 0x0A])); // %âãÏÓ\r\n

    // If encryption is enabled, add the encryption dictionary object
    let encryptRef: PdfRef | null = null;
    if (this.encryptionState) {
      const encryptDict = buildEncryptDict(this.encryptionState);
      encryptRef = this.addDict(encryptDict);
      // Mark this as the encrypt dict so we don't encrypt it
      this.encryptionState.encryptDictRef = encryptRef;
    }

    const xrefOffsets: number[] = []; // index 0 unused; index i = object id

    for (const obj of this.objects) {
      xrefOffsets[obj.id] = currentOffset;

      // Don't encrypt the encryption dictionary itself
      const isEncryptDict = encryptRef && obj.id === encryptRef.id;
      const shouldEncrypt = this.encryptionState && !isEncryptDict;

      push(`${obj.id} ${obj.gen} obj\r\n`);
      if (obj.kind === 'dict') {
        push(serializeDict(
          obj.dict!,
          this.refs,
          shouldEncrypt ? this.encryptionState : null,
          obj.id,
          obj.gen
        ) + '\r\n');
      } else {
        // Stream object
        let streamData = obj.stream!;

        // Encrypt stream data if encryption is enabled
        if (shouldEncrypt && this.encryptionState) {
          streamData = encryptStream(streamData, this.encryptionState, obj.id, obj.gen);

          // Update the Length in the dict
          const updatedDict = { ...obj.dict!, Length: streamData.length };

          // For AES encryption, the stream needs the Crypt filter info
          // But typically we keep FlateDecode and the decryption happens first
          push(serializeDict(
            updatedDict,
            this.refs,
            this.encryptionState,
            obj.id,
            obj.gen
          ) + '\r\n');
        } else {
          push(serializeDict(obj.dict!, this.refs, null, obj.id, obj.gen) + '\r\n');
        }

        push('stream\r\n');
        push(streamData);
        push('\r\nendstream\r\n');
      }
      push('endobj\r\n');
    }

    const size = this.nextId;
    const xrefStart = currentOffset;

    push('xref\r\n');
    push(`0 ${size}\r\n`);
    push('0000000000 65535 f\r\n');
    for (let i = 1; i < this.nextId; i++) {
      const off = xrefOffsets[i] ?? 0;
      push(off.toString().padStart(10, '0') + ' 00000 n\r\n');
    }

    const catalog = this.objects.find(o => o.dict?.Type && (o.dict.Type as any).__pdfName === 'Catalog');
    const info = this.objects.find(o => o.dict?.Producer === 'kurd-pdflib');
    const rootId = catalog ? catalog.id : 1;
    const infoId = info ? info.id : 2;

    // Build trailer dictionary
    let trailerParts = `/Size ${size} /Root ${rootId} 0 R /Info ${infoId} 0 R`;

    // Add encryption reference if encrypted
    if (encryptRef) {
      trailerParts += ` /Encrypt ${encryptRef.id} ${encryptRef.gen} R`;
    }

    // Add file ID (required for encryption, recommended otherwise)
    if (this.fileId) {
      const idHex = Array.from(this.fileId)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
      trailerParts += ` /ID [<${idHex}> <${idHex}>]`;
    }

    push('trailer\r\n');
    push(`<< ${trailerParts} >>\r\n`);
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
