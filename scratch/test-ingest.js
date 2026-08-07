const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Missing credentials in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function runIngestTest() {
  console.log("Signing in guest user...");
  // Use email login or sign up with confirmation bypassed if possible
  // Let's create a temporary session
  // Wait, let's select a recent user if possible or list them, or use a guest login if we can.
  // Wait, let's check if we can sign in using an anonymous sign in or guest session.
  // Actually, we don't need to authenticate the user to create a document if we bypass using the admin key?
  // No, the Edge Function reads req.headers.get('Authorization')?
  // Let's check: ingest-document/index.ts DOES NOT call supabaseClient.auth.getUser()!
  // Let's verify line 8-30 of ingest-document/index.ts:
  // It only retrieves `documentId` from body, and immediately calls `getServiceClient()`.
  // It does NOT perform any user authorization check!
  // Wow, that is extremely convenient for testing! It means we can call the ingest-document Edge Function directly with any document ID using the anon key or service role key!

  // Let's find an existing document ID, or create a mock document directly using a direct SQL/DB client if RLS allows,
  // or insert a mock document record.
  // But wait, documents table has RLS enabled. If we query using anon key, we won't see anything.
  // But we have the service role key hash. Wait, we don't have the cleartext service role key.
  // Wait! Can we insert a document using a test account?
  // Let's check if there is an existing user session we can restore, or if we can sign in.
  // Wait! In the Metro logs, a user session is restored:
  // "Session restored"
  // Can we create a user session?
  // Let's sign up with email and password. If email confirmation is enabled, it returns data.user but session: null.
  // Wait, is there any user that has already signed up?
  // Let's write a script to try to sign up/in or check if there is any user in the DB.
  // Wait! The client app does sign up / sign in. If a user is already logged in, they have an account.
  // Let's try to sign up with a random email. If it succeeds and returns a session, great! If not, let's try to log in.
  // Wait, what if we sign in anonymously?
  const email = `test-ingest-${Date.now()}@spendly.ai`;
  const password = "Password123!";
  
  const { data: signUpData } = await supabase.auth.signUp({
    email,
    password
  });

  const session = signUpData?.session;
  if (!session) {
    console.log("Auth session not obtained directly (requires email confirmation). Trying sign in...");
  } else {
    console.log("Signed up successfully!");
  }

  // If we can't authenticate, we can try to call the edge function anyway.
  // Let's see if we can query any existing documents in the DB (maybe RLS is disabled or has public select?).
  const { data: docs, error: selectErr } = await supabase.from('documents').select('*');
  console.log("Checking visible documents:", docs, selectErr);
}

runIngestTest();
