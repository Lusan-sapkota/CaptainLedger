import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Modal,
  ScrollView,
  ActivityIndicator,
  Platform,
  RefreshControl,
  Animated,
  KeyboardAvoidingView,
  StatusBar,
  Alert,
  Pressable,
  SafeAreaView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';

// Local components
import { Text, View } from '@/components/Themed';
import { useAlert } from '@/components/AlertProvider';
import { useTheme } from '@/components/ThemeProvider';

// Services & API
import {
  getTransactions,
  createTransaction,
  deleteTransaction,
  getCategoriesApi,
  addCategory
} from '@/services/api';
import { AppColors } from './_layout';

export default function TransactionsScreen() {
  const { isDarkMode, colors } = useTheme();
  const { showAlert } = useAlert();
  const router = useRouter();
  
  // Types
  type Transaction = {
    id: string;
    amount: number;
    currency: string;
    date: string;
    category: string;
    note?: string;
    deadline?: string;  // Added for loan transactions
  };

  // States
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Modal states
  const [modalVisible, setModalVisible] = useState(false);
  const [newTransaction, setNewTransaction] = useState({
    amount: '',
    currency: 'USD',
    category: 'Other',
    note: '',
    date: new Date().toISOString().split('T')[0],
    isIncome: false,
    deadline: '' // For loan transactions
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [datePickerMode, setDatePickerMode] = useState<'transactionDate' | 'loanDeadline'>('transactionDate');
  
  // Category states
  const [categories, setCategories] = useState<Category[]>([]);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showCategoriesSelector, setShowCategoriesSelector] = useState(false);
  
  // Monthly summary
  type MonthlySummary = {
    period: string;
    income: number;
    expenses: number;
    balance: number;
    currency: string;
  } | null;
  const [monthlySummary, setMonthlySummary] = useState<MonthlySummary>(null);
  const summaryAnimation = useRef(new Animated.Value(0)).current;
  
  // Calculated values
  const balance = transactions.reduce((sum, t) => sum + t.amount, 0) || 0;
  
  // New states for category management
  const [newCategoryName, setNewCategoryName] = useState('');
  const [selectedCategoryColor, setSelectedCategoryColor] = useState('#FF5722');
  
  // Predefined colors for category selection
  const CATEGORY_COLORS = [
    '#FF5722', '#E91E63', '#9C27B0', '#673AB7', '#3F51B5',
    '#2196F3', '#03A9F4', '#00BCD4', '#009688', '#4CAF50',
    '#8BC34A', '#CDDC39', '#FFEB3B', '#FFC107', '#FF9800'
  ];

  // Add this state to track editing
  const [editingTransactionId, setEditingTransactionId] = useState<string | null>(null);

  useEffect(() => {
    loadTransactions();
    loadCategories();
  }, []);
  
  const loadTransactions = async (isRefreshing = false) => {
    if (isRefreshing) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    
    try {
      const response = await getTransactions();
      if (response?.data?.transactions) {
        const sortedTransactions = [...response.data.transactions]
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        
        setTransactions(sortedTransactions);
        calculateMonthlySummary(sortedTransactions);
      }
    } catch (err) {
      console.error('Error loading transactions:', err);
      setError('Network error. Using sample data.');
      
      // Sample data for testing
      const sampleData = [
        { id: '1', amount: -25.99, currency: 'USD', date: new Date().toISOString().split('T')[0], category: 'Food', note: 'Groceries' },
        { id: '2', amount: -12.50, currency: 'USD', date: new Date().toISOString().split('T')[0], category: 'Transport', note: 'Uber ride' },
        { id: '3', amount: 1500, currency: 'USD', date: new Date().toISOString().split('T')[0], category: 'Income', note: 'Salary' }
      ];
      setTransactions(sampleData);
      calculateMonthlySummary(sampleData);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadCategories = async () => {
    try {
      setLoading(true); // Show loading state while fetching
      const response = await getCategoriesApi();
      if (response?.data?.categories) {
        setCategories(
          response.data.categories.map((cat: any) => {
            // Determine category type
            let categoryType: 'income' | 'expense';
            
            if (cat.type === 'income' || cat.type === 'expense') {
              categoryType = cat.type;
            } else {
              // If no type is provided, infer from known income category names
              const incomeCategories = ['Income', 'Salary', 'Investments'];
              categoryType = incomeCategories.includes(cat.name) ? 'income' : 'expense';
            }
            
            return {
              name: cat.name,
              color: cat.color,
              icon: cat.icon ?? 'ellipsis-horizontal',
              type: categoryType
            };
          })
        );
      }
    } catch (err) {
      console.error('Error loading categories:', err);
      // Basic fallback categories
      setCategories([
        { name: 'Food', color: '#FF5722', icon: 'fast-food', type: 'expense' },
        { name: 'Transport', color: '#2196F3', icon: 'car', type: 'expense' },
        { name: 'Income', color: '#8BC34A', icon: 'cash', type: 'income' },
        { name: 'Salary', color: '#4CAF50', icon: 'wallet', type: 'income' },
        { name: 'Other', color: '#607D8B', icon: 'ellipsis-horizontal', type: 'expense' }
      ]);
    } finally {
      setLoading(false);
    }
  };
  

  interface MonthlySummaryData {
    period: string;
    income: number;
    expenses: number;
    balance: number;
    currency: string;
  }

  const calculateMonthlySummary = (data: Transaction[]): void => {
    if (!data.length) return;
    
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    
    const monthTransactions = data.filter((t: Transaction) => {
      const date = new Date(t.date);
      return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
    });
    
    let income = 0;
    let expenses = 0;
    
    monthTransactions.forEach((t: Transaction) => {
      if (t.amount > 0) {
        income += t.amount;
      } else {
        expenses += Math.abs(t.amount);
      }
    });
    
    setMonthlySummary({
      period: new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      income,
      expenses,
      balance: income - expenses,
      currency: data[0]?.currency || 'USD'
    });
    
    Animated.timing(summaryAnimation, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true
    }).start();
  };

  const handleDateChange = (
    event: DateTimePickerEvent,
    selectedDate?: Date | undefined
  ): void => {
    const currentDate = selectedDate || new Date();
    setShowDatePicker(false);
    
    if (Platform.OS === 'android') {
      // For Android, we need to manually close the picker
      setShowDatePicker(false);
    }
    
    if (selectedDate) {
      const formattedDate = selectedDate.toISOString().split('T')[0];
      
      if (datePickerMode === 'transactionDate') {
        setNewTransaction({
          ...newTransaction,
          date: formattedDate
        });
      } else if (datePickerMode === 'loanDeadline') {
        setNewTransaction({
          ...newTransaction,
          deadline: formattedDate
        });
      }
    }
  };
  
  // Add this function to handle editing a transaction
  const handleEditTransaction = (item: Transaction) => {
    // Set the form data with the transaction being edited
    setNewTransaction({
      amount: Math.abs(item.amount).toString(),
      currency: item.currency,
      category: item.category,
      note: item.note || '',
      date: item.date,
      isIncome: item.amount > 0,
      deadline: item.deadline || ''
    });
    
    // Set the editing flag with the transaction ID
    setEditingTransactionId(item.id);
    
    // Open the modal
    setModalVisible(true);
  };

  // Update the handleAddTransaction function to handle both adding and editing
  const handleAddTransaction = () => {
    if (!newTransaction.amount || isNaN(parseFloat(newTransaction.amount))) {
      showAlert('Invalid Amount', 'Please enter a valid amount', 'error');
      return;
    }
    
    // For loans, ensure a deadline is set
    if (newTransaction.category === 'Loan' && !newTransaction.deadline) {
      showAlert('Missing Deadline', 'Please set a deadline for the loan', 'error');
      return;
    }
    
    const amount = parseFloat(newTransaction.amount);
    const finalAmount = newTransaction.isIncome ? Math.abs(amount) : -Math.abs(amount);
    
    if (editingTransactionId) {
      // We're editing an existing transaction
      const updatedTransactions = transactions.map(t => 
        t.id === editingTransactionId 
          ? {
              ...t,
              amount: finalAmount,
              currency: newTransaction.currency,
              date: newTransaction.date,
              category: newTransaction.category,
              note: newTransaction.note,
              deadline: newTransaction.category === 'Loan' ? newTransaction.deadline : undefined
            }
          : t
      );
      
      setTransactions(updatedTransactions);
      setEditingTransactionId(null); // Clear editing state
      showAlert('Success', 'Transaction updated successfully', 'success');
      
      // Update API if needed
      // updateTransaction(editingTransactionId, newTx).catch(err => {
      //   console.error('Failed to update transaction on server', err);
      // });
    } else {
      // We're adding a new transaction
      const newTx = {
        id: Date.now().toString(),
        amount: finalAmount,
        currency: newTransaction.currency,
        date: newTransaction.date,
        category: newTransaction.category,
        note: newTransaction.note,
        deadline: newTransaction.category === 'Loan' ? newTransaction.deadline : undefined
      };
      
      const updatedTransactions = [newTx, ...transactions]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        
      setTransactions(updatedTransactions);
      showAlert('Success', 'Transaction added successfully', 'success');
    }
    
    setModalVisible(false);
    calculateMonthlySummary(transactions);
    
    // Reset form
    setNewTransaction({
      amount: '',
      currency: 'USD',
      category: 'Other',
      note: '',
      date: new Date().toISOString().split('T')[0],
      isIncome: false,
      deadline: ''
    });
  };
  

  const getCategoryColor = (categoryName: string): string => {
    const category: Category | undefined = categories.find((c: Category) => c.name === categoryName);
    return category?.color || '#607D8B';
  };
  

  const getCategoryIcon = (categoryName: string): string => {
    const category = categories.find((c: Category) => c.name === categoryName);
    return category?.icon || 'ellipsis-horizontal';
  };
  
  // Update the renderTransactionItem function to include a delete button
  const renderTransactionItem = ({ item }: { item: Transaction }) => (
    <TouchableOpacity 
      style={[styles.transactionItem, { backgroundColor: colors.cardBackground }]}
      onLongPress={() => confirmDeleteTransaction(item)}
    >
      <View style={[styles.transactionLeft, { backgroundColor: colors.cardBackground }]}>
        <View 
          style={[styles.categoryIcon, { backgroundColor: getCategoryColor(item.category) }]}
        >
          <Ionicons name={getCategoryIcon(item.category) as keyof typeof Ionicons.glyphMap} size={20} color="white" />
        </View>
        <View style={[styles.transactionDetails, { backgroundColor: colors.cardBackground }]}>
          <Text style={[styles.transactionCategory, { color: colors.text }]}>
            {item.category}
          </Text>
          <Text style={[styles.transactionNote, { color: colors.text }]}>
            {item.note || 'No description'}
          </Text>
          <Text style={[styles.transactionDate, { color: colors.text }]}>
            {new Date(item.date).toLocaleDateString()}
          </Text>
          {/* Show deadline if it's a loan */}
          {item.category === 'Loan' && item.deadline && (
            <Text style={[styles.deadlineText, { color: isDeadlineSoon(item.deadline) ? AppColors.danger : '#FF9800' }]}>
              Due: {new Date(item.deadline).toLocaleDateString()}
            </Text>
          )}
        </View>
      </View>
      <View style={{ flexDirection: 'column', alignItems: 'flex-end' }}>
        <Text 
          style={[
            styles.transactionAmount,
            item.amount < 0 ? styles.expense : styles.income
          ]}
        >
          {item.amount < 0 ? '-' : '+'}{item.currency} {Math.abs(item.amount).toFixed(2)}
        </Text>
        
        {/* Action buttons row */}
        <View style={styles.actionButtonsRow}>
          {/* Edit button */}
          <TouchableOpacity 
            style={styles.actionIconButton}
            onPress={() => handleEditTransaction(item)}
          >
            <FontAwesome name="pencil" size={16} color={AppColors.primary} />
          </TouchableOpacity>
          
          {/* Delete button */}
          <TouchableOpacity 
            style={[styles.actionIconButton, { marginLeft: 10 }]}
            onPress={() => confirmDeleteTransaction(item)}
          >
            <FontAwesome name="trash-o" size={16} color={AppColors.danger} />
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );

  // Add this helper function to check if the deadline is approaching soon (within 7 days)
  const isDeadlineSoon = (deadlineStr: string) => {
    const deadline = new Date(deadlineStr);
    const now = new Date();
    const diffDays = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays <= 7 && diffDays >= 0;
  };

  // Add this helper function for the delete confirmation
  const confirmDeleteTransaction = (item: Transaction) => {
    Alert.alert(
      'Delete Transaction',
      'Are you sure you want to delete this transaction?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive', 
          onPress: async () => {
            try {
              // Set up optimistic update
              const updatedTransactions = transactions.filter(t => t.id !== item.id);
              setTransactions(updatedTransactions);
              calculateMonthlySummary(updatedTransactions);
              
              // Show feedback
              showAlert('Success', 'Transaction deleted successfully', 'success');
              
              // If you have API integration
              try {
                await deleteTransaction(item.id);
              } catch (error) {
                console.error('Failed to delete from server, but removed locally', error);
              }
            } catch (error) {
              console.error('Error deleting transaction:', error);
              showAlert('Error', 'Failed to delete transaction', 'error');
            }
          }
        }
      ]
    );
  };

  const onRefresh = useCallback(() => {
    loadTransactions(true);
  }, []);

  const exportToCSV = async () => {
    try {
      if (transactions.length === 0) {
        showAlert('No Data', 'There are no transactions to export', 'info');
        return;
      }
      
      // Format the data for CSV
      const csvHeader = 'Date,Category,Amount,Currency,Note\n';
      const csvContent = transactions.map(t => {
        return `"${t.date}","${t.category}","${t.amount}","${t.currency}","${t.note || ''}"`;
      }).join('\n');
      
      const csvString = csvHeader + csvContent;
      const fileName = `transactions_${new Date().toISOString().split('T')[0]}.csv`;
      
      if (Platform.OS === 'web') {
        // For web platform
        const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = fileName;
        link.click();
        
        showAlert('Success', 'Transactions exported to CSV successfully', 'success');
      } else {
        // For native platforms
        showAlert('Export', 'CSV export is available on web version', 'info');
      }
    } catch (error) {
      console.error('Export error:', error);
      showAlert('Export Failed', 'Could not export transactions', 'error');
    }
  };

  const exportToPDF = async () => {
    try {
      if (transactions.length === 0) {
        showAlert('No Data', 'There are no transactions to export', 'info');
        return;
      }
      
      if (Platform.OS === 'web') {
        // Simple method for web - use browser print
        const printWindow = window.open('', '_blank');
        
        if (!printWindow) {
          showAlert('Export Failed', 'Could not open print window. Please check your browser settings.', 'error');
          return;
        }
        
        // Build HTML content
        let htmlContent = `
          <html>
          <head>
            <title>Transactions Report</title>
            <style>
              body { font-family: Arial, sans-serif; padding: 20px; }
              h1 { color: #333; text-align: center; }
              .date { font-weight: bold; margin-top: 20px; }
              table { width: 100%; border-collapse: collapse; margin-top: 10px; }
              th, td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
              th { background-color: #f5f5f5; }
              .expense { color: #f44336; }
              .income { color: #4caf50; }
            </style>
          </head>
          <body>
            <h1>Transactions Report</h1>
            <p>Generated on ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}</p>
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Category</th>
                  <th>Note</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
        `;
        
        // Add transaction rows
        transactions.forEach(t => {
          const dateStr = new Date(t.date).toLocaleDateString();
          const amountClass = t.amount < 0 ? 'expense' : 'income';
          const amountStr = t.amount < 0 ? '-' : '+';
          
          htmlContent += `
            <tr>
              <td>${dateStr}</td>
              <td>${t.category}</td>
              <td>${t.note || ''}</td>
              <td class="${amountClass}">${amountStr}${t.currency} ${Math.abs(t.amount).toFixed(2)}</td>
            </tr>
          `;
        });
        
        htmlContent += `
              </tbody>
            </table>
          </body>
          </html>
        `;
        
        printWindow.document.write(htmlContent);
        printWindow.document.close();
        
        setTimeout(() => {
          printWindow.print();
        }, 500);
        
        showAlert('Success', 'Transactions prepared for PDF export', 'success');
      } else {
        // For native platforms
        showAlert('Export', 'PDF export is available on web version', 'info');
      }
    } catch (error) {
      console.error('Export error:', error);
      showAlert('Export Failed', 'Could not export transactions', 'error');
    }
  };

  // Define the Category type for TypeScript
  type Category = {
    name: string;
    color: string;
    icon: string;
    type?: 'income' | 'expense'; // Add the type property
  };

  // Update renderCategoryItem function to filter based on type instead of name
  const renderCategoryItem = ({ item }: { item: Category }) => {
    // Only show categories that match the current transaction type
    if (newTransaction.isIncome && item.type !== 'income') return null;
    if (!newTransaction.isIncome && item.type !== 'expense') return null;
    
    return (
      <TouchableOpacity
        style={[
          styles.categoryItem,
          {
            backgroundColor: newTransaction.category === item.name ?
              item.color : isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
          }
        ]}
        onPress={() => {
          setNewTransaction({...newTransaction, category: item.name});
          setShowCategoriesSelector(false);
        }}
      >
        <View style={[styles.categoryItemIcon, { backgroundColor: item.color }]}>
          <Ionicons 
            name={item.icon as keyof typeof Ionicons.glyphMap} 
            size={16} 
            color="#fff" 
          />
        </View>
        <Text style={{
          color: newTransaction.category === item.name ? '#fff' : colors.text,
          fontWeight: newTransaction.category === item.name ? 'bold' : 'normal'
        }}>
          {item.name}
        </Text>
      </TouchableOpacity>
    );
  };

  // Function to open date picker with the specified mode
  const openDatePicker = (mode: 'transactionDate' | 'loanDeadline') => {
    setDatePickerMode(mode);
    setShowDatePicker(true);
  };

  useEffect(() => {
  // When switching between income/expense, select an appropriate category
  const availableCategories = categories.filter(
    c => newTransaction.isIncome ? c.type === 'income' : c.type === 'expense'
  );
  
  // Check if current category is valid for the current transaction type
  const isCurrentCategoryValid = availableCategories.some(
    c => c.name === newTransaction.category
  );
  
  if (!isCurrentCategoryValid) {
    // Select the first available category of the appropriate type
    const defaultCategory = availableCategories.length > 0 ? 
      availableCategories[0].name : 
      newTransaction.isIncome ? 'Income' : 'Other';
    
    setNewTransaction(prev => ({
      ...prev,
      category: defaultCategory
    }));
  }
}, [newTransaction.isIncome, categories]);

  // Update the getAvailableCategories function to check for undefined types
  const getAvailableCategories = () => {
    return categories.filter(c => {
      // For backward compatibility with old categories that might not have a type
      if (c.type === undefined) {
        // Infer type from category name for older data
        const incomeNames = ['Income', 'Salary', 'Investments'];
        return newTransaction.isIncome ? incomeNames.includes(c.name) : !incomeNames.includes(c.name);
      }
      
      return newTransaction.isIncome ? c.type === 'income' : c.type === 'expense';
    });
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar 
        barStyle={isDarkMode ? 'light-content' : 'dark-content'} 
        backgroundColor={isDarkMode ? '#1a1a1a' : AppColors.primary}
      />
      
      {/* Balance Header */}
      <View style={[styles.header, { backgroundColor: AppColors.secondary }]}>
        <View style={styles.balanceHeaderContainer}>
          <Text style={styles.balanceLabel}>Total Balance</Text>
          <Text style={[
            styles.balanceAmount, 
            { color: balance >= 0 ? '#4ade80' : '#f87171' }
          ]}>
            {balance >= 0 ? '+' : ''}{transactions[0]?.currency || 'USD'} {Math.abs(balance).toFixed(2)}
          </Text>
        </View>
        
        {/* Monthly Summary */}
        {monthlySummary && (
          <Animated.View 
            style={[
              styles.monthlySummary, 
              { 
                opacity: summaryAnimation,
                transform: [{ translateY: summaryAnimation.interpolate({
                  inputRange: [0, 1],
                  outputRange: [20, 0]
                })}]
              }
            ]}
          >
            <Text style={styles.summaryPeriod}>{monthlySummary.period}</Text>
            
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Income</Text>
                <Text style={[styles.summaryValue, { color: '#4ade80' }]}>
                  +{monthlySummary.currency} {monthlySummary.income.toFixed(2)}
                </Text>
              </View>
              
              <View style={styles.summaryDivider} />
              
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Expenses</Text>
                <Text style={[styles.summaryValue, { color: '#f87171' }]}>
                  -{monthlySummary.currency} {monthlySummary.expenses.toFixed(2)}
                </Text>
              </View>
            </View>
          </Animated.View>
        )}
      </View>

      {/* Transactions List */}
      <View style={styles.transactionsContainer}>
        <View style={styles.listHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Recent Transactions
          </Text>
          
          <View style={styles.headerActions}>
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => exportToCSV()}
            >
              <FontAwesome name="file-text-o" size={18} color={AppColors.primary} />
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => exportToPDF()}
            >
              <FontAwesome name="file-pdf-o" size={18} color={AppColors.primary} />
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => loadTransactions()}
            >
              <FontAwesome name="refresh" size={18} color={AppColors.primary} />
            </TouchableOpacity>
          </View>
        </View>
        
        {loading && !refreshing ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={AppColors.primary} />
          </View>
        ) : (
          <FlatList
            data={transactions}
            renderItem={renderTransactionItem}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.list}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={[AppColors.primary]}
                tintColor={AppColors.primary}
              />
            }
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <FontAwesome name="money" size={60} color={colors.text} style={{ opacity: 0.5, marginBottom: 20 }} />
                <Text style={[styles.emptyText, { color: colors.text }]}>No transactions yet</Text>
                <Text style={[styles.emptySubText, { color: colors.text, opacity: 0.7 }]}>
                  Add your first transaction by tapping the + button
                </Text>
              </View>
            }
          />
        )}
      </View>
      
      {/* Add Transaction Button */}
      <TouchableOpacity
        style={styles.addButton}
        onPress={() => setModalVisible(true)}
      >
        <FontAwesome name="plus" size={24} color="white" />
      </TouchableOpacity>
      
      {/* Transaction Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={styles.modalContainer}
          >
            <View style={[styles.modalContent, { backgroundColor: colors.cardBackground }]}>
              {/* Modal Header Tabs - Updated styling */}
              <View style={styles.tabsContainer}>
                <Pressable 
                  style={[
                    styles.tabButton, 
                    !newTransaction.isIncome && styles.activeTabButton,
                    { borderBottomColor: !newTransaction.isIncome ? AppColors.danger : 'transparent' }
                  ]}
                  onPress={() => setNewTransaction({...newTransaction, isIncome: false})}
                >
                  <Text style={[
                    styles.tabText, 
                    { color: !newTransaction.isIncome ? AppColors.white : colors.subText }
                  ]}>
                    Expense
                  </Text>
                </Pressable>
                
                <Pressable 
                  style={[
                    styles.tabButton, 
                    newTransaction.isIncome && styles.activeTabButton,
                    { borderBottomColor: newTransaction.isIncome ? AppColors.primary : 'transparent' }
                  ]}
                  onPress={() => setNewTransaction({...newTransaction, isIncome: true})}
                >
                  <Text style={[
                    styles.tabText, 
                    { color: newTransaction.isIncome ? AppColors.white : colors.subText }
                  ]}>
                    Income
                  </Text>
                </Pressable>
              </View>
              
              {/* Amount Input - Updated styling */}
              <View style={[
                styles.amountInputContainer, 
                { 
                  borderColor: newTransaction.isIncome ? AppColors.primary : AppColors.danger,
                  backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)'
                }
              ]}>
                <Text style={[
                  styles.currencySymbol,
                  { color: newTransaction.isIncome ? AppColors.primary : AppColors.danger }
                ]}>
                  $
                </Text>
                <TextInput
                  style={[
                    styles.amountInput,
                    { color: newTransaction.isIncome ? AppColors.primary : AppColors.danger }
                  ]}
                  placeholder="0.00"
                  keyboardType="decimal-pad"
                  value={newTransaction.amount}
                  onChangeText={(text) => {
                    // Allow only numbers and one decimal point
                    const sanitized = text.replace(/[^0-9.]/g, '');
                    // Prevent multiple decimal points
                    if ((sanitized.match(/\./g) || []).length <= 1) {
                      setNewTransaction({...newTransaction, amount: sanitized});
                    }
                  }}
                  autoFocus
                />
              </View>
              
              {/* Date & Category Row - Updated styling */}
              <View style={styles.fieldRow}>
                <Pressable 
                  style={[styles.dateField, { 
                    backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)',
                    borderWidth: 1,
                    borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'
                  }]}
                  onPress={() => openDatePicker('transactionDate')}
                >
                  <FontAwesome name="calendar" size={16} color={colors.text} style={{ marginRight: 8 }} />
                  <Text style={{ color: colors.text }}>
                    {new Date(newTransaction.date).toLocaleDateString()}
                  </Text>
                </Pressable>
                
                <Pressable 
                  style={[styles.categorySelector, { backgroundColor: getCategoryColor(newTransaction.category) }]}
                  onPress={() => setShowCategoriesSelector(true)}
                >
                  <Text style={{ color: '#fff', fontWeight: '500' }}>
                    {newTransaction.category}
                  </Text>
                  <FontAwesome name="chevron-down" size={12} color="#fff" style={{ marginLeft: 5 }} />
                </Pressable>
              </View>
              
              {/* Loan Deadline - New section for loan transactions */}
              {newTransaction.category === 'Loan' && (
                <View style={{ marginBottom: 15 }}>
                  <Text style={[styles.inputLabel, { color: colors.text, marginTop: 10 }]}>
                    Loan Deadline
                  </Text>
                  <Pressable 
                    style={[styles.dateField, { 
                      backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)',
                      borderWidth: 1,
                      borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'
                    }]}
                    onPress={() => openDatePicker('loanDeadline')}
                  >
                    <FontAwesome name="calendar" size={16} color={AppColors.danger} style={{ marginRight: 8 }} />
                    <Text style={{ color: colors.text }}>
                      {newTransaction.deadline ? new Date(newTransaction.deadline).toLocaleDateString() : 'Select deadline...'}
                    </Text>
                  </Pressable>
                </View>
              )}
              
              {/* Note Input - Updated styling */}
              <TextInput
                style={[
                  styles.noteInput,
                  { 
                    backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)', 
                    borderWidth: 1,
                    borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                    color: colors.text
                  }
                ]}
                placeholder="Add a note (optional)"
                placeholderTextColor={isDarkMode ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)'}
                value={newTransaction.note}
                onChangeText={(text) => setNewTransaction({...newTransaction, note: text})}
                multiline={true}
                numberOfLines={3}
              />
              
              {/* Action Buttons - Updated styling */}
              <View style={styles.actions}>
                <TouchableOpacity 
                  style={[styles.cancelButton, { 
                    borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'
                  }]}
                  onPress={() => setModalVisible(false)}
                >
                  <Text style={{ color: colors.text }}>Cancel</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[
                    styles.saveButton,
                    { backgroundColor: newTransaction.isIncome ? AppColors.primary : AppColors.danger }
                  ]}
                  onPress={handleAddTransaction}
                >
                  <Text style={{ color: '#fff', fontWeight: '600' }}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
      
      {/* Date Picker Modal - Platform specific implementation */}
      {showDatePicker && Platform.OS !== 'web' && (
        <DateTimePicker
          value={datePickerMode === 'loanDeadline' && newTransaction.deadline
            ? new Date(newTransaction.deadline || Date.now())
            : new Date(newTransaction.date || Date.now())}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleDateChange}
          minimumDate={datePickerMode === 'loanDeadline' ? new Date() : undefined}
          maximumDate={datePickerMode === 'transactionDate' ? new Date() : undefined}
        />
      )}

      {/* Web Date Picker Modal */}
      {showDatePicker && Platform.OS === 'web' && (
        <Modal
          animationType="fade"
          transparent={true}
          visible={showDatePicker}
          onRequestClose={() => setShowDatePicker(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.webDatePickerModal, { backgroundColor: colors.cardBackground }]}>
              <View style={styles.categoriesHeader}>
                <Text style={[styles.categoriesTitle, { color: colors.text }]}>
                  Select {datePickerMode === 'transactionDate' ? 'Transaction Date' : 'Loan Deadline'}
                </Text>
                <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                  <FontAwesome name="times" size={20} color={colors.text} />
                </TouchableOpacity>
              </View>
              
              <input
                type="date"
                value={datePickerMode === 'loanDeadline' 
                  ? (newTransaction.deadline || new Date().toISOString().split('T')[0])
                  : (newTransaction.date || new Date().toISOString().split('T')[0])}
                onChange={(e) => {
                  const selectedDate = e.target.value;
                  if (datePickerMode === 'transactionDate') {
                    setNewTransaction({...newTransaction, date: selectedDate});
                  } else {
                    setNewTransaction({...newTransaction, deadline: selectedDate});
                  }
                }}
                min={datePickerMode === 'loanDeadline' ? new Date().toISOString().split('T')[0] : undefined}
                max={datePickerMode === 'transactionDate' ? new Date().toISOString().split('T')[0] : undefined}
                style={{
                  width: '100%',
                  padding: 12,
                  fontSize: 16,
                  borderRadius: 8,
                  marginTop: 20,
                  marginBottom: 20,
                  borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                  borderWidth: 1,
                  backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.8)',
                  color: colors.text
                }}
              />
              
              <View style={styles.actions}>
                <TouchableOpacity 
                  style={[styles.cancelButton, { 
                    borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'
                  }]}
                  onPress={() => setShowDatePicker(false)}
                >
                  <Text style={{ color: colors.text }}>Cancel</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[styles.webDatePickerButton, { backgroundColor: AppColors.primary }]}
                  onPress={() => setShowDatePicker(false)}
                >
                  <Text style={{ color: '#fff', fontWeight: '600' }}>Confirm</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
      
      {/* Categories Selector Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showCategoriesSelector}
        onRequestClose={() => setShowCategoriesSelector(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modernCategoriesModal, { backgroundColor: colors.cardBackground }]}>
            <View style={styles.categoriesHeader}>
              <Text style={[styles.categoriesTitle, { color: colors.text }]}>
                Select {newTransaction.isIncome ? 'Income' : 'Expense'} Category
              </Text>
              
              <View style={styles.categoryHeaderButtons}>
                <TouchableOpacity 
                  style={styles.addCategoryButton}
                  onPress={() => {
                    setShowCategoriesSelector(false); // Close categories selector
                    setModalVisible(false); // Close the main modal as well
                    router.push({
                      pathname: '/categoryManagement',
                      params: { 
                        type: newTransaction.isIncome ? 'income' : 'expense',
                        from: 'transaction' // Add this to track where we came from
                      }
                    });
                  }}
                >
                  <FontAwesome name="plus" size={16} color={AppColors.primary} />
                  <Text style={{ color: AppColors.primary, marginLeft: 5 }}>New</Text>
                </TouchableOpacity>
                
                <TouchableOpacity onPress={() => setShowCategoriesSelector(false)}>
                  <FontAwesome name="times" size={20} color={colors.text} />
                </TouchableOpacity>
              </View>
            </View>
            
            <FlatList
              data={getAvailableCategories()}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.modernCategoryItem,
                    {
                      backgroundColor: newTransaction.category === item.name ?
                        item.color : isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                    }
                  ]}
                  onPress={() => {
                    setNewTransaction({...newTransaction, category: item.name});
                    setShowCategoriesSelector(false);
                  }}
                >
                  <View style={[styles.categoryItemIcon, { backgroundColor: item.color }]}>
                    <Ionicons 
                      name={item.icon as keyof typeof Ionicons.glyphMap} 
                      size={16} 
                      color="#fff" 
                    />
                  </View>
                  <Text style={{
                    color: newTransaction.category === item.name ? '#fff' : colors.text,
                    fontWeight: newTransaction.category === item.name ? 'bold' : 'normal',
                    marginLeft: 10,
                    flex: 1
                  }}>
                    {item.name}
                  </Text>
                  {newTransaction.category === item.name && (
                    <FontAwesome name="check" size={16} color="#fff" />
                  )}
                </TouchableOpacity>
              )}
              keyExtractor={item => item.name}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.modernCategoriesList}
            />
          </View>
        </View>
      </Modal>
      
      {/* Add New Category Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={showCategoryModal}
        onRequestClose={() => setShowCategoryModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.categoryFormModal, { backgroundColor: colors.cardBackground }]}>
            <View style={styles.categoriesHeader}>
              <Text style={[styles.categoriesTitle, { color: colors.text }]}>Add New Category</Text>
              <TouchableOpacity onPress={() => setShowCategoryModal(false)}>
                <FontAwesome name="times" size={20} color={colors.text} />
              </TouchableOpacity>
            </View>
            
            <Text style={[styles.inputLabel, { color: colors.text, marginTop: 10 }]}>Name</Text>
            <TextInput
              style={[styles.categoryInput, { 
                backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)',
                borderWidth: 1,
                borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)', 
                color: colors.text
              }]}
              placeholder="Category name"
              placeholderTextColor={isDarkMode ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)'}
              value={newCategoryName}
              onChangeText={setNewCategoryName}
            />
            
            <Text style={[styles.inputLabel, { color: colors.text, marginTop: 15 }]}>Color</Text>
            <View style={styles.colorGrid}>
              {CATEGORY_COLORS.map(color => (
                <TouchableOpacity 
                  key={color}
                  style={[
                    styles.colorOption,
                    {
                      backgroundColor: color,
                      borderWidth: selectedCategoryColor === color ? 2 : 0,
                      borderColor: isDarkMode ? '#fff' : '#000'
                    }
                  ]}
                  onPress={() => setSelectedCategoryColor(color)}
                />
              ))}
            </View>
            
            <View style={[styles.actions, { marginTop: 20 }]}>
              <TouchableOpacity 
                style={[styles.cancelButton, { 
                  borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'
                }]}
                onPress={() => setShowCategoryModal(false)}
              >
                <Text style={{ color: colors.text }}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.saveButton, { backgroundColor: AppColors.primary }]}
                onPress={() => {
                  if (newCategoryName.trim()) {
                    setLoading(true);
                    // Create the category object
                    const categoryType = newTransaction.isIncome ? 'income' as const : 'expense' as const;
                    const newCategory = {
                      name: newCategoryName.trim(),
                      color: selectedCategoryColor,
                      icon: 'apps', // Default icon
                      type: categoryType // Type is now properly typed
                    };
                    
                    // Call the API to save the category
                    addCategory(newCategory.name, newCategory.color, newCategory.type)
                      .then(() => {
                        // Add to local state
                        setCategories([...categories, newCategory]);
                        setNewCategoryName('');
                        setSelectedCategoryColor('#FF5722');
                        setShowCategoryModal(false);
                        
                        // Select the new category
                        setNewTransaction({...newTransaction, category: newCategory.name});
                        
                        showAlert('Success', 'Category added successfully', 'success');
                      })
                      .catch(error => {
                        console.error('Error adding category:', error);
                        const errorMessage = error.response?.data?.error || 'Failed to add category';
                        showAlert('Error', errorMessage, 'error');
                      })
                      .finally(() => {
                        setLoading(false);
                      });
                  }
                }}
              >
                <Text style={{ color: '#fff', fontWeight: '600' }}>Add Category</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 20,
    paddingTop: 40,
    paddingBottom: 30,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  balanceHeaderContainer: {
    alignItems: 'center',
  },
  balanceLabel: {
    fontSize: 16,
    color: 'white',
    marginBottom: 5,
  },
  balanceAmount: {
    fontSize: 36,
    fontWeight: 'bold',
    color: 'white',
  },
  monthlySummary: {
    marginTop: 20,
    width: '100%',
  },
  summaryPeriod: {
    fontSize: 14,
    color: 'white',
    opacity: 0.9,
    textAlign: 'center',
    marginBottom: 10,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryDivider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  summaryLabel: {
    fontSize: 14,
    color: 'white',
    opacity: 0.9,
    marginBottom: 5,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
  },
  transactionsContainer: {
    flex: 1,
    paddingTop: 20,
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  list: {
    paddingBottom: 80,
  },
  transactionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    marginBottom: 10,
    marginHorizontal: 20,
    borderRadius: 15,
  },
  transactionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  categoryIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  transactionDetails: {
    marginLeft: 15,
    flex: 1,
  },
  transactionCategory: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 3,
  },
  transactionNote: {
    fontSize: 14,
    opacity: 0.7,
    marginBottom: 3,
  },
  transactionDate: {
    fontSize: 12,
    opacity: 0.5,
  },
  transactionAmount: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  expense: {
    color: '#f44336',
  },
  income: {
    color: '#4caf50',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
    marginTop: 50,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  emptySubText: {
    textAlign: 'center',
    lineHeight: 20,
  },
  addButton: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: AppColors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '90%',
    maxWidth: 400,
  },
  modalContent: {
    borderRadius: 15,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  tabsContainer: {
    flexDirection: 'row',
    marginBottom: 20,
    borderRadius: 8,
    overflow: 'hidden',
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 2,
  },
  activeTabButton: {
    backgroundColor: AppColors.primary,
  },
  tabText: {
    fontSize: 16,
    fontWeight: '500',
  },
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    paddingHorizontal: 15,
    borderWidth: 1,
    borderRadius: 10,
  },
  currencySymbol: {
    fontSize: 24,
    fontWeight: '500',
    marginRight: 5,
    color: '#666',
  },
  amountInput: {
    flex: 1,
    fontSize: 24,
    paddingVertical: 15,
    color: '#333',
  },
  fieldRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  dateField: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderRadius: 8,
    marginRight: 10,
  },
  categorySelector: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderRadius: 8,
  },
  noteInput: {
    padding: 15,
    borderRadius: 8,
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: 20,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cancelButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    marginRight: 10,
  },
  saveButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  categoriesModal: {
    width: '90%',
    maxWidth: 400,
    borderRadius: 15,
    padding: 20,
  },
  categoriesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  categoriesTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  categoryHeaderButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  addCategoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 15,
  },
  categoriesList: {
    paddingBottom: 20,
  },
  categoryItem: {
    flex: 1,
    margin: 5,
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 80,
  },
  categoryItemIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  colorOption: {
    width: '30%',
    height: 40,
    borderRadius: 5,
    marginBottom: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryFormModal: {
    width: '90%',
    maxWidth: 400,
    borderRadius: 15,
    padding: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  categoryInput: {
    padding: 15,
    borderRadius: 8,
    marginBottom: 15,
    height: 50,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    marginLeft: 15,
  },
  deleteButton: {
    marginTop: 8,
    padding: 5,
  },
  deadlineText: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 3,
  },
  loanCategory: {
    backgroundColor: '#FF9800',
    borderWidth: 1,
    borderColor: '#FF6F00',
  },
  actionButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  actionIconButton: {
    padding: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalHeader: {
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  webDatePickerModal: {
    width: '90%',
    maxWidth: 400,
    borderRadius: 15,
    padding: 20,
  },
  webDatePickerButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modernCategoriesModal: {
    width: '90%',
    maxWidth: 400,
    borderRadius: 15,
    padding: 20,
    maxHeight: '70%', // Limit the height to 70% of screen
  },
  modernCategoriesList: {
    paddingVertical: 10,
  },
  modernCategoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderRadius: 8,
    marginBottom: 8,
  },
});
