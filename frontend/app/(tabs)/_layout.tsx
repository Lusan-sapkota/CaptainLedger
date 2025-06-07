import React, { useState, useEffect } from 'react';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Link, Tabs, useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { useTheme } from '@/components/ThemeProvider';
import { useClientOnlyValue } from '@/components/useClientOnlyValue';

// New app colors
export const AppColors = {
  primary: '#27AE60',    // Green - Finance, trust, success
  secondary: '#2C3E50',  // Dark Blue - Security, professionalism  
  background: '#ECF0F1', // Light Gray - Background, neutrality
  white: '#FFFFFF',      // White - Contrast, clarity
  lightGreen: '#A9DFBF', // Light version of primary
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
        headerShown: useClientOnlyValue(false, true),
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
