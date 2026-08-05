// @ts-nocheck
import { tool } from 'npm:@langchain/core/tools';
import { z } from 'npm:zod@^3.22.4';
import { Logger } from '../observability.ts';

export function createBudgetTools(supabaseClient: any, userId: string, onLog?: (entry: any) => void) {
  const getBudgetsTool = tool(
    async () => {
      const startTime = Date.now();
      try {
        Logger.info(`[GetBudgetsTool] Fetching budgets for user: ${userId}`);
        const { data: userData, error: getUserErr } = await supabaseClient.auth.getUser();
        if (getUserErr || !userData?.user) {
          throw new Error(`Failed to fetch user metadata: ${getUserErr?.message || 'User not found'}`);
        }

        const metadata = userData.user.user_metadata || {};
        const currentBudgets = Array.isArray(metadata.budgets) ? [...metadata.budgets] : [];

        const duration = Date.now() - startTime;
        onLog?.({ toolName: 'get_budgets', executionTimeMs: duration, success: true, timestamp: new Date().toISOString() });
        return JSON.stringify({ success: true, budgets: currentBudgets });
      } catch (err: any) {
        const duration = Date.now() - startTime;
        Logger.error(`[GetBudgetsTool Error]`, err);
        onLog?.({ toolName: 'get_budgets', executionTimeMs: duration, success: false, error: err.message, timestamp: new Date().toISOString() });
        return JSON.stringify({ success: false, error: err.message || 'Failed to get budgets.' });
      }
    },
    {
      name: 'get_budgets',
      description: 'Fetch user registered budget goals across categories.',
      schema: z.object({})
    }
  );

  const updateBudgetTool = tool(
    async (input) => {
      const startTime = Date.now();
      try {
        Logger.info(`[UpdateBudgetTool] Setting budget for user: ${userId}`, input);
        if (input.amount <= 0) {
          throw new Error('Budget amount must be a positive number.');
        }

        const { data: userData, error: getUserErr } = await supabaseClient.auth.getUser();
        if (getUserErr || !userData?.user) {
          throw new Error(`Failed to fetch user metadata: ${getUserErr?.message || 'User not found'}`);
        }

        const metadata = userData.user.user_metadata || {};
        const currentBudgets = Array.isArray(metadata.budgets) ? [...metadata.budgets] : [];

        const catName = input.category.trim();
        const targetPeriod = input.period || 'monthly';
        
        const existingIdx = currentBudgets.findIndex((b: any) => 
          (b.category || '').toLowerCase() === catName.toLowerCase() && (b.period || 'monthly') === targetPeriod
        );

        let updatedBudgetItem: any;
        if (existingIdx !== -1) {
          currentBudgets[existingIdx] = {
            ...currentBudgets[existingIdx],
            amount: input.amount,
            period: targetPeriod
          };
          updatedBudgetItem = currentBudgets[existingIdx];
        } else {
          const newBudgetId = `${catName.toLowerCase()}_${targetPeriod}`;
          updatedBudgetItem = {
            id: newBudgetId,
            category: catName,
            amount: input.amount,
            period: targetPeriod
          };
          currentBudgets.push(updatedBudgetItem);
        }

        const { error: updateErr } = await supabaseClient.auth.updateUser({
          data: {
            ...metadata,
            budgets: currentBudgets
          }
        });

        if (updateErr) {
          throw new Error(`Failed to save updated budgets: ${updateErr.message}`);
        }

        const duration = Date.now() - startTime;
        onLog?.({ toolName: 'update_budget', executionTimeMs: duration, success: true, timestamp: new Date().toISOString() });

        return JSON.stringify({
          success: true,
          message: `Successfully set ${catName} budget to ${input.amount} (${targetPeriod}).`,
          updatedBudget: updatedBudgetItem,
          allBudgets: currentBudgets
        });
      } catch (err: any) {
        const duration = Date.now() - startTime;
        Logger.error(`[UpdateBudgetTool Error]`, err);
        onLog?.({ toolName: 'update_budget', executionTimeMs: duration, success: false, error: err.message, timestamp: new Date().toISOString() });
        return JSON.stringify({ success: false, error: err.message || 'Failed to update budget.' });
      }
    },
    {
      name: 'update_budget',
      description: 'Set or update a category-level budget limit (e.g. increase Food budget to 6000 or set Grocery budget to 4000).',
      schema: z.object({
        category: z.string().describe('Expense category for the budget (e.g. Food, Groceries, Shopping, All)'),
        amount: z.number().describe('New budget limit amount'),
        period: z.enum(['monthly', 'weekly', 'yearly']).optional().default('monthly').describe('Budget period window')
      })
    }
  );

  return [getBudgetsTool, updateBudgetTool];
}
