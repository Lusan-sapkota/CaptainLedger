import React from 'react';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Link, Tabs } from 'expo-router';
import { Pressable } from 'react-native';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
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

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: AppColors.primary,
        tabBarInactiveTintColor: AppColors.lightText,
        tabBarStyle: {
          backgroundColor: AppColors.white,
          borderTopColor: 'rgba(0,0,0,0.1)',
        },
        headerStyle: {
          backgroundColor: AppColors.primary,
        },
        headerTintColor: AppColors.white,
        headerTitleStyle: {
          fontWeight: 'bold',
        },
        // Disable the static render of the header on web
        // to prevent a hydration error in React Navigation v6.
        headerShown: useClientOnlyValue(false, true),
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color }) => <TabBarIcon name="home" color={color} />,
          headerRight: () => (
            <Link href="/modal" asChild>
              <Pressable>
                {({ pressed }) => (
                  <FontAwesome
                    name="cog"
                    size={22}
                    color={AppColors.white}
                    style={{ marginRight: 15, opacity: pressed ? 0.5 : 1 }}
                  />
                )}
              </Pressable>
            </Link>
          ),
        }}
      />
      <Tabs.Screen
        name="two"
        options={{
          title: 'Transactions',
          tabBarIcon: ({ color }) => <TabBarIcon name="money" color={color} />,
          headerTitle: "Transactions",
        }}
      />
    </Tabs>
  );
}
