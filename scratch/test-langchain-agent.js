const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Missing Supabase URL or Anon key.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function runAgentTest(userMessage) {
  console.log(`\n==================================================`);
  console.log(`TEST USER QUERY: "${userMessage}"`);
  console.log(`==================================================`);

  // Sign in authenticated test user
  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email: 'nkdasar@gmail.com',
    password: '123456'
  });

  if (authErr || !authData.session) {
    console.error("Authentication failed:", authErr?.message);
    return;
  }

  const token = authData.session.access_token;
  const userId = authData.user.id;

  // Create conversation
  const { data: conv, error: convErr } = await supabase
    .from('chat_conversations')
    .insert({ user_id: userId, title: 'LangChain Agent Automated Verification' })
    .select('*')
    .single();

  if (convErr) {
    console.error("Failed to create test conversation:", convErr.message);
    return;
  }

  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'apikey': supabaseAnonKey
      },
      body: JSON.stringify({
        conversationId: conv.id,
        message: userMessage
      })
    });

    console.log(`HTTP Status: ${response.status} ${response.statusText}`);
    const streamText = await response.text();
    if (response.status !== 200) {
      console.error("Server Error Output:", streamText);
    }
    
    // Parse SSE lines
    const lines = streamText.split('\n');
    let citations = [];
    let fullAnswer = '';
    let doneMetadata = null;

    let currentEvent = 'token';
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('event:')) {
        currentEvent = trimmed.replace('event:', '').trim();
      } else if (trimmed.startsWith('data:')) {
        const dataStr = trimmed.replace('data:', '').trim();
        try {
          const json = JSON.parse(dataStr);
          if (currentEvent === 'citations') citations = json;
          else if (currentEvent === 'token') fullAnswer += json.text;
          else if (currentEvent === 'done') doneMetadata = json;
        } catch {}
      }
    }

    console.log(`\nCitations:`, citations.length > 0 ? citations : 'None');
    console.log(`\nAI Response:\n${fullAnswer}`);
    console.log(`\nDone Metadata:`, doneMetadata);

  } catch (err) {
    console.error("Fetch failed:", err);
  } finally {
    await supabase.from('chat_conversations').delete().eq('id', conv.id);
  }
}

async function main() {
  const testCases = [
    "My monthly income is ₹90,000. Change my name to Nikhil and use USD instead of INR.",
    "How much did I spend this month? What category costs me the most?",
    "What is OCR in Spendly and how does receipt scanning work?",
    "Increase my food budget to ₹6000 and tell me how much I spent on food last month.",
    "My salary is now ₹85,000. Also show my savings trend."
  ];

  for (const testQuery of testCases) {
    await runAgentTest(testQuery);
    await new Promise(r => setTimeout(r, 3000));
  }
}

main();
