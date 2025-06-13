import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  Platform,
  RefreshControl,
  View as RNView,
  ActivityIndicator,
} from 'react-native';
import { Text, View } from '@/components/Themed';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

// Local components
import { useAlert } from '@/components/AlertProvider';
import { useTheme } from '@/components/ThemeProvider';

// Services & API
import {
  getLoans,
  createLoan,
  updateLoan,
  deleteLoan,
  Loan
} from '@/services/api';
import { AppColors } from '@/app/(tabs)/_layout';

export default function LoansScreen() {
  const { isDarkMode, colors } = useTheme();
  const { showAlert } = useAlert();
  
  // States
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'all' | 'outstanding' | 'paid'>('all');
  const [filterType, setFilterType] = useState<'all' | 'given' | 'taken'>('all');
  
  // Modal states
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);
  
  // Form states
  const [newLoan, setNewLoan] = useState({
    loan_type: 'taken' as 'given' | 'taken',
    amount: '',
    currency: 'USD',
    contact: '',
    status: 'outstanding' as 'outstanding' | 'paid',
    date: new Date().toISOString().split('T')[0],
    deadline: '',
    interest_rate: '',
  });
  
  // Date picker states
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [datePickerMode, setDatePickerMode] = useState<'date' | 'deadline'>('date');
  
  const [editingLoanId, setEditingLoanId] = useState<string | null>(null);

  useEffect(() => {
    loadLoans();
  }, [filterStatus, filterType]);

  const loadLoans = async (isRefreshing = false) => {
    if (isRefreshing) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    
    try {
      const params: any = {};
      if (filterStatus !== 'all') params.status = filterStatus;
      if (filterType !== 'all') params.loan_type = filterType;
      
      const response = await getLoans(params);
      if (response?.data?.loans) {
        setLoans(response.data.loans);
      }
    } catch (err) {
      console.error('Error loading loans:', err);
      showAlert('Error', 'Failed to load loans', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleAddLoan = async () => {
    if (!newLoan.amount || !newLoan.contact) {
      showAlert('Invalid Input', 'Please enter amount and contact', 'error');
      return;
    }

    try {
      setLoading(true);
      
      const loanData = {
        ...newLoan,
        amount: parseFloat(newLoan.amount),
        interest_rate: newLoan.interest_rate ? parseFloat(newLoan.interest_rate) : undefined
      };

      if (editingLoanId) {
        await updateLoan(editingLoanId, loanData);
        showAlert('Success', 'Loan updated successfully', 'success');
      } else {
        await createLoan(loanData);
        showAlert('Success', 'Loan added successfully', 'success');
      }

      setModalVisible(false);
      resetForm();
      loadLoans();
    } catch (error) {
      console.error('Error saving loan:', error);
      showAlert('Error', 'Failed to save loan', 'error');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setNewLoan({
      loan_type: 'taken',
      amount: '',
      currency: 'USD',
      contact: '',
      status: 'outstanding',
      date: new Date().toISOString().split('T')[0],
      deadline: '',
      interest_rate: '',
    });
    setEditingLoanId(null);
  };

  const handleEditLoan = (loan: Loan) => {
    setNewLoan({
      loan_type: loan.loan_type,
      amount: loan.amount.toString(),
      currency: loan.currency,
      contact: loan.contact || '',
      status: loan.status === 'overdue' ? 'outstanding' : loan.status,
      date: loan.date,
      deadline: loan.deadline || '',
      interest_rate: loan.interest_rate?.toString() || '',
    });
    setEditingLoanId(loan.id);
    setModalVisible(true);
  };

  const confirmDeleteLoan = (loan: Loan) => {
    Alert.alert(
      'Delete Loan',
      'Are you sure you want to delete this loan?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive', 
          onPress: async () => {
            try {
              await deleteLoan(loan.id);
              showAlert('Success', 'Loan deleted successfully', 'success');
              loadLoans();
            } catch (error) {
              showAlert('Error', 'Failed to delete loan', 'error');
            }
          }
        }
      ]
    );
  };

  const markAsPaid = async (loan: Loan) => {
    try {
      await updateLoan(loan.id, { status: 'paid' });
      showAlert('Success', 'Loan marked as paid', 'success');
      loadLoans();
    } catch (error) {
      showAlert('Error', 'Failed to update loan status', 'error');
    }
  };

  const handleDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    
    if (selectedDate) {
      const formattedDate = selectedDate.toISOString().split('T')[0];
      
      if (datePickerMode === 'date') {
        setNewLoan({...newLoan, date: formattedDate});
      } else if (datePickerMode === 'deadline') {
        setNewLoan({...newLoan, deadline: formattedDate});
      }
    }
  };

  const getDaysRemaining = (deadline: string): number => {
    const deadlineDate = new Date(deadline);
    const now = new Date();
    return Math.ceil((deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  };

  const renderSummaryCard = () => {
    const outstandingLoans = loans.filter(l => l.status === 'outstanding');
    const loansGiven = outstandingLoans.filter(l => l.loan_type === 'given');
    const loansTaken = outstandingLoans.filter(l => l.loan_type === 'taken');
    
    const totalGiven = loansGiven.reduce((sum, l) => sum + l.amount, 0);
    const totalTaken = loansTaken.reduce((sum, l) => sum + l.amount, 0);
    const netPosition = totalGiven - totalTaken;

    return (
      <View style={[styles.summaryCard, { backgroundColor: colors.cardBackground }]}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>Loans Overview</Text>
        
        <View style={[styles.summaryGrid, { backgroundColor: 'transparent' }]}>
          <View style={[styles.summaryItem, { backgroundColor: 'transparent' }]}>
            <Text style={[styles.summaryLabel, { color: colors.subText }]}>Loans Given</Text>
            <Text style={[styles.summaryValue, { color: AppColors.primary }]}>
              ${totalGiven.toFixed(2)}
            </Text>
            <Text style={[styles.summaryCount, { color: colors.subText }]}>
              {loansGiven.length} loans
            </Text>
          </View>
          
          <View style={[styles.summaryItem, { backgroundColor: 'transparent' }]}>
            <Text style={[styles.summaryLabel, { color: colors.subText }]}>Loans Taken</Text>
            <Text style={[styles.summaryValue, { color: AppColors.danger }]}>
              ${totalTaken.toFixed(2)}
            </Text>
            <Text style={[styles.summaryCount, { color: colors.subText }]}>
              {loansTaken.length} loans
            </Text>
          </View>
          
          <View style={[styles.summaryItem, { backgroundColor: 'transparent' }]}>
            <Text style={[styles.summaryLabel, { color: colors.subText }]}>Net Position</Text>
            <Text style={[styles.summaryValue, { 
              color: netPosition >= 0 ? AppColors.primary : AppColors.danger 
            }]}>
              {netPosition >= 0 ? '+' : ''}${netPosition.toFixed(2)}
            </Text>
            <Text style={[styles.summaryCount, { color: colors.subText }]}>
              {netPosition >= 0 ? 'You are owed' : 'You owe'}
            </Text>
          </View>
          
          <View style={[styles.summaryItem, { backgroundColor: 'transparent' }]}>
            <Text style={[styles.summaryLabel, { color: colors.subText }]}>Total Loans</Text>
            <Text style={[styles.summaryValue, { color: colors.text }]}>
              {loans.length}
            </Text>
            <Text style={[styles.summaryCount, { color: colors.subText }]}>
              {outstandingLoans.length} active
            </Text>
          </View>
        </View>
      </View>
    );
  };

  const renderFilterTabs = () => (
    <View style={[styles.filterContainer, { backgroundColor: 'transparent' }]}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={[styles.filterTabs, { backgroundColor: 'transparent' }]}>
          {/* Status Filters */}
          {['all', 'outstanding', 'paid'].map((status) => (
            <TouchableOpacity
              key={status}
              style={[
                styles.filterTab,
                {
                  backgroundColor: filterStatus === status 
                    ? AppColors.primary 
                    : (isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)')
                }
              ]}
              onPress={() => setFilterStatus(status as any)}
            >
              <Text style={{
                color: filterStatus === status ? 'white' : colors.text,
                fontSize: 12,
                textTransform: 'capitalize'
              }}>
                {status}
              </Text>
            </TouchableOpacity>
          ))}
          
          {/* Type Filters */}
          {['given', 'taken'].map((type) => (
            <TouchableOpacity
              key={type}
              style={[
                styles.filterTab,
                {
                  backgroundColor: filterType === type 
                    ? AppColors.secondary 
                    : (isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)')
                }
              ]}
              onPress={() => setFilterType(type as any)}
            >
              <Text style={{
                color: filterType === type ? 'white' : colors.text,
                fontSize: 12,
                textTransform: 'capitalize'
              }}>
                {type}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );

  const renderLoanItem = (item: Loan) => {
    const isOverdue = item.deadline && new Date(item.deadline) < new Date() && item.status === 'outstanding';
    const daysRemaining = item.deadline ? getDaysRemaining(item.deadline) : null;
    
    return (
      <TouchableOpacity 
        key={item.id}
        style={[styles.loanItem, { 
          backgroundColor: colors.cardBackground,
          borderLeftWidth: 4,
          borderLeftColor: item.loan_type === 'given' ? AppColors.primary : AppColors.danger
        }]}
        onLongPress={() => confirmDeleteLoan(item)}
      >
        <View style={[styles.loanHeader, { backgroundColor: 'transparent' }]}>
          <View style={[styles.loanLeft, { backgroundColor: 'transparent' }]}>
            <View style={[styles.loanIcon, { 
              backgroundColor: item.loan_type === 'given' ? AppColors.primary : AppColors.danger 
            }]}>
              <FontAwesome 
                name={item.loan_type === 'given' ? 'arrow-up' : 'arrow-down'} 
                size={16} 
                color="white" 
              />
            </View>
            
            <View style={[styles.loanDetails, { backgroundColor: 'transparent' }]}>
              <Text style={[styles.loanContact, { color: colors.text }]}>
                {item.contact}
              </Text>
              <Text style={[styles.loanType, { 
                color: item.loan_type === 'given' ? AppColors.primary : AppColors.danger 
              }]}>
                {item.loan_type === 'given' ? 'Money Lent' : 'Money Borrowed'}
              </Text>
              <Text style={[styles.loanDate, { color: colors.subText }]}>
                {new Date(item.date).toLocaleDateString()}
              </Text>
            </View>
          </View>
          
          <View style={[styles.loanRight, { backgroundColor: 'transparent' }]}>
            <Text style={[styles.loanAmount, { color: colors.text }]}>
              ${item.amount.toFixed(2)}
            </Text>
            
            <View style={[styles.statusBadge, { 
              backgroundColor: item.status === 'outstanding' 
                ? (isOverdue ? AppColors.danger : '#FF9800')
                : AppColors.primary
            }]}>
              <Text style={styles.statusText}>
                {isOverdue ? 'OVERDUE' : item.status.toUpperCase()}
              </Text>
            </View>
            
            {item.deadline && item.status === 'outstanding' && (
              <Text style={[styles.deadline, { 
                color: isOverdue ? AppColors.danger : colors.subText 
              }]}>
                {isOverdue 
                  ? `${Math.abs(daysRemaining!)} days overdue`
                  : `${daysRemaining} days left`
                }
              </Text>
            )}
          </View>
        </View>
        
        {/* Quick Actions */}
        <View style={[styles.quickActions, { backgroundColor: 'transparent' }]}>
          <TouchableOpacity 
            style={[styles.quickActionButton, { backgroundColor: 'transparent' }]}
            onPress={() => handleEditLoan(item)}
          >
            <FontAwesome name="pencil" size={14} color={AppColors.secondary} />
            <Text style={[styles.quickActionText, { color: AppColors.secondary }]}>Edit</Text>
          </TouchableOpacity>
          
          {item.status === 'outstanding' && (
            <TouchableOpacity 
              style={[styles.quickActionButton, { backgroundColor: 'transparent' }]}
              onPress={() => markAsPaid(item)}
            >
              <FontAwesome name="check" size={14} color={AppColors.primary} />
              <Text style={[styles.quickActionText, { color: AppColors.primary }]}>Mark Paid</Text>
            </TouchableOpacity>
          )}
          
          <TouchableOpacity 
            style={[styles.quickActionButton, { backgroundColor: 'transparent' }]}
            onPress={() => confirmDeleteLoan(item)}
          >
            <FontAwesome name="trash" size={14} color={AppColors.danger} />
            <Text style={[styles.quickActionText, { color: AppColors.danger }]}>Delete</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  const onRefresh = useCallback(() => {
    loadLoans(true);
  }, []);

  // Apply filters
  const filteredLoans = loans.filter(loan => {
    if (filterStatus !== 'all' && loan.status !== filterStatus) return false;
    if (filterType !== 'all' && loan.loan_type !== filterType) return false;
    return true;
  });

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={AppColors.primary} />
          <Text style={[styles.loadingText, { color: colors.text }]}>Loading loans...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={isDarkMode ? 'light' : 'dark'} />
      
      <ScrollView 
        style={styles.scrollView}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh}
            colors={[AppColors.primary]}
            tintColor={AppColors.primary}
          />
        }
      >
        {/* Summary Card */}
        {renderSummaryCard()}
        
        {/* Filter Tabs */}
        {renderFilterTabs()}
        
        {/* Loans List */}
        <View style={[styles.loansList, { backgroundColor: 'transparent' }]}>
          {filteredLoans.length > 0 ? (
            filteredLoans.map((loan) => renderLoanItem(loan))
          ) : (
            <View style={styles.emptyContainer}>
              <FontAwesome name="money" size={60} color={colors.subText} style={{ opacity: 0.5 }} />
              <Text style={[styles.emptyText, { color: colors.text }]}>No loans found</Text>
              <Text style={[styles.emptySubtext, { color: colors.subText }]}>
                Start tracking loans to manage your finances better
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Floating Action Button */}
      <TouchableOpacity 
        style={[styles.fab, { backgroundColor: AppColors.primary }]}
        onPress={() => setModalVisible(true)}
      >
        <FontAwesome name="plus" size={24} color="white" />
      </TouchableOpacity>

      {/* Add/Edit Loan Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.cardBackground }]}>
            <View style={[styles.modalHeader, { backgroundColor: 'transparent' }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {editingLoanId ? 'Edit Loan' : 'Add Loan'}
              </Text>
              <TouchableOpacity onPress={() => {
                setModalVisible(false);
                resetForm();
              }}>
                <FontAwesome name="times" size={20} color={colors.text} />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.modalScroll}>
              {/* Loan Type */}
              <Text style={[styles.inputLabel, { color: colors.text }]}>Loan Type *</Text>
              <View style={[styles.typeSelector, { backgroundColor: 'transparent' }]}>
                <TouchableOpacity
                  style={[
                    styles.typeButton,
                    {
                      backgroundColor: newLoan.loan_type === 'given' 
                        ? AppColors.primary 
                        : (isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)')
                    }
                  ]}
                  onPress={() => setNewLoan({...newLoan, loan_type: 'given'})}
                >
                  <Text style={{
                    color: newLoan.loan_type === 'given' ? 'white' : colors.text,
                    fontSize: 14,
                    fontWeight: '500'
                  }}>
                    Money Lent
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[
                    styles.typeButton,
                    {
                      backgroundColor: newLoan.loan_type === 'taken' 
                        ? AppColors.danger 
                        : (isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)')
                    }
                  ]}
                  onPress={() => setNewLoan({...newLoan, loan_type: 'taken'})}
                >
                  <Text style={{
                    color: newLoan.loan_type === 'taken' ? 'white' : colors.text,
                    fontSize: 14,
                    fontWeight: '500'
                  }}>
                    Money Borrowed
                  </Text>
                </TouchableOpacity>
              </View>
              
              {/* Contact */}
              <Text style={[styles.inputLabel, { color: colors.text }]}>Contact *</Text>
              <TextInput
                style={[styles.input, { 
                  backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)',
                  color: colors.text 
                }]}
                placeholder="Contact name or description"
                placeholderTextColor={colors.subText}
                value={newLoan.contact}
                onChangeText={(text) => setNewLoan({...newLoan, contact: text})}
              />
              
              {/* Amount */}
              <Text style={[styles.inputLabel, { color: colors.text }]}>Amount *</Text>
              <TextInput
                style={[styles.input, { 
                  backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)',
                  color: colors.text 
                }]}
                placeholder="1000"
                placeholderTextColor={colors.subText}
                keyboardType="decimal-pad"
                value={newLoan.amount}
                onChangeText={(text) => setNewLoan({...newLoan, amount: text})}
              />
              
              {/* Interest Rate */}
              <Text style={[styles.inputLabel, { color: colors.text }]}>Interest Rate (% per year)</Text>
              <TextInput
                style={[styles.input, { 
                  backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)',
                  color: colors.text 
                }]}
                placeholder="5.5"
                placeholderTextColor={colors.subText}
                keyboardType="decimal-pad"
                value={newLoan.interest_rate}
                onChangeText={(text) => setNewLoan({...newLoan, interest_rate: text})}
              />
              
              {/* Date */}
              <Text style={[styles.inputLabel, { color: colors.text }]}>Date</Text>
              <TouchableOpacity 
                style={[styles.dateField, { 
                  backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)'
                }]}
                onPress={() => {
                  setDatePickerMode('date');
                  setShowDatePicker(true);
                }}
              >
                <FontAwesome name="calendar" size={16} color={colors.text} />
                <Text style={[styles.dateText, { color: colors.text }]}>
                  {new Date(newLoan.date).toLocaleDateString()}
                </Text>
              </TouchableOpacity>
              
              {/* Deadline */}
              <Text style={[styles.inputLabel, { color: colors.text }]}>Deadline (Optional)</Text>
              <TouchableOpacity 
                style={[styles.dateField, { 
                  backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)'
                }]}
                onPress={() => {
                  setDatePickerMode('deadline');
                  setShowDatePicker(true);
                }}
              >
                <FontAwesome name="calendar" size={16} color={colors.text} />
                <Text style={[styles.dateText, { color: colors.text }]}>
                  {newLoan.deadline ? new Date(newLoan.deadline).toLocaleDateString() : 'Select deadline'}
                </Text>
              </TouchableOpacity>
              
              {/* Action Buttons */}
              <View style={[styles.modalActions, { backgroundColor: 'transparent' }]}>
                <TouchableOpacity 
                  style={[styles.cancelButton, { borderColor: colors.subText }]}
                  onPress={() => {
                    setModalVisible(false);
                    resetForm();
                  }}
                >
                  <Text style={[styles.cancelButtonText, { color: colors.subText }]}>Cancel</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[styles.saveButton, { backgroundColor: AppColors.primary }]}
                  onPress={handleAddLoan}
                >
                  <Text style={styles.saveButtonText}>
                    {editingLoanId ? 'Update' : 'Add Loan'}
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Date Picker */}
      {showDatePicker && (
        <DateTimePicker
          value={new Date()}
          mode="date"
          display="default"
          onChange={handleDateChange}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
  scrollView: {
    flex: 1,
  },
  summaryCard: {
    margin: 16,
    borderRadius: 12,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  summaryItem: {
    width: '48%',
    marginBottom: 15,
  },
  summaryLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  summaryCount: {
    fontSize: 11,
  },
  filterContainer: {
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  filterTabs: {
    flexDirection: 'row',
    paddingVertical: 10,
  },
  filterTab: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    marginRight: 8,
  },
  loansList: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  loanItem: {
    padding: 16,
    marginBottom: 12,
    borderRadius: 12,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  loanHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  loanLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  loanIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  loanDetails: {
    flex: 1,
  },
  loanContact: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  loanType: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 2,
  },
  loanDate: {
    fontSize: 12,
  },
  loanRight: {
    alignItems: 'flex-end',
  },
  loanAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    marginBottom: 4,
  },
  statusText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  deadline: {
    fontSize: 11,
    fontStyle: 'italic',
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  quickActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginLeft: 8,
  },
  quickActionText: {
    fontSize: 12,
    marginLeft: 4,
    fontWeight: '500',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 10,
    marginBottom: 5,
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
    maxHeight: '80%',
    borderRadius: 12,
    padding: 20,
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
  modalScroll: {
    maxHeight: 400,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 6,
    marginTop: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  typeSelector: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  typeButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginRight: 8,
  },
  dateField: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
    borderRadius: 8,
    padding: 12,
  },
  dateText: {
    marginLeft: 8,
    fontSize: 16,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  cancelButton: {
    flex: 1,
    padding: 12,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: 'center',
    marginRight: 10,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
  saveButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginLeft: 10,
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});