import React, { useEffect, useRef, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  FlatList,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { useTheme } from '../../hooks/useTheme';
import { useAuthStore } from '../../store/authStore';
import { useChatStore } from '../../store/chatStore';
import { Header } from '../../components/Header';
import {
  Send,
  XCircle,
  ThumbsUp,
  ThumbsDown,
  Copy,
  Info,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Scan,
  TrendingUp,
  MessageSquare,
} from 'lucide-react-native';

// Entry animation for message items
const AnimatedMessageItem = ({ children, isUser }: { children: React.ReactNode; isUser: boolean }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(15)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
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

  return (
    <Animated.View
      style={{
        opacity: fadeAnim,
        transform: [{ translateY: slideAnim }],
        alignSelf: isUser ? 'flex-end' : 'flex-start',
        width: '100%',
      }}
    >
      {children}
    </Animated.View>
  );
};

// Suggestions grid Component for empty states
const SuggestionsDeck = ({ onSelectSuggestion }: { onSelectSuggestion: (text: string) => void }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 450,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        speed: 10,
        bounciness: 3,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const suggestions = [
    { text: "What is Spendly?", desc: "Learn about the app architecture and offline-first design.", icon: Sparkles, color: '#8B5CF6' },
    { text: "How does receipt scanning work?", desc: "Understand how receipt parsing and extraction syncs.", icon: Scan, color: '#3B82F6' },
    { text: "What spending categories are supported?", desc: "See categorized limits and budget settings.", icon: TrendingUp, color: '#10B981' },
    { text: "What are the chat rate limits?", desc: "Check maximum messages and token usage counts.", icon: Info, color: '#EF4444' },
  ];

  const { colors, isDark } = useTheme();

  return (
    <Animated.View style={[styles.suggestionsContainer, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
      <View style={[styles.aiBadge, { backgroundColor: colors.primaryLight }]}>
        <Sparkles size={14} color={colors.primary} style={{ marginRight: 6 }} />
        <Text style={[styles.aiBadgeText, { color: colors.primary }]}>POWERED BY GEMINI RAG</Text>
      </View>
      <Text style={[styles.suggestionsHeaderTitle, { color: colors.text }]}>How can I help you today?</Text>
      <Text style={[styles.suggestionsHeaderSub, { color: colors.textSecondary }]}>
        Ask about the Spendly app features, offline guides, policies, or try a popular query below:
      </Text>
      
      <View style={styles.suggestionsGrid}>
        {suggestions.map((item, idx) => {
          const IconComp = item.icon;
          return (
            <TouchableOpacity
              key={idx}
              style={[
                styles.suggestionCard,
                {
                  backgroundColor: isDark ? '#151D30' : '#FFFFFF',
                  borderColor: colors.border,
                }
              ]}
              onPress={() => onSelectSuggestion(item.text)}
              activeOpacity={0.8}
            >
              <View style={[styles.suggestionIconBg, { backgroundColor: item.color + '15' }]}>
                <IconComp size={18} color={item.color} />
              </View>
              <Text style={[styles.suggestionCardTitle, { color: colors.text }]} numberOfLines={2}>
                {item.text}
              </Text>
              <Text style={[styles.suggestionCardDesc, { color: colors.textSecondary }]} numberOfLines={2}>
                {item.desc}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </Animated.View>
  );
};

export default function ChatDashboardScreen() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const user = useAuthStore((state) => state.user);

  const {
    conversations,
    messages,
    activeConversation,
    isLoadingConvs,
    isLoadingMsgs,
    isStreaming,
    streamingMessageText,
    streamingCitations,
    isOnline,
    initializeChatStore,
    cleanupChatStore,
    loadConversations,
    selectConversation,
    startNewConversation,
    sendMessage,
    cancelStreaming,
    submitFeedback,
  } = useChatStore();

  const [inputVal, setInputVal] = useState('');
  const [sending, setSending] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [expandedCitationsMsgId, setExpandedCitationsMsgId] = useState<Record<string, boolean>>({});
  
  const flatListRef = useRef<FlatList>(null);

  // Initialize and load chat session silently on mount
  useEffect(() => {
    initializeChatStore();
    
    const initChatSession = async () => {
      if (!user) return;
      try {
        setInitializing(true);
        await loadConversations();
      } catch (err) {
        console.warn('Failed to load conversations:', err);
      }
    };

    initChatSession();
    return () => cleanupChatStore();
  }, [user]);

  // Set active conversation silently when list loads
  useEffect(() => {
    const autoSetupConversation = async () => {
      if (!user || isLoadingConvs || !initializing) return;

      try {
        // Find existing main chat session
        const mainConv = conversations.find(
          (c) => c.title === 'Spendly AI Assistant' || c.title.includes('AI Assistant')
        ) || conversations[0];

        if (mainConv) {
          await selectConversation(mainConv.id);
        } else {
          // If no sessions, create one silently
          console.log('[Chat] Creating new default chatbot session...');
          const newId = await startNewConversation(user.id, 'Spendly AI Assistant');
          await selectConversation(newId);
        }
      } catch (err) {
        console.error('Error auto-setting up chat session:', err);
      } finally {
        setInitializing(false);
      }
    };

    if (conversations.length >= 0 && !isLoadingConvs && user) {
      autoSetupConversation();
    }
  }, [conversations, isLoadingConvs, user]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (messages.length > 0 || streamingMessageText) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 150);
    }
  }, [messages, streamingMessageText]);

  const handleSend = async (customQuery?: string) => {
    const query = (customQuery || inputVal).trim();
    if (!query || sending || isStreaming) return;

    setInputVal('');
    setSending(true);

    try {
      await sendMessage(query);
    } catch (err: any) {
      Alert.alert('Send Failed', err.message || 'An error occurred.');
      if (!customQuery) {
        setInputVal(query);
      }
    } finally {
      setSending(false);
    }
  };

  const handleCopyMessage = async (text: string) => {
    await Clipboard.setStringAsync(text);
    Alert.alert('Copied', 'Response copied to clipboard.');
  };

  const handleFeedback = (messageId: string, isPositive: boolean) => {
    Alert.prompt(
      isPositive ? 'Submit Thumbs Up Feedback' : 'Submit Thumbs Down Feedback',
      'Please leave comments to help improve the assistant answers (optional):',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Submit',
          onPress: async (text?: string) => {
            try {
              await submitFeedback(messageId, isPositive, text);
              Alert.alert('Thank you!', 'Your feedback has been logged.');
            } catch (err: any) {
              Alert.alert('Error', 'Failed to submit feedback: ' + err.message);
            }
          },
        },
      ]
    );
  };

  const showCitationDetail = (citation: any) => {
    Alert.alert(
      citation.title || 'Document Detail',
      `File: ${citation.filename || 'N/A'}\n` +
      `Page/Row: ${citation.page_number || 'N/A'}\n` +
      `Section/Sheet: ${citation.section || 'N/A'}\n` +
      `Relevance: ${Math.round(citation.similarity * 100)}%`,
      [{ text: 'Close' }]
    );
  };

  const toggleCitations = (msgId: string) => {
    setExpandedCitationsMsgId((prev) => ({
      ...prev,
      [msgId]: !prev[msgId],
    }));
  };

  const renderMessageContentText = (text: string, citationsList: any[]) => {
    const parts = text.split(/(\[\d+\])/g);
    return parts.map((part, partIdx) => {
      const match = part.match(/^\[(\d+)\]$/);
      if (match && citationsList && citationsList.length > 0) {
        const citationIdx = parseInt(match[1], 10) - 1;
        if (citationIdx >= 0 && citationIdx < citationsList.length) {
          const cit = citationsList[citationIdx];
          return (
            <Text
              key={partIdx}
              style={[styles.citationLink, { color: colors.primary }]}
              onPress={() => showCitationDetail(cit)}
            >
              [{match[1]}]
            </Text>
          );
        }
      }
      return <Text key={partIdx}>{part}</Text>;
    });
  };

  const renderFormattedMarkdown = (content: string, citationsList: any[]) => {
    if (!content) return null;
    const codeBlockSplit = content.split(/(```[\s\S]*?```)/g);

    return codeBlockSplit.map((block, bIdx) => {
      if (block.startsWith('```')) {
        const code = block.replace(/```/g, '').trim();
        return (
          <View key={bIdx} style={[styles.codeBlock, { backgroundColor: isDark ? '#111827' : '#F3F4F6', borderColor: colors.border }]}>
            <Text style={[styles.codeText, { color: isDark ? '#34D399' : '#047857' }]}>{code}</Text>
          </View>
        );
      }

      const lines = block.split('\n');
      return lines.map((line, lIdx) => {
        let trimmed = line.trim();
        if (!trimmed) return <View key={lIdx} style={{ height: 6 }} />;

        let isHeader = false;
        let isList = false;

        if (trimmed.startsWith('###')) {
          isHeader = true;
          trimmed = trimmed.replace(/^###\s*/, '');
        } else if (trimmed.startsWith('##')) {
          isHeader = true;
          trimmed = trimmed.replace(/^##\s*/, '');
        } else if (trimmed.startsWith('#')) {
          isHeader = true;
          trimmed = trimmed.replace(/^#\s*/, '');
        } else if (trimmed.startsWith('-') || trimmed.startsWith('*')) {
          isList = true;
          trimmed = '• ' + trimmed.substring(1).trim();
        }

        const boldSplit = trimmed.split(/(\*\*.*?\*\*)/g);

        return (
          <Text
            key={lIdx}
            style={[
              isHeader ? styles.headerText : styles.bodyText,
              isList && styles.listLine,
              { color: colors.text },
            ]}
          >
            {boldSplit.map((part, pIdx) => {
              if (part.startsWith('**') && part.endsWith('**')) {
                const innerText = part.slice(2, -2);
                return (
                  <Text key={pIdx} style={styles.boldText}>
                    {renderMessageContentText(innerText, citationsList)}
                  </Text>
                );
              }
              return renderMessageContentText(part, citationsList);
            })}
          </Text>
        );
      });
    });
  };

  const renderMessageItem = ({ item }: { item: any }) => {
    const isUser = item.role === 'user';
    const hasCitations = item.citations && item.citations.length > 0;
    const isCitationsOpen = !!expandedCitationsMsgId[item.id];

    return (
      <AnimatedMessageItem isUser={isUser}>
        <View style={[styles.messageRow, isUser ? styles.userRow : styles.assistantRow]}>
          <View
            style={[
              styles.bubble,
              isUser
                ? { backgroundColor: colors.primary }
                : { backgroundColor: isDark ? '#151D30' : '#FFFFFF', borderColor: colors.border },
            ]}
          >
            {isUser ? (
              <Text style={styles.userMessageText}>{item.content}</Text>
            ) : (
              <View>
                {renderFormattedMarkdown(item.content, item.citations)}
                
                {hasCitations && (
                  <View style={[styles.citationsContainer, { borderTopColor: colors.border }]}>
                    <TouchableOpacity
                      style={styles.citationsHeader}
                      onPress={() => toggleCitations(item.id)}
                      activeOpacity={0.7}
                    >
                      <Info size={12} color={colors.textSecondary} style={{ marginRight: 6 }} />
                      <Text style={[styles.citationsTitle, { color: colors.textSecondary }]}>
                        Sources Used ({item.citations.length})
                      </Text>
                      {isCitationsOpen ? (
                        <ChevronUp size={14} color={colors.textSecondary} />
                      ) : (
                        <ChevronDown size={14} color={colors.textSecondary} />
                      )}
                    </TouchableOpacity>

                    {isCitationsOpen && (
                      <View style={styles.citationsList}>
                        {item.citations.map((cit: any, idx: number) => (
                          <TouchableOpacity
                            key={cit.chunk_id || idx}
                            style={[styles.citationItem, { backgroundColor: colors.primaryLight }]}
                            onPress={() => showCitationDetail(cit)}
                            activeOpacity={0.7}
                          >
                            <Text style={[styles.citationNumberText, { color: colors.primary }]}>
                              {idx + 1}
                            </Text>
                            <Text style={[styles.citationNameText, { color: colors.text }]} numberOfLines={1}>
                              {cit.title} {cit.page_number ? `(Page ${cit.page_number})` : ''}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </View>
                )}

                <View style={styles.toolbar}>
                  <TouchableOpacity
                    style={styles.toolbarBtn}
                    onPress={() => handleCopyMessage(item.content)}
                  >
                    <Copy size={13} color={colors.textSecondary} />
                  </TouchableOpacity>
                  <View style={styles.feedbackRow}>
                    <TouchableOpacity
                      style={styles.toolbarBtn}
                      onPress={() => handleFeedback(item.id, true)}
                    >
                      <ThumbsUp size={13} color={colors.textSecondary} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.toolbarBtn}
                      onPress={() => handleFeedback(item.id, false)}
                    >
                      <ThumbsDown size={13} color={colors.textSecondary} />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )}
          </View>
        </View>
      </AnimatedMessageItem>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Header
        title="AI CHATBOT"
        showBackButton={true}
        onBackPress={() => {
          if (isStreaming) {
            cancelStreaming();
          }
          router.back();
        }}
      />

      {initializing || isLoadingMsgs ? (
        <View style={styles.loadingWrapper}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Initializing RAG pipeline...</Text>
        </View>
      ) : (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          {messages.length === 0 ? (
            <SuggestionsDeck onSelectSuggestion={(text) => handleSend(text)} />
          ) : (
            <FlatList
              ref={flatListRef}
              data={messages}
              keyExtractor={(item) => item.id}
              renderItem={renderMessageItem}
              contentContainerStyle={styles.messagesList}
              ListFooterComponent={
                isStreaming ? (
                  <AnimatedMessageItem isUser={false}>
                    <View style={[styles.messageRow, styles.assistantRow]}>
                      <View style={[styles.bubble, { backgroundColor: isDark ? '#151D30' : '#FFFFFF', borderColor: colors.border }]}>
                        {streamingMessageText ? (
                          renderFormattedMarkdown(streamingMessageText, streamingCitations)
                        ) : (
                          <View style={styles.typingIndicator}>
                            <ActivityIndicator size="small" color={colors.primary} />
                            <Text style={[styles.typingText, { color: colors.textSecondary }]}>
                              Searching vector index...
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </AnimatedMessageItem>
                ) : null
              }
            />
          )}

          {/* Input Bar */}
          <View style={[styles.inputBar, { borderTopColor: colors.border, backgroundColor: colors.card }]}>
            {!isOnline && (
              <Text style={[styles.offlineNotice, { color: colors.danger }]}>
                Cannot send messages while offline. Check connection.
              </Text>
            )}
            
            <View style={styles.inputContainer}>
              <TextInput
                style={[
                  styles.textInput,
                  {
                    backgroundColor: isDark ? '#0B0F19' : '#F9FAFB',
                    borderColor: colors.border,
                    color: colors.text,
                  },
                ]}
                placeholder={isOnline ? "Ask Spendly AI about policies..." : "Offline - typing disabled"}
                placeholderTextColor={colors.textSecondary}
                value={inputVal}
                onChangeText={setInputVal}
                editable={isOnline && !sending && !isStreaming}
                multiline
              />

              {isStreaming ? (
                <TouchableOpacity
                  style={[styles.actionButton, { backgroundColor: colors.danger }]}
                  onPress={cancelStreaming}
                >
                  <XCircle size={18} color="#FFFFFF" />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[
                    styles.actionButton,
                    { backgroundColor: colors.primary },
                    (!inputVal.trim() || sending || !isOnline) && styles.disabledBtn,
                  ]}
                  onPress={() => handleSend()}
                  disabled={!inputVal.trim() || sending || !isOnline}
                >
                  {sending ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Send size={18} color="#FFFFFF" />
                  )}
                </TouchableOpacity>
              )}
            </View>
          </View>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  loadingWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 14,
  },
  messagesList: {
    padding: 16,
    paddingBottom: 24,
    gap: 16,
  },
  messageRow: {
    flexDirection: 'row',
    width: '100%',
    marginVertical: 4,
  },
  userRow: {
    justifyContent: 'flex-end',
  },
  assistantRow: {
    justifyContent: 'flex-start',
  },
  bubble: {
    maxWidth: '85%',
    padding: 14,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: 'transparent',
    gap: 8,
  },
  userMessageText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  bodyText: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  boldText: {
    fontWeight: 'bold',
  },
  headerText: {
    fontSize: 16,
    fontWeight: '800',
    marginTop: 10,
    marginBottom: 6,
  },
  listLine: {
    paddingLeft: 8,
  },
  codeBlock: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginVertical: 8,
  },
  codeText: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 12,
  },
  citationLink: {
    fontWeight: 'bold',
    fontSize: 11,
    textDecorationLine: 'underline',
  },
  citationsContainer: {
    borderTopWidth: 1,
    marginTop: 10,
    paddingTop: 8,
  },
  citationsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  citationsTitle: {
    flex: 1,
    fontSize: 11,
    fontWeight: '700',
  },
  citationsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  citationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  citationNumberText: {
    fontSize: 9,
    fontWeight: '900',
    marginRight: 6,
  },
  citationNameText: {
    fontSize: 10,
    fontWeight: '700',
    maxWidth: 150,
  },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
    borderTopWidth: 0.5,
    borderTopColor: '#E5E7EB',
    paddingTop: 6,
  },
  feedbackRow: {
    flexDirection: 'row',
    gap: 4,
  },
  toolbarBtn: {
    padding: 6,
  },
  typingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  typingText: {
    fontSize: 12,
    fontWeight: '500',
  },
  inputBar: {
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 28 : 16,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  textInput: {
    flex: 1,
    maxHeight: 100,
    minHeight: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    fontSize: 14,
  },
  actionButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledBtn: {
    opacity: 0.4,
  },
  offlineNotice: {
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  
  // Suggestions Deck Styling
  suggestionsContainer: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  aiBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 16,
  },
  aiBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.75,
  },
  suggestionsHeaderTitle: {
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 10,
  },
  suggestionsHeaderSub: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    marginBottom: 32,
    paddingHorizontal: 16,
  },
  suggestionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    width: '100%',
    gap: 12,
  },
  suggestionCard: {
    width: '48%',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    minHeight: 125,
  },
  suggestionIconBg: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  suggestionCardTitle: {
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
    marginBottom: 4,
  },
  suggestionCardDesc: {
    fontSize: 10,
    lineHeight: 14,
  },
});
