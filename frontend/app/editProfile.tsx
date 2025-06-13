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
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '@/components/ThemeProvider';
import { getUserProfile, updateProfile, uploadProfilePicture } from '@/services/api';
import { AppColors } from './(tabs)/_layout';
import ConfirmationModal from '@/components/ConfirmationModal';
import AlertModal from '@/components/AlertModal';

const getImageUrl = (imagePath: string): string => {
  // If it's already a full URL or data URL, use it as is
  if (imagePath.startsWith('http') || imagePath.startsWith('data:')) {
    return imagePath;
  }
  
  // Use a consistent IP that matches your network setup
  // This should match the server where your backend is actually running
  const DEV_MACHINE_IP = '192.168.18.2'; // Your actual machine IP
  
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
  
  // State for confirmation modal
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingChanges, setPendingChanges] = useState<{[key: string]: {old: string, new: string}}>({});
  
  // State for alert modals
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [alertConfig, setAlertConfig] = useState({
    title: '',
    message: '',
    type: 'info' as 'info' | 'success' | 'warning' | 'error',
    buttonText: 'OK',
    onClose: () => {}
  });
  
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

  useEffect(() => {
    loadUserProfile();
  }, []);

  // Add a focus effect to reload data when the screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      console.log('EditProfile screen focused, reloading data...');
      loadUserProfile();
    }, [])
  );

  const showAlert = (title: string, message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info', onClose?: () => void) => {
    setAlertConfig({
      title,
      message,
      type,
      buttonText: 'OK',
      onClose: onClose || (() => setShowAlertModal(false))
    });
    setShowAlertModal(true);
  };

  const loadUserProfile = async () => {
    console.log('=== LOADING USER PROFILE ===');
    try {
      setLoading(true);
      
      // Always try API call first for fresh data
      try {
        console.log('Attempting to fetch user profile from API...');
        const response = await getUserProfile();
        console.log('API response status:', response.status);
        console.log('API response data:', response.data);
        
        if (response.status === 200 && response.data) {
          const userData = response.data;
          
          // Use backend data as the primary source
          const currentFullName = userData.full_name || userData.fullName || '';
          const currentBio = userData.bio || '';
          const currentPhone = userData.phone_number || '';
          const currentCountry = userData.country || '';
          const currentGender = userData.gender || '';
          
          // For displayName, check local storage as it's not stored in backend
          const localDisplayName = await AsyncStorage.getItem('user_displayName');
          const currentDisplayName = localDisplayName || currentFullName || '';
          
          // Handle profile image
          const currentImage = userData.profile_picture || '';
          let processedImageUrl = '';
          
          if (currentImage) {
            if (currentImage.startsWith('data:') || currentImage.startsWith('http')) {
              processedImageUrl = currentImage;
            } else {
              processedImageUrl = getImageUrl(currentImage);
            }
          }
          
          console.log('Using backend data as primary source:', {
            currentFullName, currentDisplayName, currentBio, currentPhone,
            currentCountry, currentGender, 
            originalImagePath: currentImage,
            processedImageUrl
          });
          
          // Set form state with backend data
          setFullName(currentFullName);
          setDisplayName(currentDisplayName);
          setBio(currentBio);
          setPhoneNumber(currentPhone);
          setCountry(currentCountry);
          setGender(currentGender);
          setImage(processedImageUrl);
          
          // Update local storage with fresh backend data to keep them in sync
          await AsyncStorage.multiSet([
            ['user_fullName', currentFullName],
            ['user_displayName', currentDisplayName], // Keep local display name
            ['user_bio', currentBio],
            ['user_phone', currentPhone],
            ['user_country', currentCountry],
            ['user_gender', currentGender],
            ['user_avatar', currentImage] // Store original path, not processed URL
          ]);
          
          console.log('Updated local storage with backend data for sync');
          
          // Store original values for change tracking
          setOriginalValues({
            fullName: currentFullName,
            displayName: currentDisplayName,
            bio: currentBio,
            phoneNumber: currentPhone,
            country: currentCountry,
            gender: currentGender,
            image: currentImage
          });
          
          console.log('Set original values from backend:', {
            fullName: currentFullName,
            displayName: currentDisplayName,
            bio: currentBio,
            phoneNumber: currentPhone,
            country: currentCountry,
            gender: currentGender,
            image: currentImage
          });
          
        } else {
          throw new Error('Invalid API response');
        }
        
      } catch (error) {
        console.error('Error loading profile from API:', error);
        
        // Only use local storage as fallback if API fails
        console.log('API failed, falling back to AsyncStorage...');
        const localFullName = await AsyncStorage.getItem('user_fullName');
        const localDisplayName = await AsyncStorage.getItem('user_displayName');
        const localCountry = await AsyncStorage.getItem('user_country');
        const localBio = await AsyncStorage.getItem('user_bio');
        const localPhone = await AsyncStorage.getItem('user_phone');
        const localAvatar = await AsyncStorage.getItem('user_avatar');
        const localGender = await AsyncStorage.getItem('user_gender');
        
        console.log('AsyncStorage fallback data:', {
          localFullName, localDisplayName, localCountry, localBio,
          localPhone, localAvatar, localGender
        });
        
        // Set form state from local storage
        setFullName(localFullName || '');
        setDisplayName(localDisplayName || '');
        setBio(localBio || '');
        setPhoneNumber(localPhone || '');
        setCountry(localCountry || '');
        setGender(localGender || '');
        
        // Handle image URL from local storage
        let processedImageUrl = '';
        if (localAvatar) {
          if (localAvatar.startsWith('data:') || localAvatar.startsWith('http')) {
            processedImageUrl = localAvatar;
          } else {
            processedImageUrl = getImageUrl(localAvatar);
          }
        }
        setImage(processedImageUrl);
        
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
        
        console.log('Set fallback original values:', {
          fullName: localFullName || '',
          displayName: localDisplayName || '',
          bio: localBio || '',
          phoneNumber: localPhone || '',
          country: localCountry || '',
          gender: localGender || '',
          image: localAvatar || ''
        });
        
        // Show a warning that data might be outdated
        showAlert(
          'Offline Mode',
          'Could not sync with server. You are viewing cached data. Changes will be synced when connection is restored.',
          'warning'
        );
      }
    } catch (error) {
      console.error('Error in loadUserProfile:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
      console.log('=== USER PROFILE LOADING COMPLETED ===');
    }
  };
  
  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    loadUserProfile();
  }, []);

  const pickImage = async () => {
    // Request permission to access media library
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (status !== 'granted') {
      showAlert(
        'Permission Required',
        'Sorry, we need camera roll permissions to make this work!',
        'warning'
      );
      return;
    }

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
    
    console.log('=== CHANGE DETECTION DEBUG ===');
    console.log('Current values:', {
      fullName, displayName, bio, phoneNumber, country, gender, image
    });
    console.log('Original values:', originalValues);
    
    if (fullName !== originalValues.fullName) {
      changes.fullName = { old: originalValues.fullName, new: fullName };
      console.log('Full name changed:', changes.fullName);
    }
    
    if (displayName !== originalValues.displayName) {
      changes.displayName = { old: originalValues.displayName, new: displayName };
      console.log('Display name changed:', changes.displayName);
    }
    
    if (bio !== originalValues.bio) {
      changes.bio = { old: originalValues.bio, new: bio };
      console.log('Bio changed:', changes.bio);
    }
    
    if (phoneNumber !== originalValues.phoneNumber) {
      changes.phoneNumber = { old: originalValues.phoneNumber, new: phoneNumber };
      console.log('Phone number changed:', changes.phoneNumber);
    }
    
    if (country !== originalValues.country) {
      changes.country = { old: originalValues.country, new: country };
      console.log('Country changed:', changes.country);
    }
    
    if (gender !== originalValues.gender) {
      changes.gender = { old: originalValues.gender, new: gender };
      console.log('Gender changed:', changes.gender);
    }
    
    // Fixed image comparison logic to handle data URLs and server URLs properly
    let originalImageUrl = '';
    let currentImageUrl = image || '';
    
    if (originalValues.image) {
      // If original image is already a data URL or http URL, use as is
      if (originalValues.image.startsWith('data:') || originalValues.image.startsWith('http')) {
        originalImageUrl = originalValues.image;
      } else {
        // It's a relative path, convert to full URL
        originalImageUrl = getImageUrl(originalValues.image);
      }
    }
    
    console.log('Image comparison:', {
      original: originalImageUrl,
      current: currentImageUrl,
      originalType: originalValues.image?.startsWith('data:') ? 'data URL' : originalValues.image?.startsWith('http') ? 'http URL' : 'relative path',
      currentType: currentImageUrl?.startsWith('data:') ? 'data URL' : currentImageUrl?.startsWith('http') ? 'http URL' : currentImageUrl?.startsWith('file:') ? 'local file' : 'other',
      areEqual: originalImageUrl === currentImageUrl
    });
    
    if (originalImageUrl !== currentImageUrl) {
      changes.image = { old: originalImageUrl ? 'Previous Image' : 'No Image', new: currentImageUrl ? 'New Image' : 'No Image' };
      console.log('Image changed:', changes.image);
    }
    
    console.log('Total changes detected:', Object.keys(changes).length);
    console.log('Changes:', changes);
    console.log('=== END CHANGE DETECTION ===');
    
    return changes;
  };

  const handleSaveChanges = () => {
    console.log('=== SAVE CHANGES CALLED ===');
    const changes = identifyChanges();
    
    if (Object.keys(changes).length === 0) {
      console.log('No changes detected, showing alert');
      showAlert('No Changes', 'You haven\'t made any changes to your profile.', 'info');
      return;
    }
    
    console.log('Changes found, showing confirmation modal');
    // Store changes and show confirmation modal
    setPendingChanges(changes);
    setShowConfirmModal(true);
  };
  
  const handleConfirmSave = () => {
    console.log('User confirmed save via modal');
    setShowConfirmModal(false);
    handleConfirmChanges();
  };

  const handleCancelSave = () => {
    console.log('User cancelled save via modal');
    setShowConfirmModal(false);
    setPendingChanges({});
  };

  const handleConfirmChanges = async () => {
    console.log('=== CONFIRM CHANGES CALLED ===');
    try {
      setSaving(true);
      
      let profilePictureUrl = originalValues.image;
      let uploadSuccess = true;
      
      // Check if image has changed and needs uploading
      let originalImageUrl = '';
      let currentImageUrl = image || '';
      
      if (originalValues.image) {
        if (originalValues.image.startsWith('data:') || originalValues.image.startsWith('http')) {
          originalImageUrl = originalValues.image;
        } else {
          originalImageUrl = getImageUrl(originalValues.image);
        }
      }
      
      const hasImageChanged = originalImageUrl !== currentImageUrl;
      
      console.log('Image upload check:', {
        hasImageChanged,
        originalImageUrl,
        currentImageUrl,
        isLocalFile: image && (image.startsWith('file://') || image.startsWith('content://')),
        isDataUrl: image && image.startsWith('data:')
      });
      
      // Upload new image if it's a local file or data URL
      if (hasImageChanged && image && (image.startsWith('file://') || image.startsWith('content://') || image.startsWith('data:'))) {
        console.log('Uploading new profile picture...');
        try {
          const uploadResponse = await uploadProfilePicture(image);
          profilePictureUrl = uploadResponse.profile_picture_url;
          console.log('Profile picture uploaded successfully:', profilePictureUrl);
        } catch (uploadError) {
          console.error('Failed to upload profile picture:', uploadError);
          uploadSuccess = false;
          showAlert(
            'Upload Warning', 
            'Failed to upload profile picture, but other changes will be saved. You can try uploading the picture again later.',
            'warning'
          );
        }
      } else if (hasImageChanged && image && image.startsWith('http')) {
        profilePictureUrl = image;
        console.log('Using existing image URL:', profilePictureUrl);
      }
      
      // Create payload for API - ensure all data is properly formatted
      const profileData: any = {
        full_name: fullName.trim() || '',
        bio: bio.trim() || '',
        phone_number: phoneNumber.trim() || '',
        country: country.trim() || '',
        gender: gender.trim() || ''
      };
      
      // Add profile picture URL if we have one and upload was successful
      if (profilePictureUrl && uploadSuccess) {
        profileData.profile_picture = profilePictureUrl;
      }
      
      console.log('Updating profile with data:', profileData);
      
      // Update profile via API - this is the primary source of truth
      let apiUpdateSuccess = false;
      try {
        const response = await updateProfile(profileData);
        console.log('Profile update response:', response);
        apiUpdateSuccess = true;
        
        // Verify the update by fetching fresh data from server
        console.log('API update successful, verifying data sync...');
        try {
          const verifyResponse = await getUserProfile();
          if (verifyResponse.status === 200 && verifyResponse.data) {
            const updatedData = verifyResponse.data;
            console.log('Verified updated data from server:', updatedData);
            
            // Update local storage with verified server data
            await AsyncStorage.multiSet([
              ['user_fullName', updatedData.full_name || ''],
              ['user_bio', updatedData.bio || ''],
              ['user_phone', updatedData.phone_number || ''],
              ['user_country', updatedData.country || ''],
              ['user_gender', updatedData.gender || '']
            ]);
            
            if (updatedData.profile_picture) {
              await AsyncStorage.setItem('user_avatar', updatedData.profile_picture);
            }
            
            console.log('Local storage synced with verified server data');
          }
        } catch (verifyError) {
          console.error('Failed to verify data sync:', verifyError);
        }
        
      } catch (apiError) {
        console.error('API update failed:', apiError);
        // Continue with local storage update even if API fails
        showAlert(
          'Sync Warning',
          'Your profile was saved locally but could not be synced to the server. Changes will sync when you\'re back online.',
          'warning'
        );
      }
      
      // Always update AsyncStorage with new values (as backup and for offline use)
      await AsyncStorage.multiSet([
        ['user_fullName', fullName.trim() || ''],
        ['user_displayName', displayName.trim() || ''],
        ['user_bio', bio.trim() || ''],
        ['user_phone', phoneNumber.trim() || ''],
        ['user_country', country.trim() || ''],
        ['user_gender', gender.trim() || '']
      ]);
      console.log('Updated AsyncStorage with new values');
      
      // Update avatar in AsyncStorage
      if (profilePictureUrl && uploadSuccess) {
        await AsyncStorage.setItem('user_avatar', profilePictureUrl);
        console.log('Updated avatar in AsyncStorage:', profilePictureUrl);
      } else if (hasImageChanged && image) {
        // If we have a new local image but upload failed, save the local path
        await AsyncStorage.setItem('user_avatar', image);
        console.log('Saved local image path to AsyncStorage:', image);
      }
      
      // Update original values to reflect saved state
      const newOriginalValues = {
        fullName: fullName.trim() || '',
        displayName: displayName.trim() || '',
        bio: bio.trim() || '',
        phoneNumber: phoneNumber.trim() || '',
        country: country.trim() || '',
        gender: gender.trim() || '',
        image: profilePictureUrl || image || ''
      };
      
      setOriginalValues(newOriginalValues);
      console.log('Updated original values to reflect saved state:', newOriginalValues);
      
      // If API update was successful, show success and redirect
      if (apiUpdateSuccess) {
        showAlert(
          'Success', 
          'Your profile has been updated successfully!', 
          'success',
          () => {
            console.log('Success dialog closed, navigating back');
            setShowAlertModal(false);
            router.back();
          }
        );
      } else {
        // If API failed but local storage updated, show warning but still navigate back
        showAlert(
          'Saved Locally', 
          'Your profile has been saved locally and will sync when you\'re back online.', 
          'warning',
          () => {
            console.log('Warning dialog closed, navigating back');
            setShowAlertModal(false);
            router.back();
          }
        );
      }
      
    } catch (error) {
      console.error('Error updating profile:', error);
      showAlert(
        'Update Failed', 
        'An error occurred while updating your profile. Please try again.',
        'error'
      );
    } finally {
      setSaving(false);
      console.log('=== CONFIRM CHANGES COMPLETED ===');
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
            onPress={() => {
              console.log('Save button pressed');
              handleSaveChanges();
            }}
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
            {/* Profile Content */}
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
                    maxLength={150}
                  />
                  <View style={styles.characterCountContainer}>
                    <Text style={[
                      styles.characterCount, 
                      { 
                        color: bio.length > 120 
                          ? (bio.length > 140 ? AppColors.danger : '#FF9800') 
                          : colors.subText 
                      }
                    ]}>
                      {bio.length}/150 characters
                    </Text>
                  </View>
                </View>
              </View>
            </>
          </>
        )}
      </ScrollView>
      
      {/* Confirmation Modal */}
      <ConfirmationModal
        visible={showConfirmModal}
        title="Save Changes"
        message={`Are you sure you want to save the following changes?\n\n${Object.entries(pendingChanges)
          .map(([field, values]) => `• ${field}: "${values.old || 'not set'}" → "${values.new}"`)
          .join('\n')}`}
        onConfirm={handleConfirmSave}
        onCancel={handleCancelSave}
        confirmText="Save Changes"
        cancelText="Cancel"
      />
      
      {/* Alert Modal */}
      <AlertModal
        visible={showAlertModal}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        buttonText={alertConfig.buttonText}
        onClose={alertConfig.onClose}
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
  characterCountContainer: {
    alignItems: 'flex-end',
    marginTop: 5,
  },
  characterCount: {
    fontSize: 12,
    fontStyle: 'italic',
  },
});