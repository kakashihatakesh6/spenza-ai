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
  console.log("Signing in guest user...");
  // Try to sign in or get the active session to get a valid JWT
  // Since we don't have user/pass here, let's search if there are any conversations we can use
  // Or we can just sign in with a demo account if we know it, or fetch the user details.
  // Wait, let's see if we can use a service role key to call it? No, the Edge Function requires user auth getUser().
  // Let's create a temporary user or log in if possible, or print active sessions
  // Wait, let's sign up/in using a test email:
  const email = `test-rag-${Date.now()}@spendly.ai`;
  const password = "Password123!";
  
  const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
    email,
    password
  });

  if (signUpErr) {
    console.error("Sign up failed:", signUpErr.message);
    return;
  }

  const session = signUpData.session;
  if (!session) {
    console.error("No session returned from signup.");
    return;
  }

  console.log("Successfully signed in as:", email);

  // 1. Create a conversation first
  const { data: conv, error: convErr } = await supabase
    .from('chat_conversations')
    .insert({ user_id: session.user.id, title: 'Test Conversation' })
    .select('*')
    .single();

  if (convErr) {
    console.error("Failed to create conversation:", convErr.message);
    return;
  }

  console.log("Created conversation:", conv.id);

  // 2. Call the chat Edge Function
  console.log("Calling chat function...");
  const response = await fetch(`${supabaseUrl}/functions/v1/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
      'apikey': supabaseAnonKey
    },
    body: JSON.stringify({
      conversationId: conv.id,
      message: "tell me about today's expenses"
    })
  });

  console.log("Status:", response.status, response.statusText);
  const text = await response.text();
  console.log("Response text:");
  console.log(text);

  // Clean up
  await supabase.from('chat_conversations').delete().eq('id', conv.id);
  // Delete user from auth
}

runTest();
