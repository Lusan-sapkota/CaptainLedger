import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Dimensions,
  Alert,
  Platform,
  Image
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useRouter, Href } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '@/components/ThemeProvider';
import { useAlert } from '@/components/AlertProvider'; 
import { AppColors } from '@/app/(tabs)/_layout';
import ConfirmationModal from '@/components/ConfirmationModal';

const { width } = Dimensions.get('window');

interface SidebarProps {
  visible: boolean;
  onClose: () => void;
}

export default function Sidebar({ visible, onClose }: SidebarProps) {
  const { isDarkMode, colors, toggleTheme } = useTheme();
  const { showAlert } = useAlert();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [showLogoutModal, setShowLogoutModal] = React.useState(false);

  const menuItems = [
    { 
      title: 'Dashboard', 
      icon: 'dashboard', 
      route: '/(tabs)/',
      description: 'Overview of your finances'
    },
    { 
      title: 'Transactions', 
      icon: 'money', 
      route: '/(tabs)/transactions',
      description: 'Manage income and expenses'
    },
    { 
      title: 'History', 
      icon: 'history', 
      route: '/(tabs)/history',
      description: 'View transaction history'
    },
    { 
      title: 'Analytics', 
      icon: 'bar-chart', 
      route: '/analytics',
      description: 'Financial insights'
    },
    { 
      title: 'Budgets', 
      icon: 'pie-chart', 
      route: '/budgets',
      description: 'Budget management'
    },
    { 
      title: 'Investments', 
      icon: 'line-chart', 
      route: '/investments',
      description: 'Track your investments'
    },
    { 
      title: 'Loans', 
      icon: 'handshake-o', 
      route: '/loans',
      description: 'Manage loans'
    },
    { 
      title: 'Profile', 
      icon: 'user', 
      route: '/profile',
      description: 'Manage your profile'
    },
    { 
      title: 'Notifications', 
      icon: 'bell', 
      route: '/notifications',
      description: 'View notifications'
    },
    { 
      title: 'Category', 
      icon: 'tags', 
      route: '/categoryManagement',
      description: 'Manage categories'
    },
    { 
      title: 'Settings', 
      icon: 'cog', 
      route: '/settings',
      description: 'App preferences'
    }
  ];

  const supportItems = [
    {
      title: 'Help',
      icon: 'question-circle',
      route: '/documentation',
      description: 'Documentation and help'
    },
    {
      title: 'About',
      icon: 'info-circle',
      route: '/about',
      description: 'About CaptainLedger'
    },
    {
      title: 'Donate',
      icon: 'heart',
      route: '/donation',
      description: 'Support development'
    },
    {
      title: 'Privacy Policy',
      icon: 'shield',
      route: '/privacy',
      description: 'How we protect your data'
    },
    {
      title: 'Terms of Service',
      icon: 'file-text',
      route: '/terms',
      description: 'Terms and conditions'
    }
  ];

  const handleNavigation = (route: string) => {
    onClose();
    router.push(route as Href);
  };

  const handleThemeToggle = () => {
    try {
      // Close sidebar first to avoid any state conflicts
      onClose();
      // Use setTimeout to ensure sidebar closes before theme changes
      setTimeout(() => {
        toggleTheme();
      }, 100);
    } catch (error) {
      console.error('Theme toggle error:', error);
      showAlert('Error', 'Failed to change theme', 'error');
    }
  };

  const handleLogout = () => {
    setShowLogoutModal(true);
  };

  const performLogout = async () => {
    try {
      console.log('=== LOGOUT START ===');
      
      // Set logout flag before clearing storage
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
      
      // Clear ALL auth-related items
      const keysToRemove = [
        'auth_token', 'user_id', 'user_email', 'is_authenticated', 
        'auth_expiration', 'server_ip', 'is_custom_server', 'session_created',
        'last_activity', 'device_id', 'user_fullName', 'user_country',
        'is_offline_mode', 'is_guest_mode', 'completed_onboarding',
        'profile_setup_completed', 'user_displayName', 'user_avatar',
        'user_bio', 'user_phone'
      ];
      
      await AsyncStorage.multiRemove(keysToRemove);
      
      // Clear all trusted device data
      const keys = await AsyncStorage.getAllKeys();
      const trustedDeviceKeys = keys.filter(key => key.startsWith('trusted_device_'));
      if (trustedDeviceKeys.length > 0) {
        await AsyncStorage.multiRemove(trustedDeviceKeys);
      }
      
      console.log('All auth and session data cleared');
      
      onClose();
      router.replace('/auth');
      showAlert('Success', 'Signed out successfully', 'success');
    } catch (error) {
      console.error('Logout error:', error);
      showAlert('Error', 'Failed to sign out', 'error');
    }
  };

  if (!visible) {
    return null;
  }

  return (
    <React.Fragment>
      <TouchableOpacity 
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          zIndex: 1000,
        }}
        onPress={onClose}
        activeOpacity={1}
      />
      <View style={{
        position: 'absolute',
        top: 0,
        left: 0,
        bottom: 0,
        width: Math.min(width * 0.85, 320),
        backgroundColor: colors.background,
        zIndex: 1001,
        shadowColor: '#000',
        shadowOffset: { width: 2, height: 0 },
        shadowOpacity: 0.25,
        shadowRadius: 10,
        elevation: 10,
      }}>
        <SafeAreaView edges={['top', 'left', 'bottom']} style={{ flex: 1 }}>
          <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
            <View style={{
              paddingHorizontal: 20,
              paddingVertical: 25,
              borderBottomWidth: 1,
              borderBottomColor: AppColors.secondary,
              backgroundColor: AppColors.secondary,
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Image
                    source={require('@/assets/images/icon.png')}
                    style={{
                      width: 45,
                      height: 45,
                    }}
                  />
                  <Text style={{
                    fontSize: 20,
                    fontWeight: 'bold',
                    color: colors.text,
                    marginLeft: 10
                  }}>
                    CaptainLedger
                  </Text>
                </View>
                <TouchableOpacity onPress={onClose} style={{ padding: 5 }}>
                  <FontAwesome name="times" size={20} color={colors.text} />
                </TouchableOpacity>
              </View>
              <Text style={{
                fontSize: 12,
                color: colors.subText,
                marginTop: 5,
                marginLeft: 55
              }}>
                Personal Finance Manager
              </Text>
            </View>
            <View style={{ paddingVertical: 10 }}>
              <Text style={{
                fontSize: 12,
                fontWeight: '600',
                color: colors.subText,
                paddingHorizontal: 20,
                paddingVertical: 10,
                textTransform: 'uppercase',
                letterSpacing: 1
              }}>
                Navigation
              </Text>
              {menuItems.map((item, index) => (
                <TouchableOpacity
                  key={index}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingHorizontal: 20,
                    paddingVertical: 12,
                    marginHorizontal: 10,
                    borderRadius: 8,
                    backgroundColor: 'transparent'
                  }}
                  onPress={() => handleNavigation(item.route)}
                  activeOpacity={0.7}
                >
                  <FontAwesome 
                    name={item.icon as any} 
                    size={18} 
                    color={AppColors.primary} 
                    style={{ width: 24 }} 
                  />
                  <View style={{ marginLeft: 15, flex: 1 }}>
                    <Text style={{
                      fontSize: 16,
                      fontWeight: '500',
                      color: colors.text
                    }}>
                      {item.title}
                    </Text>
                    <Text style={{
                      fontSize: 12,
                      color: colors.subText,
                      marginTop: 2
                    }}>
                      {item.description}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
            <View style={{
              borderTopWidth: 1,
              borderTopColor: colors.border,
              paddingVertical: 10,
              marginTop: 10
            }}>
              <Text style={{
                fontSize: 12,
                fontWeight: '600',
                color: colors.subText,
                paddingHorizontal: 20,
                paddingVertical: 10,
                textTransform: 'uppercase',
                letterSpacing: 1
              }}>
                Support & Info
              </Text>
              {supportItems.map((item, index) => (
                <TouchableOpacity
                  key={index}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingHorizontal: 20,
                    paddingVertical: 12,
                    marginHorizontal: 10,
                    borderRadius: 8,
                    backgroundColor: 'transparent'
                  }}
                  onPress={() => handleNavigation(item.route)}
                  activeOpacity={0.7}
                >
                  <FontAwesome 
                    name={item.icon as any} 
                    size={18} 
                    color={
                      item.icon === 'heart' 
                        ? '#e74c3c' 
                        : isDarkMode 
                          ? 'rgba(255,255,255,0.8)'
                          : AppColors.secondary
                    } 
                    style={{ width: 24 }} 
                  />
                  <View style={{ marginLeft: 15, flex: 1 }}>
                    <Text style={{
                      fontSize: 16,
                      fontWeight: '500',
                      color: colors.text
                    }}>
                      {item.title}
                    </Text>
                    <Text style={{
                      fontSize: 12,
                      color: colors.subText,
                      marginTop: 2
                    }}>
                      {item.description}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
            <View style={{
              borderTopWidth: 1,
              borderTopColor: colors.border,
              paddingTop: 15,
              paddingBottom: Math.max(insets.bottom, 20),
              marginTop: 10
            }}>
              <TouchableOpacity
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingHorizontal: 20,
                  paddingVertical: 12,
                  marginHorizontal: 10,
                  borderRadius: 8,
                  backgroundColor: 'transparent'
                }}
                onPress={handleThemeToggle}
                activeOpacity={0.7}
              >
                <FontAwesome 
                  name={isDarkMode ? 'sun-o' : 'moon-o'} 
                  size={18} 
                  color={colors.text} 
                  style={{ width: 24 }} 
                />
                <View style={{ marginLeft: 15, flex: 1 }}>
                  <Text style={{
                    fontSize: 16,
                    fontWeight: '500',
                    color: colors.text
                  }}>
                    {isDarkMode ? 'Light Mode' : 'Dark Mode'}
                  </Text>
                  <Text style={{
                    fontSize: 12,
                    color: colors.subText,
                    marginTop: 2
                  }}>
                    Switch color theme
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingHorizontal: 20,
                  paddingVertical: 12,
                  marginHorizontal: 10,
                  borderRadius: 8,
                  backgroundColor: 'transparent'
                }}
                onPress={handleLogout}
                activeOpacity={0.7}
              >
                <FontAwesome 
                  name="sign-out" 
                  size={18} 
                  color="#e74c3c" 
                  style={{ width: 24 }} 
                />
                <View style={{ marginLeft: 15, flex: 1 }}>
                  <Text style={{
                    fontSize: 16,
                    fontWeight: '500',
                    color: '#e74c3c'
                  }}>
                    Logout
                  </Text>
                  <Text style={{
                    fontSize: 12,
                    color: colors.subText,
                    marginTop: 2
                  }}>
                    Sign out of your account
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </SafeAreaView>
      </View>
      
      <ConfirmationModal
        visible={showLogoutModal}
        title="Sign Out"
        message="Are you sure you want to sign out of your account? You will need to log in again to access your data."
        confirmText="Sign Out"
        cancelText="Cancel"
        destructive={true}
        onConfirm={() => {
          setShowLogoutModal(false);
          performLogout();
        }}
        onCancel={() => setShowLogoutModal(false)}
      />
    </React.Fragment>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  overlayTouch: {
    flex: 1,
  },
  sidebar: {
    width: width * 0.8,
    maxWidth: 320,
    height: '100%',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    paddingTop: 20,
    paddingBottom: 25,
    paddingHorizontal: 20,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  logoCircle: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    padding: 8,
  },
  logoImage: {
    width: 30,
    height: 30,
    borderRadius: 15,
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 2,
  },
  headerSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '500',
  },
  closeButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  menuContainer: {
    flex: 1,
    paddingTop: 10,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  menuSection: {
    marginBottom: 25,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    marginLeft: 20,
    marginBottom: 12,
    marginTop: 10,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginHorizontal: 12,
    marginVertical: 2,
    borderRadius: 12,
  },
  menuIconContainer: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  menuText: {
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
  },
  footerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerText: {
    fontSize: 12,
    marginLeft: 8,
    fontWeight: '500',
  },
});