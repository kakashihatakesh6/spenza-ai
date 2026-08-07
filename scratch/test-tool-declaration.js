const { ChatGoogleGenerativeAI } = require('@langchain/google-genai');
const { tool } = require('@langchain/core/tools');
const { z } = require('zod');
require('dotenv').config();

const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;

const updateProfileTool = tool(
  async (input) => {
    return JSON.stringify({ success: true, updated: input });
  },
  {
    name: 'update_user_profile',
    description: 'Update the user display name, monthly income, preferred currency, language, or timezone in user settings.',
    schema: z.object({
      displayName: z.string().optional().describe('New display name or username'),
      monthlyIncome: z.number().optional().describe('Monthly income amount'),
      preferredCurrency: z.string().optional().describe('Preferred currency code e.g. USD, INR')
    })
  }
);

async function test() {
  const model = new ChatGoogleGenerativeAI({
    model: 'gemini-2.5-flash',
    apiKey: apiKey,
    temperature: 0
  });

  const modelWithTools = model.bindTools([updateProfileTool]);

  console.log("Invoking Gemini with tool binding...");
  const res = await modelWithTools.invoke([
    { role: 'system', content: 'You are an assistant. You must call tools whenever user asks to update their profile, income, or currency.' },
    { role: 'user', content: 'My monthly income is ₹90,000. Change my name to Nikhil and use USD instead of INR.' }
  ]);

  console.log("Result tool_calls:", res.tool_calls);
  console.log("Result content:", res.content);
}

test();
