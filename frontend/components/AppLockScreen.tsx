import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image,
  Dimensions,
  StatusBar
} from 'react-native';
import { useTheme } from '@/components/ThemeProvider';
import { AppColors } from '../app/(tabs)/_layout';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import BiometricAuthManager from '@/utils/biometricAuth';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface AppLockScreenProps {
  onUnlock: () => void;
  onBiometricLogin?: (userData: any) => void;
}

const { width, height } = Dimensions.get('window');

export default function AppLockScreen({ onUnlock, onBiometricLogin }: AppLockScreenProps) {
  const { isDarkMode, colors } = useTheme();
  const [loading, setLoading] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricType, setBiometricType] = useState('');
  const [canUseBiometric, setCanUseBiometric] = useState(false);

  useEffect(() => {
    checkBiometricCapabilities();
  }, []);

  const checkBiometricCapabilities = async () => {
    try {
      const isAvailable = await BiometricAuthManager.isAvailable();
      const shouldOffer = await BiometricAuthManager.shouldOfferBiometricLogin();
      const description = await BiometricAuthManager.getBiometricDescription();
      
      setBiometricAvailable(isAvailable);
      setBiometricType(description);
      setCanUseBiometric(shouldOffer);
    } catch (error) {
      console.error('Error checking biometric capabilities:', error);
    }
  };

  const handleBiometricAuth = async () => {
    setLoading(true);
    try {
      const result = await BiometricAuthManager.performBiometricLogin();
      
      if (result.success && result.userData) {
        // Clear app lock timer
        await BiometricAuthManager.clearAppLockTimer();
        
        // If we have biometric login callback, use it
        if (onBiometricLogin) {
          onBiometricLogin(result.userData);
        } else {
          onUnlock();
        }
      } else {
        Alert.alert(
          'Authentication Failed',
          result.error || 'Biometric authentication failed. Please try again.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Biometric authentication error:', error);
      Alert.alert(
        'Authentication Error',
        'An error occurred during biometric authentication. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setLoading(false);
    }
  };

  const handlePasscodeAuth = async () => {
    try {
      // For now, we'll use a simple authentication check
      // In a real app, you might want to implement a passcode screen
      const authResult = await BiometricAuthManager.authenticate(
        'Use your device passcode to unlock CaptainLedger',
        'Use Passcode'
      );

      if (authResult.success) {
        await BiometricAuthManager.clearAppLockTimer();
        onUnlock();
      } else {
        Alert.alert(
          'Authentication Failed',
          'Please use your device authentication to unlock the app.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Passcode authentication error:', error);
      Alert.alert(
        'Authentication Error',
        'An error occurred during authentication. Please try again.',
        [{ text: 'OK' }]
      );
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout? You will need to sign in again.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            try {
              // Clear all auth data
              await AsyncStorage.multiRemove([
                'auth_token',
                'user_id',
                'user_email',
                'is_authenticated',
                'auth_expiration',
                'last_activity',
                'device_id'
              ]);
              
              // Clear biometric data
              await BiometricAuthManager.disableBiometric();
              await BiometricAuthManager.clearAppLockTimer();
              
              // Navigate to auth screen
              onUnlock(); // This should trigger a navigation to auth
            } catch (error) {
              console.error('Logout error:', error);
            }
          }
        }
      ]
    );
  };

  const getBiometricIcon = () => {
    if (biometricType.includes('Face')) {
      return 'user-circle';
    } else if (biometricType.includes('Fingerprint')) {
      return 'fingerprint';
    } else {
      return 'lock';
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      
      {/* App Logo and Title */}
      <View style={styles.header}>
        <Image 
          source={require('../assets/images/icon.png')} 
          style={styles.logo}
        />
        <Text style={[styles.appName, { color: colors.text }]}>CaptainLedger</Text>
        <Text style={[styles.subtitle, { color: colors.subText }]}>
          App is locked for your security
        </Text>
      </View>

      {/* Authentication Section */}
      <View style={styles.authSection}>
        {canUseBiometric && (
          <TouchableOpacity
            style={[styles.biometricButton, { backgroundColor: AppColors.primary }]}
            onPress={handleBiometricAuth}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="large" />
            ) : (
              <>
                <FontAwesome 
                  name={getBiometricIcon() as any} 
                  size={32} 
                  color="#fff" 
                  style={styles.biometricIcon}
                />
                <Text style={styles.biometricButtonText}>
                  Use {biometricType}
                </Text>
              </>
            )}
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[
            styles.passcodeButton,
            { 
              backgroundColor: 'transparent',
              borderColor: colors.border,
              borderWidth: 1
            }
          ]}
          onPress={handlePasscodeAuth}
          disabled={loading}
        >
          <FontAwesome 
            name="keyboard-o" 
            size={20} 
            color={colors.text} 
            style={styles.passcodeIcon}
          />
          <Text style={[styles.passcodeButtonText, { color: colors.text }]}>
            Use Device Passcode
          </Text>
        </TouchableOpacity>
      </View>

      {/* Footer Options */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogout}
        >
          <FontAwesome name="sign-out" size={16} color={colors.subText} />
          <Text style={[styles.logoutText, { color: colors.subText }]}>
            Sign out
          </Text>
        </TouchableOpacity>
      </View>

      {/* Background decoration */}
      <View style={[styles.backgroundDecoration, { backgroundColor: AppColors.primary + '10' }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    position: 'relative',
  },
  header: {
    alignItems: 'center',
    marginBottom: 60,
  },
  logo: {
    width: 80,
    height: 80,
    borderRadius: 20,
    marginBottom: 16,
  },
  appName: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
  },
  authSection: {
    width: '100%',
    maxWidth: 300,
    alignItems: 'center',
  },
  biometricButton: {
    width: '100%',
    paddingVertical: 20,
    paddingHorizontal: 24,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    minHeight: 80,
  },
  biometricIcon: {
    marginBottom: 8,
  },
  biometricButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  passcodeButton: {
    width: '100%',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  passcodeIcon: {
    marginRight: 8,
  },
  passcodeButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
  footer: {
    position: 'absolute',
    bottom: 50,
    alignItems: 'center',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  logoutText: {
    fontSize: 16,
    marginLeft: 8,
    fontWeight: '500',
  },
  backgroundDecoration: {
    position: 'absolute',
    top: -100,
    right: -100,
    width: 200,
    height: 200,
    borderRadius: 100,
    opacity: 0.1,
  },
});
