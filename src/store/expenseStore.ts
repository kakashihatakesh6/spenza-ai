import { create } from 'zustand';
import { Alert } from 'react-native';
import { Expense, Category, Budget } from '../types';
import { expenseRepository } from '../database/repositories/expenseRepository';
import { useAuthStore } from './authStore';
import { dbService } from '../services/expense.service';
import { storageService } from '../services/storage.service';
import { budgetService } from '../services/budget.service';

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
      console.error('Error fetching expenses:', error);
      // Graceful offline fallback
      try {
        const expenses = expenseRepository.getAllExpenses();
        set({ expenses, isLoading: false });
      } catch (fallbackError) {
        set({ isLoading: false });
      }
    }
  },

  fetchCategories: () => {
    try {
      const categories = expenseRepository.getAllCategories();
      set({ categories });
    } catch (error) {
      console.error('Error fetching categories from DB:', error);
    }
  },

  fetchBudgets: async () => {
    set({ isLoading: true });
    try {
      const user = useAuthStore.getState().user;
      if (user) {
        const remoteBudgets = await budgetService.getBudgets();
        set({ budgets: remoteBudgets, isLoading: false });
      } else {
        set({ budgets: [], isLoading: false });
      }
    } catch (error: any) {
      set({ budgets: [], isLoading: false });
    }
  },

  addExpense: async (expenseData) => {
    try {
      const now = new Date().toISOString();
      const user = useAuthStore.getState().user;
      
      let imageUrl = expenseData.receiptImage;
      if (user && expenseData.receiptImage && !expenseData.receiptImage.startsWith('http')) {
        try {
          imageUrl = await storageService.uploadReceipt(expenseData.receiptImage, user.id);
        } catch (uploadError) {
          console.error('Failed to upload receipt to storage:', uploadError);
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
    } catch (error) {
      console.error('Error adding expense:', error);
    }
  },

  updateExpense: async (expense) => {
    try {
      const now = new Date().toISOString();
      const user = useAuthStore.getState().user;

      let imageUrl = expense.receiptImage;
      
      if (user && expense.receiptImage && !expense.receiptImage.startsWith('http')) {
        try {
          const original = get().expenses.find((e) => e.id === expense.id);
          if (original?.receiptImage) {
            await storageService.deleteReceipt(original.receiptImage);
          }
          imageUrl = await storageService.uploadReceipt(expense.receiptImage, user.id);
        } catch (uploadError) {
          console.error('Failed to upload updated receipt to storage:', uploadError);
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
    } catch (error) {
      console.error('Error updating expense:', error);
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
    } catch (error) {
      console.error('Error deleting expense:', error);
    }
  },

  saveBudget: async (budget) => {
    try {
      const user = useAuthStore.getState().user;
      if (user) {
        const remoteBudget = await budgetService.saveBudget(budget, user.id);
        
        set((state) => {
          const index = state.budgets.findIndex((b) => b.id === budget.id);
          if (index > -1) {
            const updatedBudgets = [...state.budgets];
            updatedBudgets[index] = remoteBudget;
            return { budgets: updatedBudgets };
          } else {
            return { budgets: [...state.budgets, remoteBudget] };
          }
        });
      }
    } catch (error: any) {
      throw error;
    }
  },

  deleteBudget: async (id) => {
    try {
      const user = useAuthStore.getState().user;
      if (user) {
        await budgetService.deleteBudget(id);
        set((state) => ({
          budgets: state.budgets.filter((b) => b.id !== id),
        }));
      }
    } catch (error: any) {
      throw error;
    }
  },
}));
