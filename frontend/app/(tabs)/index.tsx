import { StyleSheet, TouchableOpacity, Image, ScrollView } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Href, useRouter } from 'expo-router';

import { Text, View } from '@/components/Themed';
import { AppColors } from './_layout';
import { useState, useEffect } from 'react';
import { getUserProfile } from '@/services/api';

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
    <ScrollView style={styles.scrollView}>
      <View style={styles.welcomeContainer}>
        <Image
          source={require('@/assets/images/icon.png')}
          style={styles.logo}
        />
        <Text style={styles.welcomeText}>
          Welcome to CaptainLedger
        </Text>
        <Text style={styles.userEmail}>
          {loading ? 'Loading...' : userProfile?.email || 'Guest User'}
        </Text>
      </View>
      
      <View style={styles.summaryCard}>
        <View style={styles.summaryCardHeader}>
          <Text style={styles.summaryTitle}>Monthly Overview</Text>
          <Text style={styles.summaryDate}>October 2023</Text>
        </View>
        
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Income</Text>
            <Text style={styles.summaryValuePositive}>$1,500.00</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Expenses</Text>
            <Text style={styles.summaryValueNegative}>$875.25</Text>
          </View>
        </View>
        
        <View style={styles.balanceContainer}>
          <Text style={styles.balanceLabel}>Balance</Text>
          <Text style={styles.balanceValue}>+$624.75</Text>
        </View>
      </View>
      
      <Text style={styles.sectionTitle}>Quick Actions</Text>
      
      <View style={styles.featuresContainer}>
        {FEATURE_ITEMS.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={styles.featureItem}
            onPress={() => router.push(item.route as Href)}
          >
            <View style={[styles.featureIconContainer, { backgroundColor: item.color }]}>
              <FontAwesome name={item.icon as any} size={24} color="white" />
            </View>
            <Text style={styles.featureTitle}>{item.title}</Text>
          </TouchableOpacity>
        ))}
      </View>
      
      <Text style={styles.sectionTitle}>Recent Transactions</Text>
      
      <View style={styles.recentTransactionsContainer}>
        <RecentTransactionItem 
          category="Food" 
          amount="-$25.99" 
          date="Today" 
          title="Groceries" 
          icon="shopping-basket"
          color="#FF8C00" 
        />
        <RecentTransactionItem 
          category="Transport" 
          amount="-$12.50" 
          date="Yesterday" 
          title="Uber ride" 
          icon="car"
          color="#4682B4" 
        />
        <RecentTransactionItem 
          category="Income" 
          amount="+$1,500.00" 
          date="Oct 22" 
          title="Salary" 
          icon="briefcase"
          color="#27AE60" 
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

function RecentTransactionItem({ category, amount, date, title, icon, color }: { 
  category: string; 
  amount: string; 
  date: string; 
  title: string;
  icon: string;
  color: string;
}) {
  return (
    <View style={styles.transactionItem}>
      <View style={styles.transactionLeft}>
        <View style={[styles.transactionIcon, { backgroundColor: color }]}>
          <FontAwesome name={icon as any} size={16} color="white" />
        </View>
        <View>
          <Text style={styles.transactionTitle}>{title}</Text>
          <Text style={styles.transactionCategory}>{category}</Text>
        </View>
      </View>
      <View>
        <Text style={amount.includes('-') ? styles.amountNegative : styles.amountPositive}>
          {amount}
        </Text>
        <Text style={styles.transactionDate}>{date}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
    backgroundColor: AppColors.background,
  },
  welcomeContainer: {
    alignItems: 'center',
    backgroundColor: AppColors.primary,
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
    color: AppColors.white,
  },
  userEmail: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 5,
  },
  summaryCard: {
    backgroundColor: AppColors.white,
    borderRadius: 12,
    marginHorizontal: 16,
    marginTop: -20,
    padding: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
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
    color: AppColors.secondary,
  },
  summaryDate: {
    fontSize: 14,
    color: AppColors.lightText,
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
    backgroundColor: 'rgba(0,0,0,0.1)',
    marginHorizontal: 10,
  },
  summaryLabel: {
    fontSize: 14,
    color: AppColors.lightText,
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
    borderTopColor: 'rgba(0,0,0,0.1)',
    paddingTop: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  balanceLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: AppColors.secondary,
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
    color: AppColors.secondary,
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
    color: AppColors.secondary,
  },
  recentTransactionsContainer: {
    backgroundColor: AppColors.white,
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
    borderBottomColor: 'rgba(0,0,0,0.05)',
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
    backgroundColor: AppColors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  transactionTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: AppColors.secondary,
  },
  transactionCategory: {
    fontSize: 13,
    color: AppColors.lightText,
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
    color: AppColors.lightText,
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
