import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { StyleSheet, SectionList, TouchableOpacity, Modal, Platform, RefreshControl, View as RNView, ActivityIndicator, FlatList } from 'react-native';
import { Text, View } from '@/components/Themed';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import DateTimePicker from '@react-native-community/datetimepicker';
import { getTransactions, Transaction } from '@/services/api';
import { AppColors } from './_layout';
import { useTheme } from '@/components/ThemeProvider';
import { useCurrency } from '@/components/CurrencyProvider';
import TransactionItem from '@/components/TransactionItem';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useAlert } from '@/components/AlertProvider';
import * as Print from 'expo-print';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Helper function to group transactions by month-year
function groupTransactionsByDate(transactions: Transaction[]) {
  const groups: Record<string, Transaction[]> = {};
  transactions.forEach(transaction => {
    const date = new Date(transaction.date);
    const monthYear = `${date.toLocaleString('default', { month: 'long' })} ${date.getFullYear()}`;
    if (!groups[monthYear]) {
      groups[monthYear] = [];
    }
    groups[monthYear].push(transaction);
  });
  return Object.entries(groups).map(([title, data]) => ({
    title,
    data: data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    totalIncome: data.reduce((sum, t) => t.amount > 0 ? sum + t.amount : sum, 0),
    totalExpense: data.reduce((sum, t) => t.amount < 0 ? sum + Math.abs(t.amount) : sum, 0)
  }));
}

