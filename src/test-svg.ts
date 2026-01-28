import { KurdPDF, LayoutEngine } from './index.js';
import { readFileSync } from 'fs';

async function run() {
    const doc = new KurdPDF({
        fonts: {
            'AR': { fontBytes: readFileSync('assets/NotoSansArabic-Regular.ttf'), baseFontName: 'NotoSansArabic' },
            'EN': { fontBytes: readFileSync('assets/NotoSans-Regular.ttf'), baseFontName: 'NotoSans' }
        }
    });
    await doc.init();

    const layout = new LayoutEngine(doc);

    // Sample SVG with viewBox and various styles
    const svgContent = `
    <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
        <rect x="10" y="10" width="80" height="80" fill="#f8f9fa" stroke="#0d6efd" stroke-width="2" />
        <circle cx="50" cy="50" r="30" fill="#ffc107" />
        <path d="M30 70 L70 70 L50 30 Z" fill="#dc3545" />
        <polygon points="10,10 20,10 15,20" fill="#198754" />
    </svg>
    `;

    const root: any = {
        type: 'vstack',
        options: { gap: 30, padding: 50, align: 'center' },
        children: [
            { type: 'text', content: 'SVG Graphics Improvement Test', options: { font: 'EN', size: 24, color: '#0d6efd' } },
            
            { type: 'text', content: 'Small SVG (50x50)', options: { font: 'EN', size: 14 } },
            {
                type: 'svg',
                content: svgContent,
                width: 50,
                height: 50
            },

            { type: 'text', content: 'Large SVG (200x200) - Auto Scaled', options: { font: 'EN', size: 14 } },
            {
                type: 'box',
                options: { backgroundColor: '#fdfdfd', borderColor: '#dee2e6', borderWidth: 1, padding: 10 },
                child: {
                    type: 'svg',
                    content: svgContent,
                    width: 200,
                    height: 200
                }
            },

            { type: 'text', content: 'Stretched SVG (300x100)', options: { font: 'EN', size: 14 } },
            {
                type: 'svg',
                content: svgContent,
                width: 300,
                height: 100
            }
        ]
    };

    layout.render(root, 0, 842);

    doc.save('svg-test.pdf');
    console.log('✅ SVG test complete. Check svg-test.pdf');
}

run();
