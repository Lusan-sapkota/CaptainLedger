import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, ScrollView, TouchableOpacity, Switch, Alert, Platform, View as RNView, ActivityIndicator, RefreshControl, Image } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { Text, View } from '@/components/Themed';
import { AppColors } from './_layout';
import { getUserProfile } from '@/services/api';
import { useTheme } from '@/components/ThemeProvider';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import ThemedConfirmDialog from '@/components/ThemedConfirmDialog';

// Expanded user type definition to include all possible fields from backend
type UserProfile = {
  id: string;
  email: string;
  full_name?: string;
  fullName?: string; // API field name vs. local storage name
  displayName?: string; // Add this missing property
  country?: string;
  gender?: string;
  phone_number?: string;
  bio?: string;
  profile_picture?: string;
  last_login?: string;
  last_login_ip?: string;
  last_login_device?: string;
  last_login_location?: string;
  is_active?: boolean;
  is_verified?: boolean;
  created_at?: string;
  last_sync?: string | null;
};

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

export default function ProfileScreen() {
  const router = useRouter();
  const { isDarkMode, colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<UserProfile | null>(null);
  
  // Settings state
  const [autoSync, setAutoSync] = useState(true);
  const [notifications, setNotifications] = useState(true);
  const [darkMode, setDarkMode] = useState(isDarkMode);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  
  // Add refreshing state
  const [refreshing, setRefreshing] = useState(false);
  
  useEffect(() => {
    const checkAuthAndLoadProfile = async () => {
      const isAuthenticated = await AsyncStorage.getItem('is_authenticated');
      const authToken = await AsyncStorage.getItem('auth_token');
      
      // Only load profile if user has some form of authentication
      if (isAuthenticated === 'true' || authToken) {
        loadUserProfile();
      } else {
        console.log('No authentication found - not loading profile');
        setLoading(false);
      }
    };
    
    checkAuthAndLoadProfile();
  }, []);

  const loadUserProfile = async () => {
    try {
      setLoading(true);
      
      // Check auth state first
      const authToken = await AsyncStorage.getItem('auth_token');
      const isAuthenticated = await AsyncStorage.getItem('is_authenticated');
      
      // If no authentication, don't attempt to load profile
      if (!authToken && isAuthenticated !== 'true') {
        console.log('User not authenticated - skipping profile load');
        setLoading(false);
        // You might want to redirect to login here
        router.replace('/auth');
        return;
      }

      // Retrieve offline and guest mode flags from AsyncStorage
      const isOfflineMode = await AsyncStorage.getItem('is_offline_mode');
      const isGuestMode = await AsyncStorage.getItem('is_guest_mode');
      
      // Only use offline mode if explicitly set or using offline/guest tokens
      const shouldUseOfflineMode = 
        isOfflineMode === 'true' || 
        isGuestMode === 'true' || 
        authToken === 'offline-token' || 
        authToken === 'guest-token';
      
      if (shouldUseOfflineMode) {
        console.log('Using offline/guest mode - loading from local storage');
        // Use local storage data for offline/guest users
        const userId = await AsyncStorage.getItem('user_id');
        const email = await AsyncStorage.getItem('user_email');
        const fullName = await AsyncStorage.getItem('user_fullName');
        const displayName = await AsyncStorage.getItem('user_displayName');
        const country = await AsyncStorage.getItem('user_country');
        const bio = await AsyncStorage.getItem('user_bio');
        const phone = await AsyncStorage.getItem('user_phone');
        const avatar = await AsyncStorage.getItem('user_avatar');
        
        setUser({
          id: userId || 'guest',
          email: email || 'guest@example.com',
          fullName: displayName || fullName || (isGuestMode === 'true' ? 'Guest User' : 'Offline User'),
          country: country || 'Nepal',
          bio: bio || '',
          phone_number: phone || '',
          profile_picture: avatar || '',
          created_at: new Date().toISOString(),
          last_sync: null
        });
        return;
      }
      
      // Try API call for authenticated users with real tokens
      if (authToken && !shouldUseOfflineMode) {
        try {
          console.log('Attempting API call with token:', authToken);
          const response = await getUserProfile();
          const userData = response.data;
          
          console.log('API response received:', userData);
          
          // Get additional user data from local storage for any missing fields
          const localFullName = await AsyncStorage.getItem('user_fullName');
          const localDisplayName = await AsyncStorage.getItem('user_displayName');
          const localCountry = await AsyncStorage.getItem('user_country');
          const localBio = await AsyncStorage.getItem('user_bio');
          const localPhone = await AsyncStorage.getItem('user_phone');
          const localAvatar = await AsyncStorage.getItem('user_avatar');
          
          // Create combined user data, preferring backend data when available
          setUser({
            ...userData,
            // Map both full_name and fullName to display correctly
            fullName: userData.full_name || userData.fullName || localFullName || 'User',
            displayName: (userData as UserProfile).displayName || localDisplayName || userData.full_name || localFullName || 'User',
            country: userData.country || localCountry || 'Nepal',
            gender: userData.gender || 'Not specified',
            bio: userData.bio || localBio || '',
            phone_number: userData.phone_number || localPhone || '',
            profile_picture: userData.profile_picture || localAvatar || '',
            // Ensure these login fields are captured
            last_login: userData.last_login || new Date().toISOString(),
            last_login_ip: userData.last_login_ip || 'Unknown',
            last_login_device: userData.last_login_device || 'Unknown',
            last_login_location: userData.last_login_location || 'Unknown',
            is_active: userData.is_active !== undefined ? userData.is_active : true,
            is_verified: userData.is_verified !== undefined ? userData.is_verified : false,
            created_at: userData.created_at || new Date().toISOString(),
          });
          return;
        } catch (apiError) {
          console.error('API call failed:', apiError);
          
          // If API fails with 401, clear auth and don't fallback
          if (
            typeof apiError === 'object' &&
            apiError !== null &&
            'response' in apiError &&
            typeof (apiError as any).response === 'object' &&
            (apiError as any).response !== null &&
            'status' in (apiError as any).response &&
            (apiError as any).response.status === 401
          ) {
            console.log('401 error - user not authenticated, clearing data');
            await AsyncStorage.multiRemove([
              'auth_token',
              'user_id',
              'user_email',
              'is_authenticated'
            ]);
            setLoading(false);
            return;
          }
          
          // For other API errors, fallback to local storage
          console.log('API error, falling back to local storage');
        }
      }
      
      // Fallback to local storage
      console.log('Falling back to local storage');
      const userId = await AsyncStorage.getItem('user_id');
      const email = await AsyncStorage.getItem('user_email');
      const fullName = await AsyncStorage.getItem('user_fullName');
      const displayName = await AsyncStorage.getItem('user_displayName');
      const country = await AsyncStorage.getItem('user_country');
      const bio = await AsyncStorage.getItem('user_bio');
      const phone = await AsyncStorage.getItem('user_phone');
      const avatar = await AsyncStorage.getItem('user_avatar');
      
      if (email) {
        setUser({
          id: userId || 'user',
          email,
          fullName: displayName || fullName || 'User',
          country: country || 'Nepal',
          bio: bio || '',
          phone_number: phone || '',
          profile_picture: avatar || ''
        });
      } else {
        // No valid data found
        console.log('No valid profile data found');
        setUser(null);
      }
    } catch (error) {
      console.error('Error loading user profile:', error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };
  
  const handleLogout = () => {
    setShowLogoutConfirm(true);
  };

  const performLogout = async () => {
    try {
      console.log('=== LOGOUT START ===');
      setShowLogoutConfirm(false);
      
      // First, set logout flag
      await AsyncStorage.setItem('user_logged_out', 'true');
      
      // Record logout in history
      try {
        const loginHistory = await AsyncStorage.getItem('login_history') || '[]';
        const history = JSON.parse(loginHistory);
        history.push({
          date: new Date().toISOString(),
          device: Platform.OS,
          type: 'logout'
        });
        await AsyncStorage.setItem('login_history', JSON.stringify(history.slice(-10)));
      } catch (e) {
        console.error('Failed to record logout history:', e);
      }
      
      // Clear ALL auth-related items - use multiRemove for better atomicity
      const keysToRemove = [
        'auth_token', 'user_id', 'user_email', 'user_fullName', 'user_country',
        'is_authenticated', 'is_offline_mode', 'is_guest_mode', 'completed_onboarding',
        'profile_setup_completed', 'user_displayName', 'user_avatar', 'user_bio', 'user_phone'
      ];
      
      await AsyncStorage.multiRemove(keysToRemove);
      console.log('All auth data cleared');
      
      if (Platform.OS === 'web') {
        // Web needs a full page reload to clear React state completely
        window.location.href = '/auth';
      } else {
        // For native, use a more reliable navigation approach
        try {
          // Use a slightly longer delay to ensure AsyncStorage operations complete
          setTimeout(() => {
            // Try to use navigation reset if possible for a cleaner state
            if (router.canGoBack()) {
              router.navigate('/auth');
            } else {
              router.replace('/auth');
            }
          }, 500);
        } catch (navError) {
          console.error('Navigation error:', navError);
          // Fallback to basic replace
          setTimeout(() => router.replace('/auth'), 500);
        }
      }
    } catch (error) {
      console.error('Logout error:', error);
      Alert.alert('Logout Error', 'Failed to logout. Please try again.');
    }
  };

  // Add this helper function:
  const showThemedAlert = (title: string, message: string) => {
    // Use Alert.alert for now, but we should migrate to ThemedConfirmDialog
    Alert.alert(title, message);
  };
  
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  // Add refresh handler
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    
    // Reload user profile data
    const refreshProfile = async () => {
      try {
        await loadUserProfile();
      } finally {
        setRefreshing(false);
      }
    };
    
    refreshProfile();
  }, []);

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={AppColors.primary} />
      </View>
    );
  }
  
  return (
    <>
      <ScrollView 
        style={[styles.container, { backgroundColor: colors.background }]}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh}
            colors={[AppColors.primary]} 
            tintColor={isDarkMode ? AppColors.primary : AppColors.secondary}
            title="Pull to refresh" 
            titleColor={isDarkMode ? AppColors.primary : AppColors.secondary}
          />
        }
      >
        {/* Profile Header */}
        <RNView style={[styles.profileHeader, { backgroundColor: AppColors.secondary }]}>
          {user?.profile_picture ? (
            <Image 
              source={{ 
                uri: getImageUrl(user.profile_picture)
              }}
              style={styles.avatarImage}
              defaultSource={require('@/assets/images/default-profile.svg')}
            />
          ) : (
            <RNView style={styles.avatarContainer}>
              <Text style={styles.avatarText}>
                {user?.displayName ? user.displayName[0].toUpperCase() : user?.fullName ? user.fullName[0].toUpperCase() : 'U'}
              </Text>
            </RNView>
          )}
          <Text style={styles.userName}>{user?.displayName || user?.fullName || 'User'}</Text>
          <Text style={styles.userEmail}>{user?.email || ''}</Text>
          
          {user?.bio ? (
            <Text style={styles.userBio}>{user.bio}</Text>
          ) : null}
        </RNView>
        
        {/* Account Information */}
        <View style={[styles.section, { backgroundColor: colors.cardBackground }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Account Information</Text>
          
          <RNView style={[styles.infoRow, { borderBottomColor: colors.border, backgroundColor: 'transparent' }]}>
            <Text style={[styles.infoLabel, { color: colors.subText }]}>Full Name</Text>
            <Text style={[styles.infoValue, { color: colors.text }]}>{user?.fullName || 'Not set'}</Text>
          </RNView>

          <RNView style={[styles.infoRow, { borderBottomColor: colors.border, backgroundColor: 'transparent' }]}>
            <Text style={[styles.infoLabel, { color: colors.subText }]}>Display Name</Text>
            <Text style={[styles.infoValue, { color: colors.text }]}>{user?.displayName || 'Not set'}</Text>
          </RNView>
          
          <RNView style={[styles.infoRow, { borderBottomColor: colors.border, backgroundColor: 'transparent' }]}>
            <Text style={[styles.infoLabel, { color: colors.subText }]}>Email</Text>
            <Text style={[styles.infoValue, { color: colors.text }]}>{user?.email}</Text>
          </RNView>
          
          <RNView style={[styles.infoRow, { borderBottomColor: colors.border, backgroundColor: 'transparent' }]}>
            <Text style={[styles.infoLabel, { color: colors.subText }]}>Phone Number</Text>
            <Text style={[styles.infoValue, { color: colors.text }]}>{user?.phone_number || 'Not set'}</Text>
          </RNView>
          
          <RNView style={[styles.infoRow, { borderBottomColor: colors.border, backgroundColor: 'transparent' }]}>
            <Text style={[styles.infoLabel, { color: colors.subText }]}>Country</Text>
            <Text style={[styles.infoValue, { color: colors.text }]}>{user?.country || 'Not set'}</Text>
          </RNView>
          
          <RNView style={[styles.infoRow, { borderBottomColor: colors.border, backgroundColor: 'transparent' }]}>
            <Text style={[styles.infoLabel, { color: colors.subText }]}>Gender</Text>
            <Text style={[styles.infoValue, { color: colors.text }]}>{user?.gender || 'Not set'}</Text>
          </RNView>
          
          <RNView style={[styles.infoRow, { borderBottomColor: colors.border, backgroundColor: 'transparent' }]}>
            <Text style={[styles.infoLabel, { color: colors.subText }]}>Bio</Text>
            <Text style={[styles.infoValue, { color: colors.text, flex: 1, textAlign: 'right' }]} numberOfLines={3} ellipsizeMode="tail">
              {user?.bio || 'Not set'}
            </Text>
          </RNView>
          
          <RNView style={[styles.infoRow, { backgroundColor: 'transparent' }]}>
            <Text style={[styles.infoLabel, { color: colors.subText }]}>Member Since</Text>
            <Text style={[styles.infoValue, { color: colors.text }]}>
              {user?.created_at ? formatDate(user.created_at) : 'N/A'}
            </Text>
          </RNView>
        </View>
        
        {/* Login Information */}
        <View style={[styles.section, { backgroundColor: colors.cardBackground }]}>
          <RNView style={[styles.sectionHeaderRow, { backgroundColor: 'transparent' }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Login Information</Text>
            <TouchableOpacity 
              style={styles.viewAllButton} 
              onPress={() => router.push('/loginHistory')}
            >
              <Text style={styles.viewAllText}>View All</Text>
              <FontAwesome name="chevron-right" size={12} color={AppColors.primary} style={{ marginLeft: 4 }} />
            </TouchableOpacity>
          </RNView>
          
          <RNView style={[styles.infoRow, { borderBottomColor: colors.border, backgroundColor: 'transparent' }]}>
            <Text style={[styles.infoLabel, { color: colors.subText }]}>Last Login</Text>
            <Text style={[styles.infoValue, { color: colors.text }]}>
              {user?.last_login ? formatDate(user.last_login) : 'N/A'}
            </Text>
          </RNView>
          
          <RNView style={[styles.infoRow, { borderBottomColor: colors.border, backgroundColor: 'transparent' }]}>
            <Text style={[styles.infoLabel, { color: colors.subText, flex: 0.4 }]}>Device</Text>
            <Text style={[styles.infoValue, { color: colors.text, flex: 0.6, textAlign: 'right' }]} numberOfLines={1} ellipsizeMode="tail">
              {user?.last_login_device || 'Unknown'}
            </Text>
          </RNView>
          
          <RNView style={[styles.infoRow, { borderBottomColor: colors.border, backgroundColor: 'transparent' }]}>
            <Text style={[styles.infoLabel, { color: colors.subText, flex: 0.4 }]}>Location</Text>
            <Text style={[styles.infoValue, { color: colors.text, flex: 0.6, textAlign: 'right' }]} numberOfLines={1} ellipsizeMode="tail">
              {user?.last_login_location || 'Unknown'}
            </Text>
          </RNView>
          
          <RNView style={[styles.infoRow, { borderBottomColor: colors.border, backgroundColor: 'transparent' }]}>
            <Text style={[styles.infoLabel, { color: colors.subText }]}>IP Address</Text>
            <Text style={[styles.infoValue, { color: colors.text }]}>
              {user?.last_login_ip || 'Unknown'}
            </Text>
          </RNView>
          
          <RNView style={[styles.infoRow, { backgroundColor: 'transparent' }]}>
            <Text style={[styles.infoLabel, { color: colors.subText }]}>Account Status</Text>
            <RNView style={[styles.statusBadge, { 
              backgroundColor: user?.is_active ? AppColors.primary : colors.subText 
            }]}>
              <Text style={styles.statusText}>
                {user?.is_active ? 'Active' : 'Inactive'}
              </Text>
            </RNView>
          </RNView>
        </View>
        
        {/* Sync Information */}
        <View style={[styles.section, { backgroundColor: colors.cardBackground }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Sync Status</Text>
          
          <RNView style={[styles.infoRow, { borderBottomColor: colors.border, backgroundColor: 'transparent' }]}>
            <Text style={[styles.infoLabel, { color: colors.subText }]}>Last Sync</Text>
            <Text style={[styles.infoValue, { color: colors.text }]}>
              {user?.last_sync ? formatDate(user.last_sync) : 'Never'}
            </Text>
          </RNView>
          
          <TouchableOpacity 
            style={styles.syncButton}
            onPress={() => Alert.alert('Sync', 'Sync feature will be available soon.')}
          >
            <FontAwesome name="refresh" size={16} color={AppColors.white} />
            <Text style={styles.syncButtonText}>Sync Now</Text>
          </TouchableOpacity>
        </View>
        
        {/* Settings */}
        <View style={[styles.section, { backgroundColor: colors.cardBackground }]}>
          <RNView style={[styles.sectionHeaderRow, { backgroundColor: 'transparent' }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Settings</Text>
            <TouchableOpacity 
              style={styles.viewAllButton} 
              onPress={() => router.push('/settings')}
            >
              <Text style={styles.viewAllText}>View All</Text>
              <FontAwesome name="chevron-right" size={12} color={AppColors.primary} style={{ marginLeft: 4 }} />
            </TouchableOpacity>
          </RNView>
          
          <RNView style={[styles.settingRow, { borderBottomColor: colors.border, backgroundColor: 'transparent' }]}>
            <RNView style={{ backgroundColor: 'transparent' }}>
              <Text style={[styles.settingLabel, { color: colors.text }]}>Auto Sync</Text>
              <Text style={[styles.settingDescription, { color: colors.subText }]}>
                Automatically sync data when connected
              </Text>
            </RNView>
            <Switch
              trackColor={{ false: '#767577', true: AppColors.primary }}
              thumbColor={autoSync ? AppColors.primary : '#f4f3f4'}
              onValueChange={setAutoSync}
              value={autoSync}
            />
          </RNView>
          
          <RNView style={[styles.settingRow, { borderBottomColor: colors.border, backgroundColor: 'transparent' }]}>
            <RNView style={{ backgroundColor: 'transparent' }}>
              <Text style={[styles.settingLabel, { color: colors.text }]}>Notifications</Text>
              <Text style={[styles.settingDescription, { color: colors.subText }]}>
                Enable push notifications
              </Text>
            </RNView>
            <Switch
              trackColor={{ false: '#767577', true: AppColors.primary }}
              thumbColor={notifications ? AppColors.primary : '#f4f3f4'}
              onValueChange={setNotifications}
              value={notifications}
            />
          </RNView>
          
          <RNView style={[styles.settingRow, { backgroundColor: 'transparent' }]}>
            <RNView style={{ backgroundColor: 'transparent' }}>
              <Text style={[styles.settingLabel, { color: colors.text }]}>Dark Mode</Text>
              <Text style={[styles.settingDescription, { color: colors.subText }]}>
                Use dark theme
              </Text>
            </RNView>
            <Switch
              trackColor={{ false: '#767577', true: AppColors.primary }}
              thumbColor={darkMode ? AppColors.primary : '#f4f3f4'}
              onValueChange={(value) => {
                setDarkMode(value);
                Alert.alert('Theme Change', 'Theme toggling will be fully implemented soon.');
              }}
              value={darkMode}
            />
          </RNView>
        </View>
        
        {/* Actions */}
        <View style={[styles.section, { backgroundColor: colors.cardBackground }]}>
          <TouchableOpacity 
            style={[styles.actionButton, { borderBottomColor: colors.border, backgroundColor: 'transparent' }]}
            onPress={() => router.push('/changePassword')}
          >
            <FontAwesome name="lock" size={18} color={colors.text} style={styles.actionIcon} />
            <Text style={[styles.actionText, { color: colors.text, flex: 1 }]}>Change Password</Text>
            <FontAwesome name="chevron-right" size={16} color={colors.subText} />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.actionButton, { borderBottomColor: colors.border, backgroundColor: 'transparent' }]}
            onPress={() => router.push('/editProfile')}
          >
            <FontAwesome name="user-circle" size={18} color={colors.text} style={styles.actionIcon} />
            <Text style={[styles.actionText, { color: colors.text, flex: 1 }]}>Edit Profile</Text>
            <FontAwesome name="chevron-right" size={16} color={colors.subText} />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.actionButton, { borderBottomColor: colors.border, backgroundColor: 'transparent' }]}
            onPress={() => router.push('/categoryManagement')}
          >
            <FontAwesome name="tags" size={18} color={colors.text} style={styles.actionIcon} />
            <Text style={[styles.actionText, { color: colors.text, flex: 1 }]}>Manage Categories</Text>
            <FontAwesome name="chevron-right" size={16} color={colors.subText} />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.actionButton, { backgroundColor: 'transparent' }]}
            onPress={() => router.push('/about')}
          >
            <FontAwesome name="info-circle" size={18} color={colors.text} style={styles.actionIcon} />
            <Text style={[styles.actionText, { color: colors.text, flex: 1 }]}>About</Text>
            <FontAwesome name="chevron-right" size={16} color={colors.subText} />
          </TouchableOpacity>
        </View>
        
        {/* Logout Button */}
        <TouchableOpacity 
          style={[styles.logoutButton, { backgroundColor: colors.cardBackground }]}
          onPress={handleLogout}
        >
          <FontAwesome name="sign-out" size={18} color={AppColors.danger} style={styles.actionIcon} />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
        
        <Text style={[styles.versionText, { color: colors.subText }]}>
          Version 1.0.0
        </Text>
      </ScrollView>

      {/* Place the dialog outside the ScrollView to ensure it's always visible */}
      <ThemedConfirmDialog
        visible={showLogoutConfirm}
        title="Logout"
        message="Are you sure you want to logout from your account?"
        onConfirm={performLogout}
        onCancel={() => setShowLogoutConfirm(false)}
        actionType="negative" // Add this for red button color
        confirmButtonText="Logout" // Make button text match the action
        isDarkMode={isDarkMode}
        colors={colors}
      />
    </>
  );
}

