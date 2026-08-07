import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Tabs } from 'expo-router';
import { useTheme } from '../../hooks/useTheme';
import { Home, Receipt, TrendingUp, Settings as SettingsIcon } from 'lucide-react-native';

const TabIcon = ({ focused, icon: Icon, badge, fill }: { focused: boolean; icon: any; badge?: boolean; fill?: boolean }) => {
  const { colors } = useTheme();
  const iconColor = focused ? colors.primary : colors.textSecondary;
  return (
    <View style={focused ? [styles.activeIconWrapper, { backgroundColor: 'rgba(99, 102, 241, 0.15)' }] : styles.inactiveIconWrapper}>
      <Icon size={20} color={iconColor} fill={fill ? iconColor : 'none'} />
      {badge && <View style={styles.badgeDot} />}
    </View>
  );
};

const CustomTabBarButton = ({ children, onPress }: any) => {
  return (
    <TouchableOpacity
      style={styles.customButtonContainer}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <View style={styles.customButton}>
        <Text style={styles.customButtonText}>AI</Text>
      </View>
    </TouchableOpacity>
  );
};

export default function TabsLayout() {
  const { colors, isDark } = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        headerStyle: {
          backgroundColor: colors.card,
          elevation: 0,
          shadowOpacity: 0,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        },
        headerTitleStyle: {
          fontWeight: '900',
          fontSize: 20,
          letterSpacing: -0.5,
        },
        headerTintColor: colors.text,
        tabBarStyle: {
          backgroundColor: isDark ? '#0F172A' : '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: isDark ? '#1E293B' : '#EAEAEA',
          height: 72,
          paddingBottom: 10,
          paddingTop: 10,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700',
          marginTop: 2,
        },
        tabBarHideOnKeyboard: true,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarLabel: 'Dashboard',
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} icon={Home} fill={focused} />,
        }}
      />
      <Tabs.Screen
        name="expenses"
        options={{
          title: 'Transactions',
          tabBarLabel: 'Expenses',
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} icon={Receipt} />,
        }}
      />
      <Tabs.Screen
        name="ai"
        options={{
          title: 'AI Smart Hub',
          tabBarLabel: 'AI',
          tabBarButton: (props) => <CustomTabBarButton {...props} />,
        }}
      />
      <Tabs.Screen
        name="analytics"
        options={{
          title: 'Analytics',
          tabBarLabel: 'Analytics',
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} icon={TrendingUp} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarLabel: 'Settings',
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} icon={SettingsIcon} badge={true} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  activeIconWrapper: {
    paddingVertical: 4,
    paddingHorizontal: 14,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
  },
  inactiveIconWrapper: {
    paddingVertical: 4,
    paddingHorizontal: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
  },
  badgeDot: {
    position: 'absolute',
    top: 0,
    right: 8,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#EF4444', // Premium red dot
  },
  customButtonContainer: {
    top: -15, // Elevates the AI button above the tab bar line
    justifyContent: 'center',
    alignItems: 'center',
    width: 68,
    height: 68,
  },
  customButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#070A13', // Deep dark blue
    borderWidth: 2,
    borderColor: '#312E81', // Glowing dark indigo
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#818CF8',
    shadowOpacity: 0.35,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 6,
  },
  customButtonText: {
    color: '#818CF8', // Glowing indigo AI text
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
});
