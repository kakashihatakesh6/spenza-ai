require('dotenv').config();

const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;

async function testEmbedding001() {
  console.log("Testing gemini-embedding-001...");
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${apiKey}`;
  
  const payload = {
    model: 'models/gemini-embedding-001',
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

testEmbedding001();
