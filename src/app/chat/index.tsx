import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import {
  BarChart3,
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  FileSpreadsheet,
  Info,
  Send,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  User,
  XCircle
} from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  AppState,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BotAvatar } from '../../components/BotAvatar';
import { Header } from '../../components/Header';
import { useTheme } from '../../hooks/useTheme';
import { exportService } from '../../services/exportService';
import { useAlertStore } from '../../store/alertStore';
import { useAuthStore } from '../../store/authStore';
import { useChatStore } from '../../store/chatStore';
import { useExpenseStore } from '../../store/expenseStore';

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
    {
      text: "What is Spendly?",
      desc: "Learn about app architecture & offline storage.",
      icon: Sparkles,
      color: '#8B5CF6'
    },
    {
      text: "Show my recent transactions in GBP",
      desc: "View recent expense list converted to GBP (£).",
      icon: BarChart3,
      color: '#3B82F6'
    },
    {
      text: "Export this list to csv/excel",
      desc: "Save transactions as CSV/Excel using Settings export feature.",
      icon: FileSpreadsheet,
      color: '#10B981'
    },
    {
      text: "My monthly income is ₹90,000. Change my name to Nikhil",
      desc: "Update profile income settings & display username.",
      icon: User,
      color: '#F59E0B'
    },
  ];

  const { colors, isDark } = useTheme();

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={styles.suggestionsScrollContent}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <Animated.View style={[styles.suggestionsContainer, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        <View style={styles.botHeroWrapper}>
          <BotAvatar size={68} variant="glow" showPulse={true} pulseColor="#10B981" />
        </View>

        <View style={[styles.aiBadge, { backgroundColor: isDark ? 'rgba(99, 102, 241, 0.2)' : 'rgba(99, 102, 241, 0.1)' }]}>
          <Sparkles size={14} color={colors.primary} style={{ marginRight: 6 }} />
          <Text style={[styles.aiBadgeText, { color: colors.primary }]}>GROQ GPT-OSS-120B RAG ENGINE ONLINE</Text>
        </View>

        <Text style={[styles.suggestionsHeaderTitle, { color: colors.text }]}>How can I help you today?</Text>
        <Text style={[styles.suggestionsHeaderSub, { color: colors.textSecondary }]}>
          Ask about Spendly features, offline guides, policies, or select a query below:
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
                    borderColor: isDark ? 'rgba(99, 102, 241, 0.15)' : '#E5E7EB',
                  }
                ]}
                onPress={() => onSelectSuggestion(item.text)}
                activeOpacity={0.8}
              >
                <View style={[styles.suggestionIconBg, { backgroundColor: item.color + '18' }]}>
                  <IconComp size={18} color={item.color} />
                </View>
                <Text style={[styles.suggestionCardTitle, { color: colors.text }]} numberOfLines={3}>
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
    </ScrollView>
  );
};

