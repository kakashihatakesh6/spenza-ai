// @ts-nocheck
import { tool } from 'npm:@langchain/core/tools';
import { z } from 'npm:zod@^3.22.4';
import { Logger } from '../observability.ts';

export function createAnalyticsTools(supabaseClient: any, userId: string, onLog?: (entry: any) => void) {
  const getAnalyticsTool = tool(
    async (input) => {
      const startTime = Date.now();
      try {
        Logger.info(`[GetFinancialAnalyticsTool] Executing analysisType: ${input.analysisType}`, { userId });

        const { data: expenses, error: expErr } = await supabaseClient
          .from('expenses')
          .select('*')
          .eq('user_id', userId)
          .order('transaction_date', { ascending: false });

        if (expErr) {
          throw new Error(`Failed to query expenses for analytics: ${expErr.message}`);
        }

        const allExpenses = expenses || [];

        const { data: userData } = await supabaseClient.auth.getUser();
        const metadata = userData?.user?.user_metadata || {};
        const monthlyIncomeSetting = metadata.monthly_income ?? metadata.income ?? 0;
        const currency = metadata.preferred_currency ?? metadata.currency ?? 'INR';
        const budgets = metadata.budgets || [];

        const isIncomeCategory = (cat?: string) => {
          if (!cat) return false;
          const lower = cat.toLowerCase();
          return lower.includes('salary') || lower.includes('income') || lower.includes('deposit');
        };

        const incomeTx = allExpenses.filter((e: any) => isIncomeCategory(e.category));
        const expenseTx = allExpenses.filter((e: any) => !isIncomeCategory(e.category));

        const totalIncomeFromTx = incomeTx.reduce((sum: number, e: any) => sum + (parseFloat(e.amount) || 0), 0);
        const effectiveMonthlyIncome = totalIncomeFromTx > 0 ? totalIncomeFromTx : monthlyIncomeSetting;
        const totalExpenses = expenseTx.reduce((sum: number, e: any) => sum + (parseFloat(e.amount) || 0), 0);

        const now = new Date();
        const currentYear = input.year || now.getFullYear();

        const parseMonthIndex = (mStr?: string): number => {
          if (!mStr) return now.getMonth();
          const lower = mStr.toLowerCase().trim();
          const months = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
          const idx = months.findIndex(m => m.startsWith(lower));
          if (idx !== -1) return idx;
          const num = parseInt(lower, 10);
          if (!isNaN(num) && num >= 1 && num <= 12) return num - 1;
          return now.getMonth();
        };

        const targetMonthIdx = parseMonthIndex(input.month);

        const getExpensesForMonth = (monthIdx: number, yearNum: number) => {
          return expenseTx.filter((e: any) => {
            if (!e.transaction_date) return false;
            const d = new Date(e.transaction_date);
            return d.getMonth() === monthIdx && d.getFullYear() === yearNum;
          });
        };

        const targetMonthExpenses = getExpensesForMonth(targetMonthIdx, currentYear);
        const targetMonthTotal = targetMonthExpenses.reduce((sum: number, e: any) => sum + (parseFloat(e.amount) || 0), 0);

        const duration = Date.now() - startTime;

        switch (input.analysisType) {
          case 'monthly_spending': {
            const monthName = new Date(currentYear, targetMonthIdx, 1).toLocaleString('en-US', { month: 'long' });
            onLog?.({ toolName: 'get_financial_analytics', executionTimeMs: duration, success: true, timestamp: new Date().toISOString() });
            return JSON.stringify({
              success: true,
              analysisType: 'monthly_spending',
              period: `${monthName} ${currentYear}`,
              totalSpent: targetMonthTotal,
              currency,
              transactionCount: targetMonthExpenses.length
            });
          }

          case 'category_analysis': {
            const scopeTx = input.month ? targetMonthExpenses : expenseTx;
            const categoryMap: Record<string, { total: number; count: number }> = {};
            scopeTx.forEach((e: any) => {
              const cat = e.category || 'Uncategorized';
              if (!categoryMap[cat]) categoryMap[cat] = { total: 0, count: 0 };
              categoryMap[cat].total += parseFloat(e.amount) || 0;
              categoryMap[cat].count += 1;
            });

            const grandTotal = Object.values(categoryMap).reduce((acc, c) => acc + c.total, 0);
            const breakdown = Object.entries(categoryMap).map(([cat, data]) => ({
              category: cat,
              totalAmount: data.total,
              percentage: grandTotal > 0 ? ((data.total / grandTotal) * 100).toFixed(1) + '%' : '0%',
              transactionCount: data.count
            })).sort((a, b) => b.totalAmount - a.totalAmount);

            onLog?.({ toolName: 'get_financial_analytics', executionTimeMs: duration, success: true, timestamp: new Date().toISOString() });
            return JSON.stringify({
              success: true,
              analysisType: 'category_analysis',
              scope: input.month ? `Month: ${input.month}` : 'All Time',
              currency,
              grandTotal,
              categories: breakdown
            });
          }

          case 'budget_utilization': {
            const categoryMap: Record<string, number> = {};
            targetMonthExpenses.forEach((e: any) => {
              const cat = (e.category || 'Uncategorized').toLowerCase();
              categoryMap[cat] = (categoryMap[cat] || 0) + (parseFloat(e.amount) || 0);
            });

            const budgetReport = budgets.map((b: any) => {
              const bCatLower = (b.category || '').toLowerCase();
              let actualSpent = 0;
              if (bCatLower === 'all' || bCatLower === 'overall') {
                actualSpent = targetMonthTotal;
              } else {
                actualSpent = categoryMap[bCatLower] || 0;
              }

              const budgetAmount = parseFloat(b.amount) || 0;
              const remaining = budgetAmount - actualSpent;
              const percentUsed = budgetAmount > 0 ? ((actualSpent / budgetAmount) * 100).toFixed(1) + '%' : 'N/A';
              const isExceeded = actualSpent > budgetAmount;

              return {
                category: b.category,
                period: b.period || 'monthly',
                budgetAmount,
                actualSpent,
                remaining,
                percentUsed,
                isExceeded
              };
            });

            onLog?.({ toolName: 'get_financial_analytics', executionTimeMs: duration, success: true, timestamp: new Date().toISOString() });
            return JSON.stringify({
              success: true,
              analysisType: 'budget_utilization',
              currency,
              budgets: budgetReport
            });
          }

          case 'savings_analysis':
          case 'income_vs_expense': {
            const savings = effectiveMonthlyIncome - totalExpenses;
            const savingsRate = effectiveMonthlyIncome > 0 ? ((savings / effectiveMonthlyIncome) * 100).toFixed(1) + '%' : '0%';

            onLog?.({ toolName: 'get_financial_analytics', executionTimeMs: duration, success: true, timestamp: new Date().toISOString() });
            return JSON.stringify({
              success: true,
              analysisType: input.analysisType,
              currency,
              monthlyIncomeSetting,
              totalIncomeFromTx,
              effectiveMonthlyIncome,
              totalExpenses,
              savingsAmount: savings,
              savingsRate,
              isPositiveSavings: savings >= 0
            });
          }

          default: {
            const categoryTotals: Record<string, number> = {};
            expenseTx.forEach((e: any) => {
              const cat = e.category || 'Other';
              categoryTotals[cat] = (categoryTotals[cat] || 0) + (parseFloat(e.amount) || 0);
            });

            const sortedCats = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]);
            const topCategory = sortedCats.length > 0 ? sortedCats[0][0] : 'None';
            const topCategorySpent = sortedCats.length > 0 ? sortedCats[0][1] : 0;

            onLog?.({ toolName: 'get_financial_analytics', executionTimeMs: duration, success: true, timestamp: new Date().toISOString() });
            return JSON.stringify({
              success: true,
              analysisType: input.analysisType,
              currency,
              totalIncome: effectiveMonthlyIncome,
              totalExpenses,
              totalSavings: effectiveMonthlyIncome - totalExpenses,
              transactionCount: allExpenses.length,
              topCategory,
              topCategorySpent,
              targetMonthTotal
            });
          }
        }
      } catch (err: any) {
        const duration = Date.now() - startTime;
        Logger.error(`[GetFinancialAnalyticsTool Error]`, err);
        onLog?.({ toolName: 'get_financial_analytics', executionTimeMs: duration, success: false, error: err.message, timestamp: new Date().toISOString() });
        return JSON.stringify({ success: false, error: err.message || 'Failed to calculate analytics.' });
      }
    },
    {
      name: 'get_financial_analytics',
      description: 'Calculate user financial analytics including monthly/weekly/yearly spending, spending trends, category breakdown, top merchants, budget utilization, income vs expense, savings rate, cash flow, and highest/lowest expenses.',
      schema: z.object({
        analysisType: z.enum([
          'monthly_spending',
          'weekly_spending',
          'yearly_spending',
          'daily_spending',
          'spending_trends',
          'category_analysis',
          'merchant_analysis',
          'budget_utilization',
          'income_vs_expense',
          'savings_analysis',
          'highest_expenses',
          'lowest_expenses',
          'financial_summaries'
        ]).describe('Type of analytics needed'),
        month: z.string().optional().describe('Target month name (e.g. July, August) or YYYY-MM'),
        year: z.number().optional().describe('Target year (e.g. 2026)'),
        category: z.string().optional().describe('Filter category')
      })
    }
  );

  return [getAnalyticsTool];
}