export default function HistoryScreen() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exportLoading, setExportLoading] = useState(false);
  const [filterVisible, setFilterVisible] = useState(false);
  const [pollingEnabled, setPollingEnabled] = useState(false); // Disabled by default for better performance
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { isDarkMode, colors } = useTheme();
  const { showAlert } = useAlert();
  const { primaryCurrency, formatCurrency, convertCurrency } = useCurrency();
  
  // Date range - default to current month
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  
  const [dateRange, setDateRange] = useState({
    startDate: startOfMonth.toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });
  
  // Date picker state
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [datePickerMode, setDatePickerMode] = useState<'start' | 'end'>('start');

  // Calculate filter statistics with currency conversion
  const [filterStats, setFilterStats] = useState({
    totalIncome: 0,
    totalExpense: 0,
    netBalance: 0,
    transactionCount: 0,
    assets: 0,
    liabilities: 0
  });

  // Update filter statistics whenever transactions change
  useEffect(() => {
    const calculateFilterStats = async () => {
      if (transactions.length === 0) {
        setFilterStats({
          totalIncome: 0,
          totalExpense: 0,
          netBalance: 0,
          transactionCount: 0,
          assets: 0,
          liabilities: 0
        });
        return;
      }

      try {
        let totalIncome = 0;
        let totalExpense = 0;
        let investmentsMade = 0;
        let loansGiven = 0;
        let loanRepayments = 0;

        // Convert each transaction amount to primary currency
        for (const t of transactions) {
          try {
            const convertedAmount = t.currency ? 
              await convertCurrency(Math.abs(t.amount), t.currency) : 
              Math.abs(t.amount);

            if (t.amount > 0) {
              totalIncome += convertedAmount;
            } else {
              totalExpense += convertedAmount;
            }

            // Calculate investment and loan totals with conversion
            if (t.transaction_type === 'investment') {
              investmentsMade += convertedAmount;
            } else if (t.transaction_type === 'loan') {
              if (t.amount > 0) {
                loansGiven += convertedAmount;
              }
            } else if (t.transaction_type === 'loan_repayment') {
              loanRepayments += convertedAmount;
            }
          } catch (error) {
            console.error('Error converting transaction currency in filterStats:', error);
            // Fallback to original amount
            const fallbackAmount = Math.abs(t.amount);
            if (t.amount > 0) {
              totalIncome += fallbackAmount;
            } else {
              totalExpense += fallbackAmount;
            }

            if (t.transaction_type === 'investment') {
              investmentsMade += fallbackAmount;
            } else if (t.transaction_type === 'loan' && t.amount > 0) {
              loansGiven += fallbackAmount;
            } else if (t.transaction_type === 'loan_repayment') {
              loanRepayments += fallbackAmount;
            }
          }
        }

        const netBalance = totalIncome - totalExpense;
        const assets = investmentsMade + loansGiven;
        const liabilities = loanRepayments;

        setFilterStats({
          totalIncome,
          totalExpense,
          netBalance,
          transactionCount: transactions.length,
          assets,
          liabilities
        });
      } catch (error) {
        console.error('Error calculating filter statistics:', error);
        // Fallback to basic calculation without conversion
        const totalIncome = transactions.reduce((sum, t) => t.amount > 0 ? sum + t.amount : sum, 0);
        const totalExpense = transactions.reduce((sum, t) => t.amount < 0 ? sum + Math.abs(t.amount) : sum, 0);
        const investmentsMade = transactions
          .filter(t => t.transaction_type === 'investment')
          .reduce((sum, t) => sum + Math.abs(t.amount), 0);
        const loansGiven = transactions
          .filter(t => t.transaction_type === 'loan')
          .reduce((sum, t) => sum + t.amount, 0);
        const loanRepayments = transactions
          .filter(t => t.transaction_type === 'loan_repayment')
          .reduce((sum, t) => sum + Math.abs(t.amount), 0);

        setFilterStats({
          totalIncome,
          totalExpense,
          netBalance: totalIncome - totalExpense,
          transactionCount: transactions.length,
          assets: investmentsMade + loansGiven,
          liabilities: loanRepayments
        });
      }
    };

    calculateFilterStats();
  }, [transactions, convertCurrency]);
  
  // Optimized load transactions with better error handling and caching
  const loadTransactions = useCallback(async (isRefreshing = false) => {
    try {
      if (isRefreshing) {
        setRefreshing(true);
      } else if (!refreshing) {
        setLoading(true);
      }
      
      setError(null);
      
      const filters = {
        start_date: dateRange.startDate,
        end_date: dateRange.endDate
      };
      
      // Use a timeout for faster perceived loading
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Request timeout')), 10000)
      );
      
      const response = await Promise.race([
        getTransactions(filters),
        timeoutPromise
      ]) as any;
      
      if (response?.data?.transactions) {
        const sortedTransactions = [...response.data.transactions]
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        
        setTransactions(sortedTransactions);
        
        // Cache the results
        await AsyncStorage.setItem(
          `transactions_cache_${dateRange.startDate}_${dateRange.endDate}`, 
          JSON.stringify(sortedTransactions)
        );
      }
    } catch (err) {
      console.error('Error loading transactions:', err);
      
      // Try to load from cache first
      try {
        const cachedData = await AsyncStorage.getItem(
          `transactions_cache_${dateRange.startDate}_${dateRange.endDate}`
        );
        if (cachedData) {
          setTransactions(JSON.parse(cachedData));
          showAlert('Info', 'Showing cached data. Pull to refresh for latest.', 'info');
          return;
        }
      } catch (cacheError) {
        console.error('Cache error:', cacheError);
      }
      
      if (err instanceof Error && err.message === 'Request timeout') {
        setError('Request timed out. Please check your connection.');
      } else if (typeof err === 'object' && err !== null && 'response' in err && (err as any).response?.status === 401) {
        setError('Session expired. Please log in again.');
      } else {
        setError('Failed to load transactions. Pull to refresh or try again.');
      }
      
      // Only show sample data in development
      if (__DEV__) {
        const sampleData = [
          { id: '1', amount: -25.99, currency: 'USD', date: '2023-12-25', category: 'Food', note: 'Groceries' },
          { id: '2', amount: -12.50, currency: 'USD', date: '2023-12-24', category: 'Transport', note: 'Uber ride' },
          { id: '3', amount: 1500, currency: 'USD', date: '2023-12-22', category: 'Income', note: 'Salary' },
          { id: '4', amount: -45.00, currency: 'USD', date: '2023-12-20', category: 'Entertainment', note: 'Movie tickets' },
          { id: '5', amount: 200, currency: 'USD', date: '2023-12-18', category: 'Freelance', note: 'Project payment' }
        ];
        setTransactions(sampleData);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [dateRange.startDate, dateRange.endDate]);
  
  const onRefresh = useCallback(() => {
    loadTransactions(true);
  }, [loadTransactions]);
  
  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);
  
  // State for currency-converted grouped transactions
  const [groupedTransactions, setGroupedTransactions] = useState<Array<{
    title: string;
    data: Transaction[];
    totalIncome: number;
    totalExpense: number;
  }>>([]);

  // Effect to convert and group transactions with proper currency conversion
  useEffect(() => {
    const groupAndConvertTransactions = async () => {
      if (transactions.length === 0) {
        setGroupedTransactions([]);
        return;
      }
      
      const groups: Record<string, Transaction[]> = {};
      
      transactions.forEach(transaction => {
        const date = new Date(transaction.date);
        const monthYear = `${date.toLocaleString('default', { month: 'long' })} ${date.getFullYear()}`;
        
        if (!groups[monthYear]) {
          groups[monthYear] = [];
        }
        groups[monthYear].push(transaction);
      });
      
      // Convert all amounts to user's preferred currency before calculating totals
      const convertedGroups = await Promise.all(
        Object.entries(groups).map(async ([title, data]) => {
          try {
            // Convert each transaction amount to preferred currency
            const convertedAmounts = await Promise.all(
              data.map(async (transaction) => {
                try {
                  return await convertCurrency(transaction.amount, transaction.currency || 'USD');
                } catch (error) {
                  console.error('Error converting transaction currency:', error);
                  return transaction.amount; // Fallback to original amount
                }
              })
            );
            
            // Calculate totals using converted amounts
            const totalIncome = convertedAmounts.reduce((sum, amount, index) => 
              amount > 0 ? sum + amount : sum, 0
            );
            const totalExpense = convertedAmounts.reduce((sum, amount, index) => 
              amount < 0 ? sum + Math.abs(amount) : sum, 0
            );
            
            return {
              title,
              data: data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
              totalIncome,
              totalExpense
            };
          } catch (error) {
            console.error('Error processing group:', title, error);
            // Fallback to original calculation without conversion
            return {
              title,
              data: data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
              totalIncome: data.reduce((sum, t) => t.amount > 0 ? sum + t.amount : sum, 0),
              totalExpense: data.reduce((sum, t) => t.amount < 0 ? sum + Math.abs(t.amount) : sum, 0)
            };
          }
        })
      );
      
      // Sort by date descending
      const sortedGroups = convertedGroups.sort((a, b) => {
        const dateA = new Date(a.data[0]?.date || 0);
        const dateB = new Date(b.data[0]?.date || 0);
        return dateB.getTime() - dateA.getTime();
      });
      
      setGroupedTransactions(sortedGroups);
    };

    groupAndConvertTransactions();
  }, [transactions, convertCurrency]);

  // Export functions with dynamic currency
  const exportToCSV = async () => {
    try {
      setExportLoading(true);
      
      const csvHeader = 'Date,Category,Original Amount,Original Currency,Converted Amount,Primary Currency,Note\n';
      
      // Calculate totals for summary
      let totalIncome = 0;
      let totalExpenses = 0;
      
      // Format transaction amounts with currency conversion
      const csvContent = await Promise.all(
        transactions.map(async (t) => {
          try {
            // Convert to primary currency
            const convertedAmount = t.currency ? 
              await convertCurrency(Math.abs(t.amount), t.currency) : 
              Math.abs(t.amount);
            
            // Format converted amount
            const formattedConverted = await formatCurrency(convertedAmount);
            const sign = t.amount < 0 ? '-' : '+';
            
            // Update totals
            if (t.amount > 0) {
              totalIncome += convertedAmount;
            } else {
              totalExpenses += convertedAmount;
            }
            
            return `"${t.date}","${t.category}","${t.amount}","${t.currency || 'USD'}","${sign}${formattedConverted}","${primaryCurrency}","${t.note || ''}"`;
          } catch (error) {
            console.error('Error converting currency for history export:', error);
            // Fallback formatting
            const fallbackAmount = Math.abs(t.amount);
            if (t.amount > 0) {
              totalIncome += fallbackAmount;
            } else {
              totalExpenses += fallbackAmount;
            }
            return `"${t.date}","${t.category}","${t.amount}","${t.currency || 'USD'}","${t.amount}","${t.currency || 'USD'}","${t.note || ''}"`;
          }
        })
      );
      
      // Add summary at the end
      const formattedTotalIncome = await formatCurrency(totalIncome);
      const formattedTotalExpenses = await formatCurrency(totalExpenses);
      const formattedNetBalance = await formatCurrency(totalIncome - totalExpenses);
      
      const csvSummary = `\n"","Summary","","","","",""\n` +
        `"","Total Income","","","${formattedTotalIncome}","${primaryCurrency}",""\n` +
        `"","Total Expenses","","","${formattedTotalExpenses}","${primaryCurrency}",""\n` +
        `"","Net Balance","","","${formattedNetBalance}","${primaryCurrency}",""`;
      
      const csvString = csvHeader + csvContent.join('\n') + csvSummary;
      const fileName = `transaction_history_${dateRange.startDate}_to_${dateRange.endDate}.csv`;
      
      if (Platform.OS === 'web') {
        const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = fileName;
        link.click();
      } else {
        const filePath = `${FileSystem.documentDirectory}${fileName}`;
        await FileSystem.writeAsStringAsync(filePath, csvString);
        await Sharing.shareAsync(filePath);
      }
      
      showAlert('Export Successful', 'Transactions exported to CSV successfully.', 'success');
    } catch (error) {
      console.error('Export error:', error);
      showAlert('Export Failed', 'Could not export transactions to CSV.', 'error');
    } finally {
      setExportLoading(false);
    }
  };

  const exportToPDF = async () => {
    try {
      setExportLoading(true);
      
      // Calculate overall totals with currency conversion
      let totalIncome = 0;
      let totalExpenses = 0;
      
      // Generate HTML content for PDF with dynamic currency
      const groupedHTML = await Promise.all(
        groupedTransactions.map(async (group) => {
          let groupIncome = 0;
          let groupExpenses = 0;
          
          const transactionsHTML = await Promise.all(
            group.data.map(async (t) => {
              try {
                // Convert to primary currency
                const convertedAmount = t.currency ? 
                  await convertCurrency(Math.abs(t.amount), t.currency) : 
                  Math.abs(t.amount);
                
                // Format converted amount
                const formattedAmount = await formatCurrency(convertedAmount);
                const sign = t.amount < 0 ? '-' : '+';
                
                // Update group and total totals
                if (t.amount > 0) {
                  groupIncome += convertedAmount;
                  totalIncome += convertedAmount;
                } else {
                  groupExpenses += convertedAmount;
                  totalExpenses += convertedAmount;
                }
                
                return `
                  <tr>
                    <td>${new Date(t.date).toLocaleDateString()}</td>
                    <td>${t.category}</td>
                    <td style="color: ${t.amount < 0 ? AppColors.danger : AppColors.primary}">
                      ${sign}${formattedAmount}
                    </td>
                    <td>${t.currency || 'USD'} ${Math.abs(t.amount).toFixed(2)}</td>
                    <td>${t.note || '-'}</td>
                  </tr>
                `;
              } catch (error) {
                console.error('Error converting currency for PDF export:', error);
                // Fallback formatting
                const fallbackAmount = Math.abs(t.amount);
                if (t.amount > 0) {
                  groupIncome += fallbackAmount;
                  totalIncome += fallbackAmount;
                } else {
                  groupExpenses += fallbackAmount;
                  totalExpenses += fallbackAmount;
                }
                
                return `
                  <tr>
                    <td>${new Date(t.date).toLocaleDateString()}</td>
                    <td>${t.category}</td>
                    <td style="color: ${t.amount < 0 ? AppColors.danger : AppColors.primary}">
                      ${t.amount < 0 ? '-' : '+'}${t.currency || 'USD'} ${Math.abs(t.amount).toFixed(2)}
                    </td>
                    <td>${t.currency || 'USD'} ${Math.abs(t.amount).toFixed(2)}</td>
                    <td>${t.note || '-'}</td>
                  </tr>
                `;
              }
            })
          );

          try {
            const formattedGroupIncome = await formatCurrency(groupIncome);
            const formattedGroupExpense = await formatCurrency(groupExpenses);

            return `
              <div class="month-section">
                <h3>${group.title}</h3>
                <div class="month-summary">
                  <p>Income: <span class="income">${formattedGroupIncome}</span></p>
                  <p>Expenses: <span class="expense">${formattedGroupExpense}</span></p>
                  <p>Net: <span class="${groupIncome - groupExpenses >= 0 ? 'income' : 'expense'}">${await formatCurrency(groupIncome - groupExpenses)}</span></p>
                </div>
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Category</th>
                      <th>Converted Amount</th>
                      <th>Original Amount</th>
                      <th>Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${transactionsHTML.join('')}
                  </tbody>
                </table>
              </div>
            `;
          } catch (error) {
            console.error('Error formatting group totals:', error);
            // Fallback formatting
            return `
              <div class="month-section">
                <h3>${group.title}</h3>
                <div class="month-summary">
                  <p>Income: <span class="income">${groupIncome.toFixed(2)}</span></p>
                  <p>Expenses: <span class="expense">${groupExpenses.toFixed(2)}</span></p>
                  <p>Net: <span class="${groupIncome - groupExpenses >= 0 ? 'income' : 'expense'}">${(groupIncome - groupExpenses).toFixed(2)}</span></p>
                </div>
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Category</th>
                      <th>Converted Amount</th>
                      <th>Original Amount</th>
                      <th>Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${transactionsHTML.join('')}
                  </tbody>
                </table>
              </div>
            `;
          }
        })
      );
      
      // Format overall totals
      const formattedTotalIncome = await formatCurrency(totalIncome);
      const formattedTotalExpenses = await formatCurrency(totalExpenses);
      const formattedNetBalance = await formatCurrency(totalIncome - totalExpenses);
      const netBalanceClass = (totalIncome - totalExpenses) >= 0 ? 'income' : 'expense';
      
      const html = `
        <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; padding: 20px; }
              h1 { color: #333; text-align: center; }
              h3 { margin-bottom: 10px; color: #555; border-bottom: 1px solid #eee; padding-bottom: 5px; }
              .overall-summary { background-color: #f5f5f5; padding: 15px; margin: 20px 0; border-radius: 5px; }
              .overall-summary h3 { margin-top: 0; color: #2E86AB; }
              .summary-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px; }
              .summary-item { text-align: center; }
              .summary-label { font-weight: bold; color: #666; }
              .summary-value { font-size: 18px; margin-top: 5px; }
              .month-section { margin-bottom: 30px; }
              .month-summary { display: flex; justify-content: space-between; margin-bottom: 10px; }
              .income { color: ${AppColors.primary}; font-weight: bold; }
              .expense { color: ${AppColors.danger}; font-weight: bold; }
              table { width: 100%; border-collapse: collapse; margin-top: 10px; }
              th, td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
              th { background-color: #f2f2f2; }
              .currency-note { font-style: italic; color: #666; margin: 10px 0; }
            </style>
          </head>
          <body>
            <h1>Transaction History Report</h1>
            <p>Period: ${dateRange.startDate} to ${dateRange.endDate}</p>
            <p class="currency-note">All amounts converted to: ${primaryCurrency}</p>
            
            <div class="overall-summary">
              <h3>Overall Summary</h3>
              <div class="summary-grid">
                <div class="summary-item">
                  <div class="summary-label">Total Income</div>
                  <div class="summary-value income">${formattedTotalIncome}</div>
                </div>
                <div class="summary-item">
                  <div class="summary-label">Total Expenses</div>
                  <div class="summary-value expense">${formattedTotalExpenses}</div>
                </div>
                <div class="summary-item">
                  <div class="summary-label">Net Balance</div>
                  <div class="summary-value ${netBalanceClass}">${formattedNetBalance}</div>
                </div>
              </div>
            </div>
            
            ${groupedHTML.join('')}
          </body>
        </html>
      `;
      
      if (Platform.OS === 'web') {
        const blob = new Blob([html], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        window.open(url);
      } else {
        const { uri } = await Print.printToFileAsync({ html });
        await Sharing.shareAsync(uri);
      }
      
      showAlert('Export Successful', 'Transactions exported to PDF successfully.', 'success');
    } catch (error) {
      console.error('Export error:', error);
      showAlert('Export Failed', 'Could not export transactions to PDF.', 'error');
    } finally {
      setExportLoading(false);
    }
  };
  
  // Date picker handlers
  const handleDateSelect = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    
    if (selectedDate) {
      const formattedDate = selectedDate.toISOString().split('T')[0];
      
      if (datePickerMode === 'start') {
        setDateRange(prev => ({
          ...prev,
          startDate: formattedDate
        }));
      } else {
        setDateRange(prev => ({
          ...prev,
          endDate: formattedDate
        }));
      }
    }
  };
  
  const openDatePicker = (mode: 'start' | 'end') => {
    setDatePickerMode(mode);
    setShowDatePicker(true);
  };

  // Filter Modal
  const renderFilterModal = () => (
    <Modal
      animationType="slide"
      transparent={true}
      visible={filterVisible}
      onRequestClose={() => setFilterVisible(false)}
    >
      <View style={[styles.modalContainer, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
        <View style={[styles.modalContent, { backgroundColor: colors.cardBackground }]}>
          <Text style={[styles.modalTitle, { color: colors.text }]}>Filter Transactions</Text>
          
          <Text style={[styles.filterLabel, { color: colors.text }]}>Date Range</Text>
          <View style={styles.dateRangeContainer}>
            <TouchableOpacity 
              style={[styles.dateInput, { 
                backgroundColor: colors.inputBackground,
                borderColor: colors.border,
              }]}
              onPress={() => openDatePicker('start')}
            >
              <Text style={{ color: colors.text }}>{dateRange.startDate}</Text>
              <FontAwesome name="calendar" size={16} color={colors.text} />
            </TouchableOpacity>
            
            <Text style={[styles.dateRangeSeparator, { color: colors.text }]}>to</Text>
            
            <TouchableOpacity 
              style={[styles.dateInput, { 
                backgroundColor: colors.inputBackground,
                borderColor: colors.border,
              }]}
              onPress={() => openDatePicker('end')}
            >
              <Text style={{ color: colors.text }}>{dateRange.endDate}</Text>
              <FontAwesome name="calendar" size={16} color={colors.text} />
            </TouchableOpacity>
          </View>
          
          <View style={[styles.modalButtons, { backgroundColor: 'transparent' }]}>
            <TouchableOpacity 
              style={[styles.modalButton, styles.cancelButton, { backgroundColor: isDarkMode ? colors.inputBackground : AppColors.background }]}
              onPress={() => setFilterVisible(false)}
            >
              <Text style={[styles.dateButtonText, { color: colors.text }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.modalButton, styles.applyButton]}
              onPress={() => {
                setFilterVisible(false);
                loadTransactions();
              }}
            >
              <Text style={styles.applyButtonText}>Apply</Text>
            </TouchableOpacity>
          </View>
          
          {showDatePicker && (Platform.OS === 'ios' || Platform.OS === 'android') && (
            <DateTimePicker
              value={new Date(datePickerMode === 'start' ? dateRange.startDate : dateRange.endDate)}
              mode="date"
              display="default"
              onChange={handleDateSelect}
              maximumDate={new Date()}
            />
          )}
        </View>
      </View>
    </Modal>
  );
  
  // Enhanced transaction item with better performance
  const renderTransactionItem = useCallback(({ item }: { item: Transaction }) => (
    <TransactionItem item={item} />
  ), []);
  
  // Enhanced section header with dynamic currency
  const renderSectionHeader = useCallback(({ section }: { section: { title: string, totalIncome: number, totalExpense: number } }) => (
    <SectionHeaderComponent 
      section={section} 
      colors={colors} 
      isDarkMode={isDarkMode} 
      formatCurrency={formatCurrency}
    />
  ), [colors, isDarkMode, formatCurrency]);

  // Enhanced filter statistics component
  // (removed duplicate renderFilterStats definition)

  // Quick date range buttons with proper background
  const renderQuickFilters = () => (
    <View style={[styles.quickFiltersContainer, { backgroundColor: 'transparent' }]}>
      <TouchableOpacity 
        style={[styles.quickFilterButton, { 
          backgroundColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)', 
          borderColor: AppColors.primary 
        }]}
        onPress={() => {
          const today = new Date();
          const startOfWeek = new Date(today);
          startOfWeek.setDate(today.getDate() - 7);
          setDateRange({
            startDate: startOfWeek.toISOString().split('T')[0],
            endDate: today.toISOString().split('T')[0]
          });
        }}
      >
        <Text style={[styles.quickFilterText, { color: AppColors.primary }]}>Last 7 Days</Text>
      </TouchableOpacity>
      
      <TouchableOpacity 
        style={[styles.quickFilterButton, { 
          backgroundColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)', 
          borderColor: AppColors.primary 
        }]}
        onPress={() => {
          const today = new Date();
          const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
          setDateRange({
            startDate: startOfMonth.toISOString().split('T')[0],
            endDate: today.toISOString().split('T')[0]
          });
        }}
      >
        <Text style={[styles.quickFilterText, { color: AppColors.primary }]}>This Month</Text>
      </TouchableOpacity>
      
      <TouchableOpacity 
        style={[styles.quickFilterButton, { 
          backgroundColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)', 
          borderColor: AppColors.primary 
        }]}
        onPress={() => {
          const today = new Date();
          const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
          const endOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
          setDateRange({
            startDate: lastMonth.toISOString().split('T')[0],
            endDate: endOfLastMonth.toISOString().split('T')[0]
          });
        }}
      >
        <Text style={[styles.quickFilterText, { color: AppColors.primary }]}>Last Month</Text>
      </TouchableOpacity>
    </View>
  );

