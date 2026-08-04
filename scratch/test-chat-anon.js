const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function runTest() {
  console.log("Attempting anonymous sign in...");
  let session;
  try {
    const { data, error } = await supabase.auth.signInAnonymously();
    if (error) {
      throw error;
    }
    session = data.session;
  } catch (err) {
    console.error("Anonymous auth failed:", err.message);
    return;
  }

  if (!session) {
    console.error("Failed to obtain session.");
    return;
  }

  console.log("Successfully authenticated anonymously! User ID:", session.user.id);

  // 1. Create a conversation
  const { data: conv, error: convErr } = await supabase
    .from('chat_conversations')
    .insert({ user_id: session.user.id, title: 'RAG Anon Test' })
    .select('*')
    .single();

  if (convErr) {
    console.error("Failed to create conversation:", convErr.message);
    return;
  }

  console.log("Created conversation ID:", conv.id);

  // 2. Call the chat Edge Function
  console.log("Calling chat function (routes to RAG)...");
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
        'apikey': supabaseAnonKey
      },
      body: JSON.stringify({
        conversationId: conv.id,
        message: "What is Spendly?"
      })
    });

    console.log("Status:", response.status, response.statusText);
    const text = await response.text();
    console.log("Response text:");
    console.log(text);
  } catch (err) {
    console.error("Request failed:", err);
  }

  // Clean up
  await supabase.from('chat_conversations').delete().eq('id', conv.id);
}

runTest();
