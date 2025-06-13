import React, { useState, useEffect } from 'react';
import { StyleSheet, ScrollView, TouchableOpacity, Switch, Alert, Platform, View as RNView, ActivityIndicator, Modal } from 'react-native';
import { Stack } from 'expo-router';
import { Text, View } from '@/components/Themed';
import { AppColors } from './(tabs)/_layout';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useTheme } from '@/components/ThemeProvider';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { removeTrustedDevice, exportDatabase, importDatabase, importDatabaseFromUri, getImportOptions } from '@/services/api';
import { getDeviceIdentifier } from '@/utils/device';
import sessionManager from '@/utils/sessionManager';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useAlert } from '@/components/AlertProvider';
import BiometricAuthManager from '@/utils/biometricAuth';
import BiometricSettingsModal from '@/components/BiometricSettingsModal';

const LoginHistoryList = ({ colors }: { colors: any }) => {
  const [loginHistory, setLoginHistory] = useState<any[]>([]);
  
  useEffect(() => {
    async function getLoginHistory() {
      try {
        const history = await AsyncStorage.getItem('login_history');
        if (history) {
          setLoginHistory(JSON.parse(history));
        }
      } catch (e) {
        console.error('Error loading login history:', e);
      }
    }
    
    getLoginHistory();
  }, []);
  
  if (loginHistory.length === 0) {
    return (
      <RNView style={[styles.emptyHistoryContainer, { backgroundColor: 'transparent' }]}>
        <Text style={[styles.emptyHistoryText, { color: colors.subText }]}>
          No login history available
        </Text>
      </RNView>
    );
  }
  
  const formatLoginDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  const getLoginTypeIcon = (type: string) => {
    switch (type) {
      case 'login': return 'sign-in';
      case 'logout': return 'sign-out';
      case 'guest': return 'user-secret';
      default: return 'question-circle';
    }
  };
  
  const getLoginTypeColor = (type: string) => {
    switch (type) {
      case 'login': return AppColors.primary;
      case 'logout': return AppColors.danger;
      case 'guest': return AppColors.secondary;
      default: return colors.subText;
    }
  };
  
  return (
    <RNView style={{ backgroundColor: 'transparent' }}>
      {loginHistory.slice().reverse().map((login, index) => (
        <RNView 
          key={index} 
          style={[
            styles.loginHistoryItem, 
            index < loginHistory.length - 1 && { 
              borderBottomWidth: 1, 
              borderBottomColor: colors.border 
            },
            { backgroundColor: 'transparent' }
          ]}
        >
          <RNView style={[styles.loginIconContainer, { backgroundColor: getLoginTypeColor(login.type) }]}>
            <FontAwesome name={getLoginTypeIcon(login.type)} size={14} color="white" />
          </RNView>
          <RNView style={{ flex: 1, backgroundColor: 'transparent' }}>
            <Text style={[styles.loginType, { color: colors.text }]}>
              {login.type === 'login' ? 'Sign In' : login.type === 'logout' ? 'Sign Out' : 'Guest Access'}
            </Text>
            <Text style={[styles.loginDevice, { color: colors.subText }]}>
              {login.device || 'Unknown device'}
            </Text>
          </RNView>
          <Text style={[styles.loginDate, { color: colors.subText }]}>
            {formatLoginDate(login.date)}
          </Text>
        </RNView>
      ))}
    </RNView>
  );
};

