// @ts-nocheck
import { tool } from 'npm:@langchain/core/tools';
import { z } from 'npm:zod@^3.22.4';
import { Logger } from '../observability.ts';

const EXCHANGE_RATES: Record<string, number> = {
  USD: 1.0,
  INR: 83.5,
  EUR: 0.92,
  GBP: 0.78,
  CAD: 1.36,
  AUD: 1.52,
  JPY: 155.0,
};

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  INR: '₹',
  EUR: '€',
  GBP: '£',
  CAD: 'CA$',
  AUD: 'A$',
  JPY: '¥',
};

function convertCurrency(amount: number, fromCurrency: string, toCurrency: string): number {
  const from = (fromCurrency || 'INR').toUpperCase();
  const to = (toCurrency || 'INR').toUpperCase();
  if (from === to) return Number(amount);
  const rateFrom = EXCHANGE_RATES[from] || 1.0;
  const rateTo = EXCHANGE_RATES[to] || 1.0;
  const amountInUSD = amount / rateFrom;
  return Number((amountInUSD * rateTo).toFixed(2));
}

export function createTransactionTools(supabaseClient: any, userId: string, onLog?: (entry: any) => void) {
  const searchTransactionsTool = tool(
    async (input) => {
      const startTime = Date.now();
      try {
        Logger.info(`[SearchTransactionsTool] Querying transactions`, input);
        const limitCount = input.limit || 20;

        let queryBuilder = supabaseClient
          .from('expenses')
          .select('*')
          .eq('user_id', userId)
          .order('transaction_date', { ascending: false })
          .limit(limitCount);

        if (input.category) {
          queryBuilder = queryBuilder.ilike('category', `%${input.category}%`);
        }

        if (input.merchant) {
          queryBuilder = queryBuilder.ilike('merchant', `%${input.merchant}%`);
        }

        if (input.startDate) {
          queryBuilder = queryBuilder.gte('transaction_date', input.startDate);
        }

        if (input.endDate) {
          queryBuilder = queryBuilder.lte('transaction_date', input.endDate);
        }

        const filterCurr = (input.filterCurrency || '').toUpperCase();
        if (filterCurr) {
          queryBuilder = queryBuilder.eq('currency', filterCurr);
        }

        const { data: expenses, error: searchErr } = await queryBuilder;

        if (searchErr) {
          throw new Error(`Database error while searching transactions: ${searchErr.message}`);
        }

        let filtered = expenses || [];
        if (filterCurr) {
          filtered = filtered.filter((e: any) => (e.currency || 'INR').toUpperCase() === filterCurr);
        }

        if (input.query) {
          const q = input.query.toLowerCase();
          filtered = filtered.filter((e: any) => 
            (e.merchant && e.merchant.toLowerCase().includes(q)) ||
            (e.notes && e.notes.toLowerCase().includes(q)) ||
            (e.category && e.category.toLowerCase().includes(q))
          );
        }

        const targetCurr = (input.targetCurrency || input.currency || '').toUpperCase();

        const mappedTransactions = filtered.map((e: any) => {
          const origAmt = parseFloat(e.amount) || 0;
          const origCurr = (e.currency || 'INR').toUpperCase();
          const origSymbol = CURRENCY_SYMBOLS[origCurr] || origCurr;

          let convertedAmt = origAmt;
          let displayCurr = origCurr;
          let displaySymbol = origSymbol;

          if (targetCurr && EXCHANGE_RATES[targetCurr]) {
            convertedAmt = convertCurrency(origAmt, origCurr, targetCurr);
            displayCurr = targetCurr;
            displaySymbol = CURRENCY_SYMBOLS[targetCurr] || targetCurr;
          }

          return {
            id: e.id,
            merchant: e.merchant,
            amount: origAmt,
            currency: origCurr,
            originalFormatted: `${origSymbol}${origAmt.toLocaleString()} ${origCurr}`,
            convertedAmount: convertedAmt,
            targetCurrency: displayCurr,
            convertedFormatted: `${displaySymbol}${convertedAmt.toLocaleString()} ${displayCurr}`,
            category: e.category,
            date: e.transaction_date,
            paymentMethod: e.payment_method,
            notes: e.notes,
          };
        });

        const duration = Date.now() - startTime;
        onLog?.({ toolName: 'search_transactions', executionTimeMs: duration, success: true, timestamp: new Date().toISOString() });

        return JSON.stringify({
          success: true,
          count: mappedTransactions.length,
          requestedCurrency: targetCurr || 'Original',
          transactions: mappedTransactions,
        });
      } catch (err: any) {
        const duration = Date.now() - startTime;
        Logger.error(`[SearchTransactionsTool Error]`, err);
        onLog?.({ toolName: 'search_transactions', executionTimeMs: duration, success: false, error: err.message, timestamp: new Date().toISOString() });
        return JSON.stringify({ success: false, error: err.message || 'Failed to search transactions.' });
      }
    },
    {
      name: 'search_transactions',
      description: 'Search authenticated user transactions/expenses by category, merchant, date range, keyword, or convert amounts to specific currency (GBP, INR, EUR, USD, etc.).',
      schema: z.object({
        query: z.string().nullish().describe('Text query matching merchant, category, or notes'),
        category: z.string().nullish().describe('Category filter, e.g. Food, Groceries, Travel, Shopping'),
        merchant: z.string().nullish().describe('Merchant name filter'),
        startDate: z.string().nullish().describe('Start date filter (YYYY-MM-DD)'),
        endDate: z.string().nullish().describe('End date filter (YYYY-MM-DD)'),
        filterCurrency: z.string().nullish().describe('STRICT filter to return ONLY transactions originally recorded in this currency (e.g. GBP, INR, USD, EUR). If the user asks for transactions happened in GBP, set filterCurrency="GBP". Excludes all other currencies!'),
        targetCurrency: z.string().nullish().describe('Target currency code to display/convert transaction amounts in (e.g. GBP, INR, EUR, USD)'),
        currency: z.string().nullish().describe('Alternative target or filter currency code'),
        limit: z.number().nullish().describe('Max results limit')
      })
    }
  );

  const exportTransactionsCSVTool = tool(
    async (input) => {
      const startTime = Date.now();
      try {
        Logger.info(`[ExportTransactionsCSVTool] Generating CSV export payload`, input);
        let queryBuilder = supabaseClient
          .from('expenses')
          .select('*')
          .eq('user_id', userId)
          .order('transaction_date', { ascending: false });

        if (input?.category) {
          queryBuilder = queryBuilder.ilike('category', `%${input.category}%`);
        }
        if (input?.merchant) {
          queryBuilder = queryBuilder.ilike('merchant', `%${input.merchant}%`);
        }
        if (input?.startDate) {
          queryBuilder = queryBuilder.gte('transaction_date', input.startDate);
        }
        if (input?.endDate) {
          queryBuilder = queryBuilder.lte('transaction_date', input.endDate);
        }

        const maxLimit = (input?.limit && typeof input.limit === 'number') ? input.limit : 100;
        const { data: expenses, error: searchErr } = await queryBuilder.limit(maxLimit);

        if (searchErr) {
          throw new Error(`Database error while fetching transactions for export: ${searchErr.message}`);
        }

        const list = expenses || [];
        const filename = `expenses_export_${new Date().toISOString().split('T')[0]}.csv`;

        const duration = Date.now() - startTime;
        onLog?.({ toolName: 'export_transactions_csv', executionTimeMs: duration, success: true, timestamp: new Date().toISOString() });

        return JSON.stringify({
          success: true,
          action: 'export_csv',
          message: `CSV export payload generated for ${list.length} transactions. Filename: ${filename}. Users can tap the Save CSV button to save to their device.`,
          filename,
          count: list.length,
          triggerExportCard: true,
          transactions: list.map((e: any) => ({
            id: e.id,
            merchant: e.merchant,
            amount: e.amount,
            currency: e.currency || 'INR',
            category: e.category,
            date: e.transaction_date,
            paymentMethod: e.payment_method,
            notes: e.notes
          }))
        });
      } catch (err: any) {
        const duration = Date.now() - startTime;
        Logger.error(`[ExportTransactionsCSVTool Error]`, err);
        onLog?.({ toolName: 'export_transactions_csv', executionTimeMs: duration, success: false, error: err.message, timestamp: new Date().toISOString() });
        return JSON.stringify({ success: false, error: err.message || 'Failed to generate CSV export.' });
      }
    },
    {
      name: 'export_transactions_csv',
      description: 'Export transaction list to CSV/Excel format using the app settings export feature. Trigger this tool whenever user asks to export transactions to CSV, Excel, or download expense report.',
      schema: z.object({
        category: z.string().nullish().describe('Category filter'),
        merchant: z.string().nullish().describe('Merchant filter'),
        startDate: z.string().nullish().describe('Start date filter (YYYY-MM-DD)'),
        endDate: z.string().nullish().describe('End date filter (YYYY-MM-DD)'),
        limit: z.number().nullish().describe('Max results count')
      })
    }
  );

  const updateTransactionTool = tool(
    async (input) => {
      const startTime = Date.now();
      try {
        Logger.info(`[UpdateTransactionTool] Updating transaction`, input);
        if (input.amount !== undefined && input.amount !== null && input.amount <= 0) {
          throw new Error('Transaction amount must be a positive number.');
        }

        let targetId = input.transactionId;

        if (!targetId) {
          let searchQb = supabaseClient
            .from('expenses')
            .select('id, merchant, category, amount, transaction_date')
            .eq('user_id', userId)
            .order('transaction_date', { ascending: false });

          if (input.category) {
            searchQb = searchQb.ilike('category', `%${input.category}%`);
          } else if (input.merchant) {
            searchQb = searchQb.ilike('merchant', `%${input.merchant}%`);
          }

          const { data: matchResults, error: matchErr } = await searchQb.limit(5);
          if (matchErr || !matchResults || matchResults.length === 0) {
            throw new Error('Could not find matching transaction to update. Please specify merchant, category, or transactionId.');
          }

          targetId = matchResults[0].id;
          Logger.info(`[UpdateTransactionTool] Auto-resolved target transaction ID: ${targetId}`);
        }

        const updatePayload: Record<string, any> = {
          updated_at: new Date().toISOString()
        };

        if (input.amount) updatePayload.amount = input.amount;
        if (input.category) updatePayload.category = String(input.category).trim();
        if (input.merchant) updatePayload.merchant = String(input.merchant).trim();
        if (input.currency) updatePayload.currency = String(input.currency).toUpperCase().trim();
        if (input.paymentMethod) updatePayload.payment_method = String(input.paymentMethod).trim();
        if (input.date) updatePayload.transaction_date = String(input.date).trim();
        if (input.notes) updatePayload.notes = String(input.notes).trim();

        const { data: updatedTx, error: updateErr } = await supabaseClient
          .from('expenses')
          .update(updatePayload)
          .eq('id', targetId)
          .eq('user_id', userId)
          .select()
          .single();

        if (updateErr || !updatedTx) {
          throw new Error(`Failed to update transaction: ${updateErr?.message || 'Transaction not found'}`);
        }

        const duration = Date.now() - startTime;
        onLog?.({ toolName: 'update_transaction', executionTimeMs: duration, success: true, timestamp: new Date().toISOString() });

        return JSON.stringify({
          success: true,
          message: `Transaction ${targetId} updated successfully.`,
          updatedTransaction: updatedTx
        });
      } catch (err: any) {
        const duration = Date.now() - startTime;
        Logger.error(`[UpdateTransactionTool Error]`, err);
        onLog?.({ toolName: 'update_transaction', executionTimeMs: duration, success: false, error: err.message, timestamp: new Date().toISOString() });
        return JSON.stringify({ success: false, error: err.message || 'Failed to update transaction.' });
      }
    },
    {
      name: 'update_transaction',
      description: 'Update details of an existing transaction (e.g. change grocery expense to ₹450, move expense to Food, update date, merchant, or correct OCR mistakes).',
      schema: z.object({
        transactionId: z.string().nullish().describe('ID of target transaction if known'),
        merchant: z.string().nullish().describe('Merchant name to search or update'),
        category: z.string().nullish().describe('Category name to search or update (e.g. Food, Groceries)'),
        amount: z.number().nullish().describe('New transaction amount'),
        currency: z.string().nullish().describe('Currency code, e.g. INR, USD'),
        paymentMethod: z.string().nullish().describe('Payment method, e.g. UPI, Credit Card'),
        date: z.string().nullish().describe('Transaction date (YYYY-MM-DD)'),
        notes: z.string().nullish().describe('Notes or description')
      })
    }
  );

  return [searchTransactionsTool, exportTransactionsCSVTool, updateTransactionTool];
}
