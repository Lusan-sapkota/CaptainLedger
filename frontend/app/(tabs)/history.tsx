import { useState, useEffect, useCallback, useMemo } from 'react';
import { StyleSheet, SectionList, TouchableOpacity, Modal, Platform, RefreshControl, View as RNView, ActivityIndicator } from 'react-native';
import { Text, View } from '@/components/Themed';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import DateTimePicker from '@react-native-community/datetimepicker';
import { getTransactions, Transaction } from '@/services/api';
import { AppColors } from './_layout';
import { useTheme } from '@/components/ThemeProvider';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useAlert } from '@/components/AlertProvider';
import * as Print from 'expo-print';

export default function HistoryScreen() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exportLoading, setExportLoading] = useState(false);
  const [filterVisible, setFilterVisible] = useState(false);
  const { isDarkMode, colors } = useTheme();
  const { showAlert } = useAlert();
  
  // Date range - default to last year
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  
  const [dateRange, setDateRange] = useState({
    startDate: oneYearAgo.toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });
  
  // Date picker state
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [datePickerMode, setDatePickerMode] = useState<'start' | 'end'>('start');
  
  // Load transactions with date filtering
  const loadTransactions = async (isRefreshing = false) => {
    try {
      if (isRefreshing) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      
      setError(null);
      
      // Add query params for date filtering
      const filters = {
        start_date: dateRange.startDate,
        end_date: dateRange.endDate
      };
      
      const response = await getTransactions(filters);
      setTransactions(response.data.transactions);
    } catch (err) {
      console.error('Error loading transactions:', err);
      setError('Failed to load transactions. Please try again later.');
      
      // Fallback to mock data but filter by date
      const startDate = new Date(dateRange.startDate);
      const endDate = new Date(dateRange.endDate);
      
      setTransactions([
        { id: '1', amount: -25.99, currency: 'USD', date: '2023-10-25', category: 'Food', note: 'Groceries' },
        { id: '2', amount: -12.50, currency: 'USD', date: '2023-10-24', category: 'Transport', note: 'Uber ride' },
        { id: '3', amount: 1500, currency: 'USD', date: '2023-10-22', category: 'Income', note: 'Salary' },
        { id: '4', amount: -35.00, currency: 'USD', date: '2023-10-21', category: 'Entertainment', note: 'Movie tickets' },
        { id: '5', amount: -65.75, currency: 'USD', date: '2023-10-20', category: 'Bills', note: 'Electricity bill' }
      ].filter(t => {
        const transactionDate = new Date(t.date);
        return transactionDate >= startDate && transactionDate <= endDate;
      }));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };
  
  const onRefresh = useCallback(() => {
    loadTransactions(true);
  }, [dateRange]);
  
  useEffect(() => {
    loadTransactions();
  }, [dateRange.startDate, dateRange.endDate]);
  
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
    
    // Convert to array for SectionList
    return Object.entries(groups).map(([title, data]) => ({
      title,
      data: data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
      totalIncome: data.reduce((sum, t) => t.amount > 0 ? sum + t.amount : sum, 0),
      totalExpense: data.reduce((sum, t) => t.amount < 0 ? sum + Math.abs(t.amount) : sum, 0)
    }));
  }, [transactions]);
  
  // Export functions
  const exportToCSV = async () => {
    try {
      setExportLoading(true);
      
      // Format the data for CSV
      const csvHeader = 'Date,Category,Amount,Currency,Note\n';
      const csvContent = transactions.map(t => {
        return `"${t.date}","${t.category}","${t.amount.toFixed(2)}","${t.currency}","${t.note}"`;
      }).join('\n');
      
      const csvString = csvHeader + csvContent;
      const fileName = `transaction_history_${dateRange.startDate}_to_${dateRange.endDate}.csv`;
      
      if (Platform.OS === 'web') {
        // For web platform
        const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = fileName;
        link.click();
      } else {
        // For native platforms
        const filePath = `${FileSystem.documentDirectory}${fileName}`;
        await FileSystem.writeAsStringAsync(filePath, csvString);
        await Sharing.shareAsync(filePath);
      }
      
      showAlert('Export Successful', 'Transactions exported to CSV successfully.');
    } catch (error) {
      console.error('Export error:', error);
      showAlert('Export Failed', 'Could not export transactions to CSV.');
    } finally {
      setExportLoading(false);
    }
  };
  
  const exportToPDF = async () => {
    try {
      setExportLoading(true);
      
      // Generate HTML content for PDF
      const groupedHTML = groupedTransactions.map(group => {
        const transactionsHTML = group.data.map(t => `
          <tr>
            <td>${new Date(t.date).toLocaleDateString()}</td>
            <td>${t.category}</td>
            <td style="color: ${t.amount < 0 ? 'red' : 'green'}">
              ${t.amount < 0 ? '-' : '+'}${t.currency} ${Math.abs(t.amount).toFixed(2)}
            </td>
            <td>${t.note}</td>
          </tr>
        `).join('');
        
        return `
          <div class="month-section">
            <h3>${group.title}</h3>
            <div class="month-summary">
              <p>Income: <span class="income">${group.totalIncome.toFixed(2)}</span></p>
              <p>Expenses: <span class="expense">${group.totalExpense.toFixed(2)}</span></p>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Category</th>
                  <th>Amount</th>
                  <th>Note</th>
                </tr>
              </thead>
              <tbody>
                ${transactionsHTML}
              </tbody>
            </table>
          </div>
        `;
      }).join('');
      
      const html = `
        <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; padding: 20px; }
              h1 { color: #333; }
              h3 { margin-bottom: 10px; color: #555; border-bottom: 1px solid #eee; padding-bottom: 5px; }
              .month-section { margin-bottom: 30px; }
              .month-summary { display: flex; justify-content: space-between; margin-bottom: 10px; }
              .income { color: green; font-weight: bold; }
              .expense { color: red; font-weight: bold; }
              table { width: 100%; border-collapse: collapse; margin-top: 10px; }
              th, td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
              th { background-color: #f2f2f2; }
            </style>
          </head>
          <body>
            <h1>Transaction History</h1>
            <p>Period: ${dateRange.startDate} to ${dateRange.endDate}</p>
            ${groupedHTML}
          </body>
        </html>
      `;
      
      if (Platform.OS === 'web') {
        const blob = new Blob([html], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        window.open(url);
      } else {
        // For native, use expo-print
        const { uri } = await Print.printToFileAsync({ html });
        await Sharing.shareAsync(uri);
      }
      
      showAlert('Export Successful', 'Transactions exported to PDF successfully.');
    } catch (error) {
      console.error('Export error:', error);
      showAlert('Export Failed', 'Could not export transactions to PDF.');
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
              <Text style={[styles.cancelButtonText, { color: colors.text }]}>Cancel</Text>
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
  
  // Render a transaction item in the list
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
          <Text style={[styles.transactionNote, { color: colors.text }]}>{item.note || item.category}</Text>
          <Text style={[styles.transactionCategory, { color: colors.subText }]}>{item.category}</Text>
        </RNView>
        
        <RNView style={{ backgroundColor: 'transparent' }}>
          <Text style={[
            styles.transactionAmount,
            item.amount < 0 ? styles.expenseAmount : styles.incomeAmount
          ]}>
            {item.amount < 0 ? '-' : '+'}{item.currency} {Math.abs(item.amount).toFixed(2)}
          </Text>
        </RNView>
      </View>
    );
  };
  
  // Section header for grouped transactions
  const renderSectionHeader = ({ section }: { section: { title: string, totalIncome: number, totalExpense: number } }) => (
    <View style={[styles.sectionHeader, { backgroundColor: colors.background }]}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>{section.title}</Text>
      
      <RNView style={[styles.sectionSummary, { backgroundColor: 'transparent' }]}>
        <Text style={[styles.summaryText, { color: colors.subText }]}>
          Income: <Text style={styles.incomeAmount}>+${section.totalIncome.toFixed(2)}</Text>
        </Text>
        <Text style={[styles.summaryText, { color: colors.subText }]}>
          Expense: <Text style={styles.expenseAmount}>-${section.totalExpense.toFixed(2)}</Text>
        </Text>
      </RNView>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <RNView style={[styles.filterBar, { backgroundColor: colors.cardBackground }]}>
        <Text style={[styles.filterTitle, { color: colors.text }]}>Transaction History</Text>
        <View style={styles.actionButtons}>
          <TouchableOpacity 
            style={styles.exportButton}
            onPress={exportToCSV}
            disabled={exportLoading || transactions.length === 0}
          >
            <FontAwesome name="file-text-o" size={18} color={AppColors.primary} />
            <Text style={styles.actionButtonText}>CSV</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.exportButton}
            onPress={exportToPDF}
            disabled={exportLoading || transactions.length === 0}
          >
            <FontAwesome name="file-pdf-o" size={18} color={AppColors.primary} />
            <Text style={styles.actionButtonText}>PDF</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.filterButton}
            onPress={() => setFilterVisible(true)}
          >
            <FontAwesome name="filter" size={18} color={AppColors.primary} />
            <Text style={styles.actionButtonText}>Filter</Text>
          </TouchableOpacity>
        </View>
      </RNView>
      
      {/* Render filter modal */}
      {renderFilterModal()}
      
      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={AppColors.primary} />
          <Text style={{ marginTop: 15, color: colors.text }}>Loading transactions...</Text>
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => loadTransactions()}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <SectionList
          sections={groupedTransactions}
          keyExtractor={item => item.id}
          renderItem={renderTransactionItem}
          renderSectionHeader={renderSectionHeader}
          stickySectionHeadersEnabled={true}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl 
              refreshing={refreshing} 
              onRefresh={onRefresh}
              colors={[AppColors.primary]}
              tintColor={isDarkMode ? AppColors.primary : AppColors.secondary}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <FontAwesome name="history" size={50} color={colors.subText} />
              <Text style={[styles.emptyText, { color: colors.text }]}>No transactions found</Text>
              <Text style={[styles.emptySubtext, { color: colors.subText }]}>
                Try adjusting your filter settings or adding new transactions
              </Text>
            </View>
          }
        />
      )}
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
    paddingHorizontal: 15,
    paddingVertical: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    zIndex: 10,
  },
  filterTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 15,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButtonText: {
    marginLeft: 5,
    color: AppColors.primary,
    fontWeight: '500',
  },
  listContent: {
    paddingBottom: 20,
  },
  sectionHeader: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 5,
  },
  sectionSummary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 5,
  },
  summaryText: {
    fontSize: 13,
  },
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  dateCircle: {
    width: 45,
    height: 45,
    borderRadius: 25,
    backgroundColor: AppColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 15,
  },
  dateDay: {
    fontSize: 16,
    fontWeight: 'bold',
    color: AppColors.secondary,
  },
  dateMonth: {
    fontSize: 12,
    color: AppColors.secondary,
  },
  transactionDetails: {
    flex: 1,
    marginRight: 10,
  },
  transactionNote: {
    fontSize: 15,
    fontWeight: '500',
    marginBottom: 3,
  },
  transactionCategory: {
    fontSize: 13,
  },
  transactionAmount: {
    fontSize: 15,
    fontWeight: '600',
  },
  incomeAmount: {
    color: AppColors.primary,
  },
  expenseAmount: {
    color: AppColors.danger,
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
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: AppColors.danger,
    textAlign: 'center',
    marginBottom: 15,
  },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: AppColors.primary,
    borderRadius: 5,
  },
  retryButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    marginTop: 100,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 15,
    marginBottom: 5,
  },
  emptySubtext: {
    textAlign: 'center',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
    borderRadius: 12,
    padding: 20,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  filterLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
  },
  dateRangeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  dateInput: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  dateRangeSeparator: {
    marginHorizontal: 10,
    fontWeight: '500',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 5,
  },
  cancelButton: {
    borderWidth: 1,
    borderColor: 'transparent',
  },
  applyButton: {
    backgroundColor: AppColors.primary,
  },
  applyButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  cancelButtonText: {
    fontWeight: '600',
  },
});