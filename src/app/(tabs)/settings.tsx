import React, { useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Alert,
  TextInput,
  TouchableOpacity,
  Switch,
} from 'react-native';
import { useRouter, useNavigation } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSettingsStore } from '../../store/settingsStore';
import { useExpenseStore } from '../../store/expenseStore';
import { useAuthStore } from '../../store/authStore';
import { useTheme } from '../../hooks/useTheme';
import { exportService } from '../../services/exportService';
import { notificationService } from '../../services/notificationService';
import { expenseHelpers } from '../../utils/expenseHelpers';
import { Header } from '../../components/Header';

// Redesigned components
import { SettingsCard } from '../../components/settings/SettingsCard';
import { SettingsRow } from '../../components/settings/SettingsRow';
import { ToggleRow } from '../../components/settings/ToggleRow';
import { ProfileCard } from '../../components/settings/ProfileCard';
import { SectionHeader } from '../../components/settings/SectionHeader';
import { SignOutButton } from '../../components/settings/SignOutButton';

export default function SettingsScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { colors, theme, isDark } = useTheme();

  useEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);

  const user = useAuthStore((state) => state.user);
  const signOut = useAuthStore((state) => state.signOut);
  
  const { 
    settings, 
    setTheme, 
    setCurrency, 
    setNotificationsEnabled, 
    setAiCategorizationEnabled, 
    setOcrEngine, 
    setGeminiApiKey,
    setNotificationTime,
    setBudgetWarningEnabled,
    setBudgetWarningThreshold,
  } = useSettingsStore();
  const { expenses } = useExpenseStore();

  const handleLogout = useCallback(() => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out of your account?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Sign Out', 
          style: 'destructive',
          onPress: async () => {
            await signOut();
          }
        }
      ]
    );
  }, [signOut]);

  const handleThemeChange = useCallback(() => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
  }, [theme, setTheme]);

  const selectCurrency = useCallback(() => {
    Alert.alert(
      'Select Currency',
      'Choose your preferred base currency symbol:',
      [
        { text: 'USD ($)', onPress: () => setCurrency('USD') },
        { text: 'INR (₹)', onPress: () => setCurrency('INR') },
        { text: 'EUR (€)', onPress: () => setCurrency('EUR') },
        { text: 'GBP (£)', onPress: () => setCurrency('GBP') },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  }, [setCurrency]);

  const handleExportCSV = useCallback(async () => {
    if (expenses.length === 0) {
      Alert.alert('No Data', 'You have no transactions to export.');
      return;
    }
    try {
      const path = await exportService.exportToCSV(expenses);
      Alert.alert('Export Successful', `Expenses CSV file successfully created and saved to:\n\n${path}`);
    } catch (e) {
      Alert.alert('Export Failed', 'An error occurred during CSV creation.');
    }
  }, [expenses]);

  const handleExportJSON = useCallback(async () => {
    if (expenses.length === 0) {
      Alert.alert('No Data', 'You have no transactions to backup.');
      return;
    }
    try {
      const path = await exportService.exportToJSON(expenses);
      Alert.alert('Backup Complete', `JSON Database backup successfully saved to:\n\n${path}`);
    } catch (e) {
      Alert.alert('Backup Failed', 'An error occurred during backup creation.');
    }
  }, [expenses]);

  const formatTime = useCallback((hour: number, minute: number) => {
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 === 0 ? 12 : hour % 12;
    const displayMinute = minute < 10 ? `0${minute}` : minute;
    return `${displayHour}:${displayMinute} ${ampm}`;
  }, []);

  const handleAdjustHour = useCallback((amount: number) => {
    const currentHour = settings.notificationHour !== undefined ? settings.notificationHour : 20;
    const currentMinute = settings.notificationMinute !== undefined ? settings.notificationMinute : 0;
    const nextHour = (currentHour + amount + 24) % 24;
    setNotificationTime(nextHour, currentMinute);
    if (settings.notificationsEnabled) {
      notificationService.scheduleDailyReminder(nextHour, currentMinute);
    }
  }, [settings, setNotificationTime]);

  const handleAdjustMinute = useCallback((amount: number) => {
    const currentHour = settings.notificationHour !== undefined ? settings.notificationHour : 20;
    const currentMinute = settings.notificationMinute !== undefined ? settings.notificationMinute : 0;
    const nextMinute = (currentMinute + amount + 60) % 60;
    setNotificationTime(currentHour, nextMinute);
    if (settings.notificationsEnabled) {
      notificationService.scheduleDailyReminder(currentHour, nextMinute);
    }
  }, [settings, setNotificationTime]);

  const handleToggleNotifications = useCallback(async (enabled: boolean) => {
    setNotificationsEnabled(enabled);
    if (enabled) {
      const granted = await notificationService.requestPermissions();
      if (granted) {
        await notificationService.scheduleDailyReminder(
          settings.notificationHour !== undefined ? settings.notificationHour : 20,
          settings.notificationMinute !== undefined ? settings.notificationMinute : 0
        );
      } else {
        setNotificationsEnabled(false);
        Alert.alert('Permission Denied', 'Please enable notifications in device settings.');
      }
    } else {
      await notificationService.cancelAllScheduledNotifications();
    }
  }, [settings, setNotificationsEnabled]);

  const handleTestDailyReminder = useCallback(async () => {
    try {
      await notificationService.sendTestDailyReminder();
    } catch {
      Alert.alert('Error', 'Failed to send test reminder notification.');
    }
  }, []);

  const handleTestWarning = useCallback(async () => {
    try {
      await notificationService.sendTestBudgetWarning(
        'Groceries',
        settings.budgetWarningThreshold || 80,
        expenseHelpers.getCurrencySymbol(settings.currency)
      );
    } catch {
      Alert.alert('Error', 'Failed to send test warning notification.');
    }
  }, [settings]);

  const handleTestExceeded = useCallback(async () => {
    try {
      await notificationService.sendTestBudgetExceeded(
        'Dining Out',
        145.50,
        100.00,
        expenseHelpers.getCurrencySymbol(settings.currency)
      );
    } catch {
      Alert.alert('Error', 'Failed to send test exceeded notification.');
    }
  }, [settings]);

  const email = user?.email || 'guest@example.com';
  const username = user?.user_metadata?.username || user?.user_metadata?.full_name || email.split('@')[0].toUpperCase();

  // Dynamic Theme Helpers
  const dividerStyle = [styles.divider, { backgroundColor: colors.border }];
  const nestedTitleStyle = [styles.nestedTitle, { color: colors.text }];
  const helpTextStyle = [styles.helpText, { color: colors.textSecondary }];
  const digitLabelStyle = [styles.digitLabel, { color: colors.textSecondary }];
  const clockColonStyle = [styles.clockColon, { color: colors.textSecondary }];
  const apiKeyLabelStyle = [styles.apiKeyLabel, { color: colors.textSecondary }];

  return (
    <View style={[styles.screenContainer, { backgroundColor: colors.background }]}>
      <Header
        title="SETTINGS"
        showBackButton={true}
        onBackPress={() => router.back()}
        rightIcon="check"
        onRightPress={() => {
          Alert.alert('Success', 'Settings saved successfully!');
        }}
      />
      
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Section */}
        {user && (
          <>
            <SectionHeader title="Profile Information" />
            <ProfileCard
              email={email}
              username={username}
              avatarUrl={user?.user_metadata?.custom_avatar_url || user?.user_metadata?.avatar_url}
              onEditPress={() => router.push('/modal/edit-profile')}
              onSubscriptionPress={() => router.push('/modal/subscription')}
              onSecurityPress={() => router.push('/modal/security')}
              colors={colors}
            />
          </>
        )}

        {/* Payment Methods */}
        <SectionHeader title="Payment Methods" />
        <SettingsCard>
          <SettingsRow
            icon="card-outline"
            iconBg="#E0F2FE"
            iconColor="#0EA5E9"
            title="Main Balance"
            subtitle={`Base Currency: ${settings.currency}`}
            onPress={selectCurrency}
          />
          <View style={dividerStyle} />
          <SettingsRow
            icon="cloud-done-outline"
            iconBg="#F0FDF4"
            iconColor="#16A34A"
            title="Connected Banks"
            subtitle={user ? 'Synced with Supabase Cloud' : 'Offline Cache Database'}
            onPress={() => Alert.alert('Bank Integration', 'Open banking links are coming soon!')}
          />
        </SettingsCard>

        {/* Notifications & Appearance */}
        <SectionHeader title="Notifications & Appearance" />
        <SettingsCard>
          <ToggleRow
            icon="notifications-outline"
            iconBg="#FFE5EC"
            iconColor="#FF6B81"
            title="Push Notifications"
            subtitle={settings.notificationsEnabled ? `Reminders Active • ${formatTime(settings.notificationHour || 20, settings.notificationMinute || 0)}` : 'Notifications Muted'}
            value={settings.notificationsEnabled}
            onValueChange={handleToggleNotifications}
            activeTrackColor={colors.primary}
          />
          
          <View style={dividerStyle} />
          
          <SettingsRow
            icon="options-outline"
            iconBg="#FAF5FF"
            iconColor="#9333EA"
            title="Categories Management"
            onPress={() => Alert.alert('Categories', 'Default expense categories are configured.')}
          />
          
          <View style={dividerStyle} />
          
          <ToggleRow
            icon="moon-outline"
            iconBg="#FEF9C3"
            iconColor="#CA8A04"
            title="Dark Mode / App Theme"
            subtitle={theme === 'dark' ? 'Dark theme active' : 'Light theme active'}
            value={theme === 'dark'}
            onValueChange={handleThemeChange}
            activeTrackColor={colors.primary}
          />

          {settings.notificationsEnabled && (
            <>
              <View style={dividerStyle} />
              
              {/* Daily reminder clock adjusting */}
              <View style={styles.nestedRowBlock}>
                <Text style={nestedTitleStyle}>Reminder Alert Schedule</Text>
                <Text style={helpTextStyle}>
                  Configure the target hour and minutes to receive your daily check-in.
                </Text>
                
                <View style={[styles.clockCard, { backgroundColor: isDark ? '#1a2235' : '#F8FAFC', borderColor: colors.border }]}>
                  <View style={styles.clockDigitContainer}>
                    <TouchableOpacity 
                      onPress={() => handleAdjustHour(-1)} 
                      style={[styles.clockAdjustBtn, { backgroundColor: colors.primaryLight }]}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.clockAdjustText, { color: colors.primary }]}>-</Text>
                    </TouchableOpacity>
                    
                    <View style={styles.digitBox}>
                      <Text style={[styles.clockDigit, { color: colors.text }]}>
                        {String(settings.notificationHour !== undefined ? (settings.notificationHour % 12 === 0 ? 12 : settings.notificationHour % 12) : 8).padStart(2, '0')}
                      </Text>
                      <Text style={digitLabelStyle}>HOUR</Text>
                    </View>
                    
                    <TouchableOpacity 
                      onPress={() => handleAdjustHour(1)} 
                      style={[styles.clockAdjustBtn, { backgroundColor: colors.primaryLight }]}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.clockAdjustText, { color: colors.primary }]}>+</Text>
                    </TouchableOpacity>
                  </View>

                  <Text style={clockColonStyle}>:</Text>

                  <View style={styles.clockDigitContainer}>
                    <TouchableOpacity 
                      onPress={() => handleAdjustMinute(-5)} 
                      style={[styles.clockAdjustBtn, { backgroundColor: colors.primaryLight }]}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.clockAdjustText, { color: colors.primary }]}>-</Text>
                    </TouchableOpacity>
                    
                    <View style={styles.digitBox}>
                      <Text style={[styles.clockDigit, { color: colors.text }]}>
                        {String(settings.notificationMinute !== undefined ? settings.notificationMinute : 0).padStart(2, '0')}
                      </Text>
                      <Text style={digitLabelStyle}>MIN</Text>
                    </View>
                    
                    <TouchableOpacity 
                      onPress={() => handleAdjustMinute(5)} 
                      style={[styles.clockAdjustBtn, { backgroundColor: colors.primaryLight }]}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.clockAdjustText, { color: colors.primary }]}>+</Text>
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity 
                    onPress={() => handleAdjustHour(12)} 
                    style={[styles.ampmBtn, { backgroundColor: colors.primaryLight }]}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.ampmText, { color: colors.primary }]}>
                      {settings.notificationHour >= 12 ? 'PM' : 'AM'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={dividerStyle} />

              {/* Budget Limit Warning */}
              <View style={styles.nestedRowBlock}>
                <View style={styles.inlineSwitchRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={nestedTitleStyle}>Budget Limit Warning</Text>
                    <Text style={helpTextStyle}>Get alerted when approaching your spending limits.</Text>
                  </View>
                  <Switch
                    value={settings.budgetWarningEnabled}
                    onValueChange={setBudgetWarningEnabled}
                    trackColor={{ false: '#767577', true: colors.primary }}
                    thumbColor={settings.budgetWarningEnabled ? '#FFFFFF' : '#f4f3f4'}
                  />
                </View>
                
                {settings.budgetWarningEnabled && (
                  <View style={[styles.segmentedContainer, { backgroundColor: isDark ? '#151d30' : '#F1F5F9' }]}>
                    {[50, 80, 90].map((val) => {
                      const isSelected = settings.budgetWarningThreshold === val;
                      return (
                        <TouchableOpacity
                          key={val}
                          onPress={() => setBudgetWarningThreshold(val)}
                          style={[
                            styles.segmentedItem,
                            isSelected && { backgroundColor: colors.primary }
                          ]}
                          activeOpacity={0.8}
                        >
                          <Text 
                            style={[
                              styles.segmentedText, 
                              { 
                                color: isSelected ? '#FFFFFF' : colors.textSecondary,
                                fontWeight: isSelected ? '800' : '600'
                              }
                            ]}
                          >
                            {val}% limit
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>

              <View style={dividerStyle} />

              {/* Notification Testing Center */}
              <View style={styles.nestedRowBlock}>
                <Text style={nestedTitleStyle}>Notification Testing Center</Text>
                <Text style={[helpTextStyle, { marginBottom: 12 }]}>
                  Test how spending alerts will render natively on your device.
                </Text>
                
                <View style={styles.testList}>
                  <TouchableOpacity 
                    onPress={handleTestDailyReminder} 
                    style={[styles.testListItem, { borderColor: colors.border, backgroundColor: colors.card }]}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.testIconBg, { backgroundColor: colors.primaryLight }]}>
                      <Ionicons name="notifications" size={16} color={colors.primary} />
                    </View>
                    <Text style={[styles.testListText, { color: colors.text }]}>Send Mock Daily Reminder</Text>
                    <Text style={[styles.testListBadge, { color: colors.primary, backgroundColor: colors.primaryLight }]}>Test</Text>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    onPress={handleTestWarning} 
                    style={[styles.testListItem, { borderColor: colors.border, backgroundColor: colors.card }]}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.testIconBg, { backgroundColor: colors.warning + '20' }]}>
                      <Ionicons name="alert-circle" size={16} color={colors.warning} />
                    </View>
                    <Text style={[styles.testListText, { color: colors.text }]}>Send Budget Warning ({settings.budgetWarningThreshold || 80}%)</Text>
                    <Text style={[styles.testListBadge, { color: colors.warning, backgroundColor: colors.warning + '20' }]}>Test</Text>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    onPress={handleTestExceeded} 
                    style={[styles.testListItem, { borderColor: colors.border, backgroundColor: colors.card }]}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.testIconBg, { backgroundColor: colors.danger + '20' }]}>
                      <Ionicons name="alert" size={16} color={colors.danger} />
                    </View>
                    <Text style={[styles.testListText, { color: colors.text }]}>Send Budget Exceeded Alert</Text>
                    <Text style={[styles.testListBadge, { color: colors.danger, backgroundColor: colors.danger + '20' }]}>Test</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </>
          )}
        </SettingsCard>

        {/* Data & Intelligence */}
        <SectionHeader title="Data & Intelligence" />
        <SettingsCard>
          <SettingsRow
            icon="download-outline"
            iconBg="#E0F2FE"
            iconColor="#0EA5E9"
            title="Export CSV Report"
            subtitle="Generate table file format for Excel"
            onPress={handleExportCSV}
          />
          <View style={dividerStyle} />
          <SettingsRow
            icon="cloud-upload-outline"
            iconBg="#F0FDF4"
            iconColor="#16A34A"
            title="Create Backup"
            subtitle="Export full JSON payload database"
            onPress={handleExportJSON}
          />
          <View style={dividerStyle} />
          <ToggleRow
            icon="analytics-outline"
            iconBg="#F5F3FF"
            iconColor="#7C3AED"
            title="AI Categorization"
            subtitle="Predict categories automatically after scanning"
            value={settings.aiCategorizationEnabled}
            onValueChange={setAiCategorizationEnabled}
            activeTrackColor={colors.primary}
          />
          <View style={dividerStyle} />
          <ToggleRow
            icon="scan-outline"
            iconBg="#FEF3C7"
            iconColor="#D97706"
            title="Cloud OCR Engine"
            subtitle="Use Google Gemini API for receipt parsing"
            value={settings.ocrEngine === 'cloud'}
            onValueChange={(enabled) => setOcrEngine(enabled ? 'cloud' : 'mock')}
            activeTrackColor={colors.primary}
          />

          {settings.ocrEngine === 'cloud' && (
            <>
              <View style={dividerStyle} />
              <View style={styles.apiKeyContainer}>
                <Text style={apiKeyLabelStyle}>GEMINI API KEY</Text>
                <TextInput
                  style={[styles.apiKeyInput, { color: colors.text, borderColor: colors.border }]}
                  value={settings.geminiApiKey}
                  onChangeText={setGeminiApiKey}
                  placeholder="Enter your Gemini API key..."
                  placeholderTextColor={colors.textSecondary}
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <Text style={helpTextStyle}>
                  This key is stored securely on your device. It enables extracting real data from receipts and invoices.
                </Text>
              </View>
            </>
          )}
        </SettingsCard>

        {/* Help & Information */}
        <SectionHeader title="Help & Information" />
        <SettingsCard>
          <SettingsRow
            icon="chatbubble-ellipses-outline"
            iconBg="#F0FDF4"
            iconColor="#16A34A"
            title="Contact Support"
            onPress={() => Alert.alert('Support', 'Contact support at help@spendly.com')}
          />
          <View style={dividerStyle} />
          <SettingsRow
            icon="lock-closed-outline"
            iconBg="#E0F2FE"
            iconColor="#0EA5E9"
            title="Privacy Policy"
            onPress={() => Alert.alert('Privacy', 'Privacy policy can be read on spendly.com/privacy')}
          />
          <View style={dividerStyle} />
          <SettingsRow
            icon="document-text-outline"
            iconBg="#FAF5FF"
            iconColor="#9333EA"
            title="Terms & Conditions"
            onPress={() => Alert.alert('Terms', 'Terms of service are available on spendly.com/terms')}
          />
          <View style={dividerStyle} />
          <SettingsRow
            icon="information-circle-outline"
            iconBg="#FFF1F2"
            iconColor="#E11D48"
            title="About App"
            subtitle="v1.0.0 (Production Build)"
            onPress={() => Alert.alert('About', 'Spendly: Expense AI Tracker built with React Native & Supabase.')}
          />
        </SettingsCard>

        {/* Danger Zone: Sign Out */}
        <View style={{ marginTop: 24 }}>
          <SignOutButton onPress={handleLogout} />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screenContainer: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    flexGrow: 1,
  },
  divider: {
    height: 1,
    marginVertical: 4,
  },
  nestedRowBlock: {
    paddingVertical: 14,
  },
  nestedTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  helpText: {
    fontSize: 12,
    lineHeight: 16,
  },
  clockCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginTop: 8,
  },
  clockDigitContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  clockAdjustBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clockAdjustText: {
    fontSize: 18,
    fontWeight: '700',
  },
  digitBox: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 44,
  },
  clockDigit: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  digitLabel: {
    fontSize: 8,
    fontWeight: '800',
    marginTop: 2,
    letterSpacing: 0.5,
  },
  clockColon: {
    fontSize: 26,
    fontWeight: '800',
    marginHorizontal: 12,
    bottom: 2,
  },
  ampmBtn: {
    marginLeft: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 46,
  },
  ampmText: {
    fontSize: 12,
    fontWeight: '800',
  },
  inlineSwitchRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  segmentedContainer: {
    flexDirection: 'row',
    borderRadius: 10,
    padding: 4,
    marginTop: 10,
  },
  segmentedItem: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentedText: {
    fontSize: 11,
  },
  testList: {
    marginTop: 8,
    gap: 8,
  },
  testListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  testIconBg: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  testListText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
  },
  testListBadge: {
    fontSize: 9,
    fontWeight: '800',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    overflow: 'hidden',
  },
  apiKeyContainer: {
    paddingVertical: 12,
  },
  apiKeyLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  apiKeyInput: {
    borderWidth: 1,
    borderRadius: 8,
    height: 40,
    paddingHorizontal: 12,
    fontSize: 13,
  },
});
