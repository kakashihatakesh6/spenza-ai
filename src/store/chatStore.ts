import { create } from 'zustand';
import { chatService, Conversation, ChatMessage, MessageCitation } from '../services/chatService';
import { networkMonitor } from '../services/logger/networkMonitor';
import { logger } from '../services/logger';
import { useAuthStore } from './authStore';
import { useExpenseStore } from './expenseStore';
import { useAlertStore } from './alertStore';

interface ChatState {
  conversations: Conversation[];
  activeConversation: Conversation | null;
  messages: ChatMessage[];
  
  // Loading & Action states
  isLoadingConvs: boolean;
  isLoadingMsgs: boolean;
  isStreaming: boolean;
  streamingMessageText: string;
  streamingCitations: MessageCitation[];
  isOnline: boolean;
  
  // Active stream abort handler
  activeStreamAbort: (() => void) | null;

  // Actions
  initializeChatStore: () => void;
  cleanupChatStore: () => void;
  resetChatStore: () => void;
  clearChat: () => Promise<void>;
  loadConversations: () => Promise<Conversation[]>;
  selectConversation: (id: string, forceReload?: boolean) => Promise<void>;
  startNewConversation: (userId: string, title?: string) => Promise<string>;
  deleteConversation: (id: string) => Promise<void>;
  sendMessage: (messageText: string) => Promise<void>;
  cancelStreaming: () => void;
  
  // Feedback action
  submitFeedback: (messageId: string, isPositive: boolean, feedbackText?: string) => Promise<void>;
}

