import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  RefreshControl,
  FlatList,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../../hooks/useTheme';
import { useAuthStore } from '../../store/authStore';
import { useChatStore } from '../../store/chatStore';
import { Header } from '../../components/Header';
import { EmptyState } from '../../components/EmptyState';
import {
  MessageSquare,
  Plus,
  Trash2,
  Clock,
  ChevronRight,
  WifiOff,
} from 'lucide-react-native';

export default function ChatDashboardScreen() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const user = useAuthStore((state) => state.user);
  
  const {
    conversations,
    isLoadingConvs,
    isOnline,
    initializeChatStore,
    cleanupChatStore,
    loadConversations,
    startNewConversation,
    deleteConversation,
  } = useChatStore();

  const [isRefreshing, setIsRefreshing] = useState(false);

  // Initialize and load store data
  useEffect(() => {
    initializeChatStore();
    if (user) {
      loadConversations();
    }
    return () => cleanupChatStore();
  }, [user]);

  const handleRefresh = async () => {
    if (!user) return;
    setIsRefreshing(true);
    try {
      await loadConversations();
    } catch (e) {
      console.warn(e);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleCreateChat = async () => {
    if (!user) return;
    try {
      const newChatId = await startNewConversation(user.id, `Chat Session #${conversations.length + 1}`);
      router.push(`/chat/${newChatId}` as any);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to start a new chat.');
    }
  };

  const handleDeleteChat = (id: string, title: string) => {
    Alert.alert(
      'Delete Conversation',
      `Are you sure you want to delete "${title}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteConversation(id);
            } catch (err: any) {
              Alert.alert('Error', 'Failed to delete chat: ' + err.message);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Header
        title="AI CHAT ASSISTANT"
        showBackButton={true}
        onBackPress={() => router.back()}
      />

      {/* Offline Status bar */}
      {!isOnline && (
        <View style={[styles.offlineBanner, { backgroundColor: colors.danger }]}>
          <WifiOff size={16} color="#FFFFFF" style={{ marginRight: 8 }} />
          <Text style={styles.offlineText}>Offline Mode: Read-only access enabled</Text>
        </View>
      )}

      <FlatList
        data={conversations}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
        }
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          isLoadingConvs ? (
            <ActivityIndicator style={{ marginTop: 40 }} size="small" color={colors.primary} />
          ) : (
            <EmptyState
              icon={MessageSquare}
              title="No Conversations Yet"
              description="Start a chat and ask Spendly AI questions about the Spendly App Knowledge Base and Q&A guide."
              actionLabel="Create Chat Session"
              onAction={handleCreateChat}
            />
          )
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[
              styles.itemCard,
              {
                backgroundColor: isDark ? '#151D30' : '#FFFFFF',
                borderColor: colors.border,
              },
            ]}
            onPress={() => router.push(`/chat/${item.id}` as any)}
            activeOpacity={0.7}
          >
            <View style={[styles.itemIconBg, { backgroundColor: colors.primaryLight }]}>
              <MessageSquare size={20} color={colors.primary} />
            </View>
            <View style={styles.itemMeta}>
              <Text style={[styles.itemTitle, { color: colors.text }]} numberOfLines={1}>
                {item.title}
              </Text>
              {item.summary ? (
                <Text style={[styles.itemDesc, { color: colors.textSecondary }]} numberOfLines={1}>
                  {item.summary}
                </Text>
              ) : (
                <View style={styles.row}>
                  <Clock size={10} color={colors.textSecondary} style={{ marginRight: 4 }} />
                  <Text style={[styles.itemDesc, { color: colors.textSecondary }]}>
                    Updated {new Date(item.updated_at).toLocaleDateString()}
                  </Text>
                </View>
              )}
            </View>
            <View style={styles.actionsRow}>
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => handleDeleteChat(item.id, item.title)}
              >
                <Trash2 size={16} color={colors.danger} />
              </TouchableOpacity>
              <ChevronRight size={18} color={colors.border} />
            </View>
          </TouchableOpacity>
        )}
      />

      {/* Floating Action Button */}
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: colors.primary }]}
        onPress={handleCreateChat}
        activeOpacity={0.85}
      >
        <Plus size={24} color="#FFFFFF" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  tabsBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  listContent: {
    padding: 16,
    paddingBottom: 80,
    gap: 12,
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1.5,
  },
  itemIconBg: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  itemMeta: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  itemDesc: {
    fontSize: 11,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionBtn: {
    padding: 8,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 6,
  },
  progressContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 999,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  progressText: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 16,
  },
  progressPercent: {
    fontSize: 28,
    fontWeight: '900',
    marginVertical: 8,
  },
  progressBarBg: {
    width: '80%',
    height: 6,
    backgroundColor: '#E5E7EB',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  offlineText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
});
