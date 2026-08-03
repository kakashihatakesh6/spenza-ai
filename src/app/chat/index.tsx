import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  FlatList,
  ActivityIndicator,
  Alert,
  Platform,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { useTheme } from '../../hooks/useTheme';
import { useAuthStore } from '../../store/authStore';
import { useChatStore } from '../../store/chatStore';
import { Header } from '../../components/Header';
import { EmptyState } from '../../components/EmptyState';
import {
  MessageSquare,
  Plus,
  Trash2,
  FileText,
  UploadCloud,
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
    documents,
    isLoadingConvs,
    isUploading,
    uploadProgress,
    isOnline,
    initializeChatStore,
    cleanupChatStore,
    loadConversations,
    startNewConversation,
    deleteConversation,
    loadDocuments,
    uploadDocument,
    deleteDocument,
  } = useChatStore();

  const [activeTab, setActiveTab] = useState<'chats' | 'docs'>('chats');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Initialize and load store data
  useEffect(() => {
    initializeChatStore();
    if (user) {
      loadConversations();
      loadDocuments(user.id);
    }
    return () => cleanupChatStore();
  }, [user]);

  const handleRefresh = async () => {
    if (!user) return;
    setIsRefreshing(true);
    try {
      if (activeTab === 'chats') {
        await loadConversations();
      } else {
        await loadDocuments(user.id);
      }
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

  const handlePickAndUploadDocument = async () => {
    if (!user) return;
    if (!isOnline) {
      Alert.alert('Offline', 'Please check your internet connection to upload files.');
      return;
    }

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'application/pdf',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'text/plain',
          'text/markdown',
          'text/csv',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const asset = result.assets[0];
      const mimeType = asset.mimeType || 'application/octet-stream';
      
      await uploadDocument(asset.uri, asset.name, mimeType, user.id);
      Alert.alert('Success', `${asset.name} has been processed and added to your knowledge base!`);
    } catch (err: any) {
      Alert.alert('Upload Failed', err.message || 'An error occurred during file upload.');
    }
  };

  const handleDeleteDocument = (id: string, path: string, filename: string) => {
    Alert.alert(
      'Delete Document',
      `Delete "${filename}" from your knowledge base? The chatbot will no longer use this file for answering questions.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (!user) return;
            try {
              await deleteDocument(id, path, user.id);
            } catch (err: any) {
              Alert.alert('Error', 'Failed to delete document: ' + err.message);
            }
          },
        },
      ]
    );
  };

  const formatBytes = (bytes?: number) => {
    if (!bytes) return 'N/A';
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const renderTabButton = (tab: 'chats' | 'docs', label: string) => {
    const isActive = activeTab === tab;
    return (
      <TouchableOpacity
        style={[
          styles.tabButton,
          isActive && { borderBottomColor: colors.primary },
        ]}
        onPress={() => setActiveTab(tab)}
      >
        <Text
          style={[
            styles.tabButtonText,
            { color: isActive ? colors.primary : colors.textSecondary },
          ]}
        >
          {label}
        </Text>
      </TouchableOpacity>
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

      {/* Uploading progress overlay */}
      {isUploading && (
        <View style={[styles.progressContainer, { backgroundColor: isDark ? 'rgba(15, 23, 42, 0.9)' : 'rgba(255, 255, 255, 0.9)' }]}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.progressText, { color: colors.text }]}>
            Parsing & Indexing Vectors...
          </Text>
          <Text style={[styles.progressPercent, { color: colors.primary }]}>
            {Math.round(uploadProgress * 100)}%
          </Text>
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${uploadProgress * 100}%`, backgroundColor: colors.primary }]} />
          </View>
        </View>
      )}

      {/* Tabs bar */}
      <View style={[styles.tabsBar, { borderBottomColor: colors.border, backgroundColor: colors.card }]}>
        {renderTabButton('chats', `Chats (${conversations.length})`)}
        {renderTabButton('docs', `Knowledge Base (${documents.length})`)}
      </View>

      {activeTab === 'chats' ? (
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
                description="Start a chat and ask Spendly AI questions about your financial records and uploaded docs."
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
      ) : (
        <FlatList
          data={documents}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
          }
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <EmptyState
              icon={FileText}
              title="Knowledge Base Empty"
              description="Upload PDFs, DOCX files, spreadsheets (XLSX/CSV), or text notes to allow the RAG assistant to cite them."
              actionLabel="Upload Document"
              onAction={handlePickAndUploadDocument}
            />
          }
          renderItem={({ item }) => (
            <View
              style={[
                styles.itemCard,
                {
                  backgroundColor: isDark ? '#151D30' : '#FFFFFF',
                  borderColor: colors.border,
                },
              ]}
            >
              <View style={[styles.itemIconBg, { backgroundColor: 'rgba(99, 102, 241, 0.08)' }]}>
                <FileText size={20} color={colors.primary} />
              </View>
              <View style={styles.itemMeta}>
                <Text style={[styles.itemTitle, { color: colors.text }]} numberOfLines={1}>
                  {item.filename}
                </Text>
                <Text style={[styles.itemDesc, { color: colors.textSecondary }]}>
                  {(item.file_type || '').split('/').pop()?.toUpperCase() || 'DOCUMENT'} • v{item.version}
                </Text>
              </View>
              <View style={styles.actionsRow}>
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => handleDeleteDocument(item.id, item.storage_path, item.filename)}
                >
                  <Trash2 size={16} color={colors.danger} />
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}

      {/* Floating Action Button */}
      {activeTab === 'chats' ? (
        <TouchableOpacity
          style={[styles.fab, { backgroundColor: colors.primary }]}
          onPress={handleCreateChat}
          activeOpacity={0.85}
        >
          <Plus size={24} color="#FFFFFF" />
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={[styles.fab, { backgroundColor: colors.primary }]}
          onPress={handlePickAndUploadDocument}
          activeOpacity={0.85}
        >
          <UploadCloud size={24} color="#FFFFFF" />
        </TouchableOpacity>
      )}
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
