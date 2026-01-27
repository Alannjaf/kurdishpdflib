import { KurdPDF } from './index.js';

async function main() {
    // No fonts provided -> defaults to Helvetica
    const doc = new KurdPDF({});
    
    await doc.init(); // Default A4

    doc.text("Hello World in Helvetica", 100, 700, { size: 24 });
    doc.text("This should be visible.", 100, 650, { size: 18 });

    doc.save("out-helvetica.pdf");
    console.log("Saved out-helvetica.pdf");
}

main();
