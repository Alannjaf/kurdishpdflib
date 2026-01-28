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
        options: { gap: 30, padding: 50, align: 'center' },
        children: [
            { type: 'text', content: 'Layout Gradients Test', options: { font: 'EN', size: 30, color: '#333' } },
            
            // Vertical Gradient Box
            {
                type: 'box',
                options: {
                    width: 400,
                    height: 100,
                    borderRadius: 15,
                    backgroundGradient: {
                        direction: 'vertical',
                        colors: [
                            { offset: 0, color: '#0d6efd' }, // Blue
                            { offset: 1, color: '#6610f2' }  // Purple
                        ]
                    },
                    padding: 20
                },
                child: { 
                    type: 'text', 
                    content: 'Vertical Gradient with Rounded Corners', 
                    options: { font: 'EN', size: 16, color: '#ffffff' } 
                }
            },

            // Horizontal Gradient Box
            {
                type: 'box',
                options: {
                    width: 400,
                    height: 100,
                    backgroundGradient: {
                        direction: 'horizontal',
                        colors: [
                            { offset: 0, color: '#ffc107' }, // Yellow
                            { offset: 1, color: '#fd7e14' }  // Orange
                        ]
                    },
                    borderColor: '#000',
                    borderWidth: 1,
                    padding: 20
                },
                child: { 
                    type: 'text', 
                    content: 'Horizontal Gradient (Rectangular)', 
                    options: { font: 'EN', size: 16, color: '#000000' } 
                }
            },

            // Mixed Layout with Gradient
            {
                type: 'box',
                options: {
                    padding: 30,
                    borderRadius: 50,
                    backgroundGradient: {
                        colors: [
                            { offset: 0, color: '#198754' }, // Green
                            { offset: 1, color: '#20c997' }  // Teal
                        ]
                    }
                },
                child: {
                    type: 'vstack',
                    options: { gap: 10, align: 'center' },
                    children: [
                        { type: 'text', content: 'بەخێربێن بۆ جیهانی ڕەنگەکان', options: { font: 'AR', size: 20, color: '#fff', rtl: true } },
                        { type: 'text', content: 'Full layout engine support for gradients!', options: { font: 'EN', size: 12, color: '#fff' } }
                    ]
                }
            }
        ]
    };

    layout.render(root, 0, 842);

    doc.save('gradient-layout-test.pdf');
    console.log('✅ Gradient layout test complete. Check gradient-layout-test.pdf');
}

run();
