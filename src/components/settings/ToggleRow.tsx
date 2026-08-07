import React from 'react';
import { Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SettingsRow } from './SettingsRow';

interface ToggleRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  iconBg: string;
  iconColor: string;
  title: string;
  subtitle?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  activeTrackColor?: string;
}

export const ToggleRow: React.FC<ToggleRowProps> = React.memo(({
  icon,
  iconBg,
  iconColor,
  title,
  subtitle,
  value,
  onValueChange,
  activeTrackColor = '#0EA5E9',
}) => {
  return (
    <SettingsRow
      icon={icon}
      iconBg={iconBg}
      iconColor={iconColor}
      title={title}
      subtitle={subtitle}
      rightElement={
        <Switch
          value={value}
          onValueChange={onValueChange}
          trackColor={{ false: '#767577', true: activeTrackColor }}
          thumbColor={value ? '#FFFFFF' : '#f4f3f4'}
          ios_backgroundColor="#E9E9EA"
        />
      }
    />
  );
});

ToggleRow.displayName = 'ToggleRow';
