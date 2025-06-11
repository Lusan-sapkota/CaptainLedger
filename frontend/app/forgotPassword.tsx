import React, { useState, useRef, useEffect } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  Image, 
  ActivityIndicator, 
  ScrollView,
  Platform
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { FontAwesome } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '@/components/ThemeProvider';
import { AppColors } from './(tabs)/_layout';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function ForgotPasswordScreen() {
  const { isDarkMode, colors } = useTheme();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  
  // Alert message state
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertTitle, setAlertTitle] = useState('');
  const [alertMessage, setAlertMessage] = useState('');
  
  // Status message for loading state
  const [statusMessage, setStatusMessage] = useState('');

  const isValidEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const showThemedAlert = (title: string, message: string) => {
    setAlertTitle(title);
    setAlertMessage(message);
    setAlertVisible(true);
  };

  const handleResetPassword = async () => {
    if (!email) {
      showThemedAlert('Email Required', 'Please enter your email address');
      return;
    }

    if (!isValidEmail(email)) {
      showThemedAlert('Invalid Email', 'Please enter a valid email address');
      return;
    }

    setLoading(true);
    setStatusMessage('Sending password reset link...');

    try {
      // Simulate API call with visual feedback
      await new Promise(resolve => setTimeout(resolve, 400));
      setStatusMessage('Verifying your email address...');
      
      await new Promise(resolve => setTimeout(resolve, 800));
      setStatusMessage('Sending reset instructions...');
      
      // Here you would call your actual API
      // For now, we'll simulate a successful response
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Store the email for later reference
      await AsyncStorage.setItem('pending_reset_email', email);
      
      setSuccess(true);
      setStatusMessage('Reset instructions sent!');
      
      // Wait a moment to show success message
      setTimeout(() => {
        router.replace('/auth');
      }, 2000);
    } catch (err) {
      showThemedAlert('Error', 'Unable to process your request. Please try again later.');
      console.error('Reset password error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Themed Alert component
  const ThemedAlert = () => {
    if (!alertVisible) return null;
    
    return (
      <TouchableOpacity 
        style={[styles.alertOverlay, {
          backgroundColor: 'rgba(0,0,0,0.5)'
        }]} 
        activeOpacity={1}
        onPress={() => setAlertVisible(false)}
      >
        <View style={[styles.alertContainer, {
          backgroundColor: colors.cardBackground
        }]}>
          <Text style={[styles.alertTitle, { color: colors.text }]}>{alertTitle}</Text>
          <Text style={[styles.alertMessage, { color: colors.text }]}>{alertMessage}</Text>
          <TouchableOpacity 
            style={[styles.alertButton, { backgroundColor: AppColors.primary }]} 
            onPress={() => setAlertVisible(false)}
          >
            <Text style={styles.alertButtonText}>OK</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: AppColors.secondary }]}>
      <StatusBar style="light" />
      
      {/* Top header with back button */}
      <View style={styles.topHeader}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.replace('/auth')}
        >
          <FontAwesome name="arrow-left" size={20} color="#FFFFFF" />
          <Text style={styles.backText}>Back to Login</Text>
        </TouchableOpacity>
      </View>
      
      <View style={styles.header}>
        <Image 
          source={require('../assets/images/icon.png')} 
          style={styles.logo}
        />
        <Text style={styles.appName}>CaptainLedger</Text>
      </View>
      
      <ScrollView 
        style={[styles.scrollView, { backgroundColor: colors.background }]}
        contentContainerStyle={styles.scrollViewContent}
      >
        <View style={styles.formContainer}>
          <Text style={[styles.formTitle, { color: colors.text }]}>Forgot Password</Text>
          <Text style={[styles.subtitle, { color: colors.subText }]}>
            Enter your email address and we'll send you OTP to reset your password.
          </Text>
          
          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: colors.text }]}>Email</Text>
            <TextInput
              style={[
                styles.input, 
                { 
                  backgroundColor: isDarkMode ? colors.inputBackground : '#F8F9FA', 
                  color: colors.text,
                  borderColor: isDarkMode ? 'rgba(255,255,255,0.15)' : '#DFE2E6'
                }
              ]}
              placeholder="Enter your email"
              placeholderTextColor={colors.subText}
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
            />
          </View>
          
          {statusMessage ? (
            <View style={[styles.statusContainer, { 
              backgroundColor: isDarkMode ? 'rgba(39, 174, 96, 0.2)' : 'rgba(39, 174, 96, 0.1)'
            }]}>
              <ActivityIndicator size="small" color={AppColors.primary} />
              <Text style={styles.statusMessage}>{statusMessage}</Text>
            </View>
          ) : null}
          
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleResetPassword}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.primaryButtonText}>Reset Password</Text>
            )}
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.docsButton}
            onPress={() => router.push('/documentation')}
          >
            <Text style={styles.docsButtonText}>Need Help?</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
      
      <ThemedAlert />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topHeader: {
    paddingHorizontal: 15,
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  backText: {
    color: '#FFFFFF',
    marginLeft: 10,
    fontSize: 16,
    fontWeight: '500',
  },
  header: {
    alignItems: 'center',
    paddingTop: 15,
    paddingBottom: 20,
  },
  logo: {
    width: 80,
    height: 80,
    borderRadius: 10,
  },
  appName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: AppColors.white,
    marginTop: 10,
  },
  scrollView: {
    flex: 1,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  scrollViewContent: {
    paddingHorizontal: 20,
    paddingTop: 30,
    paddingBottom: 50,
  },
  formContainer: {
    marginBottom: 20,
  },
  formTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 25,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    padding: 12,
    marginTop: 10,
    marginBottom: 10,
  },
  statusMessage: {
    color: AppColors.primary,
    marginLeft: 10,
    fontSize: 14,
  },
  primaryButton: {
    backgroundColor: AppColors.primary,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 10,
  },
  primaryButtonText: {
    color: AppColors.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
  docsButton: {
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 15,
  },
  docsButtonText: {
    color: AppColors.primary,
    fontSize: 14,
  },
  alertOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  alertContainer: {
    width: '80%',
    borderRadius: 10,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  alertTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  alertMessage: {
    fontSize: 16,
    marginBottom: 20,
    textAlign: 'center',
  },
  alertButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 5,
  },
  alertButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
});