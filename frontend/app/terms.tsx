import React from 'react';
import { StyleSheet, View, ScrollView, TouchableOpacity } from 'react-native';
import { Text } from '@/components/Themed';
import { Stack } from 'expo-router';
import { useTheme } from '@/components/ThemeProvider';
import { AppColors } from './(tabs)/_layout';

export default function TermsScreen() {
  const { isDarkMode, colors } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen 
        options={{ 
          title: "Terms & Conditions",
          headerStyle: {
            backgroundColor: isDarkMode ? colors.cardBackground : AppColors.primary,
          },
          headerTintColor: isDarkMode ? colors.text : AppColors.white,
        }} 
      />
      
      <ScrollView style={styles.scrollView}>
        <View style={[styles.content, { backgroundColor: colors.cardBackground }]}>
          <Text style={[styles.title, { color: colors.text }]}>Terms and Conditions</Text>
          <Text style={[styles.lastUpdated, { color: colors.subText }]}>Last updated: January 2023</Text>
          
          <Text style={[styles.sectionTitle, { color: colors.text }]}>1. Introduction</Text>
          <Text style={[styles.paragraph, { color: colors.text }]}>
            Welcome to CaptainLedger. These Terms and Conditions govern your use of our application and the services
            we provide. By using CaptainLedger, you agree to these terms in full. If you disagree with any part of these terms, do not use our application.
          </Text>
          
          <Text style={[styles.sectionTitle, { color: colors.text }]}>2. License</Text>
          <Text style={[styles.paragraph, { color: colors.text }]}>
            CaptainLedger grants you a limited, non-exclusive, non-transferable license to use the application for your personal, non-commercial purposes. You may not:
          </Text>
          <Text style={[styles.bulletPoint, { color: colors.text }]}>
            • Copy or modify the application or any part of it
          </Text>
          <Text style={[styles.bulletPoint, { color: colors.text }]}>
            • Reverse engineer, decompile, or disassemble the application
          </Text>
          <Text style={[styles.bulletPoint, { color: colors.text }]}>
            • Remove any copyright or other proprietary notices
          </Text>
          <Text style={[styles.bulletPoint, { color: colors.text }]}>
            • Transfer the application to another person or "mirror" it on any other server
          </Text>
          
          <Text style={[styles.sectionTitle, { color: colors.text }]}>3. Privacy</Text>
          <Text style={[styles.paragraph, { color: colors.text }]}>
            Our Privacy Policy, which is incorporated into these Terms by reference, explains how we collect, use, and protect your information.
            By using CaptainLedger, you agree to our Privacy Policy.
          </Text>
          
          <Text style={[styles.sectionTitle, { color: colors.text }]}>4. User Accounts</Text>
          <Text style={[styles.paragraph, { color: colors.text }]}>
            When you create an account with us, you must provide accurate, complete, and current information. You are responsible for safeguarding your account credentials and for any activity that occurs under your account.
          </Text>
          
          <Text style={[styles.sectionTitle, { color: colors.text }]}>5. User Data</Text>
          <Text style={[styles.paragraph, { color: colors.text }]}>
            CaptainLedger is designed with privacy as a core feature. Your financial data is stored locally on your device by default. If you choose to enable the sync feature, the data will be transmitted to the server of your choice (self-hosted). You retain full ownership of your data.
          </Text>
          
          <Text style={[styles.sectionTitle, { color: colors.text }]}>6. Limitations</Text>
          <Text style={[styles.paragraph, { color: colors.text }]}>
            In no event shall CaptainLedger be liable for any direct, indirect, punitive, incidental, special, or consequential damages arising out of or in any way connected with the use of this application, whether based on contract, tort, strict liability, or otherwise.
          </Text>
          
          <Text style={[styles.sectionTitle, { color: colors.text }]}>7. Changes to Terms</Text>
          <Text style={[styles.paragraph, { color: colors.text }]}>
            We reserve the right to modify these terms at any time. We will notify users of any significant changes through the application or via email. Your continued use of the application constitutes acceptance of the modified terms.
          </Text>
          
          <Text style={[styles.sectionTitle, { color: colors.text }]}>8. Governing Law</Text>
          <Text style={[styles.paragraph, { color: colors.text }]}>
            These terms shall be governed by and construed in accordance with the laws of Nepal, without regard to its conflict of law provisions.
          </Text>
          
          <Text style={[styles.sectionTitle, { color: colors.text }]}>9. Contact</Text>
          <Text style={[styles.paragraph, { color: colors.text }]}>
            If you have any questions or concerns about these Terms and Conditions, please contact us at support@captainledger.com.
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
    marginBottom: 5,
  }
});