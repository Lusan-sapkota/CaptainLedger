import { StyleSheet, TouchableOpacity, Image, ScrollView, Platform, View as RNView, Animated, LayoutAnimation, UIManager, RefreshControl } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Href, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLoans, getTransactions, createNotification, sendEmailNotification, getInvestments } from '@/services/api';
import { Text, View } from '@/components/Themed';
import { AppColors } from './_layout';
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { getUserProfile } from '@/services/api';
import { useTheme } from '@/components/ThemeProvider';
import { useFocusEffect } from '@react-navigation/native';
import { eventEmitter } from '@/utils/eventEmitter';
import SwipeableBudgetCard from '@/components/SwipeableBudgetCard';
import { useCurrency } from '@/components/CurrencyProvider';
import TransactionItem from '@/components/TransactionItem';

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

// Define the Transaction type based on your transaction object structure
type Transaction = {
  id?: string | number;
  amount: number;
  date: string;
  currency?: string;
  category?: string;
  note?: string;
  // Add other fields as needed
};

export default function DashboardScreen() {
  const router = useRouter();
  const [userProfile, setUserProfile] = useState<{email: string, displayName?: string, fullName?: string, profile_picture?: string} | null>(null);
  const [loading, setLoading] = useState(true);
  const { isDarkMode, colors } = useTheme();
  const { formatCurrency, convertCurrency, primaryCurrency, loading: currencyLoading } = useCurrency();
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
  
  // Calculate days remaining for loan deadlines
  const getDaysRemaining = (deadline: string): number => {
    const deadlineDate = new Date(deadline);
    const now = new Date();
    return Math.ceil((deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
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
  const [investments, setInvestments] = useState<any[]>([]);
  const [activeInvestments, setActiveInvestments] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [dailyBudget, setDailyBudget] = useState<number>(0);
  const [formattedDailyBudget, setFormattedDailyBudget] = useState<string>('');
  const [totalBalance, setTotalBalance] = useState<number>(0);
  const [monthlyStats, setMonthlyStats] = useState({
    income: 0,
    expenses: 0,
    balance: 0,
    assets: 0,
    liabilities: 0
  });

  // Formatted currency states
  const [formattedStats, setFormattedStats] = useState({
    income: '',
    expenses: '',
    balance: '',
    assets: '',
    liabilities: ''
  });

  // Track if currency system is ready
  const [currencyReady, setCurrencyReady] = useState(false);

  // Add this function to fetch real-time data
  const fetchDashboardData = useCallback(async (showLoading = false) => {
    try {
      if (showLoading) {
        setLoading(true);
      }
      
      // Fetch user profile first to resolve loading email issue
      await fetchUserProfile();
      
      // Fetch transactions with latest data
      const transactionResponse = await getTransactions();
      const allTransactions = transactionResponse?.data?.transactions || [];
      
      if (allTransactions.length > 0) {
        // Get most recent 5 transactions for display
        const recentTransactions = [...allTransactions]
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
          .slice(0, 5); // Show more recent transactions
        
        setTransactions(recentTransactions);
        
        // Calculate total balance
        const balance = allTransactions.reduce((sum: number, t: Transaction) => sum + t.amount, 0);
        setTotalBalance(balance);
      }
      
      // Fetch loans
      const loanResponse = await getLoans();
      const allLoans = loanResponse?.data?.loans || [];
      
      if (allLoans.length > 0) {
        setLoans(allLoans);
        
        // Filter active loans (not paid)
        const active = allLoans.filter(
          (loan: any) => loan.status === 'outstanding'
        );
        setActiveLoans(active);
        
        // Update balance to include loans
        updateTotalBalance(allTransactions, active);
      }

      // Fetch investments
      const investmentResponse = await getInvestments();
      const allInvestments = investmentResponse?.data?.investments || [];
      
      if (allInvestments.length > 0) {
        setInvestments(allInvestments);
        
        // Filter active investments
        const activeInvs = allInvestments.filter(
          (inv: any) => inv.status === 'active'
        );
        setActiveInvestments(activeInvs);
      }
      
      // Calculate monthly stats with all data
      await calculateMonthlyStats(allTransactions, allLoans, allInvestments);
      
      // Calculate daily budget
      await calculateDailyBudget(allTransactions, allLoans);
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

  // Also fetch data on component mount and user profile immediately
  useEffect(() => {
    const initializeData = async () => {
      await fetchUserProfile(); // Load user profile first to prevent "Loading..." email
      await fetchDashboardData(true);
    };
    initializeData();
  }, []);

  // Initialize currency formatting for zero values on mount
  useEffect(() => {
    const initializeCurrencyFormatting = async () => {
      // Wait for currency system to be ready
      if (currencyLoading) {
        console.log('Currency loading, waiting...');
        setCurrencyReady(false);
        return;
      }

      console.log('Initializing currency formatting...');
      
      try {
        const formattedZero = await formatCurrency(0);

        // Only update if we don't have real data yet
        setFormattedStats(prev => ({
          income: prev.income || formattedZero,
          expenses: prev.expenses || formattedZero,
          balance: prev.balance || formattedZero,
          assets: prev.assets || formattedZero,
          liabilities: prev.liabilities || formattedZero
        }));

        if (!formattedDailyBudget) {
          setFormattedDailyBudget(formattedZero);
        }
        
        setCurrencyReady(true);
      } catch (error) {
        console.error('Error initializing currency formatting:', error);
        // Use fallback values that match the primary currency
        const fallbackValue = '0.00';
        setFormattedStats(prev => ({
          income: prev.income || fallbackValue,
          expenses: prev.expenses || fallbackValue,
          balance: prev.balance || fallbackValue,
          assets: prev.assets || fallbackValue,
          liabilities: prev.liabilities || fallbackValue
        }));
        
        if (!formattedDailyBudget) {
          setFormattedDailyBudget(fallbackValue);
        }
        
        setCurrencyReady(true);
      }
    };

    initializeCurrencyFormatting();
  }, [formatCurrency, currencyLoading, primaryCurrency]);

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

  // Memoized currency formatting for monthly stats
  const formatMonthlyStats = useCallback(async (income: number, expenses: number, balance: number, assets: number, liabilities: number) => {
    try {
      const [formattedIncome, formattedExpenses, formattedBalance, formattedAssets, formattedLiabilities] = 
        await Promise.all([
          formatCurrency(income),
          formatCurrency(expenses),
          formatCurrency(balance),
          formatCurrency(assets),
          formatCurrency(liabilities)
        ]);

      setFormattedStats({
        income: formattedIncome,
        expenses: formattedExpenses,
        balance: formattedBalance,
        assets: formattedAssets,
        liabilities: formattedLiabilities
      });

      // Mark currency as ready after successful formatting
      setCurrencyReady(true);
    } catch (error) {
      console.error('Error formatting currencies:', error);
      // Set fallback formatted values to avoid showing "$" 
      setFormattedStats({
        income: income.toFixed(2),
        expenses: expenses.toFixed(2), 
        balance: balance.toFixed(2),
        assets: assets.toFixed(2),
        liabilities: liabilities.toFixed(2)
      });
      // Still mark as ready so UI doesn't show "..." indefinitely
      setCurrencyReady(true);
    }
  }, [formatCurrency]);

  // Calculate monthly statistics with currency conversion
  const calculateMonthlyStats = useCallback(async (transactions: any[], allLoans: any[] = [], allInvestments: any[] = []) => {
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    
    const monthTransactions = transactions.filter(t => {
      const date = new Date(t.date);
      return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
    });
    
    let income = 0;
    let expenses = 0;
    
    // Convert and sum transactions
    for (const t of monthTransactions) {
      try {
        const convertedAmount = t.currency ? 
          await convertCurrency(Math.abs(t.amount), t.currency) : 
          Math.abs(t.amount);
        
        if (t.amount > 0) {
          income += convertedAmount;
        } else {
          expenses += convertedAmount;
        }
      } catch (error) {
        console.error('Error converting transaction currency:', error);
        // Fallback to original amount
        if (t.amount > 0) {
          income += Math.abs(t.amount);
        } else {
          expenses += Math.abs(t.amount);
        }
      }
    }

    // Calculate Assets (given loans + active investments) with currency conversion
    let assets = 0;
    for (const loan of allLoans.filter(loan => loan.loan_type === 'given' && loan.status === 'outstanding')) {
      try {
        const convertedAmount = loan.currency ? 
          await convertCurrency(loan.amount, loan.currency) : 
          loan.amount;
        assets += convertedAmount;
      } catch (error) {
        console.error('Error converting loan currency:', error);
        assets += loan.amount;
      }
    }
    
    for (const inv of allInvestments.filter(inv => inv.status === 'active')) {
      try {
        const amount = inv.current_value || inv.initial_amount;
        const convertedAmount = inv.currency ? 
          await convertCurrency(amount, inv.currency) : 
          amount;
        assets += convertedAmount;
      } catch (error) {
        console.error('Error converting investment currency:', error);
        assets += (inv.current_value || inv.initial_amount);
      }
    }

    // Calculate Liabilities (taken loans + credit cards) with currency conversion
    let liabilities = 0;
    for (const loan of allLoans.filter(loan => loan.loan_type === 'taken' && loan.status === 'outstanding')) {
      try {
        const convertedAmount = loan.currency ? 
          await convertCurrency(loan.amount, loan.currency) : 
          loan.amount;
        liabilities += convertedAmount;
      } catch (error) {
        console.error('Error converting liability currency:', error);
        liabilities += loan.amount;
      }
    }
    
    const balance = income - expenses;
    
    // Update numeric stats
    setMonthlyStats({
      income,
      expenses,
      balance,
      assets,
      liabilities
    });

    // Use memoized formatting to avoid repeated calculations
    formatMonthlyStats(income, expenses, balance, assets, liabilities);
  }, [convertCurrency, formatMonthlyStats]);

  // Calculate daily budget with currency conversion
  const calculateDailyBudget = useCallback(async (transactions: any[], loans: any[]) => {
    try {
      // Get current month's income
      const currentMonth = new Date().getMonth();
      const currentYear = new Date().getFullYear();
      const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
      const today = new Date().getDate();
      const remainingDays = daysInMonth - today + 1; // Including today
      
      // Calculate monthly income with currency conversion
      let monthlyIncome = 0;
      for (const t of transactions.filter(t => {
        const date = new Date(t.date);
        return date.getMonth() === currentMonth && 
               date.getFullYear() === currentYear && 
               t.amount > 0;
      })) {
        try {
          const convertedAmount = t.currency ? 
            await convertCurrency(t.amount, t.currency) : 
            t.amount;
          monthlyIncome += convertedAmount;
        } catch (error) {
          console.error('Error converting income transaction currency:', error);
          monthlyIncome += t.amount;
        }
      }
      
      // Calculate monthly expenses with currency conversion
      let monthlyExpenses = 0;
      for (const t of transactions.filter(t => {
        const date = new Date(t.date);
        return date.getMonth() === currentMonth && 
               date.getFullYear() === currentYear && 
               t.amount < 0;
      })) {
        try {
          const convertedAmount = t.currency ? 
            await convertCurrency(Math.abs(t.amount), t.currency) : 
            Math.abs(t.amount);
          monthlyExpenses += convertedAmount;
        } catch (error) {
          console.error('Error converting expense transaction currency:', error);
          monthlyExpenses += Math.abs(t.amount);
        }
      }
      
      // Consider upcoming loan payments with currency conversion
      let upcomingLoanPayments = 0;
      for (const loan of loans.filter(loan => {
        const dueDate = new Date(loan.deadline);
        return dueDate.getMonth() === currentMonth && 
               dueDate.getFullYear() === currentYear &&
               loan.status === 'outstanding' &&
               loan.loan_type === 'taken';
      })) {
        try {
          const convertedAmount = loan.currency ? 
            await convertCurrency(loan.amount, loan.currency) : 
            loan.amount;
          upcomingLoanPayments += convertedAmount;
        } catch (error) {
          console.error('Error converting loan currency:', error);
          upcomingLoanPayments += loan.amount;
        }
      }
      
      // Calculate remaining budget
      const remainingBudget = monthlyIncome - monthlyExpenses - upcomingLoanPayments;
      
      // Daily budget is the remaining budget divided by remaining days
      const daily = remainingBudget > 0 ? remainingBudget / remainingDays : 0;
      setDailyBudget(daily);

      // Format the daily budget
      try {
        const formatted = await formatCurrency(daily);
        setFormattedDailyBudget(formatted);
      } catch (error) {
        console.error('Error formatting daily budget currency:', error);
        setFormattedDailyBudget(daily.toFixed(2));
      }
    } catch (error) {
      console.error('Error calculating daily budget:', error);
      setDailyBudget(0);
      try {
        const formattedZero = await formatCurrency(0);
        setFormattedDailyBudget(formattedZero);
      } catch (formatError) {
        setFormattedDailyBudget('0.00');
      }
    }
  }, [convertCurrency, formatCurrency]);

  // Update total balance including loans
  const updateTotalBalance = useCallback((transactions: any[], activeLoans: any[]) => {
    const transactionBalance = transactions.reduce((sum, t) => sum + t.amount, 0);
    
    // Calculate loan balance impact
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
  
  // Check for alerts and send notifications
  const checkForAlerts = useCallback(async () => {
    try {
      const alerts = [];
      
      // Check for upcoming loan payments
      for (const loan of activeLoans) {
        const daysRemaining = getDaysRemaining(loan.deadline);
        if (daysRemaining <= 3 && daysRemaining > 0) {
          alerts.push({
            title: 'Loan Payment Due Soon',
            message: `Your loan payment of ${loan.currency} ${loan.amount} is due in ${daysRemaining} days. Contact: ${loan.contact || 'N/A'}`
          });
        }
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
          type: 'warning' as 'warning'
        };
        
        await createNotification(notificationData);
        
        // REMOVED: Email notifications are now handled by the backend with rate limiting
      }
      
      // REMOVED: Weekly and monthly report logic - handled by backend scheduler only
      
    } catch (error) {
      console.error('Error checking for alerts:', error);
    }
  }, [activeLoans, monthlyStats, transactions, formattedStats, userProfile]);

  // Call this function after fetching data
  useEffect(() => {
    if (!loading) {
      checkForAlerts();
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

  // Add budget creation handler
  const handleCreateBudget = useCallback((period: 'daily' | 'weekly' | 'monthly' | 'yearly') => {
    router.push(`/budgets?period=${period}&create=true`);
  }, [router]);

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
            <Text style={styles.summaryValuePositive}>
              {currencyReady && formattedStats.income ? formattedStats.income : '...'}
            </Text>
          </View>
          <View style={[styles.summaryDivider, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }]} />
          <View style={[styles.summaryItem, { backgroundColor: colors.cardBackground }]}>
            <Text style={[styles.summaryLabel, { color: colors.subText }]}>Expenses</Text>
            <Text style={styles.summaryValueNegative}>
              {currencyReady && formattedStats.expenses ? formattedStats.expenses : '...'}
            </Text>
          </View>
        </View>

        {/* Assets and Liabilities Row */}
        <View style={[styles.summaryRow, { backgroundColor: colors.cardBackground, marginTop: 10 }]}>
          <View style={[styles.summaryItem, { backgroundColor: colors.cardBackground }]}>
            <Text style={[styles.summaryLabel, { color: colors.subText }]}>Assets</Text>
            <Text style={[styles.summaryValueAssets, { color: AppColors.info }]}>
              {currencyReady && formattedStats.assets ? formattedStats.assets : '...'}
            </Text>
          </View>
          <View style={[styles.summaryDivider, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }]} />
          <View style={[styles.summaryItem, { backgroundColor: colors.cardBackground }]}>
            <Text style={[styles.summaryLabel, { color: colors.subText }]}>Liabilities</Text>
            <Text style={[styles.summaryValueLiabilities, { color: AppColors.warning }]}>
              {currencyReady && formattedStats.liabilities ? formattedStats.liabilities : '...'}
            </Text>
          </View>
        </View>
        
        <View style={[styles.balanceContainer, { 
          backgroundColor: colors.cardBackground, 
          borderTopColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' 
        }]}>
          <Text style={[styles.balanceLabel, { color: colors.text }]}>Net Balance</Text>
          <Text style={[styles.balanceValue, { 
            color: monthlyStats.balance >= 0 ? AppColors.primary : AppColors.danger 
          }]}>
            {currencyReady && formattedStats.balance ? 
              `${monthlyStats.balance >= 0 ? '+' : ''}${formattedStats.balance}` : 
              '...'
            }
          </Text>
        </View>
      </View>
      
      {/* Swipeable Budget Card */}
      <SwipeableBudgetCard 
        colors={colors}
        isDarkMode={isDarkMode}
        onCreateBudget={handleCreateBudget}
        currencyReady={currencyReady}
      />
      
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
      
      {/* Active Investments Section */}
      {activeInvestments.length > 0 ? (
        <>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Active Investments</Text>
          <View style={[styles.loansContainer, { backgroundColor: colors.background }]}>
            {activeInvestments.map((investment, index) => (
              <InvestmentCard 
                key={investment.id || index} 
                investment={investment} 
                colors={colors} 
                isDarkMode={isDarkMode} 
              />
            ))}
          </View>
        </>
      ) : (
        // If there are no active investments, don't show this section
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
            <TransactionItem 
              key={transaction.id || index}
              item={transaction}
              onPress={() => {}} // Dashboard transactions are read-only
              compact={true}
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

function InvestmentCard({ investment, colors, isDarkMode }: { 
  investment: any, 
  colors: any, 
  isDarkMode: boolean 
}) {
  const { formatCurrency, convertCurrency } = useCurrency();
  const [formattedValues, setFormattedValues] = useState({
    currentValue: '',
    profitLoss: ''
  });

  useEffect(() => {
    const formatInvestmentValues = async () => {
      try {
        const currentValue = investment.current_value || investment.initial_amount;
        const profitLoss = currentValue - investment.initial_amount;
        
        // Convert to primary currency if needed
        const convertedCurrent = investment.currency ? 
          await convertCurrency(currentValue, investment.currency) : 
          currentValue;
        const convertedProfitLoss = investment.currency ? 
          await convertCurrency(profitLoss, investment.currency) : 
          profitLoss;

        const [formattedCurrent, formattedPL] = await Promise.all([
          formatCurrency(convertedCurrent),
          formatCurrency(convertedProfitLoss)
        ]);

        setFormattedValues({
          currentValue: formattedCurrent,
          profitLoss: formattedPL
        });
      } catch (error) {
        console.error('Error formatting investment currency:', error);
        const currentValue = investment.current_value || investment.initial_amount;
        const profitLoss = currentValue - investment.initial_amount;
        setFormattedValues({
          currentValue: `$${currentValue.toFixed(2)}`,
          profitLoss: `${profitLoss >= 0 ? '+' : ''}$${profitLoss.toFixed(2)}`
        });
      }
    };

    formatInvestmentValues();
  }, [investment, formatCurrency, convertCurrency]);

  const currentValue = investment.current_value || investment.initial_amount;
  const profitLoss = currentValue - investment.initial_amount;
  const profitLossPercentage = ((profitLoss / investment.initial_amount) * 100).toFixed(2);
  
  const getPerformanceColor = () => {
    if (profitLoss > 0) return AppColors.primary; // Green for profit
    if (profitLoss < 0) return AppColors.danger; // Red for loss
    return colors.subText; // Neutral for no change
  };
  
  return (
    <View style={[styles.loanCard, { backgroundColor: colors.cardBackground }]}>
      <View style={[styles.loanHeader, { backgroundColor: 'transparent' }]}>
        <View style={[styles.loanIconContainer, { backgroundColor: AppColors.secondary }]}>
          <FontAwesome name="line-chart" size={20} color="white" />
        </View>
        <View style={[styles.loanDetails, { backgroundColor: 'transparent' }]}>
          <Text style={[styles.loanTitle, { color: colors.text }]}>
            {investment.type || 'Investment'}
          </Text>
          <Text style={[styles.loanContact, { color: colors.subText }]}>
            {investment.description || 'Investment Portfolio'}
          </Text>
        </View>
        <View style={{ backgroundColor: 'transparent' }}>
          <Text style={[styles.loanAmount, { color: AppColors.secondary }]}>
            {formattedValues.currentValue}
          </Text>
        </View>
      </View>
      
      <View style={[styles.loanTimerContainer, { backgroundColor: 'transparent' }]}>
        <View style={[styles.loanStatusContainer, { backgroundColor: 'transparent' }]}>
          <Text style={[styles.loanStatusLabel, { color: colors.subText }]}>Performance:</Text>
          <Text style={[styles.loanTimer, { 
            color: getPerformanceColor(),
            fontWeight: 'bold'
          }]}>
            {formattedValues.profitLoss} ({profitLossPercentage}%)
          </Text>
        </View>
        <View style={[styles.loanProgressBar, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}>
          <View style={[styles.loanProgressFill, { 
            width: `${Math.min(100, Math.max(0, Math.abs(parseFloat(profitLossPercentage))))}%`,
            backgroundColor: getPerformanceColor()
          }]} />
        </View>
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
  const { formatCurrency, convertCurrency } = useCurrency();
  const [timeRemaining, setTimeRemaining] = useState<string>('');
  const [progressWidth, setProgressWidth] = useState<`${number}%`>('0%');
  const [formattedAmount, setFormattedAmount] = useState('');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const formatLoanAmount = async () => {
      try {
        const convertedAmount = loan.currency ? 
          await convertCurrency(Math.abs(loan.amount), loan.currency) : 
          Math.abs(loan.amount);
        
        const formatted = await formatCurrency(convertedAmount);
        setFormattedAmount(formatted);
      } catch (error) {
        console.error('Error formatting loan currency:', error);
        setFormattedAmount(`$${Math.abs(loan.amount).toFixed(2)}`);
      }
    };

    formatLoanAmount();
  }, [loan, formatCurrency, convertCurrency]);
  
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
            {loan.loan_type === 'given' ? '+' : '-'}{formattedAmount}
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
  summaryValueAssets: {
    fontSize: 18,
    fontWeight: '600',
  },
  summaryValueLiabilities: {
    fontSize: 18,
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


