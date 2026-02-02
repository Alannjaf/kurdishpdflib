/**
 * QR Code Generator - Generates QR codes from scratch
 * Implements QR Code Model 2, Version 1-10, Error Correction Level L/M/Q/H
 */

// QR Code constants
const NUMERIC_CHARS = '0123456789';
const ALPHANUMERIC_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:';

// Mode indicators
const MODE_NUMERIC = 0b0001;
const MODE_ALPHANUMERIC = 0b0010;
const MODE_BYTE = 0b0100;

// Error correction levels
export type ErrorCorrectionLevel = 'L' | 'M' | 'Q' | 'H';

const EC_LEVEL_BITS: Record<ErrorCorrectionLevel, number> = {
    'L': 0b01,
    'M': 0b00,
    'Q': 0b11,
    'H': 0b10
};

// Capacity table: [version][ecLevel] = max data codewords
const DATA_CODEWORDS: number[][] = [
    [], // version 0 doesn't exist
    [19, 16, 13, 9],     // version 1
    [34, 28, 22, 16],    // version 2
    [55, 44, 34, 26],    // version 3
    [80, 64, 48, 36],    // version 4
    [108, 86, 62, 46],   // version 5
    [136, 108, 76, 60],  // version 6
    [156, 124, 88, 66],  // version 7
    [194, 154, 110, 86], // version 8
    [232, 182, 132, 100],// version 9
    [274, 216, 154, 122],// version 10
];

// Number of error correction codewords per block
const EC_CODEWORDS_PER_BLOCK: number[][] = [
    [],
    [7, 10, 13, 17],     // version 1
    [10, 16, 22, 28],    // version 2
    [15, 26, 18, 22],    // version 3
    [20, 18, 26, 16],    // version 4
    [26, 24, 18, 22],    // version 5
    [18, 16, 24, 28],    // version 6
    [20, 18, 18, 26],    // version 7
    [24, 22, 22, 26],    // version 8
    [30, 22, 20, 24],    // version 9
    [18, 26, 24, 28],    // version 10
];

// Number of blocks for each version and EC level
const NUM_BLOCKS: number[][] = [
    [],
    [1, 1, 1, 1],
    [1, 1, 1, 1],
    [1, 1, 2, 2],
    [1, 2, 2, 4],
    [1, 2, 4, 4],
    [2, 4, 4, 4],
    [2, 4, 6, 5],
    [2, 4, 6, 6],
    [2, 5, 8, 8],
    [4, 5, 8, 8],
];

const EC_LEVEL_INDEX: Record<ErrorCorrectionLevel, number> = { 'L': 0, 'M': 1, 'Q': 2, 'H': 3 };

// Alignment pattern positions for each version
const ALIGNMENT_PATTERNS: number[][] = [
    [],
    [],           // version 1 has no alignment patterns
    [6, 18],
    [6, 22],
    [6, 26],
    [6, 30],
    [6, 34],
    [6, 22, 38],
    [6, 24, 42],
    [6, 26, 46],
    [6, 28, 50],
];

// Format information strings (pre-computed for each EC level and mask)
const FORMAT_INFO: Record<string, number> = {
    'L0': 0x77c4, 'L1': 0x72f3, 'L2': 0x7daa, 'L3': 0x789d, 'L4': 0x662f, 'L5': 0x6318, 'L6': 0x6c41, 'L7': 0x6976,
    'M0': 0x5412, 'M1': 0x5125, 'M2': 0x5e7c, 'M3': 0x5b4b, 'M4': 0x45f9, 'M5': 0x40ce, 'M6': 0x4f97, 'M7': 0x4aa0,
    'Q0': 0x355f, 'Q1': 0x3068, 'Q2': 0x3f31, 'Q3': 0x3a06, 'Q4': 0x24b4, 'Q5': 0x2183, 'Q6': 0x2eda, 'Q7': 0x2bed,
    'H0': 0x1689, 'H1': 0x13be, 'H2': 0x1ce7, 'H3': 0x19d0, 'H4': 0x0762, 'H5': 0x0255, 'H6': 0x0d0c, 'H7': 0x083b,
};

// Galois Field math for Reed-Solomon encoding
const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);

// Initialize Galois Field tables
(function initGF() {
    let x = 1;
    for (let i = 0; i < 255; i++) {
        GF_EXP[i] = x;
        GF_LOG[x] = i;
        x <<= 1;
        if (x & 0x100) x ^= 0x11d;
    }
    for (let i = 255; i < 512; i++) {
        GF_EXP[i] = GF_EXP[i - 255];
    }
})();

function gfMul(a: number, b: number): number {
    if (a === 0 || b === 0) return 0;
    return GF_EXP[GF_LOG[a] + GF_LOG[b]];
}

