import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  RefreshControl
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useRouter } from 'expo-router';
import { useTheme } from '@/components/ThemeProvider';
import { AppColors } from '@/app/(tabs)/_layout';
import { getTransactions, getTransactionSummary } from '@/services/api';
import { LinearGradient } from 'expo-linear-gradient';
import { LineChart, PieChart } from 'react-native-chart-kit';
import { useCurrency } from '@/components/CurrencyProvider';

const { width } = Dimensions.get('window');

interface AnalyticsData {
  totalIncome: number;
  totalExpenses: number;
  netSavings: number;
  transactionCount: number;
  topCategories: Array<{ category: string; amount: number; count: number }>;
  monthlyTrend: Array<{ month: string; income: number; expenses: number }>;
}

export default function AnalyticsScreen() {
  const { isDarkMode, colors } = useTheme();
  const { formatCurrency, convertCurrency } = useCurrency();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [analytics, setAnalytics] = useState<AnalyticsData>({
    totalIncome: 0,
    totalExpenses: 0,
    netSavings: 0,
    transactionCount: 0,
    topCategories: [],
    monthlyTrend: []
  });

  // Formatted currency states
  const [formattedAnalytics, setFormattedAnalytics] = useState({
    totalIncome: '',
    totalExpenses: '',
    netSavings: '',
    dailySpending: ''
  });

  const [formattedCategories, setFormattedCategories] = useState<{[key: string]: string}>({});

  const [selectedPeriod, setSelectedPeriod] = useState('month');

  const periods = [
    { id: 'week', label: 'Week' },
    { id: 'month', label: 'Month' },
    { id: 'year', label: 'Year' },
    { id: 'all', label: 'All Time' }
  ];

  const fetchAnalytics = async () => {
    try {
      const response = await getTransactions();
      if (response?.data?.transactions) {
        const transactions = response.data.transactions;
        await processAnalytics(transactions);
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const processAnalytics = useCallback(async (transactions: any[]) => {
    const now = new Date();
    let filteredTransactions = transactions;

    // Filter by period
    if (selectedPeriod !== 'all') {
      const cutoffDate = new Date();
      switch (selectedPeriod) {
        case 'week':
          cutoffDate.setDate(now.getDate() - 7);
          break;
        case 'month':
          cutoffDate.setMonth(now.getMonth() - 1);
          break;
        case 'year':
          cutoffDate.setFullYear(now.getFullYear() - 1);
          break;
      }
      filteredTransactions = transactions.filter(t => new Date(t.date) >= cutoffDate);
    }

    // Convert transactions to primary currency and calculate totals
    let totalIncome = 0;
    let totalExpenses = 0;

    for (const t of filteredTransactions) {
      try {
        const convertedAmount = t.currency ? 
          await convertCurrency(Math.abs(t.amount), t.currency) : 
          Math.abs(t.amount);
        
        if (t.amount > 0) {
          totalIncome += convertedAmount;
        } else {
          totalExpenses += convertedAmount;
        }
      } catch (error) {
        console.error('Error converting transaction currency:', error);
        // Fallback to original amount
        if (t.amount > 0) {
          totalIncome += Math.abs(t.amount);
        } else {
          totalExpenses += Math.abs(t.amount);
        }
      }
    }

    // Calculate top categories with currency conversion
    const categoryMap = new Map();
    for (const t of filteredTransactions) {
      const category = t.category || 'Other';
      try {
        const convertedAmount = t.currency ? 
          await convertCurrency(Math.abs(t.amount), t.currency) : 
          Math.abs(t.amount);
        
        if (categoryMap.has(category)) {
          const existing = categoryMap.get(category);
          categoryMap.set(category, {
            amount: existing.amount + convertedAmount,
            count: existing.count + 1
          });
        } else {
          categoryMap.set(category, { amount: convertedAmount, count: 1 });
        }
      } catch (error) {
        console.error('Error converting category amount:', error);
        // Fallback to original amount
        if (categoryMap.has(category)) {
          const existing = categoryMap.get(category);
          categoryMap.set(category, {
            amount: existing.amount + Math.abs(t.amount),
            count: existing.count + 1
          });
        } else {
          categoryMap.set(category, { amount: Math.abs(t.amount), count: 1 });
        }
      }
    }

    const topCategories = Array.from(categoryMap.entries())
      .map(([category, data]) => ({ category, ...data }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);

    const netSavings = totalIncome - totalExpenses;

    setAnalytics({
      totalIncome,
      totalExpenses,
      netSavings,
      transactionCount: filteredTransactions.length,
      topCategories,
      monthlyTrend: []
    });

    // Format currency values
    try {
      const [formattedIncome, formattedExpenses, formattedSavings, formattedDaily] = 
        await Promise.all([
          formatCurrency(totalIncome),
          formatCurrency(totalExpenses),
          formatCurrency(netSavings),
          formatCurrency(totalExpenses / 30)
        ]);

      setFormattedAnalytics({
        totalIncome: formattedIncome,
        totalExpenses: formattedExpenses,
        netSavings: formattedSavings,
        dailySpending: formattedDaily
      });

      // Format category amounts
      const categoryFormatting: {[key: string]: string} = {};
      for (const category of topCategories) {
        try {
          categoryFormatting[category.category] = await formatCurrency(category.amount);
        } catch (error) {
          categoryFormatting[category.category] = category.amount.toFixed(2);
        }
      }
      setFormattedCategories(categoryFormatting);
    } catch (error) {
      console.error('Error formatting analytics currencies:', error);
      // Fallback to basic formatting (no currency symbol)
      setFormattedAnalytics({
        totalIncome: totalIncome.toFixed(2),
        totalExpenses: totalExpenses.toFixed(2),
        netSavings: netSavings.toFixed(2),
        dailySpending: (totalExpenses / 30).toFixed(2)
      });
    }
  }, [convertCurrency, formatCurrency, selectedPeriod]);

  useEffect(() => {
    fetchAnalytics();
  }, [selectedPeriod]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchAnalytics();
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <StatusBar style={isDarkMode ? 'light' : 'dark'} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={AppColors.primary} />
          <Text style={[styles.loadingText, { color: colors.text }]}>Loading Analytics...</Text>
        </View>
      </View>
    );
  }

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
                selectedPeriod === period.id && styles.periodButtonActive,
                { borderColor: colors.border }
              ]}
              onPress={() => setSelectedPeriod(period.id)}
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

        {/* Summary Cards */}
        <View style={styles.summaryGrid}>
          <View style={styles.summaryRow}>
            <View style={[styles.summaryCard, { backgroundColor: colors.cardBackground }]}>
              <LinearGradient colors={['#4CAF50', '#45A049']} style={styles.summaryIcon}>
                <FontAwesome name="arrow-up" size={20} color="white" />
              </LinearGradient>
              <Text style={[styles.summaryLabel, { color: colors.subText }]}>Income</Text>
              <Text style={[styles.summaryValue, { color: AppColors.primary }]}>
                {formattedAnalytics.totalIncome}
              </Text>
            </View>

            <View style={[styles.summaryCard, { backgroundColor: colors.cardBackground }]}>
              <LinearGradient colors={['#F44336', '#D32F2F']} style={styles.summaryIcon}>
                <FontAwesome name="arrow-down" size={20} color="white" />
              </LinearGradient>
              <Text style={[styles.summaryLabel, { color: colors.subText }]}>Expenses</Text>
              <Text style={[styles.summaryValue, { color: AppColors.danger }]}>
                {formattedAnalytics.totalExpenses}
              </Text>
            </View>
          </View>

          <View style={styles.summaryRow}>
            <View style={[styles.summaryCard, { backgroundColor: colors.cardBackground }]}>
              <LinearGradient colors={['#2196F3', '#1976D2']} style={styles.summaryIcon}>
                <FontAwesome name="bank" size={20} color="white" />
              </LinearGradient>
              <Text style={[styles.summaryLabel, { color: colors.subText }]}>Net Savings</Text>
              <Text style={[
                styles.summaryValue, 
                { color: analytics.netSavings >= 0 ? AppColors.primary : AppColors.danger }
              ]}>
                {formattedAnalytics.netSavings}
              </Text>
            </View>

            <View style={[styles.summaryCard, { backgroundColor: colors.cardBackground }]}>
              <LinearGradient colors={['#FF9800', '#F57C00']} style={styles.summaryIcon}>
                <FontAwesome name="list" size={20} color="white" />
              </LinearGradient>
              <Text style={[styles.summaryLabel, { color: colors.subText }]}>Transactions</Text>
              <Text style={[styles.summaryValue, { color: colors.text }]}>
                {analytics.transactionCount}
              </Text>
            </View>
          </View>
        </View>

        {/* Expense Categories Chart */}
        {analytics.topCategories.length > 0 && (
          <View style={[styles.section, { backgroundColor: colors.cardBackground }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Expense Breakdown</Text>
            <View style={styles.chartContainer}>
              <PieChart
                data={analytics.topCategories.map((category, index) => ({
                  name: category.category,
                  population: category.amount,
                  color: `hsl(${index * 72}, 70%, 60%)`,
                  legendFontColor: colors.text,
                  legendFontSize: 12,
                }))}
                width={width - 64}
                height={200}
                chartConfig={{
                  backgroundColor: colors.cardBackground,
                  backgroundGradientFrom: colors.cardBackground,
                  backgroundGradientTo: colors.cardBackground,
                  color: (opacity = 1) => `rgba(26, 255, 146, ${opacity})`,
                  labelColor: (opacity = 1) => colors.text,
                }}
                accessor="population"
                backgroundColor="transparent"
                paddingLeft="15"
                absolute
              />
            </View>
          </View>
        )}

        {/* Income vs Expenses Trend */}
        <View style={[styles.section, { backgroundColor: colors.cardBackground }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Income vs Expenses</Text>
          <View style={styles.chartContainer}>
            <LineChart
              data={{
                labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
                datasets: [
                  {
                    data: [analytics.totalIncome * 0.2, analytics.totalIncome * 0.3, analytics.totalIncome * 0.25, analytics.totalIncome * 0.25],
                    color: (opacity = 1) => `rgba(76, 175, 80, ${opacity})`,
                    strokeWidth: 3,
                  },
                  {
                    data: [analytics.totalExpenses * 0.3, analytics.totalExpenses * 0.2, analytics.totalExpenses * 0.35, analytics.totalExpenses * 0.15],
                    color: (opacity = 1) => `rgba(244, 67, 54, ${opacity})`,
                    strokeWidth: 3,
                  },
                ],
                legend: ['Income', 'Expenses'],
              }}
              width={width - 64}
              height={220}
              chartConfig={{
                backgroundColor: colors.cardBackground,
                backgroundGradientFrom: colors.cardBackground,
                backgroundGradientTo: colors.cardBackground,
                decimalPlaces: 0,
                color: (opacity = 1) => colors.text,
                labelColor: (opacity = 1) => colors.text,
                style: {
                  borderRadius: 16,
                },
                propsForDots: {
                  r: '6',
                  strokeWidth: '2',
                  stroke: colors.cardBackground,
                },
              }}
              bezier
              style={styles.chart}
            />
          </View>
        </View>

        {/* Top Categories */}
        <View style={[styles.section, { backgroundColor: colors.cardBackground }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Top Categories</Text>
          {analytics.topCategories.map((category, index) => (
            <View key={category.category} style={styles.categoryItem}>
              <View style={styles.categoryInfo}>
                <View style={[styles.categoryIcon, { backgroundColor: `hsl(${index * 60}, 70%, 60%)` }]}>
                  <FontAwesome name="tag" size={16} color="white" />
                </View>
                <View style={styles.categoryDetails}>
                  <Text style={[styles.categoryName, { color: colors.text }]}>
                    {category.category}
                  </Text>
                  <Text style={[styles.categoryCount, { color: colors.subText }]}>
                    {category.count} transactions
                  </Text>
                </View>
              </View>
              <Text style={[styles.categoryAmount, { color: colors.text }]}>
                {formattedCategories[category.category] || category.amount.toFixed(2)}
              </Text>
            </View>
          ))}
        </View>

        {/* Spending Habits */}
        <View style={[styles.section, { backgroundColor: colors.cardBackground }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Spending Insights</Text>
          
          <View style={styles.insightItem}>
            <FontAwesome name="calendar" size={20} color={AppColors.primary} />
            <View style={styles.insightText}>
              <Text style={[styles.insightTitle, { color: colors.text }]}>Average Daily Spending</Text>
              <Text style={[styles.insightValue, { color: colors.subText }]}>
                {formattedAnalytics.dailySpending}
              </Text>
            </View>
          </View>

          <View style={styles.insightItem}>
            <FontAwesome name="line-chart" size={20} color={AppColors.primary} />
            <View style={styles.insightText}>
              <Text style={[styles.insightTitle, { color: colors.text }]}>Savings Rate</Text>
              <Text style={[styles.insightValue, { color: colors.subText }]}>
                {analytics.totalIncome > 0 
                  ? ((analytics.netSavings / analytics.totalIncome) * 100).toFixed(1)
                  : '0'
                }%
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
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
    marginTop: 16,
    fontSize: 16,
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
  settingsButton: {
    padding: 8,
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
  summaryGrid: {
    marginBottom: 20,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  summaryCard: {
    width: (width - 48) / 2,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  summaryIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  section: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  chartContainer: {
    alignItems: 'center',
    marginVertical: 10,
  },
  chart: {
    marginVertical: 8,
    borderRadius: 16,
  },
  categoryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  categoryInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  categoryIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  categoryDetails: {
    flex: 1,
  },
  categoryName: {
    fontSize: 16,
    fontWeight: '600',
  },
  categoryCount: {
    fontSize: 12,
    marginTop: 2,
  },
  categoryAmount: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  insightItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  insightText: {
    marginLeft: 12,
    flex: 1,
  },
  insightTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  insightValue: {
    fontSize: 14,
    marginTop: 2,
  },
});