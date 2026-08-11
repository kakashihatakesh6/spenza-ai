import { create } from 'zustand';
import { Expense, Category, Budget } from '../types';
import { expenseRepository } from '../database/repositories/expenseRepository';
import { useAuthStore } from './authStore';
import { useNotificationStore } from './notificationStore';
import { useSettingsStore } from './settingsStore';
import { dbService } from '../services/expense.service';
import { storageService } from '../services/storage.service';
import { budgetService } from '../services/budget.service';
import { logger } from '../services/logger';

interface ExpenseState {
  expenses: Expense[];
  categories: Category[];
  budgets: Budget[];
  isLoading: boolean;
  
  fetchExpenses: () => Promise<void>;
  fetchCategories: () => void;
  fetchBudgets: () => Promise<void>;
  
  addExpense: (expenseData: Omit<Expense, 'createdAt' | 'updatedAt' | 'isSynced'>) => Promise<void>;
  updateExpense: (expense: Expense) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;
  
  saveBudget: (budget: Budget) => Promise<void>;
  deleteBudget: (id: string) => Promise<void>;
}

const checkBudgetThresholds = async (expenses: Expense[], budgets: Budget[], categoryName: string) => {
  try {
    let currentBudgets = budgets;
    if (!currentBudgets || currentBudgets.length === 0) {
      currentBudgets = useExpenseStore.getState().budgets;
    }
    if (!currentBudgets || currentBudgets.length === 0) {
      try {
        await useExpenseStore.getState().fetchBudgets();
        currentBudgets = useExpenseStore.getState().budgets;
      } catch {}
    }
    if (!currentBudgets || currentBudgets.length === 0) return;

    const matchingBudgets = currentBudgets.filter(
      (b) => b.category.toLowerCase() === categoryName.toLowerCase() || b.category.toLowerCase() === 'all'
    );

    if (matchingBudgets.length === 0) return;

    const todayStr = new Date().toISOString().split('T')[0];
    const currentMonthStr = todayStr.slice(0, 7);
    const currentYearStr = todayStr.slice(0, 4);

    const userCurr = useSettingsStore.getState().settings.currency || 'INR';
    const symbol = userCurr === 'GBP' ? '£' : userCurr === 'USD' ? '$' : userCurr === 'EUR' ? '€' : '₹';

    for (const b of matchingBudgets) {
      if (b.amount <= 0) continue;

      let periodExpenses = expenses;

      if (b.period === 'weekly') {
        const today = new Date();
        const currentDay = today.getDay();
        const sunday = new Date(today);
        sunday.setDate(today.getDate() - currentDay);
        const startStr = sunday.toISOString().split('T')[0];
        periodExpenses = expenses.filter((e) => e.date >= startStr);
      } else if (b.period === 'yearly') {
        periodExpenses = expenses.filter((e) => e.date.startsWith(currentYearStr));
      } else {
        // monthly default
        periodExpenses = expenses.filter((e) => e.date.startsWith(currentMonthStr));
      }

      if (b.category.toLowerCase() !== 'all') {
        periodExpenses = periodExpenses.filter((e) => e.category.toLowerCase() === categoryName.toLowerCase());
      }

      const totalSpent = periodExpenses.reduce((sum, e) => sum + (parseFloat(String(e.amount)) || 0), 0);
      const limit = b.amount;
      const percentage = Math.round((totalSpent / limit) * 100);

      const targetLabel = b.category.toLowerCase() === 'all' ? 'Overall' : categoryName;

      if (totalSpent > limit) {
        const overAmount = (totalSpent - limit).toFixed(0);
        useNotificationStore.getState().addNotification({
          title: `Budget Exceeded!`,
          message: `You have exceeded your ${targetLabel} budget by ${symbol}${overAmount}.`,
          type: 'warning',
          categoryName: 'BUDGET',
        });
      } else if (percentage >= 80) {
        useNotificationStore.getState().addNotification({
          title: `Budget Warning: ${targetLabel}`,
          message: `You've used ${percentage}% of your ${targetLabel} budget (${symbol}${totalSpent.toFixed(0)} / ${symbol}${limit}).`,
          type: 'warning',
          categoryName: 'BUDGET',
        });
      }
    }
  } catch (err) {
    logger.warn('Failed to check budget thresholds', err);
  }
};

