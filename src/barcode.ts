/**
 * Barcode Generator - Generates Code128 barcodes
 */

// Code128 encoding patterns (bars and spaces)
// Each pattern is 11 modules wide (6 bars + 5 spaces, or vice versa)
const CODE128_PATTERNS: string[] = [
    '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213',
    '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132',
    '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211',
    '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
    '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331',
    '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111',
    '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214',
    '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
    '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
    '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141',
    '114131', '311141', '411131', '211412', '211214', '211232', '2331112' // Last is STOP pattern
];

// Code128 character sets
const CODE128_A = ' !"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_\x00\x01\x02\x03\x04\x05\x06\x07\x08\x09\x0a\x0b\x0c\x0d\x0e\x0f\x10\x11\x12\x13\x14\x15\x16\x17\x18\x19\x1a\x1b\x1c\x1d\x1e\x1f';
const CODE128_B = ' !"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~\x7f';

const START_A = 103;
const START_B = 104;
const START_C = 105;
const STOP = 106;

export interface BarcodeResult {
    /** Array of bar widths (alternating black/white, starting with black) */
    bars: number[];
    /** Total width in modules */
    width: number;
    /** The encoded text */
    text: string;
}

/**
 * Generate a Code128 barcode
 */
export function generateCode128(text: string): BarcodeResult {
    if (!text) throw new Error('Barcode text cannot be empty');

    // Determine best starting code set
    const useCodeC = /^\d{4,}$/.test(text) && text.length % 2 === 0;
    const useCodeA = !useCodeC && /[\x00-\x1f]/.test(text);

    const values: number[] = [];
    let checksum: number;

    if (useCodeC) {
        // Code C: pairs of digits
        values.push(START_C);
        checksum = START_C;
        for (let i = 0; i < text.length; i += 2) {
            const val = parseInt(text.slice(i, i + 2), 10);
            values.push(val);
            checksum += val * (values.length - 1);
        }
    } else if (useCodeA) {
        // Code A: includes control characters
        values.push(START_A);
        checksum = START_A;
        for (let i = 0; i < text.length; i++) {
            const idx = CODE128_A.indexOf(text[i]);
            if (idx === -1) throw new Error(`Character '${text[i]}' not supported in Code128-A`);
            values.push(idx);
            checksum += idx * (values.length - 1);
        }
    } else {
        // Code B: standard ASCII
        values.push(START_B);
        checksum = START_B;
        for (let i = 0; i < text.length; i++) {
            const idx = CODE128_B.indexOf(text[i]);
            if (idx === -1) throw new Error(`Character '${text[i]}' not supported in Code128-B`);
            values.push(idx);
            checksum += idx * (values.length - 1);
        }
    }

    // Add checksum and stop
    values.push(checksum % 103);
    values.push(STOP);

    // Convert to bar widths
    const bars: number[] = [];
    for (const val of values) {
        const pattern = CODE128_PATTERNS[val];
        for (const char of pattern) {
            bars.push(parseInt(char, 10));
        }
    }

    // Calculate total width
    const width = bars.reduce((sum, w) => sum + w, 0);

    return { bars, width, text };
}

/**
 * Generate an EAN-13 barcode (used for retail products)
 */
export function generateEAN13(digits: string): BarcodeResult {
    if (!/^\d{12,13}$/.test(digits)) {
        throw new Error('EAN-13 requires 12 or 13 digits');
    }

    // Calculate check digit if only 12 digits provided
    if (digits.length === 12) {
        let sum = 0;
        for (let i = 0; i < 12; i++) {
            sum += parseInt(digits[i], 10) * (i % 2 === 0 ? 1 : 3);
        }
        digits += ((10 - (sum % 10)) % 10).toString();
    }

    // EAN-13 encoding patterns
    const L_PATTERNS = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011'];
    const G_PATTERNS = ['0100111', '0110011', '0011011', '0100001', '0011101', '0111001', '0000101', '0010001', '0001001', '0010111'];
    const R_PATTERNS = ['1110010', '1100110', '1101100', '1000010', '1011100', '1001110', '1010000', '1000100', '1001000', '1110100'];
    const PARITY_PATTERNS = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL'];

    const firstDigit = parseInt(digits[0], 10);
    const parity = PARITY_PATTERNS[firstDigit];

    // Build barcode
    let binary = '101'; // Start guard

    // Left side (digits 2-7)
    for (let i = 1; i <= 6; i++) {
        const digit = parseInt(digits[i], 10);
        binary += parity[i - 1] === 'L' ? L_PATTERNS[digit] : G_PATTERNS[digit];
    }

    binary += '01010'; // Center guard

    // Right side (digits 8-13)
    for (let i = 7; i <= 12; i++) {
        const digit = parseInt(digits[i], 10);
        binary += R_PATTERNS[digit];
    }

    binary += '101'; // End guard

    // Convert binary to bar widths
    const bars: number[] = [];
    let currentWidth = 0;
    let currentChar = binary[0];

    for (const char of binary) {
        if (char === currentChar) {
            currentWidth++;
        } else {
            bars.push(currentWidth);
            currentWidth = 1;
            currentChar = char;
        }
    }
    bars.push(currentWidth);

    return { bars, width: binary.length, text: digits };
}
