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
import { eventEmitter } from '@/utils/eventEmitter';

// Local components
import { Text, View } from '@/components/Themed';
import { useAlert } from '@/components/AlertProvider';
import { useTheme } from '@/components/ThemeProvider';

// Services & API
import {
  getTransactions,
  createTransaction,
  updateTransaction,
  getCategoriesApi,
  addCategory,
  deleteTransaction
} from '@/services/api';
import { AppColors } from './_layout';

// Types
type Transaction = {
  id: string;
  amount: number;
  currency: string;
  date: string;
  category: string;
  note?: string;
  deadline?: string;
  // New fields for loans and investments
  transaction_type?: 'regular' | 'loan' | 'investment' | 'loan_repayment' | 'investment_return';
  interest_rate?: number; // For loans
  roi_percentage?: number; // For investments
  lender_name?: string; // For loans
  investment_platform?: string; // For investments
  status?: 'active' | 'repaid' | 'matured' | 'pending';
  linked_transaction_id?: string; // For linking repayments to original loans
};

export default function TransactionsScreen() {
  const { isDarkMode, colors } = useTheme();
  const { showAlert } = useAlert();
  const router = useRouter();

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
    deadline: '',
    transaction_type: 'regular' as 'regular' | 'loan' | 'loan_repayment' | 'investment' | 'investment_return',
    interest_rate: '',
    roi_percentage: '',
    lender_name: '',
    investment_platform: '',
    status: 'active' as 'active' | 'repaid' | 'matured' | 'pending'
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [datePickerMode, setDatePickerMode] = useState<'transactionDate' | 'loanDeadline'>('transactionDate');
  
  // Category states
  const [categories, setCategories] = useState<Category[]>([]);
  const [showCategoriesSelector, setShowCategoriesSelector] = useState(false);
  
  // Monthly summary
  type MonthlySummary = {
    period: string;
    income: number;
    expenses: number;
    balance: number;
    currency: string;
    loansReceived: number;
    investmentsMade: number;
    loanRepayments: number;
    investmentReturns: number;
  } | null;
  const [monthlySummary, setMonthlySummary] = useState<MonthlySummary>(null);
  const summaryAnimation = useRef(new Animated.Value(0)).current;
  
  // Calculated values
  const balanceInfo = calculateEnhancedBalance(transactions);
  const balance = balanceInfo.totalBalance;

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
        setError(null); // Clear any previous errors
      }
    } catch (err) {
      console.error('Error loading transactions:', err);
      setError('Failed to load transactions from server');
      
      // Don't show sample data in production - let user know there's an issue
      showAlert('Network Error', 'Failed to load transactions. Please check your connection.', 'error');
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
    let loansReceived = 0;
    let investmentsMade = 0;
    let loanRepayments = 0;
    let investmentReturns = 0;
    
    monthTransactions.forEach((t: Transaction) => {
      switch (t.transaction_type) {
        case 'loan':
          loansReceived += t.amount;
          income += t.amount; // Include in income for balance calculation
          break;
        case 'loan_repayment':
          loanRepayments += t.amount;
          expenses += t.amount;
          break;
        case 'investment':
          investmentsMade += t.amount;
          expenses += t.amount;
          break;
        case 'investment_return':
          investmentReturns += t.amount;
          income += t.amount;
          break;
        default:
          if (t.amount > 0) {
            income += t.amount;
          } else {
            expenses += Math.abs(t.amount);
          }
          break;
      }
    });
    
    setMonthlySummary({
      period: new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      income,
      expenses,
      balance: income - expenses,
      currency: data[0]?.currency || 'USD',
      // Add new fields for enhanced summary
      loansReceived,
      investmentsMade,
      loanRepayments,
      investmentReturns
    });
    
    // Animate summary appearance
    if (Platform.OS === 'web') {
      Animated.timing(summaryAnimation, {
        toValue: 1,
        duration: 500,
        useNativeDriver: false
      }).start();
    } else {
      Animated.timing(summaryAnimation, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true
      }).start();
    }
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
      deadline: item.deadline || '',
      transaction_type: item.transaction_type || 'regular',
      interest_rate: item.interest_rate?.toString() || '',
      roi_percentage: item.roi_percentage?.toString() || '',
      lender_name: item.lender_name || '',
      investment_platform: item.investment_platform || '',
      status: item.status || 'active'
    });
    
    // Set the editing flag with the transaction ID
    setEditingTransactionId(item.id);
    
    // Open the modal
    setModalVisible(true);
  };

  // Update the handleAddTransaction function to handle both adding and editing
  const handleAddTransaction = async () => {
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
    
    // Show loading state
    setLoading(true);
    
    try {
      if (editingTransactionId) {
        // We're editing an existing transaction
        const updatedTransactionData = {
          amount: finalAmount,
          currency: newTransaction.currency,
          date: newTransaction.date,
          category: newTransaction.category,
          note: newTransaction.note,
          deadline: newTransaction.category === 'Loan' ? newTransaction.deadline : undefined,
          transaction_type: newTransaction.transaction_type,
          interest_rate: newTransaction.interest_rate ? parseFloat(newTransaction.interest_rate) : undefined,
          roi_percentage: newTransaction.roi_percentage ? parseFloat(newTransaction.roi_percentage) : undefined,
          lender_name: newTransaction.lender_name,
          investment_platform: newTransaction.investment_platform,
          status: newTransaction.status
        };
        
        // Call API to update transaction
        await updateTransaction(editingTransactionId, updatedTransactionData);
        
        // Update local state
        const updatedTransactions = transactions.map(t => 
          t.id === editingTransactionId 
            ? { ...t, ...updatedTransactionData }
            : t
        );
        
        setTransactions(updatedTransactions);
        setEditingTransactionId(null);
        showAlert('Success', 'Transaction updated successfully', 'success');
        
        // Emit event for dashboard update
        eventEmitter.emit('transactionUpdated');
      } else {
        // We're adding a new transaction
        const newTransactionData = {
          amount: finalAmount,
          currency: newTransaction.currency,
          date: newTransaction.date,
          category: newTransaction.category,
          note: newTransaction.note,
          deadline: newTransaction.category === 'Loan' ? newTransaction.deadline : undefined,
          transaction_type: newTransaction.transaction_type,
          interest_rate: newTransaction.interest_rate ? parseFloat(newTransaction.interest_rate) : undefined,
          roi_percentage: newTransaction.roi_percentage ? parseFloat(newTransaction.roi_percentage) : undefined,
          lender_name: newTransaction.lender_name,
          investment_platform: newTransaction.investment_platform,
          status: newTransaction.status
        };
        
        // Call API to create transaction
        const response = await createTransaction(newTransactionData);
        
        if (response?.data?.transaction) {
          // Add the new transaction with the ID from backend
          const createdTransaction = response.data.transaction;
          const updatedTransactions = [createdTransaction, ...transactions]
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            
          setTransactions(updatedTransactions);
          calculateMonthlySummary(updatedTransactions);
          showAlert('Success', 'Transaction added successfully', 'success');
          
          // Emit event for dashboard update
          eventEmitter.emit('transactionAdded');
        }
      }
      
      setModalVisible(false);
      
      // Reset form
      setNewTransaction({
        amount: '',
        currency: 'USD',
        category: 'Other',
        note: '',
        date: new Date().toISOString().split('T')[0],
        isIncome: false,
        deadline: '',
        transaction_type: 'regular' as 'regular' | 'loan' | 'investment',
        interest_rate: '',
        roi_percentage: '',
        lender_name: '',
        investment_platform: '',
        status: 'active' as 'active' | 'repaid' | 'matured' | 'pending'
      });
      
    } catch (error) {
      console.error('Error saving transaction:', error);
      showAlert('Error', 'Failed to save transaction. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };
  

  const getCategoryColor = (categoryName: string): string => {
    const category: Category | undefined = categories.find((c: Category) => c.name === categoryName);
    return category?.color || '#607D8B';
  };
  

  const getCategoryIcon = (categoryName: string): string => {
    const category = categories.find((c: Category) => c.name === categoryName);
    return category?.icon || 'ellipsis-horizontal';
  };
  
  // Update the renderTransactionItem function
  const renderTransactionItem = ({ item }: { item: Transaction }) => (
    <TouchableOpacity 
      style={[styles.transactionItem, { backgroundColor: colors.cardBackground }]}
      onLongPress={() => confirmDeleteTransaction(item)}
    >
      <View style={[styles.transactionLeft, { backgroundColor: 'transparent' }]}>
        <View 
          style={[styles.categoryIcon, { backgroundColor: getTransactionTypeColor(item) }]}
        >
          <Ionicons 
            name={item.transaction_type === 'loan' ? 'cash' as keyof typeof Ionicons.glyphMap :
                  item.transaction_type === 'investment' ? 'trending-up' as keyof typeof Ionicons.glyphMap :
                  getCategoryIcon(item.category) as keyof typeof Ionicons.glyphMap} 
            size={20} 
            color="white" 
          />
        </View>
        <View style={[styles.transactionDetails, { backgroundColor: 'transparent' }]}>
          <Text style={[styles.transactionCategory, { color: colors.text }]}>
            {getTransactionTypeLabel(item)}
          </Text>
          <Text style={[styles.transactionNote, { color: colors.text }]}>
            {item.note || 'No description'}
          </Text>
          
          {/* Enhanced details for loans and investments */}
          {item.transaction_type === 'loan' && (
            <View style={{ backgroundColor: 'transparent' }}>
              <Text style={[styles.transactionDate, { color: colors.text }]}>
                {new Date(item.date).toLocaleDateString()}
                {item.deadline && ` • Due: ${new Date(item.deadline).toLocaleDateString()}`}
              </Text>
              {item.interest_rate && (
                <Text style={[styles.detailText, { color: '#FF9800' }]}>
                  Interest: {item.interest_rate}% • {item.lender_name || 'Unknown lender'}
                </Text>
              )}
            </View>
          )}
          
          {item.transaction_type === 'investment' && (
            <View style={{ backgroundColor: 'transparent' }}>
              <Text style={[styles.transactionDate, { color: colors.text }]}>
                {new Date(item.date).toLocaleDateString()}
              </Text>
              {item.roi_percentage && (
                <Text style={[styles.detailText, { color: '#FF9800' }]}>
                  Expected ROI: {item.roi_percentage}% • {item.investment_platform || 'Platform not specified'}
                </Text>
              )}
            </View>
          )}
          
          {(!item.transaction_type || item.transaction_type === 'regular') && (
            <Text style={[styles.transactionDate, { color: colors.text }]}>
              {new Date(item.date).toLocaleDateString()}
            </Text>
          )}
          
          {/* Show deadline for regular loans */}
          {item.category === 'Loan' && item.deadline && !item.transaction_type && (
            <Text style={[styles.deadlineText, { color: isDeadlineSoon(item.deadline) ? AppColors.danger : '#FF9800' }]}>
              Due: {new Date(item.deadline).toLocaleDateString()}
            </Text>
          )}
        </View>
      </View>
      <View style={{ flexDirection: 'column', alignItems: 'flex-end', backgroundColor: 'transparent' }}>
        <Text 
          style={[
            styles.transactionAmount,
            { color: getTransactionTypeColor(item), backgroundColor: 'transparent' }
          ]}
        >
          {item.amount < 0 ? '-' : '+'}{item.currency} {Math.abs(item.amount).toFixed(2)}
        </Text>
        
        {/* Show status for loans and investments */}
        {(item.transaction_type === 'loan' || item.transaction_type === 'investment') && (
          <Text style={[styles.statusText, { 
            color: item.status === 'active' ? '#FF9800' : 
                   item.status === 'repaid' ? AppColors.primary : 
                   item.status === 'matured' ? AppColors.primary : colors.subText,
            backgroundColor: 'transparent'
          }]}>
            {item.status?.toUpperCase() || 'ACTIVE'}
          </Text>
        )}
        
        {/* Action buttons row */}
        <View style={[styles.actionButtonsRow, { backgroundColor: 'transparent' }]}>
          <TouchableOpacity 
            style={[styles.actionIconButton, { backgroundColor: 'transparent' }]}
            onPress={() => handleEditTransaction(item)}
          >
            <FontAwesome name="pencil" size={16} color={AppColors.primary} />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.actionIconButton, { marginLeft: 10, backgroundColor: 'transparent' }]}
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
              setLoading(true);
              
              // Call API to delete transaction first
              await deleteTransaction(item.id);
              
              // Update local state after successful API call
              const updatedTransactions = transactions.filter(t => t.id !== item.id);
              setTransactions(updatedTransactions);
              calculateMonthlySummary(updatedTransactions);
              
              showAlert('Success', 'Transaction deleted successfully', 'success');
              
              // Emit event for dashboard update
              eventEmitter.emit('transactionDeleted');
            } catch (error) {
              console.error('Error deleting transaction:', error);
              showAlert('Error', 'Failed to delete transaction', 'error');
            } finally {
              setLoading(false);
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

  function calculateLoanDetails(amount: number, interestRate: number, deadline: string): { monthlyPayment: number; totalRepayment: number; } {
    // Calculate number of months from now to deadline
    const now = new Date();
    const end = new Date(deadline);
    let months = (end.getFullYear() - now.getFullYear()) * 12 + (end.getMonth() - now.getMonth());
    // If deadline is in the past or this month, treat as 1 month
    months = Math.max(1, months);

    // Convert annual interest rate to monthly
    const monthlyRate = interestRate / 100 / 12;

    let monthlyPayment: number;
    let totalRepayment: number;

    if (monthlyRate === 0) {
      // No interest
      monthlyPayment = amount / months;
      totalRepayment = amount;
    } else {
      // Standard amortized loan formula
      monthlyPayment = amount * (monthlyRate * Math.pow(1 + monthlyRate, months)) / (Math.pow(1 + monthlyRate, months) - 1);
      totalRepayment = monthlyPayment * months;
    }

    return {
      monthlyPayment: isNaN(monthlyPayment) ? 0 : monthlyPayment,
      totalRepayment: isNaN(totalRepayment) ? 0 : totalRepayment
    };
  }
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar 
        barStyle={isDarkMode ? 'light-content' : 'dark-content'} 
        backgroundColor={isDarkMode ? '#1a1a1a' : AppColors.primary}
      />
      
      {/* Balance Header with transparent backgrounds */}
      <View style={[styles.header, { backgroundColor: AppColors.secondary }]}>
        <View style={[styles.balanceHeaderContainer, { backgroundColor: 'transparent' }]}>
          <Text style={[styles.balanceLabel, { backgroundColor: 'transparent' }]}>Total Balance</Text>
          <Text style={[
            styles.balanceAmount, 
            { 
              color: balance >= 0 ? '#4ade80' : '#f87171',
              backgroundColor: 'transparent' 
            }
          ]}>
            {balance >= 0 ? '+' : ''}{transactions[0]?.currency || 'USD'} {Math.abs(balance).toFixed(2)}
          </Text>
        </View>
        
        {/* Monthly Summary with transparent backgrounds */}
        {monthlySummary && (
          <Animated.View 
            style={[
              styles.monthlySummary, 
              { 
                opacity: summaryAnimation,
                transform: [{ translateY: summaryAnimation.interpolate({
                  inputRange: [0, 1],
                  outputRange: [20, 0]
                })}],
                backgroundColor: 'transparent'
              }
            ]}
          >
            <Text style={[styles.summaryPeriod, { backgroundColor: 'transparent' }]}>
              {monthlySummary.period}
            </Text>
            
            <View style={[styles.summaryRow, { backgroundColor: 'transparent' }]}>
              <View style={[styles.summaryItem, { backgroundColor: 'transparent' }]}>
                <Text style={[styles.summaryLabel, { backgroundColor: 'transparent' }]}>Income</Text>
                <Text style={[styles.summaryValue, { color: '#4ade80', backgroundColor: 'transparent' }]}>
                  +{monthlySummary.currency} {monthlySummary.income.toFixed(2)}
                </Text>
              </View>
              
              <View style={[styles.summaryDivider, { backgroundColor: 'rgba(255,255,255,0.2)' }]} />
              
              <View style={[styles.summaryItem, { backgroundColor: 'transparent' }]}>
                <Text style={[styles.summaryLabel, { backgroundColor: 'transparent' }]}>Expenses</Text>
                <Text style={[styles.summaryValue, { color: '#f87171', backgroundColor: 'transparent' }]}>
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
          
          <View style={[styles.headerActions, { backgroundColor: 'transparent' }]}>
            <TouchableOpacity 
              style={[styles.actionButton, { backgroundColor: 'transparent' }]}
              onPress={() => exportToCSV()}
            >
              <FontAwesome name="file-text-o" size={18} color={AppColors.primary} />
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.actionButton, { backgroundColor: 'transparent' }]}
              onPress={() => exportToPDF()}
            >
              <FontAwesome name="file-pdf-o" size={18} color={AppColors.primary} />
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.actionButton, { backgroundColor: 'transparent' }]}
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
      
      {/* Transaction Modal - MODERNIZED */}
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
            <View style={[styles.modalContent, { 
              backgroundColor: colors.cardBackground,
            }]}>
              {/* Modern Tabs with Pill Design */}
              <View style={[
                styles.modernTabContainer, 
                { backgroundColor: 'transparent' }
              ]}>
                <View style={[
                  styles.modernTabPill, 
                  { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }
                ]}>
                  <Pressable 
                    style={[
                      styles.modernTabButton, 
                      !newTransaction.isIncome && { 
                        backgroundColor: AppColors.danger,
                        borderRadius: 20
                      }
                    ]}
                    onPress={() => setNewTransaction({...newTransaction, isIncome: false})}
                  >
                    <Text style={[
                      styles.modernTabText, 
                      { color: !newTransaction.isIncome ? '#fff' : colors.subText }
                    ]}>
                      Expense
                    </Text>
                  </Pressable>
                  
                  <Pressable 
                    style={[
                      styles.modernTabButton, 
                      newTransaction.isIncome && { 
                        backgroundColor: AppColors.primary,
                        borderRadius: 20
                      }
                    ]}
                    onPress={() => setNewTransaction({...newTransaction, isIncome: true})}
                  >
                    <Text style={[
                      styles.modernTabText, 
                      { color: newTransaction.isIncome ? '#fff' : colors.subText }
                    ]}>
                      Income
                    </Text>
                  </Pressable>
                </View>
              </View>
              
              {/* Modern Amount Input - Fixed border issues */}
              <View style={[
                styles.modernAmountContainer, 
                { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)' }
              ]}>
                <Text style={[
                  styles.modernCurrencySymbol,
                  { color: newTransaction.isIncome ? AppColors.primary : AppColors.danger }
                ]}>
                  $
                </Text>
                <TextInput
                  style={[
                    styles.modernAmountInput,
                    { color: newTransaction.isIncome ? AppColors.primary : AppColors.danger }
                  ]}
                  placeholder="0.00"
                  placeholderTextColor={isDarkMode ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)'}
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
              
              {/* Date & Category Row - Modern styling */}
              <View style={[styles.modernFieldRow, { backgroundColor: 'transparent' }]}>
                <Pressable 
                  style={[styles.modernDateField, { 
                    backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)',
                  }]}
                  onPress={() => openDatePicker('transactionDate')}
                >
                  <FontAwesome name="calendar" size={16} color={colors.text} style={{ marginRight: 8 }} />
                  <Text style={{ color: colors.text }}>
                    {new Date(newTransaction.date).toLocaleDateString()}
                  </Text>
                </Pressable>
                
                <Pressable 
                  style={[styles.modernCategorySelector, { backgroundColor: getCategoryColor(newTransaction.category) }]}
                  onPress={() => setShowCategoriesSelector(true)}
                >
                  <Text style={{ color: '#fff', fontWeight: '500' }}>
                    {newTransaction.category}
                  </Text>
                  <FontAwesome name="chevron-down" size={12} color="#fff" style={{ marginLeft: 5 }} />
                </Pressable>
              </View>
              
              {/* Transaction Type Selector - New Section */}
              {(newTransaction.category === 'Loan' || newTransaction.category === 'Investment') && (
                <View style={{ marginBottom: 20, backgroundColor: 'transparent' }}>
                  <Text style={[styles.modernInputLabel, { color: colors.text }]}>
                    Transaction Type
                  </Text>
                  <View style={[styles.modernTypeSelector, { backgroundColor: 'transparent' }]}>
                    {newTransaction.category === 'Loan' ? (
                      <>
                        <TouchableOpacity
                          style={[
                            styles.modernTypeButton,
                            {
                              backgroundColor: newTransaction.transaction_type === 'loan' 
                                ? '#FF9800' : isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'
                            }
                          ]}
                          onPress={() => setNewTransaction({...newTransaction, transaction_type: 'loan'})}
                        >
                          <Text style={{
                            color: newTransaction.transaction_type === 'loan' ? '#fff' : colors.text,
                            fontWeight: '500'
                          }}>
                            Take Loan
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[
                            styles.modernTypeButton,
                            {
                              backgroundColor: newTransaction.transaction_type === 'loan_repayment' 
                                ? AppColors.danger : isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'
                            }
                          ]}
                          onPress={() => setNewTransaction({...newTransaction, transaction_type: 'loan_repayment'})}
                        >
                          <Text style={{
                            color: newTransaction.transaction_type === 'loan_repayment' ? '#fff' : colors.text,
                            fontWeight: '500'
                          }}>
                            Loan Repayment
                          </Text>
                        </TouchableOpacity>
                      </>
                    ) : (
                      <>
                        <TouchableOpacity
                          style={[
                            styles.modernTypeButton,
                            {
                              backgroundColor: newTransaction.transaction_type === 'investment' 
                                ? '#FF9800' : isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'
                            }
                          ]}
                          onPress={() => setNewTransaction({...newTransaction, transaction_type: 'investment'})}
                        >
                          <Text style={{
                            color: newTransaction.transaction_type === 'investment' ? '#fff' : colors.text,
                            fontWeight: '500'
                          }}>
                            Make Investment
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[
                            styles.modernTypeButton,
                            {
                              backgroundColor: newTransaction.transaction_type === 'investment_return' 
                                ? AppColors.primary : isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'
                            }
                          ]}
                          onPress={() => setNewTransaction({...newTransaction, transaction_type: 'investment_return'})}
                        >
                          <Text style={{
                            color: newTransaction.transaction_type === 'investment_return' ? '#fff' : colors.text,
                            fontWeight: '500'
                          }}>
                            Investment Return
                          </Text>
                        </TouchableOpacity>
                      </>
                    )}
                  </View>
                </View>
              )}

              {/* Loan-specific fields */}
              {(newTransaction.category === 'Loan' && newTransaction.transaction_type === 'loan') && (
                <View style={{ backgroundColor: 'transparent' }}>
                  <Text style={[styles.modernInputLabel, { color: colors.text }]}>
                    Interest Rate (% per year)
                  </Text>
                  <TextInput
                    style={[
                      styles.modernFieldInput,
                      { 
                        backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)',
                        color: colors.text
                      }
                    ]}
                    placeholder="5.0"
                    placeholderTextColor={isDarkMode ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)'}
                    keyboardType="decimal-pad"
                    value={newTransaction.interest_rate}
                    onChangeText={(text) => setNewTransaction({...newTransaction, interest_rate: text})}
                  />
                  
                  <Text style={[styles.modernInputLabel, { color: colors.text }]}>
                    Lender Name (Optional)
                  </Text>
                  <TextInput
                    style={[
                      styles.modernFieldInput,
                      { 
                        backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)',
                        color: colors.text
                      }
                    ]}
                    placeholder="Bank name or person"
                    placeholderTextColor={isDarkMode ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)'}
                    value={newTransaction.lender_name}
                    onChangeText={(text) => setNewTransaction({...newTransaction, lender_name: text})}
                  />
                  
                  {/* Loan calculations preview */}
                  {newTransaction.amount && newTransaction.interest_rate && newTransaction.deadline && (
                    <View style={[styles.calculationPreview, { 
                      backgroundColor: isDarkMode ? 'rgba(255,152,0,0.1)' : 'rgba(255,152,0,0.1)',
                      borderColor: '#FF9800'
                    }]}>
                      <Text style={[styles.calculationTitle, { color: '#FF9800' }]}>Loan Calculation</Text>
                      {(() => {
                        const { monthlyPayment, totalRepayment } = calculateLoanDetails(
                          parseFloat(newTransaction.amount), 
                          parseFloat(newTransaction.interest_rate), 
                          newTransaction.deadline
                        );
                        return (
                          <>
                            <Text style={[styles.calculationText, { color: colors.text }]}>
                              Monthly Payment: ${monthlyPayment.toFixed(2)}
                            </Text>
                            <Text style={[styles.calculationText, { color: colors.text }]}>
                              Total Repayment: ${totalRepayment.toFixed(2)}
                            </Text>
                            <Text style={[styles.calculationText, { color: colors.text }]}>
                              Total Interest: ${(totalRepayment - parseFloat(newTransaction.amount)).toFixed(2)}
                            </Text>
                          </>
                        );
                      })()}
                    </View>
                  )}
                </View>
              )}

              {/* Investment-specific fields */}
              {(newTransaction.category === 'Investment' && newTransaction.transaction_type === 'investment') && (
                <View style={{ backgroundColor: 'transparent' }}>
                  <Text style={[styles.modernInputLabel, { color: colors.text }]}>
                    Expected ROI (% per year)
                  </Text>
                  <TextInput
                    style={[
                      styles.modernFieldInput,
                      { 
                        backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)',
                        color: colors.text
                      }
                    ]}
                    placeholder="12.0"
                    placeholderTextColor={isDarkMode ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)'}
                    keyboardType="decimal-pad"
                    value={newTransaction.roi_percentage}
                    onChangeText={(text) => setNewTransaction({...newTransaction, roi_percentage: text})}
                  />
                  
                  <Text style={[styles.modernInputLabel, { color: colors.text }]}>
                    Investment Platform (Optional)
                  </Text>
                  <TextInput
                    style={[
                      styles.modernFieldInput,
                      { 
                        backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)',
                        color: colors.text
                      }
                    ]}
                    placeholder="Stock exchange, crypto platform, etc."
                    placeholderTextColor={isDarkMode ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)'}
                    value={newTransaction.investment_platform}
                    onChangeText={(text) => setNewTransaction({...newTransaction, investment_platform: text})}
                  />
                  
                  {/* Investment return preview */}
                  {newTransaction.amount && newTransaction.roi_percentage && (
                    <View style={[styles.calculationPreview, { 
                      backgroundColor: isDarkMode ? 'rgba(255,152,0,0.1)' : 'rgba(255,152,0,0.1)',
                      borderColor: '#FF9800'
                    }]}>
                      <Text style={[styles.calculationTitle, { color: '#FF9800' }]}>Investment Projection</Text>
                      <Text style={[styles.calculationText, { color: colors.text }]}>
                        Estimated Annual Return: ${calculateInvestmentReturn(
                          parseFloat(newTransaction.amount), 
                          parseFloat(newTransaction.roi_percentage)
                        ).toFixed(2)}
                      </Text>
                    </View>
                  )}
                </View>
              )}
              
              {/* Deadline Selector for Loans and Investments */}
              {(newTransaction.category === 'Loan' || newTransaction.category === 'Investment') && (
                <View style={{ backgroundColor: 'transparent', marginBottom: 15 }}>
                  <Text style={[styles.modernInputLabel, { color: colors.text }]}>
                    {newTransaction.category === 'Loan' ? 'Loan Deadline' : 'Investment Maturity Date'} (Optional)
                  </Text>
                  <Pressable 
                    style={[styles.modernDateField, { 
                      backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)',
                      marginRight: 0, // Remove right margin since it's full width
                      borderWidth: 1,
                      borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'
                    }]}
                    onPress={() => openDatePicker('loanDeadline')}
                  >
                    <FontAwesome name="calendar" size={16} color={colors.text} style={{ marginRight: 8 }} />
                    <Text style={{ color: colors.text, flex: 1 }}>
                      {newTransaction.deadline 
                        ? new Date(newTransaction.deadline).toLocaleDateString()
                        : `Select ${newTransaction.category === 'Loan' ? 'deadline' : 'maturity date'}...`
                      }
                    </Text>
                    <FontAwesome name="chevron-right" size={12} color={colors.subText} />
                  </Pressable>
                  
                  {/* Clear deadline button */}
                  {newTransaction.deadline && (
                    <TouchableOpacity 
                      style={{
                        alignSelf: 'flex-end',
                        marginTop: 5,
                        paddingVertical: 5,
                        paddingHorizontal: 10
                      }}
                      onPress={() => setNewTransaction({...newTransaction, deadline: ''})}
                    >
                      <Text style={{ color: AppColors.danger, fontSize: 12 }}>Clear Date</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
              
              {/* Note Input - Modern styling */}
              <TextInput
                style={[
                  styles.modernNoteInput,
                  { 
                    backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)', 
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
              
              {/* Action Buttons - Modern styling */}
              <View style={[styles.modernActions, { backgroundColor: 'transparent' }]}>
                <TouchableOpacity 
                  style={[styles.modernCancelButton, { 
                    backgroundColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'
                  }]}
                  onPress={() => setModalVisible(false)}
                >
                  <Text style={{ color: colors.text }}>Cancel</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[
                    styles.modernSaveButton,
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
      
      {/* Categories Selector Modal with 2-column grid */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showCategoriesSelector}
        onRequestClose={() => setShowCategoriesSelector(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modernCategoriesModal, { 
            backgroundColor: colors.cardBackground,
            maxHeight: '80%' // Limit height to prevent extending beyond viewport
          }]}>
            <View style={[
              styles.modernCategHeader,
              {
                backgroundColor: 'transparent',
                borderBottomColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'
              }
            ]}>
              <Text style={[styles.modernCategTitle, { color: colors.text, backgroundColor: 'transparent' }]}>
                Select {newTransaction.isIncome ? 'Income' : 'Expense'} Category
              </Text>
              
              <View style={[styles.modernCategButtons, { backgroundColor: 'transparent' }]}>
                <TouchableOpacity 
                  style={[styles.modernAddCategBtn, { backgroundColor: 'transparent' }]}
                  onPress={() => {
                    // Close both modals
                    setShowCategoriesSelector(false);
                    setModalVisible(false); // Close the transaction modal as well
                    
                    // Then navigate to category management
                    router.push({
                      pathname: '/categoryManagement',
                      params: { 
                        type: newTransaction.isIncome ? 'income' : 'expense',
                        from: 'transaction'
                      }
                    });
                  }}
                >
                  <FontAwesome name="plus" size={16} color={AppColors.primary} />
                  <Text style={{ color: AppColors.primary, marginLeft: 5, backgroundColor: 'transparent' }}>New</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={{ backgroundColor: 'transparent' }}
                  onPress={() => setShowCategoriesSelector(false)}
                >
                  <FontAwesome name="times" size={20} color={colors.text} />
                </TouchableOpacity>
              </View>
            </View>
            
            {/* Changed to FlatList with numColumns={2} for 2-column grid */}
            <FlatList
              data={getAvailableCategories()}
              numColumns={2}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.categoryGridItem, // New style for grid items
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
                    textAlign: 'center',
                    marginTop: 8,
                    backgroundColor: 'transparent'
                  }}>
                    {item.name}
                  </Text>
                  {newTransaction.category === item.name && (
                    <View style={styles.checkIconContainer}>
                      <FontAwesome name="check" size={14} color="#fff" />
                    </View>
                  )}
                </TouchableOpacity>
              )}
              keyExtractor={item => item.name}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.categoriesGridList}
            />
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
    backgroundColor: 'transparent',
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
    backgroundColor: 'transparent',
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: 'transparent',
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
    backgroundColor: 'transparent',
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 2,
    backgroundColor: 'transparent',
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
    backgroundColor: 'transparent',
  },
  actionButton: {
    marginLeft: 15,
    backgroundColor: 'transparent',
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
    backgroundColor: 'transparent',
  },
  actionIconButton: {
    padding: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
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
  modernTabContainer: {
    marginBottom: 25,
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  modernTabPill: {
    flexDirection: 'row',
    borderRadius: 20,
    padding: 4,
    width: '80%',
  },
  modernTabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  modernTabText: {
    fontSize: 15,
    fontWeight: '600',
  },
  modernAmountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 25,
    paddingHorizontal: 20,
    paddingVertical: 5,
    borderRadius: 12,
  },
  modernCurrencySymbol: {
    fontSize: 28,
    fontWeight: '500',
    marginRight: 5,
  },
  modernAmountInput: {
    flex: 1,
    fontSize: 28,
    paddingVertical: 15,
    borderWidth: 0,
    outlineWidth: 0,
    fontWeight: '500',
  },
  modernFieldRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  modernDateField: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    marginRight: 10,
  },
  modernCategorySelector: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
  },
  modernInputLabel: {
    fontSize: 15,
    fontWeight: '500',
    marginBottom: 8,
    marginTop: 8,
    backgroundColor: 'transparent',
  },
  modernNoteInput: {
    padding: 16,
    borderRadius: 12,
    minHeight: 120,
    textAlignVertical: 'top',
    marginBottom: 25,
    borderWidth: 0,
  },
  modernActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: 'transparent',
    marginTop: 5, // Add a little margin to separate from content above
  },
  modernCancelButton: {
    flex: 1,
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
    marginRight: 10,
  },
  modernSaveButton: {
    flex: 1.5,
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
  },
  modernCategoriesModal: {
    width: '90%',
    maxWidth: 400,
    borderRadius: 20,
    padding: 20,
    maxHeight: '80%', // Limit height
  },
  modernCategHeader: { // Added style for the category modal header
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%', // Ensure it spans the modal width
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderBottomWidth: 1, // The borderBottomColor is applied inline in the JSX
    marginBottom: 10, // Space between header and the list of categories
  },
  modernCategTitle: {
    fontSize: 17,
    fontWeight: 'bold',
  },
  modernCategButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modernAddCategBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 15,
    paddingVertical:  6,
    paddingHorizontal: 10,
    borderRadius: 15,
  },
  categoriesGridList: {
    paddingBottom: 20,
    paddingHorizontal: 5,
  },
  categoryGridItem: {
    width: '47%', // Slightly less than 50% to allow for margin
    margin: '1.5%',
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    height: 100,
    position: 'relative', // For positioning the check icon
  },
  checkIconContainer: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.2)',
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modernTypeSelector: {
    flexDirection: 'row',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 15,
  },
  modernTypeButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 2,
    borderRadius: 10,
  },
  modernFieldInput: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 15,
    borderWidth: 0,
  },
  calculationPreview: {
    borderRadius: 12,
    padding: 15,
    marginTop: 10,
    marginBottom: 15,
    borderWidth: 1,
  },
  calculationTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  calculationText: {
    fontSize: 14,
    marginBottom: 4,
  },
  detailText: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  statusText: {
    fontSize: 10,
    fontWeight: 'bold',
    marginTop: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
});

