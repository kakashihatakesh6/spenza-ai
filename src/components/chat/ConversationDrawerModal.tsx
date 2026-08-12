import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Modal,
  FlatList,
  TextInput,
  Alert,
} from 'react-native';
import {
  X,
  Plus,
  MessageSquare,
  Trash2,
  CheckCircle2,
  Search,
  Sparkles,
} from 'lucide-react-native';
import { useTheme } from '../../hooks/useTheme';
import { Conversation } from '../../services/chatService';

interface ConversationDrawerModalProps {
  visible: boolean;
  onClose: () => void;
  conversations: Conversation[];
  activeConversation: Conversation | null;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
  onDeleteConversation: (id: string) => void;
}

export const ConversationDrawerModal: React.FC<ConversationDrawerModalProps> = ({
  visible,
  onClose,
  conversations,
  activeConversation,
  onSelectConversation,
  onNewConversation,
  onDeleteConversation,
}) => {
  const { colors, isDark } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = conversations.filter((c) =>
    (c.title || 'Spendly AI Assistant')
      .toLowerCase()
      .includes(searchQuery.toLowerCase())
  );

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const handleDelete = (id: string, title: string) => {
    Alert.alert(
      'Delete Conversation',
      `Are you sure you want to delete "${title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => onDeleteConversation(id),
        },
      ]
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />

        <View
          style={[
            styles.drawerContent,
            {
              backgroundColor: isDark ? '#131B2E' : '#FFFFFF',
              borderColor: isDark ? '#1E293B' : '#E2E8F0',
            },
          ]}
        >
          {/* Header Drag Bar & Title */}
          <View style={styles.topHeader}>
            <View style={[styles.dragIndicator, { backgroundColor: isDark ? '#334155' : '#CBD5E1' }]} />

            <View style={styles.modalTitleRow}>
              <View style={styles.modalTitleLeft}>
                <MessageSquare size={20} color={colors.primary} style={{ marginRight: 8 }} />
                <Text style={[styles.modalTitle, { color: colors.text }]}>Chat History</Text>
              </View>

              <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
                <X size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Start New Conversation Button */}
            <TouchableOpacity
              style={[
                styles.newChatBtn,
                {
                  backgroundColor: colors.primary,
                  shadowColor: colors.primary,
                },
              ]}
              onPress={() => {
                onNewConversation();
                onClose();
              }}
              activeOpacity={0.85}
            >
              <Plus size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.newChatBtnText}>Start New AI Thread</Text>
            </TouchableOpacity>

            {/* Search Input */}
            <View
              style={[
                styles.searchBox,
                {
                  backgroundColor: isDark ? '#0B0F19' : '#F1F5F9',
                  borderColor: isDark ? '#1E293B' : '#E2E8F0',
                },
              ]}
            >
              <Search size={16} color={colors.textSecondary} style={{ marginRight: 8 }} />
              <TextInput
                style={[styles.searchInput, { color: colors.text }]}
                placeholder="Search history..."
                placeholderTextColor={colors.textSecondary}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>
          </View>

          {/* Conversations List */}
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => {
              const isActive = activeConversation?.id === item.id;
              return (
                <TouchableOpacity
                  style={[
                    styles.convItem,
                    {
                      backgroundColor: isActive
                        ? isDark
                          ? 'rgba(99, 102, 241, 0.2)'
                          : 'rgba(99, 102, 241, 0.08)'
                        : isDark
                        ? '#0B0F19'
                        : '#F8FAFC',
                      borderColor: isActive
                        ? colors.primary
                        : isDark
                        ? '#1E293B'
                        : '#E2E8F0',
                    },
                  ]}
                  onPress={() => {
                    onSelectConversation(item.id);
                    onClose();
                  }}
                  activeOpacity={0.8}
                >
                  <View style={styles.convItemLeft}>
                    <View
                      style={[
                        styles.convIconBg,
                        {
                          backgroundColor: isActive
                            ? colors.primary
                            : isDark
                            ? '#1E293B'
                            : '#E2E8F0',
                        },
                      ]}
                    >
                      <Sparkles
                        size={16}
                        color={isActive ? '#FFFFFF' : colors.textSecondary}
                      />
                    </View>

                    <View style={styles.convTextCol}>
                      <Text
                        style={[
                          styles.convTitle,
                          {
                            color: colors.text,
                            fontWeight: isActive ? '700' : '600',
                          },
                        ]}
                        numberOfLines={1}
                      >
                        {item.title || 'Spendly AI Assistant'}
                      </Text>
                      <Text style={[styles.convDate, { color: colors.textSecondary }]}>
                        {formatDate(item.updated_at || item.created_at)}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.convItemRight}>
                    {isActive && (
                      <CheckCircle2 size={18} color={colors.primary} style={{ marginRight: 6 }} />
                    )}

                    <TouchableOpacity
                      style={styles.deleteIconBtn}
                      onPress={() => handleDelete(item.id, item.title)}
                      activeOpacity={0.7}
                    >
                      <Trash2 size={16} color={colors.danger} />
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <MessageSquare size={36} color={colors.textSecondary} style={{ marginBottom: 8 }} />
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                  No past conversations found.
                </Text>
              </View>
            }
          />
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  backdrop: {
    flex: 1,
  },
  drawerContent: {
    maxHeight: '75%',
    minHeight: '45%',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    paddingBottom: 24,
  },
  topHeader: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 12,
  },
  dragIndicator: {
    width: 38,
    height: 5,
    borderRadius: 3,
    alignSelf: 'center',
    marginBottom: 14,
  },
  modalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  modalTitleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  closeBtn: {
    padding: 6,
  },
  newChatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 14,
    marginBottom: 12,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  newChatBtnText: {
    color: '#FFFFFF',
    fontSize: 14.5,
    fontWeight: '700',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 8,
  },
  convItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
  },
  convItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  convIconBg: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  convTextCol: {
    flex: 1,
  },
  convTitle: {
    fontSize: 14,
    marginBottom: 2,
  },
  convDate: {
    fontSize: 11,
  },
  convItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  deleteIconBtn: {
    padding: 6,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
  },
  emptyText: {
    fontSize: 13.5,
  },
});