const SessionInfo = ({ colors }: { colors: any }) => {
  const [sessionInfo, setSessionInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSessionInfo();
  }, []);

  const loadSessionInfo = async () => {
    try {
      setLoading(true);
      const info = await sessionManager.getSessionInfo();
      setSessionInfo(info);
    } catch (error) {
      console.error('Error loading session info:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <RNView style={[styles.sessionContainer, { backgroundColor: colors.cardBackground }]}>
        <ActivityIndicator size="small" color={AppColors.primary} />
      </RNView>
    );
  }

  return (
    <RNView style={[styles.sessionContainer, { backgroundColor: colors.cardBackground }]}>
      <Text style={[styles.sessionTitle, { color: colors.text }]}>
        <FontAwesome name="shield" size={16} color={AppColors.primary} /> Session Information
      </Text>
      
      <RNView style={styles.sessionItem}>
        <Text style={[styles.sessionLabel, { color: colors.subText }]}>Status:</Text>
        <Text style={[styles.sessionValue, { 
          color: sessionInfo?.isValid ? AppColors.primary : AppColors.danger 
        }]}>
          {sessionInfo?.isValid ? 'Active' : 'Expired'}
        </Text>
      </RNView>

      {sessionInfo?.daysRemaining !== null && (
        <RNView style={styles.sessionItem}>
          <Text style={[styles.sessionLabel, { color: colors.subText }]}>Days Remaining:</Text>
          <Text style={[styles.sessionValue, { 
            color: sessionInfo.daysRemaining < 7 ? AppColors.warning : colors.text 
          }]}>
            {sessionInfo.daysRemaining}
          </Text>
        </RNView>
      )}

      {sessionInfo?.createdAt && (
        <RNView style={styles.sessionItem}>
          <Text style={[styles.sessionLabel, { color: colors.subText }]}>Session Created:</Text>
          <Text style={[styles.sessionValue, { color: colors.text }]}>
            {new Date(sessionInfo.createdAt).toLocaleString()}
          </Text>
        </RNView>
      )}

      {sessionInfo?.lastActivity && (
        <RNView style={styles.sessionItem}>
          <Text style={[styles.sessionLabel, { color: colors.subText }]}>Last Activity:</Text>
          <Text style={[styles.sessionValue, { color: colors.text }]}>
            {new Date(sessionInfo.lastActivity).toLocaleString()}
          </Text>
        </RNView>
      )}

      <TouchableOpacity 
        style={[styles.refreshButton, { borderColor: AppColors.primary }]}
        onPress={loadSessionInfo}
      >
        <FontAwesome name="refresh" size={14} color={AppColors.primary} />
        <Text style={[styles.refreshText, { color: AppColors.primary }]}>Refresh</Text>
      </TouchableOpacity>
    </RNView>
  );
};

const TrustedDevicesSection = ({ colors }: { colors: any }) => {
  const [trustedDevices, setTrustedDevices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTrustedDevices();
  }, []);

  const loadTrustedDevices = async () => {
    try {
      setLoading(true);
      const keys = await AsyncStorage.getAllKeys();
      const trustedDeviceKeys = keys.filter(key => key.startsWith('trusted_device_') && !key.includes('_name_') && !key.includes('_date_'));
      
      const devices = [];
      for (const key of trustedDeviceKeys) {
        const deviceId = key.replace('trusted_device_', '');
        const deviceName = await AsyncStorage.getItem(`trusted_device_name_${deviceId}`) || 'Unknown Device';
        const deviceDate = await AsyncStorage.getItem(`trusted_device_date_${deviceId}`);
        const currentDeviceId = await getDeviceIdentifier();
        
        devices.push({
          id: deviceId,
          name: deviceName,
          date: deviceDate,
          isCurrent: deviceId === currentDeviceId
        });
      }
      
      setTrustedDevices(devices);
    } catch (error) {
      console.error('Error loading trusted devices:', error);
    } finally {
      setLoading(false);
    }
  };

  const removeTrustedDeviceLocal = async (deviceId: string) => {
    Alert.alert(
      'Remove Trusted Device',
      'Are you sure you want to remove this trusted device? You will receive login notifications from this device again.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await AsyncStorage.multiRemove([
                `trusted_device_${deviceId}`,
                `trusted_device_name_${deviceId}`,
                `trusted_device_date_${deviceId}`
              ]);
              
              // Also try to remove from server
              try {
                await removeTrustedDevice(deviceId);
              } catch (serverError) {
                console.log('Failed to remove device from server:', serverError);
              }
              
              loadTrustedDevices();
            } catch (error) {
              console.error('Error removing trusted device:', error);
              Alert.alert('Error', 'Failed to remove trusted device');
            }
          }
        }
      ]
    );
  };

  if (loading) {
    return (
      <RNView style={{ padding: 20, alignItems: 'center', backgroundColor: 'transparent' }}>
        <ActivityIndicator size="small" color={AppColors.primary} />
      </RNView>
    );
  }

  if (trustedDevices.length === 0) {
    return (
      <RNView style={{ padding: 20, alignItems: 'center', backgroundColor: 'transparent' }}>
        <Text style={[styles.emptyText, { color: colors.subText }]}>No trusted devices</Text>
      </RNView>
    );
  }

  return (
    <RNView style={{ backgroundColor: 'transparent' }}>
      {trustedDevices.map((device, index) => (
        <RNView key={device.id} style={[
          styles.deviceItem, 
          index < trustedDevices.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border },
          { backgroundColor: 'transparent' }
        ]}>
          <RNView style={styles.deviceInfo}>
            <Text style={[styles.deviceName, { color: colors.text }]}>
              {device.name} {device.isCurrent && '(This device)'}
            </Text>
            {device.date && (
              <Text style={[styles.deviceDate, { color: colors.subText }]}>
                Added: {new Date(device.date).toLocaleDateString()}
              </Text>
            )}
          </RNView>
          
          {!device.isCurrent && (
            <TouchableOpacity
              style={styles.removeButton}
              onPress={() => removeTrustedDeviceLocal(device.id)}
            >
              <FontAwesome name="trash" size={16} color={AppColors.danger} />
            </TouchableOpacity>
          )}
        </RNView>
      ))}
      
      <TouchableOpacity 
        style={[styles.refreshButton, { borderColor: AppColors.primary }]}
        onPress={loadTrustedDevices}
      >
        <FontAwesome name="refresh" size={14} color={AppColors.primary} />
        <Text style={[styles.refreshText, { color: AppColors.primary }]}>Refresh</Text>
      </TouchableOpacity>
    </RNView>
  );
};

