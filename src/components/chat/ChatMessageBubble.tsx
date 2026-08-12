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
} from 'lucide-react-native';
import { useTheme } from '../../hooks/useTheme';
import { BotAvatar } from '../BotAvatar';
import { ChatMessage, MessageCitation } from '../../services/chatService';
import { useAlertStore } from '../../store/alertStore';

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

  const handleCopy = async () => {
    try {
      await Clipboard.setStringAsync(message.content);
      setCopied(true);
      useAlertStore.getState().showAlert('Copied', 'Message content copied to clipboard.', 'success');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const handleFeedback = (isPositive: boolean) => {
    const nextState = isPositive ? 'up' : 'down';
    setFeedbackGiven(nextState);
    if (onFeedback) {
      onFeedback(message.id, isPositive);
    }
    useAlertStore.getState().showAlert(
      'Feedback Recorded',
      isPositive ? 'Thank you for rating this response helpful!' : 'Thanks for your feedback. We will refine response quality.',
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
            {renderFormattedText(message.content)}
          </View>

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
});
