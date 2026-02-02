/**
 * PDF Encryption Module
 *
 * Implements PDF encryption standards:
 * - RC4 128-bit (PDF 1.4+, Revision 3)
 * - AES-128 CBC (PDF 1.5+, Revision 4)
 *
 * Supports user/owner passwords and document permissions.
 */

import { createHash, createCipheriv, randomBytes } from 'crypto';

/** PDF Permissions flags (32-bit integer, bits 3-6 and 9-12 are meaningful) */
export interface PDFPermissions {
    /** Allow printing (low-quality if highQualityPrint is false) */
    print?: boolean;
    /** Allow modification of the document */
    modify?: boolean;
    /** Allow copying text and graphics */
    copy?: boolean;
    /** Allow adding annotations and form fields */
    annotate?: boolean;
    /** Allow form field fill-in (even if annotate is false) */
    fillForms?: boolean;
    /** Allow text extraction for accessibility */
    extractForAccessibility?: boolean;
    /** Allow document assembly (insert, rotate, delete pages) */
    assemble?: boolean;
    /** Allow high-quality printing */
    highQualityPrint?: boolean;
}

export interface EncryptionOptions {
    /** User password (required to open the document) - empty string means no password needed to open */
    userPassword?: string;
    /** Owner password (required for full access) - if not set, uses userPassword */
    ownerPassword?: string;
    /** Document permissions */
    permissions?: PDFPermissions;
    /** Encryption algorithm: 'rc4' (128-bit) or 'aes' (128-bit) */
    algorithm?: 'rc4' | 'aes';
}

export interface EncryptionState {
    /** The /Encrypt dictionary reference */
    encryptDictRef?: { id: number; gen: number };
    /** Encryption key for RC4/AES */
    encryptionKey: Uint8Array;
    /** Owner key (O value) */
    ownerKey: Uint8Array;
    /** User key (U value) */
    userKey: Uint8Array;
    /** Permissions integer (P value) */
    permissionsValue: number;
    /** Algorithm being used */
    algorithm: 'rc4' | 'aes';
    /** Key length in bits */
    keyLength: number;
    /** PDF encryption revision */
    revision: number;
    /** PDF encryption version */
    version: number;
}

/** Standard padding for PDF encryption (32 bytes) */
const PDF_PADDING = new Uint8Array([
    0x28, 0xBF, 0x4E, 0x5E, 0x4D, 0x75, 0x8A, 0x41,
    0x64, 0x00, 0x4E, 0x56, 0xFF, 0xFA, 0x01, 0x08,
    0x2E, 0x2E, 0x00, 0xB6, 0xD0, 0x68, 0x3E, 0x80,
    0x2F, 0x0C, 0xA9, 0xFE, 0x64, 0x53, 0x69, 0x7A
]);

/**
 * Pad or truncate password to 32 bytes using PDF standard padding.
 */
function padPassword(password: string): Uint8Array {
    const pwBytes = new TextEncoder().encode(password);
    const padded = new Uint8Array(32);

    const copyLen = Math.min(pwBytes.length, 32);
    padded.set(pwBytes.subarray(0, copyLen), 0);

    if (copyLen < 32) {
        padded.set(PDF_PADDING.subarray(0, 32 - copyLen), copyLen);
    }

    return padded;
}

/**
 * Compute MD5 hash.
 */
function md5(data: Uint8Array): Uint8Array {
    const hash = createHash('md5');
    hash.update(data);
    return new Uint8Array(hash.digest());
}

/**
 * Compute permissions integer from PDFPermissions object.
 * Bits are set according to PDF spec Table 22.
 */
