import React, { useState, useEffect } from 'react';
import { StyleSheet, ScrollView, TouchableOpacity, Switch, Alert, ActivityIndicator, Platform, View as RNView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { Text, View } from '@/components/Themed';
import { AppColors } from './_layout';
import { getUserProfile } from '@/services/api';
import { useTheme } from '@/components/ThemeProvider';
import FontAwesome from '@expo/vector-icons/FontAwesome';

export default function ProfileScreen() {
  const router = useRouter();
  const { isDarkMode, colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<{
    id: string;
    email: string;
    fullName?: string;
    country?: string;
    created_at?: string;
    last_sync?: string | null;
  } | null>(null);
  
  // Settings state
  const [autoSync, setAutoSync] = useState(true);
  const [notifications, setNotifications] = useState(true);
  const [darkMode, setDarkMode] = useState(isDarkMode);
  
  useEffect(() => {
    loadUserProfile();
  }, []);
  
  const loadUserProfile = async () => {
    try {
      setLoading(true);
      
      // Try to get from API
      const response = await getUserProfile();
      const userData = response.data;
      
      // Get additional user data from local storage
      const fullName = await AsyncStorage.getItem('user_fullName');
      const country = await AsyncStorage.getItem('user_country');
      
      setUser({
        ...userData,
        fullName: fullName || 'User',
        country: country || 'Nepal',
      });
    } catch (error) {
      console.error('Error loading user profile:', error);
      
      // Fallback to local storage
      const userId = await AsyncStorage.getItem('user_id');
      const email = await AsyncStorage.getItem('user_email');
      const fullName = await AsyncStorage.getItem('user_fullName');
      const country = await AsyncStorage.getItem('user_country');
      
      if (email) {
        setUser({
          id: userId || 'guest',
          email,
          fullName: fullName || 'User',
          country: country || 'Nepal',
        });
      } else {
        // Guest user
        setUser({
          id: 'guest',
          email: 'guest@example.com',
          fullName: 'Guest User',
        });
      }
    } finally {
      setLoading(false);
    }
  };
  
  const handleLogout = async () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Logout',
          onPress: async () => {
            // Add logout to login history
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
              console.error('Error logging logout:', e);
            }
            
            // Clear auth data
            await AsyncStorage.removeItem('auth_token');
            await AsyncStorage.removeItem('user_id');
            await AsyncStorage.removeItem('user_email');
            router.replace('/auth');
          }
        }
      ]
    );
  };
  
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };
  
  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={AppColors.primary} />
      </View>
    );
  }
  
  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Profile Header */}
      <RNView style={[styles.profileHeader, { backgroundColor: AppColors.secondary }]}>
        <RNView style={styles.avatarContainer}>
          <Text style={styles.avatarText}>
            {user?.fullName ? user.fullName[0].toUpperCase() : 'U'}
          </Text>
        </RNView>
        <Text style={styles.userName}>{user?.fullName || 'User'}</Text>
        <Text style={styles.userEmail}>{user?.email}</Text>
      </RNView>
      
      {/* Account Information */}
      <View style={[styles.section, { backgroundColor: colors.cardBackground }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Account Information</Text>
        
        <RNView style={[styles.infoRow, { borderBottomColor: colors.border, backgroundColor: 'transparent' }]}>
          <Text style={[styles.infoLabel, { color: colors.subText }]}>User ID</Text>
          <Text style={[styles.infoValue, { color: colors.text }]}>{user?.id}</Text>
        </RNView>
        
        <RNView style={[styles.infoRow, { borderBottomColor: colors.border, backgroundColor: 'transparent' }]}>
          <Text style={[styles.infoLabel, { color: colors.subText }]}>Email</Text>
          <Text style={[styles.infoValue, { color: colors.text }]}>{user?.email}</Text>
        </RNView>
        
        <RNView style={[styles.infoRow, { borderBottomColor: colors.border, backgroundColor: 'transparent' }]}>
          <Text style={[styles.infoLabel, { color: colors.subText }]}>Country</Text>
          <Text style={[styles.infoValue, { color: colors.text }]}>{user?.country || 'Not set'}</Text>
        </RNView>
        
        <RNView style={[styles.infoRow, { backgroundColor: 'transparent' }]}>
          <Text style={[styles.infoLabel, { color: colors.subText }]}>Member Since</Text>
          <Text style={[styles.infoValue, { color: colors.text }]}>
            {user?.created_at ? formatDate(user.created_at) : 'N/A'}
          </Text>
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
            trackColor={{ false: '#767577', true: AppColors.lightGreen }}
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
            trackColor={{ false: '#767577', true: AppColors.lightGreen }}
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
            trackColor={{ false: '#767577', true: AppColors.lightGreen }}
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
          onPress={() => Alert.alert('Connect Server', 'This feature will be available soon.')}
        >
          <FontAwesome name="server" size={18} color={AppColors.secondary} style={styles.actionIcon} />
          <Text style={[styles.actionText, { color: colors.text, flex: 1 }]}>Connect to Your Server</Text>
          <FontAwesome name="chevron-right" size={16} color={colors.subText} />
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.actionButton, { borderBottomColor: colors.border, backgroundColor: 'transparent' }]}
          onPress={() => Alert.alert('Edit Profile', 'This feature will be available soon.')}
        >
          <FontAwesome name="user-circle" size={18} color={AppColors.secondary} style={styles.actionIcon} />
          <Text style={[styles.actionText, { color: colors.text, flex: 1 }]}>Edit Profile</Text>
          <FontAwesome name="chevron-right" size={16} color={colors.subText} />
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.actionButton, { backgroundColor: 'transparent' }]}
          onPress={() => Alert.alert('About', 'CaptainLedger v1.0.0\n\nA privacy-focused finance tracker.')}
        >
          <FontAwesome name="info-circle" size={18} color={AppColors.secondary} style={styles.actionIcon} />
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
  );
}

const styles = StyleSheet.create({
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