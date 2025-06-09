import React, { useState, useRef, useEffect } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, Image, ActivityIndicator, ScrollView, RefreshControl } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { FontAwesome } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '@/components/ThemeProvider';
import { AppColors } from './(tabs)/_layout';
import { verifyOtp, resendOtp } from '@/services/api';

export default function VerifyOtpScreen() {
  const { isDarkMode, colors } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams();
  const { email } = params;
  
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const otpInputs = useRef<(TextInput | null)[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [timer, setTimer] = useState(30);
  const [canResend, setCanResend] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Add email editing state
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [editedEmail, setEditedEmail] = useState(email as string);

  // Make sure this is set up correctly
  const [userEmail, setUserEmail] = useState<string>(email as string || '');

  useEffect(() => {
    // If email not provided through params, check AsyncStorage
    if (!userEmail) {
      AsyncStorage.getItem('pending_verification_email').then((storedEmail) => {
        if (storedEmail) {
          setUserEmail(storedEmail);
        }
      });
    }
  }, []);

  useEffect(() => {
    let interval: number;
    if (timer > 0) {
      interval = setInterval(() => {
        setTimer((prevTimer) => prevTimer - 1);
      }, 1000);
    } else {
      setCanResend(true);
    }
    return () => clearInterval(interval);
  }, [timer]);

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    // Reset the form state
    setOtp(['', '', '', '', '', '']);
    setError('');
    setTimeout(() => {
      setRefreshing(false);
    }, 1000);
  }, []);

  const handleOtpChange = (text: string, index: number) => {
    // Only allow numbers
    if (!/^\d*$/.test(text)) {
      return;
    }

    const newOtp = [...otp];
    newOtp[index] = text;
    setOtp(newOtp);

    // Auto focus to next input
    if (text.length === 1 && index < 5) {
      otpInputs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      otpInputs.current[index - 1]?.focus();
    }
  };

  const handleVerifyOtp = async () => {
    if (otp.length !== 6) {
      setError('Please enter a valid 6-digit OTP');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      const response = await verifyOtp(email as string, otp.join(''));
      
      // Save auth data
      await AsyncStorage.setItem('auth_token', response.token);
      await AsyncStorage.setItem('user_id', response.user.id);
      await AsyncStorage.setItem('user_email', response.user.email);
      await AsyncStorage.setItem('user_fullName', response.user.full_name);
      await AsyncStorage.setItem('user_country', response.user.country);
      await AsyncStorage.setItem('is_authenticated', 'true');
      
      // Navigate to profile setup
      router.replace({
        pathname: '/profileSetup',
        params: { email: response.user.email }
      });
      
    } catch (error: any) {
      console.error('OTP verification error:', error);
      
      let errorMessage = 'Invalid or expired OTP. Please try again.';
      if (error.response && error.response.data && error.response.data.error) {
        errorMessage = error.response.data.error;
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0) return;
    
    setResendLoading(true);
    
    try {
      await resendOtp(email as string);
      setResendCooldown(60); // 60 seconds cooldown
      
      // Start countdown
      const interval = setInterval(() => {
        setResendCooldown((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      
    } catch (error: any) {
      console.error('Resend OTP error:', error);
      setError('Failed to resend OTP. Please try again.');
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <ScrollView 
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.contentContainer}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <StatusBar style={isDarkMode ? 'light' : 'dark'} />
      
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <FontAwesome name="arrow-left" size={20} color={colors.text} />
        </TouchableOpacity>
      </View>

      <View style={styles.iconContainer}>
        <View style={styles.iconCircle}>
          <FontAwesome name="shield" size={40} color="white" />
        </View>
      </View>
      
      <Text style={[styles.title, { color: colors.text }]}>Verify Email</Text>
      <Text style={[styles.subtitle, { color: colors.subText }]}>
        A 6-digit code has been sent to {email}
      </Text>

      {/* Email display and edit section */}
      {!isEditingEmail ? (
        <View style={styles.emailContainer}>
          <Text style={[styles.emailText, { color: colors.text }]}>{email}</Text>
          <TouchableOpacity 
            style={styles.editButton} 
            onPress={() => setIsEditingEmail(true)}
          >
            <FontAwesome name="pencil" size={16} color={AppColors.primary} />
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.emailEditContainer}>
          <TextInput
            style={[styles.emailInput, { 
              backgroundColor: isDarkMode ? colors.inputBackground : '#F8F9FA',
              color: colors.text,
              borderColor: isDarkMode ? 'rgba(255,255,255,0.15)' : '#DFE2E6'
            }]}
            value={editedEmail}
            onChangeText={setEditedEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <TouchableOpacity 
            style={styles.saveButton} 
            onPress={async () => {
              if (editedEmail && editedEmail !== email) {
                // User changed email - navigate back to signup with new email
                router.replace({
                  pathname: '/auth',
                  params: { initialEmail: editedEmail }
                });
              } else {
                setIsEditingEmail(false);
              }
            }}
          >
            <Text style={styles.saveButtonText}>Update</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.otpContainer}>
        {[0, 1, 2, 3, 4, 5].map((index) => (
          <TextInput
            key={index}
            ref={(ref) => { otpInputs.current[index] = ref; }}
            style={[styles.otpInput, { 
              backgroundColor: isDarkMode ? colors.inputBackground : '#F8F9FA', 
              color: colors.text,
              borderColor: error ? AppColors.danger : isDarkMode ? 'rgba(255,255,255,0.15)' : '#DFE2E6'
            }]}
            value={otp[index]}
            onChangeText={(text) => handleOtpChange(text, index)}
            onKeyPress={(e) => handleOtpKeyPress(e, index)}
            maxLength={1}
            keyboardType="numeric"
            textContentType="oneTimeCode" // iOS autofill from SMS
          />
        ))}
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <TouchableOpacity
        style={[styles.button, { opacity: loading ? 0.7 : 1 }]}
        onPress={handleVerifyOtp}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <Text style={styles.buttonText}>Verify</Text>
        )}
      </TouchableOpacity>

      <View style={styles.resendContainer}>
        <Text style={[styles.resendText, { color: colors.subText }]}>
          Didn't receive the code?
        </Text>
        {canResend ? (
          <TouchableOpacity onPress={handleResendOtp}>
            <Text style={styles.resendButtonText}>Resend Code</Text>
          </TouchableOpacity>
        ) : (
          <Text style={[styles.timerText, { color: colors.subText }]}>
            Resend code in {timer}s
          </Text>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    paddingTop: 60,
    paddingBottom: 40,
    alignItems: 'center',
  },
  header: {
    alignSelf: 'flex-start',
    marginBottom: 30,
  },
  backButton: {
    padding: 10,
  },
  iconContainer: {
    marginBottom: 30,
    alignItems: 'center',
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: AppColors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 30,
    textAlign: 'center',
  },
  emailContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  emailText: {
    fontSize: 16,
    fontWeight: '500',
  },
  editButton: {
    marginLeft: 10,
    padding: 5,
  },
  emailEditContainer: {
    width: '100%',
    marginBottom: 20,
  },
  emailInput: {
    width: '100%',
    height: 45,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    marginBottom: 10,
  },
  saveButton: {
    backgroundColor: AppColors.primary,
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 5,
    alignSelf: 'flex-end',
  },
  saveButtonText: {
    color: 'white',
    fontWeight: '500',
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 30,
  },
  otpInput: {
    width: 45,
    height: 55,
    borderWidth: 1,
    borderRadius: 8,
    textAlign: 'center',
    fontSize: 20,
    marginHorizontal: 5,
  },
  errorText: {
    color: AppColors.danger,
    fontSize: 14,
    marginBottom: 15,
    textAlign: 'center',
  },
  button: {
    backgroundColor: AppColors.primary,
    borderRadius: 8,
    paddingVertical: 15,
    alignItems: 'center',
    width: '100%',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  resendContainer: {
    flexDirection: 'row',
    marginTop: 25,
    alignItems: 'center',
  },
  resendText: {
    marginRight: 5,
  },
  resendButtonText: {
    color: AppColors.primary,
    fontWeight: '500',
  },
  timerText: {
    fontWeight: '500',
  },
  skipButton: {
    marginTop: 50,
    padding: 10,
  },
  skipButtonText: {
    color: AppColors.secondary,
    fontSize: 16,
  }
});