import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
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

  useEffect(() => {
    const checkAuthState = async () => {
      try {
        const token = await AsyncStorage.getItem('auth_token');
        const userId = await AsyncStorage.getItem('user_id');
        const email = await AsyncStorage.getItem('user_email');
        const hasCompletedOnboarding = await AsyncStorage.getItem('completed_onboarding');
        
        setCheckedOnboarding(true);
        
        // Check if onboarding is needed
        if (!hasCompletedOnboarding && Platform.OS !== 'web') {
          setAuthState({
            isAuthenticated: false, 
            isLoading: false,
            user: null
          });
          router.replace('/onboarding');
          return;
        }
        
        if (token && userId && email) {
          setAuthState({
            isAuthenticated: true,
            isLoading: false,
            user: { id: userId, email }
          });
        } else {
          setAuthState({
            isAuthenticated: false,
            isLoading: false,
            user: null
          });
        }
      } catch (error) {
        console.error('Failed to check auth state:', error);
        setAuthState({
          isAuthenticated: false,
          isLoading: false,
          user: null
        });
      }
    };

    checkAuthState();
  }, []);

  useEffect(() => {
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

    if (!authState.isAuthenticated && 
        !inAuthGroup && 
        !inOnboardingGroup && 
        !isUnprotectedRoute &&
        segments[0] !== undefined) {
      // Redirect to the sign-in page if not authenticated and not on auth, onboarding or unprotected routes
      router.replace('/auth');
    } else if (authState.isAuthenticated && inAuthGroup) {
      // Redirect to the home page if authenticated and on auth
      router.replace('/');
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