// Section Header Component with Currency Conversion
const SectionHeaderComponent = ({ section, colors, isDarkMode, formatCurrency }: { 
  section: { title: string, totalIncome: number, totalExpense: number }, 
  colors: any, 
  isDarkMode: boolean,
  formatCurrency: (amount: number) => Promise<string>
}) => {
  const [formattedIncome, setFormattedIncome] = useState(`${section.totalIncome.toFixed(2)}`);
  const [formattedExpense, setFormattedExpense] = useState(`${section.totalExpense.toFixed(2)}`);

  // Format currency values when section data changes
  useEffect(() => {
    const formatValues = async () => {
      try {
        const [incomeFormatted, expenseFormatted] = await Promise.all([
          formatCurrency(section.totalIncome),
          formatCurrency(section.totalExpense)
        ]);
        setFormattedIncome(incomeFormatted);
        setFormattedExpense(expenseFormatted);
      } catch (error) {
        // Fallback to basic formatting
        setFormattedIncome(`${section.totalIncome.toFixed(2)}`);
        setFormattedExpense(`${section.totalExpense.toFixed(2)}`);
      }
    };
    formatValues();
  }, [section.totalIncome, section.totalExpense, formatCurrency]);

  return (
    <View style={[styles.sectionHeader, { backgroundColor: isDarkMode ? colors.cardBackground : AppColors.secondary }]}>
      <Text style={[styles.sectionTitle, { color: isDarkMode ? colors.text : 'white' }]}>
        {section.title}
      </Text>
      
      <View style={styles.sectionSummary}>
        <View style={styles.summaryItem}>
          <FontAwesome name="arrow-up" size={12} color={AppColors.primary} />
          <Text style={[styles.summaryText, { color: AppColors.primary }]}>
            {formattedIncome}
          </Text>
        </View>
        <View style={styles.summaryItem}>
          <FontAwesome name="arrow-down" size={12} color={AppColors.danger} />
          <Text style={[styles.summaryText, { color: AppColors.danger }]}>
            {formattedExpense}
          </Text>
        </View>
      </View>
    </View>
  );
};

