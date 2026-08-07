import React from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import { SettingsCard } from './SettingsCard';

interface SignOutButtonProps {
  onPress: () => void;
}

export const SignOutButton: React.FC<SignOutButtonProps> = React.memo(({ onPress }) => {
  return (
    <SettingsCard style={styles.card}>
      <TouchableOpacity
        style={styles.btn}
        onPress={onPress}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="Sign out of application"
      >
        <Text style={styles.btnText}>Sign Out</Text>
      </TouchableOpacity>
    </SettingsCard>
  );
});

SignOutButton.displayName = 'SignOutButton';

const styles = StyleSheet.create({
  card: {
    padding: 0,
    overflow: 'hidden',
  },
  btn: {
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FF3B30',
  },
});
