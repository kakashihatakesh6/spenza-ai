import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowDown } from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../hooks/useTheme';
import { ChatMessage } from '../../services/chatService';
import { exportService } from '../../services/exportService';
import { useAlertStore } from '../../store/alertStore';
import { useChatStore } from '../../store/chatStore';
import { fetchLLMGeneratedSuggestions, generateLLMSuggestions } from '../../utils/chatSuggestions';

// Chat UI Components
import { ChatHeader } from '../../components/chat/ChatHeader';
import { ChatInputBar } from '../../components/chat/ChatInputBar';
import { ChatMessageBubble } from '../../components/chat/ChatMessageBubble';
import { ConversationDrawerModal } from '../../components/chat/ConversationDrawerModal';
import { QuickSuggestionDeck } from '../../components/chat/QuickSuggestionDeck';
import { TypingIndicator } from '../../components/chat/TypingIndicator';

export default function ChatSessionScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams();
  const { colors, isDark } = useTheme();

  const {
    conversations,
    messages,
    activeConversation,
    isLoadingMsgs,
    isStreaming,
    streamingMessageText,
    streamingCitations,
    isOnline,
    selectConversation,
    startNewConversation,
    deleteConversation,
    clearChat,
    sendMessage,
    cancelStreaming,
    submitFeedback,
  } = useChatStore();

  const [inputVal, setInputVal] = useState('');
  const [sending, setSending] = useState(false);
  const [showScrollBottomBtn, setShowScrollBottomBtn] = useState(false);
  const [showDrawer, setShowDrawer] = useState(false);
  const [dynamicSuggestions, setDynamicSuggestions] = useState<string[]>([]);

  const keyboardHeightAnim = useRef(new Animated.Value(0)).current;
  const flatListRef = useRef<FlatList>(null);
  const textInputRef = useRef<any>(null);
  const userScrolledUpRef = useRef<boolean>(false);

  // Fetch real LLM follow-up suggestions generated directly from last query & assistant response
  useEffect(() => {
    let isMounted = true;
    const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user')?.content;
    const lastAssistantMessage = [...messages].reverse().find((m) => m.role === 'assistant')?.content;

    if (lastUserMessage && lastAssistantMessage && !isStreaming) {
      fetchLLMGeneratedSuggestions(lastUserMessage, lastAssistantMessage).then((suggestions) => {
        if (isMounted && suggestions && suggestions.length > 0) {
          setDynamicSuggestions(suggestions);
        }
      });
    } else if (messages.length === 0) {
      setDynamicSuggestions([
        "📊 What is my total expense summary this month?",
        "💡 Give me 3 tips to reduce my spending",
        "📤 How do I export my transaction history?",
      ]);
    }
    return () => {
      isMounted = false;
    };
  }, [messages, isStreaming]);

  // Load target conversation session on mount
  useEffect(() => {
    if (id) {
      selectConversation(id as string);
    }
  }, [id]);

  // Bulletproof keyboard tracking animation for both iOS and Android
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const onShow = (e: any) => {
      const kh = e?.endCoordinates?.height || 0;
      const dur = Platform.OS === 'ios' ? (e?.duration || 250) : 150;

      Animated.timing(keyboardHeightAnim, {
        toValue: Platform.OS === 'android' ? kh : 0,
        duration: dur,
        useNativeDriver: false,
      }).start();

      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 50);
    };

    const onHide = (e: any) => {
      const dur = Platform.OS === 'ios' ? (e?.duration || 250) : 150;
      Animated.timing(keyboardHeightAnim, {
        toValue: 0,
        duration: dur,
        useNativeDriver: false,
      }).start();
    };

    const showSub = Keyboard.addListener(showEvent, onShow);
    const hideSub = Keyboard.addListener(hideEvent, onHide);

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Non-blocking auto-scroll logic
  useEffect(() => {
    if ((messages.length > 0 || streamingMessageText) && !userScrolledUpRef.current) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 80);
    }
  }, [messages, streamingMessageText]);

  const handleScroll = (event: any) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const isAtBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - 90;
    userScrolledUpRef.current = !isAtBottom;
    setShowScrollBottomBtn(!isAtBottom);
  };

  const handleScrollToBottom = () => {
    userScrolledUpRef.current = false;
    setShowScrollBottomBtn(false);
    flatListRef.current?.scrollToEnd({ animated: true });
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
      let alertTitle = 'Send Failed';
      const lower = rawMsg.toLowerCase();
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
              router.replace('/chat');
            } catch (err: any) {
              useAlertStore.getState().showAlert('Error', 'Failed to clear chat history: ' + (err?.message || 'Error'), 'error');
            }
          },
        },
      ]
    );
  };

  const handleExportChat = async () => {
    if (!messages || messages.length === 0) {
      useAlertStore.getState().showAlert('Export Chat', 'No messages in conversation to export.', 'warning');
      return;
    }
    try {
      const exportText = messages
        .map((m) => `[${m.role.toUpperCase()} - ${new Date(m.created_at).toLocaleString()}]\n${m.content}\n`)
        .join('\n----------------------------------------\n\n');

      const fileName = `Spendly_Chat_Export_${new Date().toISOString().split('T')[0]}.txt`;
      await exportService.saveTextFile(exportText, fileName);
      useAlertStore.getState().showAlert('Exported', 'Chat conversation exported successfully!', 'success');
    } catch (err: any) {
      useAlertStore.getState().showAlert('Export Failed', err?.message || 'Could not export chat.', 'error');
    }
  };

  const streamingMsgObj: ChatMessage | null = isStreaming
    ? {
      id: 'streaming-temp-id',
      conversation_id: activeConversation?.id || 'temp',
      role: 'assistant',
      content: streamingMessageText || 'Reasoning...',
      citations: streamingCitations || [],
      created_at: new Date().toISOString(),
    }
    : null;

  return (
    <View style={[styles.screenContainer, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={{ paddingTop: insets.top }}>
        <ChatHeader
          title="Spendly AI"
          subtitle={isOnline ? 'Online • Groq GPT-OSS 120B' : 'Offline Mode'}
          isOnline={isOnline}
          onOpenHistory={() => setShowDrawer(true)}
          onClearChat={handleClearChat}
          onExportChat={handleExportChat}
        />
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {isLoadingMsgs ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
              Loading chat session...
            </Text>
          </View>
        ) : messages.length === 0 && !isStreaming ? (
          <QuickSuggestionDeck onSelectSuggestion={(text) => handleSend(text)} />
        ) : (
          <View style={{ flex: 1 }}>
            <FlatList
              ref={flatListRef}
              data={messages}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.messagesListContent}
              keyboardShouldPersistTaps="handled"
              onScroll={handleScroll}
              scrollEventThrottle={16}
              renderItem={({ item }) => (
                <ChatMessageBubble
                  message={item}
                  onFeedback={(msgId, isPositive) => submitFeedback(msgId, isPositive)}
                />
              )}
              ListFooterComponent={
                isStreaming ? (
                  streamingMessageText ? (
                    <ChatMessageBubble
                      message={streamingMsgObj!}
                      isStreaming={true}
                    />
                  ) : (
                    <TypingIndicator />
                  )
                ) : null
              }
            />

            {showScrollBottomBtn && (
              <TouchableOpacity
                style={[
                  styles.scrollBottomBtn,
                  {
                    backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
                    borderColor: isDark ? '#334155' : '#E2E8F0',
                    shadowColor: colors.primary,
                  },
                ]}
                onPress={handleScrollToBottom}
                activeOpacity={0.8}
              >
                <ArrowDown size={18} color={colors.primary} />
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Input Bar with safe bottom padding */}
        <View style={{ paddingBottom: Math.max(insets.bottom, 6) }}>
          <ChatInputBar
            inputRef={textInputRef}
            value={inputVal}
            onChangeText={(txt) => {
              setInputVal(txt);
              userScrolledUpRef.current = false;
              setShowScrollBottomBtn(false);
            }}
            onSend={(customText) => handleSend(customText)}
            isStreaming={isStreaming}
            onCancelStream={cancelStreaming}
            disabled={sending}
            suggestions={dynamicSuggestions}
            onSelectSuggestion={(txt) => handleSend(txt)}
          />
        </View>
      </KeyboardAvoidingView>

      {/* History Drawer */}
      <ConversationDrawerModal
        visible={showDrawer}
        onClose={() => setShowDrawer(false)}
        conversations={conversations}
        activeConversation={activeConversation}
        onSelectConversation={(selectedId) => {
          selectConversation(selectedId);
          router.setParams({ id: selectedId });
        }}
        onNewConversation={async () => {
          if (!activeConversation?.user_id) return;
          const newId = await startNewConversation(activeConversation.user_id, 'New Chat Thread');
          selectConversation(newId);
          router.setParams({ id: newId });
        }}
        onDeleteConversation={(deleteId) => deleteConversation(deleteId)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screenContainer: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    fontWeight: '500',
  },
  messagesListContent: {
    paddingVertical: 12,
  },
  scrollBottomBtn: {
    position: 'absolute',
    bottom: 12,
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 5,
  },
});
