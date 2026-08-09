import { Expense, Budget, SpendingInsight } from '../types';
import { useCurrencyStore } from '../store/currencyStore';

export const expenseHelpers = {
  getCurrencySymbol(currency: string = 'INR'): string {
    switch (currency) {
      case 'USD':
        return '$';
      case 'EUR':
        return '€';
      case 'GBP':
        return '£';
      case 'INR':
      default:
        return '₹';
    }
  },

  getLocalDateString(d: Date = new Date()): string {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  getTodaySpend(expenses: Expense[]): number {
    const today = this.getLocalDateString();
    const convert = useCurrencyStore.getState().convert;
    return expenses
      .filter((e) => e.date === today)
      .reduce((sum, e) => {
        const amt = convert(Number(e.amount), e.currency || 'INR', 'INR');
        return sum + amt;
      }, 0);
  },

  getWeeklySpend(expenses: Expense[]): number {
    // Current week from Sunday
    const today = new Date();
    const currentDay = today.getDay();
    const sunday = new Date(today);
    sunday.setDate(today.getDate() - currentDay);
    const startStr = this.getLocalDateString(sunday);
    const convert = useCurrencyStore.getState().convert;

    return expenses
      .filter((e) => e.date >= startStr)
      .reduce((sum, e) => {
        const amt = convert(Number(e.amount), e.currency || 'INR', 'INR');
        return sum + amt;
      }, 0);
  },

  getMonthlySpend(expenses: Expense[]): number {
    const currentMonth = this.getLocalDateString().slice(0, 7); // YYYY-MM
    const convert = useCurrencyStore.getState().convert;
    return expenses
      .filter((e) => e.date.startsWith(currentMonth))
      .reduce((sum, e) => {
        const amt = convert(Number(e.amount), e.currency || 'INR', 'INR');
        return sum + amt;
      }, 0);
  },

  getYearlySpend(expenses: Expense[]): number {
    const currentYear = this.getLocalDateString().slice(0, 4); // YYYY
    const convert = useCurrencyStore.getState().convert;
    return expenses
      .filter((e) => e.date.startsWith(currentYear))
      .reduce((sum, e) => {
        const amt = convert(Number(e.amount), e.currency || 'INR', 'INR');
        return sum + amt;
      }, 0);
  },

  getCategorySpending(expenses: Expense[], categoriesList: any[]): { name: string; amount: number; percentage: number; color: string; icon: string }[] {
    const convert = useCurrencyStore.getState().convert;
    const total = expenses.reduce((sum, e) => {
      const amt = convert(Number(e.amount), e.currency || 'INR', 'INR');
      return sum + amt;
    }, 0);
    if (total === 0) return [];

    const map: Record<string, number> = {};
    expenses.forEach((e) => {
      const amt = convert(Number(e.amount), e.currency || 'INR', 'INR');
      map[e.category] = (map[e.category] || 0) + amt;
    });

    return Object.keys(map).map((catName) => {
      const catObj = categoriesList.find((c) => c.name === catName) || {
        color: '#C7C7CC',
        icon: 'dots-horizontal',
      };
      const amount = map[catName];
      return {
        name: catName,
        amount,
        percentage: Math.round((amount / total) * 100),
        color: catObj.color,
        icon: catObj.icon,
      };
    }).sort((a, b) => b.amount - a.amount);
  },

  getWeeklySpendingData(expenses: Expense[]): { day: string; amount: number }[] {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const result = days.map((day) => ({ day, amount: 0 }));
    const convert = useCurrencyStore.getState().convert;

    // Get current week start (Sunday)
    const today = new Date();
    const currentDay = today.getDay();
    const sunday = new Date(today);
    sunday.setDate(today.getDate() - currentDay);
    sunday.setHours(0, 0, 0, 0);

    expenses.forEach((e) => {
      const expenseDate = new Date(e.date + 'T00:00:00');
      if (expenseDate >= sunday) {
        const dayIdx = expenseDate.getDay();
        const amt = convert(Number(e.amount), e.currency || 'INR', 'INR');
        result[dayIdx].amount += amt;
      }
    });

    return result;
  },

  getMonthlyTrendData(expenses: Expense[]): { month: string; amount: number }[] {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const result = months.map((month) => ({ month, amount: 0 }));
    const convert = useCurrencyStore.getState().convert;
    
    const currentYear = new Date().getFullYear();

    expenses.forEach((e) => {
      const expenseDate = new Date(e.date + 'T00:00:00');
      if (expenseDate.getFullYear() === currentYear) {
        const monthIdx = expenseDate.getMonth();
        const amt = convert(Number(e.amount), e.currency || 'INR', 'INR');
        result[monthIdx].amount += amt;
      }
    });

    // Return the last 6 months or current year-to-date
    const currentMonthIdx = new Date().getMonth();
    const startIndex = Math.max(0, currentMonthIdx - 5);
    return result.slice(startIndex, currentMonthIdx + 1);
  },

  getSpendingInsights(expenses: Expense[], budgets: Budget[], currency: string = 'INR'): SpendingInsight[] {
    const insights: SpendingInsight[] = [];
    const today = this.getLocalDateString();
    const symbol = this.getCurrencySymbol(currency);

    if (expenses.length === 0) {
      insights.push({
        id: '1',
        title: 'Start Logging Expenses',
        description: 'You have no transactions logged. Tap the "+" button below or scan a receipt to get started!',
        type: 'info',
        date: today,
      });
      return insights;
    }

    // 1. Largest transaction alert
    const convert = useCurrencyStore.getState().convert;
    const sorted = [...expenses].sort((a, b) => {
      const amtA = convert(Number(a.amount), a.currency || 'INR', 'INR');
      const amtB = convert(Number(b.amount), b.currency || 'INR', 'INR');
      return amtB - amtA;
    });
    const largest = sorted[0];
    const largestAmt = convert(Number(largest.amount), largest.currency || 'INR', 'INR');
    if (largestAmt > 100) {
      const largestSymbol = this.getCurrencySymbol(largest.currency);
      insights.push({
        id: 'largest_spend',
        title: 'High Single Spend detected',
        description: `Your largest single expense was ${largestSymbol}${Number(largest.amount).toFixed(2)} at ${largest.merchant} under ${largest.category}.`,
        type: 'warning',
        date: today,
      });
    }

    // 2. Budget status
    const monthlySpend = this.getMonthlySpend(expenses);
    const totalBudget = budgets.find((b) => b.category === 'All' && b.period === 'monthly')?.amount || 0;
    
    if (totalBudget > 0) {
      const pct = (monthlySpend / totalBudget) * 100;
      if (pct >= 100) {
        insights.push({
          id: 'budget_exceeded',
          title: 'Monthly Limit Exceeded!',
          description: `You have spent ${symbol}${monthlySpend.toFixed(2)}, which is ${(pct - 100).toFixed(0)}% over your total monthly budget of ${symbol}${totalBudget.toFixed(2)}.`,
          type: 'warning',
          date: today,
        });
      } else if (pct >= 80) {
        insights.push({
          id: 'budget_alert',
          title: 'Nearing Budget Limit',
          description: `You have used ${pct.toFixed(0)}% of your monthly budget (${symbol}${monthlySpend.toFixed(2)} of ${symbol}${totalBudget.toFixed(2)}).`,
          type: 'warning',
          date: today,
        });
      } else {
        insights.push({
          id: 'budget_ok',
          title: 'Budget on Track',
          description: `You have used ${pct.toFixed(0)}% of your monthly budget. Keep it up!`,
          type: 'success',
          date: today,
        });
      }
    } else {
      insights.push({
        id: 'no_budget',
        title: 'Set Spending Limits',
        description: 'Configure budgets in Settings to track your monthly goals and receive notifications.',
        type: 'info',
        date: today,
      });
    }

    // 3. Category concentration
    const catList = this.getCategorySpending(expenses, []);
    if (catList.length > 0 && catList[0].percentage > 40) {
      insights.push({
        id: 'category_concentration',
        title: `Heavy ${catList[0].name} Spending`,
        description: `${catList[0].percentage}% of your expenses are concentrated in "${catList[0].name}" (${symbol}${Number(catList[0].amount).toFixed(2)}).`,
        type: 'info',
        date: today,
      });
    }

    return insights;
  },

  getYearlyTrendData(expenses: Expense[]): { month: string; amount: number }[] {
    const currentYear = new Date().getFullYear();
    const result: { month: string; amount: number }[] = [];
    const convert = useCurrencyStore.getState().convert;

    // Provide 5 year trend (currentYear - 4 to currentYear)
    for (let yr = currentYear - 4; yr <= currentYear; yr++) {
      const yrStr = yr.toString();
      const yrSpend = expenses
        .filter((e) => e.date.startsWith(yrStr))
        .reduce((sum, e) => {
          const amt = convert(Number(e.amount), e.currency || 'INR', 'INR');
          return sum + amt;
        }, 0);

      result.push({ month: yrStr, amount: yrSpend });
    }

    return result;
  },

  getPaymentMethodBreakdown(expenses: Expense[]): { method: string; amount: number; percentage: number; count: number; icon: string }[] {
    const convert = useCurrencyStore.getState().convert;
    const total = expenses.reduce((sum, e) => sum + convert(Number(e.amount), e.currency || 'INR', 'INR'), 0);

    const ALL_METHODS = ['UPI', 'Cash', 'Debit Card', 'Credit Card', 'Online (Netbanking)', 'Other'];
    const map: Record<string, { total: number; count: number }> = {
      'UPI': { total: 0, count: 0 },
      'Cash': { total: 0, count: 0 },
      'Debit Card': { total: 0, count: 0 },
      'Credit Card': { total: 0, count: 0 },
      'Online (Netbanking)': { total: 0, count: 0 },
      'Other': { total: 0, count: 0 },
    };

    expenses.forEach((e) => {
      const pm = (e.paymentMethod || '').trim();
      const lower = pm.toLowerCase();
      let key = 'Other';

      if (lower.includes('upi')) key = 'UPI';
      else if (lower.includes('cash')) key = 'Cash';
      else if (lower.includes('debit')) key = 'Debit Card';
      else if (lower.includes('credit')) key = 'Credit Card';
      else if (lower.includes('netbank') || lower.includes('online') || lower.includes('banking')) key = 'Online (Netbanking)';
      else if (lower.includes('card')) key = 'Debit Card';
      else key = 'Other';

      const amt = convert(Number(e.amount), e.currency || 'INR', 'INR');
      map[key].total += amt;
      map[key].count += 1;
    });

    return ALL_METHODS.map((method) => {
      const amount = map[method].total;
      return {
        method,
        amount,
        percentage: total > 0 ? Math.round((amount / total) * 100) : 0,
        count: map[method].count,
        icon: method === 'UPI' ? 'qrcode-scan' : method === 'Cash' ? 'cash' : method.includes('Card') ? 'credit-card' : method.includes('Online') ? 'bank' : 'dots-horizontal',
      };
    });
  },

  getFinancialHealthScore(expenses: Expense[], budgets: Budget[]): { score: number; status: string; statusColor: string; recommendation: string } {
    if (expenses.length === 0) {
      return {
        score: 85,
        status: 'Good Start',
        statusColor: '#10B981',
        recommendation: 'Log transactions to unlock real-time financial health analytics.',
      };
    }

    const convert = useCurrencyStore.getState().convert;
    const monthlySpend = this.getMonthlySpend(expenses);
    const monthlyBudget = budgets.find((b) => b.category.toLowerCase() === 'all' && b.period === 'monthly')?.amount || 0;

    let score = 82;

    if (monthlyBudget > 0) {
      const ratio = monthlySpend / monthlyBudget;
      if (ratio <= 0.7) score += 12;
      else if (ratio <= 0.9) score += 4;
      else if (ratio > 1.0) score -= Math.min(40, Math.round((ratio - 1) * 50));
    } else {
      score -= 4;
    }

    if (expenses.length >= 8) score += 4;

    const finalScore = Math.max(15, Math.min(99, score));

    let status = 'Optimal';
    let statusColor = '#10B981';
    let recommendation = 'Your spending habits are balanced and within healthy financial targets!';

    if (finalScore < 55) {
      status = 'Needs Attention';
      statusColor = '#EF4444';
      recommendation = 'Monthly expenses exceed recommended budget limits. Review discretionary spending.';
    } else if (finalScore < 78) {
      status = 'Moderate';
      statusColor = '#F59E0B';
      recommendation = 'You are approaching your budget limits. Monitor daily dining out and leisure expenses.';
    }

    return { score: finalScore, status, statusColor, recommendation };
  },

  getSpendingPatternByDay(expenses: Expense[]): { dayName: string; amount: number; percentage: number }[] {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const convert = useCurrencyStore.getState().convert;
    const totals = [0, 0, 0, 0, 0, 0, 0];

    let overallSum = 0;
    expenses.forEach((e) => {
      const d = new Date(e.date + 'T00:00:00');
      const idx = d.getDay();
      const amt = convert(Number(e.amount), e.currency || 'INR', 'INR');
      totals[idx] += amt;
      overallSum += amt;
    });

    return days.map((dayName, idx) => ({
      dayName,
      amount: totals[idx],
      percentage: overallSum > 0 ? Math.round((totals[idx] / overallSum) * 100) : 0,
    }));
  },
};
