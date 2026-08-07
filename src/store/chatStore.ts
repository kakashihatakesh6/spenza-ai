import { create } from 'zustand';
import { chatService, Conversation, ChatMessage, MessageCitation } from '../services/chatService';
import { networkMonitor } from '../services/logger/networkMonitor';
import { logger } from '../services/logger';
import { useAuthStore } from './authStore';
import { useExpenseStore } from './expenseStore';

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
  loadConversations: () => Promise<void>;
  selectConversation: (id: string) => Promise<void>;
  startNewConversation: (userId: string, title?: string) => Promise<string>;
  deleteConversation: (id: string) => Promise<void>;
  sendMessage: (messageText: string) => Promise<void>;
  cancelStreaming: () => void;
  
  // Feedback action
  submitFeedback: (messageId: string, isPositive: boolean, feedbackText?: string) => Promise<void>;
}

export const useChatStore = create<ChatState>((set, get) => {
  let unsubscribeNetwork: (() => void) | null = null;

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

    loadConversations: async () => {
      try {
        set({ isLoadingConvs: true });
        const convs = await chatService.getConversations();
        set({ conversations: convs, isLoadingConvs: false });
      } catch (err) {
        logger.error('Store: failed to load conversations', err);
        set({ isLoadingConvs: false });
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

    startNewConversation: async (userId: string, title = 'New Conversation') => {
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
      const activeConv = get().activeConversation;
      const isOnline = get().isOnline;
      
      if (!activeConv) return;
      if (!isOnline) {
        throw new Error('You are currently offline. Please reconnect to send messages.');
      }
      
      // Clear streaming buffers and activate streaming state
      set({
        isStreaming: true,
        streamingMessageText: '',
        streamingCitations: [],
      });

      // Optimistically append user message to list
      const tempUserMsg: ChatMessage = {
        id: `temp-user-${Date.now()}`,
        conversation_id: activeConv.id,
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
        activeConv.id,
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
          // Streaming completed successfully
          const completedResponseMsg: ChatMessage = {
            id: doneData.message_id,
            conversation_id: activeConv.id,
            role: 'assistant',
            content: get().streamingMessageText,
            citations: get().streamingCitations,
            token_usage: doneData.token_usage,
            created_at: new Date().toISOString(),
          };

          // Re-fetch conversation messages to ensure exact IDs sync
          try {
            const freshMsgs = await chatService.getMessages(activeConv.id);
            set({
              messages: freshMsgs,
              isStreaming: false,
              streamingMessageText: '',
              streamingCitations: [],
              activeStreamAbort: null,
            });
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
          
          // Re-load conversation list to update titles/summary/updated_at
          get().loadConversations();

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
          logger.error('Store: error during message streaming', error?.message || String(error));
          
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
