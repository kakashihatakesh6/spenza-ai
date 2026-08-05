require('dotenv').config();
const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;

async function listModels() {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
  const data = await res.json();
  console.log("Available models:");
  if (data.models) {
    data.models.forEach(m => {
      if (m.name.includes('flash') || m.name.includes('gemini')) {
        console.log("-", m.name, "supportedMethods:", m.supportedGenerationMethods);
      }
    });
  } else {
    console.log(data);
  }
}

listModels();
