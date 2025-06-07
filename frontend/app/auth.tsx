import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator, Image, Platform, Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, Href } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { FontAwesome } from '@expo/vector-icons';
import { AppColors } from './(tabs)/_layout';
import { login, register } from '@/services/api';
import { useTheme } from '@/components/ThemeProvider';

// List of countries
const COUNTRIES = [
  'United States', 'United Kingdom', 'Canada', 'Australia', 'Germany', 
  'France', 'India', 'China', 'Japan', 'Brazil', 'Mexico', 'Nepal', 
  'South Africa', 'Nigeria', 'Kenya', 'Russia', 'Italy', 'Spain'
];

// Valid email regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Password must be at least 8 characters with at least 1 number
// const PASSWORD_REGEX = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,}$/;

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
  const [isLogin, setIsLogin] = useState(true);
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
  
  // Form validation 
  const [errors, setErrors] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    fullName: '',
  });

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
    if (!validateLoginForm()) return;
    
    setLoading(true);
    try {
      // Try to authenticate with Flask backend
      try {
        const response = await login(loginData.email, loginData.password);
        
        // Store authentication token
        await AsyncStorage.setItem('auth_token', response.data.token);
        await AsyncStorage.setItem('user_id', response.data.user.id);
        await AsyncStorage.setItem('user_email', loginData.email);
        
        // Log login date
        const loginHistory = await AsyncStorage.getItem('login_history') || '[]';
        const history = JSON.parse(loginHistory);
        history.push({
          date: new Date().toISOString(),
          device: Platform.OS,
          type: 'login'
        });
        await AsyncStorage.setItem('login_history', JSON.stringify(history.slice(-10)));
        
        // Navigate to main app
        router.replace('/');
      } catch (error: any) {
        console.error('Login error:', error);
        
        let errorMessage = 'Invalid email or password. Please try again.';
        if (error.response && error.response.data && error.response.data.error) {
          errorMessage = error.response.data.error;
        }
        
        // Use the themed alert instead of native Alert
        showThemedAlert('Login Failed', errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async () => {
    if (!validateSignupForm()) return;
    
    setLoading(true);
    try {
      // First register with the Flask backend API
      try {
        const registerData = {
          email: signupData.email,
          password: signupData.password,
          fullName: signupData.fullName,
          country: signupData.country,
          gender: signupData.gender
        };
        
        const response = await register(signupData.email, signupData.password);
        
        // Store token from backend
        await AsyncStorage.setItem('auth_token', response.data.token);
        
        // Store additional user data locally
        await AsyncStorage.setItem('user_id', response.data.user.id);
        await AsyncStorage.setItem('user_email', signupData.email);
        await AsyncStorage.setItem('user_fullName', signupData.fullName);
        await AsyncStorage.setItem('user_country', signupData.country);
        await AsyncStorage.setItem('user_gender', signupData.gender);
        
        // Log signup date
        const loginHistory = await AsyncStorage.getItem('login_history') || '[]';
        const history = JSON.parse(loginHistory);
        history.push({
          date: new Date().toISOString(),
          device: Platform.OS,
          type: 'signup'
        });
        await AsyncStorage.setItem('login_history', JSON.stringify(history.slice(-10)));
        
        // Navigate to OTP verification instead of the main app
        router.push({
          pathname: '/verifyOtp',
          params: { email: signupData.email }
        });
      } catch (error: any) {
        console.error('Signup error:', error);
        
        let errorMessage = 'This email may already be registered. Please try again.';
        if (error.response && error.response.data && error.response.data.error) {
          errorMessage = error.response.data.error;
        }
        
        // Use the themed alert
        showThemedAlert('Signup Failed', errorMessage);
      }
    } finally {
      setLoading(false);
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
    // Navigate to forgot password page
    router.push('/forgotPassword');
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
      
      <TouchableOpacity
        style={styles.forgotPasswordBtn}
        onPress={handleForgotPassword}
      >
        <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
      </TouchableOpacity>
      
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

  // Show themed alert function
  const showThemedAlert = (title: string, message: string) => {
    setAlertTitle(title);
    setAlertMessage(message);
    setAlertVisible(true);
  };

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
      
      <View style={styles.tabs}>
        <TouchableOpacity 
          style={[styles.tab, isLogin && styles.activeTab]}
          onPress={() => setIsLogin(true)}
        >
          <Text style={[styles.tabText, isLogin && styles.activeTabText]}>Login</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, !isLogin && styles.activeTab]}
          onPress={() => setIsLogin(false)}
        >
          <Text style={[styles.tabText, !isLogin && styles.activeTabText]}>Sign Up</Text>
        </TouchableOpacity>
      </View>
      
      <ScrollView 
        style={[styles.scrollView, { backgroundColor: colors.background }]} 
        contentContainerStyle={styles.scrollViewContent}
        keyboardShouldPersistTaps="handled"
      >
        {isLogin ? renderLoginForm() : renderSignupForm()}
        
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
      </ScrollView>
      
      {/* Add the themed alert */}
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
  tabs: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    marginHorizontal: 20,
    marginBottom: 20,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  activeTab: {
    backgroundColor: AppColors.primary,
    borderRadius: 8,
  },
  tabText: {
    fontSize: 16,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.7)',
  },
  activeTabText: {
    color: AppColors.white,
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
    alignSelf: 'flex-end',
    marginBottom: 20,
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
});