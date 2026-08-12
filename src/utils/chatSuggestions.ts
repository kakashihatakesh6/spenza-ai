import { logger } from '../services/logger';

const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY || '';
const GROQ_API_KEY =
  process.env.EXPO_PUBLIC_GROQ_API_KEY ||
  process.env.GROQ_API_KEY

// In-memory cache for prompt suggestions by conversation context
const suggestionCache: Record<string, string[]> = {};

/**
 * Dynamically generates follow-up question suggestions using LLM:
 * 1. Groq API (Primary LLM)
 * 2. Gemini API (Secondary LLM Fallback)
 * 3. Dynamic Context Extractor (Offline Fallback)
 * based directly on the user's latest query and the assistant's latest response.
 */
export async function fetchLLMGeneratedSuggestions(
  userQuery?: string,
  lastAssistantMsg?: string
): Promise<string[]> {
  if (!userQuery || !lastAssistantMsg) {
    return [
      "📊 What is my total expense summary this month?",
      "💡 Give me 3 tips to reduce my spending",
      "📤 How do I export my transaction history?",
    ];
  }

  const cacheKey = `${userQuery.slice(0, 100)}::${lastAssistantMsg.slice(0, 100)}`;
  if (suggestionCache[cacheKey]) {
    return suggestionCache[cacheKey];
  }

  // 1. Primary LLM: Groq API (llama-3.3-70b-versatile)
  if (GROQ_API_KEY) {
    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            {
              role: 'system',
              content:
                'You are a financial chat assistant. Based on the user query and assistant response, return ONLY a JSON array of 3 short follow-up questions that the user might ask next. Example format: ["Question 1?", "Question 2?", "Question 3?"]. Do NOT output code blocks or additional prose.',
            },
            {
              role: 'user',
              content: `User query: "${userQuery}"\nAssistant response: "${lastAssistantMsg}"`,
            },
          ],
          temperature: 0.6,
          max_tokens: 150,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const rawText = data?.choices?.[0]?.message?.content || '';
        const cleanJson = rawText.replace(/```json|```/g, '').trim();
        const parsed = JSON.parse(cleanJson);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const cleaned = parsed
            .map((s: string) => String(s).replace(/^[\u1F300-\u1F9FF\u2600-\u26FF\u2700-\u27BF\s]+/, '').trim())
            .filter(Boolean)
            .slice(0, 3);

          if (cleaned.length > 0) {
            suggestionCache[cacheKey] = cleaned;
            return cleaned;
          }
        }
      } else {
        const errText = await response.text().catch(() => '');
        logger.warn('Groq API suggestion error:', response.status, errText);
      }
    } catch (err) {
      logger.warn('Failed to fetch LLM suggestions from Groq API, falling back to Gemini API:', err);
    }
  }

  // 2. Secondary LLM Fallback: Gemini API (gemini-1.5-flash)
  if (GEMINI_API_KEY) {
    try {
      const prompt = `You are a helpful personal finance AI assistant.
Based on this recent user-assistant interaction:
User Question: "${userQuery.slice(0, 300)}"
Assistant Answer: "${lastAssistantMsg.slice(0, 500)}"

Generate exactly 3 short, relevant, and natural follow-up questions or next actions the user might want to ask next based strictly on the response above.
Return ONLY a raw JSON array of 3 strings, e.g. ["Can you break this down further?", "What about next month?", "Show top 3 spending items"]. Do NOT add code block markdown tags or extra text.`;

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 150,
            },
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        const cleanJson = rawText.replace(/```json|```/g, '').trim();
        const parsed = JSON.parse(cleanJson);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const cleaned = parsed
            .map((s: string) => String(s).replace(/^[\u1F300-\u1F9FF\u2600-\u26FF\u2700-\u27BF\s]+/, '').trim())
            .filter(Boolean)
            .slice(0, 3);

          if (cleaned.length > 0) {
            suggestionCache[cacheKey] = cleaned;
            return cleaned;
          }
        }
      }
    } catch (err) {
      logger.warn('Failed to fetch LLM suggestions from Gemini API, falling back to dynamic context extractor:', err);
    }
  }

  // 3. Third Fallback: Contextual Dynamic Extractor (offline mode)
  return extractDynamicSuggestionsFromContext(userQuery, lastAssistantMsg);
}

/**
 * Parses keywords and subjects directly out of lastAssistantMsg & userQuery to generate follow-up prompts dynamically.
 */
export function extractDynamicSuggestionsFromContext(
  userQuery: string = '',
  lastAssistantMsg: string = ''
): string[] {
  const text = `${lastAssistantMsg} ${userQuery}`.trim();
  if (!text) {
    return [
      "📊 What is my total expense summary this month?",
      "💡 Give me 3 tips to reduce my spending",
      "📤 How do I export my transaction history?",
    ];
  }

  const stopWords = new Set([
    'this', 'that', 'with', 'from', 'your', 'have', 'been', 'were', 'about', 'there',
    'which', 'would', 'could', 'should', 'these', 'those', 'where', 'other', 'total',
    'amount', 'based', 'using', 'first', 'after', 'before', 'above', 'below', 'under'
  ]);

  // Extract key terms (words longer than 3 characters, excluding stop words)
  const cleanMsg = text.replace(/[^a-zA-Z0-9\s]/g, ' ');
  const words = cleanMsg.split(/\s+/).filter((w) => w.length > 3 && !stopWords.has(w.toLowerCase()));

  // Get top 3 unique terms from the assistant's response
  const topics = Array.from(
    new Set(words.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
  ).slice(0, 3);

  const suggestions: string[] = [];

  if (topics[0]) {
    suggestions.push(`💡 Tell me more details about ${topics[0]}`);
  }
  if (topics[1]) {
    suggestions.push(`📊 How does ${topics[1]} impact my monthly budget?`);
  }
  if (topics[2]) {
    suggestions.push(`📈 What are key insights regarding ${topics[2]}?`);
  } else if (topics[0]) {
    suggestions.push(`💡 What are actionable next steps for ${topics[0]}?`);
  }

  if (suggestions.length < 3) {
    suggestions.push("💡 Can you elaborate further on this response?");
    suggestions.push("📊 What else should I know about this topic?");
  }

  return suggestions.slice(0, 3);
}

/**
 * Synchronous wrapper for backwards compatibility
 */
export function generateLLMSuggestions(
  userQuery?: string,
  lastAssistantMsg?: string,
  messagesCount: number = 0
): string[] {
  const cacheKey = `${(userQuery || '').slice(0, 100)}::${(lastAssistantMsg || '').slice(0, 100)}`;
  if (suggestionCache[cacheKey]) {
    return suggestionCache[cacheKey];
  }
  return extractDynamicSuggestionsFromContext(userQuery, lastAssistantMsg);
}
