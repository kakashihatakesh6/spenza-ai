const { ChatOpenAI } = require('@langchain/openai');
const { tool } = require('@langchain/core/tools');
const { z } = require('zod');

const groqApiKey = process.env.GROQ_API_KEY;

async function testLangChainGroq() {
  console.log('Testing LangChain ChatOpenAI with Groq baseURL and openai/gpt-oss-120b...');
  
  const sampleTool = tool(
    async ({ location }) => {
      return `The weather in ${location} is 72 degrees Fahrenheit and sunny.`;
    },
    {
      name: 'get_current_weather',
      description: 'Get current weather for a location',
      schema: z.object({
        location: z.string().describe('City and state, e.g. San Francisco, CA')
      })
    }
  );

  const model = new ChatOpenAI({
    modelName: 'openai/gpt-oss-120b',
    apiKey: groqApiKey,
    configuration: {
      baseURL: 'https://api.groq.com/openai/v1',
    },
    temperature: 0.2,
  });

  const modelWithTools = model.bindTools([sampleTool]);

  try {
    const res = await modelWithTools.invoke('What is the weather in San Francisco?');
    console.log('LangChain Response:', JSON.stringify(res, null, 2));
  } catch (err) {
    console.error('LangChain Error:', err);
  }
}

testLangChainGroq();
