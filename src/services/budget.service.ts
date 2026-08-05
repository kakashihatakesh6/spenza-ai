import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { Budget } from '../types';

export const budgetService = {
  async getBudgets(): Promise<Budget[]> {
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (!error && user) {
        useAuthStore.setState({ user });
        const budgets = user.user_metadata?.budgets;
        return Array.isArray(budgets) ? budgets : [];
      }
    } catch {
      // Fallback to cached auth user if offline
    }

    const cachedUser = useAuthStore.getState().user;
    if (!cachedUser) return [];
    const budgets = cachedUser.user_metadata?.budgets;
    return Array.isArray(budgets) ? budgets : [];
  },

  async saveBudget(budget: Budget, userId: string): Promise<Budget> {
    let user = useAuthStore.getState().user;
    if (!user) {
      const { data } = await supabase.auth.getUser();
      user = data.user;
    }
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

    const { data, error } = await supabase.auth.updateUser({
      data: { budgets: updatedBudgets }
    });

    if (error) throw error;

    if (data?.user) {
      useAuthStore.setState({ user: data.user });
    }

    return budget;
  },

  async deleteBudget(id: string): Promise<void> {
    let user = useAuthStore.getState().user;
    if (!user) {
      const { data } = await supabase.auth.getUser();
      user = data.user;
    }
    if (!user) throw new Error('No user authenticated');

    const currentBudgets: Budget[] = Array.isArray(user.user_metadata?.budgets) 
      ? user.user_metadata.budgets 
      : [];

    const filteredBudgets = currentBudgets.filter((b) => b.id !== id);

    const { data, error } = await supabase.auth.updateUser({
      data: { budgets: filteredBudgets }
    });

    if (error) throw error;

    if (data?.user) {
      useAuthStore.setState({ user: data.user });
    }
  },
};
