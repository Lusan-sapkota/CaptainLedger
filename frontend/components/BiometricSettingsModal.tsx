import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  ActivityIndicator,
  Alert,
  Switch
} from 'react-native';
import { useTheme } from '@/components/ThemeProvider';
import { AppColors } from '../app/(tabs)/_layout';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import BiometricAuthManager, { BiometricConfig } from '@/utils/biometricAuth';

interface BiometricSettingsModalProps {
  visible: boolean;
  onClose: () => void;
  onBiometricChanged: (enabled: boolean) => void;
  onAppLockChanged: (enabled: boolean) => void;
  currentUserData?: { email: string; userId: string };
}

export default function BiometricSettingsModal({
  visible,
  onClose,
  onBiometricChanged,
  onAppLockChanged,
  currentUserData
}: BiometricSettingsModalProps) {
  const { isDarkMode, colors } = useTheme();
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState<BiometricConfig>({
    biometricEnabled: false,
    appLockEnabled: false,
    lockTimeout: 5
  });
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricType, setBiometricType] = useState('');

  useEffect(() => {
    if (visible) {
      loadSettings();
    }
  }, [visible]);

  const loadSettings = async () => {
    try {
      setLoading(true);
      
      const [currentConfig, isAvailable, description] = await Promise.all([
        BiometricAuthManager.getBiometricConfig(),
        BiometricAuthManager.isAvailable(),
        BiometricAuthManager.getBiometricDescription()
      ]);

      setConfig(currentConfig);
      setBiometricAvailable(isAvailable);
      setBiometricType(description);
    } catch (error) {
      console.error('Error loading biometric settings:', error);
      Alert.alert('Error', 'Failed to load security settings');
    } finally {
      setLoading(false);
    }
  };

  const handleBiometricToggle = async (enabled: boolean) => {
    if (!biometricAvailable) {
      Alert.alert(
        'Biometric Not Available',
        'Biometric authentication is not available on this device or no biometric data is enrolled.',
        [{ text: 'OK' }]
      );
      return;
    }

    if (!currentUserData) {
      Alert.alert(
        'Error',
        'Unable to enable biometric authentication. Please try logging out and back in.',
        [{ text: 'OK' }]
      );
      return;
    }

    setLoading(true);
    try {
      let success = false;

      if (enabled) {
        success = await BiometricAuthManager.enableBiometric(currentUserData);
        if (success) {
          Alert.alert(
            'Biometric Authentication Enabled',
            `${biometricType} has been enabled for CaptainLedger. You can now use it to sign in and unlock the app.`,
            [{ text: 'OK' }]
          );
        }
      } else {
        // Confirm disabling biometric authentication
        Alert.alert(
          'Disable Biometric Authentication',
          'Are you sure you want to disable biometric authentication? You will need to use your password to sign in.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Disable',
              style: 'destructive',
              onPress: async () => {
                const disableSuccess = await BiometricAuthManager.disableBiometric();
                if (disableSuccess) {
                  setConfig(prev => ({ ...prev, biometricEnabled: false }));
                  onBiometricChanged(false);
                  Alert.alert(
                    'Biometric Authentication Disabled',
                    'Biometric authentication has been disabled.',
                    [{ text: 'OK' }]
                  );
                }
              }
            }
          ]
        );
        return;
      }

      if (success) {
        setConfig(prev => ({ ...prev, biometricEnabled: enabled }));
        onBiometricChanged(enabled);
      } else {
        Alert.alert(
          'Authentication Failed',
          'Failed to enable biometric authentication. Please try again.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Error toggling biometric authentication:', error);
      Alert.alert(
        'Error',
        'An error occurred while updating biometric settings.',
        [{ text: 'OK' }]
      );
    } finally {
      setLoading(false);
    }
  };

  const handleAppLockToggle = async (enabled: boolean) => {
    setLoading(true);
    try {
      let success = false;

      if (enabled) {
        success = await BiometricAuthManager.enableAppLock(config.lockTimeout);
      } else {
        success = await BiometricAuthManager.disableAppLock();
      }

      if (success) {
        setConfig(prev => ({ ...prev, appLockEnabled: enabled }));
        onAppLockChanged(enabled);
        
        if (enabled) {
          Alert.alert(
            'App Lock Enabled',
            `The app will now lock after ${config.lockTimeout} minutes of inactivity.`,
            [{ text: 'OK' }]
          );
        } else {
          Alert.alert(
            'App Lock Disabled',
            'The app will no longer automatically lock.',
            [{ text: 'OK' }]
          );
        }
      } else {
        Alert.alert(
          'Error',
          'Failed to update app lock settings. Please try again.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Error toggling app lock:', error);
      Alert.alert(
        'Error',
        'An error occurred while updating app lock settings.',
        [{ text: 'OK' }]
      );
    } finally {
      setLoading(false);
    }
  };

  const handleTimeoutChange = (minutes: number) => {
    Alert.alert(
      'Change Lock Timeout',
      `Set app lock timeout to ${minutes} minutes?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Update',
          onPress: async () => {
            const success = await BiometricAuthManager.setAppLockTimeout(minutes);
            if (success) {
              setConfig(prev => ({ ...prev, lockTimeout: minutes }));
              Alert.alert(
                'Timeout Updated',
                `App will now lock after ${minutes} minutes of inactivity.`,
                [{ text: 'OK' }]
              );
            }
          }
        }
      ]
    );
  };

  const timeoutOptions = [
    { label: 'Immediately', value: 0 },
    { label: '1 minute', value: 1 },
    { label: '5 minutes', value: 5 },
    { label: '15 minutes', value: 15 },
    { label: '30 minutes', value: 30 },
    { label: '1 hour', value: 60 }
  ];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: colors.cardBackground }]}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <FontAwesome name="times" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.text }]}>Security Settings</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {loading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={AppColors.primary} />
              <Text style={[styles.loadingText, { color: colors.subText }]}>
                Loading settings...
              </Text>
            </View>
          )}

          {/* Biometric Authentication Section */}
          <View style={[styles.section, { backgroundColor: colors.cardBackground }]}>
            <View style={styles.sectionHeader}>
              <FontAwesome name="user-secret" size={24} color={AppColors.primary} />
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Biometric Authentication
              </Text>
            </View>

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={[styles.settingLabel, { color: colors.text }]}>
                  Enable {biometricType}
                </Text>
                <Text style={[styles.settingDescription, { color: colors.subText }]}>
                  {biometricAvailable 
                    ? `Use ${biometricType} to sign in and unlock the app`
                    : 'Biometric authentication is not available on this device'
                  }
                </Text>
              </View>
              <Switch
                value={config.biometricEnabled}
                onValueChange={handleBiometricToggle}
                disabled={!biometricAvailable || loading}
                trackColor={{ false: colors.border, true: AppColors.primary }}
                thumbColor="#fff"
              />
            </View>
          </View>

          {/* App Lock Section */}
          <View style={[styles.section, { backgroundColor: colors.cardBackground }]}>
            <View style={styles.sectionHeader}>
              <FontAwesome name="lock" size={24} color={AppColors.primary} />
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                App Lock
              </Text>
            </View>

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={[styles.settingLabel, { color: colors.text }]}>
                  Enable App Lock
                </Text>
                <Text style={[styles.settingDescription, { color: colors.subText }]}>
                  Require authentication when app becomes active
                </Text>
              </View>
              <Switch
                value={config.appLockEnabled}
                onValueChange={handleAppLockToggle}
                disabled={loading}
                trackColor={{ false: colors.border, true: AppColors.primary }}
                thumbColor="#fff"
              />
            </View>

            {/* Lock Timeout Options */}
            {config.appLockEnabled && (
              <View style={styles.timeoutSection}>
                <Text style={[styles.timeoutTitle, { color: colors.text }]}>
                  Lock After
                </Text>
                <View style={styles.timeoutOptions}>
                  {timeoutOptions.map((option) => (
                    <TouchableOpacity
                      key={option.value}
                      style={[
                        styles.timeoutOption,
                        { 
                          backgroundColor: config.lockTimeout === option.value 
                            ? AppColors.primary + '20' 
                            : 'transparent',
                          borderColor: config.lockTimeout === option.value 
                            ? AppColors.primary 
                            : colors.border
                        }
                      ]}
                      onPress={() => handleTimeoutChange(option.value)}
                    >
                      <Text style={[
                        styles.timeoutOptionText,
                        { 
                          color: config.lockTimeout === option.value 
                            ? AppColors.primary 
                            : colors.text 
                        }
                      ]}>
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
          </View>

          {/* Security Tips */}
          <View style={[styles.section, { backgroundColor: colors.cardBackground }]}>
            <View style={styles.sectionHeader}>
              <FontAwesome name="shield" size={24} color={AppColors.warning} />
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Security Tips
              </Text>
            </View>

            <View style={styles.tipsContainer}>
              <Text style={[styles.tipText, { color: colors.subText }]}>
                • Enable both biometric authentication and app lock for maximum security
              </Text>
              <Text style={[styles.tipText, { color: colors.subText }]}>
                • Use a shorter lock timeout if you're concerned about unauthorized access
              </Text>
              <Text style={[styles.tipText, { color: colors.subText }]}>
                • Biometric data is stored securely on your device and never sent to our servers
              </Text>
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  closeButton: {
    padding: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
  },
  section: {
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 12,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  settingInfo: {
    flex: 1,
    marginRight: 16,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  timeoutSection: {
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  timeoutTitle: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 12,
  },
  timeoutOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  timeoutOption: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
  },
  timeoutOptionText: {
    fontSize: 14,
    fontWeight: '500',
  },
  tipsContainer: {
    gap: 8,
  },
  tipText: {
    fontSize: 14,
    lineHeight: 20,
  },
});
