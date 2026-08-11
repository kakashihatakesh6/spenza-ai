const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY in .env");
  process.exit(1);
}

async function runTest() {
  console.log("--- Starting Backend Edge Function Resiliency & Authorization Test ---");
  
  const clientA = createClient(supabaseUrl, supabaseAnonKey);

  // 1. Authenticate User A (nkdasar@gmail.com)
  const emailA = `nkdasar@gmail.com`;
  const password = "123456";

  const { data: signInA, error: errA } = await clientA.auth.signInWithPassword({ email: emailA, password });
  if (errA || !signInA?.session) {
    console.error("User A sign in failed:", errA?.message);
    return;
  }
  const sessionA = signInA.session;
  console.log("User A Authenticated! ID:", sessionA.user.id);

  // 2. User A sends message WITHOUT passing a conversationId
  console.log("\n1. Testing User A message with NO conversationId (backend auto-creation)...");
  const resA = await fetch(`${supabaseUrl}/functions/v1/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${sessionA.access_token}`,
      'apikey': supabaseAnonKey
    },
    body: JSON.stringify({
      message: "What is Spendly?"
    })
  });

  console.log("User A response status:", resA.status, resA.statusText);
  const textA = await resA.text();
  console.log("User A response stream snippet:\n", textA.substring(0, 350));

  // Extract conversation_id from done event
  const match = textA.match(/event: done\s*data: ({.*})/);
  let resolvedConvId = null;
  if (match && match[1]) {
    try {
      const parsed = JSON.parse(match[1]);
      resolvedConvId = parsed.conversation_id;
      console.log("\nDone event returned conversation_id:", resolvedConvId);
    } catch {}
  }
  
  // Check if conversation exists in DB for User A
  const { data: convsA } = await clientA
    .from('chat_conversations')
    .select('*')
    .eq('user_id', sessionA.user.id);

  console.log("User A conversations in DB count:", convsA?.length);

  // 3. User B unauthorized access test using a fake UUID
  console.log("\n2. Testing unauthorized access with fake/other conversationId...");
  const fakeConvId = "00000000-0000-0000-0000-000000000000";
  const resB = await fetch(`${supabaseUrl}/functions/v1/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${sessionA.access_token}`,
      'apikey': supabaseAnonKey
    },
    body: JSON.stringify({
      conversationId: fakeConvId,
      message: "Test fake conv ID fallback"
    })
  });

  console.log("Fake conv ID request status:", resB.status, resB.statusText);
  const textB = await resB.text();
  console.log("Fake conv ID response snippet:", textB.substring(0, 200));

  console.log("\n--- Verification Complete ---");
}

runTest().catch(console.error);