export default function ChatDashboardScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
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
    clearChat,
    sendMessage,
    cancelStreaming,
    submitFeedback,
  } = useChatStore();

  const [inputVal, setInputVal] = useState('');
  const [sending, setSending] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [expandedCitationsMsgId, setExpandedCitationsMsgId] = useState<Record<string, boolean>>({});
  const [showScrollBottomBtn, setShowScrollBottomBtn] = useState(false);

  const flatListRef = useRef<FlatList>(null);
  const textInputRef = useRef<TextInput>(null);
  const userScrolledUpRef = useRef<boolean>(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  // Deterministic single-pass initialization flow on mount / user change
  useEffect(() => {
    initializeChatStore();
    let isMounted = true;

    const initChatSession = async () => {
      if (!user?.id) {
        if (isMounted) setInitializing(false);
        return;
      }

      setInitializing(true);
      try {
        // 1. Fetch user conversations from Supabase
        const convs = await loadConversations();

        if (!isMounted) return;

        // 2. Identify target active conversation
        const active = useChatStore.getState().activeConversation;
        const mainConv = convs.find(
          (c) => c.title === 'Spendly AI Assistant' || c.title.includes('AI Assistant')
        ) || convs[0];

        const targetConv = (active && convs.some((c) => c.id === active.id)) ? active : mainConv;

        // 3. Load messages for target conversation if available
        if (targetConv) {
          await selectConversation(targetConv.id);
        }
      } catch (err) {
        console.warn('[Chat] Failed to initialize chat session:', err);
      } finally {
        if (isMounted) {
          setInitializing(false);
        }
      }
    };

    initChatSession();
    return () => {
      isMounted = false;
      cleanupChatStore();
    };
  }, [user?.id]);

  // Dynamic native keyboard listener & app lifecycle resume handler
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const onShow = (e: any) => {
      const kh = e?.endCoordinates?.height || 0;
      setKeyboardHeight(kh);
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 50);
    };

    const onHide = () => {
      setKeyboardHeight(0);
    };

    const showSub = Keyboard.addListener(showEvent, onShow);
    const hideSub = Keyboard.addListener(hideEvent, onHide);

    const appStateSub = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'background' || nextAppState === 'inactive') {
        textInputRef.current?.blur();
        Keyboard.dismiss();
        setKeyboardHeight(0);
      } else if (nextAppState === 'active') {
        textInputRef.current?.blur();
        setKeyboardHeight(0);
      }
    });

    return () => {
      showSub.remove();
      hideSub.remove();
      appStateSub.remove();
    };
  }, []);

  const handleClearChat = () => {
    Alert.alert(
      'Clear Chat History',
      'Are you sure you want to clear all chatbot conversation history? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear Chat',
          style: 'destructive',
          onPress: async () => {
            try {
              if (isStreaming) {
                cancelStreaming();
              }
              await clearChat();
              useAlertStore.getState().showAlert('Chat Cleared', 'Your chatbot history has been successfully cleared.', 'success');
            } catch (err: any) {
              useAlertStore.getState().showAlert('Error', 'Failed to clear chat history: ' + (err?.message || 'Error'), 'error');
            }
          },
        },
      ]
    );
  };

  // Non-blocking auto-scroll: auto-scroll to bottom only if user hasn't manually scrolled up
  useEffect(() => {
    if ((messages.length > 0 || streamingMessageText) && !userScrolledUpRef.current) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages, streamingMessageText]);

  const handleScroll = (event: any) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const isAtBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - 90;
    userScrolledUpRef.current = !isAtBottom;
    setShowScrollBottomBtn(!isAtBottom);
  };

  const extractCSVDataFromMessage = (content: string) => {
    if (!content) return null;
    const match = content.match(/<!--CSV_DATA:([\s\S]*?)-->/);
    if (match && match[1]) {
      try {
        const parsed = JSON.parse(match[1].trim());
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      } catch (err) {
        console.warn('Failed to parse CSV_DATA tag', err);
      }
    }
    return null;
  };

  const handleSaveCSV = async (customList?: any[]) => {
    try {
      const sourceList = (customList && Array.isArray(customList) && customList.length > 0)
        ? customList
        : useExpenseStore.getState().expenses;

      if (!sourceList || sourceList.length === 0) {
        useAlertStore.getState().showAlert('No Data', 'No transactions found to export.', 'warning');
        return;
      }

      const formattedExpenses: any[] = sourceList.map((item: any) => ({
        id: item.id || `exp-${Math.random().toString(36).substr(2, 9)}`,
        amount: parseFloat(item.amount) || 0,
        merchant: item.merchant || item.title || 'Uncategorized',
        category: item.category || 'General',
        date: item.date || item.transaction_date || new Date().toISOString().split('T')[0],
        time: item.time || '12:00',
        paymentMethod: item.paymentMethod || item.payment_method || 'Card',
        currency: item.currency || 'INR',
        tax: item.tax || 0,
        notes: item.notes || '',
        createdAt: item.createdAt || new Date().toISOString(),
        updatedAt: item.updatedAt || new Date().toISOString(),
        isSynced: 1,
      }));

      const defaultName = `expenses_export_${new Date().toISOString().split('T')[0]}`;
      const res = await exportService.saveCSVToCustomLocation(formattedExpenses, defaultName);
      if (res.success && res.path) {
        useAlertStore.getState().showAlert(
          'Export Ready',
          `Saved ${formattedExpenses.length} transaction(s) to CSV file!\n\nFile Location:\n${res.path}`,
          'success'
        );
      }
    } catch (err: any) {
      useAlertStore.getState().showAlert('Export Failed', 'An error occurred while saving CSV file: ' + (err?.message || 'Error'), 'error');
    }
  };

  const handleSend = async (customQuery?: string) => {
    const query = (customQuery || inputVal).trim();
    if (!query || sending || isStreaming) return;

    setInputVal('');
    setSending(true);
    userScrolledUpRef.current = false;
    setShowScrollBottomBtn(false);

    try {
      await sendMessage(query);
    } catch (err: any) {
      const rawMsg = err?.message || 'An error occurred while sending message.';
      const lower = rawMsg.toLowerCase();
      let alertTitle = 'Send Failed';
      if (lower.includes('daily token') || lower.includes('token limit')) {
        alertTitle = 'Daily Token Limit Over';
      } else if (lower.includes('rate limit')) {
        alertTitle = 'Rate Limit Exceeded';
      } else if (lower.includes('offline') || lower.includes('network')) {
        alertTitle = 'Connection Error';
      }
      useAlertStore.getState().showAlert(alertTitle, rawMsg, 'warning');
      if (!customQuery) {
        setInputVal(query);
      }
    } finally {
      setSending(false);
    }
  };

  const handleInputChange = (text: string) => {
    setInputVal(text);
    userScrolledUpRef.current = false;
    setShowScrollBottomBtn(false);
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 50);
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
    const cleanContent = content.replace(/<!--CSV_DATA:[\s\S]*?-->/g, '').trim();
    if (!cleanContent) return null;

    const codeBlockSplit = cleanContent.split(/(```[\s\S]*?```)/g);

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
    const csvItems = extractCSVDataFromMessage(item.content);

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

                {csvItems && (
                  <TouchableOpacity
                    style={[
                      styles.minimalExportBtn,
                      {
                        borderColor: isDark ? 'rgba(255, 255, 255, 0.18)' : 'rgba(0, 0, 0, 0.15)',
                        backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : '#F8FAFC',
                      },
                    ]}
                    onPress={() => handleSaveCSV(csvItems)}
                    activeOpacity={0.7}
                  >
                    <Download size={13} color={isDark ? '#94A3B8' : '#475569'} style={{ marginRight: 6 }} />
                    <Text style={[styles.minimalExportBtnText, { color: isDark ? '#E2E8F0' : '#334155' }]}>
                      Save CSV ({csvItems.length} items)
                    </Text>
                  </TouchableOpacity>
                )}

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
        title={
          <View style={styles.headerTitleRow}>
            <BotAvatar size={32} variant="glow" showPulse={true} pulseColor="#10B981" style={{ marginRight: 8 }} />
            <View style={styles.headerTitleCol}>
              <Text style={[styles.headerTitleMain, { color: colors.text }]}>AI CHATBOT</Text>
              <View style={styles.headerStatusRow}>
                <View style={[styles.headerStatusDot, { backgroundColor: '#10B981' }]} />
                <Text style={[styles.headerStatusText, { color: colors.textSecondary }]}>Online • RAG Engine</Text>
              </View>
            </View>
          </View>
        }
        showBackButton={true}
        onBackPress={() => {
          if (isStreaming) {
            cancelStreaming();
          }
          router.back();
        }}
        rightIcon="trash-2"
        onRightPress={handleClearChat}
      />

      {initializing || isLoadingMsgs ? (
        <View style={styles.loadingWrapper}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Initializing RAG pipeline...</Text>
        </View>
      ) : (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 65 + insets.top : 0}
          style={{
            flex: 1,
            paddingBottom: Platform.OS === 'android' ? keyboardHeight : 0,
          }}
        >
          {messages.length === 0 ? (
            <SuggestionsDeck onSelectSuggestion={(text) => handleSend(text)} />
          ) : (
            <View style={{ flex: 1 }}>
              <FlatList
                ref={flatListRef}
                data={messages}
                keyExtractor={(item) => item.id}
                renderItem={renderMessageItem}
                contentContainerStyle={styles.messagesList}
                keyboardShouldPersistTaps="handled"
                onScroll={handleScroll}
                scrollEventThrottle={16}
                ListFooterComponent={
                  isStreaming ? (
                    <AnimatedMessageItem isUser={false}>
                      <View style={[styles.messageRow, styles.assistantRow]}>
                        <View style={[styles.bubble, { backgroundColor: isDark ? '#151D30' : '#FFFFFF', borderColor: colors.border }]}>
                          {streamingMessageText ? (
                            <View>
                              {renderFormattedMarkdown(streamingMessageText, streamingCitations)}
                              {(() => {
                                const streamCsvItems = extractCSVDataFromMessage(streamingMessageText);
                                if (!streamCsvItems) return null;
                                return (
                                  <TouchableOpacity
                                    style={[
                                      styles.minimalExportBtn,
                                      {
                                        borderColor: isDark ? 'rgba(255, 255, 255, 0.18)' : 'rgba(0, 0, 0, 0.15)',
                                        backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : '#F8FAFC',
                                      },
                                    ]}
                                    onPress={() => handleSaveCSV(streamCsvItems)}
                                    activeOpacity={0.7}
                                  >
                                    <Download size={13} color={isDark ? '#94A3B8' : '#475569'} style={{ marginRight: 6 }} />
                                    <Text style={[styles.minimalExportBtnText, { color: isDark ? '#E2E8F0' : '#334155' }]}>
                                      Save CSV ({streamCsvItems.length} items)
                                    </Text>
                                  </TouchableOpacity>
                                );
                              })()}
                            </View>
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

              {showScrollBottomBtn && (
                <TouchableOpacity
                  style={[
                    styles.jumpToBottomBtn,
                    {
                      backgroundColor: colors.primary,
                      shadowColor: colors.primary,
                    },
                  ]}
                  onPress={() => {
                    userScrolledUpRef.current = false;
                    setShowScrollBottomBtn(false);
                    flatListRef.current?.scrollToEnd({ animated: true });
                  }}
                  activeOpacity={0.85}
                >
                  <ChevronDown size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={styles.jumpToBottomText}>
                    {isStreaming ? 'Streaming response... Jump to bottom' : 'Jump to bottom'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Input Bar */}
          <View
            style={[
              styles.inputBar,
              {
                borderTopColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
                backgroundColor: isDark ? '#0F172A' : '#FFFFFF',
                paddingBottom: Math.max(insets.bottom, 12),
              },
            ]}
          >
            {!isOnline && (
              <Text style={[styles.offlineNotice, { color: colors.danger }]}>
                Cannot send messages while offline. Check connection.
              </Text>
            )}

            <View style={styles.inputContainer}>
              <TextInput
                ref={textInputRef}
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
                onChangeText={handleInputChange}
                onFocus={() => {
                  userScrolledUpRef.current = false;
                  setShowScrollBottomBtn(false);
                  setTimeout(() => {
                    flatListRef.current?.scrollToEnd({ animated: true });
                  }, 50);
                  setTimeout(() => {
                    flatListRef.current?.scrollToEnd({ animated: true });
                  }, 250);
                }}
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
    minHeight: 140,
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
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleCol: {
    justifyContent: 'center',
  },
  headerTitleMain: {
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  headerStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 1,
  },
  headerStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4,
  },
  headerStatusText: {
    fontSize: 10,
    fontWeight: '600',
  },
  suggestionsScrollContent: {
    flexGrow: 1,
    paddingVertical: 16,
  },
  botHeroWrapper: {
    marginBottom: 12,
    alignItems: 'center',
  },
  minimalExportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 10,
  },
  minimalExportBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  jumpToBottomBtn: {
    position: 'absolute',
    bottom: 14,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 8,
    zIndex: 100,
  },
  jumpToBottomText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
});
