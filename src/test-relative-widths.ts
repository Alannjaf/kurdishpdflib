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

    const root: any = {
        type: 'vstack',
        options: { gap: 20, padding: 40, width: '100%', backgroundColor: '#f0f0f0' },
        children: [
            { type: 'text', content: 'Relative Widths (%) Test', options: { font: 'EN', size: 24, color: '#333' } },
            
            // 100% Width Box
            {
                type: 'box',
                options: {
                    width: '100%',
                    backgroundColor: '#0d6efd',
                    padding: 15,
                    borderRadius: 10
                },
                child: { type: 'text', content: 'This box is width: 100%', options: { font: 'EN', size: 14, color: '#fff' } }
            },

            // 50% Width Box
            {
                type: 'box',
                options: {
                    width: '50%',
                    backgroundColor: '#198754',
                    padding: 15,
                    borderRadius: 10
                },
                child: { type: 'text', content: 'This box is width: 50%', options: { font: 'EN', size: 14, color: '#fff' } }
            },

            // Nested Relative Widths
            {
                type: 'box',
                options: {
                    width: '80%',
                    backgroundColor: '#ffc107',
                    padding: 20,
                    borderRadius: 15
                },
                child: {
                    type: 'vstack',
                    options: { gap: 10 },
                    children: [
                        { type: 'text', content: 'Parent Box (80%)', options: { font: 'EN', size: 16 } },
                        {
                            type: 'box',
                            options: { width: '50%', backgroundColor: '#000', padding: 10, borderRadius: 5 },
                            child: { type: 'text', content: 'Nested 50% (Black)', options: { font: 'EN', size: 12, color: '#fff' } }
                        }
                    ]
                }
            },

            // Horizontal relative widths
            {
                type: 'hstack',
                options: { width: '100%', gap: 10 },
                children: [
                    {
                        type: 'box',
                        options: { width: '30%', backgroundColor: '#dc3545', padding: 10, borderRadius: 5 },
                        child: { type: 'text', content: '30%', options: { font: 'EN', color: '#fff' } }
                    },
                    {
                        type: 'box',
                        options: { width: '70%', backgroundColor: '#6610f2', padding: 10, borderRadius: 5 },
                        child: { type: 'text', content: '70%', options: { font: 'EN', color: '#fff' } }
                    }
                ]
            }
        ]
    };

    layout.render(root, 0, 842);

    doc.save('relative-widths-test.pdf');
    console.log('✅ Relative widths test complete. Check relative-widths-test.pdf');
}

run();
