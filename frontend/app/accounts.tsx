import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  ActivityIndicator,
  RefreshControl,
  Alert
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useRouter } from 'expo-router';
import { useTheme } from '@/components/ThemeProvider';
import { useCurrency } from '@/components/CurrencyProvider';
import { AppColors } from '@/app/(tabs)/_layout';
import { LinearGradient } from 'expo-linear-gradient';

interface Account {
  id: string;
  name: string;
  type: 'checking' | 'savings' | 'credit_card' | 'investment' | 'cash';
  balance: number;
  bank?: string;
  accountNumber?: string;
  color: string;
  currency?: string;
  isActive: boolean;
}

export default function AccountsScreen() {
  const { isDarkMode, colors } = useTheme();
  const { formatCurrency, convertCurrency } = useCurrency();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [formattedBalances, setFormattedBalances] = useState<{[key: string]: string}>({});
  const [formattedOverview, setFormattedOverview] = useState({
    netWorth: '',
    totalAssets: '',
    totalDebt: ''
  });
  const [accounts, setAccounts] = useState<Account[]>([
    {
      id: '1',
      name: 'Main Checking',
      type: 'checking',
      balance: 2450.75,
      bank: 'Chase Bank',
      accountNumber: '****1234',
      color: '#4CAF50',
      isActive: true
    },
    {
      id: '2',
      name: 'Emergency Savings',
      type: 'savings',
      balance: 8900.00,
      bank: 'Wells Fargo',
      accountNumber: '****5678',
      color: '#2196F3',
      isActive: true
    },
    {
      id: '3',
      name: 'Credit Card',
      type: 'credit_card',
      balance: -1250.30,
      bank: 'Capital One',
      accountNumber: '****9012',
      color: '#FF9800',
      isActive: true
    },
    {
      id: '4',
      name: 'Investment Account',
      type: 'investment',
      balance: 15750.25,
      bank: 'Vanguard',
      accountNumber: '****3456',
      color: '#9C27B0',
      isActive: true
    }
  ]);

  const [newAccount, setNewAccount] = useState({
    name: '',
    type: 'checking' as Account['type'],
    balance: '',
    bank: '',
    accountNumber: ''
  });

  // Format currency values for all accounts and overview
  useEffect(() => {
    const formatAccountBalances = async () => {
      try {
        const formatted: {[key: string]: string} = {};
        
        await Promise.all(
          accounts.map(async (account) => {
            try {
              formatted[account.id] = await formatCurrency(Math.abs(account.balance));
            } catch (error) {
              formatted[account.id] = Math.abs(account.balance).toFixed(2);
            }
          })
        );
        
        setFormattedBalances(formatted);

        // Format overview values with currency conversion
        const totalBalance = await getTotalBalance();
        const totalDebt = await getTotalDebt();
        const netWorth = totalBalance - totalDebt;

        try {
          const formattedNetWorth = await formatCurrency(Math.abs(netWorth));
          const formattedAssets = await formatCurrency(totalBalance);
          const formattedDebt = await formatCurrency(totalDebt);

          setFormattedOverview({
            netWorth: formattedNetWorth,
            totalAssets: formattedAssets,
            totalDebt: formattedDebt
          });
        } catch (error) {
          console.error('Error formatting overview values:', error);
          setFormattedOverview({
            netWorth: Math.abs(netWorth).toFixed(2),
            totalAssets: totalBalance.toFixed(2),
            totalDebt: totalDebt.toFixed(2)
          });
        }
      } catch (error) {
        console.error('Error formatting account balances:', error);
      }
    };
    
    formatAccountBalances();
  }, [accounts, formatCurrency]);

  const accountTypes = [
    { id: 'checking', label: 'Checking', icon: 'university' },
    { id: 'savings', label: 'Savings', icon: 'piggy-bank' },
    { id: 'credit_card', label: 'Credit Card', icon: 'credit-card' },
    { id: 'investment', label: 'Investment', icon: 'line-chart' },
    { id: 'cash', label: 'Cash', icon: 'money' }
  ];

  const getAccountIcon = (type: Account['type']) => {
    const typeMap = {
      checking: 'university',
      savings: 'piggy-bank',
      credit_card: 'credit-card',
      investment: 'line-chart',
      cash: 'money'
    };
    return typeMap[type];
  };

  const getTotalBalance = async () => {
    let totalBalance = 0;
    const activeAccounts = accounts.filter(account => account.isActive && account.type !== 'credit_card');
    
    for (const account of activeAccounts) {
      try {
        const convertedBalance = account.currency ? 
          await convertCurrency(account.balance, account.currency) : 
          account.balance;
        totalBalance += convertedBalance;
      } catch (error) {
        console.error('Error converting account balance currency:', error);
        totalBalance += account.balance; // Fallback to original amount
      }
    }
    
    return totalBalance;
  };

  const getTotalDebt = async () => {
    let totalDebt = 0;
    const creditCardAccounts = accounts.filter(account => account.isActive && account.type === 'credit_card' && account.balance < 0);
    
    for (const account of creditCardAccounts) {
      try {
        const convertedBalance = account.currency ? 
          await convertCurrency(Math.abs(account.balance), account.currency) : 
          Math.abs(account.balance);
        totalDebt += convertedBalance;
      } catch (error) {
        console.error('Error converting debt currency:', error);
        totalDebt += Math.abs(account.balance); // Fallback to original amount
      }
    }
    
    return totalDebt;
  };

  const handleCreateAccount = () => {
    if (!newAccount.name || !newAccount.balance) {
      Alert.alert('Error', 'Please fill in required fields');
      return;
    }

    const account: Account = {
      id: Date.now().toString(),
      name: newAccount.name,
      type: newAccount.type,
      balance: parseFloat(newAccount.balance),
      bank: newAccount.bank,
      accountNumber: newAccount.accountNumber,
      color: `hsl(${Math.random() * 360}, 70%, 60%)`,
      isActive: true
    };

    setAccounts([...accounts, account]);
    setNewAccount({ name: '', type: 'checking', balance: '', bank: '', accountNumber: '' });
    setShowModal(false);
  };

  const handleDeleteAccount = (id: string) => {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to delete this account?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => {
          setAccounts(accounts.filter(a => a.id !== id));
        }}
      ]
    );
  };

  const toggleAccountStatus = (id: string) => {
    setAccounts(accounts.map(account => 
      account.id === id ? { ...account, isActive: !account.isActive } : account
    ));
  };

  const onRefresh = () => {
    setRefreshing(true);
    // Simulate refresh
    setTimeout(() => setRefreshing(false), 1000);
  };

  // Calculate net worth with currency conversion
  const [netWorth, setNetWorth] = useState(0);
  
  useEffect(() => {
    const calculateNetWorth = async () => {
      try {
        const totalBalance = await getTotalBalance();
        const totalDebt = await getTotalDebt();
        setNetWorth(totalBalance - totalDebt);
      } catch (error) {
        console.error('Error calculating net worth:', error);
        // Fallback calculation without conversion
        const basicBalance = accounts
          .filter(account => account.isActive && account.type !== 'credit_card')
          .reduce((sum, account) => sum + account.balance, 0);
        const basicDebt = Math.abs(accounts
          .filter(account => account.isActive && account.type === 'credit_card' && account.balance < 0)
          .reduce((sum, account) => sum + account.balance, 0));
        setNetWorth(basicBalance - basicDebt);
      }
    };
    
    if (accounts.length > 0) {
      calculateNetWorth();
    }
  }, [accounts]);

  // Overview Card Component to avoid hooks violation
  const OverviewCardComponent = () => {
    return (
      <View style={[styles.overviewCard, { backgroundColor: colors.cardBackground }]}>
        <Text style={[styles.overviewTitle, { color: colors.text }]}>Net Worth</Text>
        <Text style={[
          styles.netWorthValue,
          { color: netWorth >= 0 ? AppColors.primary : AppColors.danger }
        ]}>
          {netWorth >= 0 ? formattedOverview.netWorth : `-${formattedOverview.netWorth}`}
        </Text>
        
        <View style={styles.overviewStats}>
          <View style={styles.overviewStat}>
            <FontAwesome name="arrow-up" size={16} color={AppColors.primary} />
            <Text style={[styles.overviewStatLabel, { color: colors.subText }]}>Assets</Text>
            <Text style={[styles.overviewStatValue, { color: AppColors.primary }]}>
              {formattedOverview.totalAssets}
            </Text>
          </View>
          
          <View style={styles.overviewStat}>
            <FontAwesome name="arrow-down" size={16} color={AppColors.danger} />
            <Text style={[styles.overviewStatLabel, { color: colors.subText }]}>Debt</Text>
            <Text style={[styles.overviewStatValue, { color: AppColors.danger }]}>
              {formattedOverview.totalDebt}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={isDarkMode ? 'light' : 'dark'} />

      <ScrollView 
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Net Worth Overview */}
        <OverviewCardComponent />

        {/* Account Categories */}
        {accountTypes.map((type) => {
          const typeAccounts = accounts.filter(account => account.type === type.id);
          if (typeAccounts.length === 0) return null;

          return (
            <View key={type.id} style={styles.accountSection}>
              <View style={styles.sectionHeader}>
                <FontAwesome name={type.icon as any} size={18} color={AppColors.primary} />
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                  {type.label} ({typeAccounts.length})
                </Text>
              </View>

              {typeAccounts.map((account) => (
                <View key={account.id} style={[
                  styles.accountCard, 
                  { backgroundColor: colors.cardBackground },
                  !account.isActive && styles.inactiveAccount
                ]}>
                  <View style={styles.accountHeader}>
                    <View style={styles.accountInfo}>
                      <View style={[styles.accountIcon, { backgroundColor: account.color }]}>
                        <FontAwesome name={getAccountIcon(account.type) as any} size={16} color="white" />
                      </View>
                      <View style={styles.accountDetails}>
                        <Text style={[styles.accountName, { color: colors.text }]}>
                          {account.name}
                        </Text>
                        {account.bank && (
                          <Text style={[styles.accountBank, { color: colors.subText }]}>
                            {account.bank}
                          </Text>
                        )}
                        {account.accountNumber && (
                          <Text style={[styles.accountNumber, { color: colors.subText }]}>
                            {account.accountNumber}
                          </Text>
                        )}
                      </View>
                    </View>
                    
                    <View style={styles.accountActions}>
                      <Text style={[
                        styles.accountBalance,
                        { color: account.balance >= 0 ? AppColors.primary : AppColors.danger }
                      ]}>
                        {account.balance >= 0 
                          ? formattedBalances[account.id] || Math.abs(account.balance).toFixed(2)
                          : `-${formattedBalances[account.id] || Math.abs(account.balance).toFixed(2)}`
                        }
                      </Text>
                      
                      <View style={styles.actionButtons}>
                        <TouchableOpacity 
                          onPress={() => toggleAccountStatus(account.id)}
                          style={styles.actionButton}
                        >
                          <FontAwesome 
                            name={account.isActive ? 'eye' : 'eye-slash'} 
                            size={16} 
                            color={colors.subText} 
                          />
                        </TouchableOpacity>
                        
                        <TouchableOpacity 
                          onPress={() => handleDeleteAccount(account.id)}
                          style={styles.actionButton}
                        >
                          <FontAwesome name="trash" size={16} color={AppColors.danger} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>

                  {account.type === 'credit_card' && account.balance < 0 && (
                    <View style={styles.creditCardInfo}>
                      <Text style={[styles.creditCardLabel, { color: colors.subText }]}>
                        Outstanding Balance
                      </Text>
                      <LinearGradient
                        colors={['#FF6B6B', '#FF8E8E']}
                        style={styles.creditCardAlert}
                      >
                        <FontAwesome name="exclamation-triangle" size={12} color="white" />
                        <Text style={styles.creditCardAlertText}>
                          Pay off to improve credit score
                        </Text>
                      </LinearGradient>
                    </View>
                  )}
                </View>
              ))}
            </View>
          );
        })}

        {accounts.length === 0 && (
          <View style={styles.emptyState}>
            <FontAwesome name="bank" size={48} color={colors.subText} />
            <Text style={[styles.emptyText, { color: colors.text }]}>
              No accounts yet
            </Text>
            <Text style={[styles.emptySubtext, { color: colors.subText }]}>
              Add your first account to start tracking your finances
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Floating Action Button */}
      <TouchableOpacity 
        style={[styles.fab, { backgroundColor: AppColors.primary }]}
        onPress={() => setShowModal(true)}
      >
        <FontAwesome name="plus" size={24} color="white" />
      </TouchableOpacity>

      {/* Create Account Modal */}
      <Modal visible={showModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.cardBackground }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Add Account</Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <FontAwesome name="times" size={20} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalForm}>
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.text }]}>Account Name *</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.inputBackground, color: colors.text }]}
                  value={newAccount.name}
                  onChangeText={(text) => setNewAccount({ ...newAccount, name: text })}
                  placeholder="e.g., Main Checking"
                  placeholderTextColor={colors.subText}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.text }]}>Account Type</Text>
                <View style={styles.typeSelector}>
                  {accountTypes.map((type) => (
                    <TouchableOpacity
                      key={type.id}
                      style={[
                        styles.typeOption,
                        newAccount.type === type.id && styles.typeOptionActive,
                        { borderColor: colors.border }
                      ]}
                      onPress={() => setNewAccount({ ...newAccount, type: type.id as any })}
                    >
                      <FontAwesome 
                        name={type.icon as any} 
                        size={16} 
                        color={newAccount.type === type.id ? 'white' : colors.text} 
                      />
                      <Text style={[
                        styles.typeOptionText,
                        { color: newAccount.type === type.id ? 'white' : colors.text }
                      ]}>
                        {type.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.text }]}>Current Balance *</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.inputBackground, color: colors.text }]}
                  value={newAccount.balance}
                  onChangeText={(text) => setNewAccount({ ...newAccount, balance: text })}
                  placeholder="0.00"
                  placeholderTextColor={colors.subText}
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.text }]}>Bank/Institution</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.inputBackground, color: colors.text }]}
                  value={newAccount.bank}
                  onChangeText={(text) => setNewAccount({ ...newAccount, bank: text })}
                  placeholder="e.g., Chase Bank"
                  placeholderTextColor={colors.subText}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.text }]}>Account Number</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.inputBackground, color: colors.text }]}
                  value={newAccount.accountNumber}
                  onChangeText={(text) => setNewAccount({ ...newAccount, accountNumber: text })}
                  placeholder="Last 4 digits (****1234)"
                  placeholderTextColor={colors.subText}
                />
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelButton, { borderColor: colors.border }]}
                onPress={() => setShowModal(false)}
              >
                <Text style={[styles.cancelButtonText, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalButton, styles.createButton]}
                onPress={handleCreateAccount}
              >
                <Text style={styles.createButtonText}>Add Account</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
  },
  fab: {
    position: 'absolute',
    right: 30,
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
  content: {
    flex: 1,
    padding: 16,
  },
  overviewCard: {
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    alignItems: 'center',
  },
  overviewTitle: {
    fontSize: 16,
    marginBottom: 8,
  },
  netWorthValue: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  overviewStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
  },
  overviewStat: {
    alignItems: 'center',
  },
  overviewStatLabel: {
    fontSize: 12,
    marginTop: 4,
    marginBottom: 4,
  },
  overviewStatValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  accountSection: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  accountCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  inactiveAccount: {
    opacity: 0.6,
  },
  accountHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  accountInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  accountIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  accountDetails: {
    flex: 1,
  },
  accountName: {
    fontSize: 16,
    fontWeight: '600',
  },
  accountBank: {
    fontSize: 12,
    marginTop: 2,
  },
  accountNumber: {
    fontSize: 12,
    marginTop: 2,
  },
  accountActions: {
    alignItems: 'flex-end',
  },
  accountBalance: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  actionButtons: {
    flexDirection: 'row',
  },
  actionButton: {
    padding: 8,
    marginLeft: 4,
  },
  creditCardInfo: {
    marginTop: 12,
  },
  creditCardLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  creditCardAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 6,
  },
  creditCardAlertText: {
    color: 'white',
    fontSize: 12,
    marginLeft: 6,
    fontWeight: '500',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
    borderRadius: 16,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  modalForm: {
    maxHeight: 400,
    marginBottom: 20,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
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
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  typeOption: {
    width: '48%',
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    marginBottom: 8,
  },
  typeOptionActive: {
    backgroundColor: AppColors.primary,
    borderColor: AppColors.primary,
  },
  typeOptionText: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 4,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    borderWidth: 1,
    backgroundColor: 'transparent',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  createButton: {
    backgroundColor: AppColors.primary,
  },
  createButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});