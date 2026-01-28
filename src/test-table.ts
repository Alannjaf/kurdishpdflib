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
        options: { gap: 30, padding: 40 },
        children: [
            { type: 'text', content: 'Table Helper Test', options: { font: 'EN', size: 24, color: '#0d6efd' } },
            
            {
                type: 'table',
                headers: ['ID', 'Project Name', 'Status', 'بەرپرس'],
                columnWidths: [50, 200, 100, 150],
                rows: [
                    ['01', 'Beroshka POS', 'Overdue', 'Alan'],
                    ['02', 'Hajyawa Branding', 'Pending', 'Sirwan'],
                    ['03', 'Ramadan Booth', 'Active', 'Ravina'],
                    ['04', 'Sadr City OOH', 'Draft', 'Alan'],
                    ['05', 'IVR Upgrade', 'Complete', 'Sirwan']
                ],
                options: {
                    headerBackgroundColor: '#0d6efd',
                    headerTextColor: '#ffffff',
                    alternateRowBackgroundColor: '#f8f9fa',
                    borderColor: '#dee2e6',
                    borderWidth: 1,
                    rowPadding: 10
                }
            },

            { type: 'text', content: 'Mixed Content Table', options: { font: 'EN', size: 18 } },

            {
                type: 'table',
                headers: ['Description', 'Amount'],
                rows: [
                    ['Kurdish Branding Services', '$2,500'],
                    ['Software Development (PDF Lib)', '$5,000'],
                    ['Total', '$7,500']
                ],
                options: {
                    headerBackgroundColor: '#212529',
                    headerTextColor: '#ffffff',
                    rowPadding: 12,
                    fontSize: 12
                }
            }
        ]
    };

    layout.render(root, 0, 842);

    doc.save('table-test.pdf');
    console.log('✅ Table test complete. Check table-test.pdf');
}

run();