function gfPow(x: number, power: number): number {
    return GF_EXP[(GF_LOG[x] * power) % 255];
}

function gfPolyMul(p1: number[], p2: number[]): number[] {
    const result = new Array(p1.length + p2.length - 1).fill(0);
    for (let i = 0; i < p1.length; i++) {
        for (let j = 0; j < p2.length; j++) {
            result[i + j] ^= gfMul(p1[i], p2[j]);
        }
    }
    return result;
}

function generateGeneratorPolynomial(numEcCodewords: number): number[] {
    let g = [1];
    for (let i = 0; i < numEcCodewords; i++) {
        g = gfPolyMul(g, [1, gfPow(2, i)]);
    }
    return g;
}

function computeEcc(data: number[], numEcCodewords: number): number[] {
    const generator = generateGeneratorPolynomial(numEcCodewords);
    const paddedData = [...data, ...new Array(numEcCodewords).fill(0)];

    for (let i = 0; i < data.length; i++) {
        const coef = paddedData[i];
        if (coef !== 0) {
            for (let j = 0; j < generator.length; j++) {
                paddedData[i + j] ^= gfMul(generator[j], coef);
            }
        }
    }

    return paddedData.slice(data.length);
}

function getMode(text: string): number {
    if (/^\d+$/.test(text)) return MODE_NUMERIC;
    if (/^[0-9A-Z $%*+\-./:]+$/.test(text)) return MODE_ALPHANUMERIC;
    return MODE_BYTE;
}

function getCharCountBits(version: number, mode: number): number {
    if (version <= 9) {
        if (mode === MODE_NUMERIC) return 10;
        if (mode === MODE_ALPHANUMERIC) return 9;
        return 8;
    }
    if (mode === MODE_NUMERIC) return 12;
    if (mode === MODE_ALPHANUMERIC) return 11;
    return 16;
}

function encodeData(text: string, version: number): number[] {
    const bits: number[] = [];
    const mode = getMode(text);

    // Mode indicator (4 bits)
    for (let i = 3; i >= 0; i--) bits.push((mode >> i) & 1);

    // Character count
    const charCountBits = getCharCountBits(version, mode);
    const charCount = mode === MODE_BYTE ? new TextEncoder().encode(text).length : text.length;
    for (let i = charCountBits - 1; i >= 0; i--) bits.push((charCount >> i) & 1);

    // Data
    if (mode === MODE_NUMERIC) {
        for (let i = 0; i < text.length; i += 3) {
            const group = text.slice(i, i + 3);
            const val = parseInt(group, 10);
            const numBits = group.length === 3 ? 10 : group.length === 2 ? 7 : 4;
            for (let j = numBits - 1; j >= 0; j--) bits.push((val >> j) & 1);
        }
    } else if (mode === MODE_ALPHANUMERIC) {
        for (let i = 0; i < text.length; i += 2) {
            if (i + 1 < text.length) {
                const val = ALPHANUMERIC_CHARS.indexOf(text[i]) * 45 + ALPHANUMERIC_CHARS.indexOf(text[i + 1]);
                for (let j = 10; j >= 0; j--) bits.push((val >> j) & 1);
            } else {
                const val = ALPHANUMERIC_CHARS.indexOf(text[i]);
                for (let j = 5; j >= 0; j--) bits.push((val >> j) & 1);
            }
        }
    } else {
        const bytes = new TextEncoder().encode(text);
        for (const byte of bytes) {
            for (let i = 7; i >= 0; i--) bits.push((byte >> i) & 1);
        }
    }

    return bits;
}

function selectVersion(text: string, ecLevel: ErrorCorrectionLevel): number {
    const mode = getMode(text);
    const dataLen = mode === MODE_BYTE ? new TextEncoder().encode(text).length : text.length;
    const ecIdx = EC_LEVEL_INDEX[ecLevel];

    for (let version = 1; version <= 10; version++) {
        const dataCodewords = DATA_CODEWORDS[version][ecIdx];
        const charCountBits = getCharCountBits(version, mode);

        // Calculate bits needed
        let bitsNeeded = 4 + charCountBits;
        if (mode === MODE_NUMERIC) {
            bitsNeeded += Math.floor(dataLen / 3) * 10 + [0, 4, 7][dataLen % 3];
        } else if (mode === MODE_ALPHANUMERIC) {
            bitsNeeded += Math.floor(dataLen / 2) * 11 + (dataLen % 2) * 6;
        } else {
            bitsNeeded += dataLen * 8;
        }

        if (bitsNeeded <= dataCodewords * 8) return version;
    }
    throw new Error('Data too long for QR code');
}

function createMatrix(version: number): (boolean | null)[][] {
    const size = version * 4 + 17;
    return Array.from({ length: size }, () => Array(size).fill(null));
}

