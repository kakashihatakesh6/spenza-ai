import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { Asset } from 'expo-asset';
import { logger } from './logger';

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
    logger.info('Receipt scan started', { imageUri, typePreset });
    const rawApiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
    const apiKey = rawApiKey ? rawApiKey.trim() : '';

    logger.debug('Using Gemini API Key (masked)', { apiKey: apiKey ? apiKey.substring(0, 10) + '...' + apiKey.substring(apiKey.length - 5) : 'undefined' });

    const isMockUri = imageUri.startsWith('mock_');
    const useCloud = !isMockUri;

    if (useCloud) {
      if (!apiKey) {
        const keyErr = new Error('Gemini API key is not configured. Please set the GEMINI_API_KEY environment variable to perform actual OCR text extraction.');
        logger.error('OCR failed', keyErr);
        throw keyErr;
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
            logger.error('Failed to load asset for preset', { presetKey, assetError });
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

        const apiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`;
        const response = await fetch(apiEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey,
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

        const result: OcrResult = {
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

        logger.info('Receipt processed', { merchant: result.merchant, amount: result.amount });
        return result;

      } catch (err: any) {
        logger.error('OCR failed', err);
        throw new Error(err.message || 'Failed to extract text from image.');
      }
    }

    // --- FALLBACK MOCK SIMULATOR ---
    await new Promise((resolve) => setTimeout(resolve, 1500));

    const today = new Date().toISOString().split('T')[0];
    const timeNow = new Date().toTimeString().slice(0, 5);
    const preset = typePreset || this._detectPreset(imageUri);

    let mockResult: OcrResult;
    switch (preset) {
      case 'vmart':
        mockResult = {
          merchant: 'V Mart',
          amount: 45700.00,
          date: '2023-08-25',
          time: '16:34',
          tax: 0.00,
          currency: 'INR',
          paymentMethod: 'Cash',
          confidence: 0.99,
          items: [
            { name: 'Sony PlayStation 5', price: 44999.00, quantity: 1 },
            { name: 'Paper Bag', price: 10.00, quantity: 1 },
            { name: 'GST Tax', price: 691.00, quantity: 1 }
          ]
        };
        break;

      case 'starbucks':
        mockResult = {
          merchant: 'Starbucks Coffee',
          amount: 320.00,
          date: today,
          time: timeNow,
          tax: 18.50,
          currency: 'INR',
          paymentMethod: 'Credit Card',
          confidence: 0.98,
          items: [
            { name: 'Java Chip Frappuccino', price: 290.00, quantity: 1 },
            { name: 'Tax / GST', price: 30.00, quantity: 1 }
          ]
        };
        break;

      case 'amazon':
        mockResult = {
          merchant: 'Amazon Seller Services',
          amount: 1299.00,
          date: '2026-07-25',
          time: '10:15',
          tax: 198.12,
          currency: 'INR',
          paymentMethod: 'UPI (GPay)',
          confidence: 0.95,
          items: [
            { name: 'Boat Bassheads 225', price: 499.00, quantity: 1 },
            { name: 'Spigen Tough Armor Case', price: 800.00, quantity: 1 }
          ]
        };
        break;

      case 'walmart':
        mockResult = {
          merchant: 'Walmart Supercenter',
          amount: 85.50,
          date: '2026-07-26',
          time: '14:22',
          tax: 6.20,
          currency: 'USD',
          paymentMethod: 'Debit Card',
          confidence: 0.97,
          items: [
            { name: 'Organic Milk 1G', price: 4.89, quantity: 2 },
            { name: 'Whole Wheat Bread', price: 2.49, quantity: 1 },
            { name: 'Wireless Mouse', price: 19.99, quantity: 1 },
            { name: 'HDMI Cable 6ft', price: 12.99, quantity: 2 }
          ]
        };
        break;

      case 'shell':
        mockResult = {
          merchant: 'Shell Petrol Pump',
          amount: 1500.00,
          date: today,
          time: timeNow,
          tax: 114.50,
          currency: 'INR',
          paymentMethod: 'Cash',
          confidence: 0.96,
          items: [
            { name: 'Unleaded Petrol 15L', price: 1500.00, quantity: 1 }
          ]
        };
        break;

      case 'gpay_upi':
        mockResult = {
          merchant: 'Aman General Store',
          amount: 150.00,
          date: today,
          time: timeNow,
          tax: 0.00,
          currency: 'INR',
          paymentMethod: 'UPI (Google Pay)',
          confidence: 0.95,
          transactionId: 'UPI204928304918',
          isScreenshot: true,
          items: [
            { name: 'Grocery Items', price: 150.00, quantity: 1 }
          ]
        };
        break;

      case 'phonepe_upi':
        mockResult = {
          merchant: 'Swiggy Food Delivery',
          amount: 649.00,
          date: today,
          time: timeNow,
          tax: 48.00,
          currency: 'INR',
          paymentMethod: 'UPI (PhonePe)',
          confidence: 0.93,
          transactionId: 'TXN2026072938123',
          isScreenshot: true,
          items: [
            { name: 'Paneer Butter Masala', price: 320.00, quantity: 1 },
            { name: 'Butter Naan', price: 60.00, quantity: 3 },
            { name: 'Delivery Charge & Taxes', price: 149.00, quantity: 1 }
          ]
        };
        break;

      case 'paytm_upi':
        mockResult = {
          merchant: 'Zara Store DLF Mall',
          amount: 2499.00,
          date: '2026-07-28',
          time: '20:10',
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
        break;

      default:
        mockResult = {
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
        break;
    }

    logger.info('Receipt processed', { merchant: mockResult.merchant, amount: mockResult.amount, isMock: true });
    return mockResult;
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
