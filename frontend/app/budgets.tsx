import React, { useState, useEffect, useCallback } from 'react';
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
import { LinearGradient } from 'expo-linear-gradient';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTheme } from '@/components/ThemeProvider';
import { AppColors } from '@/app/(tabs)/_layout';
import FloatingActionButton from '@/components/FloatingActionButton';
import { useCurrency } from '@/components/CurrencyProvider';
import { 
  getBudgets, 
  createBudget, 
  deleteBudget, 
  getBudgetCategories,
  Budget as ApiBudget
} from '@/services/api';

interface Budget {
  id: string;
  name: string;
  category: string;
  amount: number;
  spent: number;
  period: 'daily' | 'weekly' | 'monthly' | 'yearly';
  color: string;
  currency?: string;
  formattedAmount?: string;
  formattedSpent?: string;
}

export default function BudgetsScreen() {
  const { isDarkMode, colors } = useTheme();
  const { formatCurrency, convertCurrency } = useCurrency();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [budgets, setBudgets] = useState<Budget[]>([]);

  const [newBudget, setNewBudget] = useState({
    name: '',
    category: '',
    amount: '',
    period: 'daily' as 'daily' | 'weekly' | 'monthly' | 'yearly'
  });

  const [selectedPeriod, setSelectedPeriod] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('daily');
  const [formattedOverview, setFormattedOverview] = useState({
    totalBudget: '',
    totalSpent: '',
    remaining: ''
  });

  const periods = [
    { id: 'daily', label: 'Daily' },
    { id: 'weekly', label: 'Weekly' },
    { id: 'monthly', label: 'Monthly' },
    { id: 'yearly', label: 'Yearly' }
  ];

  const loadBudgets = useCallback(async () => {
    try {
      setLoading(true);
      const response = await getBudgets({ period: selectedPeriod });
      if (response?.data?.budgets) {
        const budgetsWithCurrency = await Promise.all(
          response.data.budgets.map(async (b: ApiBudget): Promise<Budget> => {
            try {
              // Convert amounts to primary currency if needed
              const convertedAmount = b.currency ? 
                await convertCurrency(b.amount, b.currency) : 
                b.amount;
              const convertedSpent = b.currency ? 
                await convertCurrency(b.spent_amount || 0, b.currency) : 
                (b.spent_amount || 0);

              // Format the converted amounts
              const [formattedAmount, formattedSpent] = await Promise.all([
                formatCurrency(convertedAmount),
                formatCurrency(convertedSpent)
              ]);

              return {
                id: b.id,
                name: b.name,
                category: b.category,
                amount: convertedAmount,
                spent: convertedSpent,
                period: b.period,
                color: `hsl(${Math.random() * 360}, 70%, 60%)`,
                currency: b.currency,
                formattedAmount,
                formattedSpent
              };
            } catch (error) {
              console.error('Error processing budget currency:', error);
              // Fallback to original values
              return {
                id: b.id,
                name: b.name,
                category: b.category,
                amount: b.amount,
                spent: b.spent_amount || 0,
                period: b.period,
                color: `hsl(${Math.random() * 360}, 70%, 60%)`,
                currency: b.currency,
                formattedAmount: b.amount.toFixed(2),
                formattedSpent: (b.spent_amount || 0).toFixed(2)
              };
            }
          })
        );
        setBudgets(budgetsWithCurrency);
      }
    } catch (error) {
      console.error('Error loading budgets:', error);
    } finally {
      setLoading(false);
    }
  }, [convertCurrency, formatCurrency, selectedPeriod]);

  useEffect(() => {
    loadBudgets();
  }, [selectedPeriod, loadBudgets]);

  // Format overview values when budgets change with currency conversion
  useEffect(() => {
    const formatOverviewValues = async () => {
      try {
        const filteredBudgets = budgets.filter(budget => budget.period === selectedPeriod);
        
        // Calculate totals with currency conversion
        let totalBudget = 0;
        let totalSpent = 0;
        
        for (const budget of filteredBudgets) {
          try {
            // Convert budget amounts to primary currency if needed
            const convertedAmount = budget.currency ? 
              await convertCurrency(budget.amount, budget.currency) : 
              budget.amount;
            const convertedSpent = budget.currency ? 
              await convertCurrency(budget.spent, budget.currency) : 
              budget.spent;
            
            totalBudget += convertedAmount;
            totalSpent += convertedSpent;
          } catch (error) {
            console.error('Error converting budget currency in overview:', error);
            // Fallback to original amounts
            totalBudget += budget.amount;
            totalSpent += budget.spent;
          }
        }
        
        const remaining = totalBudget - totalSpent;

        const [formattedBudget, formattedSpent, formattedRemaining] = await Promise.all([
          formatCurrency(totalBudget),
          formatCurrency(totalSpent),
          formatCurrency(Math.abs(remaining))
        ]);

        setFormattedOverview({
          totalBudget: formattedBudget,
          totalSpent: formattedSpent,
          remaining: formattedRemaining
        });
      } catch (error) {
        console.error('Error formatting overview values:', error);
        // Fallback calculation without currency conversion
        const filteredBudgets = budgets.filter(budget => budget.period === selectedPeriod);
        const totalBudget = filteredBudgets.reduce((sum, b) => sum + b.amount, 0);
        const totalSpent = filteredBudgets.reduce((sum, b) => sum + b.spent, 0);
        const remaining = totalBudget - totalSpent;

        setFormattedOverview({
          totalBudget: totalBudget.toFixed(2),
          totalSpent: totalSpent.toFixed(2),
          remaining: Math.abs(remaining).toFixed(2)
        });
      }
    };

    formatOverviewValues();
  }, [budgets, selectedPeriod, formatCurrency, convertCurrency]);

  const getProgressColor = (spent: number, amount: number) => {
    const percentage = (spent / amount) * 100;
    if (percentage >= 100) return AppColors.danger;
    if (percentage >= 80) return '#FF9800';
    return AppColors.primary;
  };

  const getBudgetStatus = (spent: number, amount: number) => {
    const percentage = (spent / amount) * 100;
    if (percentage >= 100) return 'Over Budget';
    if (percentage >= 80) return 'Near Limit';
    return 'On Track';
  };

  const handleCreateBudget = async () => {
    if (!newBudget.name || !newBudget.category || !newBudget.amount) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    try {
      setLoading(true);
      const budgetData = {
        name: newBudget.name,
        category: newBudget.category,
        amount: parseFloat(newBudget.amount),
        period: newBudget.period
      };

      const response = await createBudget(budgetData);
      
      if (response?.data) {
        // Reload budgets to get the updated list from backend
        await loadBudgets();
        setNewBudget({ name: '', category: '', amount: '', period: 'daily' });
        setShowModal(false);
        Alert.alert('Success', 'Budget created successfully');
      }
    } catch (error) {
      console.error('Error creating budget:', error);
      Alert.alert('Error', 'Failed to create budget. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteBudget = (id: string) => {
    Alert.alert(
      'Delete Budget',
      'Are you sure you want to delete this budget?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            setLoading(true);
            await deleteBudget(id);
            await loadBudgets(); // Reload budgets from backend
            Alert.alert('Success', 'Budget deleted successfully');
          } catch (error) {
            console.error('Error deleting budget:', error);
            Alert.alert('Error', 'Failed to delete budget. Please try again.');
          } finally {
            setLoading(false);
          }
        }}
      ]
    );
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await loadBudgets();
    } catch (error) {
      console.error('Error refreshing budgets:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const filteredBudgets = budgets.filter(budget => budget.period === selectedPeriod);
  const totalBudget = filteredBudgets.reduce((sum, b) => sum + b.amount, 0);
  const totalSpent = filteredBudgets.reduce((sum, b) => sum + b.spent, 0);

  // Overview Card Component to avoid hooks violation
  const OverviewCardComponent = () => {
    const remaining = totalBudget - totalSpent;
    
    return (
      <View style={[styles.overviewCard, { backgroundColor: colors.cardBackground }]}>
        <Text style={[styles.overviewTitle, { color: colors.text }]}>
          {selectedPeriod.charAt(0).toUpperCase() + selectedPeriod.slice(1)} Overview
        </Text>
        <View style={styles.overviewStats}>
          <View style={styles.overviewStat}>
            <Text style={[styles.overviewLabel, { color: colors.subText }]}>Total Budget</Text>
            <Text style={[styles.overviewValue, { color: AppColors.primary }]}>
              {formattedOverview.totalBudget}
            </Text>
          </View>
          <View style={styles.overviewStat}>
            <Text style={[styles.overviewLabel, { color: colors.subText }]}>Total Spent</Text>
            <Text style={[styles.overviewValue, { color: AppColors.danger }]}>
              {formattedOverview.totalSpent}
            </Text>
          </View>
          <View style={styles.overviewStat}>
            <Text style={[styles.overviewLabel, { color: colors.subText }]}>Remaining</Text>
            <Text style={[
              styles.overviewValue, 
              { color: remaining >= 0 ? AppColors.primary : AppColors.danger }
            ]}>
              {remaining >= 0 ? formattedOverview.remaining : `-${formattedOverview.remaining}`}
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
        {/* Period Selector */}
        <View style={styles.periodSelector}>
          {periods.map((period) => (
            <TouchableOpacity
              key={period.id}
              style={[
                styles.periodButton,
                selectedPeriod === period.id && styles.periodButtonActive
              ]}
              onPress={() => setSelectedPeriod(period.id as any)}
            >
              <Text style={[
                styles.periodButtonText,
                { color: selectedPeriod === period.id ? 'white' : colors.text }
              ]}>
                {period.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Budget Overview */}
        {filteredBudgets.length > 0 && <OverviewCardComponent />}

        {/* Budget List */}
        {filteredBudgets.map((budget) => (
          <View key={budget.id} style={[styles.budgetCard, { backgroundColor: colors.cardBackground }]}>
            <View style={styles.budgetHeader}>
              <View style={styles.budgetInfo}>
                <View style={[styles.budgetIcon, { backgroundColor: budget.color }]}>
                  <FontAwesome name="pie-chart" size={16} color="white" />
                </View>
                <View style={styles.budgetDetails}>
                  <Text style={[styles.budgetName, { color: colors.text }]}>
                    {budget.name}
                  </Text>
                  <Text style={[styles.budgetCategory, { color: colors.subText }]}>
                    {budget.category}
                  </Text>
                </View>
              </View>
              <TouchableOpacity 
                onPress={() => handleDeleteBudget(budget.id)}
                style={styles.deleteButton}
              >
                <FontAwesome name="trash" size={16} color={AppColors.danger} />
              </TouchableOpacity>
            </View>

            <View style={styles.budgetProgress}>
              <View style={styles.budgetAmounts}>
                <Text style={[styles.budgetSpent, { color: colors.text }]}>
                  {budget.formattedSpent || budget.spent.toFixed(2)} spent
                </Text>
                <Text style={[styles.budgetLimit, { color: colors.subText }]}>
                  of {budget.formattedAmount || budget.amount.toFixed(2)}
                </Text>
              </View>
              
              <View style={[styles.progressBar, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }]}>
                <View style={[
                  styles.progressFill,
                  {
                    width: `${Math.min(100, (budget.spent / budget.amount) * 100)}%`,
                    backgroundColor: getProgressColor(budget.spent, budget.amount)
                  }
                ]} />
              </View>

              <View style={styles.budgetStatus}>
                <Text style={[
                  styles.statusText,
                  { color: getProgressColor(budget.spent, budget.amount) }
                ]}>
                  {getBudgetStatus(budget.spent, budget.amount)}
                </Text>
                <Text style={[styles.statusPercentage, { color: colors.subText }]}>
                  {((budget.spent / budget.amount) * 100).toFixed(0)}%
                </Text>
              </View>
            </View>
          </View>
        ))}

        {filteredBudgets.length === 0 && (
          <View style={styles.emptyState}>
            <FontAwesome name="pie-chart" size={48} color={colors.subText} />
            <Text style={[styles.emptyText, { color: colors.text }]}>
              No {selectedPeriod} budgets yet
            </Text>
            <Text style={[styles.emptySubtext, { color: colors.subText }]}>
              Press the + button to create your first budget
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Floating Action Button */}
      <FloatingActionButton 
        onPress={() => setShowModal(true)}
        icon="plus"
      />

      {/* Create Budget Modal */}
      <Modal visible={showModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.cardBackground }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Create Budget</Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <FontAwesome name="times" size={20} color={colors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalForm}>
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.text }]}>Budget Name</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.inputBackground, color: colors.text }]}
                  value={newBudget.name}
                  onChangeText={(text) => setNewBudget({ ...newBudget, name: text })}
                  placeholder="e.g., Food & Dining"
                  placeholderTextColor={colors.subText}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.text }]}>Category</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.inputBackground, color: colors.text }]}
                  value={newBudget.category}
                  onChangeText={(text) => setNewBudget({ ...newBudget, category: text })}
                  placeholder="e.g., Food"
                  placeholderTextColor={colors.subText}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.text }]}>Amount</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.inputBackground, color: colors.text }]}
                  value={newBudget.amount}
                  onChangeText={(text) => setNewBudget({ ...newBudget, amount: text })}
                  placeholder="0.00"
                  placeholderTextColor={colors.subText}
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.text }]}>Period</Text>
                <View style={styles.periodOptions}>
                  {periods.map((period) => (
                    <TouchableOpacity
                      key={period.id}
                      style={[
                        styles.periodOption,
                        newBudget.period === period.id && styles.periodOptionActive,
                        { borderColor: colors.border }
                      ]}
                      onPress={() => setNewBudget({ ...newBudget, period: period.id as any })}
                    >
                      <Text style={[
                        styles.periodOptionText,
                        { color: newBudget.period === period.id ? 'white' : colors.text }
                      ]}>
                        {period.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelButton, { borderColor: colors.border }]}
                onPress={() => setShowModal(false)}
              >
                <Text style={[styles.cancelButtonText, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalButton, styles.createButton]}
                onPress={handleCreateBudget}
              >
                <Text style={styles.createButtonText}>Create</Text>
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
    textAlign: 'center',
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  periodSelector: {
    flexDirection: 'row',
    marginBottom: 20,
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 25,
    padding: 4,
  },
  periodButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    alignItems: 'center',
  },
  periodButtonActive: {
    backgroundColor: AppColors.primary,
  },
  periodButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  overviewCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  overviewTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  overviewStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  overviewStat: {
    alignItems: 'center',
  },
  overviewLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  overviewValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  budgetCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  budgetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  budgetInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  budgetIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  budgetDetails: {
    flex: 1,
  },
  budgetName: {
    fontSize: 16,
    fontWeight: '600',
  },
  budgetCategory: {
    fontSize: 12,
    marginTop: 2,
  },
  deleteButton: {
    padding: 8,
  },
  budgetProgress: {
    marginTop: 8,
  },
  budgetAmounts: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  budgetSpent: {
    fontSize: 14,
    fontWeight: '600',
  },
  budgetLimit: {
    fontSize: 14,
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  budgetStatus: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  statusPercentage: {
    fontSize: 12,
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
  periodOptions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  periodOption: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  periodOptionActive: {
    backgroundColor: AppColors.primary,
    borderColor: AppColors.primary,
  },
  periodOptionText: {
    fontSize: 14,
    fontWeight: '600',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  cancelButton: {
    borderWidth: 1,
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