import { useState, useEffect } from 'react';
import { StyleSheet, FlatList, TouchableOpacity, TextInput, Modal, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import { Text, View } from '@/components/Themed';
import { 
  getTransactions, 
  createTransaction, 
  deleteTransaction, 
  Transaction, 
  CreateTransactionPayload 
} from '@/services/api';
import { AppColors } from './_layout';

// Available transaction categories
const CATEGORIES = ['Food', 'Transport', 'Entertainment', 'Bills', 'Shopping', 'Health', 'Income', 'Other'];

export default function TransactionsScreen() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newTransaction, setNewTransaction] = useState<{
    amount: string;
    currency: string;
    category: string;
    note: string;
  }>({
    amount: '',
    currency: 'USD',
    category: 'Other',
    note: ''
  });
  
  // Calculate total balance
  const balance = transactions.reduce((sum, t) => sum + t.amount, 0);

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
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleAddTransaction = async () => {
    if (!newTransaction.amount) return;
    
    try {
      const payload: CreateTransactionPayload = {
        amount: parseFloat(newTransaction.amount),
        currency: newTransaction.currency,
        date: new Date().toISOString().split('T')[0],
        category: newTransaction.category,
        note: newTransaction.note
      };
      
      const response = await createTransaction(payload);
      setTransactions([response.data.transaction, ...transactions]);
      setModalVisible(false);
      setNewTransaction({ amount: '', currency: 'USD', category: 'Other', note: '' });
    } catch (err) {
      console.error('Error adding transaction:', err);
      // Fallback for offline mode - add locally
      const fallbackTransaction: Transaction = {
        id: Date.now().toString(),
        amount: parseFloat(newTransaction.amount),
        currency: newTransaction.currency,
        date: new Date().toISOString().split('T')[0],
        category: newTransaction.category,
        note: newTransaction.note
      };
      
      setTransactions([fallbackTransaction, ...transactions]);
      setModalVisible(false);
      setNewTransaction({ amount: '', currency: 'USD', category: 'Other', note: '' });
    }
  };

  const handleDeleteTransaction = async (id: string) => {
    try {
      await deleteTransaction(id);
      setTransactions(transactions.filter(t => t.id !== id));
    } catch (err) {
      console.error('Error deleting transaction:', err);
      // Fallback - delete locally anyways
      setTransactions(transactions.filter(t => t.id !== id));
    }
  };

  const renderTransactionItem = ({ item }: { item: Transaction }) => (
    <View style={styles.transactionItem}>
      <View style={styles.transactionLeft}>
        <TouchableOpacity 
          onLongPress={() => handleDeleteTransaction(item.id)}
          style={[styles.categoryIcon, { backgroundColor: getCategoryColor(item.category) }]}
        >
          <Text style={styles.categoryIconText}>{item.category[0]}</Text>
        </TouchableOpacity>
        <View style={styles.transactionDetails}>
          <Text style={styles.transactionCategory}>{item.category}</Text>
          <Text style={styles.transactionNote}>{item.note}</Text>
          <Text style={styles.transactionDate}>{item.date}</Text>
        </View>
      </View>
      <Text 
        style={[
          styles.transactionAmount,
          item.amount < 0 ? styles.expense : styles.income
        ]}
      >
        {item.amount < 0 ? '-' : '+'}{item.currency} {Math.abs(item.amount).toFixed(2)}
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header with balance */}
      <View style={styles.header}>
        <Text style={styles.balanceLabel}>Total Balance</Text>
        <Text style={styles.balanceAmount}>
          {balance >= 0 ? '+' : '-'}USD {Math.abs(balance).toFixed(2)}
        </Text>
      </View>
      
      {/* Transactions list */}
      <View style={styles.transactionsContainer}>
        <View style={styles.actionsRow}>
          <Text style={styles.sectionTitle}>Transactions</Text>
          <TouchableOpacity onPress={loadTransactions} style={styles.refreshButton}>
            <FontAwesome name="refresh" size={20} color={AppColors.primary} />
          </TouchableOpacity>
        </View>
        
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={AppColors.primary} />
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={loadTransactions}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={transactions}
            renderItem={renderTransactionItem}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.list}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No transactions found</Text>
              </View>
            }
          />
        )}
      </View>
      
      {/* Add transaction button */}
      <TouchableOpacity 
        style={styles.addButton}
        onPress={() => setModalVisible(true)}
      >
        <FontAwesome name="plus" size={24} color="white" />
      </TouchableOpacity>
      
      {/* Add Transaction Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Transaction</Text>
            
            <Text style={styles.inputLabel}>Amount</Text>
            <View style={styles.amountInputContainer}>
              <TouchableOpacity 
                style={styles.amountTypeButton}
                onPress={() => {
                  if (newTransaction.amount.startsWith('-')) {
                    setNewTransaction({...newTransaction, amount: newTransaction.amount.substring(1)});
                  } else if (newTransaction.amount) {
                    setNewTransaction({...newTransaction, amount: '-' + newTransaction.amount});
                  }
                }}
              >
                <Text style={styles.amountTypeText}>
                  {newTransaction.amount.startsWith('-') ? 'Expense' : 'Income'}
                </Text>
              </TouchableOpacity>
              <TextInput
                style={styles.amountInput}
                placeholder="0.00"
                keyboardType="numeric"
                value={newTransaction.amount.startsWith('-') ? 
                  newTransaction.amount.substring(1) : newTransaction.amount}
                onChangeText={(text) => {
                  const formattedText = text.replace(/[^0-9.]/g, '');
                  setNewTransaction({
                    ...newTransaction, 
                    amount: newTransaction.amount.startsWith('-') ? 
                      '-' + formattedText : formattedText
                  });
                }}
              />
            </View>
            
            <Text style={styles.inputLabel}>Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoriesContainer}>
              {CATEGORIES.map(category => (
                <TouchableOpacity 
                  key={category}
                  style={[
                    styles.categoryChip,
                    newTransaction.category === category && styles.selectedCategoryChip
                  ]}
                  onPress={() => setNewTransaction({...newTransaction, category})}
                >
                  <Text style={[
                    styles.categoryChipText,
                    newTransaction.category === category && styles.selectedCategoryChipText
                  ]}>
                    {category}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            
            <Text style={styles.inputLabel}>Note</Text>
            <TextInput
              style={styles.noteInput}
              placeholder="Add a note"
              value={newTransaction.note}
              onChangeText={(note) => setNewTransaction({...newTransaction, note})}
            />
            
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalButton, styles.saveButton]}
                onPress={handleAddTransaction}
              >
                <Text style={styles.saveButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// Helper function to get color based on category
interface ICategoryColorMap {
  [key: string]: string;
  Food: string;
  Transport: string;
  Entertainment: string;
  Bills: string;
  Shopping: string;
  Health: string;
  Income: string;
  Other: string;
}

function getCategoryColor(category: string): string {
  const colors: ICategoryColorMap = {
    Food: '#FF8C00',
    Transport: '#4682B4',
    Entertainment: '#9370DB',
    Bills: '#CD5C5C',
    Shopping: '#20B2AA',
    Health: '#3CB371',
    Income: AppColors.primary,
    Other: '#778899'
  };
  return colors[category] || colors.Other;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppColors.background,
  },
  header: {
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 20,
    backgroundColor: AppColors.primary,
    alignItems: 'center',
  },
  balanceLabel: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 5,
  },
  balanceAmount: {
    fontSize: 32,
    fontWeight: 'bold',
    color: AppColors.white,
  },
  transactionsContainer: {
    flex: 1,
    paddingTop: 20,
    backgroundColor: AppColors.background,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: AppColors.secondary,
  },
  refreshButton: {
    padding: 5,
  },
  list: {
    padding: 16,
    backgroundColor: AppColors.background,
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
    color: AppColors.lightText,
  },
  transactionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 12,
    backgroundColor: AppColors.white,
    borderRadius: 8,
    marginBottom: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
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
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  categoryIconText: {
    color: AppColors.white,
    fontWeight: 'bold',
    fontSize: 16,
  },
  transactionDetails: {
    justifyContent: 'center',
  },
  transactionCategory: {
    fontSize: 16,
    fontWeight: '500',
    color: AppColors.secondary,
  },
  transactionNote: {
    fontSize: 14,
    color: AppColors.lightText,
    marginTop: 2,
  },
  transactionDate: {
    fontSize: 12,
    color: '#A0A0A0',
    marginTop: 2,
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
  addButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: AppColors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    backgroundColor: AppColors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    color: AppColors.secondary,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '500',
    marginTop: 10,
    marginBottom: 5,
    color: AppColors.secondary,
  },
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  amountTypeButton: {
    backgroundColor: AppColors.background,
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 5,
    marginRight: 10,
  },
  amountTypeText: {
    fontWeight: '500',
    color: AppColors.secondary,
  },
  amountInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    padding: 10,
    fontSize: 18,
  },
  categoriesContainer: {
    flexDirection: 'row',
    marginBottom: 15,
  },
  categoryChip: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    backgroundColor: AppColors.background,
    borderRadius: 20,
    marginRight: 8,
    marginBottom: 8,
  },
  selectedCategoryChip: {
    backgroundColor: AppColors.primary,
  },
  categoryChipText: {
    fontSize: 14,
    color: AppColors.secondary,
  },
  selectedCategoryChipText: {
    color: AppColors.white,
  },
  noteInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    padding: 10,
    fontSize: 16,
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 5,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: AppColors.background,
    marginRight: 10,
  },
  saveButton: {
    backgroundColor: AppColors.primary,
    marginLeft: 10,
  },
  cancelButtonText: {
    fontWeight: '500',
    color: AppColors.secondary,
  },
  saveButtonText: {
    color: AppColors.white,
    fontWeight: '500',
  },
});