function computePermissions(perms: PDFPermissions): number {
    // Start with all bits that must be 1 (bits 1-2, 7-8, 13-32)
    let P = 0xFFFFF0C0; // All high bits set, bits 7-8 set

    // Clear bits 1-2 (must be 0 in rev 3+)
    P &= ~0x3;

    // Set permission bits (bits 3-6, 9-12)
    if (perms.print) P |= (1 << 2);                    // bit 3
    if (perms.modify) P |= (1 << 3);                   // bit 4
    if (perms.copy) P |= (1 << 4);                     // bit 5
    if (perms.annotate) P |= (1 << 5);                 // bit 6
    if (perms.fillForms) P |= (1 << 8);                // bit 9
    if (perms.extractForAccessibility) P |= (1 << 9); // bit 10
    if (perms.assemble) P |= (1 << 10);                // bit 11
    if (perms.highQualityPrint) P |= (1 << 11);        // bit 12

    // Return as signed 32-bit integer
    return P | 0;
}

/**
 * RC4 encryption/decryption (symmetric).
 */
function rc4(key: Uint8Array, data: Uint8Array): Uint8Array {
    // Key-scheduling algorithm (KSA)
    const S = new Uint8Array(256);
    for (let i = 0; i < 256; i++) S[i] = i;

    let j = 0;
    for (let i = 0; i < 256; i++) {
        j = (j + S[i] + key[i % key.length]) & 0xFF;
        [S[i], S[j]] = [S[j], S[i]];
    }

    // Pseudo-random generation algorithm (PRGA)
    const output = new Uint8Array(data.length);
    let i = 0;
    j = 0;

    for (let k = 0; k < data.length; k++) {
        i = (i + 1) & 0xFF;
        j = (j + S[i]) & 0xFF;
        [S[i], S[j]] = [S[j], S[i]];
        output[k] = data[k] ^ S[(S[i] + S[j]) & 0xFF];
    }

    return output;
}

/**
 * Compute the Owner key (O value) for the encryption dictionary.
 * Algorithm 3 from PDF Reference.
 */
function computeOwnerKey(ownerPassword: string, userPassword: string, keyLength: number): Uint8Array {
    // Step 1: Pad owner password
    const ownerPadded = padPassword(ownerPassword || userPassword);

    // Step 2: MD5 hash
    let hash = md5(ownerPadded);

    // Step 3: For revision 3+, do 50 iterations
    const keyBytes = keyLength / 8;
    for (let i = 0; i < 50; i++) {
        hash = md5(hash.subarray(0, keyBytes));
    }

    // Step 4: Use first n bytes as RC4 key
    const rc4Key = hash.subarray(0, keyBytes);

    // Step 5: Pad user password
    const userPadded = padPassword(userPassword);

    // Step 6: Encrypt with RC4
    let encrypted = rc4(rc4Key, userPadded);

    // Step 7: For revision 3+, do 19 more iterations with modified keys
    for (let i = 1; i <= 19; i++) {
        const modKey = new Uint8Array(keyBytes);
        for (let j = 0; j < keyBytes; j++) {
            modKey[j] = rc4Key[j] ^ i;
        }
        encrypted = rc4(modKey, encrypted);
    }

    return encrypted;
}

/**
 * Compute the encryption key.
 * Algorithm 2 from PDF Reference.
 */
function computeEncryptionKey(
    userPassword: string,
    ownerKey: Uint8Array,
    permissions: number,
    fileId: Uint8Array,
    keyLength: number,
    revision: number,
    encryptMetadata: boolean = true
): Uint8Array {
    // Step 1: Pad password
    const padded = padPassword(userPassword);

    // Step 2-6: Concatenate and hash
    const toHash = new Uint8Array(padded.length + ownerKey.length + 4 + fileId.length + (revision >= 4 && !encryptMetadata ? 4 : 0));
    let offset = 0;

    toHash.set(padded, offset); offset += padded.length;
    toHash.set(ownerKey, offset); offset += ownerKey.length;

    // Permissions as little-endian 4 bytes
    toHash[offset++] = permissions & 0xFF;
    toHash[offset++] = (permissions >> 8) & 0xFF;
    toHash[offset++] = (permissions >> 16) & 0xFF;
    toHash[offset++] = (permissions >> 24) & 0xFF;

    toHash.set(fileId, offset); offset += fileId.length;

    // For revision 4, if not encrypting metadata, add 0xFFFFFFFF
    if (revision >= 4 && !encryptMetadata) {
        toHash[offset++] = 0xFF;
        toHash[offset++] = 0xFF;
        toHash[offset++] = 0xFF;
        toHash[offset++] = 0xFF;
    }

    let hash = md5(toHash.subarray(0, offset));

    // Step 7: For revision 3+, do 50 iterations
    const keyBytes = keyLength / 8;
    if (revision >= 3) {
        for (let i = 0; i < 50; i++) {
            hash = md5(hash.subarray(0, keyBytes));
        }
    }

    return hash.subarray(0, keyBytes);
}

