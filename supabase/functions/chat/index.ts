// @ts-nocheck
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { ChatGoogleGenerativeAI } from 'npm:@langchain/google-genai';
import { ChatPromptTemplate, MessagesPlaceholder } from 'npm:@langchain/core/prompts';
import { StringOutputParser } from 'npm:@langchain/core/output_parsers';
import { RunnableSequence } from 'npm:@langchain/core/runnables';
import { AIMessage, HumanMessage } from 'npm:@langchain/core/messages';
import { corsHeaders } from '../_shared/cors.ts';
import { getSupabaseClient, getServiceClient } from '../_shared/supabaseClient.ts';
import { generateEmbedding } from '../_shared/embeddingService.ts';
import { ensureIngested } from './ingest.ts';

serve(async (req) => {
  // Handle CORS preflight options
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('GEMINI_API_KEY') || Deno.env.get('EXPO_PUBLIC_GEMINI_API_KEY') || '';
    if (!apiKey) {
      throw new Error('Gemini API key is not configured on the server.');
    }

    // 1. Authenticate the User
    const supabaseClient = getSupabaseClient(req);
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized: Invalid or missing JWT' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Parse request payload
    const { conversationId, message } = await req.json();
    if (!conversationId || !message) {
      return new Response(JSON.stringify({ error: 'Missing conversationId or message.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Sanitize message size
    if (message.length > 4000) {
      return new Response(JSON.stringify({ error: 'Message length exceeds maximum limit of 4000 characters.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseAdmin = getServiceClient();

    // 3. Verify conversation ownership
    const { data: conversation, error: convError } = await supabaseAdmin
      .from('chat_conversations')
      .select('*')
      .eq('id', conversationId)
      .eq('user_id', user.id)
      .single();

    if (convError || !conversation) {
      return new Response(JSON.stringify({ error: 'Conversation not found or unauthorized.' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 4. Run Automatic Ingestion Pipeline
    console.log(`[Chat] Checking knowledge base documents ingestion status...`);
    await ensureIngested(supabaseAdmin, apiKey);

    // 5. Rate Limiting (Per-user limit: Max 10 queries per minute, 50,000 daily tokens)
    const { data: userConvs } = await supabaseAdmin
      .from('chat_conversations')
      .select('id')
      .eq('user_id', user.id);

    const convIds = userConvs?.map((c) => c.id) || [];

    if (convIds.length > 0) {
      // Message count limit checking (1 minute window)
      const oneMinuteAgo = new Date(Date.now() - 60 * 1000).toISOString();
      const { count: minuteMsgCount, error: countError } = await supabaseAdmin
        .from('chat_messages')
        .select('id', { count: 'exact', head: true })
        .in('conversation_id', convIds)
        .eq('role', 'user')
        .gte('created_at', oneMinuteAgo);

      if (countError) throw countError;
      if (minuteMsgCount && minuteMsgCount >= 10) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded: Max 10 messages per minute. Please wait.' }),
          {
            status: 429,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      // Token count limit checking (24 hour window)
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: dailyMsgs } = await supabaseAdmin
        .from('chat_messages')
        .select('token_usage')
        .in('conversation_id', convIds)
        .gte('created_at', oneDayAgo);

      let dailyTokensUsed = 0;
      dailyMsgs?.forEach((m) => {
        const usage = m.token_usage as any;
        if (usage && typeof usage.total_tokens === 'number') {
          dailyTokensUsed += usage.total_tokens;
        }
      });

      if (dailyTokensUsed >= 50000) {
        return new Response(
          JSON.stringify({ error: 'Daily token budget limit reached. Reset in 24 hours.' }),
          {
            status: 429,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
    }

    // 6. Intelligent Query Router
    let route = 'RAG';
    const classificationPrompt = `You are a query router. Classify the user query into one of these categories:
- "DATABASE": Questions asking about the user's specific financial data, transactions, expenses, budget, savings, spending totals, categories, or recent logs.
- "RAG": Questions asking about the Spendly app itself, its features, OCR receipt scanner, UPI screenshot detection, offline mode, rate limits, guides, FAQ, or how to use the app.
- "BOTH": Questions that require querying the database for user data AND reference the Spendly app's knowledge base.
- "GENERAL": General chit-chat or questions that don't fit any of the above.

Query: "${message}"

Respond with ONLY one word from: DATABASE, RAG, BOTH, GENERAL.`;

    try {
      const classifierRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: classificationPrompt }] }]
        })
      });
      if (classifierRes.ok) {
        const data = await classifierRes.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim()?.toUpperCase() || '';
        if (text.includes('DATABASE')) route = 'DATABASE';
        else if (text.includes('RAG')) route = 'RAG';
        else if (text.includes('BOTH')) route = 'BOTH';
        else if (text.includes('GENERAL')) route = 'GENERAL';
      }
    } catch (e) {
      console.warn('[Chat Router] Gemini classifier failed. Using keyword fallback.', e);
      // Fallback keyword match
      const text = message.toLowerCase();
      const dbKeywords = ['spend', 'spent', 'budget', 'transaction', 'category', 'categories', 'report', 'chart', 'analytic', 'save', 'saving', 'expense', 'cost', 'price', 'buy', 'bought', 'pay', 'paid', 'july', 'august', 'month', 'recent'];
      const ragKeywords = ['spendly', 'faq', 'ocr', 'receipt', 'screenshot', 'upi', 'app', 'usage', 'documentation', 'doc', 'guide', 'manual', 'policy', 'policies', 'help', 'knowledge', 'kb'];
      
      const matchesDb = dbKeywords.some(kw => text.includes(kw));
      const matchesRag = ragKeywords.some(kw => text.includes(kw));
      
      if (matchesDb && matchesRag) route = 'BOTH';
      else if (matchesDb) route = 'DATABASE';
      else if (matchesRag) route = 'RAG';
      else route = 'GENERAL';
    }

    console.log(`[Chat Router] Query: "${message}" -> Route: ${route}`);

    // 7. Context Retrieval based on Route
    let databaseContext = 'No personal financial data was retrieved for this request.\n';
    let documentContext = 'No relevant knowledge base documents available.\n';
    let citations = [];

    // Route: Query user database
    if (route === 'DATABASE' || route === 'BOTH') {
      try {
        console.log(`[Chat] Fetching user transaction data (respecting RLS)...`);
        const { data: expenses, error: expensesError } = await supabaseClient
          .from('expenses')
          .select('amount, merchant, category, currency, transaction_date, notes')
          .order('transaction_date', { ascending: false });

        if (expensesError) {
          console.error('[Chat Error] Failed to fetch user data:', expensesError);
        } else {
          const budgets = user.user_metadata?.budgets || [];
          databaseContext = `User's Registered Budgets (stored in user metadata):
${budgets.length > 0 ? JSON.stringify(budgets, null, 2) : 'No budgets registered.'}

User's Expense/Transaction Logs (Total: ${expenses.length}):
${expenses.length > 0 
  ? expenses.map(e => `- Date: ${e.transaction_date}, Merchant: ${e.merchant}, Amount: ${e.amount} ${e.currency}, Category: ${e.category}${e.notes ? ` (Notes: ${e.notes})` : ''}`).join('\n')
  : 'No transaction logs found.'}
`;
        }
      } catch (dbErr) {
        console.error('[Chat Error] Database context fetch error:', dbErr);
      }
    }

    // Route: Query pgvector RAG
    if (route === 'RAG' || route === 'BOTH') {
      try {
        console.log(`[Chat] Generating embedding for user question...`);
        const questionEmbedding = await generateEmbedding(message, apiKey);

        console.log(`[Chat] Querying matching document chunks using hybrid search...`);
        const { data: matchedChunks, error: searchError } = await supabaseAdmin.rpc(
          'match_document_chunks_hybrid',
          {
            query_text: message,
            query_embedding: questionEmbedding,
            match_threshold: 0.35, // Cosine similarity confidence threshold
            match_count: 5,       // Top-K relevant chunks
            filter_uploaded_by: null,
            vector_weight: 0.6,
            full_text_weight: 0.4
          }
        );

        if (searchError) {
          console.error('[Chat Error] Hybrid search failed:', searchError);
        } else if (matchedChunks && matchedChunks.length > 0) {
          // Remove duplicate chunks
          const seen = new Set();
          const uniqueChunks = [];
          for (const chunk of matchedChunks) {
            if (!seen.has(chunk.chunk_text)) {
              seen.add(chunk.chunk_text);
              uniqueChunks.push(chunk);
            }
          }

          citations = uniqueChunks.map((chunk: any) => ({
            chunk_id: chunk.chunk_id,
            title: chunk.document_title || chunk.document_filename,
            filename: chunk.document_filename,
            page_number: chunk.page_number,
            section: chunk.section,
            similarity: chunk.similarity,
          }));

          documentContext = uniqueChunks
            .map((chunk: any, i: number) => {
              const sourceLabel = `[Source ${i + 1}: ${chunk.document_title || chunk.document_filename} (Page/Row ${chunk.page_number || 'N/A'})]`;
              return `${sourceLabel}\n${chunk.chunk_text}`;
            })
            .join('\n\n');
        }
      } catch (ragErr) {
        console.error('[Chat Error] pgvector RAG retrieval error:', ragErr);
      }
    }

    // 8. Retrieve Chat History
    const { data: historyMessages, error: historyError } = await supabaseAdmin
      .from('chat_messages')
      .select('role, content')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(8); // context window of last 8 messages

    if (historyError) {
      console.error('[Chat Error] Failed to fetch history:', historyError);
    }

    const langChainHistory = (historyMessages || []).map((msg) => {
      if (msg.role === 'assistant') {
        return new AIMessage(msg.content);
      } else {
        return new HumanMessage(msg.content);
      }
    });

    const conversationSummaryText = conversation.summary
      ? `Previous conversation summary:\n${conversation.summary}\n\n`
      : '';

    // 9. Construct System Prompt
    const systemPromptText = `You are Spendly AI, an intelligent, professional financial ledger and document assistant.
You help users analyze documents, receipts, budgets, policies, and spreadsheets, as well as their own financial data (expenses, budgets, savings, transactions).

Here is the current date and time context:
Current Date/Time: ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}

You have access to two types of context sources:
1. PERSONAL FINANCIAL DATA (if relevant): The authenticated user's actual expenses and budgets.
2. SPENDLY KNOWLEDGE BASE DOCUMENTS (if relevant): Facts about the Spendly app features, FAQs, OCR scanner, offline syncing, etc.

=== CONTEXT SOURCES ===
--- PERSONAL FINANCIAL DATA ---
{database_context}

--- SPENDLY KNOWLEDGE BASE DOCUMENTS ---
{document_context}
=======================

CRITICAL RULES:
1. When answering questions about user transactions, expenses, budgets, categories, or savings, rely ONLY on the "PERSONAL FINANCIAL DATA" context. Never make up transactions or numbers. Respect the user's privacy and default to their listed currency.
   - If the user asks about savings, calculate it as Total Income minus Total Expenses. A transaction is considered income if its category contains "salary" or "income" (case-insensitive); other transactions are expenses.
   - If the user asks about budgets, compare their total category spending against their budgets in user metadata.
2. When answering questions about Spendly features, FAQs, app usage, OCR, policies, or documentation, rely ONLY on the "SPENDLY KNOWLEDGE BASE DOCUMENTS" context.
   - When using information from these documents, cite the source in the body of your response using brackets, e.g. [1], [2].
   - At the end of your response, output a header "Sources:" followed by a numbered list of the sources used (Title, Page/Row).
   - If the answer cannot be found in the provided sources/context, you MUST reply with exactly: "I'm sorry, I cannot find that information in the Spendly App Knowledge Base or Q&A guide."
3. Do not cite sources if you are outputting the fallback "I'm sorry, I cannot find that information..." message.
4. If a question requires both personal financial data and Spendly app guidelines, integrate both cleanly in a single, comprehensive response.
5. If the question is a general greeting or completely unrelated, respond politely as a helpful financial assistant, but state that you are designed to assist with Spendly app features and personal expense tracking.

Answer the user's question accurately and objectively.`;

    const prompt = ChatPromptTemplate.fromMessages([
      ['system', systemPromptText],
      new MessagesPlaceholder('chat_history'),
      ['human', '{input}'],
    ]);

    // 10. Initialize Gemini LLM Streaming via LangChain
    console.log(`[Chat] Calling Gemini streaming API via LangChain...`);
    const model = new ChatGoogleGenerativeAI({
      model: 'gemini-2.5-flash',
      apiKey: apiKey,
      streaming: true,
    });

    const chain = RunnableSequence.from([
      prompt,
      model,
      new StringOutputParser(),
    ]);

    const resultStream = await chain.stream({
      database_context: databaseContext,
      document_context: documentContext,
      summary: conversationSummaryText,
      chat_history: langChainHistory,
      input: message,
    });

    // Create ReadableStream to send Server-Sent Events (SSE)
    const textEncoder = new TextEncoder();
    let fullResponseText = '';

    const responseStream = new ReadableStream({
      async start(controller) {
        // First Event: Send Citations Metadata
        controller.enqueue(
          textEncoder.encode(`event: citations\ndata: ${JSON.stringify(citations)}\n\n`)
        );

        try {
          for await (const token of resultStream) {
            if (token) {
              fullResponseText += token;
              // Stream Token Event
              controller.enqueue(
                textEncoder.encode(`event: token\ndata: ${JSON.stringify({ text: token })}\n\n`)
              );
            }
          }

          // 11. Save User Message & Assistant Response in Database
          console.log(`[Chat] Saving message logs to database...`);
          
          // Estimate prompt and completion tokens (rough estimation: 1 token ~ 4 chars)
          const systemPromptTextLength = systemPromptText.length + (databaseContext?.length || 0) + (documentContext?.length || 0) + conversationSummaryText.length;
          const promptTokens = Math.ceil(systemPromptTextLength / 4) + Math.ceil(message.length / 4);
          const completionTokens = Math.ceil(fullResponseText.length / 4);
          const totalTokens = promptTokens + completionTokens;
          const tokenUsage = { prompt_tokens: promptTokens, completion_tokens: completionTokens, total_tokens: totalTokens };

          // Insert user message
          const { data: userMsg, error: userMsgErr } = await supabaseAdmin
            .from('chat_messages')
            .insert({
              conversation_id: conversationId,
              role: 'user',
              content: message,
            })
            .select('id')
            .single();

          if (userMsgErr) throw userMsgErr;

          // Insert assistant response
          const { data: assistantMsg, error: asstMsgErr } = await supabaseAdmin
            .from('chat_messages')
            .insert({
              conversation_id: conversationId,
              role: 'assistant',
              content: fullResponseText,
              citations: citations,
              token_usage: tokenUsage,
            })
            .select('id')
            .single();

          if (asstMsgErr) throw asstMsgErr;

          // Update conversation timestamp
          await supabaseAdmin
            .from('chat_conversations')
            .update({ updated_at: new Date().toISOString() })
            .eq('id', conversationId);

          // Asynchronous Conversation Summarization (trigger if history > 8 messages)
          if ((historyMessages?.length || 0) >= 8) {
            const allMessagesForSummary = [...(historyMessages || []), { role: 'user', content: message }, { role: 'assistant', content: fullResponseText }]
              .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
              .join('\n');
              
            // Fire-and-forget summary request
            try {
              const summarizerModel = new ChatGoogleGenerativeAI({
                model: 'gemini-2.5-flash',
                apiKey: apiKey,
              });
              const summaryPrompt = `Summarize the key discussion points and context of the following financial chat history concisely in 3-4 sentences. Do not mention specific greetings, just save user queries and policy resolutions:\n\n${allMessagesForSummary}`;
              const summaryRes = await summarizerModel.invoke(summaryPrompt);
              const summaryText = summaryRes.content;
              
              if (summaryText) {
                await supabaseAdmin
                  .from('chat_conversations')
                  .update({ summary: summaryText })
                  .eq('id', conversationId);
                console.log('[Chat] Summarized conversation history successfully.');
              }
            } catch (err) {
              console.warn('[Chat] Failed to generate conversation summary background task:', err);
            }
          }

          // Final SSE Event: Done
          controller.enqueue(
            textEncoder.encode(
              `event: done\ndata: ${JSON.stringify({
                message_id: assistantMsg.id,
                token_usage: tokenUsage,
              })}\n\n`
            )
          );
        } catch (streamError: any) {
          console.error('[Chat Stream Error]', streamError);
          controller.enqueue(
            textEncoder.encode(
              `event: error\ndata: ${JSON.stringify({ error: streamError.message })}\n\n`
            )
          );
        } finally {
          controller.close();
        }
      },
    });

    return new Response(responseStream, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error: any) {
    console.error(`[Chat API Error]`, error);
    return new Response(JSON.stringify({ error: error.message || 'Internal chat server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
