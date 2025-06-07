import React, { useState, useRef } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  Image, 
  ActivityIndicator, 
  ScrollView, 
  Platform,
  RefreshControl 
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { FontAwesome } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '@/components/ThemeProvider';
import { AppColors } from './(tabs)/_layout';

export default function ProfileSetupScreen() {
  const { isDarkMode, colors } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams();
  const { email } = params;
  
  const [loading, setLoading] = useState(false);
  const [image, setImage] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    // Reset the form state
    setImage(null);
    setDisplayName('');
    setBio('');
    setPhoneNumber('');
    setTimeout(() => {
      setRefreshing(false);
    }, 1000);
  }, []);

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled) {
      setImage(result.assets[0].uri);
    }
  };

  const takePhoto = async () => {
    // Request camera permissions
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    
    if (status !== 'granted') {
      alert('Sorry, we need camera permissions to make this work!');
      return;
    }

    let result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled) {
      setImage(result.assets[0].uri);
    }
  };

  const handleSaveProfile = async () => {
    setLoading(true);

    try {
      // Here you'd upload the image and update the user profile
      
      // For now, we'll just simulate the API call
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Store user details locally
      if (displayName) {
        await AsyncStorage.setItem('user_displayName', displayName);
      }
      
      if (image) {
        await AsyncStorage.setItem('user_avatar', image);
      }
      
      if (bio) {
        await AsyncStorage.setItem('user_bio', bio);
      }
      
      if (phoneNumber) {
        await AsyncStorage.setItem('user_phone', phoneNumber);
      }
      
      await AsyncStorage.setItem('profile_setup_completed', 'true');
      
      // Navigate to the main app
      router.replace('/');
    } catch (err) {
      console.error('Profile setup error:', err);
      alert('Failed to save profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  const handleSkip = async () => {
    await AsyncStorage.setItem('profile_setup_completed', 'true');
    router.replace('/');
  };

  return (
    <ScrollView 
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.contentContainer}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <StatusBar style={isDarkMode ? 'light' : 'dark'} />

      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <FontAwesome name="arrow-left" size={20} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Complete Your Profile</Text>
        </View>
        <TouchableOpacity
          style={styles.skipButton}
          onPress={handleSkip}
        >
          <Text style={styles.skipButtonText}>Skip</Text>
        </TouchableOpacity>
      </View>

      <Text style={[styles.subtitle, { color: colors.subText }]}>
        Add a photo and some details to personalize your account
      </Text>

      <View style={styles.avatarContainer}>
        <TouchableOpacity style={styles.avatarWrapper} onPress={pickImage}>
          {image ? (
            <Image source={{ uri: image }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatarPlaceholder, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.1)' : '#F0F0F0' }]}>
              <FontAwesome name="user" size={40} color={isDarkMode ? 'rgba(255,255,255,0.5)' : '#AAAAAA'} />
            </View>
          )}
          <View style={styles.editBadge}>
            <FontAwesome name="camera" size={15} color="white" />
          </View>
        </TouchableOpacity>
        
        <View style={styles.photoButtonsContainer}>
          <TouchableOpacity 
            style={[styles.photoButton, { backgroundColor: colors.cardBackground }]}
            onPress={pickImage}
          >
            <FontAwesome name="photo" size={20} color={AppColors.primary} />
            <Text style={[styles.photoButtonText, { color: colors.text }]}>Gallery</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.photoButton, { backgroundColor: colors.cardBackground }]}
            onPress={takePhoto}
          >
            <FontAwesome name="camera" size={20} color={AppColors.primary} />
            <Text style={[styles.photoButtonText, { color: colors.text }]}>Camera</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.formSection}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Account Information</Text>
        
        <View style={styles.inputGroup}>
          <Text style={[styles.inputLabel, { color: colors.text }]}>Email</Text>
          <View style={[styles.disabledInput, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : '#F5F5F5' }]}>
            <Text style={[styles.disabledInputText, { color: colors.subText }]}>
              {email || 'user@example.com'}
            </Text>
          </View>
        </View>
        
        <View style={styles.inputGroup}>
          <Text style={[styles.inputLabel, { color: colors.text }]}>Display Name</Text>
          <TextInput
            style={[styles.input, { 
              backgroundColor: isDarkMode ? colors.inputBackground : '#F8F9FA', 
              color: colors.text,
              borderColor: isDarkMode ? 'rgba(255,255,255,0.15)' : '#DFE2E6'
            }]}
            placeholder="How should we call you?"
            placeholderTextColor={colors.subText}
            value={displayName}
            onChangeText={setDisplayName}
          />
        </View>
        
        <View style={styles.inputGroup}>
          <Text style={[styles.inputLabel, { color: colors.text }]}>Phone Number (Optional)</Text>
          <TextInput
            style={[styles.input, { 
              backgroundColor: isDarkMode ? colors.inputBackground : '#F8F9FA', 
              color: colors.text,
              borderColor: isDarkMode ? 'rgba(255,255,255,0.15)' : '#DFE2E6'
            }]}
            placeholder="Enter your phone number"
            placeholderTextColor={colors.subText}
            value={phoneNumber}
            onChangeText={setPhoneNumber}
            keyboardType="phone-pad"
          />
        </View>
        
        <View style={styles.inputGroup}>
          <Text style={[styles.inputLabel, { color: colors.text }]}>Bio (Optional)</Text>
          <TextInput
            style={[styles.textArea, { 
              backgroundColor: isDarkMode ? colors.inputBackground : '#F8F9FA', 
              color: colors.text,
              borderColor: isDarkMode ? 'rgba(255,255,255,0.15)' : '#DFE2E6'
            }]}
            placeholder="Tell us a little about yourself..."
            placeholderTextColor={colors.subText}
            value={bio}
            onChangeText={setBio}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>
      </View>
      
      <TouchableOpacity
        style={[styles.button, { opacity: loading ? 0.7 : 1 }]}
        onPress={handleSaveProfile}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <Text style={styles.buttonText}>Save Profile</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    justifyContent: 'space-between',
  },
  backButton: {
    padding: 10,
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  skipButton: {
    padding: 10,
  },
  skipButtonText: {
    color: AppColors.primary,
    fontSize: 16,
    fontWeight: '500',
  },
  subtitle: {
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 30,
  },
  avatarContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  avatarWrapper: {
    position: 'relative',
    marginBottom: 20,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  avatarPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  editBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: AppColors.primary,
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'white',
  },
  photoButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  photoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 20,
    marginHorizontal: 8,
  },
  photoButtonText: {
    marginLeft: 6,
    fontWeight: '500',
  },
  formSection: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 15,
    fontWeight: '500',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    minHeight: 100,
  },
  disabledInput: {
    borderRadius: 8,
    padding: 12,
  },
  disabledInputText: {
    fontSize: 16,
  },
  button: {
    backgroundColor: AppColors.primary,
    borderRadius: 8,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 20,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});