// Statistics Component with Currency Conversion
const StatisticsCard = ({ filterStats, colors }: { filterStats: any, colors: any }) => {
  const { formatCurrency } = useCurrency();
  const [formattedStats, setFormattedStats] = useState({
    totalIncome: '',
    totalExpense: '',
    assets: '',
    liabilities: '',
    netBalance: ''
  });

  useEffect(() => {
    const formatStats = async () => {
      try {
        const [income, expense, assets, liabilities, net] = await Promise.all([
          formatCurrency(filterStats.totalIncome),
          formatCurrency(filterStats.totalExpense),
          formatCurrency(filterStats.assets),
          formatCurrency(filterStats.liabilities),
          formatCurrency(Math.abs(filterStats.netBalance))
        ]);

        setFormattedStats({
          totalIncome: income,
          totalExpense: expense,
          assets: assets,
          liabilities: liabilities,
          netBalance: (filterStats.netBalance >= 0 ? '+' : '-') + net
        });
      } catch (error) {
        // Fallback formatting
        setFormattedStats({
          totalIncome: `+${filterStats.totalIncome.toFixed(2)}`,
          totalExpense: `-${filterStats.totalExpense.toFixed(2)}`,
          assets: `+${filterStats.assets.toFixed(2)}`,
          liabilities: `-${filterStats.liabilities.toFixed(2)}`,
          netBalance: `${filterStats.netBalance >= 0 ? '+' : '-'}${Math.abs(filterStats.netBalance).toFixed(2)}`
        });
      }
    };
    formatStats();
  }, [filterStats, formatCurrency]);

  return (
    <View style={[styles.statsContainer, { backgroundColor: colors.cardBackground }]}>
      <View style={styles.statsGrid}>
        <View style={styles.statItem}>
          <View style={[styles.statIcon, { backgroundColor: AppColors.primary + '22' }]}>
            <FontAwesome name="arrow-up" size={20} color={AppColors.primary} />
          </View>
          <Text style={[styles.statLabel, { color: colors.subText }]}>Income</Text>
          <Text style={[styles.statValue, { color: AppColors.primary }]}>
            {formattedStats.totalIncome}
          </Text>
        </View>
        <View style={styles.statItem}>
          <View style={[styles.statIcon, { backgroundColor: AppColors.danger + '22' }]}>
            <FontAwesome name="arrow-down" size={20} color={AppColors.danger} />
          </View>
          <Text style={[styles.statLabel, { color: colors.subText }]}>Expenses</Text>
          <Text style={[styles.statValue, { color: AppColors.danger }]}>
            {formattedStats.totalExpense}
          </Text>
        </View>
        <View style={styles.statItem}>
          <View style={[styles.statIcon, { backgroundColor: AppColors.secondary + '22' }]}>
            <FontAwesome name="line-chart" size={20} color={AppColors.secondary} />
          </View>
          <Text style={[styles.statLabel, { color: colors.subText }]}>Assets</Text>
          <Text style={[styles.statValue, { color: AppColors.info }]}>
            {formattedStats.assets}
          </Text>
        </View>
        <View style={styles.statItem}>
          <View style={[styles.statIcon, { backgroundColor: '#FF9800' + '22' }]}>
            <FontAwesome name="credit-card" size={20} color="#FF9800" />
          </View>
          <Text style={[styles.statLabel, { color: colors.subText }]}>Liabilities</Text>
          <Text style={[styles.statValue, { color: AppColors.warning }]}>
            {formattedStats.liabilities}
          </Text>
        </View>
        <View style={styles.statItem}>
          <View style={[styles.statIcon, { backgroundColor: AppColors.secondary + '22' }]}>
            <FontAwesome name="balance-scale" size={20} color={AppColors.secondary} />
          </View>
          <Text style={[styles.statLabel, { color: colors.subText }]}>Net</Text>
          <Text style={[styles.statValue, { color: filterStats.netBalance >= 0 ? AppColors.primary : AppColors.danger }]}>
            {formattedStats.netBalance}
          </Text>
        </View>
        <View style={styles.statItem}>
          <View style={[styles.statIcon, { backgroundColor: colors.inputBackground }]}>
            <FontAwesome name="list" size={20} color={colors.text} />
          </View>
          <Text style={[styles.statLabel, { color: colors.subText }]}>Transactions</Text>
          <Text style={[styles.statValue, { color: colors.text }]}>
            {filterStats.transactionCount}
          </Text>
        </View>
      </View>
    </View>
  );
};
  const renderFilterStats = () => {
    return <StatisticsCard filterStats={filterStats} colors={colors} />;
  };
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Modern Header */}
      <View style={[styles.modernHeader, { backgroundColor: AppColors.secondary }]}>
        <View style={[styles.headerTop, { backgroundColor: 'transparent' }]}>
          <Text style={[styles.headerTitle, { backgroundColor: 'transparent' }]}>Transaction History</Text>
          <View style={[styles.headerActions, { backgroundColor: 'transparent' }]}>
            <TouchableOpacity 
              style={[styles.headerActionButton, { backgroundColor: 'rgba(255,255,255,0.2)' }]}
              onPress={exportToCSV}
              disabled={exportLoading || transactions.length === 0}
            >
              <FontAwesome name="download" size={16} color="white" />
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.headerActionButton, { backgroundColor: 'rgba(255,255,255,0.2)' }]}
              onPress={exportToPDF}
              disabled={exportLoading || transactions.length === 0}
            >
              <FontAwesome name="file-pdf-o" size={16} color="white" />
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.headerActionButton, { backgroundColor: 'rgba(255,255,255,0.2)' }]}
              onPress={() => setFilterVisible(true)}
            >
              <FontAwesome name="filter" size={16} color="white" />
            </TouchableOpacity>
          </View>
        </View>
        
        {/* Date Range Selector */}
        <View style={[styles.dateRangeSelector, { backgroundColor: 'transparent' }]}>
          <TouchableOpacity 
            style={[styles.dateButton, { backgroundColor: 'rgba(255,255,255,0.2)' }]}
            onPress={() => openDatePicker('start')}
          >
            <FontAwesome name="calendar" size={14} color="white" style={{ marginRight: 8 }} />
            <Text style={[styles.dateButtonText, { backgroundColor: 'transparent' }]}>{dateRange.startDate}</Text>
          </TouchableOpacity>
          <FontAwesome name="arrow-right" size={14} color="white" />
          <TouchableOpacity 
            style={[styles.dateButton, { backgroundColor: 'rgba(255,255,255,0.2)' }]}
            onPress={() => openDatePicker('end')}
          >
            <Text style={[styles.dateButtonText, { backgroundColor: 'transparent' }]}>{dateRange.endDate}</Text>
            <FontAwesome name="calendar" size={14} color="white" style={{ marginLeft: 8 }} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Quick Filters */}
      {renderQuickFilters()}
      
      {/* Filter Statistics */}
      {transactions.length > 0 && renderFilterStats()}
      
      {loading && !refreshing ? (
        <View style={[styles.loadingContainer, { backgroundColor: 'transparent' }]}>
          <ActivityIndicator size="large" color={AppColors.primary} />
          <Text style={[styles.loadingText, { color: colors.text, backgroundColor: 'transparent' }]}>Loading transactions...</Text>
        </View>
      ) : error ? (
        <View style={[styles.errorContainer, { backgroundColor: 'transparent' }]}>
          <FontAwesome name="exclamation-triangle" size={50} color={AppColors.danger} />
          <Text style={[styles.errorText, { color: AppColors.danger, backgroundColor: 'transparent' }]}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => loadTransactions()}>
            <Text style={[styles.retryButtonText, { backgroundColor: 'transparent' }]}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <SectionList
          sections={groupedTransactions}
          keyExtractor={(item) => item.id}
          renderItem={renderTransactionItem}
          renderSectionHeader={renderSectionHeader}
          stickySectionHeadersEnabled={true}
          contentContainerStyle={[styles.listContent, { backgroundColor: 'transparent' }]}
          style={{ backgroundColor: 'transparent' }}
          refreshControl={
            <RefreshControl 
              refreshing={refreshing} 
              onRefresh={onRefresh}
              colors={[AppColors.primary]}
              tintColor={AppColors.primary}
            />
          }
          ListEmptyComponent={
            <View style={[styles.emptyContainer, { backgroundColor: 'transparent' }]}>
              <FontAwesome name="history" size={60} color={colors.subText} style={{ opacity: 0.5 }} />
              <Text style={[styles.emptyText, { color: colors.text, backgroundColor: 'transparent' }]}>No transactions found</Text>
              <Text style={[styles.emptySubtext, { color: colors.subText, backgroundColor: 'transparent' }]}>
                Try adjusting your date range or add some transactions
              </Text>
            </View>
          }
          removeClippedSubviews={true}
          maxToRenderPerBatch={10}
          windowSize={10}
          initialNumToRender={20}
        />
      )}

      {/* Filter Modal */}
      {renderFilterModal()}

      {/* Date Picker Modal */}
      {showDatePicker && (
        <Modal
          animationType="fade"
          transparent={true}
          visible={showDatePicker}
          onRequestClose={() => setShowDatePicker(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.datePickerModal, { backgroundColor: colors.cardBackground }]}>
              <View style={[styles.modalHeader, { backgroundColor: 'transparent' }]}>
                <Text style={[styles.modalTitle, { color: colors.text, backgroundColor: 'transparent' }]}>
                  Select {datePickerMode === 'start' ? 'Start' : 'End'} Date
                </Text>
                <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                  <FontAwesome name="times" size={20} color={colors.text} />
                </TouchableOpacity>
              </View>
              
              {Platform.OS === 'web' ? (
                <input
                  type="date"
                  value={datePickerMode === 'start' ? dateRange.startDate : dateRange.endDate}
                  onChange={(e) => {
                    const selectedDate = e.target.value;
                    if (datePickerMode === 'start') {
                      setDateRange(prev => ({ ...prev, startDate: selectedDate }));
                    } else {
                      setDateRange(prev => ({ ...prev, endDate: selectedDate }));
                    }
                    setShowDatePicker(false);
                  }}
                  max={new Date().toISOString().split('T')[0]}
                  style={{
                    width: '100%',
                    padding: 12,
                    fontSize: 16,
                    borderRadius: 8,
                    marginTop: 20,
                    marginBottom: 20,
                    borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                    borderWidth: 1,
                    backgroundColor: colors.inputBackground,
                    color: colors.text
                  }}
                />
              ) : (
                <DateTimePicker
                  value={new Date(datePickerMode === 'start' ? dateRange.startDate : dateRange.endDate)}
                  mode="date"
                  display="default"
                  onChange={handleDateSelect}
                  maximumDate={new Date()}
                />
              )}
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  modalContent: {
    width: '90%',
    maxWidth: 400,
    borderRadius: 15,
    padding: 20,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    alignSelf: 'center',
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 10,
    marginBottom: 4,
  },
  dateRangeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginVertical: 10,
  },
  dateInput: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    minWidth: 120,
    justifyContent: 'space-between',
    gap: 8,
  },
  dateRangeSeparator: {
    marginHorizontal: 8,
    fontSize: 16,
    fontWeight: '600',
    alignSelf: 'center',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 20,
    gap: 10,
    backgroundColor: 'transparent',
  },
  modalButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 80,
  },
  cancelButton: {
    // Optional: add any specific styles for cancel button if needed
  },
  applyButton: {
    backgroundColor: AppColors.primary,
  },
  modernHeader: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingBottom: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 10,
  },
  headerActionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateRangeSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 15,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 20,
  },
  dateButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  quickFiltersContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 15,
    gap: 10,
  },
  quickFilterButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
  },
  quickFilterText: {
    fontSize: 12,
    fontWeight: '600',
  },
  statsContainer: {
    marginHorizontal: 20,
    marginVertical: 10,
    borderRadius: 15,
    padding: 15,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 15,
    backgroundColor: 'transparent',
  },
  statItem: {
    flex: 1,
    minWidth: '30%',
    alignItems: 'center',
    paddingVertical: 10,
    backgroundColor: 'transparent',
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  listContent: {
    paddingBottom: 20,
  },
  sectionHeader: {
    padding: 15,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  sectionSummary: {
    flexDirection: 'row',
    gap: 15,
    backgroundColor: 'transparent',
  },
  summaryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'transparent',
  },
  summaryText: {
    fontSize: 13,
    fontWeight: '600',
  },
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    marginHorizontal: 20,
    marginVertical: 2,
    borderRadius: 12,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  transactionIconContainer: {
    width: 45,
    height: 45,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 15,
  },
  transactionDetails: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  transactionNote: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  transactionCategory: {
    fontSize: 13,
  },
  transactionAmountContainer: {
    alignItems: 'flex-end',
    backgroundColor: 'transparent',
  },
  transactionAmount: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 15,
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    gap: 20,
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  retryButton: {
    paddingHorizontal: 30,
    paddingVertical: 12,
    backgroundColor: AppColors.primary,
    borderRadius: 25,
  },
  retryButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    marginTop: 100,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 20,
    marginBottom: 10,
  },
  emptySubtext: {
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  datePickerModal: {
    width: '90%',
    maxWidth: 400,
    borderRadius: 15,
    padding: 20,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  applyButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
});