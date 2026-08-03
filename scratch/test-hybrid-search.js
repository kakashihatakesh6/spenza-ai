const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function runSearch() {
  console.log("Running hybrid search on hosted DB...");
  const dummyEmbedding = Array(768).fill(0);
  
  const { data, error } = await supabase.rpc('match_document_chunks_hybrid', {
    query_text: "tell me about today's expenses",
    query_embedding: dummyEmbedding,
    match_threshold: 0.35,
    match_count: 5,
    vector_weight: 0.6,
    full_text_weight: 0.4
  });

  if (error) {
    console.error("RPC Error:", error.message);
    console.error(error);
  } else {
    console.log("RPC Succeeded! Results found:", data.length);
  }
}

runSearch();
