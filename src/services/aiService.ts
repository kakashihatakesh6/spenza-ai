export interface AiCategorizationResult {
  category: string;
  confidence: number;
  reason: string;
}

export const aiService = {
  /**
   * Automatically classifies an expense into a category based on the merchant name.
   */
  async classifyExpense(merchant: string, rawText?: string): Promise<AiCategorizationResult> {
    // Simulate minor latency
    await new Promise((resolve) => setTimeout(resolve, 300));

    const name = merchant.toLowerCase().trim();
    const context = (rawText || '').toLowerCase().trim();
    const fullText = `${name} ${context}`;

    // 1. Rent
    if (this._containsWord(fullText, ['rent', 'landlord', 'housing', 'mortgage', 'lease', 'apartment', 'flat', 'sublet', 'tenancy', 'rent payment'])) {
      return {
        category: 'Rent',
        confidence: 0.98,
        reason: 'Identified rent, housing or apartment lease keywords.',
      };
    }

    // 2. Food / Restaurant
    if (
      this._containsWord(fullText, [
        'starbucks', 'mcdonald', 'burger king', 'subway', 'pizza', 'restaurant', 'restaurent',
        'cafe', 'dunkin', 'coffee', 'swiggy', 'zomato', 'bakery', 'diner', 'dining', 'eats',
        'grill', 'kitchen', 'bistro', 'pub', 'bar', 'caterer', 'kfc', 'food', 'biryani', 'curry', 'burger'
      ])
    ) {
      return {
        category: 'Food',
        confidence: 0.98,
        reason: 'Identified food, restaurant, cafe, or food delivery keywords.',
      };
    }

    // 3. Bills (Utilities, Electric, Water, etc.)
    if (
      this._containsWord(fullText, [
        'electric', 'electricity', 'water bill', 'gas bill', 'power', 'utility', 'comcast',
        'at&t', 'verizon', 't-mobile', 'internet', 'wifi', 'broadband', 'mobile recharge',
        'phone bill', 'insurance', 'recharge', 'bescom', 'tneb', 'mseb', 'kseb', 'pg&e',
        'coned', 'telecom', 'utility bill', 'sewer', 'trash'
      ])
    ) {
      return {
        category: 'Bills',
        confidence: 0.95,
        reason: 'Identified electric, water, internet, or telecom utility bill keywords.',
      };
    }

    // 4. Travel
    if (
      this._containsWord(fullText, [
        'uber', 'lyft', 'grab', 'ola', 'taxi', 'cab', 'airline', 'flight', 'railway',
        'train', 'metro', 'delta', 'expedia', 'booking.com', 'airbnb', 'hotel', 'stay',
        'travel', 'bus', 'auto', 'rickshaw', 'hostel', 'irctc'
      ])
    ) {
      return {
        category: 'Travel',
        confidence: 0.96,
        reason: 'Identified ride-sharing, flight, hotel, or transit keywords.',
      };
    }

    // 5. Grocery
    if (
      this._containsWord(fullText, [
        'walmart', 'target', 'grocery', 'supermarket', 'whole foods', 'kroger', 'safeway',
        'trader joe', 'aldi', 'costco', 'mart', 'vegetable', 'fruit', 'meat', 'milk', 'dairy',
        'blinkit', 'zepto', 'instamart', 'bigbasket', 'provisions'
      ])
    ) {
      return {
        category: 'Grocery',
        confidence: 0.94,
        reason: 'Identified supermarket, grocer, or daily provision store.',
      };
    }

    // 6. Shopping
    if (
      this._containsWord(fullText, [
        'amazon', 'ebay', 'aliexpress', 'zara', 'h&m', 'nike', 'adidas', 'shopping',
        'boutique', 'nordstrom', 'apparel', 'store', 'mall', 'fashion', 'clothes', 'shoes',
        'myntra', 'flipkart', 'meesho'
      ])
    ) {
      return {
        category: 'Shopping',
        confidence: 0.92,
        reason: 'Identified online retail, apparel store, or shopping center.',
      };
    }

    // 7. Health
    if (
      this._containsWord(fullText, [
        'hospital', 'pharmacy', 'cvs', 'walgreens', 'clinic', 'doctor', 'dentist',
        'medical', 'health', 'gym', 'fitness', 'wellness', 'meds', 'apothecary', 'care'
      ])
    ) {
      return {
        category: 'Health',
        confidence: 0.96,
        reason: 'Identified pharmacy, medical center, or healthcare provider.',
      };
    }

    // 8. Fuel
    if (
      this._containsWord(fullText, [
        'shell', 'exxon', 'chevron', 'bp', 'fuel', 'gas station', 'petrol', 'diesel',
        'gasoline', 'oil', 'cng'
      ])
    ) {
      return {
        category: 'Fuel',
        confidence: 0.99,
        reason: 'Identified petrol, diesel, gas station, or oil merchant.',
      };
    }

    // 9. EMI
    if (
      this._containsWord(fullText, [
        'emi', 'loan', 'installment', 'finance', 'interest payment', 'credit card payment'
      ])
    ) {
      return {
        category: 'EMI',
        confidence: 0.93,
        reason: 'Identified installment or debt repayment terminology.',
      };
    }

    // 10. Education
    if (
      this._containsWord(fullText, [
        'school', 'university', 'college', 'tuition', 'udemy', 'coursera', 'bookstore',
        'class', 'course', 'academy', 'training'
      ])
    ) {
      return {
        category: 'Education',
        confidence: 0.94,
        reason: 'Identified education, book store, or course platform.',
      };
    }

    // Default fallback
    return {
      category: 'Other',
      confidence: 0.5,
      reason: 'Assigned to general other expenses.',
    };
  },

  _containsWord(text: string, keywords: string[]): boolean {
    const cleaned = text.toLowerCase();
    return keywords.some((keyword) => {
      // Escape regex special characters
      const escaped = keyword.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      const regex = new RegExp(`\\b${escaped}\\b`, 'i');
      return regex.test(cleaned);
    });
  },
};
