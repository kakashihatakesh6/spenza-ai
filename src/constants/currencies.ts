import { useCurrencyStore } from '../store/currencyStore';

export interface CurrencyOption {
  code: string;
  name: string;
  symbol: string;
}

export const CURRENCY_METADATA: Record<string, { name: string; symbol: string }> = {
  INR: { name: 'Indian Rupee', symbol: '₹' },
  USD: { name: 'US Dollar', symbol: '$' },
  EUR: { name: 'Euro', symbol: '€' },
  GBP: { name: 'British Pound', symbol: '£' },
  AUD: { name: 'Australian Dollar', symbol: 'A$' },
  CAD: { name: 'Canadian Dollar', symbol: 'C$' },
  JPY: { name: 'Japanese Yen', symbol: '¥' },
  CHF: { name: 'Swiss Franc', symbol: 'CHF' },
  CNY: { name: 'Chinese Yuan', symbol: '¥' },
  SGD: { name: 'Singapore Dollar', symbol: 'S$' },
  AED: { name: 'UAE Dirham', symbol: 'AED' },
  NZD: { name: 'New Zealand Dollar', symbol: 'NZ$' },
  SEK: { name: 'Swedish Krona', symbol: 'kr' },
  BRL: { name: 'Brazilian Real', symbol: 'R$' },
  ZAR: { name: 'South African Rand', symbol: 'R' },
  MXN: { name: 'Mexican Peso', symbol: '$' },
  KRW: { name: 'South Korean Won', symbol: '₩' },
  THB: { name: 'Thai Baht', symbol: '฿' },
  MYR: { name: 'Malaysian Ringgit', symbol: 'RM' },
  RUB: { name: 'Russian Ruble', symbol: '₽' },
};

export const ALL_CURRENCIES: CurrencyOption[] = Object.keys(CURRENCY_METADATA).map((code) => ({
  code,
  name: CURRENCY_METADATA[code].name,
  symbol: CURRENCY_METADATA[code].symbol,
}));

export function getAllCurrencies(): CurrencyOption[] {
  const storeRates = useCurrencyStore.getState().rates;
  const storeCodes = Object.keys(storeRates || {});

  if (storeCodes && storeCodes.length > 0) {
    const list: CurrencyOption[] = [];
    const seen = new Set<string>();

    for (const item of ALL_CURRENCIES) {
      list.push(item);
      seen.add(item.code);
    }

    for (const code of storeCodes) {
      if (!seen.has(code)) {
        list.push({
          code,
          name: CURRENCY_METADATA[code]?.name || code,
          symbol: CURRENCY_METADATA[code]?.symbol || code,
        });
        seen.add(code);
      }
    }
    return list;
  }

  return ALL_CURRENCIES;
}

export const QUICK_CURRENCIES = ['USD', 'INR', 'GBP'];

export function searchCurrencies(query: string): CurrencyOption[] {
  const all = getAllCurrencies();
  if (!query || !query.trim()) return all;
  const q = query.trim().toLowerCase();
  return all.filter(
    (c) =>
      c.code.toLowerCase().includes(q) ||
      c.name.toLowerCase().includes(q) ||
      c.symbol.toLowerCase().includes(q)
  );
}
