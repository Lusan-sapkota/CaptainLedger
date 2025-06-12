import { StyleSheet, TouchableOpacity, Image, ScrollView, Platform, View as RNView, Animated, LayoutAnimation, UIManager, RefreshControl } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Href, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLoans, getTransactions, createNotification, sendEmailNotification } from '@/services/api';
import { Text, View } from '@/components/Themed';
import { AppColors } from './_layout';
import { useState, useEffect, useCallback, useRef } from 'react';
import { getUserProfile } from '@/services/api';
import { useTheme } from '@/components/ThemeProvider';
import { useFocusEffect } from '@react-navigation/native'; // Add this import
import { eventEmitter } from '@/utils/eventEmitter';

const FEATURE_ITEMS = [
  { 
    id: '1', 
    title: 'Add Transaction', 
    icon: 'plus-circle', 
    route: '/transactions',
    color: AppColors.primary
  },
  { 
    id: '2', 
    title: 'Analytics', 
    icon: 'bar-chart', 
    route: '/analytics',
    color: AppColors.secondary
  },
  { 
    id: '3', 
    title: 'Budgets', 
    icon: 'pie-chart', 
    route: '/budgets',
    color: '#9B59B6'
  },
  { 
    id: '4', 
    title: 'Accounts', 
    icon: 'bank', 
    route: '/accounts',
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
  
  // Add these states in DashboardScreen
  const [loans, setLoans] = useState<any[]>([]);
  const [activeLoans, setActiveLoans] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [dailyBudget, setDailyBudget] = useState<number>(0);
  const [totalBalance, setTotalBalance] = useState<number>(0);
  const [monthlyStats, setMonthlyStats] = useState({
    income: 0,
    expenses: 0,
    balance: 0
  });

  // Add this function to fetch real-time data
  const fetchDashboardData = useCallback(async (showLoading = false) => {
    try {
      if (showLoading) {
        setLoading(true);
      }
      
      // Fetch user profile
      await fetchUserProfile();
      
      // Fetch transactions with latest data
      const transactionResponse = await getTransactions();
      if (transactionResponse?.data?.transactions) {
        const allTransactions = transactionResponse.data.transactions;
        
        // Get most recent 5 transactions for display
        const recentTransactions = [...allTransactions]
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
          .slice(0, 5); // Show more recent transactions
        
        setTransactions(recentTransactions);
        
        // Calculate monthly stats with all transactions
        calculateMonthlyStats(allTransactions);
        
        // Calculate total balance
        const balance = allTransactions.reduce((sum, t) => sum + t.amount, 0);
        setTotalBalance(balance);
      }
      
      // Fetch loans
      const loanResponse = await getLoans();
      if (loanResponse?.data?.loans) {
        setLoans(loanResponse.data.loans);
        
        // Filter active loans (not paid)
        const active = loanResponse.data.loans.filter(
          (loan: any) => loan.status === 'outstanding'
        );
        setActiveLoans(active);
        
        // Update balance to include loans
        updateTotalBalance(transactionResponse?.data?.transactions || [], active);
      }
      
      // Calculate daily budget
      calculateDailyBudget(
        transactionResponse?.data?.transactions || [], 
        loanResponse?.data?.loans || []
      );
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  }, []);

  // Use useFocusEffect to refresh data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      fetchDashboardData(true);
    }, [fetchDashboardData])
  );

  // Also fetch data on component mount
  useEffect(() => {
    fetchDashboardData(true);
  }, []);

  // Set up periodic refresh every 30 seconds when screen is focused
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  
  useFocusEffect(
    useCallback(() => {
      // Start periodic refresh when screen is focused
      intervalRef.current = setInterval(() => {
        fetchDashboardData(false); // Don't show loading for background refreshes
      }, 30000); // Refresh every 30 seconds
      
      return () => {
        // Clear interval when screen loses focus
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      };
    }, [fetchDashboardData])
  );

  // Calculate monthly statistics
  const calculateMonthlyStats = useCallback((transactions: any[]) => {
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    
    const monthTransactions = transactions.filter(t => {
      const date = new Date(t.date);
      return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
    });
    
    let income = 0;
    let expenses = 0;
    
    monthTransactions.forEach(t => {
      if (t.amount > 0) {
        income += t.amount;
      } else {
        expenses += Math.abs(t.amount);
      }
    });
    
    setMonthlyStats({
      income,
      expenses,
      balance: income - expenses
    });
  }, []);

  // Calculate daily budget
  const calculateDailyBudget = useCallback((transactions: any[], loans: any[]) => {
    try {
      // Get current month's income
      const currentMonth = new Date().getMonth();
      const currentYear = new Date().getFullYear();
      const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
      const today = new Date().getDate();
      const remainingDays = daysInMonth - today + 1; // Including today
      
      // Calculate monthly income
      const monthlyIncome = transactions
        .filter(t => {
          const date = new Date(t.date);
          return date.getMonth() === currentMonth && 
                 date.getFullYear() === currentYear && 
                 t.amount > 0;
        })
        .reduce((sum, t) => sum + t.amount, 0);
      
      // Calculate monthly expenses
      const monthlyExpenses = transactions
        .filter(t => {
          const date = new Date(t.date);
          return date.getMonth() === currentMonth && 
                 date.getFullYear() === currentYear && 
                 t.amount < 0;
        })
        .reduce((sum, t) => sum + Math.abs(t.amount), 0);
      
      // Consider upcoming loan payments
      const upcomingLoanPayments = loans
        .filter(loan => {
          const dueDate = new Date(loan.deadline);
          return dueDate.getMonth() === currentMonth && 
                 dueDate.getFullYear() === currentYear &&
                 loan.status === 'outstanding' &&
                 loan.loan_type === 'taken';
        })
        .reduce((sum, loan) => sum + loan.amount, 0);
      
      // Calculate remaining budget
      const remainingBudget = monthlyIncome - monthlyExpenses - upcomingLoanPayments;
      
      // Daily budget is the remaining budget divided by remaining days
      const daily = remainingBudget > 0 ? remainingBudget / remainingDays : 0;
      setDailyBudget(daily);
    } catch (error) {
      console.error('Error calculating daily budget:', error);
      setDailyBudget(0);
    }
  }, []);

  // Update total balance including loans
  const updateTotalBalance = useCallback((transactions: any[], activeLoans: any[]) => {
    const transactionBalance = transactions.reduce((sum, t) => sum + t.amount, 0);
    
    // Calculate loan impact on balance
    const loanBalance = activeLoans.reduce((sum, loan) => {
      // If the loan is given, add to balance as an asset
      // If the loan is taken, subtract from balance as a liability
      return sum + (loan.loan_type === 'given' ? loan.amount : -loan.amount);
    }, 0);
    
    setTotalBalance(transactionBalance + loanBalance);
  }, []);

  // Extract fetchUserProfile to a named function so we can reuse it
  const fetchUserProfile = useCallback(async () => {
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
    }
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
  
  const triggerNotifications = async () => {
    try {
      // Check for loan deadlines approaching
      const loansApproaching = activeLoans.filter(loan => {
        const deadline = new Date(loan.deadline);
        const now = new Date();
        const diffDays = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        return diffDays <= 3 && diffDays >= 0; // Loans due in 3 days or less
      });
      
      // Create in-app notifications for approaching loans
      for (const loan of loansApproaching) {
        const notificationData = {
          title: 'Loan Payment Reminder',
          message: `Your loan payment of ${loan.currency} ${loan.amount} is due in ${getDaysRemaining(loan.deadline)} days`,
          type: 'reminder'
        };
        
        // Send to notifications API
        await createNotification(notificationData);
        
        // Send email notification
        await sendEmailNotification({
          type: 'loan_reminder',
          data: {
            amount: loan.amount,
            currency: loan.currency,
            deadline: loan.deadline,
            contact: loan.contact
          }
        });
      }
      
      // Check for budget alerts
      const today = new Date();
      const dayOfMonth = today.getDate();
      const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
      
      // If we're halfway through the month but spent more than 70% of budget
      if (dayOfMonth <= daysInMonth / 2 && monthlyStats.expenses > monthlyStats.income * 0.7) {
        const notificationData = {
          title: 'Budget Alert',
          message: `You've already spent ${Math.round((monthlyStats.expenses / monthlyStats.income) * 100)}% of your monthly income and we're only halfway through the month!`,
          type: 'alert'
        };
        
        // Send to notifications API
        await createNotification(notificationData);
        
        // Send email notification
        await sendEmailNotification({
          type: 'budget_alert',
          data: {
            spentPercentage: Math.round((monthlyStats.expenses / monthlyStats.income) * 100),
            monthProgress: Math.round((dayOfMonth / daysInMonth) * 100),
            income: monthlyStats.income,
            expenses: monthlyStats.expenses
          }
        });
      }
      
      // Weekly reports on Sunday
      if (today.getDay() === 0) { // Sunday
        await sendEmailNotification({
          type: 'weekly_report',
          data: {
            transactions: transactions.filter(t => {
              const txDate = new Date(t.date);
              const weekAgo = new Date();
              weekAgo.setDate(weekAgo.getDate() - 7);
              return txDate >= weekAgo;
            }),
            stats: {
              income: monthlyStats.income,
              expenses: monthlyStats.expenses
            }
          }
        });
      }
      
      // Monthly report on last day of month
      if (dayOfMonth === daysInMonth) {
        await sendEmailNotification({
          type: 'monthly_report',
          data: {
            month: today.toLocaleString('default', { month: 'long' }),
            year: today.getFullYear(),
            transactions: transactions.filter(t => {
              const txDate = new Date(t.date);
              return txDate.getMonth() === today.getMonth() && 
                     txDate.getFullYear() === today.getFullYear();
            }),
            stats: {
              income: monthlyStats.income,
              expenses: monthlyStats.expenses,
              balance: monthlyStats.balance
            }
          }
        });
      }
    } catch (error) {
      console.error('Error triggering notifications:', error);
    }
  };

  // Helper function to get days remaining
  const getDaysRemaining = (dateString: string): number => {
    const deadline = new Date(dateString);
    const now = new Date();
    return Math.max(0, Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
  };

  // Call this function after fetching data
  useEffect(() => {
    if (!loading) {
      triggerNotifications();
    }
  }, [loading, transactions, activeLoans, monthlyStats]);
  
  // Add this function for pull-to-refresh
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchDashboardData(false);
      // Optionally, trigger notifications again after refresh
      // await triggerNotifications(); 
    } catch (error) {
      console.error('Error during refresh:', error);
      // Handle error (e.g., show a toast message)
    } finally {
      setRefreshing(false);
    }
  }, [fetchDashboardData]);

  // Listen for transaction updates
  useEffect(() => {
    const handleTransactionUpdate = () => {
      fetchDashboardData(false); // Refresh without showing loading
    };

    eventEmitter.on('transactionAdded', handleTransactionUpdate);
    eventEmitter.on('transactionUpdated', handleTransactionUpdate);
    eventEmitter.on('transactionDeleted', handleTransactionUpdate);

    return () => {
      eventEmitter.off('transactionAdded', handleTransactionUpdate);
      eventEmitter.off('transactionUpdated', handleTransactionUpdate);
      eventEmitter.off('transactionDeleted', handleTransactionUpdate);
    };
  }, [fetchDashboardData]);

  return (
    <ScrollView 
      style={[styles.scrollView, { backgroundColor: colors.background }]}
      refreshControl={
        <RefreshControl 
          refreshing={refreshing} 
          onRefresh={onRefresh}
          colors={[AppColors.primary]}
          tintColor={isDarkMode ? AppColors.primary : AppColors.secondary}
          title="Pull to refresh"
          titleColor={isDarkMode ? AppColors.primary : AppColors.secondary}
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
          <Text style={[styles.summaryDate, { color: colors.subText }]}>
            {new Date().toLocaleDateString('default', { month: 'long', year: 'numeric' })}
          </Text>
        </View>
        
        <View style={[styles.summaryRow, { backgroundColor: colors.cardBackground }]}>
          <View style={[styles.summaryItem, { backgroundColor: colors.cardBackground }]}>
            <Text style={[styles.summaryLabel, { color: colors.subText }]}>Income</Text>
            <Text style={styles.summaryValuePositive}>${monthlyStats.income.toFixed(2)}</Text>
          </View>
          <View style={[styles.summaryDivider, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }]} />
          <View style={[styles.summaryItem, { backgroundColor: colors.cardBackground }]}>
            <Text style={[styles.summaryLabel, { color: colors.subText }]}>Expenses</Text>
            <Text style={styles.summaryValueNegative}>${monthlyStats.expenses.toFixed(2)}</Text>
          </View>
        </View>
        
        <View style={[styles.balanceContainer, { 
          backgroundColor: colors.cardBackground, 
          borderTopColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' 
        }]}>
          <Text style={[styles.balanceLabel, { color: colors.text }]}>Balance</Text>
          <Text style={[styles.balanceValue, { 
            color: monthlyStats.balance >= 0 ? AppColors.primary : AppColors.danger 
          }]}>
            {monthlyStats.balance >= 0 ? '+' : '-'}${Math.abs(monthlyStats.balance).toFixed(2)}
          </Text>
        </View>
      </View>
      
      {/* Daily Budget Card - Updated with proper background colors and red for low budget */}
      <View style={[styles.budgetCard, { backgroundColor: colors.cardBackground }]}>
        <View style={[styles.budgetHeader, { backgroundColor: 'transparent' }]}>
          <Text style={[styles.budgetTitle, { color: colors.text }]}>Daily Budget</Text>
          <FontAwesome name="calendar-check-o" size={18} color={AppColors.primary} />
        </View>
        
        <View style={[styles.budgetAmountContainer, { backgroundColor: 'transparent' }]}>
          <Text style={[
            styles.budgetAmount, 
            { color: dailyBudget <= 5 ? AppColors.danger : AppColors.primary }
          ]}>
            ${dailyBudget.toFixed(2)}
          </Text>
          <Text style={[styles.budgetLabel, { color: colors.subText, backgroundColor: 'transparent' }]}>
            available to spend today
          </Text>
        </View>
        
        <View style={[styles.budgetProgressBar, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}>
          <View style={[
            styles.budgetProgressFill, 
            { 
              width: `${Math.min(100, Math.max(3, (dailyBudget / 100) * 100))}%`,
              backgroundColor: dailyBudget <= 5 ? AppColors.danger : 
                              dailyBudget <= 20 ? '#FF9800' : 
                              AppColors.primary 
            }
          ]} />
        </View>
      </View>
      
      {/* Active Loans / Loan Timer Section - MOVED UP */}
      {activeLoans.length > 0 ? (
        <>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Active Loans</Text>
          <View style={[styles.loansContainer, { backgroundColor: colors.background }]}>
            {activeLoans.map((loan, index) => (
              <LoanTimerCard 
                key={loan.id || index} 
                loan={loan} 
                colors={colors} 
                isDarkMode={isDarkMode} 
              />
            ))}
          </View>
        </>
      ) : (
        // If there are no active loans, don't show this section
        null
      )}
      
      {/* Recent Transactions - MOVED UP */}
      <Text style={[styles.sectionTitle, { color: colors.text }]}>Recent Transactions</Text>
      
      <View style={[styles.recentTransactionsContainer, { backgroundColor: colors.cardBackground }]}>
        {transactions.length === 0 ? (
          <Text style={[styles.emptyText, { color: colors.subText, textAlign: 'center', padding: 20 }]}>
            No recent transactions
          </Text>
        ) : (
          transactions.map((transaction, index) => (
            <RecentTransactionItem 
              key={transaction.id || index}
              category={transaction.category}
              amount={`${transaction.amount < 0 ? '-' : '+'}${transaction.currency} ${Math.abs(transaction.amount).toFixed(2)}`}
              date={formatTransactionDate(transaction.date)}
              title={transaction.note || transaction.category}
              icon={getCategoryIcon(transaction.category)}
              color={getCategoryColor(transaction.category)}
              isDarkMode={isDarkMode}
              colors={colors}
            />
          ))
        )}
        
        <TouchableOpacity 
          style={styles.viewAllButton}
          onPress={() => router.push('/transactions')}
        >
          <Text style={styles.viewAllButtonText}>View All Transactions</Text>
          <FontAwesome name="angle-right" size={16} color={AppColors.primary} />
        </TouchableOpacity>
      </View>
      
      {/* Quick Actions - COMPLETELY REDESIGNED */}
      <Text style={[styles.sectionTitle, { color: colors.text }]}>Quick Actions</Text>
      <View style={[styles.featuresContainerModern, { backgroundColor: colors.background }]}>
        {FEATURE_ITEMS.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={styles.featureItemModern}
            onPress={() => router.push(item.route as Href)}
          >
            <View style={[styles.featureIconContainerModern, { backgroundColor: item.color }]}>
              <FontAwesome name={item.icon as any} size={18} color="white" />
            </View>
            <Text style={[styles.featureTitleModern, { color: colors.text }]}>{item.title}</Text>
          </TouchableOpacity>
        ))}
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

