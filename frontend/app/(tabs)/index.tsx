import { StyleSheet, TouchableOpacity, Image, ScrollView, Platform, View as RNView, Animated, LayoutAnimation, UIManager, RefreshControl } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Href, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { Text, View } from '@/components/Themed';
import { AppColors } from './_layout';
import { useState, useEffect, useCallback } from 'react';
import { getUserProfile } from '@/services/api';
import { useTheme } from '@/components/ThemeProvider';

const FEATURE_ITEMS = [
  { 
    id: '1', 
    title: 'Add Transaction', 
    icon: 'plus-circle', 
    route: '/two',
    color: AppColors.primary
  },
  { 
    id: '2', 
    title: 'Analytics', 
    icon: 'bar-chart', 
    route: '/modal',
    color: AppColors.secondary
  },
  { 
    id: '3', 
    title: 'Budgets', 
    icon: 'pie-chart', 
    route: '/modal',
    color: '#9B59B6'
  },
  { 
    id: '4', 
    title: 'Accounts', 
    icon: 'bank', 
    route: '/modal',
    color: '#3498DB'
  },
];

// Enable LayoutAnimation for Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function DashboardScreen() {
  const router = useRouter();
  const [userProfile, setUserProfile] = useState<{email: string, displayName?: string, fullName?: string, profile_picture?: string} | null>(null);
  const [loading, setLoading] = useState(true);
  const { isDarkMode, colors } = useTheme();
  const [showPersonalWelcome, setShowPersonalWelcome] = useState(true);
  
  // Create animated values for transitions
  const personalOpacity = useState(new Animated.Value(1))[0];
  const logoOpacity = useState(new Animated.Value(0))[0];
  
  // Add these animated values for more effects
  const personalScale = useState(new Animated.Value(1))[0];
  const logoScale = useState(new Animated.Value(0.9))[0];
  const personalY = useState(new Animated.Value(0))[0];
  const logoY = useState(new Animated.Value(10))[0];
  
  // Function to get first name from full name
  const getFirstName = (name: string) => {
    return name?.split(' ')[0] || 'User';
  };
  
  // Get display name for welcome message
  const getDisplayName = () => {
    // Check if user is in guest mode
    const isGuestMode = userProfile?.email === 'guest@example.com';
    
    if (isGuestMode) return 'Guest';
    if (userProfile?.displayName) return userProfile.displayName;
    if (userProfile?.fullName) return getFirstName(userProfile.fullName);
    return 'User';
  };
  
  // Toggle welcome message every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      // Configure nice layout animation
      LayoutAnimation.configureNext({
        duration: 500,
        create: { 
          type: LayoutAnimation.Types.easeInEaseOut,
          property: LayoutAnimation.Properties.opacity,
        },
        update: { 
          type: LayoutAnimation.Types.easeInEaseOut,
        },
        delete: { 
          type: LayoutAnimation.Types.easeInEaseOut,
          property: LayoutAnimation.Properties.opacity,
        },
      });
      
      // New enhanced sequence with spring animations
      if (showPersonalWelcome) {
        // Animate personal view out, logo view in
        Animated.parallel([
          // Fade personal out
          Animated.timing(personalOpacity, {
            toValue: 0,
            duration: 350,
            useNativeDriver: true
          }),
          // Move personal up slightly while fading out
          Animated.timing(personalY, {
            toValue: -10,
            duration: 400,
            useNativeDriver: true
          }),
          // Scale personal down slightly
          Animated.timing(personalScale, {
            toValue: 0.9,
            duration: 400,
            useNativeDriver: true
          }),
          // Fade logo in
          Animated.spring(logoOpacity, {
            toValue: 1,
            friction: 8, // Lower = more bouncy
            tension: 50, // Strength
            useNativeDriver: true
          }),
          // Move logo up from bottom
          Animated.spring(logoY, {
            toValue: 0,
            friction: 8,
            tension: 50,
            useNativeDriver: true
          }),
          // Scale logo up
          Animated.spring(logoScale, {
            toValue: 1,
            friction: 8,
            tension: 50,
            useNativeDriver: true
          })
        ]).start();
      } else {
        // Animate logo view out, personal view in
        Animated.parallel([
          // Fade logo out
          Animated.timing(logoOpacity, {
            toValue: 0,
            duration: 350,
            useNativeDriver: true
          }),
          // Move logo up slightly while fading out
          Animated.timing(logoY, {
            toValue: -10,
            duration: 400,
            useNativeDriver: true
          }),
          // Scale logo down slightly
          Animated.timing(logoScale, {
            toValue: 0.9,
            duration: 400,
            useNativeDriver: true
          }),
          // Fade personal in with spring
          Animated.spring(personalOpacity, {
            toValue: 1,
            friction: 8,
            tension: 50,
            useNativeDriver: true
          }),
          // Move personal up from bottom
          Animated.spring(personalY, {
            toValue: 0,
            friction: 8,
            tension: 50,
            useNativeDriver: true
          }),
          // Scale personal up
          Animated.spring(personalScale, {
            toValue: 1,
            friction: 8,
            tension: 50,
            useNativeDriver: true
          })
        ]).start();
      }
      
      setShowPersonalWelcome(prev => !prev);
    }, 5000);
    
    return () => clearInterval(interval);
  }, [showPersonalWelcome, personalOpacity, logoOpacity, personalScale, logoScale, personalY, logoY]);
  
  // Add this state for refresh control
  const [refreshing, setRefreshing] = useState(false);
  
  // Add this function to handle refresh
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    
    // Reload user profile and other data
    const refreshData = async () => {
      try {
        // Reset user profile state
        setUserProfile(null);
        setLoading(true);
        
        // Re-fetch user profile
        await fetchUserProfile();
      } catch (error) {
        console.log('Error refreshing data:', error);
      } finally {
        setRefreshing(false);
      }
    };
    
    refreshData();
  }, []);

  // Extract fetchUserProfile to a named function so we can reuse it
  const fetchUserProfile = async () => {
    try {
      // Also check if in guest mode
      const isGuestMode = await AsyncStorage.getItem('is_guest_mode');
      
      if (isGuestMode === 'true') {
        setUserProfile({
          email: 'guest@example.com',
          displayName: 'Guest',
          fullName: 'Guest User',
          profile_picture: ''
        });
        setLoading(false);
        return;
      }
      
      // Try to get from API first
      const response = await getUserProfile();
      const apiData = response.data;
      
      // Also get local storage values as fallback
      const localDisplayName = await AsyncStorage.getItem('user_displayName');
      const localFullName = await AsyncStorage.getItem('user_fullName');
      const localAvatar = await AsyncStorage.getItem('user_avatar');
      
      setUserProfile({
        email: apiData?.email || 'user@example.com',
        displayName: apiData?.displayName || localDisplayName || '',
        fullName: apiData?.full_name || apiData?.fullName || localFullName || '',
        profile_picture: apiData?.profile_picture || localAvatar || ''
      });
    } catch (error) {
      console.log('Error fetching profile:', error);
      
      // Fallback to local storage
      try {
        const email = await AsyncStorage.getItem('user_email') || 'user@example.com';
        const displayName = await AsyncStorage.getItem('user_displayName');
        const fullName = await AsyncStorage.getItem('user_fullName');
        const avatar = await AsyncStorage.getItem('user_avatar');
        
        setUserProfile({
          email,
          displayName: displayName || '',
          fullName: fullName || '',
          profile_picture: avatar || ''
        });
      } catch (e) {
        console.log('Local storage fallback failed:', e);
        setUserProfile({ email: 'user@example.com' });
      }
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    fetchUserProfile();
  }, []);
  
  // Add this helper function at the top of your DashboardScreen function
  const getImageUrl = (imagePath: string): string => {
    // If it's already a full URL, use it as is
    if (imagePath.startsWith('http')) {
      return imagePath;
    }
    
    // Your development machine's IP - should match the one in api.ts
    const DEV_MACHINE_IP = '192.168.18.2';
    
    // For relative paths, add the appropriate base URL
    if (Platform.OS === 'ios') {
      return `http://${DEV_MACHINE_IP}:5000${imagePath}`;
    } else if (Platform.OS === 'android') {
      return `http://${DEV_MACHINE_IP}:5000${imagePath}`;
    } else {
      return `http://localhost:5000${imagePath}`;
    }
  };
  
  return (
    <ScrollView 
      style={[styles.scrollView, { backgroundColor: colors.background }]}
      refreshControl={
        <RefreshControl 
          refreshing={refreshing} 
          onRefresh={onRefresh}
          colors={[AppColors.primary]} // Android
          tintColor={isDarkMode ? AppColors.primary : AppColors.secondary} // iOS
          title="Pull to refresh" // iOS
          titleColor={isDarkMode ? AppColors.primary : AppColors.secondary} // iOS
        />
      }
    >
      <View style={[styles.welcomeContainer, { backgroundColor: AppColors.secondary }]}>
        {userProfile?.email === 'guest@example.com' ? (
          // Guest user display
          <>
            <Image
              source={require('@/assets/images/icon.png')}
              style={styles.logo}
            />
            <Text style={[styles.welcomeText, { color: colors.buttonText }]}>
              Welcome back, Guest
            </Text>
          </>
        ) : (
          // Animated transitions for regular users
          <RNView style={styles.welcomeContentContainer}>
            {/* Personal welcome view */}
            <Animated.View 
              style={[
                styles.welcomeContent,
                { 
                  opacity: personalOpacity, 
                  position: 'absolute', 
                  width: '100%',
                  transform: [
                    { translateY: personalY },
                    { scale: personalScale }
                  ]
                }
              ]}
            >
              {userProfile?.profile_picture ? (
                <Image
                  source={{ 
                    uri: getImageUrl(userProfile.profile_picture)
                  }}
                  style={styles.profileImage}
                  defaultSource={require('@/assets/images/default-profile.svg')}
                />
              ) : (
                <RNView style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarText}>
                    {userProfile?.fullName ? userProfile.fullName[0].toUpperCase() : 'U'}
                  </Text>
                </RNView>
              )}
              <Text style={[styles.welcomeText, { color: colors.buttonText }]}>
                Welcome back, {getDisplayName()}
              </Text>
            </Animated.View>
            
            {/* Logo welcome view */}
            <Animated.View 
              style={[
                styles.welcomeContent,
                { 
                  opacity: logoOpacity, 
                  position: 'absolute', 
                  width: '100%',
                  transform: [
                    { translateY: logoY },
                    { scale: logoScale }
                  ]
                }
              ]}
            >
              <Image
                source={require('@/assets/images/icon.png')}
                style={styles.logo}
              />
              <Text style={[styles.welcomeText, { color: colors.buttonText }]}>
                Welcome to CaptainLedger
              </Text>
            </Animated.View>
          </RNView>
        )}
        
        {/* Email stays outside the animated container for stability */}
        <Text style={[styles.userEmail, { color: isDarkMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(255, 255, 255, 0.8)' }]}>
          {loading ? 'Loading...' : userProfile?.email === 'guest@example.com' ? 'Guest Mode' : userProfile?.email || 'Guest User'}
        </Text>
      </View>
      
      {/* Monthly Overview Card */}
      <View style={[styles.summaryCard, { backgroundColor: colors.cardBackground }]}>
        <View style={[styles.summaryCardHeader, { backgroundColor: colors.cardBackground }]}>
          <Text style={[styles.summaryTitle, { color: colors.text }]}>Monthly Overview</Text>
          <Text style={[styles.summaryDate, { color: colors.subText }]}>October 2023</Text>
        </View>
        
        <View style={[styles.summaryRow, { backgroundColor: colors.cardBackground }]}>
          <View style={[styles.summaryItem, { backgroundColor: colors.cardBackground }]}>
            <Text style={[styles.summaryLabel, { color: colors.subText }]}>Income</Text>
            <Text style={styles.summaryValuePositive}>$1,500.00</Text>
          </View>
          <View style={[styles.summaryDivider, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }]} />
          <View style={[styles.summaryItem, { backgroundColor: colors.cardBackground }]}>
            <Text style={[styles.summaryLabel, { color: colors.subText }]}>Expenses</Text>
            <Text style={styles.summaryValueNegative}>$875.25</Text>
          </View>
        </View>
        
        <View style={[styles.balanceContainer, { 
          backgroundColor: colors.cardBackground, 
          borderTopColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' 
        }]}>
          <Text style={[styles.balanceLabel, { color: colors.text }]}>Balance</Text>
          <Text style={styles.balanceValue}>+$624.75</Text>
        </View>
      </View>
      
      <Text style={[styles.sectionTitle, { color: colors.text }]}>Quick Actions</Text>
      
      <View style={[styles.featuresContainer, { backgroundColor: colors.background }]}>
        {FEATURE_ITEMS.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={styles.featureItem}
            onPress={() => router.push(item.route as Href)}
          >
            <View style={[styles.featureIconContainer, { backgroundColor: item.color }]}>
              <FontAwesome name={item.icon as any} size={24} color="white" />
            </View>
            <Text style={[styles.featureTitle, { color: colors.text }]}>{item.title}</Text>
          </TouchableOpacity>
        ))}
      </View>
      
      <Text style={[styles.sectionTitle, { color: colors.text }]}>Recent Transactions</Text>
      
      <View style={[styles.recentTransactionsContainer, { backgroundColor: colors.cardBackground }]}>
        <RecentTransactionItem 
          category="Food" 
          amount="-$25.99" 
          date="Today" 
          title="Groceries" 
          icon="shopping-basket"
          color="#FF8C00"
          isDarkMode={isDarkMode}
          colors={colors} 
        />
        <RecentTransactionItem 
          category="Transport" 
          amount="-$12.50" 
          date="Yesterday" 
          title="Uber ride" 
          icon="car"
          color="#4682B4" 
          isDarkMode={isDarkMode}
          colors={colors}
        />
        <RecentTransactionItem 
          category="Income" 
          amount="+$1,500.00" 
          date="Oct 22" 
          title="Salary" 
          icon="briefcase"
          color="#27AE60" 
          isDarkMode={isDarkMode}
          colors={colors}
        />
        
        <TouchableOpacity 
          style={styles.viewAllButton}
          onPress={() => router.push('/two')}
        >
          <Text style={styles.viewAllButtonText}>View All Transactions</Text>
          <FontAwesome name="angle-right" size={16} color={AppColors.primary} />
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

