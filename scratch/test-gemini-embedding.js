require('dotenv').config();

const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;

if (!apiKey) {
  console.error("No EXPO_PUBLIC_GEMINI_API_KEY found in .env file.");
  process.exit(1);
}

async function testEmbedding() {
  console.log("Testing Gemini Embedding API...");
  const url = `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${apiKey}`;
  
  const payload = {
    model: 'models/text-embedding-004',
    content: {
      parts: [{ text: "tell me about today's expenses" }]
    }
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    console.log("Status:", response.status, response.statusText);
    const data = await response.json();
    console.log("Response body:");
    console.log(JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Request failed:", err);
  }
}

testEmbedding();