// Update your balance calculation
const calculateEnhancedBalance = (transactions: Transaction[]) => {
  let totalBalance = 0;
  let activeLoans = 0;
  let totalInvestments = 0;
  let projectedReturns = 0;
  
  transactions.forEach(t => {
    switch (t.transaction_type) {
      case 'loan':
        totalBalance += t.amount; // Loans add to balance initially
        activeLoans += t.amount;
        break;
      case 'loan_repayment':
        totalBalance -= t.amount; // Repayments reduce balance
        break;
      case 'investment':
        totalBalance -= t.amount; // Investments reduce balance
        totalInvestments += t.amount;
        if (t.roi_percentage) {
          projectedReturns += calculateInvestmentReturn(t.amount, parseFloat(t.roi_percentage.toString()));
        }
        break;
      case 'investment_return':
        totalBalance += t.amount; // Returns add to balance
        break;
      default:
        totalBalance += t.amount; // Regular transactions
        break;
    }
  });
  
  return {
    totalBalance,
    activeLoans,
    totalInvestments,
    projectedReturns
  };
};

// Helper to get a label for the transaction type or category
function getTransactionTypeLabel(item: Transaction): string {
  switch (item.transaction_type) {
    case 'loan':
      return 'Loan';
    case 'loan_repayment':
      return 'Loan Repayment';
    case 'investment':
      return 'Investment';
    case 'investment_return':
      return 'Investment Return';
    default:
      return item.category || 'Transaction';
  }
}

