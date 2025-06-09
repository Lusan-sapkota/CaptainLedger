import React, { useState, useEffect } from 'react';
import { StyleSheet, ScrollView, TouchableOpacity, Switch, Alert, Platform, View as RNView } from 'react-native';
import { Stack } from 'expo-router';
import { Text, View } from '@/components/Themed';
import { AppColors } from './(tabs)/_layout';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useTheme } from '@/components/ThemeProvider';
import AsyncStorage from '@react-native-async-storage/async-storage';

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

export default function SettingsScreen() {
  const { isDarkMode, colors, toggleTheme } = useTheme();
  
  // Settings state
  const [autoSync, setAutoSync] = useState(true);
  const [notifications, setNotifications] = useState(true);
  const [biometricLogin, setBiometricLogin] = useState(false);
  const [exportEnabled, setExportEnabled] = useState(true);
  const [currencyCode, setCurrencyCode] = useState('USD');
  const [language, setLanguage] = useState('English');
  
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
  
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen 
        options={{ 
          headerStyle: {
            backgroundColor: isDarkMode ? colors.cardBackground : AppColors.primary,
          },
          headerTintColor: isDarkMode ? colors.text : AppColors.white,
        }} 
      />
      
      <ScrollView style={{ flex: 1 }}>
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
            "Export Data",
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
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  section: {
    margin: 16,
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 8,
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
});