/**
 * Compute the User key (U value) for the encryption dictionary.
 * Algorithm 4/5 from PDF Reference.
 */
function computeUserKey(encryptionKey: Uint8Array, fileId: Uint8Array, revision: number): Uint8Array {
    if (revision === 2) {
        // Algorithm 4: Simple RC4 of padding
        return rc4(encryptionKey, PDF_PADDING);
    }

    // Algorithm 5: Revision 3+
    // Step 1: Hash padding + file ID
    const toHash = new Uint8Array(PDF_PADDING.length + fileId.length);
    toHash.set(PDF_PADDING, 0);
    toHash.set(fileId, PDF_PADDING.length);

    let hash = md5(toHash);

    // Step 2: Encrypt with RC4
    let encrypted = rc4(encryptionKey, hash);

    // Step 3: Do 19 more iterations with modified keys
    for (let i = 1; i <= 19; i++) {
        const modKey = new Uint8Array(encryptionKey.length);
        for (let j = 0; j < encryptionKey.length; j++) {
            modKey[j] = encryptionKey[j] ^ i;
        }
        encrypted = rc4(modKey, encrypted);
    }

    // Step 4: Pad to 32 bytes with arbitrary data
    const result = new Uint8Array(32);
    result.set(encrypted.subarray(0, 16), 0);
    // Fill remaining with random or fixed bytes
    for (let i = 16; i < 32; i++) {
        result[i] = PDF_PADDING[i];
    }

    return result;
}

/**
 * Generate a random file ID (16 bytes).
 */
export function generateFileId(): Uint8Array {
    return randomBytes(16);
}

/**
 * Initialize encryption state from options.
 */
export function initEncryption(options: EncryptionOptions, fileId: Uint8Array): EncryptionState {
    const userPassword = options.userPassword ?? '';
    const ownerPassword = options.ownerPassword ?? userPassword;
    const algorithm = options.algorithm ?? 'aes';

    // Set parameters based on algorithm
    const keyLength = 128; // Always 128-bit for modern security
    const revision = algorithm === 'aes' ? 4 : 3;
    const version = algorithm === 'aes' ? 4 : 2;

    // Default permissions: allow everything
    const defaultPerms: PDFPermissions = {
        print: true,
        modify: true,
        copy: true,
        annotate: true,
        fillForms: true,
        extractForAccessibility: true,
        assemble: true,
        highQualityPrint: true
    };

    const permissions = { ...defaultPerms, ...options.permissions };
    const permissionsValue = computePermissions(permissions);

    // Compute keys
    const ownerKey = computeOwnerKey(ownerPassword, userPassword, keyLength);
    const encryptionKey = computeEncryptionKey(
        userPassword,
        ownerKey,
        permissionsValue,
        fileId,
        keyLength,
        revision,
        true // encryptMetadata
    );
    const userKey = computeUserKey(encryptionKey, fileId, revision);

    return {
        encryptionKey,
        ownerKey,
        userKey,
        permissionsValue,
        algorithm,
        keyLength,
        revision,
        version
    };
}

/**
 * Derive object-specific encryption key.
 * Algorithm 1 from PDF Reference.
 */