// getTransactionTypeColor helper function
function getTransactionTypeColor(item: {
  id: string; amount: number; currency: string; date: string; category: string; note?: string; deadline?: string;
  transaction_type?: "regular" | "loan" | "investment" | "loan_repayment" | "investment_return"; interest_rate?: number;
  roi_percentage?: number;
  lender_name?: string;
  investment_platform?: string;
  status?: "active" | "repaid" | "matured" | "pending"; linked_transaction_id?: string;
}): import("react-native").ColorValue | undefined {
  // Use AppColors for consistency
  switch (item.transaction_type) {
    case 'loan':
      return '#FF9800'; // Orange for loans
    case 'loan_repayment':
      return AppColors.danger; // Red for repayments
    case 'investment':
      return '#2196F3'; // Blue for investments
    case 'investment_return':
      return AppColors.primary; // Green for returns
    default:
      // Fallback: positive = income, negative = expense
      return item.amount >= 0 ? AppColors.primary : AppColors.danger;
  }
}
// Calculates the estimated annual return for an investment
function calculateInvestmentReturn(amount: number, roi_percentage: number) {
  // roi_percentage is annual ROI in percent (e.g., 12 for 12%)
  // Simple interest for 1 year: return = amount * (roi_percentage / 100)
  return amount * (roi_percentage / 100);
}

