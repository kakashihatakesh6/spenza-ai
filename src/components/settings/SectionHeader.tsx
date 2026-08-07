import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { useTheme } from '../../hooks/useTheme';

interface SectionHeaderProps {
  title: string;
}

export const SectionHeader: React.FC<SectionHeaderProps> = React.memo(({ title }) => {
  const { colors } = useTheme();
  return <Text style={[styles.title, { color: colors.textSecondary }]}>{title}</Text>;
});

SectionHeader.displayName = 'SectionHeader';

const styles = StyleSheet.create({
  title: {
    fontSize: 12,
    fontWeight: '800',
    marginTop: 24,
    marginBottom: 8,
    letterSpacing: 1.0,
    textTransform: 'uppercase',
  },
});
