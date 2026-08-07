require('dotenv').config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

const url = `${supabaseUrl}/functions/v1/test-chat-langchain`;

async function test(query) {
  console.log(`\n----------------------------------------\nTesting Query: "${query}"`);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${anonKey}`
      },
      body: JSON.stringify({ query })
    });

    const data = await res.json();
    if (data.success) {
      console.log(`Status: Success | Chunks Matched: ${data.chunksMatched}`);
      console.log(`Answer:\n${data.answer}`);
    } else {
      console.error("Error response:", data);
    }
  } catch (err) {
    console.error("Failed to run test:", err);
  }
}

async function run() {
  // Test 1: Query that should exist
  await test("What is Spendly?");

  // Test 2: Fallback query that should fail constraints
  await test("What is the capital of France?");
}

run();
