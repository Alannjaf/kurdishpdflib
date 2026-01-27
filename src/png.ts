import { inflateSync, deflateSync } from 'node:zlib';

export interface PNGData {
    width: number;
    height: number;
    bits: number;
    colorType: number;
    pixelData: Uint8Array;
    alphaData?: Uint8Array;
}

export function parsePNG(data: Uint8Array): PNGData {
    // Check signature
    if (data[0] !== 0x89 || data[1] !== 0x50 || data[2] !== 0x4E || data[3] !== 0x47) {
        throw new Error("Not a valid PNG file");
    }

    let pos = 8;
    let width = 0, height = 0, bits = 0, colorType = 0;
    const idatChunks: Uint8Array[] = [];

    while (pos < data.length) {
        const length = (data[pos] << 24) | (data[pos + 1] << 16) | (data[pos + 2] << 8) | data[pos + 3];
        const type = String.fromCharCode(data[pos + 4], data[pos + 5], data[pos + 6], data[pos + 7]);
        const chunkData = data.slice(pos + 8, pos + 8 + length);

        if (type === 'IHDR') {
            width = (chunkData[0] << 24) | (chunkData[1] << 16) | (chunkData[2] << 8) | chunkData[3];
            height = (chunkData[4] << 24) | (chunkData[5] << 16) | (chunkData[6] << 8) | chunkData[7];
            bits = chunkData[8];
            colorType = chunkData[9];
        } else if (type === 'IDAT') {
            idatChunks.push(chunkData);
        } else if (type === 'IEND') {
            break;
        }

        pos += length + 12; // length + type + data + crc
    }

    // Concatenate IDAT and inflate
    const totalIdatLength = idatChunks.reduce((acc, c) => acc + c.length, 0);
    const combinedIdat = new Uint8Array(totalIdatLength);
    let offset = 0;
    for (const chunk of idatChunks) {
        combinedIdat.set(chunk, offset);
        offset += chunk.length;
    }

    const decompressed = inflateSync(combinedIdat);
    
    // Handle unfiltering
    const bpp = getBpp(colorType, bits);
    const rowSize = Math.ceil(width * bits * getChannels(colorType) / 8);
    const unfiltered = unfilter(decompressed, width, height, bpp, rowSize);

    // Split Alpha if present (ColorType 6 = RGBA)
    if (colorType === 6) {
        const rgb = new Uint8Array(width * height * 3);
        const alpha = new Uint8Array(width * height);
        for (let i = 0; i < width * height; i++) {
            rgb[i * 3] = unfiltered[i * 4];
            rgb[i * 3 + 1] = unfiltered[i * 4 + 1];
            rgb[i * 3 + 2] = unfiltered[i * 4 + 2];
            alpha[i] = unfiltered[i * 4 + 3];
        }
        return { width, height, bits, colorType, pixelData: rgb, alphaData: alpha };
    }

    return { width, height, bits, colorType, pixelData: unfiltered };
}

function getChannels(colorType: number): number {
    if (colorType === 0) return 1; // Gray
    if (colorType === 2) return 3; // RGB
    if (colorType === 3) return 1; // Palette
    if (colorType === 4) return 2; // Gray + Alpha
    if (colorType === 6) return 4; // RGBA
    return 1;
}

function getBpp(colorType: number, bits: number): number {
    return Math.max(1, getChannels(colorType) * bits / 8);
}

function unfilter(data: Uint8Array, width: number, height: number, bpp: number, rowSize: number): Uint8Array {
    const out = new Uint8Array(width * height * (bpp < 1 ? 1 : bpp)); // Simplified
    let inPos = 0;
    let outPos = 0;

    const currentrow = new Uint8Array(rowSize);
    const lastrow = new Uint8Array(rowSize);

    for (let y = 0; y < height; y++) {
        const filter = data[inPos++];
        for (let x = 0; x < rowSize; x++) {
            const byte = data[inPos++];
            let left = x >= bpp ? currentrow[x - bpp] : 0;
            let up = lastrow[x];
            let upleft = x >= bpp ? lastrow[x - bpp] : 0;

            if (filter === 0) currentrow[x] = byte;
            else if (filter === 1) currentrow[x] = (byte + left) & 0xFF;
            else if (filter === 2) currentrow[x] = (byte + up) & 0xFF;
            else if (filter === 3) currentrow[x] = (byte + Math.floor((left + up) / 2)) & 0xFF;
            else if (filter === 4) {
                const p = left + up - upleft;
                const pa = Math.abs(p - left);
                const pb = Math.abs(p - up);
                const pc = Math.abs(p - upleft);
                let res = 0;
                if (pa <= pb && pa <= pc) res = left;
                else if (pb <= pc) res = up;
                else res = upleft;
                currentrow[x] = (byte + res) & 0xFF;
            }
        }
        out.set(currentrow, outPos);
        outPos += rowSize;
        lastrow.set(currentrow);
    }
    return out;
}