function addFinderPattern(matrix: (boolean | null)[][], row: number, col: number): void {
    for (let r = -1; r <= 7; r++) {
        for (let c = -1; c <= 7; c++) {
            const rr = row + r, cc = col + c;
            if (rr < 0 || rr >= matrix.length || cc < 0 || cc >= matrix.length) continue;

            const isBlack = (r >= 0 && r <= 6 && (c === 0 || c === 6)) ||
                           (c >= 0 && c <= 6 && (r === 0 || r === 6)) ||
                           (r >= 2 && r <= 4 && c >= 2 && c <= 4);
            matrix[rr][cc] = isBlack;
        }
    }
}

function addAlignmentPattern(matrix: (boolean | null)[][], row: number, col: number): void {
    for (let r = -2; r <= 2; r++) {
        for (let c = -2; c <= 2; c++) {
            const isBlack = Math.max(Math.abs(r), Math.abs(c)) !== 1;
            matrix[row + r][col + c] = isBlack;
        }
    }
}

function addTimingPatterns(matrix: (boolean | null)[][]): void {
    const size = matrix.length;
    for (let i = 8; i < size - 8; i++) {
        const isBlack = i % 2 === 0;
        if (matrix[6][i] === null) matrix[6][i] = isBlack;
        if (matrix[i][6] === null) matrix[i][6] = isBlack;
    }
}

function addFormatInfo(matrix: (boolean | null)[][], ecLevel: ErrorCorrectionLevel, mask: number): void {
    const formatBits = FORMAT_INFO[`${ecLevel}${mask}`];
    const size = matrix.length;

    // Around top-left finder
    for (let i = 0; i <= 5; i++) matrix[8][i] = !!(formatBits & (1 << (14 - i)));
    matrix[8][7] = !!(formatBits & (1 << 8));
    matrix[8][8] = !!(formatBits & (1 << 7));
    matrix[7][8] = !!(formatBits & (1 << 6));
    for (let i = 0; i <= 5; i++) matrix[5 - i][8] = !!(formatBits & (1 << (5 - i)));

    // Around bottom-left and top-right
    for (let i = 0; i <= 6; i++) matrix[size - 1 - i][8] = !!(formatBits & (1 << i));
    for (let i = 0; i <= 7; i++) matrix[8][size - 8 + i] = !!(formatBits & (1 << (14 - i)));

    // Dark module
    matrix[size - 8][8] = true;
}

