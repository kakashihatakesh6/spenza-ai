const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Missing credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testSession() {
  console.log("Checking Supabase Auth session capability...");
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    console.error("Get session error:", error.message);
  } else {
    console.log("Current session found:", data?.session ? "YES" : "NO (Guest/Unauthenticated)");
  }
}

testSession();