// Updated LoanTimerCard component to ensure proper real-time functioning

function LoanTimerCard({ loan, colors, isDarkMode }: { 
  loan: any, 
  colors: any, 
  isDarkMode: boolean 
}) {
  const [timeRemaining, setTimeRemaining] = useState<string>('');
  const [progressWidth, setProgressWidth] = useState<`${number}%`>('0%');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  
  useEffect(() => {
    // Calculate and update remaining time
    const updateTimer = () => {
      const now = new Date();
      const deadline = new Date(loan.deadline);
      const diffTime = Math.max(0, deadline.getTime() - now.getTime());
      
      const days = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diffTime % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diffTime % (1000 * 60 * 60)) / (1000 * 60));
      
      setTimeRemaining(`${days}d ${hours}h ${minutes}m`);
      
      // Calculate progress percentage in real-time
      const created = new Date(deadline);
      created.setMonth(created.getMonth() - 1); // Assuming loans are typically due in a month
      
      const totalDuration = deadline.getTime() - created.getTime();
      const elapsed = now.getTime() - created.getTime();
      
      const percentage = Math.min(100, Math.max(0, (elapsed / totalDuration) * 100));
      setProgressWidth(`${percentage}%`);
    };
    
    // Initial update
    updateTimer();
    
    // Set timer to update every minute
    timerRef.current = setInterval(updateTimer, 60000);
    
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [loan.deadline]);
  
  const isPastDue = new Date(loan.deadline) < new Date();
  
  return (
    <View style={[styles.loanCard, { backgroundColor: colors.cardBackground }]}>
      <View style={[styles.loanHeader, { backgroundColor: 'transparent' }]}>
        <View style={[styles.loanIconContainer, { backgroundColor: '#FF9800' }]}>
          <FontAwesome name="money" size={20} color="white" />
        </View>
        <View style={[styles.loanDetails, { backgroundColor: 'transparent' }]}>
          <Text style={[styles.loanTitle, { color: colors.text }]}>
            {loan.loan_type === 'given' ? 'Loan Given' : 'Loan Taken'} 
          </Text>
          <Text style={[styles.loanContact, { color: colors.subText }]}>
            {loan.contact || 'No contact'}
          </Text>
        </View>
        <View style={{ backgroundColor: 'transparent' }}>
          <Text style={[styles.loanAmount, { 
            color: loan.loan_type === 'given' ? AppColors.primary : AppColors.danger 
          }]}>
            {loan.loan_type === 'given' ? '+' : '-'}{loan.currency} {Math.abs(loan.amount).toFixed(2)}
          </Text>
        </View>
      </View>
      
      <View style={[styles.loanTimerContainer, { backgroundColor: 'transparent' }]}>
        <View style={[styles.loanStatusContainer, { backgroundColor: 'transparent' }]}>
          <Text style={[styles.loanStatusLabel, { color: colors.subText }]}>Due in:</Text>
          <Text style={[styles.loanTimer, { 
            color: isPastDue ? AppColors.danger : '#FF9800',
            fontWeight: isPastDue ? 'bold' : 'normal'
          }]}>
            {isPastDue ? 'OVERDUE' : timeRemaining}
          </Text>
        </View>
        <View style={[styles.loanProgressBar, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}>
          <View style={[styles.loanProgressFill, { 
            width: isPastDue ? '100%' : progressWidth,
            backgroundColor: isPastDue ? AppColors.danger : '#FF9800'
          }]} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  recentTransactionsContainer: {
    borderRadius: 12,
    marginHorizontal: 16,
    marginTop: 10,
    padding: 0,
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
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    marginTop: 10,
    borderRadius: 8,
    backgroundColor: 'transparent',
  },
  viewAllButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: AppColors.primary,
    marginRight: 6,
  },
  emptyText: {
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
    padding: 20,
  },
  amountNegative: {
    fontSize: 16,
    color: AppColors.danger,
    fontWeight: 'bold',
  },
  amountPositive: {
    fontSize: 16,
    color: AppColors.primary,
    fontWeight: 'bold',
  },
  loanCard: {
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 16,
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
  featuresContainerModern: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 8,
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginBottom: 30,
  },
  featureItemModern: {
    width: '23%', // Four items per row
    marginBottom: 16,
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  featureIconContainerModern: {
    width: 42, 
    height: 42, 
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
    ...(Platform.OS === 'web'
      ? { 
          boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
        }
      : {
          elevation: 3,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 3,
        }),
  },
  featureTitleModern: {
    fontSize: 11,
    fontWeight: '500',
    textAlign: 'center',
  },
  
  // Update existing styles for budget card
  budgetCard: {
    borderRadius: 12,
    marginHorizontal: 16,
    marginTop: 10,
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
  budgetTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  budgetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    backgroundColor: 'transparent',
  },
  budgetAmountContainer: {
    marginBottom: 12,
    backgroundColor: 'transparent',
    alignItems: 'center',
  },

  budgetAmount: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  budgetLabel: {
    fontSize: 14,
    fontWeight: '400',
    marginTop: 2,
    backgroundColor: 'transparent',
  },

  budgetProgressBar: {
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
    marginTop: 4,
    marginBottom: 4,
  },

  budgetProgressFill: {
    height: 10,
    borderRadius: 5,
  },
  
  // Update loan card styles to have transparent backgrounds
  loanHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
    backgroundColor: 'transparent',
  },
  loanDetails: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  loanTimerContainer: {
    marginTop: 12,
    backgroundColor: 'transparent',
  },
  loanStatusContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    backgroundColor: 'transparent',
  },
  loanProgressFill: {
    height: 8,
    borderRadius: 4,
  },
  loanProgressBar: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    marginTop: 4,
    marginBottom: 4,
  },
  loanStatusLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginRight: 6,
  },
  loanAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  loanTimer: {
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  loanContact: {
    fontSize: 14,
    color: '#888',
    marginTop: 2,
  },
  loanTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  loanIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    backgroundColor: '#FF9800',
  },
  transactionDate: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  transactionTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 1,
  },
  transactionCategory: {
    fontSize: 13,
    color: '#888',
    marginTop: 1,
  },
  transactionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  transactionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  transactionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  loansContainer: {
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 10,
    borderRadius: 12,
    // Optional: add shadow for web and elevation for native
    ...(Platform.OS === 'web'
      ? { boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.08)' }
      : {
          elevation: 2,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.08,
          shadowRadius: 2,
        }),
    padding: 0,
  },
});

