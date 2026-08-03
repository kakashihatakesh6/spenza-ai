require('dotenv').config();

const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;

if (!apiKey) {
  console.error("No EXPO_PUBLIC_GEMINI_API_KEY found in .env file.");
  process.exit(1);
}

async function testGemini() {
  console.log("Testing Gemini API key (masked):", apiKey.substring(0, 10) + "...");
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: "Hello, reply with exactly the word 'Success'." }] }]
      })
    });

    console.log("Status:", response.status, response.statusText);
    const data = await response.json();
    console.log("Response body:");
    console.log(JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Request failed:", err);
  }
}

testGemini();
