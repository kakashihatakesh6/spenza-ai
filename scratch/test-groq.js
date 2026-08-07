const groqApiKey = process.env.GROQ_API_KEY;

async function testGroqDirect() {
  console.log('Testing Groq API with openai/gpt-oss-120b...');
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${groqApiKey}`,
      },
      body: JSON.stringify({
        model: 'openai/gpt-oss-120b',
        messages: [{ role: 'user', content: 'Hello, respond with a short message.' }],
        temperature: 0.2,
      }),
    });

    const data = await res.json();
    console.log('Groq Direct API Response:', JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Error:', err);
  }
}

testGroqDirect();