// Add these helper functions for getting category icons and colors
function getCategoryIcon(category: string): string {
  const iconMap: Record<string, string> = {
    'Food': 'cutlery',
    'Transport': 'car',
    'Housing': 'home',
    'Entertainment': 'film',
    'Shopping': 'shopping-cart',
    'Utilities': 'bolt',
    'Healthcare': 'medkit',
    'Income': 'briefcase',
    'Salary': 'money',
    'Investment': 'line-chart',
    'Loan': 'money',
    'Other': 'question-circle',
    // Add more mappings as needed
  };
  
  return iconMap[category] || 'circle';
}

function getCategoryColor(category: string): string {
  const colorMap: Record<string, string> = {
    'Food': '#FF8C00',
    'Transport': '#4682B4',
    'Housing': '#9370DB',
    'Entertainment': '#FF6347',
    'Shopping': '#20B2AA',
    'Utilities': '#DC143C',
    'Healthcare': '#6495ED',
    'Income': '#27AE60',
    'Salary': '#2E8B57',
    'Investment': '#3CB371',
    'Loan': '#FF9800',
    'Other': '#607D8B',
    // Add more mappings as needed
  };
  
  return colorMap[category] || '#607D8B';
}

function formatTransactionDate(dateString: string): string {
  const date = new Date(dateString);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  
  if (date.toDateString() === today.toDateString()) {
    return 'Today';
  } else if (date.toDateString() === yesterday.toDateString()) {
    return 'Yesterday';
  } else {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
}


