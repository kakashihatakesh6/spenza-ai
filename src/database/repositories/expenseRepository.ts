import { Platform } from 'react-native';
import { getDatabase } from '../database';
import { Expense, Category, Budget, Settings } from '../../types';

export const expenseRepository = {
  // --- Expenses ---
  getAllExpenses(): Expense[] {
    if (Platform.OS === 'web') {
      const data = localStorage.getItem('web_expenses');
      return data ? JSON.parse(data) : [];
    }

    const db = getDatabase();
    if (!db) return [];
    return db.getAllSync<Expense>(
      'SELECT * FROM expenses ORDER BY date DESC, time DESC;'
    );
  },

  getExpenseById(id: string): Expense | null {
    if (Platform.OS === 'web') {
      const list = this.getAllExpenses();
      return list.find((e) => e.id === id) || null;
    }

    const db = getDatabase();
    if (!db) return null;
    return db.getFirstSync<Expense>('SELECT * FROM expenses WHERE id = ?;', [id]);
  },

  createExpense(expense: Expense): void {
    if (Platform.OS === 'web') {
      const list = this.getAllExpenses();
      list.push(expense);
      localStorage.setItem('web_expenses', JSON.stringify(list));
      return;
    }

    const db = getDatabase();
    if (!db) return;
    db.runSync(
      `INSERT INTO expenses (
        id, amount, merchant, category, date, time, paymentMethod, currency, tax, notes, receiptImage, createdAt, updatedAt, isSynced
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        expense.id,
        expense.amount,
        expense.merchant,
        expense.category,
        expense.date,
        expense.time,
        expense.paymentMethod,
        expense.currency,
        expense.tax ?? null,
        expense.notes ?? null,
        expense.receiptImage ?? null,
        expense.createdAt,
        expense.updatedAt,
        expense.isSynced,
      ]
    );
  },

  updateExpense(expense: Expense): void {
    if (Platform.OS === 'web') {
      const list = this.getAllExpenses();
      const updated = list.map((e) => (e.id === expense.id ? expense : e));
      localStorage.setItem('web_expenses', JSON.stringify(updated));
      return;
    }

    const db = getDatabase();
    if (!db) return;
    db.runSync(
      `UPDATE expenses SET 
        amount = ?, merchant = ?, category = ?, date = ?, time = ?, paymentMethod = ?, currency = ?, tax = ?, notes = ?, receiptImage = ?, updatedAt = ?, isSynced = ?
      WHERE id = ?;`,
      [
        expense.amount,
        expense.merchant,
        expense.category,
        expense.date,
        expense.time,
        expense.paymentMethod,
        expense.currency,
        expense.tax ?? null,
        expense.notes ?? null,
        expense.receiptImage ?? null,
        expense.updatedAt,
        expense.isSynced,
        expense.id,
      ]
    );
  },

  deleteExpense(id: string): void {
    if (Platform.OS === 'web') {
      const list = this.getAllExpenses();
      const filtered = list.filter((e) => e.id !== id);
      localStorage.setItem('web_expenses', JSON.stringify(filtered));
      return;
    }

    const db = getDatabase();
    if (!db) return;
    db.runSync('DELETE FROM expenses WHERE id = ?;', [id]);
  },

  clearAllExpenses(): void {
    if (Platform.OS === 'web') {
      localStorage.setItem('web_expenses', JSON.stringify([]));
      return;
    }

    const db = getDatabase();
    if (!db) return;
    db.runSync('DELETE FROM expenses;');
  },

  // --- Categories ---
  getAllCategories(): Category[] {
    if (Platform.OS === 'web') {
      const data = localStorage.getItem('web_categories');
      return data ? JSON.parse(data) : [];
    }

    const db = getDatabase();
    if (!db) return [];
    return db.getAllSync<Category>('SELECT * FROM categories ORDER BY name ASC;');
  },

  createCategory(category: Category): void {
    if (Platform.OS === 'web') {
      const list = this.getAllCategories();
      list.push(category);
      localStorage.setItem('web_categories', JSON.stringify(list));
      return;
    }

    const db = getDatabase();
    if (!db) return;
    db.runSync(
      'INSERT INTO categories (id, name, icon, color) VALUES (?, ?, ?, ?);',
      [category.id, category.name, category.icon, category.color]
    );
  },

  // --- Budgets ---
  getAllBudgets(): Budget[] {
    // Budget should not be loaded from local storage (localStorage or SQLite). Persisted using Supabase.
    return [];
  },

  saveBudget(budget: Budget): void {
    // Budget should not be saved in local storage (localStorage or SQLite). Persisted using Supabase.
  },

  deleteBudget(id: string): void {
    // Budget should not be saved in local storage (localStorage or SQLite). Persisted using Supabase.
  },

  // --- Settings ---
  getSettings(): Settings {
    if (Platform.OS === 'web') {
      const data = localStorage.getItem('web_settings');
      const settingsMap = data ? JSON.parse(data) : {};
      return {
        theme: (settingsMap.theme as 'light' | 'dark' | 'system') || 'system',
        currency: settingsMap.currency || 'INR',
        notificationsEnabled: settingsMap.notificationsEnabled === 'true' || settingsMap.notificationsEnabled === true,
        notificationHour: settingsMap.notificationHour !== undefined ? Number(settingsMap.notificationHour) : 20,
        notificationMinute: settingsMap.notificationMinute !== undefined ? Number(settingsMap.notificationMinute) : 0,
        budgetWarningEnabled: settingsMap.budgetWarningEnabled === undefined ? true : (settingsMap.budgetWarningEnabled === 'true' || settingsMap.budgetWarningEnabled === true),
        budgetWarningThreshold: settingsMap.budgetWarningThreshold !== undefined ? Number(settingsMap.budgetWarningThreshold) : 80,
        biometricsEnabled: settingsMap.biometricsEnabled === 'true' || settingsMap.biometricsEnabled === true,
      };
    }

    const db = getDatabase();
    const settings: Settings = {
      theme: 'system',
      currency: 'INR',
      notificationsEnabled: true,
      notificationHour: 20,
      notificationMinute: 0,
      budgetWarningEnabled: true,
      budgetWarningThreshold: 80,
      biometricsEnabled: false,
    };

    if (!db) return settings;
    
    const rows = db.getAllSync<{ key: string; value: string }>('SELECT * FROM settings;');

    rows.forEach((row) => {
      if (row.key === 'theme') {
        settings.theme = row.value as 'light' | 'dark' | 'system';
      } else if (row.key === 'currency') {
        settings.currency = row.value;
      } else if (row.key === 'notificationsEnabled') {
        settings.notificationsEnabled = row.value === 'true';
      } else if (row.key === 'notificationHour') {
        settings.notificationHour = Number(row.value);
      } else if (row.key === 'notificationMinute') {
        settings.notificationMinute = Number(row.value);
      } else if (row.key === 'budgetWarningEnabled') {
        settings.budgetWarningEnabled = row.value === 'true';
      } else if (row.key === 'budgetWarningThreshold') {
        settings.budgetWarningThreshold = Number(row.value);
      } else if (row.key === 'biometricsEnabled') {
        settings.biometricsEnabled = row.value === 'true';
      }
    });

    return settings;
  },

  saveSetting(key: string, value: string): void {
    if (Platform.OS === 'web') {
      const data = localStorage.getItem('web_settings');
      const settingsMap = data ? JSON.parse(data) : {};
      settingsMap[key] = value;
      localStorage.setItem('web_settings', JSON.stringify(settingsMap));
      return;
    }

    const db = getDatabase();
    if (!db) return;
    const existing = db.getFirstSync<{ key: string }>('SELECT key FROM settings WHERE key = ?;', [key]);
    if (existing) {
      db.runSync('UPDATE settings SET value = ? WHERE key = ?;', [value, key]);
    } else {
      db.runSync('INSERT INTO settings (key, value) VALUES (?, ?);', [key, value]);
    }
  },
};
