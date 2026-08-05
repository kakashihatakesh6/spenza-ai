const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testSingle() {
  const userMessage = "My monthly income is ₹90,000. Change my name to Nikhil and use USD instead of INR.";
  console.log(`\n==================================================`);
  console.log(`TEST USER QUERY: "${userMessage}"`);
  console.log(`==================================================`);

  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email: 'nkdasar@gmail.com',
    password: '123456'
  });

  if (authErr || !authData.session) {
    console.error("Auth failed:", authErr?.message);
    return;
  }

  const token = authData.session.access_token;
  const userId = authData.user.id;

  const { data: conv, error: convErr } = await supabase
    .from('chat_conversations')
    .insert({ user_id: userId, title: 'Single Test' })
    .select('*')
    .single();

  if (convErr) {
    console.error("Conv error:", convErr.message);
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
    console.log("Stream Raw Output:\n", streamText);
  } catch (err) {
    console.error("Fetch error:", err);
  } finally {
    await supabase.from('chat_conversations').delete().eq('id', conv.id);
  }
}

testSingle();
