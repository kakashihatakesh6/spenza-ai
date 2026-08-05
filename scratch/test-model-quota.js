require('dotenv').config();
const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;

async function testModels() {
  const modelsToTest = ['gemini-2.0-flash-lite', 'gemini-flash-latest', 'gemini-3.6-flash', 'gemini-2.5-flash-lite'];
  for (const m of modelsToTest) {
    console.log(`Testing model: ${m}...`);
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: 'Hello' }] }] })
      });
      console.log(`Model ${m} status: ${res.status}`);
      if (res.ok) {
        console.log(`SUCCESS! Model ${m} is working and has quota.`);
      } else {
        const err = await res.text();
        console.log(`Model ${m} error:`, err.slice(0, 200));
      }
    } catch (e) {
      console.error(`Model ${m} failed:`, e.message);
    }
  }
}

testModels();
