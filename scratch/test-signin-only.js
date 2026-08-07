const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  const email = `test-rag-static-user@spendly.ai`;
  const password = "Password123!";
  
  console.log("Signing in...");
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });
  if (error) {
    console.error("Sign in failed:", error.message);
  } else {
    console.log("Sign in successful! User ID:", data.user.id);
  }
}

run();