const styles = StyleSheet.create({
  avatarImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 15,
    borderWidth: 2,
    borderColor: 'white',
  },
  userBio: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    marginTop: 10,
    paddingHorizontal: 20,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  statusText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileHeader: {
    alignItems: 'center',
    padding: 30,
  },
  avatarContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: AppColors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
  },
  avatarText: {
    fontSize: 40,
    fontWeight: 'bold',
    color: AppColors.white,
  },
  userName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: AppColors.white,
    marginBottom: 5,
  },
  userEmail: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  section: {
    margin: 16,
    borderRadius: 10,
    overflow: 'hidden',
    ...(Platform.OS === 'web'
      ? { 
          boxShadow: '0px 1px 3px rgba(0, 0, 0, 0.1)',
        }
      : {
          elevation: 2,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.1,
          shadowRadius: 2,
        }),
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    padding: 15,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 15,
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  viewAllText: {
    fontSize: 14,
    color: AppColors.primary,
    fontWeight: '500',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 15,
    borderBottomWidth: 1,
  },
  infoLabel: {
    fontSize: 16,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '500',
  },
  syncButton: {
    backgroundColor: AppColors.primary,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 12,
    margin: 15,
    borderRadius: 8,
  },
  syncButtonText: {
    color: AppColors.white,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
  settingDescription: {
    fontSize: 14,
    marginTop: 3,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
  },
  actionIcon: {
    marginRight: 15,
    opacity: 1,
  },
  actionText: {
    fontSize: 16,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    margin: 16,
    padding: 15,
    borderRadius: 10,
    marginBottom: 5,
    ...(Platform.OS === 'web'
      ? { 
          boxShadow: '0px 1px 3px rgba(0, 0, 0, 0.1)',
        }
      : {
          elevation: 2,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.1,
          shadowRadius: 2,
        }),
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '500',
    color: AppColors.danger,
    marginLeft: 10,
  },
  versionText: {
    textAlign: 'center',
    fontSize: 14,
    marginBottom: 30,
  },
});