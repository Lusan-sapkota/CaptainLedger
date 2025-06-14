import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect, useState } from 'react';
import 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert, Text, AppState } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { useColorScheme } from '@/components/useColorScheme';
import { ThemeProvider } from '@/components/ThemeProvider';
import { AlertProvider } from '@/components/AlertProvider';
import { CurrencyProvider } from '@/components/CurrencyProvider';
import { View, ActivityIndicator, Platform } from 'react-native';
import { AppColors } from './(tabs)/_layout';
import { getUserProfile, configureApi } from '@/services/api';
import sessionManager from '@/utils/sessionManager';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  // Ensure that reloading on `/modal` keeps a back button present.
  initialRouteName: '(tabs)',
};

// Auth context
export type AuthState = {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: { id: string; email: string } | null;
};

export const initialAuthState: AuthState = {
  isAuthenticated: false,
  isLoading: true,
  user: null,
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
  });

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return <RootLayoutNav />;
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const segments = useSegments();
  
  // Authentication state
  const [authState, setAuthState] = useState<AuthState>(initialAuthState);
  const [checkedOnboarding, setCheckedOnboarding] = useState(false);
  const [hasRedirectedToOnboarding, setHasRedirectedToOnboarding] = useState(false);
  
  // Add a trigger to force auth re-check
  const [authCheckTrigger, setAuthCheckTrigger] = useState(0);
  
  const isCurrentlyNavigating = React.useRef(false);

  // Move checkAuthState function outside useEffect so it can be called from logout
  const checkAuthState = React.useCallback(async () => {
    try {
      console.log('=== CHECKING AUTH STATE ===');
      
      // Check if explicitly logged out - this should override everything
      const userLoggedOut = await AsyncStorage.getItem('user_logged_out');
      if (userLoggedOut === 'true') {
        console.log('User explicitly logged out');
        await AsyncStorage.removeItem('user_logged_out');
        
        setAuthState({
          isAuthenticated: false,
          isLoading: false,
          user: null
        });
        setCheckedOnboarding(true);
        return;
      }
      
      // Get auth token - most important item
      const authToken = await AsyncStorage.getItem('auth_token');
      console.log('Auth token found:', authToken ? `${authToken.substring(0, 8)}...` : 'null');
      
      const isAuthenticated = await AsyncStorage.getItem('is_authenticated');
      const authExpiration = await AsyncStorage.getItem('auth_expiration');
      const lastActivity = await AsyncStorage.getItem('last_activity');
      
      // Check if token is expired (30-day session)
      let tokenExpired = false;
      if (authExpiration) {
        const expirationDate = new Date(authExpiration);
        const now = new Date();
        tokenExpired = now > expirationDate;
        
        if (tokenExpired) {
          console.log('Auth session has expired after 30 days');
          await AsyncStorage.multiRemove([
            'auth_token', 'user_id', 'user_email', 'is_authenticated', 
            'auth_expiration', 'server_ip', 'is_custom_server', 'session_created',
            'last_activity', 'device_id'
          ]);
          // Clear all trusted device data
          const keys = await AsyncStorage.getAllKeys();
          const trustedDeviceKeys = keys.filter(key => key.startsWith('trusted_device_'));
          if (trustedDeviceKeys.length > 0) {
            await AsyncStorage.multiRemove(trustedDeviceKeys);
          }
        }
      }
      
      // Update last activity timestamp for session extension
      if (authToken && !tokenExpired) {
        const now = new Date().toISOString();
        await AsyncStorage.setItem('last_activity', now);
        
        // Extend session if it's been more than 7 days since last activity
        if (lastActivity) {
          const lastActivityDate = new Date(lastActivity);
          const daysSinceActivity = (new Date().getTime() - lastActivityDate.getTime()) / (1000 * 60 * 60 * 24);
          
          if (daysSinceActivity > 7) {
            // Extend session by another 30 days
            const newExpirationDate = new Date();
            newExpirationDate.setDate(newExpirationDate.getDate() + 30);
            await AsyncStorage.setItem('auth_expiration', newExpirationDate.toISOString());
            console.log('Session extended for another 30 days due to activity');
          }
        }
      }
      
      // MODIFIED: Consider any valid non-empty token as valid, with better offline handling
      const isSpecialToken = authToken === 'ip-login-token' || 
                            authToken === 'offline-token' || 
                            authToken === 'guest-token';
                            
      // More lenient token validity check - prioritize local auth state
      const isValidToken = Boolean(
        authToken && 
        !tokenExpired &&
        authToken !== 'invalid-token' &&
        authToken !== ''
      );
      
      const isExplicitlyAuthenticated = isAuthenticated === 'true';
      const hasValidAuth = isValidToken || isExplicitlyAuthenticated;
      
      console.log('Auth check details:', { 
        isValidToken, 
        isExplicitlyAuthenticated,
        tokenExpired,
        hasValidAuth,
        sessionExtended: lastActivity ? 'checked' : 'no_activity'
      });
      
      if (hasValidAuth) {
        const userId = await AsyncStorage.getItem('user_id');
        const email = await AsyncStorage.getItem('user_email');
        
        if (userId && email) {
          setAuthState({
            isAuthenticated: true,
            isLoading: false,
            user: { id: userId, email }
          });
          setCheckedOnboarding(true);
          return;
        }
      }
      
      // Only validate with server if we have a real token and good network
      if (authToken && !isSpecialToken && !tokenExpired && navigator.onLine) {
        console.log('Validating session with server...');
        
        try {
          // Validate token by fetching user profile with timeout
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Request timeout')), 8000)
          );
          
          const responsePromise = getUserProfile();
          
          const responseUnknown = await Promise.race([responsePromise, timeoutPromise]);
          const response = responseUnknown as { status: number; data: any };

          if (response.status === 200 && response.data) {
            setAuthState({
              isAuthenticated: true,
              isLoading: false,
              user: response.data
            });
            setCheckedOnboarding(true);
            return;
          } else {
            // For specific error codes, keep the user authenticated
            if (response.status === 0 || response.status === 408) {
              // Network error or timeout - still allow user to use the app
              console.log('Network issue, keeping user authenticated with local data');
              const userId = await AsyncStorage.getItem('user_id');
              const email = await AsyncStorage.getItem('user_email');
              
              if (userId && email) {
                setAuthState({
                  isAuthenticated: true,
                  isLoading: false,
                  user: { id: userId, email }
                });
                setCheckedOnboarding(true);
                return;
              }
            }
            
            // Other errors, clear token
            console.log('Server validation failed, clearing session');
            await AsyncStorage.multiRemove([
              'auth_token', 'user_id', 'user_email', 'is_authenticated', 
              'auth_expiration', 'server_ip', 'is_custom_server', 'session_created',
              'last_activity', 'device_id'
            ]);
          }
        } catch (error) {
          console.error('Error validating with server:', error);
          // On network error, fall back to local storage data if available
          const userId = await AsyncStorage.getItem('user_id');
          const email = await AsyncStorage.getItem('user_email');
          
          if (userId && email) {
            console.log('Server validation failed, using local auth data');
            setAuthState({
              isAuthenticated: true,
              isLoading: false,
              user: { id: userId, email }
            });
            setCheckedOnboarding(true);
            return;
          }
        }
      }
      
      // If we reach here, authentication failed
      setAuthState({
        isAuthenticated: false,
        isLoading: false,
        user: null
      });
      
      setCheckedOnboarding(true);
    } catch (error) {
      console.error('Failed to check auth state:', error);
      setAuthState({
        isAuthenticated: false,
        isLoading: false,
        user: null
      });
      setCheckedOnboarding(true);
    }
  }, []);

  useEffect(() => {
    if (!hasRedirectedToOnboarding) {
      checkAuthState();
    }
  }, [hasRedirectedToOnboarding, authCheckTrigger, checkAuthState]);

  // Add session management for app state changes
  useEffect(() => {
    const handleAppStateChange = (nextAppState: string) => {
      if (nextAppState === 'active') {
        // Update session activity when app becomes active
        sessionManager.updateActivity();
        
        // Check if session is still valid
        sessionManager.isSessionValid().then(isValid => {
          if (!isValid && authState.isAuthenticated) {
            console.log('Session expired, logging out user');
            handleLogout();
          }
        });
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    
    // Initial activity update
    sessionManager.updateActivity();

    return () => subscription?.remove();
  }, [authState.isAuthenticated]);

  // Periodic session validation
  useEffect(() => {
    if (!authState.isAuthenticated) return;

    const interval = setInterval(async () => {
      const isValid = await sessionManager.isSessionValid();
      if (!isValid) {
        console.log('Session validation failed, logging out user');
        clearInterval(interval);
        handleLogout();
      } else {
        // Update activity periodically
        sessionManager.updateActivity();
      }
    }, 10 * 60 * 1000); // Check every 10 minutes

    return () => clearInterval(interval);
  }, [authState.isAuthenticated]);

  useEffect(() => {
    console.log('Auth state changed:', {
      isAuthenticated: authState.isAuthenticated,
      isLoading: authState.isLoading,
      checkedOnboarding,
      currentSegment: segments[0]
    });
    
    if (authState.isLoading || !checkedOnboarding) {
      // Still loading, don't redirect
      return;
    }

    const inAuthGroup = segments[0] === 'auth';
    const inOnboardingGroup = segments[0] === 'onboarding';
    
    // Update this list to include profileSetup
    const isUnprotectedRoute = 
      segments[0] === 'terms' || 
      segments[0] === 'privacy' || 
      segments[0] === 'documentation' ||
      segments[0] === 'verifyOtp' || 
      segments[0] === 'profileSetup';  // Add this line

    // IMPORTANT: Use the ref created at component level, not locally
    if (!isCurrentlyNavigating.current) {
      if (!authState.isAuthenticated && 
          !inAuthGroup && 
          !inOnboardingGroup && 
          !isUnprotectedRoute &&
          segments[0] !== undefined) {
        // Redirect to the sign-in page if not authenticated and not on auth, onboarding or unprotected routes
        isCurrentlyNavigating.current = true;
        console.log('Redirecting to auth page from:', segments[0]);
        
        setTimeout(() => {
          router.replace('/auth');
          // Reset after a delay to prevent multiple navigations
          setTimeout(() => {
            isCurrentlyNavigating.current = false;
          }, 1000);
        }, 100);
      } else if (authState.isAuthenticated && inAuthGroup) {
        // Redirect to the home page if authenticated and on auth
        isCurrentlyNavigating.current = true;
        console.log('Redirecting to home from auth page');
        
        setTimeout(() => {
          router.replace('/');
          // Reset after a delay
          setTimeout(() => {
            isCurrentlyNavigating.current = false;
          }, 1000);
        }, 100);
      }
    }
  }, [authState.isAuthenticated, authState.isLoading, segments, checkedOnboarding]);

  const handleLogout = async () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Logout',
          onPress: async () => {
            try {
              console.log('=== LOGOUT START ===');
              
              // Set logout flag before clearing storage
              await AsyncStorage.setItem('user_logged_out', 'true');
              
              // Use session manager to clear all session data
              await sessionManager.clearSession();
              
              // Clear additional user data
              const additionalKeysToRemove = [
                'user_fullName',
                'user_country',
                'is_offline_mode',
                'is_guest_mode',
                'completed_onboarding',
                'profile_setup_completed',
                'user_displayName',
                'user_avatar',
                'user_bio',
                'user_phone'
              ];
              
              await AsyncStorage.multiRemove(additionalKeysToRemove);
              
              console.log('All auth and session data cleared');
              
              // Force auth state re-check
              setAuthState({
                isAuthenticated: false,
                isLoading: false,
                user: null
              });
              
              // Trigger auth check to ensure state is updated
              setAuthCheckTrigger(prev => prev + 1);
              
              console.log('=== LOGOUT END ===');
              
              // Navigate to auth
              setTimeout(() => {
                router.replace('/auth');
              }, 100);
              
            } catch (error) {
              console.error('Logout error:', error);
              Alert.alert('Logout Error', 'Failed to logout. Please try again.');
            }
          }
        }
      ]
    );
  };

  // Add better token refresh and persistence
  useEffect(() => {
    const checkAuthentication = async () => {
      try {
        setAuthState(prev => ({ ...prev, isLoading: true }));
        
        // Check for token in storage
        const token = await AsyncStorage.getItem('auth_token');
        
        if (!token) {
          setAuthState({
            isAuthenticated: false,
            isLoading: false,
            user: null
          });
          return;
        }
        
        // Validate token by fetching user profile with timeout
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Request timeout')), 8000)
        );
        
        const responsePromise = getUserProfile();
        
        const responseUnknown = await Promise.race([responsePromise, timeoutPromise]);
        const response = responseUnknown as { status: number; data: any };

        if (response.status === 200 && response.data) {
          setAuthState({
            isAuthenticated: true,
            isLoading: false,
            user: response.data
          });
        } else {
          // For specific error codes, keep the user authenticated
          if (response.status === 0 || response.status === 408) {
            // Network error or timeout - still allow user to use the app
            console.log('Network issue, keeping user authenticated');
            const userId = await AsyncStorage.getItem('user_id');
            const email = await AsyncStorage.getItem('user_email');
            
            if (userId && email) {
              setAuthState({
                isAuthenticated: true,
                isLoading: false,
                user: { id: userId, email }
              });
              return;
            }
          }
          
          // Other errors, clear token
          await AsyncStorage.removeItem('auth_token');
          setAuthState({
            isAuthenticated: false,
            isLoading: false,
            user: null
          });
        }
      } catch (error) {
        console.error('Error checking authentication:', error);
        // On error, fall back to local storage data if available
        const userId = await AsyncStorage.getItem('user_id');
        const email = await AsyncStorage.getItem('user_email');
        
        if (userId && email) {
          setAuthState({
            isAuthenticated: true,
            isLoading: false,
            user: { id: userId, email }
          });
        } else {
          await AsyncStorage.removeItem('auth_token');
          setAuthState({
            isAuthenticated: false,
            isLoading: false,
            user: null
          });
        }
      }
    };
    
    checkAuthentication();
  }, []);

  // Add this function to your RootLayoutNav component
  const checkApiConnection = async (): Promise<{success: boolean; message: string}> => {
    try {
      const customServerIp = await AsyncStorage.getItem('server_ip');
      const testUrl = customServerIp 
        ? `http://${customServerIp}:5000/api/status` 
        : (Platform.OS === 'android' 
            ? 'http://10.0.2.2:5000/api/status' 
            : 'http://localhost:5000/api/status');
      
      console.log(`Testing API connection to: ${testUrl}`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      try {
        const response = await fetch(testUrl, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          mode: 'cors',
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (response.ok) {
          const data = await response.json();
          console.log('API connection successful:', data);
          return {
            success: true,
            message: `Connected to server: ${data?.message || 'OK'}`
          };
        } else {
          console.error(`API connection failed with status: ${response.status}`);
          return {
            success: false,
            message: `Server returned error: ${response.status} ${response.statusText}`
          };
        }
      } catch (fetchError) {
        clearTimeout(timeoutId);
        if (fetchError instanceof Error && fetchError.name === 'AbortError') {
          return {
            success: false,
            message: 'Connection timed out after 10 seconds'
          };
        }
        throw fetchError; // Re-throw for outer catch
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('API connection test failed:', errorMessage);
      return {
        success: false,
        message: `Connection failed: ${errorMessage}`
      };
    }
  };

  // Call this in your initApi function
  useEffect(() => {
    const initApi = async () => {
      try {
        // First test the connection
        const connectionStatus = await checkApiConnection();
        console.log('API connection test result:', connectionStatus.success, connectionStatus.message);
        
        // Get any custom server IP the user might have set
        const customServerIp = await AsyncStorage.getItem('server_ip');
        
        // Use the configureApi function from the api module
        if (typeof configureApi === 'function') {
          const apiOptions = customServerIp ? { baseURL: `http://${customServerIp}:5000/api` } : {};
          configureApi(apiOptions);
        } else {
          console.warn('configureApi function not available');
        }
        
        // Store connection status
        await AsyncStorage.setItem('api_connection_status', JSON.stringify(connectionStatus));
      } catch (error) {
        console.error('Error initializing API client:', error);
      }
    };
    
    initApi();
  }, []);

  if (authState.isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={AppColors.primary} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <AlertProvider>
          <CurrencyProvider>
            <NavigationThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
              <Stack>
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
                <Stack.Screen name="notifications" options={{ title: "Notifications" }} />
                <Stack.Screen name="settings" options={{ title: "Settings" }} />
                <Stack.Screen name="onboarding" options={{ headerShown: false, gestureEnabled: false }} />
                <Stack.Screen name="auth" options={{ headerShown: false, gestureEnabled: false }} />
                <Stack.Screen name="terms" options={{ title: "Terms & Conditions" }} />
                <Stack.Screen name="privacy" options={{ title: "Privacy Policy" }} />
                <Stack.Screen name="documentation" options={{ title: "Documentation" }} />
                <Stack.Screen name="forgotPassword" options={{ headerShown: false }} />
                <Stack.Screen name="verifyOtp" options={{ headerShown: false, gestureEnabled: false }} />
                <Stack.Screen name="profileSetup" options={{ headerShown: false, gestureEnabled: false }} />
                <Stack.Screen name="editProfile" options={{ headerShown: false }} />
                <Stack.Screen name="changePassword" options={{ headerShown: false }} />
              </Stack>
            </NavigationThemeProvider>
          </CurrencyProvider>
        </AlertProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

