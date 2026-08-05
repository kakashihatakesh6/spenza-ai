// @ts-nocheck
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { ChatOpenAI } from 'npm:@langchain/openai';
import { AIMessage, HumanMessage, SystemMessage, ToolMessage } from 'npm:@langchain/core/messages';
import { corsHeaders } from '../_shared/cors.ts';
import { getSupabaseClient, getServiceClient } from '../_shared/supabaseClient.ts';
import { ensureIngested } from './ingest.ts';
import { getAgentTools } from './tools/registry.ts';
import { Logger, AgentMetrics, ToolLogEntry } from './observability.ts';

serve(async (req) => {
  // Handle CORS preflight options
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const startTimeMs = Date.now();

  try {
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY') || Deno.env.get('EXPO_PUBLIC_GEMINI_API_KEY') || '';
    if (!geminiApiKey) {
      throw new Error('Gemini API key is not configured on the server for embeddings.');
    }

    const groqApiKey = Deno.env.get('GROQ_API_KEY') || Deno.env.get('EXPO_PUBLIC_GROQ_API_KEY') || '';
    if (!groqApiKey) {
      throw new Error('Groq API key is not configured on the server. Please set GROQ_API_KEY.');
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

    // Initialize Telemetry Metrics
    const metrics: AgentMetrics = {
      userId: user.id,
      conversationId: conversationId,
      startTimeMs,
      toolsCalled: []
    };

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
    await ensureIngested(supabaseAdmin, geminiApiKey);

    // 5. Rate Limiting (Per-user limit: Max 10 queries per minute, 50,000 daily tokens)
    const { data: userConvs } = await supabaseAdmin
      .from('chat_conversations')
      .select('id')
      .eq('user_id', user.id);

    const convIds = userConvs?.map((c) => c.id) || [];

    if (convIds.length > 0) {
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

    // 6. Retrieve Chat History
    const { data: historyMessages, error: historyError } = await supabaseAdmin
      .from('chat_messages')
      .select('role, content')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(8);

    if (historyError) {
      Logger.error('Failed to fetch chat history', historyError);
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

    // 7. Instantiate Registered Tools
    let collectedCitations: any[] = [];
    const tools = getAgentTools({
      supabaseClient,
      supabaseAdmin,
      userId: user.id,
      apiKey: geminiApiKey,
      onCitationsCollected: (cits) => {
        collectedCitations = [...collectedCitations, ...cits];
      },
      onToolExecuted: (logEntry: ToolLogEntry) => {
        metrics.toolsCalled.push(logEntry);
        Logger.logToolExecution(logEntry);
      }
    });

    const toolsByName = Object.fromEntries(tools.map(t => [t.name, t]));

    // 8. Construct Agent System Instructions
    const systemPromptText = `You are Spendly AI, a production-grade AI financial assistant and LangChain Agent.
Current Date: ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}

You are equipped with real, executable tools to perform actions on behalf of the user:
- update_user_profile(displayName, monthlyIncome, preferredCurrency, language, timezone, preferences): Call this tool WHENEVER the user provides or asks to update their display name, monthly income, preferred currency (USD, INR, EUR, etc.), language, timezone, or bio.
- get_user_profile(): Call this tool to fetch current profile details.
- update_transaction(transactionId, merchant, category, amount, currency, paymentMethod, date, notes): Call this tool WHENEVER the user asks to update an expense amount, category, merchant, date, or correct OCR errors.
- search_transactions(query, category, merchant, startDate, endDate, limit): Call this tool to find user expenses.
- get_financial_analytics(analysisType, month, year, category): Call this tool WHENEVER the user asks for spending totals, monthly/weekly/yearly spending, category/merchant breakdown, budget utilization, income vs expense, savings rate, or highest/lowest expenses.
- search_knowledge_base(query, topK): Call this tool WHENEVER the user asks about Spendly app features, OCR scanner, receipt upload, offline mode, guides, or policies.
- update_budget(category, amount, period): Call this tool WHENEVER the user asks to set, create, or update a budget limit (e.g. increase food budget to ₹6000).
- get_budgets(): Call this tool to view set category budgets.

MANDATORY RULES:
1. YOU MUST CALL THE APPROPRIATE TOOL FOR EVERY REQUEST MATCHING A TOOL CAPABILITY. NEVER claim you cannot perform updates or read user data—you HAVE the tools!
2. If the user request requires multiple operations (e.g. updating profile/budget AND calculating spending), YOU MUST CALL MULTIPLE TOOLS IN SEQUENCE.
3. When search_knowledge_base is used, cite documentation sources using brackets like [1], [2].
4. Always be professional, clear, accurate, and concise.`;

    // 9. Initialize Groq Model with Tool Binding (openai/gpt-oss-120b)
    const llm = new ChatOpenAI({
      modelName: 'openai/gpt-oss-120b',
      apiKey: groqApiKey,
      configuration: {
        baseURL: 'https://api.groq.com/openai/v1',
      },
      temperature: 0.2
    });

    const llmWithTools = llm.bindTools(tools);

    // 10. Agent Execution Loop
    const conversationMessages: any[] = [
      new SystemMessage(systemPromptText),
      ...langChainHistory,
      new HumanMessage(message)
    ];
    let finalStreamResult: any = null;
    let toolExecutionCount = 0;
    const MAX_TOOL_LOOPS = 5;

    Logger.info(`[ChatAgent] Starting Agent Execution Loop for query: "${message}"`);

    while (toolExecutionCount < MAX_TOOL_LOOPS) {
      const responseMessage = await llmWithTools.invoke(conversationMessages);
      conversationMessages.push(responseMessage);

      if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
        toolExecutionCount += 1;
        Logger.info(`[ChatAgent Loop ${toolExecutionCount}] Model requested ${responseMessage.tool_calls.length} tool call(s)`);

        for (const toolCall of responseMessage.tool_calls) {
          const targetTool = toolsByName[toolCall.name];
          if (!targetTool) {
            Logger.warn(`[ChatAgent Warning] Tool "${toolCall.name}" not found.`);
            conversationMessages.push(new ToolMessage({
              content: JSON.stringify({ error: `Tool ${toolCall.name} is not available.` }),
              tool_call_id: toolCall.id
            }));
            continue;
          }

          Logger.info(`[ChatAgent Executing Tool] Name: ${toolCall.name} | Args:`, toolCall.args);
          try {
            const toolResult = await targetTool.invoke(toolCall.args);
            conversationMessages.push(new ToolMessage({
              content: typeof toolResult === 'string' ? toolResult : JSON.stringify(toolResult),
              tool_call_id: toolCall.id
            }));
          } catch (toolErr: any) {
            Logger.error(`[ChatAgent Tool Error] ${toolCall.name}:`, toolErr);
            conversationMessages.push(new ToolMessage({
              content: JSON.stringify({ error: toolErr.message || 'Tool execution failed' }),
              tool_call_id: toolCall.id
            }));
          }
        }
      } else {
        finalStreamResult = responseMessage;
        break;
      }
    }

    // 11. Stream Response to Client via Server-Sent Events (SSE)
    const textEncoder = new TextEncoder();
    const fullResponseText = typeof finalStreamResult?.content === 'string' 
      ? finalStreamResult.content 
      : (Array.isArray(finalStreamResult?.content) ? finalStreamResult.content.map((c: any) => c.text || '').join('') : String(finalStreamResult?.content || ''));

    const responseStream = new ReadableStream({
      async start(controller) {
        // Send Citations Event First
        controller.enqueue(
          textEncoder.encode(`event: citations\ndata: ${JSON.stringify(collectedCitations)}\n\n`)
        );

        try {
          // Stream tokens in chunked packets for responsive SSE UI playback
          const chunkSize = 8;
          for (let i = 0; i < fullResponseText.length; i += chunkSize) {
            const tokenStr = fullResponseText.slice(i, i + chunkSize);
            controller.enqueue(
              textEncoder.encode(`event: token\ndata: ${JSON.stringify({ text: tokenStr })}\n\n`)
            );
            await new Promise(r => setTimeout(r, 15));
          }

          // 12. Token Usage & Storage Logging
          const promptLength = systemPromptText.length + message.length + JSON.stringify(conversationMessages).length;
          const promptTokens = Math.ceil(promptLength / 4);
          const completionTokens = Math.ceil(fullResponseText.length / 4);
          const totalTokens = promptTokens + completionTokens;
          const tokenUsage = { prompt_tokens: promptTokens, completion_tokens: completionTokens, total_tokens: totalTokens };

          metrics.endTimeMs = Date.now();
          metrics.tokenUsage = { promptTokens, completionTokens, totalTokens };
          Logger.logSummary(metrics);

          // Save User Message
          await supabaseAdmin.from('chat_messages').insert({
            conversation_id: conversationId,
            role: 'user',
            content: message,
          });

          // Save Assistant Message
          const { data: assistantMsg, error: asstMsgErr } = await supabaseAdmin
            .from('chat_messages')
            .insert({
              conversation_id: conversationId,
              role: 'assistant',
              content: fullResponseText,
              citations: collectedCitations,
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

          // Summarize conversation history if > 8 messages
          if ((historyMessages?.length || 0) >= 8) {
            try {
              const summarizerModel = new ChatOpenAI({
                modelName: 'openai/gpt-oss-120b',
                apiKey: groqApiKey,
                configuration: {
                  baseURL: 'https://api.groq.com/openai/v1',
                },
              });
              const summaryPrompt = `Concisely summarize key details and user preferences of this financial chat history in 3 sentences:\n\n${fullResponseText}`;
              const summaryRes = await summarizerModel.invoke(summaryPrompt);
              if (summaryRes.content) {
                await supabaseAdmin
                  .from('chat_conversations')
                  .update({ summary: summaryRes.content })
                  .eq('id', conversationId);
              }
            } catch (err) {
              Logger.warn('[ChatAgent] Background summarization failed', err);
            }
          }

          // Done Event
          controller.enqueue(
            textEncoder.encode(
              `event: done\ndata: ${JSON.stringify({
                message_id: assistantMsg.id,
                token_usage: tokenUsage,
              })}\n\n`
            )
          );
        } catch (streamError: any) {
          Logger.error('[ChatAgent Stream Error]', streamError);
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
    Logger.error(`[Chat API Fatal Error]`, error);
    return new Response(JSON.stringify({ error: error.message || 'Internal chat agent server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
