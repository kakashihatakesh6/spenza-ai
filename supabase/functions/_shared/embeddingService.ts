const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retries = 5,
  backoff = 1000
): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, options);
      
      // Handle rate limits (429) or temporary server errors (5xx)
      if (response.status === 429 || response.status >= 500) {
        console.warn(`Gemini API warning (${response.status}). Retrying in ${backoff}ms...`);
        await delay(backoff);
        backoff *= 2;
        continue;
      }
      
      return response;
    } catch (err: any) {
      if (i === retries - 1) throw err;
      console.warn(`Gemini API connection error: ${err.message}. Retrying in ${backoff}ms...`);
      await delay(backoff);
      backoff *= 2;
    }
  }
  throw new Error('Failed to connect to Gemini API after maximum retries.');
}

export async function generateEmbedding(text: string, apiKey: string): Promise<number[]> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${apiKey}`;
  
  const payload = {
    model: 'models/gemini-embedding-001',
    content: {
      parts: [{ text }],
    },
  };

  const response = await fetchWithRetry(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Gemini Embedding Error (${response.status}): ${errorBody}`);
  }

  const result = await response.json();
  const values = result.embedding?.values;
  if (!values || !Array.isArray(values)) {
    throw new Error('Gemini API returned an invalid embedding format.');
  }

  return values;
}

export async function generateEmbeddingsBatch(texts: string[], apiKey: string): Promise<number[][]> {
  if (texts.length === 0) return [];
  
  // Gemini batch limits: Batch size up to 100 requests in one call
  const BATCH_LIMIT = 100;
  const allEmbeddings: number[][] = [];

  for (let i = 0; i < texts.length; i += BATCH_LIMIT) {
    const chunkBatch = texts.slice(i, i + BATCH_LIMIT);
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:batchEmbedContents?key=${apiKey}`;
    
    const requests = chunkBatch.map((text) => ({
      model: 'models/gemini-embedding-001',
      content: {
        parts: [{ text }],
      },
    }));

    const response = await fetchWithRetry(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requests }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Gemini Batch Embedding Error (${response.status}): ${errorBody}`);
    }

    const result = await response.json();
    const embeddings = result.embeddings;
    if (!embeddings || !Array.isArray(embeddings) || embeddings.length !== chunkBatch.length) {
      throw new Error('Gemini API batch request returned inconsistent embeddings.');
    }

    embeddings.forEach((emb: any) => {
      if (emb.values && Array.isArray(emb.values)) {
        allEmbeddings.push(emb.values);
      } else {
        throw new Error('Gemini batch item returned missing vector values.');
      }
    });
  }

  return allEmbeddings;
}
