import { KurdPDF, LayoutEngine } from './index.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
// Asset paths
const arabicFontPath = join(__dirname, '..', 'assets', 'NotoSansArabic-Regular.ttf');
const latinFontPath = join(__dirname, '..', 'assets', 'NotoSans-Regular.ttf');
const photoPath = join(__dirname, '..', 'assets', 'photo.jpg');
const pngPath = join(__dirname, '..', 'assets', 'transparent-sample.png'); // Use transparent PNG
const svgPath = join(__dirname, '..', 'assets', 'Logo.svg'); // Use vector SVG

// Colors
const COL_PRIMARY = '#1a237e'; // Deep Blue
const COL_ACCENT = '#ff6f00';  // Amber
const COL_BG = '#e0e0e0';      // Darker Grey to see transparency better
const COL_TEXT = '#212121';    // Dark Grey

async function main() {
    const arabicBytes = new Uint8Array(readFileSync(arabicFontPath));
    const latinBytes = new Uint8Array(readFileSync(latinFontPath));
    const photoBytes = new Uint8Array(readFileSync(photoPath));
    const pngBytes = new Uint8Array(readFileSync(pngPath));
    const svgContent = readFileSync(svgPath, 'utf-8');

    const doc = new KurdPDF({
        fonts: {
            'AR': { fontBytes: arabicBytes, baseFontName: 'NotoSansArabic' },
            'EN': { fontBytes: latinBytes, baseFontName: 'NotoSans' }
        }
    });

    await doc.init({ width: 400, height: 250 }); // Custom card size
    const layout = new LayoutEngine(doc);

    // Render the Ultimate ID Card
    layout.render({
        type: 'zstack', // FEATURE 1: Z-Stack for background
        options: { width: 400, height: 250 },
        children: [
            // Layer 1: Background Color
            { 
                type: 'rect', 
                width: 400, 
                height: 250, 
                options: { style: 'F', color: COL_BG } 
            },
            
            // Layer 2: Vector Pattern (SVG) - Watermark INSIDE the layout
            // Opacity is applied via LayoutOptions now!
            {
                type: 'box',
                options: { 
                    width: 400, 
                    height: 250, 
                    align: 'end', 
                    padding: [50, -50, 0, 0], // Push to bottom-right
                    opacity: 0.15 // 15% Opacity on the container
                }, 
                child: { 
                    type: 'svg', 
                    content: svgContent, 
                    width: 200, 
                    height: 200, 
                    options: { scale: 1.5 } // NO color override, use original colors
                }
            },
            
            // Layer 3: Main Content Structure
            {
                type: 'vstack', // FEATURE 2: VStack for main layout
                options: { width: 400, height: 250, padding: 15, gap: 10 },
                children: [
                    // Header Row (Space-Between)
                    {
                        type: 'hstack', // FEATURE 3: Flex Space-Between
                        options: { width: 370, align: 'space-between' },
                        children: [
                            // Left: Logo (PNG Transparency)
                            { 
                                type: 'image', 
                                data: pngBytes, 
                                imgType: 'png', 
                                width: 40, 
                                height: 40 
                            },
                            // Right: Title Text
                            {
                                type: 'vstack',
                                options: { align: 'end', gap: 2 },
                                children: [
                                    { type: 'text', content: 'Kurdish Ultimate ID', options: { font: 'EN', size: 14, color: COL_PRIMARY } },
                                    { type: 'text', content: 'ناسنامەی پێشکەوتوو', options: { font: 'AR', size: 12, rtl: true, color: COL_PRIMARY } }
                                ]
                            }
                        ]
                    },

                    // Divider Line
                    { type: 'rect', width: 370, height: 2, options: { style: 'F', color: COL_ACCENT } },

                    // Body Content (Photo + Details)
                    {
                        type: 'hstack',
                        options: { gap: 15, align: 'start' }, // Vertical align start
                        children: [
                            // Photo with Border and Radius
                            {
                                type: 'box', // FEATURE 4: Box Styling (Border Radius + Clip)
                                options: { 
                                    padding: 0, 
                                    backgroundColor: '#ffffff', 
                                    borderColor: COL_PRIMARY, 
                                    borderWidth: 2,
                                    borderRadius: 8 
                                },
                                child: { 
                                    type: 'image', 
                                    data: photoBytes, 
                                    imgType: 'jpeg', 
                                    width: 80, 
                                    height: 100 
                                }
                            },
                            // Text Details
                            {
                                type: 'vstack',
                                options: { width: 260, gap: 8 },
                                children: [
                                    // Name Field
                                    { 
                                        type: 'hstack',
                                        options: { gap: 5, align: 'end' },
                                        children: [
                                            { type: 'text', content: 'Zhigger Khorsheed', options: { font: 'EN', size: 12, color: '#000' } },
                                            { type: 'text', content: ' / ', options: { font: 'EN', size: 12, color: '#666' } },
                                            { type: 'text', content: 'ژیگر خورشید', options: { font: 'AR', size: 12, color: '#000', rtl: true } }
                                        ]
                                    },
                                    
                                    // Description (Justified Wrapping)
                                    { 
                                        type: 'box',
                                        options: { backgroundColor: '#ffffff', padding: 8, borderRadius: 4, borderColor: '#999', borderWidth: 0.5 },
                                        child: {
                                            type: 'text',
                                            // Feature 5: Layout-aware wrapping + Justification
                                            content: "This text is justified. It should line up perfectly on both the left and right sides, creating a clean newspaper-like look.",
                                            options: { 
                                                font: 'EN', 
                                                size: 10, 
                                                width: 240, 
                                                align: 'justify', 
                                                lineHeight: 1.4 
                                            }
                                        }
                                    }
                                ]
                            }
                        ]
                    },
                    
                    // Spacer to push footer down
                    { type: 'spacer', size: 10 },

                    // Footer (Status Badge)
                    {
                        type: 'box',
                        options: { 
                            width: 370, 
                            backgroundColor: COL_PRIMARY, 
                            padding: 6, 
                            borderRadius: 4, 
                            align: 'center' 
                        },
                        // FIX: Use hstack to mix EN and AR fonts so no rectangles appear!
                        child: {
                            type: 'hstack',
                            options: { gap: 5, align: 'center' },
                            children: [
                                { type: 'text', content: 'VERIFIED MEMBER', options: { font: 'EN', size: 10, color: '#FFFFFF' } },
                                { type: 'text', content: '•', options: { font: 'EN', size: 10, color: '#FFFFFF' } },
                                { type: 'text', content: 'ئەندامی پەسەندکراو', options: { font: 'AR', size: 10, color: '#FFFFFF', rtl: true } }
                            ]
                        }
                    }
                ]
            }
        ]
    }, 0, 250);
    
    doc.save("out-ultimate-id.pdf");
    console.log("Saved to out-ultimate-id.pdf");
}

main().catch(console.error);
