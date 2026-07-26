import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { Asset } from 'expo-asset';
import { useSettingsStore } from '../store/settingsStore';

export interface OcrResult {
  merchant: string;
  amount: number;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  tax: number;
  currency: string;
  paymentMethod: string;
  items: { name: string; price: number; quantity: number }[];
  confidence: number;
  transactionId?: string; // For screenshots
  isScreenshot?: boolean;
}

const presetAssets: Record<string, any> = {
  starbucks: require('../../assets/images/starbucks_receipt.png'),
  vmart: require('../../assets/images/walmart_receipt.png'),
  walmart: require('../../assets/images/walmart_receipt.png'),
  amazon: require('../../assets/images/walmart_receipt.png'),
  shell: require('../../assets/images/starbucks_receipt.png'),
  gpay_upi: require('../../assets/images/gpay_screenshot.png'),
  phonepe_upi: require('../../assets/images/gpay_screenshot.png'),
  paytm_upi: require('../../assets/images/gpay_screenshot.png'),
};

async function getBase64FromUri(uri: string): Promise<{ base64: string; mimeType: string }> {
  let mimeType = 'image/jpeg';
  if (uri.endsWith('.png')) {
    mimeType = 'image/png';
  } else if (uri.endsWith('.webp')) {
    mimeType = 'image/webp';
  }

  // Web fallback or remote URL
  if (uri.startsWith('http://') || uri.startsWith('https://') || uri.startsWith('data:') || Platform.OS === 'web') {
    const response = await fetch(uri);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = (reader.result as string).split(',')[1];
        resolve({ base64: base64String, mimeType });
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  // Native FileSystem
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: 'base64',
  });
  return { base64, mimeType };
}

