import { documentDirectory, writeAsStringAsync, readAsStringAsync, EncodingType } from 'expo-file-system/legacy';
import { Expense } from '../types';
import { logger } from './logger';

export const exportService = {
  /**
   * Exports the list of expenses as a CSV file and returns the local file path.
   */
  async exportToCSV(expenses: Expense[]): Promise<string> {
    const headers = [
      'ID',
      'Amount',
      'Merchant',
      'Category',
      'Date',
      'Time',
      'Payment Method',
      'Currency',
      'Tax',
      'Notes',
      'Created At',
    ];

    const rows = expenses.map((e) => [
      e.id,
      e.amount.toString(),
      this._escapeCSVField(e.merchant),
      this._escapeCSVField(e.category),
      e.date,
      e.time,
      this._escapeCSVField(e.paymentMethod),
      e.currency,
      e.tax ? e.tax.toString() : '0',
      this._escapeCSVField(e.notes ?? ''),
      e.createdAt,
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.join(',')),
    ].join('\n');

    const fileName = `expenses_export_${new Date().toISOString().split('T')[0]}.csv`;
    const filePath = `${documentDirectory}${fileName}`;

    await writeAsStringAsync(filePath, csvContent, {
      encoding: EncodingType.UTF8,
    });

    return filePath;
  },

  /**
   * Exports the list of expenses as a JSON backup file and returns the local file path.
   */
  async exportToJSON(expenses: Expense[]): Promise<string> {
    const backupData = {
      version: '1.0.0',
      exportDate: new Date().toISOString(),
      expenses,
    };

    const jsonContent = JSON.stringify(backupData, null, 2);
    const fileName = `expenses_backup_${new Date().toISOString().split('T')[0]}.json`;
    const filePath = `${documentDirectory}${fileName}`;

    await writeAsStringAsync(filePath, jsonContent, {
      encoding: EncodingType.UTF8,
    });

    return filePath;
  },

  /**
   * Simulates importing data from a JSON backup file.
   */
  async importFromJSON(fileUri: string): Promise<Expense[]> {
    try {
      const fileContent = await readAsStringAsync(fileUri, {
        encoding: EncodingType.UTF8,
      });

      const parsed = JSON.parse(fileContent);
      if (parsed && Array.isArray(parsed.expenses)) {
        return parsed.expenses;
      }
      throw new Error('Invalid backup file structure');
    } catch (error) {
      logger.error('Import failed', error);
      throw error;
    }
  },

  _escapeCSVField(field: string): string {
    if (field.includes(',') || field.includes('"') || field.includes('\n')) {
      return `"${field.replace(/"/g, '""')}"`;
    }
    return field;
  },
};
