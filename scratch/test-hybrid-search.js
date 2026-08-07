const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;

if (!supabaseUrl || !supabaseAnonKey || !apiKey) {
  console.error("Missing configuration in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function runSearch() {
  const query = "What is Spendly?";
  console.log(`Generating embedding for query: "${query}"...`);

  // Generate real embedding (768 dimensions)
  const embedUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${apiKey}`;
  const embedRes = await fetch(embedUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'models/gemini-embedding-001',
      content: { parts: [{ text: query }] },
      outputDimensionality: 768
    })
  });

  if (!embedRes.ok) {
    console.error("Failed to generate query embedding:", await embedRes.text());
    return;
  }

  const embedData = await embedRes.json();
  const embedding = embedData.embedding.values;
  console.log("Generated embedding with dimension:", embedding.length);

  console.log("Running hybrid search on remote database...");
  const { data, error } = await supabase.rpc('match_document_chunks_hybrid', {
    query_text: query,
    query_embedding: embedding,
    match_threshold: 0.3,
    match_count: 5,
    vector_weight: 0.6,
    full_text_weight: 0.4
  });

  if (error) {
    console.error("RPC Error:", error.message);
  } else {
    console.log("RPC Succeeded! Matched chunks:", data.length);
    data.forEach((chunk, index) => {
      console.log(`\n[Match ${index + 1}] Similarity: ${chunk.similarity.toFixed(4)} | File: ${chunk.document_filename}`);
      console.log(`Text:\n${chunk.chunk_text}`);
    });
  }
}

runSearch();
