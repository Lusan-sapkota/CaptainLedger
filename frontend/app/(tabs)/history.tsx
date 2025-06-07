import { StyleSheet, FlatList, TouchableOpacity, View as RNView, Dimensions, ActivityIndicator, Platform } from 'react-native';
import { useState, useEffect, useMemo } from 'react';
import { Text, View } from '@/components/Themed';
import { getTransactions, Transaction } from '@/services/api';
import { AppColors } from './_layout';
import { useTheme } from '@/components/ThemeProvider';
import FontAwesome from '@expo/vector-icons/FontAwesome';

const { width } = Dimensions.get('window');

export default function HistoryScreen() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { isDarkMode, colors } = useTheme();
  
  useEffect(() => {
    loadTransactions();
  }, []);

  const loadTransactions = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await getTransactions();
      setTransactions(response.data.transactions);
    } catch (err) {
      console.error('Error loading transactions:', err);
      setError('Failed to load transactions. Please try again later.');
      
      // For demo purposes, fallback to mock data
      setTransactions([
        { id: '1', amount: -25.99, currency: 'USD', date: '2023-10-25', category: 'Food', note: 'Groceries' },
        { id: '2', amount: -12.50, currency: 'USD', date: '2023-10-24', category: 'Transport', note: 'Uber ride' },
        { id: '3', amount: 1500, currency: 'USD', date: '2023-10-22', category: 'Income', note: 'Salary' },
        { id: '4', amount: -35.00, currency: 'USD', date: '2023-10-21', category: 'Entertainment', note: 'Movie tickets' },
        { id: '5', amount: -65.75, currency: 'USD', date: '2023-10-20', category: 'Bills', note: 'Electricity bill' },
        { id: '6', amount: -20.30, currency: 'USD', date: '2023-10-18', category: 'Food', note: 'Lunch' },
        { id: '7', amount: -42.99, currency: 'USD', date: '2023-10-15', category: 'Shopping', note: 'T-shirt' },
        { id: '8', amount: -15.00, currency: 'USD', date: '2023-10-10', category: 'Transport', note: 'Bus fare' },
        { id: '9', amount: -120.50, currency: 'USD', date: '2023-10-05', category: 'Shopping', note: 'Shoes' },
        { id: '10', amount: -85.00, currency: 'USD', date: '2023-10-01', category: 'Bills', note: 'Internet bill' },
        { id: '11', amount: 200, currency: 'USD', date: '2023-09-28', category: 'Income', note: 'Freelance work' },
        { id: '12', amount: -45.75, currency: 'USD', date: '2023-09-25', category: 'Health', note: 'Medicine' }
      ]);
    } finally {
      setLoading(false);
    }
  };

  // Group transactions by month
  const groupedTransactions = useMemo(() => {
    const groups: Record<string, Transaction[]> = {};
    
    transactions.forEach(transaction => {
      const date = new Date(transaction.date);
      const monthYear = `${date.toLocaleString('default', { month: 'long' })} ${date.getFullYear()}`;
      
      if (!groups[monthYear]) {
        groups[monthYear] = [];
      }
      
      groups[monthYear].push(transaction);
    });
    
    // Convert to array for FlatList
    return Object.entries(groups).map(([title, data]) => ({
      title,
      data,
    }));
  }, [transactions]);

  const renderTransactionItem = ({ item }: { item: Transaction }) => {
    const date = new Date(item.date);
    const formattedDate = date.toLocaleDateString('en-US', {
      day: 'numeric',
      month: 'short',
    });
    
    return (
      <View style={[styles.transactionItem, { backgroundColor: colors.cardBackground }]}>
        <RNView style={styles.dateCircle}>
          <Text style={styles.dateDay}>{date.getDate()}</Text>
          <Text style={styles.dateMonth}>{date.toLocaleDateString('en-US', { month: 'short' })}</Text>
        </RNView>
        
        <RNView style={[styles.transactionDetails, { backgroundColor: 'transparent' }]}>
          <Text style={[styles.transactionNote, { color: colors.text }]}>{item.note}</Text>
          <Text style={[styles.transactionCategory, { color: colors.subText }]}>{item.category}</Text>
        </RNView>
        
        <Text 
          style={[
            styles.transactionAmount,
            item.amount < 0 ? styles.expense : styles.income,
            { backgroundColor: 'transparent' }
          ]}
        >
          {item.amount < 0 ? '-' : '+'}{item.currency} {Math.abs(item.amount).toFixed(2)}
        </Text>
      </View>
    );
  };

  const renderMonthSection = ({ item }: { item: { title: string, data: Transaction[] } }) => {
    // Calculate month total
    const monthTotal = item.data.reduce((sum, transaction) => sum + transaction.amount, 0);
    
    return (
      <View style={[styles.monthSection, { backgroundColor: colors.background }]}>
        <RNView style={[styles.monthHeader, { backgroundColor: 'transparent' }]}>
          <Text style={[styles.monthTitle, { color: colors.text }]}>{item.title}</Text>
          <Text 
            style={[
              styles.monthTotal, 
              monthTotal >= 0 ? styles.income : styles.expense,
              { backgroundColor: 'transparent' }
            ]}
          >
            {monthTotal >= 0 ? '+' : '-'}USD {Math.abs(monthTotal).toFixed(2)}
          </Text>
        </RNView>
        
        {item.data.map(transaction => (
          <View key={transaction.id} style={{ marginBottom: 8 }}>
            {renderTransactionItem({ item: transaction })}
          </View>
        ))}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={AppColors.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.errorContainer, { backgroundColor: colors.background }]}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadTransactions}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <RNView style={[styles.filterBar, { backgroundColor: colors.cardBackground }]}>
        <Text style={[styles.filterTitle, { color: colors.text }]}>Transaction History</Text>
        <TouchableOpacity style={styles.filterButton}>
          <FontAwesome name="filter" size={18} color={AppColors.primary} />
          <Text style={styles.filterText}>Filter</Text>
        </TouchableOpacity>
      </RNView>
      
      <FlatList
        data={groupedTransactions}
        renderItem={renderMonthSection}
        keyExtractor={item => item.title}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={[styles.emptyContainer, { backgroundColor: colors.background }]}>
            <Text style={[styles.emptyText, { color: colors.subText }]}>No transaction history found</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  filterBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    ...(Platform.OS === 'web'
      ? { 
          boxShadow: '0px 1px 3px rgba(0, 0, 0, 0.1)',
        }
      : {
          elevation: 2,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.1,
          shadowRadius: 2,
        }),
  },
  filterTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  filterText: {
    marginLeft: 5,
    color: AppColors.primary,
    fontWeight: '500',
  },
  listContent: {
    padding: 16,
  },
  monthSection: {
    marginBottom: 24,
  },
  monthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  monthTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  monthTotal: {
    fontSize: 16,
    fontWeight: '600',
  },
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    ...(Platform.OS === 'web'
      ? { 
          boxShadow: '0px 1px 2px rgba(0, 0, 0, 0.1)',
        }
      : {
          elevation: 1,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.1,
          shadowRadius: 1,
        }),
  },
  dateCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: AppColors.lightGreen,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  dateDay: {
    fontSize: 16,
    fontWeight: 'bold',
    color: AppColors.darkGreen,
  },
  dateMonth: {
    fontSize: 12,
    color: AppColors.darkGreen,
  },
  transactionDetails: {
    flex: 1,
  },
  transactionNote: {
    fontSize: 16,
    fontWeight: '500',
  },
  transactionCategory: {
    fontSize: 14,
  },
  transactionAmount: {
    fontSize: 16,
    fontWeight: '600',
  },
  expense: {
    color: AppColors.danger,
  },
  income: {
    color: AppColors.primary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  errorText: {
    fontSize: 16,
    color: AppColors.danger,
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: AppColors.primary,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 5,
  },
  retryButtonText: {
    color: AppColors.white,
    fontWeight: '500',
  },
  emptyContainer: {
    padding: 20,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
  },
});