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
            { type: 'text', content: 'Clickable Links Test', options: { font: 'EN', size: 30, color: '#0d6efd' } },
            
            // Link wrapping text
            {
                type: 'link',
                url: 'https://github.com/Alannjaf/kurdishpdflib',
                child: { 
                    type: 'text', 
                    content: '👉 Click here to visit GitHub Repository', 
                    options: { font: 'EN', size: 18, color: '#0d6efd' } 
                }
            },

            // Link wrapping a Kurdish text
            {
                type: 'link',
                url: 'https://magency.me',
                child: { 
                    type: 'text', 
                    content: 'بۆ زانیاری زیاتر سەردانی ماڵپەڕەکەمان بکە', 
                    options: { font: 'AR', size: 18, color: '#198754', rtl: true } 
                }
            },

            // Link wrapping a box (button-like)
            {
                type: 'link',
                url: 'https://google.com',
                child: {
                    type: 'box',
                    options: { 
                        backgroundColor: '#ffc107', 
                        padding: [10, 20], 
                        borderRadius: 10,
                        borderColor: '#000',
                        borderWidth: 1
                    },
                    child: { type: 'text', content: 'Search on Google', options: { font: 'EN', size: 16 } }
                }
            }
        ]
    };

    layout.render(root, 0, 842);

    doc.save('links-test.pdf');
    console.log('✅ Links test complete. Check links-test.pdf');
}

run();
