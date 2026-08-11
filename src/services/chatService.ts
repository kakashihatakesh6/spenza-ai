import { supabase } from '../lib/supabase';
import { logger } from './logger';

export interface Conversation {
  id: string;
  user_id: string;
  title: string;
  summary?: string;
  created_at: string;
  updated_at: string;
}

export interface MessageCitation {
  chunk_id: string;
  title: string;
  filename: string;
  page_number?: number;
  section?: string;
  similarity: number;
}

export interface ChatMessage {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  citations: MessageCitation[];
  token_usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  created_at: string;
}

export const chatService = {
  /**
   * Fetches all chat conversations for the logged in user.
   */
  async getConversations(): Promise<Conversation[]> {
    const { data, error } = await supabase
      .from('chat_conversations')
      .select('*')
      .order('updated_at', { ascending: false });

    if (error) {
      logger.error('Failed to fetch conversations', error);
      throw error;
    }

    return (data || []) as Conversation[];
  },

  /**
   * Creates a new chat conversation.
   */
  async createConversation(userId: string, title = 'New Conversation'): Promise<Conversation> {
    const { data, error } = await supabase
      .from('chat_conversations')
      .insert({ user_id: userId, title })
      .select('*')
      .single();

    if (error) {
      logger.error('Failed to create conversation', error);
      throw error;
    }

    return data as Conversation;
  },

  /**
   * Deletes all chat conversations for a specific user (cascade deletes all messages).
   */
  async clearUserChat(userId: string): Promise<void> {
    const { error } = await supabase
      .from('chat_conversations')
      .delete()
      .eq('user_id', userId);

    if (error) {
      logger.error('Failed to clear user chat history', error);
      throw error;
    }
  },

  /**
   * Deletes a conversation and all its messages (due to cascade constraints).
   */
  async deleteConversation(conversationId: string): Promise<void> {
    const { error } = await supabase
      .from('chat_conversations')
      .delete()
      .eq('id', conversationId);

    if (error) {
      logger.error('Failed to delete conversation', error);
      throw error;
    }
  },

  /**
   * Fetches messages for a specific conversation.
   */
  async getMessages(conversationId: string): Promise<ChatMessage[]> {
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (error) {
      logger.error('Failed to fetch messages', error);
      throw error;
    }

    return (data || []) as ChatMessage[];
  },

  /**
   * Saves feedback (thumbs up / down) for an AI assistant message.
   */
  async sendFeedback(
    messageId: string,
    isPositive: boolean,
    feedbackText?: string
  ): Promise<void> {
    const { error } = await supabase
      .from('chat_feedback')
      .upsert({
        message_id: messageId,
        is_positive: isPositive,
        feedback_text: feedbackText || null,
        created_at: new Date().toISOString(),
      });

    if (error) {
      logger.error('Failed to submit message feedback', error);
      throw error;
    }
  },

  /**
   * Streams chat response from the Supabase Edge Function.
   * Handles packet fragmentation, token emissions, citations, and completion event.
   */
  streamChatMessage(
    conversationId: string | null | undefined,
    message: string,
    onToken: (token: string) => void,
    onCitations: (citations: MessageCitation[]) => void,
    onDone: (data: { message_id: string; conversation_id?: string; token_usage?: any }) => void,
    onError: (error: Error) => void
  ): { abort: () => void } {
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
    const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
    
    // Fetch user token from local session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        onError(new Error('User session expired. Please sign in again.'));
        return;
      }

      const url = `${supabaseUrl}/functions/v1/chat`;
      const xhr = new XMLHttpRequest();
      
      xhr.open('POST', url, true);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.setRequestHeader('Authorization', `Bearer ${session.access_token}`);
      xhr.setRequestHeader('apikey', supabaseAnonKey);

      let processedLength = 0;
      let buffer = '';
      let currentEvent = 'token'; // Default event type is token text

      xhr.onreadystatechange = () => {
        // readyState 3 = LOADING, 4 = DONE
        if (xhr.readyState === 3 || xhr.readyState === 4) {
          if (xhr.status !== 200) {
            if (xhr.readyState === 4) {
              try {
                const errBody = JSON.parse(xhr.responseText);
                onError(new Error(errBody.error || `HTTP ${xhr.status} Error`));
              } catch {
                onError(new Error(`Server returned HTTP ${xhr.status}: ${xhr.statusText || 'Error'}`));
              }
            }
            return;
          }

          const chunk = xhr.responseText.substring(processedLength);
          processedLength = xhr.responseText.length;
          buffer += chunk;

          let lineEndIdx;
          while ((lineEndIdx = buffer.indexOf('\n')) !== -1) {
            const line = buffer.substring(0, lineEndIdx).trim();
            buffer = buffer.substring(lineEndIdx + 1);

            if (line === '') continue;

            if (line.startsWith('event:')) {
              currentEvent = line.replace('event:', '').trim();
            } else if (line.startsWith('data:')) {
              const dataStr = line.replace('data:', '').trim();
              try {
                const data = JSON.parse(dataStr);
                
                if (currentEvent === 'citations') {
                  onCitations(data as MessageCitation[]);
                } else if (currentEvent === 'token') {
                  onToken(data.text);
                } else if (currentEvent === 'done') {
                  onDone(data);
                } else if (currentEvent === 'error') {
                  onError(new Error(data.error || 'Server stream processing error'));
                }
              } catch (parseErr) {
                console.warn('Failed to parse SSE data block:', line, parseErr);
              }
            }
          }
        }
      };

      xhr.onerror = (e) => {
        onError(new Error('Network request failed. Check your internet connection.'));
      };

      xhr.ontimeout = () => {
        onError(new Error('Connection timed out. Please try again.'));
      };

      // Set reasonable timeout
      xhr.timeout = 45000; // 45 seconds

      xhr.send(JSON.stringify({ conversationId, message }));

      // Attach abort function to controller return
      abortRef.abort = () => {
        xhr.abort();
      };
    }).catch(err => {
      onError(err);
    });

    const abortRef = {
      abort: () => {},
    };

    return abortRef;
  },
};
