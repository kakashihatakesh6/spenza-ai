import { documentDirectory, writeAsStringAsync, readAsStringAsync, EncodingType, StorageAccessFramework } from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import { Expense } from '../types';
import { logger } from './logger';
import { useNotificationStore } from '../store/notificationStore';

export const exportService = {
  /**
   * Exports the list of expenses as a CSV file and returns the local file path.
   */
  async exportToCSV(expenses: Expense[], customFileName?: string): Promise<string> {
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

    let cleanName = (customFileName || '').trim();
    if (!cleanName) {
      cleanName = `expenses_export_${new Date().toISOString().split('T')[0]}.csv`;
    } else if (!cleanName.endsWith('.csv')) {
      cleanName += '.csv';
    }

    const filePath = `${documentDirectory}${cleanName}`;

    await writeAsStringAsync(filePath, csvContent, {
      encoding: EncodingType.UTF8,
    });

    useNotificationStore.getState().addNotification({
      title: 'CSV Export Ready 📄',
      message: `Your transaction report (${cleanName}) was generated successfully.`,
      type: 'success',
      categoryName: 'EXPORT',
    });

    return filePath;
  },

  /**
   * Saves CSV file to any user-chosen path on device via Storage Access Framework or native Share Sheet.
   */
  async saveCSVToCustomLocation(expenses: Expense[], customFileName?: string): Promise<{ success: boolean; path?: string }> {
    let cleanName = (customFileName || '').trim();
    if (!cleanName) {
      cleanName = `expenses_export_${new Date().toISOString().split('T')[0]}.csv`;
    } else if (!cleanName.endsWith('.csv')) {
      cleanName += '.csv';
    }

    const filePath = await this.exportToCSV(expenses, cleanName);

    // Try Android StorageAccessFramework for folder picking
    if (Platform.OS === 'android' && StorageAccessFramework) {
      try {
        const permissions = await StorageAccessFramework.requestDirectoryPermissionsAsync();
        if (permissions.granted) {
          const csvContent = await readAsStringAsync(filePath, { encoding: EncodingType.UTF8 });
          const createdUri = await StorageAccessFramework.createFileAsync(
            permissions.directoryUri,
            cleanName,
            'text/csv'
          );
          await writeAsStringAsync(createdUri, csvContent, { encoding: EncodingType.UTF8 });
          return { success: true, path: createdUri };
        } else {
          // User cancelled folder picker
          return { success: false };
        }
      } catch (err) {
        logger.warn('StorageAccessFramework custom path selection fallback to share sheet', err);
      }
    }

    // Fallback/iOS: Native system share & file save dialog sheet
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(filePath, {
        mimeType: 'text/csv',
        dialogTitle: 'Save CSV Expense Report',
        UTI: 'public.comma-separated-values-text',
      });
      return { success: true, path: filePath };
    }

    return { success: false };
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
