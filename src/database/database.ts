import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';

let db: SQLite.SQLiteDatabase | null = null;

export function getDatabase(): SQLite.SQLiteDatabase | null {
  if (Platform.OS === 'web') {
    return null;
  }
  if (!db) {
    db = SQLite.openDatabaseSync('kiddo_expense.db');
  }
  return db;
}

export function initDatabase(): void {
  try {
    if (Platform.OS === 'web') {
      // Initialize Web Mock Database via localStorage
      initWebDatabase();
      return;
    }

    const sqliteDb = getDatabase();
    if (!sqliteDb) return;

    // Create tables for native SQLite
    sqliteDb.execSync(`
      CREATE TABLE IF NOT EXISTS categories (
        id TEXT PRIMARY KEY,
        name TEXT UNIQUE NOT NULL,
        icon TEXT NOT NULL,
        color TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS expenses (
        id TEXT PRIMARY KEY NOT NULL,
        amount REAL NOT NULL,
        merchant TEXT NOT NULL,
        category TEXT NOT NULL,
        date TEXT NOT NULL,
        time TEXT NOT NULL,
        paymentMethod TEXT NOT NULL,
        currency TEXT NOT NULL,
        tax REAL,
        notes TEXT,
        receiptImage TEXT,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        isSynced INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS budgets (
        id TEXT PRIMARY KEY NOT NULL,
        category TEXT NOT NULL,
        amount REAL NOT NULL,
        period TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL
      );
    `);

    // Seed default categories if none exist
    const categoriesCount = sqliteDb.getFirstSync<{ count: number }>(
      'SELECT COUNT(*) as count FROM categories;'
    );

    if (categoriesCount && categoriesCount.count === 0) {
      const defaultCategories = [
        { id: '1', name: 'Food', icon: 'food-fork-drink', color: '#FF9500' },
        { id: '2', name: 'Grocery', icon: 'cart', color: '#4CD964' },
        { id: '3', name: 'Fuel', icon: 'gas-station', color: '#FFCC00' },
        { id: '4', name: 'Shopping', icon: 'shopping', color: '#FF2D55' },
        { id: '5', name: 'Bills', icon: 'file-document-outline', color: '#5856D6' },
        { id: '6', name: 'Travel', icon: 'airplane', color: '#5AC8FA' },
        { id: '7', name: 'Entertainment', icon: 'movie-roll', color: '#FF5E3A' },
        { id: '8', name: 'Health', icon: 'heart-pulse', color: '#FF3B30' },
        { id: '9', name: 'Rent', icon: 'home-variant', color: '#8E8E93' },
        { id: '10', name: 'EMI', icon: 'bank', color: '#A4E786' },
        { id: '11', name: 'Education', icon: 'school', color: '#007AFF' },
        { id: '12', name: 'Other', icon: 'dots-horizontal', color: '#C7C7CC' },
      ];

      for (const cat of defaultCategories) {
        sqliteDb.runSync(
          'INSERT INTO categories (id, name, icon, color) VALUES (?, ?, ?, ?);',
          [cat.id, cat.name, cat.icon, cat.color]
        );
      }
    }

    // Seed default settings if none exist
    const settingsCount = sqliteDb.getFirstSync<{ count: number }>(
      'SELECT COUNT(*) as count FROM settings;'
    );

    if (settingsCount && settingsCount.count === 0) {
      const defaultSettings = [
        { key: 'theme', value: 'system' },
        { key: 'currency', value: 'INR' },
        { key: 'notificationsEnabled', value: 'true' },
      ];

      for (const set of defaultSettings) {
        sqliteDb.runSync(
          'INSERT INTO settings (key, value) VALUES (?, ?);',
          [set.key, set.value]
        );
      }
    }
  } catch (error) {
    console.error('Failed to initialize local SQLite database:', error);
  }
}

function initWebDatabase() {
  if (typeof window === 'undefined' || !window.localStorage) return;

  // 1. Seed Categories
  if (!localStorage.getItem('web_categories')) {
    const defaultCategories = [
      { id: '1', name: 'Food', icon: 'food-fork-drink', color: '#FF9500' },
      { id: '2', name: 'Grocery', icon: 'cart', color: '#4CD964' },
      { id: '3', name: 'Fuel', icon: 'gas-station', color: '#FFCC00' },
      { id: '4', name: 'Shopping', icon: 'shopping', color: '#FF2D55' },
      { id: '5', name: 'Bills', icon: 'file-document-outline', color: '#5856D6' },
      { id: '6', name: 'Travel', icon: 'airplane', color: '#5AC8FA' },
      { id: '7', name: 'Entertainment', icon: 'movie-roll', color: '#FF5E3A' },
      { id: '8', name: 'Health', icon: 'heart-pulse', color: '#FF3B30' },
      { id: '9', name: 'Rent', icon: 'home-variant', color: '#8E8E93' },
      { id: '10', name: 'EMI', icon: 'bank', color: '#A4E786' },
      { id: '11', name: 'Education', icon: 'school', color: '#007AFF' },
      { id: '12', name: 'Other', icon: 'dots-horizontal', color: '#C7C7CC' },
    ];
    localStorage.setItem('web_categories', JSON.stringify(defaultCategories));
  }

  // 2. Seed Settings
  if (!localStorage.getItem('web_settings')) {
    const defaultSettings = {
      theme: 'system',
      currency: 'INR',
      notificationsEnabled: 'true',
    };
    localStorage.setItem('web_settings', JSON.stringify(defaultSettings));
  }

  // 3. Seed Expenses (empty array)
  if (!localStorage.getItem('web_expenses')) {
    localStorage.setItem('web_expenses', JSON.stringify([]));
  }

  // 4. Seed Budgets (empty array)
  if (!localStorage.getItem('web_budgets')) {
    localStorage.setItem('web_budgets', JSON.stringify([]));
  }
}
