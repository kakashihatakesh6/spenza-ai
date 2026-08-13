import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Animated,
} from 'react-native';
import {
  Sparkles,
  BarChart3,
  FileSpreadsheet,
  User,
  ShieldCheck,
  Zap,
  HelpCircle,
  TrendingUp,
  PieChart,
  CreditCard,
} from 'lucide-react-native';
import { useTheme } from '../../hooks/useTheme';
import { BotAvatar } from '../BotAvatar';

interface QuickSuggestionDeckProps {
  onSelectSuggestion: (text: string) => void;
}

export const QuickSuggestionDeck: React.FC<QuickSuggestionDeckProps> = ({
  onSelectSuggestion,
}) => {
  const { colors, isDark } = useTheme();
  const [activeCategory, setActiveCategory] = useState<string>('all');

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        speed: 12,
        bounciness: 4,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const categories = [
    { id: 'all', label: '⚡ Popular' },
    { id: 'analytics', label: '📊 Insights' },
    { id: 'export', label: '📤 Reports' },
    { id: 'profile', label: '👤 Account' },
  ];

  const allSuggestions = [
    {
      id: '1',
      category: 'all',
      text: "What is Spendly & how does offline sync work?",
      desc: "Learn about privacy, local SQLite DB & cloud sync.",
      icon: Sparkles,
      color: '#8B5CF6',
    },
    {
      id: '2',
      category: 'analytics',
      text: "Show my recent transactions converted to GBP",
      desc: "View recent expense breakdown in British Pounds (£).",
      icon: BarChart3,
      color: '#3B82F6',
    },
    {
      id: '3',
      category: 'export',
      text: "Export this list to CSV/Excel report",
      desc: "Instantly generate and share complete ledger files.",
      icon: FileSpreadsheet,
      color: '#10B981',
    },
    {
      id: '4',
      category: 'profile',
      text: "My monthly income is ₹90,000. Change my display name to Nikhil",
      desc: "Update monthly income metrics & profile customization.",
      icon: User,
      color: '#F59E0B',
    },
    {
      id: '5',
      category: 'analytics',
      text: "Give me budget tips to save 20% on monthly spending",
      desc: "Get personalized financial recommendations from AI.",
      icon: TrendingUp,
      color: '#EC4899',
    },
    {
      id: '6',
      category: 'all',
      text: "How do I scan receipts and import UPI payment screenshots?",
      desc: "Guide to Gemini OCR receipt scanning & auto matching.",
      icon: CreditCard,
      color: '#6366F1',
    },
  ];

  const filteredSuggestions =
    activeCategory === 'all'
      ? allSuggestions
      : allSuggestions.filter((s) => s.category === activeCategory || s.category === 'all');

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <Animated.View
        style={[
          styles.container,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        {/* Bot Hero Avatar */}
        <View style={styles.heroSection}>
          <BotAvatar size={68} variant="glow" showPulse={true} pulseColor={colors.primary} />
          
          <View style={[styles.onlineBadge, { backgroundColor: isDark ? 'rgba(99, 102, 241, 0.2)' : 'rgba(99, 102, 241, 0.1)' }]}>
            <Zap size={13} color={colors.primary} style={{ marginRight: 5 }} />
            <Text style={[styles.onlineBadgeText, { color: colors.primary }]}>GROQ GPT-OSS-120B ACTIVE</Text>
          </View>

          <Text style={[styles.heroTitle, { color: colors.text }]}>
            How can Spendly AI help you today?
          </Text>
          <Text style={[styles.heroSub, { color: colors.textSecondary }]}>
            Ask financial questions, request expense analytics, or pick a prompt below to start:
          </Text>
        </View>

        {/* Category Pills Bar */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryScroll}
        >
          {categories.map((cat) => {
            const isActive = activeCategory === cat.id;
            return (
              <TouchableOpacity
                key={cat.id}
                style={[
                  styles.categoryChip,
                  {
                    backgroundColor: isActive
                      ? colors.primary
                      : colors.chatChipBg,
                    borderColor: isActive ? colors.primary : colors.chatChipBorder,
                  },
                ]}
                onPress={() => setActiveCategory(cat.id)}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.categoryChipText,
                    { color: isActive ? '#FFFFFF' : colors.text },
                  ]}
                >
                  {cat.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Suggestion Cards Grid */}
        <View style={styles.gridContainer}>
          {filteredSuggestions.map((item) => {
            const IconComp = item.icon;
            return (
              <TouchableOpacity
                key={item.id}
                style={[
                  styles.suggestionCard,
                  {
                    backgroundColor: colors.chatBotBubble,
                    borderColor: colors.chatBotBorder,
                    shadowColor: isDark ? '#000000' : colors.primary,
                  },
                ]}
                onPress={() => onSelectSuggestion(item.text)}
                activeOpacity={0.82}
              >
                <View style={styles.cardHeader}>
                  <View style={[styles.iconBg, { backgroundColor: item.color + '1A' }]}>
                    <IconComp size={18} color={item.color} />
                  </View>
                  <Sparkles size={13} color={colors.textSecondary} />
                </View>

                <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={3}>
                  {item.text}
                </Text>
                
                <Text style={[styles.cardDesc, { color: colors.textSecondary }]} numberOfLines={2}>
                  {item.desc}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </Animated.View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 24,
  },
  container: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  heroSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  onlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    marginTop: 12,
    marginBottom: 10,
  },
  onlineBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.4,
    marginBottom: 6,
  },
  heroSub: {
    fontSize: 13.5,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 10,
  },
  categoryScroll: {
    gap: 8,
    paddingBottom: 14,
  },
  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  categoryChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  suggestionCard: {
    width: '48%',
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
    justifyContent: 'space-between',
    minHeight: 140,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  iconBg: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    lineHeight: 18,
    marginBottom: 6,
  },
  cardDesc: {
    fontSize: 11.5,
    lineHeight: 16,
  },
});
