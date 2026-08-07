const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '../supabase/functions/chat/assets');
const csvPath = path.join(dir, 'spendly-qna.csv');
const pdfPath = path.join(dir, 'spendly-knowlege-base.pdf');

const csvB64 = fs.readFileSync(csvPath).toString('base64');
const pdfB64 = fs.readFileSync(pdfPath).toString('base64');

const tsCode = `// Auto-generated embedded assets fallback for Supabase Edge Functions
export const EMBEDDED_ASSETS: Record<string, string> = {
  'spendly-qna.csv': '${csvB64}',
  'spendly-knowlege-base.pdf': '${pdfB64}'
};
`;

fs.writeFileSync(path.join(dir, 'embeddedAssets.ts'), tsCode, 'utf8');
console.log('Successfully generated embeddedAssets.ts! CSV b64 len:', csvB64.length, 'PDF b64 len:', pdfB64.length);
