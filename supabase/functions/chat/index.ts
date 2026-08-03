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

    // 4. Rate Limiting (Per-user limit: Max 10 queries per minute, 50,000 daily tokens)
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

    // 5. Generate Question Embedding
    console.log(`[Chat] Generating embedding for user question...`);
    const questionEmbedding = await generateEmbedding(message, apiKey);

    // 6. Similarity Vector & Keyword Hybrid Search
    console.log(`[Chat] Querying matching document chunks using hybrid search...`);
    const { data: matchedChunks, error: searchError } = await supabaseAdmin.rpc(
      'match_document_chunks_hybrid',
      {
        query_text: message,
        query_embedding: questionEmbedding,
        match_threshold: 0.35, // Adjust similarity filter
        match_count: 5, // Retrieve top 5 matching blocks
        filter_uploaded_by: null,
        vector_weight: 0.6,
        full_text_weight: 0.4
      }
    );

    if (searchError) {
      console.error('[Chat Error] Hybrid search failed:', searchError);
      throw new Error(`Vector search failed: ${searchError.message}`);
    }

    const citations = (matchedChunks || []).map((chunk: any) => ({
      chunk_id: chunk.chunk_id,
      title: chunk.document_title || chunk.document_filename,
      filename: chunk.document_filename,
      page_number: chunk.page_number,
      section: chunk.section,
      similarity: chunk.similarity,
    }));

    console.log(`[Chat] Found ${citations.length} related context chunks.`);

    // 7. Retrieve Chat History
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

    // 8. Construct Prompt
    const contextContent = (matchedChunks || [])
      .map((chunk: any, i: number) => {
        const sourceLabel = `[Source ${i + 1}: ${chunk.document_title || chunk.document_filename} (Page/Row ${chunk.page_number || 'N/A'})]`;
        return `${sourceLabel}\n${chunk.chunk_text}`;
      })
      .join('\n\n');

    const conversationSummaryText = conversation.summary
      ? `Previous conversation summary:\n${conversation.summary}\n\n`
      : '';

    const systemPromptText = `You are Spendly AI, an intelligent, professional financial ledger and document assistant.
You help users analyze documents, receipts, budgets, policies, and spreadsheets.

Answer the user's question using ONLY the provided sources/context.
Never fabricate details.
If the answer cannot be found in the provided sources/context, you MUST reply with exactly: "I'm sorry, I cannot find that information in the Spendly App Knowledge Base or Q&A guide."

When using information from a source, cite it in the body of your response using brackets, e.g. [1], [2].
At the end of your response, output a header "Sources:" followed by a numbered list of the sources used (Title, Page/Row).
Do not cite sources if you are outputting the fallback "I'm sorry, I cannot find that information..." message.

Context Sources:
{context}

{summary}
Answer the user's question accurately and objectively.`;

    const prompt = ChatPromptTemplate.fromMessages([
      ['system', systemPromptText],
      new MessagesPlaceholder('chat_history'),
      ['human', '{input}'],
    ]);

    // 9. Initialize Gemini LLM Streaming via LangChain
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
      context: contextContent || 'No context documents available.',
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

          // 10. Save User Message & Assistant Response in Database
          console.log(`[Chat] Saving message logs to database...`);
          
          // Estimate prompt and completion tokens (rough estimation: 1 token ~ 4 chars)
          const systemPromptTextLength = systemPromptText.length + (contextContent?.length || 0) + conversationSummaryText.length;
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

          // Asynchronous Conversation Summarization (trigger if history > 10 messages)
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