function getMaskFunction(mask: number): (row: number, col: number) => boolean {
    switch (mask) {
        case 0: return (r, c) => (r + c) % 2 === 0;
        case 1: return (r) => r % 2 === 0;
        case 2: return (_, c) => c % 3 === 0;
        case 3: return (r, c) => (r + c) % 3 === 0;
        case 4: return (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0;
        case 5: return (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0;
        case 6: return (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0;
        case 7: return (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0;
        default: return () => false;
    }
}

function placeData(matrix: (boolean | null)[][], data: number[], mask: number): void {
    const size = matrix.length;
    const maskFn = getMaskFunction(mask);
    let bitIdx = 0;
    let upward = true;

    for (let col = size - 1; col >= 0; col -= 2) {
        if (col === 6) col = 5; // Skip timing column

        const rows = upward ? Array.from({ length: size }, (_, i) => size - 1 - i) : Array.from({ length: size }, (_, i) => i);

        for (const row of rows) {
            for (const c of [col, col - 1]) {
                if (matrix[row][c] === null) {
                    let bit = bitIdx < data.length ? data[bitIdx] : 0;
                    if (maskFn(row, c)) bit ^= 1;
                    matrix[row][c] = !!bit;
                    bitIdx++;
                }
            }
        }
        upward = !upward;
    }
}

function evaluatePenalty(matrix: boolean[][]): number {
    const size = matrix.length;
    let penalty = 0;

    // Rule 1: Consecutive same-color modules in row/column
    for (let r = 0; r < size; r++) {
        let runColor = matrix[r][0];
        let runLength = 1;
        for (let c = 1; c < size; c++) {
            if (matrix[r][c] === runColor) {
                runLength++;
            } else {
                if (runLength >= 5) penalty += runLength - 2;
                runColor = matrix[r][c];
                runLength = 1;
            }
        }
        if (runLength >= 5) penalty += runLength - 2;
    }

    for (let c = 0; c < size; c++) {
        let runColor = matrix[0][c];
        let runLength = 1;
        for (let r = 1; r < size; r++) {
            if (matrix[r][c] === runColor) {
                runLength++;
            } else {
                if (runLength >= 5) penalty += runLength - 2;
                runColor = matrix[r][c];
                runLength = 1;
            }
        }
        if (runLength >= 5) penalty += runLength - 2;
    }

    // Rule 2: 2x2 blocks of same color
    for (let r = 0; r < size - 1; r++) {
        for (let c = 0; c < size - 1; c++) {
            const color = matrix[r][c];
            if (matrix[r][c + 1] === color && matrix[r + 1][c] === color && matrix[r + 1][c + 1] === color) {
                penalty += 3;
            }
        }
    }

    return penalty;
}

export interface QRCodeOptions {
    /** Error correction level: L (7%), M (15%), Q (25%), H (30%) */
    errorCorrection?: ErrorCorrectionLevel;
}

export interface QRCodeResult {
    /** 2D matrix of modules (true = black, false = white) */
    matrix: boolean[][];
    /** Size of the QR code (modules per side) */
    size: number;
    /** QR code version used */
    version: number;
}

/**
 * Generate a QR code matrix from text
 */
export function generateQRCode(text: string, options: QRCodeOptions = {}): QRCodeResult {
    const ecLevel = options.errorCorrection || 'M';
    const version = selectVersion(text, ecLevel);
    const size = version * 4 + 17;
    const ecIdx = EC_LEVEL_INDEX[ecLevel];

    // Encode data
    let bits = encodeData(text, version);

    // Add terminator
    const dataCodewords = DATA_CODEWORDS[version][ecIdx];
    const totalBits = dataCodewords * 8;
    const terminatorLength = Math.min(4, totalBits - bits.length);
    for (let i = 0; i < terminatorLength; i++) bits.push(0);

    // Pad to byte boundary
    while (bits.length % 8 !== 0) bits.push(0);

    // Convert to bytes
    const dataBytes: number[] = [];
    for (let i = 0; i < bits.length; i += 8) {
        let byte = 0;
        for (let j = 0; j < 8; j++) byte = (byte << 1) | (bits[i + j] || 0);
        dataBytes.push(byte);
    }

    // Pad with alternating bytes
    const padBytes = [0xec, 0x11];
    let padIdx = 0;
    while (dataBytes.length < dataCodewords) {
        dataBytes.push(padBytes[padIdx]);
        padIdx = (padIdx + 1) % 2;
    }

    // Generate error correction
    const numBlocks = NUM_BLOCKS[version][ecIdx];
    const ecCodewordsPerBlock = EC_CODEWORDS_PER_BLOCK[version][ecIdx];
    const dataCodewordsPerBlock = Math.floor(dataCodewords / numBlocks);

    const blocks: number[][] = [];
    const ecBlocks: number[][] = [];
    let offset = 0;

    for (let i = 0; i < numBlocks; i++) {
        const blockSize = dataCodewordsPerBlock + (i >= numBlocks - (dataCodewords % numBlocks) ? 1 : 0);
        const blockData = dataBytes.slice(offset, offset + blockSize);
        blocks.push(blockData);
        ecBlocks.push(computeEcc(blockData, ecCodewordsPerBlock));
        offset += blockSize;
    }

    // Interleave data and EC codewords
    const finalData: number[] = [];
    const maxBlockLen = Math.max(...blocks.map(b => b.length));
    for (let i = 0; i < maxBlockLen; i++) {
        for (const block of blocks) {
            if (i < block.length) finalData.push(block[i]);
        }
    }
    for (let i = 0; i < ecCodewordsPerBlock; i++) {
        for (const ecBlock of ecBlocks) {
            finalData.push(ecBlock[i]);
        }
    }

    // Convert to bits
    const finalBits: number[] = [];
    for (const byte of finalData) {
        for (let i = 7; i >= 0; i--) finalBits.push((byte >> i) & 1);
    }

    // Try all masks and select best one
    let bestMatrix: boolean[][] | null = null;
    let bestPenalty = Infinity;
    let bestMask = 0;

    for (let mask = 0; mask < 8; mask++) {
        const matrix = createMatrix(version);

        // Add function patterns
        addFinderPattern(matrix, 0, 0);
        addFinderPattern(matrix, 0, size - 7);
        addFinderPattern(matrix, size - 7, 0);
        addTimingPatterns(matrix);

        // Add alignment patterns
        if (version >= 2) {
            const positions = ALIGNMENT_PATTERNS[version];
            for (const r of positions) {
                for (const c of positions) {
                    if (matrix[r][c] === null) {
                        addAlignmentPattern(matrix, r, c);
                    }
                }
            }
        }

        // Reserve format info areas
        addFormatInfo(matrix, ecLevel, mask);

        // Place data
        placeData(matrix, finalBits, mask);

        // Evaluate penalty
        const boolMatrix = matrix.map(row => row.map(cell => !!cell));
        const penalty = evaluatePenalty(boolMatrix);

        if (penalty < bestPenalty) {
            bestPenalty = penalty;
            bestMatrix = boolMatrix;
            bestMask = mask;
        }
    }

    return {
        matrix: bestMatrix!,
        size,
        version
    };
}
