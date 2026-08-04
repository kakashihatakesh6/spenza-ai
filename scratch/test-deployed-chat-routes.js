const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testQuery(session, conversationId, message) {
  console.log(`\n========================================\nSending Message: "${message}"`);
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
        'apikey': supabaseAnonKey
      },
      body: JSON.stringify({
        conversationId,
        message
      })
    });

    console.log("Response Status:", response.status, response.statusText);
    const text = await response.text();
    console.log("Raw Response:");
    console.log(text);
  } catch (err) {
    console.error("Query failed:", err);
  }
}

async function run() {
  const email = 'nkdasar@gmail.com';
  const password = '123456';

  console.log(`Logging in as ${email}...`);
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    console.error("Login failed:", error.message);
    return;
  }
  const session = data.session;
  console.log("Logged in successfully!");

  // Create a conversation
  console.log("Creating test conversation...");
  const { data: conv, error: convErr } = await supabase
    .from('chat_conversations')
    .insert({ user_id: session.user.id, title: 'RAG Route Verification' })
    .select('*')
    .single();

  if (convErr) {
    console.error("Failed to create conversation:", convErr.message);
    return;
  }
  console.log("Created conversation ID:", conv.id);

  try {
    // 1. Test RAG Route
    await testQuery(session, conv.id, "What is Spendly?");

    // 2. Test Database Route
    await testQuery(session, conv.id, "Show my recent expenses and how much I spent in total.");

    // 3. Test Hybrid Route
    await testQuery(session, conv.id, "What categories does Spendly support and did my recent spending exceed my budgets?");
  } finally {
    // Clean up
    console.log("\nCleaning up test conversation...");
    await supabase.from('chat_conversations').delete().eq('id', conv.id);
    console.log("Done!");
  }
}

run();
