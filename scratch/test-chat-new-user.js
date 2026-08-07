const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function runTest() {
  const randomId = Math.floor(Math.random() * 1000000);
  const email = `test-user-${randomId}@spendly.ai`;
  const password = "Password123!";
  
  let session;
  try {
    console.log(`Signing up new user: ${email}...`);
    const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
      email,
      password
    });
    
    if (signUpErr) {
      throw signUpErr;
    }
    
    session = signUpData.session;
    // If auto-confirm is not enabled, we won't get a session directly.
    // Let's check if we obtained a session.
    if (!session) {
      console.log("Sign up succeeded but session is null (email confirmation required). Trying sign in...");
      const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      if (signInErr) {
        throw signInErr;
      }
      session = signInData.session;
    }
  } catch (err) {
    console.error("Auth failed:", err.message);
    return;
  }

  if (!session) {
    console.error("Failed to authenticate.");
    return;
  }

  console.log("Successfully authenticated! User ID:", session.user.id);

  // 1. Create a conversation
  const { data: conv, error: convErr } = await supabase
    .from('chat_conversations')
    .insert({ user_id: session.user.id, title: 'RAG Test' })
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
