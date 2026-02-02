/**
 * PDF Encryption Demo
 *
 * Demonstrates the encryption features of kurd-pdflib:
 * - User password (required to open the document)
 * - Owner password (required for full editing access)
 * - Permission restrictions (print, copy, modify, etc.)
 * - Different encryption algorithms (RC4-128 and AES-128)
 */

import { KurdPDF, LayoutEngine } from '../dist/index.js';
import { readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

async function createEncryptedPDF() {
    console.log('=== PDF Encryption Demo ===\n');

    // Load fonts
    const fonts = {
        'AR': { fontBytes: readFileSync(path.join(projectRoot, 'assets/NotoSansArabic-Regular.ttf')), baseFontName: 'NotoSansArabic' },
        'EN': { fontBytes: readFileSync(path.join(projectRoot, 'assets/NotoSans-Regular.ttf')), baseFontName: 'NotoSans' }
    };

    // ============================================================
    // Example 1: Basic Password Protection (AES-128)
    // ============================================================
    console.log('1. Creating PDF with basic password protection (AES-128)...');

    const doc1 = new KurdPDF({
        fonts,
        fallbackOrder: ['EN', 'AR'],
        title: 'Password Protected Document',
        author: 'Kurd-PDFLib',
        encryption: {
            userPassword: 'secret123',  // Required to open
            ownerPassword: 'admin456',  // Required for full access
            algorithm: 'aes'            // AES-128 encryption (recommended)
        }
    });
    await doc1.init();

    const layout1 = new LayoutEngine(doc1);
    layout1.render({
        type: 'vstack',
        options: { gap: 20, padding: 40 },
        children: [
            { type: 'text', content: '🔒 Password Protected PDF', options: { font: 'EN', size: 24, align: 'center' } },
            { type: 'text', content: 'This document is encrypted with AES-128', options: { font: 'EN', size: 14, align: 'center', color: '#666' } },
            { type: 'spacer', size: 20 },
            { type: 'box', options: { backgroundColor: '#e8f5e9', padding: 20, borderRadius: 8 }, child: {
                type: 'vstack', options: { gap: 10 }, children: [
                    { type: 'text', content: 'Encryption Details:', options: { font: 'EN', size: 14 } },
                    { type: 'text', content: '• Algorithm: AES-128 (PDF 1.5+)', options: { font: 'EN', size: 12, color: '#333' } },
                    { type: 'text', content: '• User Password: secret123', options: { font: 'EN', size: 12, color: '#333' } },
                    { type: 'text', content: '• Owner Password: admin456', options: { font: 'EN', size: 12, color: '#333' } }
                ]
            }},
            { type: 'spacer', size: 20 },
            { type: 'text', content: 'دۆکیومێنتی پاراستراو بە وشەی نهێنی', options: { font: 'AR', size: 18, rtl: true, align: 'center' } },
            { type: 'text', content: '(Password Protected Document in Kurdish)', options: { font: 'EN', size: 11, align: 'center', color: '#888' } }
        ]
    }, 50, 750, 495);

    const bytes1 = doc1.save();
    writeFileSync(path.join(projectRoot, 'encrypted-aes-password.pdf'), Buffer.from(bytes1));
    console.log('   ✓ Created: encrypted-aes-password.pdf (password: "secret123")\n');

    // ============================================================
    // Example 2: Open Without Password, Restricted Permissions
    // ============================================================
    console.log('2. Creating PDF with restricted permissions (no copy/print)...');

    const doc2 = new KurdPDF({
        fonts,
        fallbackOrder: ['EN', 'AR'],
        title: 'Restricted Permissions Document',
        author: 'Kurd-PDFLib',
        encryption: {
            userPassword: '',           // Empty = no password to open
            ownerPassword: 'owner123',  // Password to remove restrictions
            algorithm: 'aes',
            permissions: {
                print: false,           // Disable printing
                copy: false,            // Disable text copying
                modify: false,          // Disable modification
                annotate: true,         // Allow annotations
                fillForms: true,        // Allow form filling
                extractForAccessibility: true,
                assemble: false,
                highQualityPrint: false
            }
        }
    });
    await doc2.init();

    const layout2 = new LayoutEngine(doc2);
    layout2.render({
        type: 'vstack',
        options: { gap: 20, padding: 40 },
        children: [
            { type: 'text', content: '🚫 Restricted Permissions PDF', options: { font: 'EN', size: 24, align: 'center' } },
            { type: 'text', content: 'This document opens without a password but has restrictions', options: { font: 'EN', size: 12, align: 'center', color: '#666' } },
            { type: 'spacer', size: 20 },
            { type: 'box', options: { backgroundColor: '#fff3e0', padding: 20, borderRadius: 8 }, child: {
                type: 'vstack', options: { gap: 10 }, children: [
                    { type: 'text', content: 'Permissions:', options: { font: 'EN', size: 14 } },
                    { type: 'text', content: '❌ Printing: Disabled', options: { font: 'EN', size: 12, color: '#c62828' } },
                    { type: 'text', content: '❌ Copying text: Disabled', options: { font: 'EN', size: 12, color: '#c62828' } },
                    { type: 'text', content: '❌ Modifying: Disabled', options: { font: 'EN', size: 12, color: '#c62828' } },
                    { type: 'text', content: '✓ Annotations: Allowed', options: { font: 'EN', size: 12, color: '#2e7d32' } },
                    { type: 'text', content: '✓ Form filling: Allowed', options: { font: 'EN', size: 12, color: '#2e7d32' } }
                ]
            }},
            { type: 'spacer', size: 10 },
            { type: 'text', content: 'Owner password "owner123" is required to remove these restrictions.', options: { font: 'EN', size: 10, align: 'center', color: '#888' } }
        ]
    }, 50, 750, 495);

    const bytes2 = doc2.save();
    writeFileSync(path.join(projectRoot, 'encrypted-restricted.pdf'), Buffer.from(bytes2));
    console.log('   ✓ Created: encrypted-restricted.pdf (opens without password, restricted)\n');

    // ============================================================
    // Example 3: RC4-128 Encryption (Legacy Compatibility)
    // ============================================================
    console.log('3. Creating PDF with RC4-128 encryption (legacy compatibility)...');

    const doc3 = new KurdPDF({
        fonts,
        fallbackOrder: ['EN', 'AR'],
        title: 'RC4 Encrypted Document',
        author: 'Kurd-PDFLib',
        encryption: {
            userPassword: 'legacy',
            ownerPassword: 'legacy-admin',
            algorithm: 'rc4'    // RC4-128 for older PDF readers
        }
    });
    await doc3.init();

    const layout3 = new LayoutEngine(doc3);
    layout3.render({
        type: 'vstack',
        options: { gap: 20, padding: 40 },
        children: [
            { type: 'text', content: '🔐 RC4-128 Encrypted PDF', options: { font: 'EN', size: 24, align: 'center' } },
            { type: 'text', content: 'Using RC4 encryption for legacy PDF reader compatibility', options: { font: 'EN', size: 12, align: 'center', color: '#666' } },
            { type: 'spacer', size: 20 },
            { type: 'box', options: { backgroundColor: '#e3f2fd', padding: 20, borderRadius: 8 }, child: {
                type: 'vstack', options: { gap: 10 }, children: [
                    { type: 'text', content: 'Encryption Details:', options: { font: 'EN', size: 14 } },
                    { type: 'text', content: '• Algorithm: RC4-128 (PDF 1.4+)', options: { font: 'EN', size: 12 } },
                    { type: 'text', content: '• Compatible with older PDF readers', options: { font: 'EN', size: 12 } },
                    { type: 'text', content: '• Password: "legacy"', options: { font: 'EN', size: 12 } }
                ]
            }},
            { type: 'spacer', size: 20 },
            { type: 'text', content: 'Note: AES encryption is recommended for new documents.', options: { font: 'EN', size: 11, align: 'center', color: '#f57c00' } }
        ]
    }, 50, 750, 495);

    const bytes3 = doc3.save();
    writeFileSync(path.join(projectRoot, 'encrypted-rc4-legacy.pdf'), Buffer.from(bytes3));
    console.log('   ✓ Created: encrypted-rc4-legacy.pdf (password: "legacy")\n');

    // ============================================================
    // Example 4: Full Feature Demo with RTL Content
    // ============================================================
    console.log('4. Creating encrypted PDF with Kurdish/Arabic content...');

    const doc4 = new KurdPDF({
        fonts,
        fallbackOrder: ['EN', 'AR'],
        title: 'بەڵگەنامەی پاراستراو',
        author: 'کورد-پی‌دی‌ئێف',
        encryption: {
            userPassword: 'کوردستان',  // Kurdish password!
            ownerPassword: 'admin',
            algorithm: 'aes',
            permissions: {
                print: true,
                copy: false,
                modify: false,
                annotate: true,
                fillForms: true,
                extractForAccessibility: true,
                assemble: false,
                highQualityPrint: true
            }
        }
    });
    await doc4.init();

    const layout4 = new LayoutEngine(doc4);
    layout4.render({
        type: 'vstack',
        options: { gap: 15, padding: 40 },
        children: [
            { type: 'text', content: 'بەڵگەنامەی پاراستراوی کوردی', options: { font: 'AR', size: 22, rtl: true, align: 'center' } },
            { type: 'text', content: 'Encrypted Kurdish Document', options: { font: 'EN', size: 14, align: 'center', color: '#666' } },
            { type: 'spacer', size: 15 },
            { type: 'box', options: { backgroundColor: '#fce4ec', padding: 20, borderRadius: 8 }, child: {
                type: 'vstack', options: { gap: 12 }, children: [
                    { type: 'text', content: 'زانیاری شفرەکردن:', options: { font: 'AR', size: 14, rtl: true } },
                    { type: 'text', content: '• ئەلگۆریتم: AES-128', options: { font: 'AR', size: 12, rtl: true } },
                    { type: 'text', content: '• وشەی نهێنی: کوردستان', options: { font: 'AR', size: 12, rtl: true } },
                    { type: 'text', content: '• چاپکردن: ڕێگەپێدراو', options: { font: 'AR', size: 12, rtl: true } },
                    { type: 'text', content: '• کۆپیکردن: قەدەغەیە', options: { font: 'AR', size: 12, rtl: true } }
                ]
            }},
            { type: 'spacer', size: 15 },
            { type: 'text', content: 'ئەم بەڵگەنامەیە بۆ تاقیکردنەوەی تایبەتمەندیەکانی شفرەکردنی کتێبخانەی کورد-پی‌دی‌ئێف دروستکراوە.', options: { font: 'AR', size: 11, rtl: true, align: 'justify', width: 495 } },
            { type: 'spacer', size: 10 },
            { type: 'text', content: 'This document was created to test the encryption features of kurd-pdflib.', options: { font: 'EN', size: 10, align: 'center', color: '#888' } }
        ]
    }, 50, 750, 495);

    const bytes4 = doc4.save();
    writeFileSync(path.join(projectRoot, 'encrypted-kurdish.pdf'), Buffer.from(bytes4));
    console.log('   ✓ Created: encrypted-kurdish.pdf (password: "کوردستان")\n');

    console.log('=== All encrypted PDFs created successfully! ===\n');
    console.log('Summary:');
    console.log('  • encrypted-aes-password.pdf    - AES-128, password: "secret123"');
    console.log('  • encrypted-restricted.pdf      - Opens freely, printing/copying disabled');
    console.log('  • encrypted-rc4-legacy.pdf      - RC4-128 for legacy compatibility');
    console.log('  • encrypted-kurdish.pdf         - Kurdish password: "کوردستان"');
}

createEncryptedPDF().catch(console.error);
