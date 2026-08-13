import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolateColor,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Send, Square, Sparkles, X } from 'lucide-react-native';
import { useTheme } from '../../hooks/useTheme';

interface ChatInputBarProps {
  value: string;
  onChangeText: (text: string) => void;
  onSend: (customText?: string) => void;
  isStreaming?: boolean;
  onCancelStream?: () => void;
  disabled?: boolean;
  inputRef?: React.RefObject<TextInput | null>;
  suggestions?: string[];
  onSelectSuggestion?: (suggestionText: string) => void;
}

const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);

export const ChatInputBar: React.FC<ChatInputBarProps> = ({
  value,
  onChangeText,
  onSend,
  isStreaming = false,
  onCancelStream,
  disabled = false,
  inputRef,
  suggestions = [],
  onSelectSuggestion,
}) => {
  const { colors, isDark } = useTheme();
  const [isFocused, setIsFocused] = useState(false);

  // Reanimated shared values for high productivity & micro-interactions
  const focusAnim = useSharedValue(0);
  const sendScale = useSharedValue(1);

  const canSend = value.trim().length > 0 && !disabled;

  useEffect(() => {
    focusAnim.value = withTiming(isFocused ? 1 : 0, { duration: 200 });
  }, [isFocused]);

  const handleSuggestionPress = async (prompt: string) => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {
      // Haptics fallback
    }
    const cleanPrompt = prompt
      .replace(/^[\u1F300-\u1F9FF\u2600-\u26FF\u2700-\u27BF\u1F600-\u1F64F\-•\s]+/, '')
      .trim();

    if (onSelectSuggestion) {
      onSelectSuggestion(cleanPrompt || prompt);
    } else {
      onSend(cleanPrompt || prompt);
    }
  };

  const handleSendPress = async () => {
    if (!canSend && !isStreaming) return;

    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {
      // Haptics fallback
    }

    sendScale.value = withSequenceSpring();
    if (isStreaming && onCancelStream) {
      onCancelStream();
    } else {
      onSend();
    }
  };

  const withSequenceSpring = () => {
    sendScale.value = withTiming(0.88, { duration: 80 }, () => {
      sendScale.value = withSpring(1, { damping: 10, stiffness: 200 });
    });
    return sendScale.value;
  };

  const handleClearText = async () => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {
      // fallback
    }
    onChangeText('');
  };

  // Reanimated dynamic styles
  const inputContainerAnimatedStyle = useAnimatedStyle(() => {
    return {
      borderColor: focusAnim.value === 1 ? colors.primary : isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.1)',
      borderWidth: 1.5,
    };
  });

  const sendBtnAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: sendScale.value }],
    };
  });

  return (
    <View style={styles.outerContainer}>
      {/* 1. Dynamic LLM Suggestions Chips Carousel */}
      {!isStreaming && suggestions.length > 0 && (
        <View style={styles.suggestionsContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.suggestionsScroll}
            keyboardShouldPersistTaps="handled"
          >
            {suggestions.map((prompt, idx) => (
              <TouchableOpacity
                key={idx}
                style={[
                  styles.promptPill,
                  {
                    backgroundColor: isDark ? 'rgba(30, 41, 59, 0.95)' : '#EEF2FF',
                    borderColor: isDark ? 'rgba(129, 140, 248, 0.3)' : 'rgba(99, 102, 241, 0.22)',
                  },
                ]}
                onPress={() => handleSuggestionPress(prompt)}
                activeOpacity={0.75}
              >
                <Sparkles size={11} color={colors.primary} style={{ marginRight: 5 }} />
                <Text style={[styles.promptPillText, { color: isDark ? '#E0E7FF' : colors.primary }]}>
                  {prompt}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* 2. Main High-Productivity Reanimated Input Card */}
      <Animated.View
        style={[
          styles.inputCard,
          {
            backgroundColor: colors.chatInputBg,
            shadowColor: isFocused ? colors.primary : isDark ? '#000000' : 'rgba(0, 0, 0, 0.05)',
          },
          inputContainerAnimatedStyle,
        ]}
      >
        {/* Multiline Text Input */}
        <TextInput
          ref={inputRef}
          style={[
            styles.textInput,
            {
              color: colors.text,
            },
          ]}
          placeholder="Ask Spendly AI anything..."
          placeholderTextColor={colors.textSecondary}
          value={value}
          onChangeText={onChangeText}
          multiline={true}
          maxLength={1200}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          editable={!disabled && !isStreaming}
        />

        {/* Clear input text shortcut button */}
        {value.length > 0 && !isStreaming && (
          <TouchableOpacity
            style={styles.clearBtn}
            onPress={handleClearText}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <X size={15} color={colors.textSecondary} />
          </TouchableOpacity>
        )}

        {/* Animated Send / Stop Button */}
        {isStreaming ? (
          <AnimatedTouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.danger }, sendBtnAnimatedStyle]}
            onPress={handleSendPress}
            activeOpacity={0.8}
          >
            <Square size={14} color="#FFFFFF" fill="#FFFFFF" />
          </AnimatedTouchableOpacity>
        ) : (
          <AnimatedTouchableOpacity
            style={[
              styles.actionBtn,
              {
                backgroundColor: canSend ? colors.primary : isDark ? '#1E293B' : '#E2E8F0',
                shadowColor: canSend ? colors.primary : 'transparent',
              },
              sendBtnAnimatedStyle,
            ]}
            onPress={handleSendPress}
            disabled={!canSend}
            activeOpacity={0.8}
          >
            <Send size={16} color={canSend ? '#FFFFFF' : colors.textSecondary} />
          </AnimatedTouchableOpacity>
        )}
      </Animated.View>

      {/* 3. Subtle Character Count Meter when typing long prompts */}
      {value.length > 60 && (
        <View style={styles.charCountWrapper}>
          <Text style={[styles.charCountText, { color: colors.textSecondary }]}>
            {value.length}/1200
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  outerContainer: {
    paddingHorizontal: 12,
    paddingTop: 2,
    paddingBottom: 0,
  },
  suggestionsContainer: {
    marginBottom: 6,
  },
  suggestionsScroll: {
    paddingHorizontal: 2,
    gap: 6,
  },
  promptPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  promptPillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  inputCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 24,
    paddingLeft: 14,
    paddingRight: 6,
    paddingVertical: Platform.OS === 'ios' ? 6 : 3,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  textInput: {
    flex: 1,
    fontSize: 14.5,
    maxHeight: 90,
    minHeight: 38,
    paddingVertical: 4,
    paddingRight: 6,
    textAlignVertical: 'center',
  },
  clearBtn: {
    padding: 6,
    marginRight: 4,
  },
  actionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 2,
  },
  charCountWrapper: {
    alignItems: 'flex-end',
    marginTop: 2,
    marginRight: 8,
  },
  charCountText: {
    fontSize: 10,
    fontWeight: '500',
  },
});
