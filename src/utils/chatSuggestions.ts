import { ChatMessage } from '../services/chatService';

/**
 * Generates dynamic, context-aware follow-up question suggestions
 * based on the user's question and the LLM assistant's answer.
 */
export function generateLLMSuggestions(
  userQuery?: string,
  lastAssistantMsg?: string,
  messagesCount: number = 0
): string[] {
  if (!userQuery && (!lastAssistantMsg || messagesCount === 0)) {
    return [
      "📊 What is my total expense summary this month?",
      "💡 Give me 3 tips to reduce my spending",
      "📤 How do I export my transaction history?",
      "📷 How to scan receipts with Gemini OCR?",
    ];
  }

  const query = (userQuery || '').toLowerCase();
  const answer = (lastAssistantMsg || '').toLowerCase();
  const combined = `${query} ${answer}`;

  const suggestions: string[] = [];

  // Spending / Expense Summary / Categories
  if (combined.includes('spend') || combined.includes('expense') || combined.includes('total') || combined.includes('summary') || combined.includes('bought')) {
    suggestions.push("📊 Break this down by top categories");
    suggestions.push("📈 Compare this with last month's spend");
    suggestions.push("💡 Which category cost me the most?");
  }

  // Currency / Exchange rates / GBP / EUR / USD / INR
  if (combined.includes('gbp') || combined.includes('usd') || combined.includes('eur') || combined.includes('currency') || combined.includes('convert') || combined.includes('inr') || combined.includes('₹') || combined.includes('$') || combined.includes('£')) {
    suggestions.push("💱 Convert my total balance to EUR (€)");
    suggestions.push("💵 Show my top 5 transactions in USD ($)");
    suggestions.push("📊 Export multi-currency breakdown to CSV");
  }

  // Income / Budget / Salary
  if (combined.includes('income') || combined.includes('budget') || combined.includes('salary') || combined.includes('save') || combined.includes('savings')) {
    suggestions.push("🎯 Help me set up a 50/30/20 budget");
    suggestions.push("💡 How much can I save if I cut dining by 20%?");
    suggestions.push("⚖️ What is my net income to expense ratio?");
  }

  // Export / CSV / Report / Excel
  if (combined.includes('export') || combined.includes('csv') || combined.includes('excel') || combined.includes('download') || combined.includes('report')) {
    suggestions.push("📁 Save as detailed CSV file now");
    suggestions.push("📅 Filter export for current month only");
    suggestions.push("📊 Send expense summary to my email");
  }

  // Scanning / Receipt / OCR / UPI / Screenshots
  if (combined.includes('scan') || combined.includes('receipt') || combined.includes('upi') || combined.includes('screenshot') || combined.includes('paytm') || combined.includes('gpay')) {
    suggestions.push("📷 Take a photo of a paper receipt now");
    suggestions.push("🖼️ Upload payment screenshot from gallery");
    suggestions.push("❓ How does Gemini auto-match vendors?");
  }

  // Specific vendor / food / dining / shopping / travel
  if (combined.includes('food') || combined.includes('dining') || combined.includes('coffee') || combined.includes('swiggy') || combined.includes('zomato') || combined.includes('amazon') || combined.includes('uber')) {
    suggestions.push("🍔 How much did I spend on dining out this week?");
    suggestions.push("☕ Show all coffee & beverage purchases");
    suggestions.push("💡 Give me a strategy to cut food delivery costs");
  }

  // Generic intelligent follow-ups if less than 3 matching rule suggestions
  if (suggestions.length < 3) {
    // Extract key nouns/words from user query to make hyper-personalized prompt
    const words = query.replace(/[^\w\s]/gi, '').split(/\s+/).filter(w => w.length > 3);
    const mainTopic = words[0] || 'spending';

    suggestions.push(`🔍 Tell me more about my ${mainTopic} trends`);
    suggestions.push(`💡 What are action steps to optimize my ${mainTopic}?`);
    suggestions.push("📊 Show a detailed transaction list");
    suggestions.push("📥 How do I back up all my data?");
  }

  // Deduplicate and return top 4 distinct suggestions
  return Array.from(new Set(suggestions)).slice(0, 4);
}
