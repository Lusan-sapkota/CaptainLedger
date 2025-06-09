import React, { useState, useEffect } from 'react';
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
  Alert,
  RefreshControl 
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { FontAwesome } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '@/components/ThemeProvider';
import { getUserProfile, updateProfile } from '@/services/api';
import { AppColors } from './(tabs)/_layout';
import ThemedConfirmDialog from '@/components/ThemedConfirmDialog';

const getImageUrl = (imagePath: string): string => {
  // If it's already a full URL, use it as is
  if (imagePath.startsWith('http')) {
    return imagePath;
  }
  
  // Your development machine's IP - should match the one in api.ts
  const DEV_MACHINE_IP = '192.168.18.2';
  
  // For relative paths, add the appropriate base URL
  if (Platform.OS === 'ios') {
    return `http://${DEV_MACHINE_IP}:5000${imagePath}`;
  } else if (Platform.OS === 'android') {
    return `http://${DEV_MACHINE_IP}:5000${imagePath}`;
  } else {
    return `http://localhost:5000${imagePath}`;
  }
};

export default function EditProfileScreen() {
  const { isDarkMode, colors } = useTheme();
  const router = useRouter();
  
  // State for user data
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [image, setImage] = useState<string | null>(null);
  
  // Form fields
  const [fullName, setFullName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [country, setCountry] = useState('');
  const [gender, setGender] = useState('');
  
  // Original values to track changes
  const [originalValues, setOriginalValues] = useState({
    fullName: '',
    displayName: '',
    bio: '',
    phoneNumber: '',
    country: '',
    gender: '',
    image: ''
  });
  
  // Confirmation dialog state
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [changedFields, setChangedFields] = useState<{[key: string]: {old: string, new: string}}>({}); 

  useEffect(() => {
    loadUserProfile();
  }, []);

  const loadUserProfile = async () => {
    try {
      setLoading(true);
      
      // Try API call first
      try {
        const response = await getUserProfile();
        const userData = response.data;
        
        // Get additional user data from local storage for any missing fields
        const localFullName = await AsyncStorage.getItem('user_fullName');
        const localDisplayName = await AsyncStorage.getItem('user_displayName');
        const localCountry = await AsyncStorage.getItem('user_country');
        const localBio = await AsyncStorage.getItem('user_bio');
        const localPhone = await AsyncStorage.getItem('user_phone');
        const localAvatar = await AsyncStorage.getItem('user_avatar');
        const localGender = await AsyncStorage.getItem('user_gender');
        
        // Set form fields with backend data or local storage data
        const currentFullName = userData.full_name || userData.fullName || localFullName || '';
        const currentDisplayName = userData.displayName || localDisplayName || '';
        const currentBio = userData.bio || localBio || '';
        const currentPhone = userData.phone_number || localPhone || '';
        const currentCountry = userData.country || localCountry || '';
        const currentGender = userData.gender || localGender || '';
        
        // For profile image, use getImageUrl helper function for relative paths
        const currentImage = userData.profile_picture || localAvatar || '';
        const processedImageUrl = currentImage ? getImageUrl(currentImage) : '';
        
        // Set form state
        setFullName(currentFullName);
        setDisplayName(currentDisplayName);
        setBio(currentBio);
        setPhoneNumber(currentPhone);
        setCountry(currentCountry);
        setGender(currentGender);
        setImage(processedImageUrl);
        
        // Also store original values to track changes
        setOriginalValues({
          fullName: currentFullName,
          displayName: currentDisplayName,
          bio: currentBio,
          phoneNumber: currentPhone,
          country: currentCountry,
          gender: currentGender,
          image: currentImage // Store original path for comparison
        });
        
      } catch (error) {
        console.error('Error loading profile from API:', error);
        
        // Fallback to AsyncStorage
        const localFullName = await AsyncStorage.getItem('user_fullName');
        const localDisplayName = await AsyncStorage.getItem('user_displayName');
        const localCountry = await AsyncStorage.getItem('user_country');
        const localBio = await AsyncStorage.getItem('user_bio');
        const localPhone = await AsyncStorage.getItem('user_phone');
        const localAvatar = await AsyncStorage.getItem('user_avatar');
        const localGender = await AsyncStorage.getItem('user_gender');
        
        // Set form state from local storage
        setFullName(localFullName || '');
        setDisplayName(localDisplayName || '');
        setBio(localBio || '');
        setPhoneNumber(localPhone || '');
        setCountry(localCountry || '');
        setGender(localGender || '');
        setImage(localAvatar || '');
        
        // Store original values
        setOriginalValues({
          fullName: localFullName || '',
          displayName: localDisplayName || '',
          bio: localBio || '',
          phoneNumber: localPhone || '',
          country: localCountry || '',
          gender: localGender || '',
          image: localAvatar || ''
        });
      }
    } catch (error) {
      console.error('Error in loadUserProfile:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };
  
  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    loadUserProfile();
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

  const identifyChanges = () => {
    const changes: {[key: string]: {old: string, new: string}} = {};
    
    if (fullName !== originalValues.fullName) {
      changes.fullName = { old: originalValues.fullName, new: fullName };
    }
    
    if (displayName !== originalValues.displayName) {
      changes.displayName = { old: originalValues.displayName, new: displayName };
    }
    
    if (bio !== originalValues.bio) {
      changes.bio = { old: originalValues.bio, new: bio };
    }
    
    if (phoneNumber !== originalValues.phoneNumber) {
      changes.phoneNumber = { old: originalValues.phoneNumber, new: phoneNumber };
    }
    
    if (country !== originalValues.country) {
      changes.country = { old: originalValues.country, new: country };
    }
    
    if (gender !== originalValues.gender) {
      changes.gender = { old: originalValues.gender, new: gender };
    }
    
    if (image !== originalValues.image) {
      changes.image = { old: 'Previous Image', new: 'New Image' };
    }
    
    return changes;
  };

  const handleSaveChanges = () => {
    const changes = identifyChanges();
    
    if (Object.keys(changes).length === 0) {
      Alert.alert('No Changes', 'You haven\'t made any changes to your profile.');
      return;
    }
    
    // Set the changes for the confirmation dialog
    setChangedFields(changes);
    setShowConfirmDialog(true);
  };
  
  const handleConfirmChanges = async () => {
    try {
      setSaving(true);
      
      // Create payload for API
      const profileData = {
        full_name: fullName,
        bio: bio,
        phone_number: phoneNumber,
        country: country,
        gender: gender
      };
      
      // Upload image if changed
      let profilePictureUrl = image;
      if (image !== originalValues.image) {
        // Call image upload API here (not implemented in the code snippet)
        // profilePictureUrl = await uploadProfilePicture(image);
      }
      
      // Update profile via API
      const response = await updateProfile(profileData);
      
      // Update AsyncStorage with new values
      await AsyncStorage.setItem('user_fullName', fullName);
      await AsyncStorage.setItem('user_displayName', displayName);
      await AsyncStorage.setItem('user_bio', bio);
      await AsyncStorage.setItem('user_phone', phoneNumber);
      await AsyncStorage.setItem('user_country', country);
      await AsyncStorage.setItem('user_gender', gender);
      if (profilePictureUrl) {
        await AsyncStorage.setItem('user_avatar', profilePictureUrl);
      }
      
      // Show success message
      Alert.alert('Success', 'Your profile has been updated successfully!', [
        { text: 'OK', onPress: () => router.back() }
      ]);
      
    } catch (error) {
      console.error('Error updating profile:', error);
      Alert.alert('Update Failed', 'An error occurred while updating your profile. Please try again.');
    } finally {
      setSaving(false);
      setShowConfirmDialog(false);
    }
  };

  return (
    <>
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
            <Text style={[styles.headerTitle, { color: colors.text }]}>Edit Profile</Text>
          </View>
          <TouchableOpacity
            style={styles.saveButton}
            onPress={handleSaveChanges}
            disabled={loading || saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.saveButtonText}>Save</Text>
            )}
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={AppColors.primary} />
          </View>
        ) : (
          <>
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
            </View>

            <View style={styles.formSection}>
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.text }]}>Full Name</Text>
                <TextInput
                  style={[styles.input, { 
                    backgroundColor: isDarkMode ? colors.inputBackground : '#F8F9FA', 
                    color: colors.text,
                    borderColor: isDarkMode ? 'rgba(255,255,255,0.15)' : '#DFE2E6'
                  }]}
                  placeholder="Enter your full name"
                  placeholderTextColor={colors.subText}
                  value={fullName}
                  onChangeText={setFullName}
                />
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
                <Text style={[styles.inputLabel, { color: colors.text }]}>Phone Number</Text>
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
                <Text style={[styles.inputLabel, { color: colors.text }]}>Country</Text>
                <TextInput
                  style={[styles.input, { 
                    backgroundColor: isDarkMode ? colors.inputBackground : '#F8F9FA', 
                    color: colors.text,
                    borderColor: isDarkMode ? 'rgba(255,255,255,0.15)' : '#DFE2E6'
                  }]}
                  placeholder="Your country"
                  placeholderTextColor={colors.subText}
                  value={country}
                  onChangeText={setCountry}
                />
              </View>
              
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.text }]}>Gender</Text>
                <TextInput
                  style={[styles.input, { 
                    backgroundColor: isDarkMode ? colors.inputBackground : '#F8F9FA', 
                    color: colors.text,
                    borderColor: isDarkMode ? 'rgba(255,255,255,0.15)' : '#DFE2E6'
                  }]}
                  placeholder="Your gender"
                  placeholderTextColor={colors.subText}
                  value={gender}
                  onChangeText={setGender}
                />
              </View>
              
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.text }]}>Bio</Text>
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
          </>
        )}
      </ScrollView>
      
      {/* Confirmation Dialog */}
      <ThemedConfirmDialog
        visible={showConfirmDialog}
        title="Save Changes"
        message={
          <View>
            <Text style={{color: colors.text, marginBottom: 10}}>
              Are you sure you want to save the following changes?
            </Text>
            {Object.entries(changedFields).map(([field, values]) => (
              <Text key={field} style={{color: colors.text, marginBottom: 5}}>
                • <Text style={{fontWeight: 'bold'}}>{field}:</Text> {values.old ? `"${values.old}"` : "(not set)"} → "{values.new}"
              </Text>
            ))}
          </View>
        }
        onConfirm={handleConfirmChanges}
        onCancel={() => setShowConfirmDialog(false)}
        actionType="positive"
        confirmButtonText="Yes, Save Changes"
        isDarkMode={isDarkMode}
        colors={colors}
      />
    </>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 30,
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
  saveButton: {
    padding: 10,
  },
  saveButtonText: {
    color: AppColors.primary,
    fontSize: 16,
    fontWeight: '500',
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
  formSection: {
    marginBottom: 30,
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
});