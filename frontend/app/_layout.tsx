import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect, useState } from 'react';
import 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
  // Add this flag to prevent multiple redirects
  const [hasRedirectedToOnboarding, setHasRedirectedToOnboarding] = useState(false);
  
  // MOVE THIS REF TO THE COMPONENT LEVEL - not inside useEffect
  const isCurrentlyNavigating = React.useRef(false);

  useEffect(() => {
    let isActive = true; // To handle component unmounting
    let timeoutId: ReturnType<typeof setTimeout>;

    const checkAuthState = async () => {
      try {
        console.log('Starting auth state check...');
        
        // Set platform-specific timeout
        const timeoutDuration = Platform.OS === 'android' ? 8000 : 5000;
        
        timeoutId = setTimeout(() => {
          if (isActive && authState.isLoading) {
            console.log('Authentication check timed out');
            
            // For Android, just enable offline mode automatically
            if (Platform.OS === 'android') {
              handleOfflineMode();
            } else {
              setAuthState({
                isAuthenticated: false,
                isLoading: false,
                user: null
              });
              setCheckedOnboarding(true);
            }
          }
        }, timeoutDuration);
        
        // Add this helper function
        const handleOfflineMode = async () => {
          console.log('Setting up offline mode for Android');
          await AsyncStorage.setItem('auth_token', 'offline-token');
          await AsyncStorage.setItem('user_id', 'offline');
          await AsyncStorage.setItem('user_email', 'offline@example.com');
          await AsyncStorage.setItem('is_offline_mode', 'true');
                
          setAuthState({
            isAuthenticated: true,
            isLoading: false,
            user: { id: 'offline', email: 'offline@example.com' }
          });
          setCheckedOnboarding(true);
        };

        // Check if onboarding is in progress to prevent redirection loops
        const onboardingInProgress = await AsyncStorage.getItem('onboarding_in_progress');
        if (onboardingInProgress === 'true') {
          console.log('Onboarding is in progress, skipping redirect');
          clearTimeout(timeoutId);
          setAuthState({
            isAuthenticated: false,
            isLoading: false,
            user: null
          });
          setCheckedOnboarding(true);
          return;
        }

        // Get data from AsyncStorage
        const [token, userId, email, hasCompletedOnboarding, isAuthenticated] = await Promise.all([
          AsyncStorage.getItem('auth_token'),
          AsyncStorage.getItem('user_id'),
          AsyncStorage.getItem('user_email'),
          AsyncStorage.getItem('completed_onboarding'),
          AsyncStorage.getItem('is_authenticated')
        ]);
        
        // Clear timeout since we got a response
        clearTimeout(timeoutId);
        
        // Update state only if component is still mounted
        if (!isActive) return;
        
        setCheckedOnboarding(true);
        
        // Check if the user is authenticated based on explicit flag or token
        if ((token && userId && email) || isAuthenticated === 'true') {
          console.log('User is authenticated, setting auth state');
          setAuthState({
            isAuthenticated: true,
            isLoading: false,
            user: { id: userId || 'user', email: email || 'user@example.com' }
          });
        } else {
          // For Android, if we're having network issues, set up guest mode
          if (Platform.OS === 'android') {
            console.log('Setting up guest mode for Android');
            // Set up guest credentials
            await AsyncStorage.setItem('auth_token', 'guest-token');
            await AsyncStorage.setItem('user_id', 'guest');
            await AsyncStorage.setItem('user_email', 'guest@example.com');
            await AsyncStorage.setItem('is_guest_mode', 'true');
            
            setAuthState({
              isAuthenticated: true,
              isLoading: false,
              user: { id: 'guest', email: 'guest@example.com' }
            });
          } else {
            setAuthState({
              isAuthenticated: false,
              isLoading: false,
              user: null
            });
          }
        }
      } catch (error) {
        console.error('Failed to check auth state:', error);
        // Ensure we don't get stuck in loading state
        if (isActive) {
          setCheckedOnboarding(true);
          setAuthState({
            isAuthenticated: false,
            isLoading: false,
            user: null
          });
        }
      }
    };

    // Only run auth check if we haven't already redirected to onboarding
    if (!hasRedirectedToOnboarding) {
      checkAuthState();
    }
    
    // Cleanup function
    return () => {
      isActive = false;
      clearTimeout(timeoutId);
    };
  }, [hasRedirectedToOnboarding]); // Add hasRedirectedToOnboarding as a dependency

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
    
    // Add these unprotected routes
    const isUnprotectedRoute = 
      segments[0] === 'terms' || 
      segments[0] === 'privacy' || 
      segments[0] === 'documentation';

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
        </Stack>
      </NavigationThemeProvider>
    </ThemeProvider>
  );
}