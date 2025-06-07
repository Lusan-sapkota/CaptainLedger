import React from 'react';
import { StyleSheet, View, ScrollView, TouchableOpacity } from 'react-native';
import { Text } from '@/components/Themed';
import { Stack } from 'expo-router';
import { useTheme } from '@/components/ThemeProvider';
import { AppColors } from './(tabs)/_layout';

export default function PrivacyScreen() {
  const { isDarkMode, colors } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen 
        options={{ 
          title: "Privacy Policy",
          headerStyle: {
            backgroundColor: isDarkMode ? colors.cardBackground : AppColors.primary,
          },
          headerTintColor: isDarkMode ? colors.text : AppColors.white,
        }} 
      />
      
      <ScrollView style={styles.scrollView}>
        <View style={[styles.content, { backgroundColor: colors.cardBackground }]}>
          <Text style={[styles.title, { color: colors.text }]}>Privacy Policy</Text>
          <Text style={[styles.lastUpdated, { color: colors.subText }]}>Last updated: January 2023</Text>
          
          <Text style={[styles.paragraph, { color: colors.text }]}>
            Your privacy is critically important to us. This Privacy Policy outlines the types of information we collect
            and how we use it to provide and improve our service while respecting your privacy rights.
          </Text>
          
          <Text style={[styles.sectionTitle, { color: colors.text }]}>1. Information Collection and Usage</Text>
          <Text style={[styles.paragraph, { color: colors.text }]}>
            CaptainLedger is designed with privacy as a core feature. We collect minimal information necessary to provide the service:
          </Text>
          <Text style={[styles.bulletPoint, { color: colors.text }]}>
            • <Text style={{ fontWeight: 'bold' }}>Account Information:</Text> Email, name, and password (encrypted) for account creation
          </Text>
          <Text style={[styles.bulletPoint, { color: colors.text }]}>
            • <Text style={{ fontWeight: 'bold' }}>Financial Data:</Text> By default, all financial data is stored locally on your device
          </Text>
          <Text style={[styles.bulletPoint, { color: colors.text }]}>
            • <Text style={{ fontWeight: 'bold' }}>Optional Information:</Text> Country and gender (if provided during signup)
          </Text>
          
          <Text style={[styles.sectionTitle, { color: colors.text }]}>2. Data Storage and Sync</Text>
          <Text style={[styles.paragraph, { color: colors.text }]}>
            CaptainLedger operates as an offline-first application:
          </Text>
          <Text style={[styles.bulletPoint, { color: colors.text }]}>
            • <Text style={{ fontWeight: 'bold' }}>Local Storage:</Text> Your financial data is stored locally on your device using secure storage
          </Text>
          <Text style={[styles.bulletPoint, { color: colors.text }]}>
            • <Text style={{ fontWeight: 'bold' }}>Optional Sync:</Text> If you enable the sync feature, your data will be synced with your self-hosted server only
          </Text>
          <Text style={[styles.bulletPoint, { color: colors.text }]}>
            • <Text style={{ fontWeight: 'bold' }}>No Third-Party Cloud Storage:</Text> We do not store your financial data on any third-party cloud services
          </Text>
          
          <Text style={[styles.sectionTitle, { color: colors.text }]}>3. Data Ownership</Text>
          <Text style={[styles.paragraph, { color: colors.text }]}>
            You retain full ownership of your data. We do not sell, rent, or share your personal information with third parties.
          </Text>
          
          <Text style={[styles.sectionTitle, { color: colors.text }]}>4. Security</Text>
          <Text style={[styles.paragraph, { color: colors.text }]}>
            We implement appropriate security measures to protect against unauthorized access, alteration, disclosure, or destruction of your personal information:
          </Text>
          <Text style={[styles.bulletPoint, { color: colors.text }]}>
            • Passwords are securely hashed and never stored in plain text
          </Text>
          <Text style={[styles.bulletPoint, { color: colors.text }]}>
            • Data transmission uses industry-standard encryption protocols
          </Text>
          <Text style={[styles.bulletPoint, { color: colors.text }]}>
            • Self-hosted sync gives you complete control over your data security
          </Text>
          
          <Text style={[styles.sectionTitle, { color: colors.text }]}>5. Analytics and Crash Reporting</Text>
          <Text style={[styles.paragraph, { color: colors.text }]}>
            We use minimal anonymous analytics to improve the application. This data does not include any of your financial information or personally identifiable information.
          </Text>
          
          <Text style={[styles.sectionTitle, { color: colors.text }]}>6. Your Rights</Text>
          <Text style={[styles.paragraph, { color: colors.text }]}>
            You have the right to:
          </Text>
          <Text style={[styles.bulletPoint, { color: colors.text }]}>
            • Access and export your personal data
          </Text>
          <Text style={[styles.bulletPoint, { color: colors.text }]}>
            • Correct any inaccuracies in your personal data
          </Text>
          <Text style={[styles.bulletPoint, { color: colors.text }]}>
            • Delete your account and associated data
          </Text>
          
          <Text style={[styles.sectionTitle, { color: colors.text }]}>7. Changes to This Policy</Text>
          <Text style={[styles.paragraph, { color: colors.text }]}>
            We may update our Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last updated" date.
          </Text>
          
          <Text style={[styles.sectionTitle, { color: colors.text }]}>8. Contact Us</Text>
          <Text style={[styles.paragraph, { color: colors.text }]}>
            If you have any questions about this Privacy Policy, please contact us at privacy@captainledger.com.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
    margin: 16,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  lastUpdated: {
    fontSize: 14,
    fontStyle: 'italic',
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 20,
    marginBottom: 10,
  },
  paragraph: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 15,
  },
  bulletPoint: {
    fontSize: 15,
    lineHeight: 22,
    marginLeft: 15,
    marginBottom: 10,
  }
});