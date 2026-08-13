const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(url, key);

async function testFeedbackTable() {
  console.log('Testing chat_feedback table on Supabase Cloud...');
  const { data, error } = await supabase.from('chat_feedback').select('*').limit(1);
  if (error) {
    console.error('Error querying chat_feedback:', error);
  } else {
    console.log('Success! chat_feedback table exists and is accessible. Rows:', data);
  }
}

testFeedbackTable();