function deriveObjectKey(baseKey: Uint8Array, objectId: number, generation: number, useAes: boolean): Uint8Array {
    // Concatenate: base key + object ID (3 bytes LE) + generation (2 bytes LE) + [sALT for AES]
    const extra = useAes ? 4 : 0;
    const data = new Uint8Array(baseKey.length + 5 + extra);

    data.set(baseKey, 0);
    let offset = baseKey.length;

    // Object ID as 3 bytes little-endian
    data[offset++] = objectId & 0xFF;
    data[offset++] = (objectId >> 8) & 0xFF;
    data[offset++] = (objectId >> 16) & 0xFF;

    // Generation as 2 bytes little-endian
    data[offset++] = generation & 0xFF;
    data[offset++] = (generation >> 8) & 0xFF;

    // For AES, append "sAlT"
    if (useAes) {
        data[offset++] = 0x73; // 's'
        data[offset++] = 0x41; // 'A'
        data[offset++] = 0x6C; // 'l'
        data[offset++] = 0x54; // 'T'
    }

    const hash = md5(data.subarray(0, offset));

    // Key length is min(baseKey.length + 5, 16)
    const keyLen = Math.min(baseKey.length + 5, 16);
    return hash.subarray(0, keyLen);
}

/**
 * Encrypt data for a specific PDF object using RC4.
 */
function encryptRC4(data: Uint8Array, objectKey: Uint8Array): Uint8Array {
    return rc4(objectKey, data);
}

/**
 * Encrypt data for a specific PDF object using AES-128 CBC.
 */
function encryptAES(data: Uint8Array, objectKey: Uint8Array): Uint8Array {
    // Generate random IV (16 bytes)
    const iv = randomBytes(16);

    // Pad data to 16-byte boundary (PKCS#7 padding)
    const padLen = 16 - (data.length % 16);
    const padded = new Uint8Array(data.length + padLen);
    padded.set(data, 0);
    for (let i = data.length; i < padded.length; i++) {
        padded[i] = padLen;
    }

    // Encrypt with AES-128-CBC
    const cipher = createCipheriv('aes-128-cbc', objectKey, iv);
    cipher.setAutoPadding(false); // We handle padding manually

    const encrypted = Buffer.concat([cipher.update(padded), cipher.final()]);

    // Prepend IV to encrypted data
    const result = new Uint8Array(iv.length + encrypted.length);
    result.set(iv, 0);
    result.set(new Uint8Array(encrypted), iv.length);

    return result;
}

/**
 * Encrypt a PDF string for a specific object.
 */
export function encryptString(
    data: Uint8Array,
    state: EncryptionState,
    objectId: number,
    generation: number
): Uint8Array {
    const useAes = state.algorithm === 'aes';
    const objectKey = deriveObjectKey(state.encryptionKey, objectId, generation, useAes);

    if (useAes) {
        return encryptAES(data, objectKey);
    } else {
        return encryptRC4(data, objectKey);
    }
}

/**
 * Encrypt a PDF stream for a specific object.
 */
export function encryptStream(
    data: Uint8Array,
    state: EncryptionState,
    objectId: number,
    generation: number
): Uint8Array {
    const useAes = state.algorithm === 'aes';
    const objectKey = deriveObjectKey(state.encryptionKey, objectId, generation, useAes);

    if (useAes) {
        return encryptAES(data, objectKey);
    } else {
        return encryptRC4(data, objectKey);
    }
}

/**
 * Build the /Encrypt dictionary for the PDF trailer.
 */
export function buildEncryptDict(state: EncryptionState): Record<string, unknown> {
    const dict: Record<string, unknown> = {
        Filter: { __pdfName: 'Standard' },
        V: state.version,
        R: state.revision,
        O: state.ownerKey,
        U: state.userKey,
        P: state.permissionsValue,
        Length: state.keyLength
    };

    // For AES (revision 4), add stream/string filter info
    if (state.revision === 4) {
        dict.StmF = { __pdfName: 'StdCF' };
        dict.StrF = { __pdfName: 'StdCF' };
        dict.CF = {
            StdCF: {
                CFM: { __pdfName: 'AESV2' },
                AuthEvent: { __pdfName: 'DocOpen' },
                Length: 16
            }
        };
        dict.EncryptMetadata = true;
    }

    return dict;
}

/**
 * Convert Uint8Array to hex string for PDF output.
 */
export function toHexString(data: Uint8Array): string {
    return Array.from(data)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}
