import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Animated,
  Platform,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import {
  Copy,
  Check,
  ThumbsUp,
  ThumbsDown,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Sparkles,
  FileText,
  DollarSign,
  Download,
} from 'lucide-react-native';
import { useTheme } from '../../hooks/useTheme';
import { BotAvatar } from '../BotAvatar';
import { ChatMessage, MessageCitation } from '../../services/chatService';
import { useAlertStore } from '../../store/alertStore';
import { exportService } from '../../services/exportService';
import { Expense } from '../../types';

interface ChatMessageBubbleProps {
  message: ChatMessage;
  isStreaming?: boolean;
  onFeedback?: (messageId: string, isPositive: boolean) => void;
}

export const ChatMessageBubble: React.FC<ChatMessageBubbleProps> = ({
  message,
  isStreaming = false,
  onFeedback,
}) => {
  const { colors, isDark } = useTheme();
  const isUser = message.role === 'user';
  const [copied, setCopied] = useState(false);
  const [feedbackGiven, setFeedbackGiven] = useState<'up' | 'down' | null>(null);
  const [showCitations, setShowCitations] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exported, setExported] = useState(false);

  // Entrance animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(12)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 260,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        speed: 14,
        bounciness: 4,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // Parse CSV data if hidden inside the message content
  const csvRegex = /<!--CSV_DATA:([\s\S]*?)-->/;
  const match = message.content.match(csvRegex);
  let csvData: any[] | null = null;
  let displayText = message.content;

  if (match) {
    try {
      csvData = JSON.parse(match[1]);
      displayText = message.content.replace(csvRegex, '').trim();
    } catch (e) {
      console.warn('Failed to parse CSV_DATA:', e);
    }
  }

  const handleCopy = async () => {
    try {
      await Clipboard.setStringAsync(displayText);
      setCopied(true);
      useAlertStore.getState().showAlert('Copied', 'Message content copied to clipboard.', 'success');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const handleSaveCSV = async () => {
    if (!csvData || csvData.length === 0) return;
    setIsExporting(true);
    try {
      const parsedExpenses: Expense[] = csvData.map((t: any) => ({
        id: t.id || `temp_${Math.random().toString(36).substr(2, 9)}`,
        amount: Number(t.amount) || 0,
        merchant: t.merchant || 'Unknown',
        category: t.category || 'Other',
        date: t.date || new Date().toISOString().split('T')[0],
        time: t.time || '00:00',
        paymentMethod: t.paymentMethod || t.payment_method || 'Cash',
        currency: t.currency || 'INR',
        tax: t.tax || 0,
        notes: t.notes || '',
        createdAt: t.createdAt || t.created_at || new Date().toISOString(),
        updatedAt: t.updatedAt || t.updated_at || new Date().toISOString(),
        isSynced: t.isSynced || 0,
      }));

      const filename = `expenses_chat_export_${new Date().toISOString().split('T')[0]}`;
      const res = await exportService.saveCSVToCustomLocation(parsedExpenses, filename);
      if (res.success) {
        setExported(true);
        useAlertStore.getState().showAlert(
          'Export Ready',
          `CSV report generated successfully!\n\nLocation:\n${res.path || 'Saved to custom location'}`,
          'success'
        );
        setTimeout(() => setExported(false), 3000);
      }
    } catch (e) {
      console.error(e);
      useAlertStore.getState().showAlert('Export Failed', 'An error occurred while preparing the CSV file.', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  const handleFeedback = (isPositive: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const targetState = isPositive ? 'up' : 'down';
    
    if (feedbackGiven === targetState) {
      setFeedbackGiven(null);
      return;
    }

    setFeedbackGiven(targetState);
    if (onFeedback) {
      onFeedback(message.id, isPositive);
    }
    useAlertStore.getState().showAlert(
      'Feedback Recorded',
      isPositive ? 'Thank you for rating this response helpful! 👍' : 'Thanks for your feedback! We will refine response quality.',
      'info'
    );
  };

  const formatTime = (isoString?: string) => {
    if (!isoString) return '';
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  // Helper to render formatted assistant content (bold text, lists, money highlights)
  const renderFormattedText = (text: string) => {
    if (!text) return null;

    // Split paragraphs
    const paragraphs = text.split('\n');

    return paragraphs.map((paragraph, pIdx) => {
      if (!paragraph.trim()) {
        return <View key={pIdx} style={{ height: 6 }} />;
      }

      // Code block rendering check
      if (paragraph.trim().startsWith('```') || paragraph.trim().endsWith('```')) {
        const cleanCode = paragraph.replace(/```/g, '');
        return (
          <View
            key={pIdx}
            style={[
              styles.codeBlockContainer,
              {
                backgroundColor: isDark ? '#0B0F19' : '#F1F5F9',
                borderColor: isDark ? '#1E293B' : '#E2E8F0',
              },
            ]}
          >
            <Text style={[styles.codeText, { color: isDark ? '#38BDF8' : '#0284C7' }]}>
              {cleanCode}
            </Text>
          </View>
        );
      }

      // Bullet point check
      const isBullet = paragraph.trim().startsWith('- ') || paragraph.trim().startsWith('• ');
      const cleanParagraph = isBullet ? paragraph.trim().replace(/^[-•]\s*/, '') : paragraph;

      // Parse bold segments **bold text**
      const parts = cleanParagraph.split(/(\*\*.*?\*\*)/g);

      return (
        <View key={pIdx} style={[styles.paragraphRow, isBullet && styles.bulletRow]}>
          {isBullet && (
            <View style={[styles.bulletDot, { backgroundColor: colors.primary }]} />
          )}
          <Text style={[styles.messageText, { color: isUser ? colors.chatUserText : colors.text }]}>
            {parts.map((part, partIdx) => {
              if (part.startsWith('**') && part.endsWith('**')) {
                const boldContent = part.slice(2, -2);
                return (
                  <Text
                    key={partIdx}
                    style={{
                      fontWeight: '700',
                      color: isUser ? '#FFFFFF' : isDark ? '#F1F5F9' : '#0F172A',
                    }}
                  >
                    {boldContent}
                  </Text>
                );
              }

              // Currency highlight check (e.g. ₹, $, £, €)
              return (
                <Text key={partIdx}>
                  {part}
                </Text>
              );
            })}
          </Text>
        </View>
      );
    });
  };

  if (isUser) {
    return (
      <Animated.View
        style={[
          styles.userWrapper,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        <View style={styles.userBubbleContainer}>
          <View
            style={[
              styles.userBubble,
              {
                backgroundColor: colors.chatUserBubble,
                shadowColor: colors.primary,
              },
            ]}
          >
            <Text style={styles.userMessageText}>{message.content}</Text>
          </View>
          <View style={styles.userMetaRow}>
            <Text style={[styles.timeText, { color: colors.textSecondary }]}>
              {formatTime(message.created_at)}
            </Text>
            <TouchableOpacity onPress={handleCopy} activeOpacity={0.6} style={styles.miniCopyBtn}>
              {copied ? (
                <Check size={12} color={colors.success} />
              ) : (
                <Copy size={12} color={colors.textSecondary} />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>
    );
  }

  // Assistant Bubble
  return (
    <Animated.View
      style={[
        styles.assistantWrapper,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <View style={styles.botAvatarCol}>
        <BotAvatar size={34} variant="glow" showPulse={isStreaming} />
      </View>

      <View style={styles.assistantContentCol}>
        {/* Assistant Card Container */}
        <View
          style={[
            styles.assistantCard,
            {
              backgroundColor: colors.chatBotBubble,
              borderColor: colors.chatBotBorder,
              shadowColor: isDark ? '#000000' : colors.primary,
            },
          ]}
        >
          <View style={styles.assistantHeader}>
            <View style={styles.assistantTitleRow}>
              <Text style={[styles.assistantName, { color: colors.text }]}>Spendly AI</Text>
              <View style={[styles.badgePill, { backgroundColor: isDark ? 'rgba(52, 211, 153, 0.15)' : 'rgba(16, 185, 129, 0.1)' }]}>
                <Sparkles size={10} color={colors.success} style={{ marginRight: 3 }} />
                <Text style={[styles.badgePillText, { color: colors.success }]}>VERIFIED RAG</Text>
              </View>
            </View>
            <Text style={[styles.timeText, { color: colors.textSecondary }]}>
              {formatTime(message.created_at)}
            </Text>
          </View>

          {/* Formatted Text Content */}
          <View style={styles.bodyContent}>
            {renderFormattedText(displayText)}
          </View>

          {/* CSV Export Card */}
          {csvData && csvData.length > 0 && (
            <View
              style={[
                styles.exportCardContainer,
                {
                  backgroundColor: isDark ? 'rgba(30, 41, 59, 0.4)' : 'rgba(248, 250, 252, 0.9)',
                  borderColor: isDark ? 'rgba(56, 189, 248, 0.2)' : 'rgba(14, 165, 233, 0.15)',
                },
              ]}
            >
              <View style={styles.exportCardLeft}>
                <View style={[styles.sheetIconWrapper, { backgroundColor: isDark ? 'rgba(56, 189, 248, 0.15)' : 'rgba(14, 165, 233, 0.1)' }]}>
                  <FileText size={20} color={isDark ? '#38BDF8' : '#0284C7'} />
                </View>
                <View style={styles.exportCardTextCol}>
                  <Text style={[styles.exportCardTitle, { color: colors.text }]}>
                    CSV Spreadsheet Ready
                  </Text>
                  <Text style={[styles.exportCardSubtitle, { color: colors.textSecondary }]}>
                    {csvData.length} transaction{csvData.length > 1 ? 's' : ''} compiled
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={[
                  styles.exportBtn,
                  {
                    backgroundColor: exported 
                      ? colors.success 
                      : isDark 
                        ? 'rgba(56, 189, 248, 0.2)' 
                        : 'rgba(2, 132, 199, 0.1)',
                  },
                ]}
                onPress={handleSaveCSV}
                disabled={isExporting}
                activeOpacity={0.7}
              >
                {isExporting ? (
                  <Text style={[styles.exportBtnText, { color: isDark ? '#38BDF8' : '#0284C7' }]}>
                    Exporting...
                  </Text>
                ) : exported ? (
                  <>
                    <Check size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
                    <Text style={[styles.exportBtnText, { color: '#FFFFFF', fontWeight: '700' }]}>
                      Saved
                    </Text>
                  </>
                ) : (
                  <>
                    <Download size={14} color={isDark ? '#38BDF8' : '#0284C7'} style={{ marginRight: 4 }} />
                    <Text style={[styles.exportBtnText, { color: isDark ? '#38BDF8' : '#0284C7' }]}>
                      Save CSV
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* Collapsible Citations Section */}
          {message.citations && message.citations.length > 0 && (
            <View
              style={[
                styles.citationsContainer,
                {
                  backgroundColor: isDark ? 'rgba(30, 41, 59, 0.6)' : 'rgba(241, 245, 249, 0.8)',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
                },
              ]}
            >
              <TouchableOpacity
                style={styles.citationsHeaderBtn}
                onPress={() => setShowCitations(!showCitations)}
                activeOpacity={0.7}
              >
                <View style={styles.citationsHeaderLeft}>
                  <BookOpen size={14} color={colors.primary} />
                  <Text style={[styles.citationsTitle, { color: colors.primary }]}>
                    {message.citations.length} Knowledge Sources Used
                  </Text>
                </View>
                {showCitations ? (
                  <ChevronUp size={14} color={colors.primary} />
                ) : (
                  <ChevronDown size={14} color={colors.primary} />
                )}
              </TouchableOpacity>

              {showCitations && (
                <View style={styles.citationsList}>
                  {message.citations.map((cite, idx) => (
                    <View
                      key={idx}
                      style={[
                        styles.citationItem,
                        {
                          backgroundColor: isDark ? '#0B0F19' : '#FFFFFF',
                          borderColor: isDark ? '#1E293B' : '#E2E8F0',
                        },
                      ]}
                    >
                      <FileText size={12} color={colors.textSecondary} style={{ marginRight: 6 }} />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.citationTitleText, { color: colors.text }]} numberOfLines={1}>
                          {cite.title || cite.filename}
                        </Text>
                        <Text style={[styles.citationSubText, { color: colors.textSecondary }]}>
                          Match: {Math.round((cite.similarity || 0.8) * 100)}% • {cite.filename}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* Action Bar Footer */}
          <View
            style={[
              styles.cardFooter,
              {
                borderTopColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.04)',
              },
            ]}
          >
            <View style={styles.footerLeftActions}>
              <TouchableOpacity
                style={[
                  styles.actionBtn,
                  feedbackGiven === 'up' && { backgroundColor: 'rgba(16, 185, 129, 0.15)' },
                ]}
                onPress={() => handleFeedback(true)}
                activeOpacity={0.7}
              >
                <ThumbsUp
                  size={14}
                  color={feedbackGiven === 'up' ? colors.success : colors.textSecondary}
                />
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.actionBtn,
                  feedbackGiven === 'down' && { backgroundColor: 'rgba(239, 68, 68, 0.15)' },
                ]}
                onPress={() => handleFeedback(false)}
                activeOpacity={0.7}
              >
                <ThumbsDown
                  size={14}
                  color={feedbackGiven === 'down' ? colors.danger : colors.textSecondary}
                />
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.copyTextBtn} onPress={handleCopy} activeOpacity={0.7}>
              {copied ? (
                <>
                  <Check size={13} color={colors.success} style={{ marginRight: 4 }} />
                  <Text style={[styles.copyText, { color: colors.success }]}>Copied</Text>
                </>
              ) : (
                <>
                  <Copy size={13} color={colors.textSecondary} style={{ marginRight: 4 }} />
                  <Text style={[styles.copyText, { color: colors.textSecondary }]}>Copy</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  userWrapper: {
    width: '100%',
    alignItems: 'flex-end',
    marginVertical: 6,
    paddingHorizontal: 16,
  },
  userBubbleContainer: {
    maxWidth: '82%',
    alignItems: 'flex-end',
  },
  userBubble: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    borderBottomRightRadius: 4,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  userMessageText: {
    color: '#FFFFFF',
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '400',
  },
  userMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    marginRight: 4,
    gap: 6,
  },
  miniCopyBtn: {
    padding: 2,
  },
  assistantWrapper: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginVertical: 8,
    paddingHorizontal: 16,
  },
  botAvatarCol: {
    marginRight: 10,
    marginTop: 2,
  },
  assistantContentCol: {
    flex: 1,
    maxWidth: '88%',
  },
  assistantCard: {
    borderRadius: 18,
    borderTopLeftRadius: 4,
    borderWidth: 1,
    padding: 14,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  assistantHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  assistantTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  assistantName: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.1,
  },
  badgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgePillText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  timeText: {
    fontSize: 11,
    fontWeight: '400',
  },
  bodyContent: {
    marginBottom: 10,
  },
  paragraphRow: {
    marginVertical: 2,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingLeft: 4,
  },
  bulletDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    marginTop: 8,
    marginRight: 8,
  },
  messageText: {
    fontSize: 14.5,
    lineHeight: 22,
    fontWeight: '400',
  },
  codeBlockContainer: {
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    marginVertical: 6,
  },
  codeText: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 12.5,
  },
  citationsContainer: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
    marginTop: 4,
    marginBottom: 10,
  },
  citationsHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  citationsHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  citationsTitle: {
    fontSize: 12,
    fontWeight: '600',
  },
  citationsList: {
    marginTop: 8,
    gap: 6,
  },
  citationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 6,
    borderWidth: 1,
  },
  citationTitleText: {
    fontSize: 11.5,
    fontWeight: '600',
  },
  citationSubText: {
    fontSize: 10,
    marginTop: 1,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
  },
  footerLeftActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionBtn: {
    padding: 6,
    borderRadius: 8,
  },
  copyTextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  copyText: {
    fontSize: 11.5,
    fontWeight: '600',
  },
  exportCardContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginTop: 4,
    marginBottom: 10,
  },
  exportCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  sheetIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  exportCardTextCol: {
    flex: 1,
  },
  exportCardTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  exportCardSubtitle: {
    fontSize: 11,
    marginTop: 1,
  },
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  exportBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
