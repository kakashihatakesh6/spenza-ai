import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { Budget } from '../types';

export const budgetService = {
  async getBudgets(): Promise<Budget[]> {
    const user = useAuthStore.getState().user;
    if (!user) return [];
    const budgets = user.user_metadata?.budgets;
    return Array.isArray(budgets) ? budgets : [];
  },

  async saveBudget(budget: Budget, userId: string): Promise<Budget> {
    const user = useAuthStore.getState().user;
    if (!user) throw new Error('No user authenticated');

    const currentBudgets: Budget[] = Array.isArray(user.user_metadata?.budgets) 
      ? user.user_metadata.budgets 
      : [];

    const index = currentBudgets.findIndex((b) => b.id === budget.id);
    const updatedBudgets = [...currentBudgets];
    if (index > -1) {
      updatedBudgets[index] = budget;
    } else {
      updatedBudgets.push(budget);
    }

    const { error } = await supabase.auth.updateUser({
      data: { budgets: updatedBudgets }
    });

    if (error) throw error;
    return budget;
  },

  async deleteBudget(id: string): Promise<void> {
    const user = useAuthStore.getState().user;
    if (!user) throw new Error('No user authenticated');

    const currentBudgets: Budget[] = Array.isArray(user.user_metadata?.budgets) 
      ? user.user_metadata.budgets 
      : [];

    const filteredBudgets = currentBudgets.filter((b) => b.id !== id);

    const { error } = await supabase.auth.updateUser({
      data: { budgets: filteredBudgets }
    });

    if (error) throw error;
  },
};
