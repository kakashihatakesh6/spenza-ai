const fs = require('fs');
const path = require('path');
require('dotenv').config();

const qnaPath = path.join(__dirname, '../assets/docs/spendly-qna.csv');
const kbPath = path.join(__dirname, '../assets/docs/spendly-knowlege-base.pdf');

async function trigger() {
  console.log("Reading files...");
  const qnaBase64 = fs.readFileSync(qnaPath).toString('base64');
  const kbBase64 = fs.readFileSync(kbPath).toString('base64');

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

  const url = `${supabaseUrl}/functions/v1/seed-knowledge-base`;
  console.log(`Sending request to ${url}... (this may take a moment due to vector embedding generation)`);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${anonKey}`
      },
      body: JSON.stringify({
        qnaCsvBase64: qnaBase64,
        kbPdfBase64: kbBase64
      })
    });

    const data = await res.json();
    console.log("Response:", data);
  } catch (err) {
    console.error("Error invoking seed function:", err);
  }
}

trigger();
