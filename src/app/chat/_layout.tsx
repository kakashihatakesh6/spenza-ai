import React from 'react';
import { Stack } from 'expo-router';
import { useTheme } from '../../hooks/useTheme';

export default function ChatLayout() {
  const { colors } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: colors.card,
        },
        headerTintColor: colors.text,
        headerTitleStyle: {
          fontWeight: '900',
          fontSize: 18,
        },
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: 'AI Chat Assistant',
          headerShown: false, // We will render a custom header with Back button in the screens
        }}
      />
      <Stack.Screen
        name="[id]"
        options={{
          title: 'Chat Session',
          headerShown: false, // Custom header inside chat screen
        }}
      />
    </Stack>
  );
}