// Add this component to show import options modal
const ImportOptionsModal = ({ visible, onClose, onImport }: {
  visible: boolean;
  onClose: () => void;
  onImport: (mergeStrategy: string) => void;
}) => {
  const { colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [mergeStrategies, setMergeStrategies] = useState<Array<{
    id: string;
    name: string;
    description: string;
  }>>([]);
  const [selectedStrategy, setSelectedStrategy] = useState<string>('newest_wins');
  
  useEffect(() => {
    if (visible) {
      loadImportOptions();
    }
  }, [visible]);
  
  const loadImportOptions = async () => {
    try {
      setLoading(true);
      const response = await getImportOptions();
      setMergeStrategies(response.data.merge_strategies);
      setSelectedStrategy(response.data.merge_strategies[0]?.id || 'newest_wins');
    } catch (error) {
      console.error('Error loading import options:', error);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <RNView style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
        <RNView style={[styles.modalContent, { backgroundColor: colors.cardBackground }]}>
          <Text style={[styles.modalTitle, { color: colors.text }]}>Import Options</Text>
          
          <Text style={[styles.modalSubtitle, { color: colors.text }]}>
            Select how to handle conflicting data:
          </Text>
          
          {loading ? (
            <ActivityIndicator size="small" color={AppColors.primary} />
          ) : (
            <RNView style={styles.strategyContainer}>
              {mergeStrategies.map((strategy) => (
                <TouchableOpacity
                  key={strategy.id}
                  style={[
                    styles.strategyOption,
                    selectedStrategy === strategy.id && styles.selectedStrategy,
                    { 
                      backgroundColor: selectedStrategy === strategy.id 
                        ? AppColors.primary 
                        : colors.cardBackground,
                      borderColor: colors.border 
                    }
                  ]}
                  onPress={() => setSelectedStrategy(strategy.id)}
                >
                  <Text style={[styles.strategyName, { 
                    color: selectedStrategy === strategy.id ? AppColors.primary : colors.text,
                    fontWeight: selectedStrategy === strategy.id ? 'bold' : 'normal'
                  }]}>
                    {strategy.name}
                  </Text>
                  <Text style={[styles.strategyDescription, { 
                    color: selectedStrategy === strategy.id ? AppColors.primary : colors.subText 
                  }]}>
                    {strategy.description}
                  </Text>
                </TouchableOpacity>
              ))}
            </RNView>
          )}
          
          <RNView style={styles.modalButtonContainer}>
            <TouchableOpacity
              style={[styles.modalButton, styles.cancelButton, { borderColor: colors.border }]}
              onPress={onClose}
            >
              <Text style={[styles.modalButtonText, { color: colors.text }]}>Cancel</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.modalButton, styles.importButton, { backgroundColor: AppColors.primary }]}
              onPress={() => onImport(selectedStrategy)}
              disabled={loading}
            >
              <Text style={[styles.modalButtonText, { color: 'white' }]}>Import</Text>
            </TouchableOpacity>
          </RNView>
        </RNView>
      </RNView>
    </Modal>
  );
};

