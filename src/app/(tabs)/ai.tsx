import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Alert,
  Platform,
} from 'react-native';
import { useRouter, useNavigation } from 'expo-router';
import { useTheme } from '../../hooks/useTheme';
import { useAlertStore } from '../../store/alertStore';
import { Header } from '../../components/Header';
import {
  Scan,
  Image as ImageIcon,
  Sparkles,
  Cpu,
  Lightbulb,
  Info,
  MessageSquare,
} from 'lucide-react-native';

export default function AiHubScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { colors, isDark } = useTheme();

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Header
        title="AI SMART HUB"
        showBackButton={true}
        onBackPress={() => router.back()}
        onNotificationPress={() => {
          useAlertStore.getState().showAlert(
            'Notifications',
            'No new AI processing issues. Cloud nodes and OCR engines are operating at peak efficiency.',
            'info'
          );
        }}
      />

      <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Futuristic Status Header Card */}
        <View
          style={[
            styles.statusCard,
            {
              backgroundColor: isDark ? '#151D30' : '#FFFFFF',
              borderColor: isDark ? '#1F293D' : '#E5E7EB',
              shadowColor: isDark ? '#000000' : '#6366F1',
            },
          ]}
        >
          <View style={styles.statusHeader}>
            <View style={[styles.statusIconBg, { backgroundColor: colors.primaryLight }]}>
              <Sparkles size={20} color={colors.primary} />
            </View>
            <View style={styles.statusTextCol}>
              <Text style={[styles.statusTitle, { color: colors.text }]}>
                Predictive Accounting Core
              </Text>
              <View style={styles.pulseContainer}>
                <View style={[styles.pulseDot, { backgroundColor: colors.success }]} />
                <Text style={[styles.pulseText, { color: colors.success }]}>
                  AI Engines Online & Ready
                </Text>
              </View>
            </View>
          </View>
          <Text style={[styles.statusDesc, { color: colors.textSecondary }]}>
            Supercharge your ledger. Scan receipts or import mobile payment screenshots to automatically extract items, values, dates, and vendors in real-time.
          </Text>
        </View>

        {/* Action Deck */}
        <View style={styles.deck}>
          {/* Action 1: Scan Receipt */}
          <TouchableOpacity
            style={[
              styles.actionCard,
              {
                backgroundColor: isDark ? '#151D30' : '#FFFFFF',
                borderColor: isDark ? 'rgba(99, 102, 241, 0.15)' : 'rgba(99, 102, 241, 0.08)',
                shadowColor: colors.primary,
              },
            ]}
            onPress={() => router.push('/modal/scan')}
            activeOpacity={0.85}
          >
            <View style={[styles.actionIconBg, { backgroundColor: 'rgba(99, 102, 241, 0.08)' }]}>
              <Scan size={26} color={colors.primary} />
            </View>
            <View style={styles.actionContent}>
              <View style={styles.actionHeader}>
                <Text style={[styles.actionTitle, { color: colors.text }]}>
                  Scan Receipt Photo
                </Text>
                <View style={[styles.badge, { backgroundColor: isDark ? 'rgba(99, 102, 241, 0.2)' : 'rgba(99, 102, 241, 0.08)' }]}>
                  <Text style={[styles.badgeText, { color: colors.primary }]}>
                    GEMINI OCR
                  </Text>
                </View>
              </View>
              <Text style={[styles.actionDesc, { color: colors.textSecondary }]}>
                Take a clean picture of a paper receipt. Gemini reads line-items, amounts, and tax values automatically.
              </Text>
            </View>
          </TouchableOpacity>

          {/* Action 2: Import UPI Screenshot */}
          <TouchableOpacity
            style={[
              styles.actionCard,
              {
                backgroundColor: isDark ? '#151D30' : '#FFFFFF',
                borderColor: isDark ? 'rgba(52, 211, 153, 0.15)' : 'rgba(52, 211, 153, 0.08)',
                shadowColor: colors.success,
              },
            ]}
            onPress={() => router.push('/modal/screenshot')}
            activeOpacity={0.85}
          >
            <View style={[styles.actionIconBg, { backgroundColor: 'rgba(52, 211, 153, 0.08)' }]}>
              <ImageIcon size={26} color="#34D399" />
            </View>
            <View style={styles.actionContent}>
              <View style={styles.actionHeader}>
                <Text style={[styles.actionTitle, { color: colors.text }]}>
                  Import UPI Screens
                </Text>
                <View style={[styles.badge, { backgroundColor: isDark ? 'rgba(52, 211, 153, 0.2)' : 'rgba(52, 211, 153, 0.08)' }]}>
                  <Text style={[styles.badgeText, { color: '#34D399' }]}>
                    AUTO MATCH
                  </Text>
                </View>
              </View>
              <Text style={[styles.actionDesc, { color: colors.textSecondary }]}>
                Upload Google Pay, PhonePe, Paytm, or net banking receipts to instantly parser transaction particulars.
              </Text>
            </View>
          </TouchableOpacity>

          {/* Action 3: AI Chat Assistant */}
          <TouchableOpacity
            style={[
              styles.actionCard,
              {
                backgroundColor: isDark ? '#151D30' : '#FFFFFF',
                borderColor: isDark ? 'rgba(139, 92, 246, 0.15)' : 'rgba(139, 92, 246, 0.08)',
                shadowColor: colors.accent,
              },
            ]}
            onPress={() => router.push('/chat' as any)}
            activeOpacity={0.85}
          >
            <View style={[styles.actionIconBg, { backgroundColor: 'rgba(139, 92, 246, 0.08)' }]}>
              <MessageSquare size={26} color={colors.accent} />
            </View>
            <View style={styles.actionContent}>
              <View style={styles.actionHeader}>
                <Text style={[styles.actionTitle, { color: colors.text }]}>
                  AI Chat Assistant
                </Text>
                <View style={[styles.badge, { backgroundColor: isDark ? 'rgba(139, 92, 246, 0.2)' : 'rgba(139, 92, 246, 0.08)' }]}>
                  <Text style={[styles.badgeText, { color: colors.accent }]}>
                    RAG CORES
                  </Text>
                </View>
              </View>
              <Text style={[styles.actionDesc, { color: colors.textSecondary }]}>
                Ask questions about the official Spendly App Knowledge Base and Q&A guide in real-time.
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Feature Capabilities Info */}
        <View
          style={[
            styles.infoSection,
            {
              borderColor: isDark ? '#1F293D' : '#E5E7EB',
              backgroundColor: isDark ? '#0F172A' : '#F9FAFB',
            },
          ]}
        >
          <Text style={[styles.infoHeading, { color: colors.textSecondary }]}>
            System Intelligence
          </Text>

          <View style={styles.infoRow}>
            <View style={[styles.infoIconWrapper, { backgroundColor: colors.primaryLight }]}>
              <Cpu size={15} color={colors.primary} />
            </View>
            <View style={styles.infoTextCol}>
              <Text style={[styles.infoTitle, { color: colors.text }]}>
                Hybrid Layout Analysis
              </Text>
              <Text style={[styles.infoDesc, { color: colors.textSecondary }]}>
                Processes grid structures and fonts locally before resolving unstructured data patterns securely in our cloud logic.
              </Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <View style={[styles.infoIconWrapper, { backgroundColor: colors.primaryLight }]}>
              <Lightbulb size={15} color={colors.primary} />
            </View>
            <View style={styles.infoTextCol}>
              <Text style={[styles.infoTitle, { color: colors.text }]}>
                Auto Category Classification
              </Text>
              <Text style={[styles.infoDesc, { color: colors.textSecondary }]}>
                Resolves merchant identifiers against known global registries to classify expenses (e.g. food, fuel, bills) instantly.
              </Text>
            </View>
          </View>
        </View>

        {/* Smart Tips Banner */}
        <View
          style={[
            styles.tipCard,
            {
              backgroundColor: isDark ? 'rgba(99, 102, 241, 0.05)' : 'rgba(99, 102, 241, 0.03)',
              borderColor: isDark ? 'rgba(99, 102, 241, 0.15)' : 'rgba(99, 102, 241, 0.08)',
            },
          ]}
        >
          <Info size={14} color={colors.primary} />
          <Text style={[styles.tipText, { color: colors.textSecondary }]}>
            Tip: Capture receipt photos directly from above in well-lit conditions to achieve up to 99.8% extraction accuracy.
          </Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  statusCard: {
    margin: 16,
    padding: 20,
    borderRadius: 24,
    borderWidth: 1,
    ...Platform.select({
      ios: {
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.12,
        shadowRadius: 10,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusIconBg: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  statusTextCol: {
    flex: 1,
  },
  statusTitle: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  pulseContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
  },
  pulseDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    marginRight: 6,
  },
  pulseText: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  statusDesc: {
    fontSize: 12.5,
    lineHeight: 18,
  },
  deck: {
    paddingHorizontal: 16,
    gap: 16,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderRadius: 24,
    borderWidth: 1.5,
    ...Platform.select({
      ios: {
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
      },
      android: {
        elevation: 1,
      },
    }),
  },
  actionIconBg: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  actionContent: {
    flex: 1,
  },
  actionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  actionTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 8.5,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  actionDesc: {
    fontSize: 12,
    lineHeight: 16,
  },
  infoSection: {
    margin: 16,
    padding: 20,
    borderRadius: 24,
    borderWidth: 1,
    gap: 16,
    marginTop: 24,
  },
  infoHeading: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  infoRow: {
    flexDirection: 'row',
    gap: 14,
  },
  infoIconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  infoTextCol: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  infoDesc: {
    fontSize: 11.5,
    lineHeight: 16.5,
  },
  tipCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    gap: 10,
    marginTop: 8,
  },
  tipText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 15,
  },
});
