import { StyleSheet, TouchableOpacity, Image, ScrollView, Platform } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Href, useRouter } from 'expo-router';

import { Text, View } from '@/components/Themed';
import { AppColors } from './_layout';
import { useState, useEffect } from 'react';
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

export default function DashboardScreen() {
  const router = useRouter();
  const [userProfile, setUserProfile] = useState<{email: string} | null>(null);
  const [loading, setLoading] = useState(true);
  const { isDarkMode, colors } = useTheme();
  
  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        const response = await getUserProfile();
        setUserProfile(response.data);
      } catch (error) {
        console.log('Error fetching profile:', error);
        // For demo, set mock data
        setUserProfile({ email: 'user@example.com' });
      } finally {
        setLoading(false);
      }
    };
    
    fetchUserProfile();
  }, []);
  
  return (
    <ScrollView style={[styles.scrollView, { backgroundColor: colors.background }]}>
      <View style={[styles.welcomeContainer, { backgroundColor: AppColors.secondary }]}>
        <Image
          source={require('@/assets/images/icon.png')}
          style={styles.logo}
        />
        <Text style={[styles.welcomeText, { color: colors.buttonText }]}>
          Welcome to CaptainLedger
        </Text>
        <Text style={[styles.userEmail, { color: isDarkMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(255, 255, 255, 0.8)' }]}>
          {loading ? 'Loading...' : userProfile?.email || 'Guest User'}
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
    paddingTop: 60,
    paddingBottom: 30,
    paddingHorizontal: 20,
  },
  logo: {
    width: 60,
    height: 60,
    borderRadius: 10,
    marginBottom: 10,
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  userEmail: {
    fontSize: 16,
    marginTop: 5,
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
