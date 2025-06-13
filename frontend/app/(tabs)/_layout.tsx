import React, { useEffect, useState } from 'react';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Tabs, useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { useTheme } from '@/components/ThemeProvider';
import { useClientOnlyValue } from '@/components/useClientOnlyValue';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AlertProvider } from '@/components/AlertProvider';
import Sidebar from '@/components/Sidebar';

// New app colors
export const AppColors = {
  primary: '#27AE60',    // Green - Finance, trust, success
  secondary: '#2C3E50',  // Dark Blue - Security, professionalism  
  background: '#ECF0F1', // Light Gray - Background, neutrality
  white: '#FFFFFF',      // White - Contrast, clarity
  darkGreen: '#1E8449',  // Dark version of primary
  lightText: '#7F8C8D',  // For secondary text
  danger: '#E74C3C',     // For errors, negative amounts
  warning: '#F39C12',   // For warnings, alerts
  info: '#17a2b8'
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
  const [sidebarVisible, setSidebarVisible] = useState(false);
  
  // Move this hook BEFORE any conditional returns to maintain hooks order consistency
  const headerShownValue = useClientOnlyValue(false, true);

  // Check auth state on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const authToken = await AsyncStorage.getItem('auth_token');
        const isAuthenticatedFlag = await AsyncStorage.getItem('is_authenticated');
        const userId = await AsyncStorage.getItem('user_id');
        
        const hasValidToken = Boolean(authToken && authToken !== 'null' && authToken !== 'undefined');
        const isExplicitlyAuthenticated = isAuthenticatedFlag === 'true';
        const hasUserData = Boolean(userId);
        
        const isUserAuthenticated = hasValidToken && (isExplicitlyAuthenticated || hasUserData);
        
        setIsAuthenticated(isUserAuthenticated);
        
        if (!isUserAuthenticated) {
          router.replace('/auth');
        }
      } catch (error) {
        console.error('Auth check error:', error);
        setIsAuthenticated(false);
        router.replace('/auth');
      }
    };

    checkAuth();
  }, []);

  if (isAuthenticated === null) {
    return null; // Loading state
  }

  if (!isAuthenticated) {
    return null; // Will redirect to login
  }

  return (
    <AlertProvider>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: AppColors.primary,
          tabBarInactiveTintColor: isDarkMode ? colors.subText : AppColors.lightText,
          tabBarStyle: {
            backgroundColor: colors.cardBackground,
            borderTopColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
            paddingTop: 5,
            height: 60,
          },
          headerStyle: {
            backgroundColor: isDarkMode ? colors.cardBackground : AppColors.secondary,
          },
          headerTintColor: isDarkMode ? colors.text : AppColors.white,
          headerTitleStyle: {
            fontWeight: 'bold',
          },
          headerShown: headerShownValue,
        }}>
        <Tabs.Screen
          name="index"
          options={{
            title: 'Dashboard',
            tabBarIcon: ({ color }) => <TabBarIcon name="home" color={color} />,
            headerLeft: () => (
              <Pressable
                onPress={() => setSidebarVisible(true)}
                style={({ pressed }) => ({
                  opacity: pressed ? 0.5 : 1,
                  marginLeft: 20, // Increased margin from 15 to 20
                  marginRight: 15, // Add right margin for spacing from title
                  padding: 8, // Add padding for better touch area
                  borderRadius: 8, // Add subtle border radius
                  backgroundColor: pressed ? 'rgba(255,255,255,0.1)' : 'transparent',
                })}
              >
                <FontAwesome
                  name="bars"
                  size={22}
                  color={isDarkMode ? colors.text : AppColors.white}
                />
              </Pressable>
            ),
            headerRight: () => (
              <View style={{ flexDirection: 'row', marginRight: 10 }}>
                <Pressable
                  onPress={() => router.push('/notifications')}
                  style={({ pressed }) => ({
                    opacity: pressed ? 0.5 : 1,
                    position: 'relative',
                    marginRight: 15,
                    padding: 8,
                    borderRadius: 8,
                    backgroundColor: pressed ? 'rgba(255,255,255,0.1)' : 'transparent',
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
                    marginRight: 10,
                    padding: 8,
                    borderRadius: 8,
                    backgroundColor: pressed ? 'rgba(255,255,255,0.1)' : 'transparent',
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
          name="transactions"
          options={{
            title: 'Transactions',
            tabBarIcon: ({ color }) => <TabBarIcon name="money" color={color} />,
            headerTitle: "Transactions",
            headerLeft: () => (
              <Pressable
                onPress={() => setSidebarVisible(true)}
                style={({ pressed }) => ({
                  opacity: pressed ? 0.5 : 1,
                  marginLeft: 20,
                  marginRight: 15,
                  padding: 8,
                  borderRadius: 8,
                  backgroundColor: pressed ? 'rgba(255,255,255,0.1)' : 'transparent',
                })}
              >
                <FontAwesome
                  name="bars"
                  size={22}
                  color={isDarkMode ? colors.text : AppColors.white}
                />
              </Pressable>
            ),
            headerRight: () => (
              <Pressable
                onPress={() => router.push('/notifications')}
                style={({ pressed }) => ({
                  opacity: pressed ? 0.5 : 1,
                  position: 'relative',
                  marginRight: 20,
                  padding: 8,
                  borderRadius: 8,
                  backgroundColor: pressed ? 'rgba(255,255,255,0.1)' : 'transparent',
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
            headerLeft: () => (
              <Pressable
                onPress={() => setSidebarVisible(true)}
                style={({ pressed }) => ({
                  opacity: pressed ? 0.5 : 1,
                  marginLeft: 20,
                  marginRight: 15,
                  padding: 8,
                  borderRadius: 8,
                  backgroundColor: pressed ? 'rgba(255,255,255,0.1)' : 'transparent',
                })}
              >
                <FontAwesome
                  name="bars"
                  size={22}
                  color={isDarkMode ? colors.text : AppColors.white}
                />
              </Pressable>
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile',
            tabBarIcon: ({ color }) => <TabBarIcon name="user" color={color} />,
            headerTitle: "My Profile",
            headerLeft: () => (
              <Pressable
                onPress={() => setSidebarVisible(true)}
                style={({ pressed }) => ({
                  opacity: pressed ? 0.5 : 1,
                  marginLeft: 20,
                  marginRight: 15,
                  padding: 8,
                  borderRadius: 8,
                  backgroundColor: pressed ? 'rgba(255,255,255,0.1)' : 'transparent',
                })}
              >
                <FontAwesome
                  name="bars"
                  size={22}
                  color={isDarkMode ? colors.text : AppColors.white}
                />
              </Pressable>
            ),
          }}
        />
      </Tabs>
      
      {/* Sidebar Component */}
      <Sidebar 
        visible={sidebarVisible} 
        onClose={() => setSidebarVisible(false)} 
      />
    </AlertProvider>
  );
}