function RecentTransactionItem({ 
  category, 
  amount, 
  date, 
  title, 
  icon, 
  color,
  isDarkMode,
  colors 
}: { 
  category: string; 
  amount: string; 
  date: string; 
  title: string;
  icon: string;
  color: string;
  isDarkMode: boolean;
  colors: any;
}) {
  return (
    <View style={[styles.transactionItem, { backgroundColor: colors.cardBackground, borderBottomColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }]}>
      <View style={[styles.transactionLeft, { backgroundColor: colors.cardBackground }]}>
        <View style={[styles.transactionIcon, { backgroundColor: color }]}>
          <FontAwesome name={icon as any} size={16} color="white" />
        </View>
        <View style={[{ backgroundColor: 'transparent' }]}>
          <Text style={[styles.transactionTitle, { color: colors.text }]}>{title}</Text>
          <Text style={[styles.transactionCategory, { color: colors.subText }]}>{category}</Text>
        </View>
      </View>
      <View style={[{ backgroundColor: 'transparent' }]}>
        <Text style={[
          amount.includes('-') ? styles.amountNegative : styles.amountPositive,
          { backgroundColor: 'transparent' }
        ]}>
          {amount}
        </Text>
        <Text style={[styles.transactionDate, { color: colors.subText, backgroundColor: 'transparent' }]}>{date}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  welcomeContainer: {
    alignItems: 'center',
    backgroundColor: AppColors.secondary,
    paddingTop: 20,
    paddingBottom: 30,
    paddingHorizontal: 20,
    height: 220, // Fixed height to prevent layout shifts
  },
  welcomeContentContainer: {
    height: 150, // Fixed height container
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  welcomeContent: {
    alignItems: 'center',
    justifyContent: 'center',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  logo: {
    width: 60,
    height: 60,
    borderRadius: 10,
    marginBottom: 10,
  },
  profileImage: {
    width: 80, 
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: 'white',
    marginBottom: 10,
  },
  avatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: AppColors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  avatarText: {
    fontSize: 36,
    fontWeight: 'bold',
    color: 'white',
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  userEmail: {
    fontSize: 16,
    marginBottom: 10, // Added bottom margin for better spacing
  },
  summaryCard: {
    borderRadius: 12,
    marginHorizontal: 16,
    marginTop: -20,
    padding: 16,
    ...(Platform.OS === 'web'
      ? { 
          boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
        }
      : {
          elevation: 4,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
        }),
  },
  summaryCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  summaryDate: {
    fontSize: 14,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryDivider: {
    width: 1,
    marginHorizontal: 10,
  },
  summaryLabel: {
    fontSize: 14,
    marginBottom: 5,
  },
  summaryValuePositive: {
    fontSize: 18,
    color: AppColors.primary,
    fontWeight: '600',
  },
  summaryValueNegative: {
    fontSize: 18,
    color: AppColors.danger,
    fontWeight: '600',
  },
  balanceContainer: {
    borderTopWidth: 1,
    paddingTop: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  balanceLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  balanceValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: AppColors.primary,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginHorizontal: 16,
    marginTop: 30,
    marginBottom: 15,
  },
  featuresContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 8,
  },
  featureItem: {
    width: '50%',
    padding: 8,
  },
  featureIconContainer: {
    width: '100%',
    aspectRatio: 2,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  featureTitle: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  recentTransactionsContainer: {
    borderRadius: 12,
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 30,
    padding: 16,
  },
  transactionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    paddingVertical: 12,
  },
  transactionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  transactionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  transactionTitle: {
    fontSize: 15,
    fontWeight: '500',
  },
  transactionCategory: {
    fontSize: 13,
  },
  amountPositive: {
    fontSize: 15,
    fontWeight: '600',
    color: AppColors.primary,
    textAlign: 'right',
  },
  amountNegative: {
    fontSize: 15,
    fontWeight: '600',
    color: AppColors.danger,
    textAlign: 'right',
  },
  transactionDate: {
    fontSize: 12,
    textAlign: 'right',
  },
  viewAllButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
    paddingVertical: 8,
  },
  viewAllButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: AppColors.primary,
    marginRight: 5,
  },
});