export const ocrService = {
  /**
   * Extracts transaction details from a receipt or payment screenshot image.
   * Connects to the Gemini Cloud API if configured, otherwise falls back to local simulation.
   */
  async extractReceipt(imageUri: string, typePreset?: string): Promise<OcrResult> {
    const settings = useSettingsStore.getState().settings;
    const rawApiKey = process.env.GEMINI_API_KEY ||
                      settings.geminiApiKey;
    const apiKey = rawApiKey ? rawApiKey.trim() : '';

    console.log('DEBUG: Using Gemini API Key (masked):', apiKey ? apiKey.substring(0, 10) + '...' + apiKey.substring(apiKey.length - 5) : 'undefined');

    const isMockUri = imageUri.startsWith('mock_');
    const useCloud = settings.ocrEngine === 'cloud' || !isMockUri;

    if (useCloud) {
      if (!apiKey) {
        throw new Error('Gemini API key is not configured. Please set it in Settings to perform actual OCR text extraction.');
      }

      let targetUri = imageUri;
      let isScreenshotPreset = false;

      // If it's a mock preset URI and we have an API key, we run real OCR on the corresponding generated asset image
      if (isMockUri) {
        const presetKey = typePreset || this._detectPreset(imageUri);
        const assetModule = presetAssets[presetKey];
        if (assetModule) {
          try {
            const asset = Asset.fromModule(assetModule);
            await asset.downloadAsync();
            targetUri = asset.localUri || asset.uri;
            if (presetKey.endsWith('_upi')) {
              isScreenshotPreset = true;
            }
          } catch (assetError) {
            console.error('Failed to load asset for preset:', presetKey, assetError);
          }
        }
      }

      try {
        const { base64, mimeType } = await getBase64FromUri(targetUri);
        
        // Define Gemini API payload with JSON Schema
        const responseSchema = {
          type: "OBJECT",
          properties: {
            merchant: { type: "STRING" },
            amount: { type: "NUMBER" },
            date: { type: "STRING" },
            time: { type: "STRING" },
            tax: { type: "NUMBER" },
            currency: { type: "STRING" },
            paymentMethod: { type: "STRING" },
            items: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  name: { type: "STRING" },
                  price: { type: "NUMBER" },
                  quantity: { type: "INTEGER" }
                },
                required: ["name", "price", "quantity"]
              }
            },
            confidence: { type: "NUMBER" },
            transactionId: { type: "STRING" },
            isScreenshot: { type: "BOOLEAN" },
            isBill: { type: "BOOLEAN" }
          },
          required: ["merchant", "amount", "date", "time", "tax", "currency", "paymentMethod", "items", "confidence", "isScreenshot", "isBill"]
        };

        const payload = {
          contents: [
            {
              parts: [
                {
                  text: `You are an expert OCR and financial data extraction assistant.
Analyze the provided image of a receipt, invoice, bill, or payment transfer screenshot (such as Google Pay, PhonePe, Paytm, etc.).
Extract the transaction details exactly as they appear in the image, matching the requested JSON schema.

Follow these strict guidelines:
- "merchant": Extract the official name of the store, merchant, company, or individual to whom the money was paid.
- "amount": Extract the final total amount paid (this should be the final sum, including tax and after any discounts). Ensure it is a number.
- "date": Extract the transaction date. Convert it to 'YYYY-MM-DD' format. If no date is found, use today's date.
- "time": Extract the transaction time. Convert it to 'HH:MM' (24-hour format). If no time is found, use the current time.
- "tax": Extract the tax amount if listed separately, otherwise set to 0.
- "currency": Identify the currency symbol or code and return the standard ISO 3-letter currency code (e.g. INR for ₹, USD for $, EUR for €, GBP for £).
- "paymentMethod": Identify how it was paid (e.g., Credit Card, Debit Card, Cash, UPI, Google Pay, PhonePe).
- "items": Extract each individual item/service purchased, including its name, price, and quantity. If quantity is not listed, default to 1.
- "isScreenshot": Set to true if the image is a mobile payment confirmation screenshot (like GPay, PhonePe, Paytm), and false if it is a physical paper receipt or invoice.
- "isBill": If the image does NOT look like a receipt, invoice, bill, or payment transfer screenshot at all (e.g., a selfie, a pet, general objects, or completely unrelated text), set "isBill" to false. Otherwise, set it to true.`
                },
                {
                  inlineData: {
                    mimeType: mimeType,
                    data: base64
                  }
                }
              ]
            }
          ],
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: responseSchema
          }
        };

        const apiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
        const response = await fetch(apiEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`Gemini API Error (${response.status}): ${errText || response.statusText}`);
        }

        const data = await response.json();
        const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!textResponse) {
          throw new Error('Gemini API returned an empty or invalid content response.');
        }

        const parsedResult = JSON.parse(textResponse);

        const hasExtractedInfo = (typeof parsedResult.amount === 'number' && parsedResult.amount > 0) || (parsedResult.merchant && parsedResult.merchant !== 'Unknown Merchant');
        if (!parsedResult.isBill && !hasExtractedInfo) {
          throw new Error('The scanned image does not appear to be a receipt, invoice, or payment screenshot. Please scan a valid receipt.');
        }

        return {
          merchant: parsedResult.merchant || 'Unknown Merchant',
          amount: typeof parsedResult.amount === 'number' ? parsedResult.amount : 0,
          date: parsedResult.date || new Date().toISOString().split('T')[0],
          time: parsedResult.time || new Date().toTimeString().slice(0, 5),
          tax: typeof parsedResult.tax === 'number' ? parsedResult.tax : 0,
          currency: parsedResult.currency || 'INR',
          paymentMethod: parsedResult.paymentMethod || (isScreenshotPreset ? 'UPI' : 'Cash'),
          items: Array.isArray(parsedResult.items) ? parsedResult.items : [],
          confidence: typeof parsedResult.confidence === 'number' ? parsedResult.confidence : 0.9,
          transactionId: parsedResult.transactionId || undefined,
          isScreenshot: parsedResult.isScreenshot ?? isScreenshotPreset,
        };

      } catch (err: any) {
        console.error('OCR Parsing Error:', err);
        throw new Error(err.message || 'Failed to extract text from image.');
      }
    }

    // --- FALLBACK MOCK SIMULATOR ---
    await new Promise((resolve) => setTimeout(resolve, 1500));

    const today = new Date().toISOString().split('T')[0];
    const timeNow = new Date().toTimeString().slice(0, 5);
    const preset = typePreset || this._detectPreset(imageUri);

    switch (preset) {
      case 'vmart':
        return {
          merchant: 'V Mart',
          amount: 45700.00,
          date: '2023-08-25',
          time: '16:34',
          tax: 0.00,
          currency: 'INR',
          paymentMethod: 'Cash',
          confidence: 0.99,
          items: [
            { name: 'Formal shirts', price: 2200.00, quantity: 6 },
            { name: 'Formal pants', price: 2500.00, quantity: 6 },
            { name: 'Belt leather', price: 4000.00, quantity: 1 },
            { name: 'blezer cotton', price: 4500.00, quantity: 3 },
          ],
        };

      case 'starbucks':
        return {
          merchant: 'Starbucks Coffee',
          amount: 8.75,
          date: today,
          time: timeNow,
          tax: 0.65,
          currency: 'INR',
          paymentMethod: 'Credit Card',
          confidence: 0.95,
          items: [
            { name: 'Caffe Latte Grande', price: 4.75, quantity: 1 },
            { name: 'Blueberry Scone', price: 3.35, quantity: 1 },
          ],
        };

      case 'amazon':
        return {
          merchant: 'Amazon.com',
          amount: 49.99,
          date: today,
          time: timeNow,
          tax: 4.12,
          currency: 'INR',
          paymentMethod: 'Google Pay',
          confidence: 0.92,
          items: [
            { name: 'Wireless Charging Pad', price: 19.99, quantity: 1 },
            { name: 'USB-C Cable (3-pack)', price: 25.88, quantity: 1 },
          ],
        };

      case 'walmart':
        return {
          merchant: 'Walmart Supercenter',
          amount: 114.50,
          date: today,
          time: '14:32',
          tax: 9.45,
          currency: 'INR',
          paymentMethod: 'Debit Card',
          confidence: 0.89,
          items: [
            { name: 'Paper Towels', price: 12.99, quantity: 1 },
            { name: 'Organic Bananas', price: 2.50, quantity: 1 },
            { name: 'Bed Sheets King Size', price: 89.56, quantity: 1 },
          ],
        };

      case 'shell':
        return {
          merchant: 'Shell Gas Station',
          amount: 45.00,
          date: today,
          time: '08:15',
          tax: 3.50,
          currency: 'INR',
          paymentMethod: 'Cash',
          confidence: 0.98,
          items: [
            { name: 'Regular Unleaded Fuel', price: 45.00, quantity: 1 },
          ],
        };

      case 'gpay_upi':
        return {
          merchant: 'Google Pay UPI Transfer to John Doe',
          amount: 750.00,
          date: today,
          time: timeNow,
          tax: 0.00,
          currency: 'INR',
          paymentMethod: 'UPI (GPay)',
          confidence: 0.97,
          transactionId: 'UPI983748291048',
          isScreenshot: true,
          items: [
            { name: 'UPI Fund Transfer', price: 750.00, quantity: 1 },
          ],
        };

      case 'phonepe_upi':
        return {
          merchant: 'PhonePe Payment to Swiggy',
          amount: 345.50,
          date: today,
          time: '20:15',
          tax: 18.50,
          currency: 'INR',
          paymentMethod: 'UPI (PhonePe)',
          confidence: 0.96,
          transactionId: 'TXN202607158972',
          isScreenshot: true,
          items: [
            { name: 'Food Delivery Order', price: 327.00, quantity: 1 },
            { name: 'Restaurant GST & Packaging', price: 18.50, quantity: 1 },
          ],
        };

      case 'paytm_upi':
        return {
          merchant: 'Paytm Merchant Payment to Zara',
          amount: 2499.00,
          date: today,
          time: '18:45',
          tax: 270.00,
          currency: 'INR',
          paymentMethod: 'UPI (Paytm)',
          confidence: 0.94,
          transactionId: 'PAYTM89324098',
          isScreenshot: true,
          items: [
            { name: 'Men Linen Shirt', price: 2229.00, quantity: 1 },
            { name: 'VAT / Tax', price: 270.00, quantity: 1 },
          ],
        };

      default:
        return {
          merchant: 'Local Merchant Store',
          amount: 25.60,
          date: today,
          time: timeNow,
          tax: 1.80,
          currency: 'INR',
          paymentMethod: 'Credit Card',
          confidence: 0.75,
          items: [
            { name: 'Miscellaneous Item', price: 23.80, quantity: 1 },
          ],
        };
    }
  },

  _detectPreset(imageUri: string): string {
    const lowercaseUri = imageUri.toLowerCase();
    if (lowercaseUri.includes('vmart') || lowercaseUri.includes('v_mart') || lowercaseUri.includes('mart')) return 'vmart';
    if (lowercaseUri.includes('starbucks')) return 'starbucks';
    if (lowercaseUri.includes('amazon')) return 'amazon';
    if (lowercaseUri.includes('walmart')) return 'walmart';
    if (lowercaseUri.includes('shell')) return 'shell';
    if (lowercaseUri.includes('gpay') || lowercaseUri.includes('googlepay')) return 'gpay_upi';
    if (lowercaseUri.includes('phonepe')) return 'phonepe_upi';
    if (lowercaseUri.includes('paytm')) return 'paytm_upi';
    
    // Random default for test
    const options = ['starbucks', 'amazon', 'walmart', 'shell', 'gpay_upi', 'phonepe_upi', 'paytm_upi', 'vmart'];
    return options[Math.floor(Math.random() * options.length)];
  },
};
