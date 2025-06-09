import React, { useEffect, useState } from 'react';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Tabs, useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { useTheme } from '@/components/ThemeProvider';
import { useClientOnlyValue } from '@/components/useClientOnlyValue';
import AsyncStorage from '@react-native-async-storage/async-storage';

// New app colors
export const AppColors = {
  primary: '#27AE60',    // Green - Finance, trust, success
  secondary: '#2C3E50',  // Dark Blue - Security, professionalism  
  background: '#ECF0F1', // Light Gray - Background, neutrality
  white: '#FFFFFF',      // White - Contrast, clarity
  darkGreen: '#1E8449',  // Dark version of primary
  lightText: '#7F8C8D',  // For secondary text
  danger: '#E74C3C',     // For errors, negative amounts
};

// You can explore the built-in icon families and icons on the web at https://icons.expo.fyi/
function TabBarIcon(props: {
  name: React.ComponentProps<typeof FontAwesome>['name'];
  color: string;
}) {
  return <FontAwesome size={24} style={{ marginBottom: -3 }} {...props} />;
}

// Notification badge component
function NotificationBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  
  return (
    <View style={{
      position: 'absolute',
      right: -6,
      top: -3,
      backgroundColor: AppColors.danger,
      borderRadius: 10,
      minWidth: 20,
      height: 20,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 4,
    }}>
      <Text style={{
        color: AppColors.white,
        fontSize: 12,
        fontWeight: 'bold',
      }}>
        {count > 99 ? '99+' : count}
      </Text>
    </View>
  );
}

export default function TabLayout() {
  const { isDarkMode, colors } = useTheme();
  const router = useRouter();
  const [notificationCount, setNotificationCount] = useState(2);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  
  // Move this hook BEFORE any conditional returns to maintain hooks order consistency
  const headerShownValue = useClientOnlyValue(false, true);

  // Check auth state on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const authToken = await AsyncStorage.getItem('auth_token');
        const isAuthenticatedFlag = await AsyncStorage.getItem('is_authenticated');
        
        // More robust check
        const isAuth = Boolean(
          (isAuthenticatedFlag === 'true' || authToken) &&
          authToken !== 'null' &&
          authToken !== 'undefined' &&
          authToken !== null &&
          authToken !== undefined &&
          authToken !== ''
        );
        
        console.log('TabLayout - Auth check:', isAuth ? 'authenticated' : 'not authenticated');
        console.log('TabLayout - Auth token:', authToken);
        console.log('TabLayout - Is authenticated flag:', isAuthenticatedFlag);
        
        setIsAuthenticated(isAuth);
      } catch (error) {
        console.error('Error checking auth in TabLayout:', error);
        setIsAuthenticated(false);
      }
    };
    
    checkAuth();
  }, []);

  // If auth state is still being determined, return null
  if (isAuthenticated === null) {
    return null;
  }
  
  // Don't render tabs at all if not authenticated
  if (isAuthenticated === false) {
    console.log('TabLayout - Not authenticated, not rendering tabs');
    return null;
  }

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: AppColors.primary,
        tabBarInactiveTintColor: colors.subText,
        tabBarStyle: {
          backgroundColor: colors.cardBackground,
          borderTopColor: colors.border,
        },
        headerStyle: {
          backgroundColor: isDarkMode ? colors.cardBackground : AppColors.primary,
        },
        headerTintColor: isDarkMode ? colors.text : AppColors.white,
        headerTitleStyle: {
          fontWeight: 'bold',
        },
        headerShown: headerShownValue, // Use the pre-calculated value
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color }) => <TabBarIcon name="home" color={color} />,
          headerRight: () => (
            <View style={{ flexDirection: 'row' }}>
              <Pressable
                onPress={() => router.push('/notifications')}
                style={({ pressed }) => ({
                  opacity: pressed ? 0.5 : 1,
                  position: 'relative',
                  marginRight: 15,
                })}
              >
                <FontAwesome
                  name="bell"
                  size={22}
                  color={isDarkMode ? colors.text : AppColors.white}
                />
                <NotificationBadge count={notificationCount} />
              </Pressable>
              
              <Pressable
                onPress={() => router.push('/settings')}
                style={({ pressed }) => ({
                  opacity: pressed ? 0.5 : 1,
                  marginRight: 15,
                })}
              >
                <FontAwesome
                  name="cog"
                  size={22}
                  color={isDarkMode ? colors.text : AppColors.white}
                />
              </Pressable>
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="two"
        options={{
          title: 'Transactions',
          tabBarIcon: ({ color }) => <TabBarIcon name="money" color={color} />,
          headerTitle: "Transactions",
          headerRight: () => (
            <Pressable
              onPress={() => router.push('/notifications')}
              style={({ pressed }) => ({
                opacity: pressed ? 0.5 : 1,
                position: 'relative',
                marginRight: 15,
              })}
            >
              <FontAwesome
                name="bell"
                size={22}
                color={isDarkMode ? colors.text : AppColors.white}
              />
              <NotificationBadge count={notificationCount} />
            </Pressable>
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          tabBarIcon: ({ color }) => <TabBarIcon name="history" color={color} />,
          headerTitle: "Transaction History",
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => <TabBarIcon name="user" color={color} />,
          headerTitle: "My Profile",
        }}
      />
    </Tabs>
  );
}
