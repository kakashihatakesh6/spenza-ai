import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';

interface SettingsRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  iconBg: string;
  iconColor: string;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  rightElement?: React.ReactNode;
}

export const SettingsRow: React.FC<SettingsRowProps> = React.memo(({
  icon,
  iconBg,
  iconColor,
  title,
  subtitle,
  onPress,
  rightElement,
}) => {
  const { colors, isDark } = useTheme();
  const Container = onPress ? TouchableOpacity : View;
  
  // Custom dark mode icon backdrop styling to remain legible
  const dynamicIconBg = isDark ? '#1E293B' : iconBg;
  const dynamicIconColor = isDark ? '#818CF8' : iconColor;

  return (
    <Container
      style={styles.row}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
      accessibilityRole={onPress ? 'button' : 'none'}
      accessibilityLabel={`${title}${subtitle ? `, ${subtitle}` : ''}`}
    >
      <View style={[styles.iconContainer, { backgroundColor: dynamicIconBg }]}>
        <Ionicons name={icon} size={20} color={dynamicIconColor} />
      </View>
      
      <View style={styles.centerSection}>
        <Text style={[styles.titleText, { color: colors.text }]} numberOfLines={1}>{title}</Text>
        {subtitle ? (
          <Text style={[styles.subtitleText, { color: colors.textSecondary }]} numberOfLines={1}>{subtitle}</Text>
        ) : null}
      </View>
      
      <View style={styles.rightSection}>
        {rightElement !== undefined ? (
          rightElement
        ) : onPress ? (
          <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
        ) : null}
      </View>
    </Container>
  );
});

SettingsRow.displayName = 'SettingsRow';

const styles = StyleSheet.create({
  row: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  centerSection: {
    flex: 1,
    justifyContent: 'center',
  },
  titleText: {
    fontSize: 15,
    fontWeight: '700',
  },
  subtitleText: {
    fontSize: 12,
    marginTop: 2,
  },
  rightSection: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    minWidth: 30,
  },
});
