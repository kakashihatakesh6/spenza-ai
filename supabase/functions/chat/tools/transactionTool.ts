// @ts-nocheck
import { tool } from 'npm:@langchain/core/tools';
import { z } from 'npm:zod@^3.22.4';
import { Logger } from '../observability.ts';

export function createTransactionTools(supabaseClient: any, userId: string, onLog?: (entry: any) => void) {
  const searchTransactionsTool = tool(
    async (input) => {
      const startTime = Date.now();
      try {
        Logger.info(`[SearchTransactionsTool] Querying transactions`, input);
        let queryBuilder = supabaseClient
          .from('expenses')
          .select('*')
          .eq('user_id', userId)
          .order('transaction_date', { ascending: false })
          .limit(input.limit || 10);

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

        const { data: expenses, error: searchErr } = await queryBuilder;

        if (searchErr) {
          throw new Error(`Database error while searching transactions: ${searchErr.message}`);
        }

        let filtered = expenses || [];
        if (input.query) {
          const q = input.query.toLowerCase();
          filtered = filtered.filter((e: any) => 
            (e.merchant && e.merchant.toLowerCase().includes(q)) ||
            (e.notes && e.notes.toLowerCase().includes(q)) ||
            (e.category && e.category.toLowerCase().includes(q))
          );
        }

        const duration = Date.now() - startTime;
        onLog?.({ toolName: 'search_transactions', executionTimeMs: duration, success: true, timestamp: new Date().toISOString() });

        return JSON.stringify({
          success: true,
          count: filtered.length,
          transactions: filtered.map((e: any) => ({
            id: e.id,
            merchant: e.merchant,
            amount: e.amount,
            currency: e.currency,
            category: e.category,
            date: e.transaction_date,
            paymentMethod: e.payment_method,
            notes: e.notes
          }))
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
      description: 'Search authenticated user transactions/expenses by category, merchant name, date range, or keyword query.',
      schema: z.object({
        query: z.string().optional().describe('Text query matching merchant, category, or notes'),
        category: z.string().optional().describe('Category filter, e.g. Food, Groceries, Travel, Shopping'),
        merchant: z.string().optional().describe('Merchant name filter'),
        startDate: z.string().optional().describe('Start date filter (YYYY-MM-DD)'),
        endDate: z.string().optional().describe('End date filter (YYYY-MM-DD)'),
        limit: z.number().optional().default(10).describe('Max results limit')
      })
    }
  );

  const updateTransactionTool = tool(
    async (input) => {
      const startTime = Date.now();
      try {
        Logger.info(`[UpdateTransactionTool] Updating transaction`, input);
        if (input.amount !== undefined && input.amount <= 0) {
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

        if (input.amount !== undefined) updatePayload.amount = input.amount;
        if (input.category !== undefined) updatePayload.category = input.category.trim();
        if (input.merchant !== undefined) updatePayload.merchant = input.merchant.trim();
        if (input.currency !== undefined) updatePayload.currency = input.currency.toUpperCase().trim();
        if (input.paymentMethod !== undefined) updatePayload.payment_method = input.paymentMethod.trim();
        if (input.date !== undefined) updatePayload.transaction_date = input.date.trim();
        if (input.notes !== undefined) updatePayload.notes = input.notes.trim();

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
        transactionId: z.string().optional().describe('ID of target transaction if known'),
        merchant: z.string().optional().describe('Merchant name to search or update'),
        category: z.string().optional().describe('Category name to search or update (e.g. Food, Groceries)'),
        amount: z.number().optional().describe('New transaction amount'),
        currency: z.string().optional().describe('Currency code, e.g. INR, USD'),
        paymentMethod: z.string().optional().describe('Payment method, e.g. UPI, Credit Card'),
        date: z.string().optional().describe('Transaction date (YYYY-MM-DD)'),
        notes: z.string().optional().describe('Notes or description')
      })
    }
  );

  return [searchTransactionsTool, updateTransactionTool];
}
