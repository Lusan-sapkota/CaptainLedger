import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect, useState } from 'react';
import 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert, Text } from 'react-native';

import { useColorScheme } from '@/components/useColorScheme';
import { ThemeProvider } from '@/components/ThemeProvider';
import { View, ActivityIndicator, Platform } from 'react-native';
import { AppColors } from './(tabs)/_layout';

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
        
        // Instead of calling multiRemove here which might fail,
        // just update the auth state directly for speed
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
      const isAuthenticated = await AsyncStorage.getItem('is_authenticated');
      const authExpiration = await AsyncStorage.getItem('auth_expiration');
      
      // Check if token is expired (for IP login with 30-day persistence)
      let tokenExpired = false;
      if (authExpiration) {
        const expirationDate = new Date(authExpiration);
        const now = new Date();
        tokenExpired = now > expirationDate;
        
        if (tokenExpired) {
          console.log('Auth token has expired');
          // Clear expired auth data
          await AsyncStorage.multiRemove([
            'auth_token', 'user_id', 'user_email', 'is_authenticated', 
            'auth_expiration', 'server_ip', 'is_custom_server'
          ]);
        }
      }
      
      const isValidToken = Boolean(
        authToken && 
        !tokenExpired &&
        (authToken !== 'invalid-token') &&
        (authToken !== '') &&
        (authToken === 'ip-login-token' || 
         authToken === 'offline-token' ||
         authToken === 'guest-token')
      );
      
      const isExplicitlyAuthenticated = isAuthenticated === 'true';
      const hasValidAuth = isValidToken || isExplicitlyAuthenticated;
      
      console.log('Has valid auth?', hasValidAuth, { isValidToken, isExplicitlyAuthenticated });
      
      if (hasValidAuth) {
        const userId = await AsyncStorage.getItem('user_id');
        const email = await AsyncStorage.getItem('user_email');
        
        setAuthState({
          isAuthenticated: true,
          isLoading: false,
          user: { 
            id: userId || 'user', 
            email: email || 'user@example.com' 
          }
        });
      } else {
        setAuthState({
          isAuthenticated: false,
          isLoading: false,
          user: null
        });
      }
      
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
              
              // Clear ALL auth-related items
              const keysToRemove = [
                'auth_token',
                'user_id',
                'user_email',
                'user_fullName',
                'user_country',
                'is_authenticated',
                'is_offline_mode',
                'is_guest_mode',
                'completed_onboarding',
                'profile_setup_completed',
                'user_displayName',
                'user_avatar',
                'user_bio',
                'user_phone'
              ];
              
              // Clear all keys sequentially
              for (const key of keysToRemove) {
                await AsyncStorage.removeItem(key);
              }
              
              console.log('All auth data cleared');
              
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

  if (authState.isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={AppColors.primary} />
      </View>
    );
  }

  return (
    <ThemeProvider>
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
    </ThemeProvider>
  );
}