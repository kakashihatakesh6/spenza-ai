import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';

interface TransactionFiltersProps {
  onDatePress: () => void;
  onCategoryPress: () => void;
  selectedCategory: string | null;
  selectedSortLabel: string;
}

export const TransactionFilters: React.FC<TransactionFiltersProps> = React.memo(({
  onDatePress,
  onCategoryPress,
  selectedCategory,
  selectedSortLabel,
}) => {
  const { colors } = useTheme();

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.filterBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
        onPress={onDatePress}
        activeOpacity={0.7}
        accessibilityLabel="Sort by date trigger"
      >
        <Text style={[styles.btnText, { color: colors.text }]} numberOfLines={1}>
          {selectedSortLabel}
        </Text>
        <Ionicons name="chevron-down" size={16} color={colors.textSecondary} style={styles.chevron} />
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.filterBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
        onPress={onCategoryPress}
        activeOpacity={0.7}
        accessibilityLabel="Filter by category trigger"
      >
        <Text style={[styles.btnText, { color: colors.text }]} numberOfLines={1}>
          {selectedCategory ? `Category: ${selectedCategory}` : 'Category'}
        </Text>
        <Ionicons name="chevron-down" size={16} color={colors.textSecondary} style={styles.chevron} />
      </TouchableOpacity>
    </View>
  );
});

TransactionFilters.displayName = 'TransactionFilters';

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginTop: 12,
    gap: 12,
  },
  filterBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 48,
    paddingHorizontal: 18,
    borderRadius: 14,
    borderWidth: 1,
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.02,
        shadowRadius: 2,
      },
      android: {
        elevation: 1,
      },
    }),
  },
  btnText: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
    marginRight: 4,
  },
  chevron: {
    marginLeft: 4,
  },
});
