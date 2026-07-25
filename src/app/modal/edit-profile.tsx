import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  Image,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useNavigation } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useAuthStore } from '../../store/authStore';
import { useTheme } from '../../hooks/useTheme';
import { Header } from '../../components/Header';
import { Camera, Check, ArrowLeft, Image as ImageIcon, Sparkles } from 'lucide-react-native';
import { storageService } from '../../services/storage.service';

const COLOR_PRESETS = [
  { name: 'Indigo Glow', bg: '6366f1', text: 'ffffff' },
  { name: 'Emerald Mint', bg: '10b981', text: 'ffffff' },
  { name: 'Sunset Amber', bg: 'f59e0b', text: 'ffffff' },
  { name: 'Royal Violet', bg: '8b5cf6', text: 'ffffff' },
  { name: 'Rose Quartz', bg: 'f43f5e', text: 'ffffff' },
  { name: 'Ocean Cyan', bg: '06b6d4', text: 'ffffff' },
];

export default function EditProfileScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { colors, isDark } = useTheme();
  
  const user = useAuthStore((state) => state.user);
  const updateProfile = useAuthStore((state) => state.updateProfile);

  const initialUsername = user?.user_metadata?.username || user?.email?.split('@')[0] || '';
  const initialAvatar = user?.user_metadata?.avatar_url || '';

  const [username, setUsername] = useState(initialUsername);
  const [email, setEmail] = useState(user?.email || '');
  const [bio, setBio] = useState(user?.user_metadata?.bio || 'Smart Spender 🚀');
  const [avatarUrl, setAvatarUrl] = useState(initialAvatar);
  const [isSaving, setIsSaving] = useState(false);
  const isSavingRef = useRef(false);
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);

  useEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);

  const requestPermissionAndPickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'We need access to your gallery to upload a profile picture.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setAvatarUrl(result.assets[0].uri);
        setSelectedPreset(null);
      }
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to pick image.');
    }
  };

  const selectPreset = (preset: typeof COLOR_PRESETS[0]) => {
    const seed = username.trim() || 'User';
    const generatedUrl = `https://api.dicebear.com/7.x/initials/png?seed=${encodeURIComponent(seed)}&backgroundColor=${preset.bg}&textColor=${preset.text}`;
    setAvatarUrl(generatedUrl);
    setSelectedPreset(preset.name);
  };

  const handleSave = async () => {
    if (isSaving || isSavingRef.current) return;

    if (!username.trim()) {
      Alert.alert('Validation Error', 'Username cannot be empty.');
      return;
    }
    
    try {
      isSavingRef.current = true;
      setIsSaving(true);
      
      let finalAvatarUrl = avatarUrl;
      // If user selected a custom local file, upload it to Supabase storage first
      if (avatarUrl && !avatarUrl.startsWith('http') && !avatarUrl.startsWith('https')) {
        if (user?.id) {
          try {
            finalAvatarUrl = await storageService.uploadAvatar(avatarUrl, user.id);
          } catch (uploadError) {
            console.error('Failed to upload avatar to Supabase:', uploadError);
            Alert.alert('Upload Error', 'Failed to upload profile picture to Supabase. Please try again.');
            setIsSaving(false);
            isSavingRef.current = false;
            return;
          }
        }
      }

      await updateProfile(username.trim(), finalAvatarUrl);
      setIsSaving(false);
      isSavingRef.current = false;
      Alert.alert('Success', 'Profile updated successfully!', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (err) {
      setIsSaving(false);
      isSavingRef.current = false;
      console.error(err);
      Alert.alert('Error', 'Failed to update profile. Please try again.');
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Custom Header */}
      <Header
        title="EDIT PROFILE"
        showBackButton={true}
        onBackPress={() => router.back()}
        rightIcon="check"
        onRightPress={handleSave}
      />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Profile Picture Header Section */}
        <View style={styles.avatarSection}>
          <View style={[styles.avatarFrame, { borderColor: colors.primary }]}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatarPlaceholder, { backgroundColor: colors.primaryLight }]}>
                <Text style={[styles.avatarInitial, { color: colors.primary }]}>
                  {username ? username[0].toUpperCase() : 'U'}
                </Text>
              </View>
            )}
            
            <TouchableOpacity
              style={[styles.cameraBadge, { backgroundColor: colors.primary }]}
              onPress={requestPermissionAndPickImage}
            >
              <Camera size={14} color="#FFF" />
            </TouchableOpacity>
          </View>
          
          <TouchableOpacity onPress={requestPermissionAndPickImage} style={styles.uploadLinkBtn}>
            <ImageIcon size={14} color={colors.primary} style={{ marginRight: 6 }} />
            <Text style={[styles.uploadLink, { color: colors.primary }]}>Upload Custom Photo</Text>
          </TouchableOpacity>
        </View>

        {/* Curated Presets List */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
            Or pick a vibrant theme preset
          </Text>
          
          <View style={styles.presetGrid}>
            {COLOR_PRESETS.map((preset) => (
              <TouchableOpacity
                key={preset.name}
                style={[
                  styles.presetCircle,
                  { backgroundColor: `#${preset.bg}` },
                  selectedPreset === preset.name && styles.selectedPresetBorder,
                ]}
                onPress={() => selectPreset(preset)}
              >
                {selectedPreset === preset.name && (
                  <Check size={16} color="#FFF" />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Input Fields */}
        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Full Name / Nickname</Text>
            <TextInput
              value={username}
              onChangeText={setUsername}
              placeholder="e.g. John Doe"
              placeholderTextColor={colors.textSecondary}
              style={[
                styles.input,
                {
                  color: colors.text,
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                },
              ]}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Email Address</Text>
            <TextInput
              value={email}
              editable={false}
              placeholder="e.g. email@address.com"
              placeholderTextColor={colors.textSecondary}
              style={[
                styles.input,
                {
                  color: colors.textSecondary,
                  backgroundColor: isDark ? '#1E293B' : '#F3F4F6',
                  borderColor: colors.border,
                },
              ]}
            />
            <Text style={[styles.tip, { color: colors.textSecondary }]}>
              Email is managed by Supabase and cannot be changed here.
            </Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Personal Bio</Text>
            <TextInput
              value={bio}
              onChangeText={setBio}
              placeholder="Add details about yourself..."
              placeholderTextColor={colors.textSecondary}
              style={[
                styles.input,
                styles.textArea,
                {
                  color: colors.text,
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                },
              ]}
              multiline
              numberOfLines={3}
            />
          </View>
        </View>

        <TouchableOpacity
          style={[styles.saveBtn, { backgroundColor: colors.primary }]}
          onPress={handleSave}
          disabled={isSaving}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <>
              <Sparkles size={16} color="#FFF" style={{ marginRight: 8 }} />
              <Text style={styles.saveBtnTextContent}>Save Changes</Text>
            </>
          )}
        </TouchableOpacity>
        
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    marginTop: Platform.OS === 'ios' ? 44 : 0,
  },
  backBtn: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  saveBtnText: {
    padding: 8,
  },
  saveText: {
    fontSize: 14,
    fontWeight: '800',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  avatarSection: {
    alignItems: 'center',
    marginVertical: 24,
  },
  avatarFrame: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  avatar: {
    width: '100%',
    height: '100%',
    borderRadius: 48,
  },
  avatarPlaceholder: {
    width: '100%',
    height: '100%',
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 36,
    fontWeight: '800',
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    borderColor: '#FFF',
  },
  uploadLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    padding: 6,
  },
  uploadLink: {
    fontSize: 13,
    fontWeight: '700',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 12,
    textAlign: 'center',
  },
  presetGrid: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    flexWrap: 'wrap',
  },
  presetCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedPresetBorder: {
    borderWidth: 2.5,
    borderColor: '#FFF',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  form: {
    gap: 16,
    marginBottom: 28,
  },
  inputGroup: {
    gap: 8,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingLeft: 4,
  },
  input: {
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 16,
    fontSize: 14,
    fontWeight: '600',
  },
  textArea: {
    height: 80,
    paddingTop: 12,
    textAlignVertical: 'top',
  },
  tip: {
    fontSize: 10.5,
    lineHeight: 14,
    paddingLeft: 4,
  },
  saveBtn: {
    height: 50,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#6366F1',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  saveBtnTextContent: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '800',
  },
});
