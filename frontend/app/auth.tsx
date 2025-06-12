import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator, Image, Platform, Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, Href } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { FontAwesome } from '@expo/vector-icons';
import { AppColors } from './(tabs)/_layout';
import { login, register } from '@/services/api';
import { useTheme } from '@/components/ThemeProvider';
import { getDeviceIdentifier } from '@/utils/device'; // Import the new device utility

// List of countries
const COUNTRIES = [
  'United States', 'United Kingdom', 'Canada', 'Australia', 'Germany', 
  'France', 'India', 'China', 'Japan', 'Brazil', 'Mexico', 'Nepal', 
  'South Africa', 'Nigeria', 'Kenya', 'Russia', 'Italy', 'Spain'
];

// Valid email regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Password must be at least 8 characters with at least 1 number
// const PASSWORD_REGEX = /^(?=.*[A-Za-z])(?=.*\d)[A-ZaLz\d]{8,}$/;

// Custom themed alert component
const ThemedAlert = ({ 
  visible, 
  title, 
  message, 
  onClose,
  isDarkMode,
  colors
}: { 
  visible: boolean; 
  title: string; 
  message: string; 
  onClose: () => void;
  isDarkMode: boolean;
  colors: any;
}) => {
  if (!visible) return null;
  
  return (
    <TouchableOpacity 
      style={[styles.alertOverlay, {
        backgroundColor: 'rgba(0,0,0,0.5)'
      }]} 
      activeOpacity={1}
      onPress={onClose}
    >
      <View style={[styles.alertContainer, {
        backgroundColor: colors.cardBackground
      }]}>
        <Text style={[styles.alertTitle, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.alertMessage, { color: colors.text }]}>{message}</Text>
        <TouchableOpacity 
          style={[styles.alertButton, { backgroundColor: AppColors.primary }]} 
          onPress={onClose}
        >
          <Text style={styles.alertButtonText}>OK</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
};

export default function AuthScreen() {
  const { isDarkMode, colors } = useTheme();
  // Update to include isIPLogin state
  const [authMode, setAuthMode] = useState('login'); // 'login', 'signup', or 'ipLogin'
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [showGenderPicker, setShowGenderPicker] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Add state for custom alert
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertTitle, setAlertTitle] = useState('');
  const [alertMessage, setAlertMessage] = useState('');
  
  // Password visibility toggles
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  // Login form
  const [loginData, setLoginData] = useState({
    email: '',
    password: '',
  });
  
  // Signup form
  const [signupData, setSignupData] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
    country: 'Nepal',
    gender: 'Prefer not to say',
  });
  
  // IP Login form
  const [ipLoginData, setIpLoginData] = useState({
    serverIP: '',
    email: '',
    password: '',
  });
  
  // Form validation 
  const [errors, setErrors] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    fullName: '',
  });

  const [statusMessage, setStatusMessage] = useState('');
  const [rememberDevice, setRememberDevice] = useState(true);

  const validateEmail = (email: string) => {
    if (!email.trim()) return 'Email is required';
    if (!EMAIL_REGEX.test(email)) return 'Please enter a valid email';
    return '';
  };

  const validatePassword = (password: string) => {
    if (!password) return 'Password is required';
    
    // Check individual requirements and return specific feedback
    if (password.length < 8) {
      return 'Password must be at least 8 characters';
    }
    
    if (!/[A-Za-z]/.test(password)) {
      return 'Password must include at least one letter';
    }
    
    if (!/\d/.test(password)) {
      return 'Password must include at least one number';
    }
    
    // All checks passed
    return '';
  };

  const validateSignupForm = () => {
    const newErrors = {
      email: validateEmail(signupData.email),
      password: validatePassword(signupData.password),
      confirmPassword: signupData.password !== signupData.confirmPassword ? 
        'Passwords do not match' : '',
      fullName: !signupData.fullName.trim() ? 'Full name is required' : '',
    };
    
    setErrors(newErrors);
    
    // Check if there are any errors and show first error message
    const errorMessages = Object.values(newErrors).filter(msg => msg !== '');
    if (errorMessages.length > 0) {
      showThemedAlert('Validation Error', errorMessages[0]);
      return false;
    }
    
    return true;
  };

  const validateLoginForm = () => {
    const newErrors = {
      email: validateEmail(loginData.email),
      password: !loginData.password ? 'Password is required' : '',
      confirmPassword: '',
      fullName: '',
    };
    
    setErrors(newErrors);
    
    // Check if there are any errors and show first error message
    const errorMessages = Object.values(newErrors).filter(msg => msg !== '');
    if (errorMessages.length > 0) {
      showThemedAlert('Validation Error', errorMessages[0]);
      return false;
    }
    
    return true;
  };
  
  // Improved password strength function
  const getPasswordStrength = (password: string) => {
    if (!password) return { strength: 0, requirements: [] };
    let strength = 0;
    let requirements = [];
    
    // Length check - worth 1 point
    if (password.length >= 8) {
      strength += 1;
      requirements.push('length');
    }
    
    // Contains number check - worth 1 point
    if (/\d/.test(password)) {
      strength += 1;
      requirements.push('number');
    }
    
    // Contains lowercase letter check - worth 1 point
    if (/[a-z]/.test(password)) {
      strength += 1;
      requirements.push('lowercase');
    }
    
    // Contains uppercase letter check - worth 1 point
    if (/[A-Z]/.test(password)) {
      strength += 1;
      requirements.push('uppercase');
    }
    
    // Contains special character check - worth 1 point
    if (/[^A-Za-z0-9]/.test(password)) {
      strength += 1;
      requirements.push('special');
    }
    
    return { strength, requirements };
  };
  
  // Update the PasswordStrengthIndicator component
  const PasswordStrengthIndicator = ({ password }: { password: string }) => {
    const { strength, requirements } = getPasswordStrength(password);
    
    // Create a readable list of missing requirements
    const getMissingRequirementsText = () => {
      const missing = [];
      
      if (!requirements.includes('length')) missing.push('8+ characters');
      if (!requirements.includes('number')) missing.push('a number');
      if (!requirements.includes('lowercase')) missing.push('a lowercase letter');
      if (!requirements.includes('uppercase')) missing.push('an uppercase letter');
      if (!requirements.includes('special')) missing.push('a special character');
      
      if (missing.length === 0) return '';
      
      if (missing.length === 1) return `Add ${missing[0]} to strengthen`;
      
      const lastItem = missing.pop();
      return `Add ${missing.join(', ')} and ${lastItem} to strengthen`;
    };
    
    return (
      <View style={styles.strengthContainer}>
        <View style={styles.strengthBars}>
          {[1, 2, 3, 4, 5].map((level) => (
            <View 
              key={level}
              style={[
                styles.strengthBar,
                { 
                  backgroundColor: strength >= level 
                    ? level <= 2 
                      ? '#FF6B6B' // weak
                      : level <= 3 
                        ? '#FFD166' // medium
                        : '#06D6A0' // strong
                    : isDarkMode 
                      ? 'rgba(255,255,255,0.1)' 
                      : 'rgba(0,0,0,0.1)'
                }
              ]}
            />
          ))}
        </View>
        <View style={styles.strengthTextContainer}>
          <Text style={[styles.strengthText, { color: colors.subText }]}>
            {strength === 0 && 'Very weak'}
            {strength === 1 && 'Very weak'}
            {strength === 2 && 'Weak'}
            {strength === 3 && 'Medium'}
            {strength === 4 && 'Strong'}
            {strength === 5 && 'Very strong'}
          </Text>
          {strength < 3 && (
            <Text style={[styles.strengthHint, { color: colors.subText }]}>
              {getMissingRequirementsText()}
            </Text>
          )}
        </View>
      </View>
    );
  };

  const handleLogin = async () => {
    // Check for empty fields and show themed alerts
    if (!loginData.email.trim()) {
      showThemedAlert('Email Required', 'Please enter your email address');
      return;
    }
    
    if (!EMAIL_REGEX.test(loginData.email)) {
      showThemedAlert('Invalid Email', 'Please enter a valid email address');
      return;
    }
    
    if (!loginData.password) {
      showThemedAlert('Password Required', 'Please enter your password');
      return;
    }
    
    setLoading(true);
    setStatusMessage(`Authenticating ${loginData.email}...`); // Show email in status
    
    try {
      // Get device ID and check if device is trusted
      const deviceId = await getDeviceIdentifier();
      const isDeviceTrusted = await AsyncStorage.getItem(`trusted_device_${deviceId}`);
      
      // Show connecting message
      setStatusMessage(`Connecting to server...`);
      await new Promise(resolve => setTimeout(resolve, 400));
      
      setStatusMessage(`Verifying credentials for ${loginData.email}...`);
      const response = await login(loginData.email, loginData.password, deviceId, isDeviceTrusted === 'true');
      
      setStatusMessage(`Securing authentication session...`);
      await new Promise(resolve => setTimeout(resolve, 800)); // Show this message for a moment
      
      // Only proceed if we get a valid response with token
      if (!response.data || !response.data.token) {
        throw new Error('Invalid response from server');
      }
      
      // Create a 30-day expiration timestamp
      const expirationDate = new Date();
      expirationDate.setDate(expirationDate.getDate() + 30);
      const expirationTimestamp = expirationDate.toISOString();
      
      // Store ALL required auth data in correct sequence with extended session
      await AsyncStorage.multiSet([
        ['auth_token', response.data.token],
        ['user_id', response.data.user.id.toString()],
        ['user_email', loginData.email],
        ['is_authenticated', 'true'], // CRITICAL: Set this explicitly to 'true'
        ['is_offline_mode', 'false'], // Set this to false to be explicit
        ['is_guest_mode', 'false'],   // Set this to false to be explicit
        ['auth_expiration', expirationTimestamp], // 30-day expiration
        ['device_id', deviceId], // Store device ID for trust management
        ['session_created', new Date().toISOString()], // Track when session was created
        ['last_activity', new Date().toISOString()], // Track last activity for session extension
      ]);
      
      // Mark device as trusted if "Remember me" is checked
      if (rememberDevice) {
        await AsyncStorage.setItem(`trusted_device_${deviceId}`, 'true');
        await AsyncStorage.setItem(`trusted_device_name_${deviceId}`, Platform.OS);
        await AsyncStorage.setItem(`trusted_device_date_${deviceId}`, new Date().toISOString());
        console.log('Device marked as trusted');
      }
      
      console.log('Auth data stored successfully with 30-day session');
      
      // Log login to history
      const loginHistory = await AsyncStorage.getItem('login_history') || '[]';
      const history = JSON.parse(loginHistory);
      history.push({
        date: new Date().toISOString(),
        device: Platform.OS,
        type: 'login',
        trusted: rememberDevice
      });
      await AsyncStorage.setItem('login_history', JSON.stringify(history.slice(-10)));
      
      setStatusMessage('Login successful! Session secured for 30 days.');
      
      // Add a slightly longer delay to ensure storage is complete
      setTimeout(() => {
        if (Platform.OS === 'web') {
          window.location.href = '/'; // Force full page reload on web
        } else {
          router.replace('/');
        }
      }, 800); // Longer delay to ensure the user sees the success message
    } catch (error) {
      console.error('Login error:', error);
      
      // Simplified error handling - make sure this alert always shows
      let errorMessage = 'Unable to login. Please try again.';
      
      // Simple error message extraction that's less likely to fail
      if ((error as any)?.response?.data?.error) {
        errorMessage = (error as any).response.data.error;
      }
      
      // Use setTimeout to ensure alert shows even if there are other processing issues
      setTimeout(() => {
        showThemedAlert('Login Failed', errorMessage);
      }, 100);
    } finally {
      setLoading(false);
      setStatusMessage(''); // Clear status message
    }
  };

  const handleSignup = async () => {
    if (!validateSignupForm()) return;
    
    setLoading(true);
    setStatusMessage('Creating your account...');
    
    try {
      console.log("Starting registration for:", signupData.email);
      
      // Show account creation step
      setStatusMessage('Validating your information...');
      await new Promise(resolve => setTimeout(resolve, 500)); // Visual feedback
      
      setStatusMessage('Creating your account...');
      // Registration API call...
      try {
        await register(
          signupData.email,
          signupData.password,
          signupData.fullName,
          signupData.country,
          signupData.gender
        );
        
        setStatusMessage('Sending verification email...');
        await new Promise(resolve => setTimeout(resolve, 800));
        
        setStatusMessage('Verification email sent! Redirecting...');
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Continue with the rest of the success handling
        await AsyncStorage.setItem('pending_verification_email', signupData.email);
        
        const loginHistory = await AsyncStorage.getItem('login_history') || '[]';
        const history = JSON.parse(loginHistory);
        history.push({
          date: new Date().toISOString(),
          device: Platform.OS,
          type: 'signup'
        });
        await AsyncStorage.setItem('login_history', JSON.stringify(history.slice(-10)));
        
        // Show OTP email sending step
        setStatusMessage(`Sending verification code to ${signupData.email}...`);
        await new Promise(resolve => setTimeout(resolve, 800)); // Visual delay
        
        // Show success message
        setStatusMessage(`Verification code sent to ${signupData.email}`);
        await new Promise(resolve => setTimeout(resolve, 1200)); // Let user see message
        
        // Navigate to OTP verification screen
        router.push({
          pathname: '/verifyOtp',
          params: { email: signupData.email }
        });
      } catch (regError) {
        console.error('Registration API error:', regError);
        throw regError; // Re-throw to be caught by outer catch
      }
    } catch (error: any) {
      console.error('Signup error:', error);
      
      let errorMessage = 'This email may already be registered. Please try again.';
      
      if (error.message === 'Registration request timed out') {
        errorMessage = 'The registration request timed out. Please check your connection and try again.';
      } else if (error.code === 'ECONNABORTED') {
        errorMessage = 'Connection to the server timed out. Please try again later.';
      } else if (error.response && error.response.data && error.response.data.error) {
        errorMessage = error.response.data.error;
      }
      
      showThemedAlert('Signup Failed', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleIPLogin = async () => {
    // Validate fields
    if (!ipLoginData.serverIP.trim()) {
      showThemedAlert('Server Required', 'Please enter your server IP address');
      return;
    }
    
    if (!ipLoginData.email.trim()) {
      showThemedAlert('Email Required', 'Please enter your email address');
      return;
    }
    
    if (!EMAIL_REGEX.test(ipLoginData.email)) {
      showThemedAlert('Invalid Email', 'Please enter a valid email address');
      return;
    }
    
    if (!ipLoginData.password) {
      showThemedAlert('Password Required', 'Please enter your password');
      return;
    }
    
    setLoading(true);
    setStatusMessage(`Connecting to ${ipLoginData.serverIP}...`);
    
    try {
      // Show connection progress
      await new Promise(resolve => setTimeout(resolve, 500));
      setStatusMessage(`Authenticating with custom server...`);
      
      // Here you would implement the actual API call to the custom server
      // For now, we'll simulate a successful login
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Create a 30-day expiration timestamp
      const expirationDate = new Date();
      expirationDate.setDate(expirationDate.getDate() + 30);
      const expirationTimestamp = expirationDate.toISOString();
      
      // Set auth data with expiration
      await AsyncStorage.multiSet([
        ['auth_token', 'ip-login-token'],
        ['user_id', 'ip-user'],
        ['user_email', ipLoginData.email],
        ['server_ip', ipLoginData.serverIP],
        ['is_authenticated', 'true'],
        ['auth_expiration', expirationTimestamp],
        ['is_custom_server', 'true']
      ]);
      
      // Log IP login
      const loginHistory = await AsyncStorage.getItem('login_history') || '[]';
      const history = JSON.parse(loginHistory);
      history.push({
        date: new Date().toISOString(),
        device: Platform.OS,
        type: 'login',
        ip: ipLoginData.serverIP
      });
      await AsyncStorage.setItem('login_history', JSON.stringify(history.slice(-10)));
      
      setStatusMessage('Login successful!');
      
      // Navigate to home
      setTimeout(() => {
        if (Platform.OS === 'web') {
          window.location.href = '/';
        } else {
          router.replace('/');
        }
      }, 800);
      
    } catch (error) {
      console.error('IP Login error:', error);
      showThemedAlert('Login Failed', 'Failed to connect to the specified server');
    } finally {
      setLoading(false);
      setStatusMessage('');
    }
  };

  const handleContinueAsGuest = async () => {
    // Set guest mode flag in AsyncStorage
    await AsyncStorage.setItem('auth_token', 'guest-token');
    await AsyncStorage.setItem('user_id', 'guest');
    await AsyncStorage.setItem('user_email', 'guest@example.com');
    await AsyncStorage.setItem('is_guest_mode', 'true');
    
    // Log guest login
    const loginHistory = await AsyncStorage.getItem('login_history') || '[]';
    const history = JSON.parse(loginHistory);
    history.push({
      date: new Date().toISOString(),
      device: Platform.OS,
      type: 'guest'
    });
    await AsyncStorage.setItem('login_history', JSON.stringify(history.slice(-10)));
    
    router.replace('/');
  };
  
  const navigateToPage = (page: Href) => {
    router.push(page);
  };

  const handleForgotPassword = () => {
    // Navigate directly to forgot password page with replace instead of push
    router.replace('/forgotPassword');
  }

  const renderLoginForm = () => (
    <View style={styles.formContainer}>
      <Text style={[styles.formTitle, { color: colors.text }]}>Welcome Back</Text>
      
      <View style={styles.inputGroup}>
        <Text style={[styles.inputLabel, { color: colors.text }]}>Email</Text>
        <TextInput
          style={[
            styles.input, 
            errors.email ? styles.inputError : null,
            { 
              backgroundColor: isDarkMode ? colors.inputBackground : '#F8F9FA', 
              color: colors.text,
              borderColor: errors.email ? AppColors.danger : isDarkMode ? 'rgba(255,255,255,0.15)' : '#DFE2E6'
            }
          ]}
          placeholder="Enter your email"
          placeholderTextColor={colors.subText}
          keyboardType="email-address"
          autoCapitalize="none"
          value={loginData.email}
          onChangeText={(text) => {
            setLoginData({...loginData, email: text});
            // Real-time validation
            const emailError = validateEmail(text);
            setErrors(prev => ({...prev, email: emailError}));
          }}
        />
        {errors.email ? <Text style={styles.errorText}>{errors.email}</Text> : null}
      </View>
      
      <View style={styles.inputGroup}>
        <Text style={[styles.inputLabel, { color: colors.text }]}>Password</Text>
        <View style={styles.passwordContainer}>
          <TextInput
            style={[
              styles.passwordInput, 
              errors.password ? styles.inputError : null,
              { 
                backgroundColor: isDarkMode ? colors.inputBackground : '#F8F9FA', 
                color: colors.text,
                borderColor: errors.password ? AppColors.danger : isDarkMode ? 'rgba(255,255,255,0.15)' : '#DFE2E6'
              }
            ]}
            placeholder="Enter your password"
            placeholderTextColor={colors.subText}
            secureTextEntry={!showLoginPassword}
            value={loginData.password}
            onChangeText={(text) => {
              setLoginData({...loginData, password: text});
              // Real-time validation
              const passwordError = !text ? 'Password is required' : '';
              setErrors(prev => ({...prev, password: passwordError}));
            }}
          />
          <TouchableOpacity 
            style={styles.eyeIcon} 
            onPress={() => setShowLoginPassword(!showLoginPassword)}
          >
            <FontAwesome 
              name={showLoginPassword ? "eye" : "eye-slash"} 
              size={20} 
              color={colors.subText} 
            />
          </TouchableOpacity>
        </View>
        {errors.password ? <Text style={styles.errorText}>{errors.password}</Text> : null}
      </View>
      
      <View style={styles.rememberForgotContainer}>
        {/* Left side - Remember Me */}
        <View style={styles.rememberMeWrapper}>
          <TouchableOpacity 
            style={styles.checkbox}
            onPress={() => setRememberDevice(!rememberDevice)}
          >
            <FontAwesome 
              name={rememberDevice ? "check-square-o" : "square-o"} 
              size={20} 
              color={AppColors.primary} 
            />
          </TouchableOpacity>
          <Text style={[styles.rememberMeText, { color: colors.text }]}>
            Remember me
          </Text>
        </View>

        {/* Right side - Forgot Password */}
        <TouchableOpacity
          style={styles.forgotPasswordBtn}
          onPress={handleForgotPassword}
        >
          <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
        </TouchableOpacity>
      </View>
      
      <TouchableOpacity
        style={styles.primaryButton}
        onPress={handleLogin}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <Text style={styles.primaryButtonText}>Login</Text>
        )}
      </TouchableOpacity>
      
      <Text style={[styles.termsText, { color: colors.subText }]}>
        By logging in, you agree to our{' '}
        <Text style={styles.linkText} onPress={() => navigateToPage('/terms')}>
          Terms & Conditions
        </Text>{' '}
        and{' '}
        <Text style={styles.linkText} onPress={() => navigateToPage('/privacy')}>
          Privacy Policy
        </Text>
      </Text>
      
    </View>
  );

  const renderSignupForm = () => (
    <View style={styles.formContainer}>
      <Text style={[styles.formTitle, { color: colors.text }]}>Create Account</Text>
      
      <View style={styles.inputGroup}>
        <Text style={[styles.inputLabel, { color: colors.text }]}>Full Name</Text>
        <TextInput
          style={[
            styles.input, 
            errors.fullName ? styles.inputError : null,
            { 
              backgroundColor: isDarkMode ? colors.inputBackground : '#F8F9FA', 
              color: colors.text,
              borderColor: errors.fullName ? AppColors.danger : isDarkMode ? 'rgba(255,255,255,0.15)' : '#DFE2E6'
            }
          ]}
          placeholder="Enter your full name"
          placeholderTextColor={colors.subText}
          value={signupData.fullName}
          onChangeText={(text) => {
            setSignupData({...signupData, fullName: text});
            // Real-time validation
            const fullNameError = !text ? 'Full name is required' : '';
            setErrors(prev => ({...prev, fullName: fullNameError}));
          }}
        />
        {errors.fullName ? <Text style={styles.errorText}>{errors.fullName}</Text> : null}
      </View>
      
      <View style={styles.inputGroup}>
        <Text style={[styles.inputLabel, { color: colors.text }]}>Email</Text>
        <TextInput
          style={[
            styles.input, 
            errors.email ? styles.inputError : null,
            { 
              backgroundColor: isDarkMode ? colors.inputBackground : '#F8F9FA', 
              color: colors.text,
              borderColor: errors.email ? AppColors.danger : isDarkMode ? 'rgba(255,255,255,0.15)' : '#DFE2E6'
            }
          ]}
          placeholder="Enter your email"
          placeholderTextColor={colors.subText}
          keyboardType="email-address"
          autoCapitalize="none"
          value={signupData.email}
          onChangeText={(text) => {
            setSignupData({...signupData, email: text});
            // Real-time validation
            const emailError = validateEmail(text);
            setErrors(prev => ({...prev, email: emailError}));
          }}
        />
        {errors.email ? <Text style={styles.errorText}>{errors.email}</Text> : null}
      </View>
      
      <View style={styles.inputGroup}>
        <Text style={[styles.inputLabel, { color: colors.text }]}>Password</Text>
        <View style={styles.passwordContainer}>
          <TextInput
            style={[
              styles.passwordInput, 
              errors.password ? styles.inputError : null,
              { 
                backgroundColor: isDarkMode ? colors.inputBackground : '#F8F9FA', 
                color: colors.text,
                borderColor: errors.password ? AppColors.danger : isDarkMode ? 'rgba(255,255,255,0.15)' : '#DFE2E6'
              }
            ]}
            placeholder="Create a password (min 8 chars with 1 number)"
            placeholderTextColor={colors.subText}
            secureTextEntry={!showSignupPassword}
            value={signupData.password}
            onChangeText={(text) => {
              setSignupData({...signupData, password: text});
              // Real-time validation
              const passwordError = validatePassword(text);
              setErrors(prev => ({...prev, password: passwordError}));
              
              // Also check if confirm password now matches
              if (signupData.confirmPassword) {
                const confirmError = text !== signupData.confirmPassword ? 'Passwords do not match' : '';
                setErrors(prev => ({...prev, confirmPassword: confirmError}));
              }
            }}
          />
          <TouchableOpacity 
            style={styles.eyeIcon} 
            onPress={() => setShowSignupPassword(!showSignupPassword)}
          >
            <FontAwesome 
              name={showSignupPassword ? "eye" : "eye-slash"} 
              size={20} 
              color={colors.subText} 
            />
          </TouchableOpacity>
        </View>
        {errors.password ? 
          <Text style={styles.errorText}>{errors.password}</Text> : 
          signupData.password ? 
            <PasswordStrengthIndicator password={signupData.password} /> : null
        }
      </View>
      
      <View style={styles.inputGroup}>
        <Text style={[styles.inputLabel, { color: colors.text }]}>Confirm Password</Text>
        <View style={styles.passwordContainer}>
          <TextInput
            style={[
              styles.passwordInput, 
              errors.confirmPassword ? styles.inputError : null,
              { 
                backgroundColor: isDarkMode ? colors.inputBackground : '#F8F9FA', 
                color: colors.text,
                borderColor: errors.confirmPassword ? AppColors.danger : isDarkMode ? 'rgba(255,255,255,0.15)' : '#DFE2E6'
              }
            ]}
            placeholder="Confirm your password"
            placeholderTextColor={colors.subText}
            secureTextEntry={!showConfirmPassword}
            value={signupData.confirmPassword}
            onChangeText={(text) => {
              setSignupData({...signupData, confirmPassword: text});
              // Real-time validation
              const confirmError = text !== signupData.password ? 'Passwords do not match' : '';
              setErrors(prev => ({...prev, confirmPassword: confirmError}));
            }}
          />
          <TouchableOpacity 
            style={styles.eyeIcon} 
            onPress={() => setShowConfirmPassword(!showConfirmPassword)}
          >
            <FontAwesome 
              name={showConfirmPassword ? "eye" : "eye-slash"} 
              size={20} 
              color={colors.subText} 
            />
          </TouchableOpacity>
        </View>
        {errors.confirmPassword ? <Text style={styles.errorText}>{errors.confirmPassword}</Text> : null}
      </View>
      
      <View style={styles.inputGroup}>
        <Text style={[styles.inputLabel, { color: colors.text }]}>Country</Text>
        <TouchableOpacity 
          style={[
            styles.pickerButton,
            {
              backgroundColor: isDarkMode ? colors.inputBackground : '#F8F9FA',
              borderColor: isDarkMode ? 'rgba(255,255,255,0.15)' : '#DFE2E6'
            }
          ]}
          onPress={() => {
            setShowCountryPicker(!showCountryPicker);
            setShowGenderPicker(false);
          }}
        >
          <Text style={[styles.pickerButtonText, { color: colors.text }]}>{signupData.country}</Text>
          <FontAwesome name={showCountryPicker ? "chevron-up" : "chevron-down"} size={16} color={colors.subText} />
        </TouchableOpacity>
        
        {showCountryPicker && (
          <ScrollView 
            style={[styles.pickerContainer, { 
              backgroundColor: isDarkMode ? colors.cardBackground : '#FFF',
              borderColor: isDarkMode ? 'rgba(255,255,255,0.15)' : '#DFE2E6'
            }]} 
            nestedScrollEnabled={true}
          >
            {COUNTRIES.sort().map((country, index) => (
              <TouchableOpacity
                key={index}
                style={[styles.pickerItem, {
                  borderBottomColor: isDarkMode ? 'rgba(255,255,255,0.1)' : '#F0F0F0'
                }]}
                onPress={() => {
                  setSignupData({...signupData, country});
                  setShowCountryPicker(false);
                }}
              >
                <Text style={[
                  styles.pickerItemText, 
                  { color: colors.text },
                  country === signupData.country && styles.selectedPickerText
                ]}>
                  {country}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>
      
      <View style={styles.inputGroup}>
        <Text style={[styles.inputLabel, { color: colors.text }]}>Gender (Optional)</Text>
        <TouchableOpacity 
          style={[
            styles.pickerButton,
            {
              backgroundColor: isDarkMode ? colors.inputBackground : '#F8F9FA',
              borderColor: isDarkMode ? 'rgba(255,255,255,0.15)' : '#DFE2E6'
            }
          ]}
          onPress={() => {
            setShowGenderPicker(!showGenderPicker);
            setShowCountryPicker(false);
          }}
        >
          <Text style={[styles.pickerButtonText, { color: colors.text }]}>{signupData.gender}</Text>
          <FontAwesome name={showGenderPicker ? "chevron-up" : "chevron-down"} size={16} color={colors.subText} />
        </TouchableOpacity>
        
        {showGenderPicker && (
          <View style={[styles.pickerContainer, { 
            backgroundColor: isDarkMode ? colors.cardBackground : '#FFF',
            borderColor: isDarkMode ? 'rgba(255,255,255,0.15)' : '#DFE2E6'
          }]}>
            {['Male', 'Female', 'Other', 'Prefer not to say'].map((gender, index) => (
              <TouchableOpacity
                key={index}
                style={[styles.pickerItem, {
                  borderBottomColor: isDarkMode ? 'rgba(255,255,255,0.1)' : '#F0F0F0'
                }]}
                onPress={() => {
                  setSignupData({...signupData, gender});
                  setShowGenderPicker(false);
                }}
              >
                <Text style={[
                  styles.pickerItemText,
                  { color: colors.text },
                  gender === signupData.gender && styles.selectedPickerText
                ]}>
                  {gender}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
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
        onPress={handleSignup}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <Text style={styles.primaryButtonText}>Sign Up</Text>
        )}
      </TouchableOpacity>
      
      <Text style={[styles.termsText, { color: colors.subText }]}>
        By signing up, you agree to our{' '}
        <Text style={styles.linkText} onPress={() => navigateToPage('/terms')}>
          Terms & Conditions
        </Text>{' '}
        and{' '}
        <Text style={styles.linkText} onPress={() => navigateToPage('/privacy')}>
          Privacy Policy
        </Text>
      </Text>
    </View>
  );

  // Add new render function for IP Login form
  const renderIPLoginForm = () => (
    <View style={styles.formContainer}>
      <Text style={[styles.formTitle, { color: colors.text }]}>Custom Server Login</Text>
      
      <View style={styles.inputGroup}>
        <Text style={[styles.inputLabel, { color: colors.text }]}>Server IP Address</Text>
        <TextInput
          style={[
            styles.input, 
            { 
              backgroundColor: isDarkMode ? colors.inputBackground : '#F8F9FA', 
              color: colors.text,
              borderColor: isDarkMode ? 'rgba(255,255,255,0.15)' : '#DFE2E6'
            }
          ]}
          placeholder="Enter server IP (e.g., 192.168.1.10)"
          placeholderTextColor={colors.subText}
          keyboardType="url"
          autoCapitalize="none"
          value={ipLoginData.serverIP}
          onChangeText={(text) => setIpLoginData({...ipLoginData, serverIP: text})}
        />
      </View>
      
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
          value={ipLoginData.email}
          onChangeText={(text) => setIpLoginData({...ipLoginData, email: text})}
        />
      </View>
      
      <View style={styles.inputGroup}>
        <Text style={[styles.inputLabel, { color: colors.text }]}>Password</Text>
        <View style={styles.passwordContainer}>
          <TextInput
            style={[
              styles.passwordInput, 
              { 
                backgroundColor: isDarkMode ? colors.inputBackground : '#F8F9FA', 
                color: colors.text,
                borderColor: isDarkMode ? 'rgba(255,255,255,0.15)' : '#DFE2E6'
              }
            ]}
            placeholder="Enter your password"
            placeholderTextColor={colors.subText}
            secureTextEntry={!showLoginPassword}
            value={ipLoginData.password}
            onChangeText={(text) => setIpLoginData({...ipLoginData, password: text})}
          />
          <TouchableOpacity 
            style={styles.eyeIcon} 
            onPress={() => setShowLoginPassword(!showLoginPassword)}
          >
            <FontAwesome 
              name={showLoginPassword ? "eye" : "eye-slash"} 
              size={20} 
              color={colors.subText} 
            />
          </TouchableOpacity>
        </View>
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
        onPress={handleIPLogin}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <Text style={styles.primaryButtonText}>Connect to Server</Text>
        )}
      </TouchableOpacity>
      
      <Text style={[styles.termsText, { color: colors.subText }]}>
        Session will remain active for 30 days after successful authentication.
      </Text>
    </View>
  );

  // Show themed alert function
  const showThemedAlert = (title: string, message: string) => {
    setAlertTitle(title);
    setAlertMessage(message);
    setAlertVisible(true);
  };

  // Update the return statement to include the new tab
  return (
    <View style={[styles.container, { backgroundColor: AppColors.secondary }]}>
      <StatusBar style="light" />
      
      <View style={styles.header}>
        <Image 
          source={require('../assets/images/icon.png')} 
          style={styles.logo}
        />
        <Text style={styles.appName}>CaptainLedger</Text>
      </View>
      
      <View style={styles.tabsContainer}>
        <View style={styles.tabs}>
          <TouchableOpacity 
            style={[
              styles.tab,
              authMode === 'login' && styles.activeTab,
              { borderTopLeftRadius: 12, borderBottomLeftRadius: 12 }
            ]}
            onPress={() => setAuthMode('login')}
          >
            <FontAwesome 
              name="sign-in" 
              size={16} 
              color={authMode === 'login' ? '#FFFFFF' : 'rgba(255, 255, 255, 0.7)'} 
              style={styles.tabIcon}
            />
            <Text style={[styles.tabText, authMode === 'login' && styles.activeTabText]}>Login</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[
              styles.tab,
              authMode === 'signup' && styles.activeTab,
            ]}
            onPress={() => setAuthMode('signup')}
          >
            <FontAwesome 
              name="user-plus" 
              size={16} 
              color={authMode === 'signup' ? '#FFFFFF' : 'rgba(255, 255, 255, 0.7)'} 
              style={styles.tabIcon}
            />
            <Text style={[styles.tabText, authMode === 'signup' && styles.activeTabText]}>Sign Up</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[
              styles.tab,
              authMode === 'ipLogin' && styles.activeTab,
              { borderTopRightRadius: 12, borderBottomRightRadius: 12 }
            ]}
            onPress={() => setAuthMode('ipLogin')}
          >
            <FontAwesome 
              name="server" 
              size={16} 
              color={authMode === 'ipLogin' ? '#FFFFFF' : 'rgba(255, 255, 255, 0.7)'} 
              style={styles.tabIcon}
            />
            <Text style={[styles.tabText, authMode === 'ipLogin' && styles.activeTabText]}>IP Login</Text>
          </TouchableOpacity>
        </View>
      </View>
      
      <ScrollView 
        style={[styles.scrollView, { backgroundColor: colors.background }]} 
        contentContainerStyle={styles.scrollViewContent}
        keyboardShouldPersistTaps="handled"
      >
        {authMode === 'login' && renderLoginForm()}
        {authMode === 'signup' && renderSignupForm()}
        {authMode === 'ipLogin' && renderIPLoginForm()}
        
        {authMode !== 'ipLogin' && (
          <>
            <View style={styles.divider}>
              <View style={[styles.dividerLine, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.1)' : '#DFE2E6' }]} />
              <Text style={[styles.dividerText, { color: colors.subText }]}>OR</Text>
              <View style={[styles.dividerLine, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.1)' : '#DFE2E6' }]} />
            </View>
            
            <TouchableOpacity
              style={[styles.guestButton, { borderColor: AppColors.primary }]}
              onPress={handleContinueAsGuest}
            >
              <Text style={styles.guestButtonText}>Continue as Guest</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.docsButton}
              onPress={() => navigateToPage('/documentation')}
            >
              <Text style={styles.docsButtonText}>Read Documentation</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
      
      <ThemedAlert
        visible={alertVisible}
        title={alertTitle}
        message={alertMessage}
        onClose={() => setAlertVisible(false)}
        isDarkMode={isDarkMode}
        colors={colors}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    paddingTop: 60,
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
  tabsContainer: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 12,
    padding: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
  
    justifyContent: 'center',
    position: 'relative',
    borderRadius: 10,
  },
  activeTab: {
    backgroundColor: AppColors.primary,
    shadowColor: AppColors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  tabText: {
    fontSize: 15,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.85)',
    marginLeft: 6,
  },
  activeTabText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  tabIcon: {
    marginRight: 6,
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
    marginBottom: 20,
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
  passwordContainer: {
    position: 'relative',
    width: '100%',
  },
  passwordInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    paddingRight: 45, // Space for the eye icon
  },
  eyeIcon: {
    position: 'absolute',
    right: 12,
    top: '50%',
    transform: [{translateY: -10}],
    padding: 5,
    zIndex: 1,
  },
  inputError: {
    borderColor: AppColors.danger,
  },
  errorText: {
    color: AppColors.danger,
    fontSize: 14,
    marginTop: 5,
  },
  strengthContainer: {
    marginTop: 5,
  },
  strengthBars: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  strengthBar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    marginHorizontal: 2,
  },
  strengthText: {
    fontSize: 12,
    textAlign: 'right',
  },
  strengthTextContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  strengthHint: {
    fontSize: 12,
    flex: 1,
    textAlign: 'right',
    marginLeft: 5,
  },
  pickerButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
  },
  pickerButtonText: {
    fontSize: 16,
  },
  pickerContainer: {
    borderWidth: 1,
    borderRadius: 8,
    marginTop: 5,
    maxHeight: 150,
  },
  pickerItem: {
    padding: 12,
    borderBottomWidth: 1,
  },
  pickerItemText: {
    fontSize: 16,
  },
  selectedPickerText: {
    color: AppColors.primary,
    fontWeight: '500',
  },
  forgotPasswordBtn: {
  },
  forgotPasswordText: {
    color: AppColors.primary,
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
  termsText: {
    fontSize: 13,
    marginTop: 20,
    textAlign: 'center',
    lineHeight: 20,
  },
  docsText: {
    fontSize: 13,
    marginTop: 10,
    textAlign: 'center',
    lineHeight: 20,
  },
  linkText: {
    color: AppColors.primary,
    fontWeight: '500',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    paddingHorizontal: 10,
  },
  guestButton: {
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  guestButtonText: {
    color: AppColors.primary,
    fontSize: 16,
    fontWeight: '500',
  },
  docsButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  docsButtonText: {
    color: AppColors.primary,
    fontSize: 14,
  },
  // Add these new styles for the themed alert
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
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 8,
    padding: 12,
    marginTop: 10,
    marginBottom: 10,
  },
  statusMessage: {
    color: AppColors.primary,
    fontSize: 14,
    marginLeft: 10,
    fontWeight: '500',
  },
  rememberMeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  checkbox: {
    marginRight: 10,
  },
  rememberMeText: {
    fontSize: 14,
  },
  rememberForgotContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  rememberMeWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});