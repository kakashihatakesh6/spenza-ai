const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testCurrentChat() {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: 'nkdasar@gmail.com',
    password: '123456'
  });

  if (error || !data.session) {
    console.error("Sign in error:", error);
    return;
  }

  const token = data.session.access_token;
  const userId = data.user.id;
  console.log("Logged in as:", data.user.email, "ID:", userId);

  // Create test conversation
  const { data: conv, error: convErr } = await supabase
    .from('chat_conversations')
    .insert({ user_id: userId, title: 'Test Agent' })
    .select('*')
    .single();

  if (convErr) {
    console.error("Conv error:", convErr);
    return;
  }

  console.log("Created conversation:", conv.id);

  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'apikey': supabaseAnonKey
      },
      body: JSON.stringify({
        conversationId: conv.id,
        message: 'How much did I spend this month?'
      })
    });

    console.log("HTTP status:", res.status);
    const text = await res.text();
    console.log("Response SSE stream:");
    console.log(text);
  } catch (err) {
    console.error("Fetch error:", err);
  } finally {
    // Cleanup
    await supabase.from('chat_conversations').delete().eq('id', conv.id);
  }
}

testCurrentChat();
