import { create } from 'zustand';
import { logger } from '../services/logger';

interface CurrencyStoreState {
  rates: Record<string, number>;
  fetchRates: () => Promise<void>;
  convert: (amount: number, from: string, to: string) => number;
}

export const useCurrencyStore = create<CurrencyStoreState>((set, get) => ({
  rates: {
    USD: 1.0,
    INR: 83.5, // Standard fallback
    EUR: 0.92,
    GBP: 0.78,
  },
  fetchRates: async () => {
    try {
      const response = await fetch('https://open.er-api.com/v6/latest/USD');
      if (response.ok) {
        const data = await response.json();
        if (data && data.rates) {
          set({
            rates: {
              ...get().rates,
              ...data.rates,
            },
          });
        }
      }
    } catch (error) {
      logger.error('Failed to fetch exchange rates', error);
    }
  },
  convert: (amount: number, from: string, to: string) => {
    const rates = get().rates;
    const cleanFrom = (from || 'INR').toUpperCase();
    const cleanTo = (to || 'INR').toUpperCase();
    if (cleanFrom === cleanTo) return amount;

    const rateFrom = rates[cleanFrom];
    const rateTo = rates[cleanTo];
    if (!rateFrom || !rateTo) return amount;

    // Convert to base currency (USD), then to target currency
    const amountInUSD = amount / rateFrom;
    return amountInUSD * rateTo;
  },
}));
