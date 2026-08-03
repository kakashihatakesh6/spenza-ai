const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function check() {
  console.log("Checking hosted Supabase tables...");
  
  // Test conversations
  const { data: convs, error: convsErr } = await supabase
    .from('chat_conversations')
    .select('count', { count: 'exact', head: true });
    
  if (convsErr) {
    console.error("Error querying chat_conversations:", convsErr.message);
  } else {
    console.log("chat_conversations table exists. Count:", convs);
  }

  // Test documents
  const { data: docs, error: docsErr } = await supabase
    .from('documents')
    .select('count', { count: 'exact', head: true });
    
  if (docsErr) {
    console.error("Error querying documents:", docsErr.message);
  } else {
    console.log("documents table exists. Count:", docs);
  }

  // Test RPC functions
  const { data: rpcTest, error: rpcErr } = await supabase.rpc('match_document_chunks', {
    query_embedding: Array(768).fill(0),
    match_threshold: 0.5,
    match_count: 1
  });

  if (rpcErr) {
    console.error("Error calling match_document_chunks:", rpcErr.message);
  } else {
    console.log("match_document_chunks RPC function exists and is callable.");
  }
}

check();