export const useChatStore = create<ChatState>((set, get) => {
  let unsubscribeNetwork: (() => void) | null = null;
  let isCreatingConvLock = false;

  return {
    conversations: [],
    activeConversation: null,
    messages: [],
    
    isLoadingConvs: false,
    isLoadingMsgs: false,
    isStreaming: false,
    streamingMessageText: '',
    streamingCitations: [],
    isOnline: true,
    activeStreamAbort: null,

    initializeChatStore: () => {
      // Connect network status listener
      set({ isOnline: networkMonitor.isOnline });
      unsubscribeNetwork = networkMonitor.addListener((isOnline) => {
        set({ isOnline });
        if (!isOnline && get().isStreaming) {
          get().cancelStreaming();
          logger.warn('Streaming cancelled due to offline network connection.');
        }
      });
    },

    cleanupChatStore: () => {
      if (unsubscribeNetwork) {
        unsubscribeNetwork();
        unsubscribeNetwork = null;
      }
    },

    resetChatStore: () => {
      set({
        conversations: [],
        activeConversation: null,
        messages: [],
        isLoadingConvs: false,
        isLoadingMsgs: false,
        isStreaming: false,
        streamingMessageText: '',
        streamingCitations: [],
        activeStreamAbort: null,
      });
    },

    clearChat: async () => {
      try {
        const user = useAuthStore.getState().user;
        if (!user?.id) return;

        set({ isLoadingMsgs: true });
        await chatService.clearUserChat(user.id);
        set({
          conversations: [],
          activeConversation: null,
          messages: [],
          isLoadingMsgs: false,
          isStreaming: false,
          streamingMessageText: '',
          streamingCitations: [],
        });
      } catch (err) {
        logger.error('Store: failed to clear chat history', err);
        set({ isLoadingMsgs: false });
        throw err;
      }
    },

    loadConversations: async () => {
      try {
        set({ isLoadingConvs: true });
        const convs = await chatService.getConversations();
        set({ conversations: convs, isLoadingConvs: false });
        return convs;
      } catch (err) {
        logger.error('Store: failed to load conversations', err);
        set({ isLoadingConvs: false });
        return [];
      }
    },

    selectConversation: async (id: string, forceReload = false) => {
      try {
        const found = get().conversations.find((c) => c.id === id);
        if (!found) return;

        const isAlreadyActive = get().activeConversation?.id === id;
        if (isAlreadyActive && get().messages.length > 0 && !forceReload) {
          set({ activeConversation: found });
          return;
        }

        set({ activeConversation: found, isLoadingMsgs: true, messages: [], streamingMessageText: '', streamingCitations: [] });
        const msgs = await chatService.getMessages(id);
        set({ messages: msgs, isLoadingMsgs: false });
      } catch (err) {
        logger.error('Store: failed to select conversation', err);
        set({ isLoadingMsgs: false });
      }
    },

    startNewConversation: async (userId: string, title = 'Spendly AI Assistant') => {
      if (isCreatingConvLock) {
        throw new Error('Conversation creation already in progress.');
      }
      isCreatingConvLock = true;
      try {
        const newConv = await chatService.createConversation(userId, title);
        set((state) => ({
          conversations: [newConv, ...state.conversations],
          activeConversation: newConv,
          messages: [],
        }));
        return newConv.id;
      } catch (err) {
        logger.error('Store: failed to start new conversation', err);
        throw err;
      } finally {
        isCreatingConvLock = false;
      }
    },

    deleteConversation: async (id: string) => {
      try {
        await chatService.deleteConversation(id);
        set((state) => {
          const updatedConvs = state.conversations.filter((c) => c.id !== id);
          const wasActive = state.activeConversation?.id === id;
          return {
            conversations: updatedConvs,
            activeConversation: wasActive ? null : state.activeConversation,
            messages: wasActive ? [] : state.messages,
          };
        });
      } catch (err) {
        logger.error('Store: failed to delete conversation', err);
        throw err;
      }
    },

    sendMessage: async (messageText: string) => {
      const user = useAuthStore.getState().user;
      if (!user?.id) {
        throw new Error('User is not authenticated. Please sign in.');
      }

      const isOnline = get().isOnline;
      if (!isOnline) {
        throw new Error('You are currently offline. Please reconnect to send messages.');
      }

      let activeConv = get().activeConversation;
      
      // Auto-create active conversation if missing before sending message
      if (!activeConv) {
        if (get().conversations.length > 0) {
          activeConv = get().conversations[0];
          set({ activeConversation: activeConv });
        } else {
          try {
            const newId = await get().startNewConversation(user.id, 'Spendly AI Assistant');
            activeConv = get().conversations.find((c) => c.id === newId) || get().activeConversation;
          } catch (err) {
            logger.warn('Failed client-side conversation creation, relying on server auto-creation', err);
          }
        }
      }

      const currentConvId = activeConv?.id || null;
      
      // Clear streaming buffers and activate streaming state
      set({
        isStreaming: true,
        streamingMessageText: '',
        streamingCitations: [],
      });

      // Optimistically append user message to list
      const tempUserMsg: ChatMessage = {
        id: `temp-user-${Date.now()}`,
        conversation_id: currentConvId || 'pending',
        role: 'user',
        content: messageText,
        citations: [],
        created_at: new Date().toISOString(),
      };
      
      set((state) => ({
        messages: [...state.messages, tempUserMsg],
      }));

      // Initiate SSE streaming connection via service
      const abortRef = chatService.streamChatMessage(
        currentConvId,
        messageText,
        (token) => {
          set((state) => ({
            streamingMessageText: state.streamingMessageText + token,
          }));
        },
        (citations) => {
          set({ streamingCitations: citations });
        },
        async (doneData) => {
          const resolvedConvId = doneData.conversation_id || currentConvId;

          // Streaming completed successfully
          const completedResponseMsg: ChatMessage = {
            id: doneData.message_id,
            conversation_id: resolvedConvId || '',
            role: 'assistant',
            content: get().streamingMessageText,
            citations: get().streamingCitations,
            token_usage: doneData.token_usage,
            created_at: new Date().toISOString(),
          };

          // Re-fetch conversation messages to ensure exact IDs sync
          try {
            if (resolvedConvId) {
              const freshMsgs = await chatService.getMessages(resolvedConvId);
              set({
                messages: freshMsgs,
                isStreaming: false,
                streamingMessageText: '',
                streamingCitations: [],
                activeStreamAbort: null,
              });
            } else {
              set((state) => {
                const listWithoutTemp = state.messages.filter((m) => !m.id.startsWith('temp-user'));
                return {
                  messages: [...listWithoutTemp, { ...tempUserMsg, id: `user-${Date.now()}` }, completedResponseMsg],
                  isStreaming: false,
                  streamingMessageText: '',
                  streamingCitations: [],
                  activeStreamAbort: null,
                };
              });
            }
          } catch {
            // Fallback: update list locally
            set((state) => {
              const listWithoutTemp = state.messages.filter((m) => !m.id.startsWith('temp-user'));
              return {
                messages: [...listWithoutTemp, { ...tempUserMsg, id: `user-${Date.now()}` }, completedResponseMsg],
                isStreaming: false,
                streamingMessageText: '',
                streamingCitations: [],
                activeStreamAbort: null,
              };
            });
          }
          
          // Re-load conversation list to update titles/summary/updated_at and sync active conversation
          await get().loadConversations();
          if (resolvedConvId) {
            const updatedConvs = get().conversations;
            const updatedActive = updatedConvs.find((c) => c.id === resolvedConvId);
            if (updatedActive) {
              set({ activeConversation: updatedActive });
            }
          }

          // INSTANTLY refresh User Profile, Budgets, and Expenses across the app!
          try {
            await useAuthStore.getState().refreshUser();
            await Promise.all([
              useExpenseStore.getState().fetchBudgets(),
              useExpenseStore.getState().fetchExpenses(),
            ]);
          } catch (refreshErr) {
            logger.error('Failed to auto-refresh app stores after chat stream done', refreshErr);
          }
        },
        (error) => {
          const rawMessage = error?.message || String(error);
          logger.error('Store: error during message streaming', rawMessage);
          
          let alertTitle = 'Chat Error';
          let alertType: 'error' | 'warning' = 'error';

          const lower = rawMessage.toLowerCase();
          if (lower.includes('daily token') || lower.includes('token limit') || lower.includes('token budget')) {
            alertTitle = 'Daily Token Limit Over';
            alertType = 'warning';
          } else if (lower.includes('rate limit')) {
            alertTitle = 'Rate Limit Exceeded';
            alertType = 'warning';
          } else if (lower.includes('server busy') || lower.includes('overloaded') || lower.includes('503')) {
            alertTitle = 'Server Busy';
            alertType = 'warning';
          } else if (lower.includes('offline') || lower.includes('network')) {
            alertTitle = 'Connection Error';
            alertType = 'error';
          }

          // Trigger high-grade Custom Alert Modal
          useAlertStore.getState().showAlert(
            alertTitle,
            rawMessage,
            alertType,
            [
              {
                text: 'Got It',
                style: 'default',
              },
            ]
          );

          // Remove user message from list if sending failed completely
          set((state) => {
            const listWithoutTemp = state.messages.filter((m) => !m.id.startsWith('temp-user'));
            return {
              messages: listWithoutTemp,
              isStreaming: false,
              streamingMessageText: '',
              streamingCitations: [],
              activeStreamAbort: null,
            };
          });
        }
      );

      set({ activeStreamAbort: abortRef.abort });
    },

    cancelStreaming: () => {
      const abortFn = get().activeStreamAbort;
      if (abortFn) {
        abortFn();
        set({
          isStreaming: false,
          streamingMessageText: '',
          streamingCitations: [],
          activeStreamAbort: null,
        });
        logger.info('User cancelled chat streaming response.');
      }
    },



    submitFeedback: async (messageId: string, isPositive: boolean, feedbackText?: string) => {
      try {
        await chatService.sendFeedback(messageId, isPositive, feedbackText);
        logger.info(`Store: message feedback logged successfully for message ${messageId}`);
      } catch (err) {
        logger.error('Store: failed to submit feedback', err);
        throw err;
      }
    },
  };
});