export default function SettingsScreen() {
  const { isDarkMode, colors, toggleTheme } = useTheme();
  
  // Settings state
  const [autoSync, setAutoSync] = useState(true);
  const [notifications, setNotifications] = useState(true);
  const [biometricLogin, setBiometricLogin] = useState(false);
  const [appLock, setAppLock] = useState(false);
  const [exportEnabled, setExportEnabled] = useState(true);
  const [currencyCode, setCurrencyCode] = useState('USD');
  const [language, setLanguage] = useState('English');
  
  // Biometric settings modal
  const [biometricModalVisible, setBiometricModalVisible] = useState(false);
  const [currentUserData, setCurrentUserData] = useState<{ email: string; userId: string } | null>(null);
  
  // Add these state variables with the existing ones
  const [importOptionsVisible, setImportOptionsVisible] = useState(false);
  const [importFile, setImportFile] = useState<any>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  
  // Get access to the alert component
  const { showAlert } = useAlert();

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      // Load current user data
      const email = await AsyncStorage.getItem('user_email');
      const userId = await AsyncStorage.getItem('user_id');
      
      if (email && userId) {
        setCurrentUserData({ email, userId });
      }

      // Load biometric and app lock settings
      const config = await BiometricAuthManager.getBiometricConfig();
      setBiometricLogin(config.biometricEnabled);
      setAppLock(config.appLockEnabled);
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };
  
  const handleThemeChange = (value: boolean) => {
    toggleTheme(value);
    AsyncStorage.setItem('isDarkMode', JSON.stringify(value));
  };
  
  const renderSettingSwitch = (
    label: string, 
    description: string, 
    value: boolean, 
    onChange: (value: boolean) => void
  ) => {
    return (
      <RNView style={[styles.settingRow, { 
        borderBottomColor: colors.border,
        backgroundColor: 'transparent' 
      }]}>
        <RNView style={{ backgroundColor: 'transparent' }}>
          <Text style={[styles.settingLabel, { color: colors.text }]}>{label}</Text>
          <Text style={[styles.settingDescription, { color: colors.subText }]}>
            {description}
          </Text>
        </RNView>
        <Switch
          trackColor={{ false: '#767577', true: AppColors.primary }}
          thumbColor={value ? AppColors.primary : '#f4f3f4'}
          onValueChange={onChange}
          value={value}
        />
      </RNView>
    );
  };
  
  const renderSettingOption = (
    label: string, 
    description: string, 
    value: string,
    onPress: () => void
  ) => {
    return (
      <TouchableOpacity 
        style={[styles.settingRow, { 
          borderBottomColor: colors.border,
          backgroundColor: 'transparent'
        }]}
        onPress={onPress}
      >
        <RNView style={{ backgroundColor: 'transparent' }}>
          <Text style={[styles.settingLabel, { color: colors.text }]}>{label}</Text>
          <Text style={[styles.settingDescription, { color: colors.subText }]}>
            {description}
          </Text>
        </RNView>
        <RNView style={[styles.optionValueContainer, { backgroundColor: 'transparent' }]}>
          <Text style={[styles.optionValue, { color: AppColors.primary }]}>{value}</Text>
          <FontAwesome name="chevron-right" size={14} color={colors.subText} style={styles.chevron} />
        </RNView>
      </TouchableOpacity>
    );
  };
  
  // File picker for import
  const pickImportFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/octet-stream', // This should match SQLite .db files
        copyToCacheDirectory: true
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        // Check if it's a .db file
        if (!file.name.endsWith('.db')) {
          showAlert('Invalid File', 'Please select a valid database (.db) file', 'error');
          return;
        }

        setImportFile(file);
        setImportOptionsVisible(true);
      }
    } catch (error) {
      console.error('Error picking file:', error);
      showAlert('Error', 'Failed to open file picker', 'error');
    }
  };
  
  // Handle database import
  const handleImport = async (mergeStrategy: string) => {
    if (!importFile) {
      showAlert('Error', 'No file selected for import', 'error');
      return;
    }
    
    try {
      setImportLoading(true);
      setImportOptionsVisible(false);
      
      let importResult;
      
      // Different approach for web vs mobile
      if (Platform.OS === 'web') {
        // For web - create a blob from the file
        const response = await fetch(importFile.uri);
        const fileBlob = await response.blob();
        const result = await importDatabase(fileBlob, mergeStrategy);
        importResult = result.data;
      } else {
        // For mobile
        importResult = await importDatabaseFromUri(importFile.uri, mergeStrategy);
      }
      
      showAlert('Import Successful', 
        `Successfully imported ${importResult.total_records} records:\n` +
        `- ${importResult.records_imported.transactions} transactions\n` +
        `- ${importResult.records_imported.categories} categories\n` +
        `- ${importResult.records_imported.budgets} budgets\n` +
        `- ${importResult.records_imported.loans} loans`,
        'success'
      );
      
      // Clear the import file
      setImportFile(null);
    } catch (error) {
      console.error('Import error:', error);
      showAlert('Import Failed', 
        'There was a problem importing your data. Please try again or contact support.',
        'error'
      );
    } finally {
      setImportLoading(false);
    }
  };
  
  // Handle database export
  const handleExport = async () => {
    try {
      setExportLoading(true);
      await exportDatabase();
      showAlert('Export Successful', 'Your data has been exported successfully', 'success');
    } catch (error) {
      console.error('Export error:', error);
      showAlert('Export Failed', 
        'There was a problem exporting your data. Please try again or contact support.',
        'error'
      );
    } finally {
      setExportLoading(false);
    }
  };
  
  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ title: 'Settings', headerShown: true }} />
      
      {/* Session Information Section */}
      <SessionInfo colors={colors} />
      
      {/* Appearance */}
      <View style={[styles.section, { backgroundColor: colors.cardBackground }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Appearance</Text>
        
        {renderSettingSwitch(
          "Dark Mode", 
          "Use dark theme throughout the app", 
          isDarkMode, 
          handleThemeChange
        )}
        
        {renderSettingOption(
          "Language",
          "Choose your preferred language",
          language,
          () => Alert.alert("Language", "This feature will be available soon")
        )}
      </View>
      
      {/* Sync & Data */}
      <View style={[styles.section, { backgroundColor: colors.cardBackground }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Sync & Data</Text>
        
        {renderSettingSwitch(
          "Auto Sync",
          "Automatically sync data when connected",
          autoSync,
          setAutoSync
        )}
        
        {renderSettingOption(
          "Export Database",
          "Download complete backup of your data",
          exportLoading ? "..." : "DB",
          handleExport
        )}
        
        {renderSettingOption(
          "Import Database",
          "Restore data from a database backup",
          importLoading ? "..." : "DB",
          pickImportFile
        )}
        
        {renderSettingOption(
          "Export Transactions",
          "Export your transactions as CSV",
          "CSV",
          () => Alert.alert("Export Data", "This feature will be available soon")
        )}
        
        {renderSettingSwitch(
          "Allow Data Export",
          "Enable exporting financial data",
          exportEnabled,
          setExportEnabled
        )}
      </View>
      
      {/* Notifications */}
      <View style={[styles.section, { backgroundColor: colors.cardBackground }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Notifications</Text>
        
        {renderSettingSwitch(
          "Push Notifications",
          "Receive alerts for transactions and reminders",
          notifications,
          setNotifications
        )}
        
        {renderSettingSwitch(
          "Budget Alerts",
          "Get notified when you're close to budget limits",
          true,
          (value) => Alert.alert("Budget Alerts", value ? "Budget alerts enabled" : "Budget alerts disabled")
        )}
        
        {renderSettingSwitch(
          "Payment Reminders",
          "Receive reminders for upcoming bills",
          true,
          (value) => Alert.alert("Payment Reminders", value ? "Payment reminders enabled" : "Payment reminders disabled")
        )}
      </View>
      
      {/* Security */}
      <View style={[styles.section, { backgroundColor: colors.cardBackground }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Security</Text>
        
        {renderSettingSwitch(
          "Biometric Login",
          "Use fingerprint or face recognition",
          biometricLogin,
          setBiometricLogin
        )}
        
        {renderSettingOption(
          "Change Password",
          "Update your account password",
          "",
          () => Alert.alert("Change Password", "This feature will be available soon")
        )}
        
        {renderSettingSwitch(
          "App Lock",
          "Require authentication when app opens",
          false,
          (value) => Alert.alert("App Lock", value ? "App lock enabled" : "App lock disabled")
        )}
      </View>
      
      {/* Login History */}
      <View style={[styles.section, { backgroundColor: colors.cardBackground }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Login History</Text>
        
        <LoginHistoryList colors={colors} />
      </View>
      
      {/* Trusted Devices */}
      <View style={[styles.section, { backgroundColor: colors.cardBackground }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Trusted Devices</Text>
        <Text style={[styles.sectionDescription, { color: colors.subText }]}>
          Devices you've logged in from that won't trigger login notifications
        </Text>
        <TrustedDevicesSection colors={colors} />
      </View>
      
      {/* Preferences */}
      <View style={[styles.section, { backgroundColor: colors.cardBackground }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Preferences</Text>
        
        {renderSettingOption(
          "Currency",
          "Set your preferred currency",
          currencyCode,
          () => Alert.alert("Currency", "This feature will be available soon")
        )}
        
        {renderSettingOption(
          "Date Format",
          "Choose how dates are displayed",
          "MM/DD/YYYY",
          () => Alert.alert("Date Format", "This feature will be available soon")
        )}
      </View>
      
      {/* About */}
      <View style={[styles.section, { backgroundColor: colors.cardBackground }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>About</Text>
        
        <TouchableOpacity 
          style={[styles.settingRow, { borderBottomColor: colors.border, backgroundColor: 'transparent' }]}
          onPress={() => Alert.alert("About", "CaptainLedger v1.0.0\n\nA privacy-focused finance tracker.")}
        >
          <Text style={[styles.settingLabel, { color: colors.text }]}>About CaptainLedger</Text>
          <FontAwesome name="chevron-right" size={14} color={colors.subText} />
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.settingRow, { borderBottomColor: colors.border, backgroundColor: 'transparent' }]}
          onPress={() => Alert.alert("Privacy Policy", "Our privacy policy will be displayed here.")}
        >
          <Text style={[styles.settingLabel, { color: colors.text }]}>Privacy Policy</Text>
          <FontAwesome name="chevron-right" size={14} color={colors.subText} />
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.settingRow, { backgroundColor: 'transparent' }]}
          onPress={() => Alert.alert("Terms of Service", "Our terms of service will be displayed here.")}
        >
          <Text style={[styles.settingLabel, { color: colors.text }]}>Terms of Service</Text>
          <FontAwesome name="chevron-right" size={14} color={colors.subText} />
        </TouchableOpacity>
      </View>
      
      <Text style={[styles.versionText, { color: colors.subText }]}>
        Version 1.0.0
      </Text>
      
      {/* Import options modal */}
      <ImportOptionsModal
        visible={importOptionsVisible}
        onClose={() => setImportOptionsVisible(false)}
        onImport={handleImport}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  sessionContainer: {
    margin: 16,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  sessionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  sessionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    backgroundColor: 'transparent',
  },
  sessionLabel: {
    fontSize: 14,
  },
  sessionValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  section: {
    margin: 16,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  sectionDescription: {
    fontSize: 14,
    paddingHorizontal: 15,
    paddingBottom: 10,
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
  optionValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  optionValue: {
    fontSize: 16,
    marginRight: 6,
  },
  chevron: {
    marginTop: 2,
  },
  versionText: {
    textAlign: 'center',
    fontSize: 14,
    marginVertical: 20,
  },
  loginHistoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  loginIconContainer: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  loginType: {
    fontSize: 15,
    fontWeight: '500',
  },
  loginDevice: {
    fontSize: 13,
    marginTop: 2,
  },
  loginDate: {
    fontSize: 12,
  },
  emptyHistoryContainer: {
    padding: 20,
    alignItems: 'center',
  },
  emptyHistoryText: {
    fontSize: 14,
    fontStyle: 'italic',
  },
  deviceItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    backgroundColor: 'transparent',
  },
  deviceInfo: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  deviceName: {
    fontSize: 14,
    fontWeight: '500',
  },
  deviceDate: {
    fontSize: 12,
    marginTop: 2,
  },
  removeButton: {
    padding: 8,
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 6,
    marginTop: 12,
  },
  refreshText: {
    fontSize: 12,
    marginLeft: 6,
  },
  emptyText: {
    textAlign: 'center',
    fontStyle: 'italic',
    paddingVertical: 16,
  },
  
  // Add these new styles
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '90%',
    maxWidth: 500,
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 16,
    marginBottom: 16,
    textAlign: 'center',
  },
  strategyContainer: {
    marginBottom: 20,
  },
  strategyOption: {
    padding: 16,
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 12,
  },
  selectedStrategy: {
    borderWidth: 2,
  },
  strategyName: {
    fontSize: 16,
    marginBottom: 4,
  },
  strategyDescription: {
    fontSize: 14,
  },
  modalButtonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  modalButton: {
    padding: 12,
    borderRadius: 8,
    minWidth: 120,
    alignItems: 'center',
  },
  cancelButton: {
    borderWidth: 1,
    backgroundColor: 'transparent',
  },
  importButton: {
    borderWidth: 0,
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
});