export const useExpenseStore = create<ExpenseState>((set, get) => ({
  expenses: [],
  categories: [],
  budgets: [],
  isLoading: false,

  fetchExpenses: async () => {
    set({ isLoading: true });
    try {
      const user = useAuthStore.getState().user;
      if (user) {
        // Fetch from Supabase cloud database
        const remoteExpenses = await dbService.getExpenses();
        // Overwrite local SQLite cache with latest cloud records
        expenseRepository.clearAllExpenses();
        for (const exp of remoteExpenses) {
          expenseRepository.createExpense(exp);
        }
        set({ expenses: remoteExpenses, isLoading: false });
      } else {
        // Fallback to offline SQLite DB
        const expenses = expenseRepository.getAllExpenses();
        set({ expenses, isLoading: false });
      }
    } catch (error) {
      logger.error('Error fetching expenses', error);
      // Graceful offline fallback
      try {
        const expenses = expenseRepository.getAllExpenses();
        set({ expenses, isLoading: false });
      } catch {
        set({ isLoading: false });
      }
    }
  },

  fetchCategories: () => {
    try {
      const categories = expenseRepository.getAllCategories();
      set({ categories });
    } catch (error) {
      logger.error('Error fetching categories from DB', error);
    }
  },

  fetchBudgets: async () => {
    try {
      // 1. Instantly load cached budgets from local storage / SQLite
      const localBudgets = expenseRepository.getAllBudgets();
      set({ budgets: localBudgets });

      // 2. Fetch remote budgets from Supabase if user session is active
      const remoteBudgets = await budgetService.getBudgets();
      if (remoteBudgets && remoteBudgets.length > 0) {
        remoteBudgets.forEach((b) => expenseRepository.saveBudget(b));
        set({ budgets: remoteBudgets });
      }
    } catch (error) {
      logger.error('Error fetching budgets', error);
      const localBudgets = expenseRepository.getAllBudgets();
      set({ budgets: localBudgets });
    }
  },

  addExpense: async (expenseData) => {
    try {
      const now = new Date().toISOString();
      const user = useAuthStore.getState().user;
      
      if (expenseData.receiptImage) {
        logger.info('Receipt attached', { source: 'addExpense' });
      }

      let imageUrl = expenseData.receiptImage;
      if (user && expenseData.receiptImage && !expenseData.receiptImage.startsWith('http')) {
        try {
          imageUrl = await storageService.uploadReceipt(expenseData.receiptImage, user.id);
        } catch (uploadError) {
          logger.error('Failed to upload receipt to storage', uploadError);
        }
      }

      const expense: Expense = {
        ...expenseData,
        receiptImage: imageUrl,
        createdAt: now,
        updatedAt: now,
        isSynced: user ? 1 : 0,
      };

      if (user) {
        // Save to Supabase Cloud DB
        const remoteExpense = await dbService.createExpense(expense, user.id);
        // Cache locally in SQLite
        expenseRepository.createExpense(remoteExpense);
        set((state) => ({
          expenses: [remoteExpense, ...state.expenses],
        }));
      } else {
        // Local SQLite only
        expenseRepository.createExpense(expense);
        set((state) => ({
          expenses: [expense, ...state.expenses],
        }));
      }
      logger.info('Expense created', { expenseId: expense.id });
      checkBudgetThresholds(get().expenses, get().budgets, expense.category);
    } catch (error) {
      logger.error('Error adding expense', error);
    }
  },

  updateExpense: async (expense) => {
    try {
      const now = new Date().toISOString();
      const user = useAuthStore.getState().user;
      const original = get().expenses.find((e) => e.id === expense.id);

      if (expense.receiptImage && (!original || original.receiptImage !== expense.receiptImage)) {
        logger.info('Receipt attached', { source: 'updateExpense' });
      }

      if (original && original.category !== expense.category) {
        logger.info('Category changed', { from: original.category, to: expense.category });
      }

      let imageUrl = expense.receiptImage;
      
      if (user && expense.receiptImage && !expense.receiptImage.startsWith('http')) {
        try {
          if (original?.receiptImage) {
            await storageService.deleteReceipt(original.receiptImage);
          }
          imageUrl = await storageService.uploadReceipt(expense.receiptImage, user.id);
        } catch (uploadError) {
          logger.error('Failed to upload updated receipt to storage', uploadError);
        }
      }

      const updatedExpense: Expense = {
        ...expense,
        receiptImage: imageUrl,
        updatedAt: now,
        isSynced: user ? 1 : 0,
      };

      if (user) {
        const remoteExpense = await dbService.updateExpense(updatedExpense, user.id);
        expenseRepository.updateExpense(remoteExpense);
        set((state) => ({
          expenses: state.expenses.map((e) => (e.id === expense.id ? remoteExpense : e)),
        }));
      } else {
        expenseRepository.updateExpense(updatedExpense);
        set((state) => ({
          expenses: state.expenses.map((e) => (e.id === expense.id ? updatedExpense : e)),
        }));
      }
      logger.info('Expense updated', { expenseId: expense.id });
      checkBudgetThresholds(get().expenses, get().budgets, expense.category);
    } catch (error) {
      logger.error('Error updating expense', error);
    }
  },

  deleteExpense: async (id) => {
    try {
      const user = useAuthStore.getState().user;
      
      if (user) {
        const original = get().expenses.find((e) => e.id === id);
        if (original?.receiptImage) {
          await storageService.deleteReceipt(original.receiptImage);
        }
        await dbService.deleteExpense(id);
      }

      expenseRepository.deleteExpense(id);
      set((state) => ({
        expenses: state.expenses.filter((e) => e.id !== id),
      }));
      logger.info('Expense deleted', { expenseId: id });
    } catch (error) {
      logger.error('Error deleting expense', error);
    }
  },

  saveBudget: async (budget) => {
    try {
      // 1. Save locally to SQLite / localStorage
      expenseRepository.saveBudget(budget);

      set((state) => {
        const index = state.budgets.findIndex((b) => b.id === budget.id);
        const updatedBudgets = [...state.budgets];
        if (index > -1) {
          updatedBudgets[index] = budget;
        } else {
          updatedBudgets.push(budget);
        }
        return { budgets: updatedBudgets };
      });

      // 2. Sync to Supabase cloud if user authenticated
      const user = useAuthStore.getState().user;
      if (user) {
        await budgetService.saveBudget(budget, user.id);
      }
    } catch (error: any) {
      logger.error('Error saving budget', error);
      throw error;
    }
  },

  deleteBudget: async (id) => {
    try {
      // 1. Delete locally from SQLite / localStorage
      expenseRepository.deleteBudget(id);
      set((state) => ({
        budgets: state.budgets.filter((b) => b.id !== id),
      }));

      // 2. Sync to Supabase cloud if user authenticated
      const user = useAuthStore.getState().user;
      if (user) {
        await budgetService.deleteBudget(id);
      }
    } catch (error: any) {
      logger.error('Error deleting budget', error);
      throw error;
    }
  },
}));
