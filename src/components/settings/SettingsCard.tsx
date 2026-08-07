import React from 'react';
import { StyleSheet, View, StyleProp, ViewStyle, Platform } from 'react-native';
import { useTheme } from '../../hooks/useTheme';

interface SettingsCardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export const SettingsCard: React.FC<SettingsCardProps> = React.memo(({ children, style }) => {
  const { colors } = useTheme();
  return <View style={[styles.card, { backgroundColor: colors.card }, style]}>{children}</View>;
});

SettingsCard.displayName = 'SettingsCard';

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
    padding: 20,
    marginBottom: 18,
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.02,
        shadowRadius: 8,
      },
      android: {
        elevation: 1.5,
      },
    }),
  },
});
