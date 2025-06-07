import React, { useState, useRef, useEffect } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, Image, ActivityIndicator, ScrollView, RefreshControl } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { FontAwesome } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '@/components/ThemeProvider';
import { AppColors } from './(tabs)/_layout';

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
    const otpValue = otp.join('');
    
    if (otpValue.length !== 6) {
      setError('Please enter all 6 digits of the verification code');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Here you would call your API to verify the OTP
      // const response = await verifyOtp(email, otpValue);

      // For now, simulate a successful response (using '123456' as valid OTP)
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      if (otpValue === '123456') {
        // Store verification status
        await AsyncStorage.setItem('email_verified', 'true');
        
        // Navigate to profile setup
        router.push({
          pathname: '/profileSetup',
          params: { email: email as string }
        });
      } else {
        setError('Invalid verification code. Please try again.');
      }
    } catch (err) {
      setError('Failed to verify code. Please try again.');
      console.error('OTP verification error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (!canResend) return;
    
    setCanResend(false);
    setTimer(30);
    
    try {
      // Here you would call your API to resend the OTP
      // await resendOtp(email);
      
      // For demo, just simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Show success message
      setError('');
      // Could show a success toast here
    } catch (err) {
      setError('Failed to resend code. Please try again.');
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

      <TouchableOpacity
        style={styles.skipButton}
        onPress={() => router.push('/profileSetup')}
      >
        <Text style={styles.skipButtonText}>Skip for now</Text>
      </TouchableOpacity>
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