import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Platform
} from 'react-native';
import { PanGestureHandler, State } from 'react-native-gesture-handler';
import { PanGestureHandlerGestureEvent } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedGestureHandler,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  runOnJS
} from 'react-native-reanimated';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { AppColors } from '@/app/(tabs)/_layout';
import { getBudgets, Budget as ApiBudget } from '@/services/api';
import { eventEmitter } from '@/utils/eventEmitter';
import { useCurrency } from '@/components/CurrencyProvider';

const { width } = Dimensions.get('window');
const CARD_WIDTH = width - 32;

interface BudgetPeriod {
  id: 'daily' | 'weekly' | 'monthly' | 'yearly';
  label: string;
  data: {
    budgeted: number;
    spent: number;
    remaining: number;
    count: number;
    formattedBudgeted?: string;
    formattedSpent?: string;
    formattedRemaining?: string;
  };
}

interface SwipeableBudgetCardProps {
  colors: any;
  isDarkMode: boolean;
  onCreateBudget: (period: 'daily' | 'weekly' | 'monthly' | 'yearly') => void;
  currencyReady?: boolean;
}

export default function SwipeableBudgetCard({ colors, isDarkMode, onCreateBudget, currencyReady }: SwipeableBudgetCardProps) {
  const { formatCurrency, convertCurrency, loading: currencyLoading } = useCurrency();
  const [currentIndex, setCurrentIndex] = useState(0); // Start with daily
  const [budgetPeriods, setBudgetPeriods] = useState<BudgetPeriod[]>([
    {
      id: 'daily',
      label: 'Daily Budget',
      data: { budgeted: 0, spent: 0, remaining: 0, count: 0, formattedBudgeted: '', formattedSpent: '', formattedRemaining: '' }
    },
    {
      id: 'weekly',
      label: 'Weekly Budget',
      data: { budgeted: 0, spent: 0, remaining: 0, count: 0, formattedBudgeted: '', formattedSpent: '', formattedRemaining: '' }
    },
    {
      id: 'monthly',
      label: 'Monthly Budget',
      data: { budgeted: 0, spent: 0, remaining: 0, count: 0, formattedBudgeted: '', formattedSpent: '', formattedRemaining: '' }
    },
    {
      id: 'yearly',
      label: 'Yearly Budget',
      data: { budgeted: 0, spent: 0, remaining: 0, count: 0, formattedBudgeted: '', formattedSpent: '', formattedRemaining: '' }
    }
  ]);

  const translateX = useSharedValue(0);
  const opacity = useSharedValue(1);

  const loadBudgetData = async () => {
    try {
      const periods: ('daily' | 'weekly' | 'monthly' | 'yearly')[] = ['daily', 'weekly', 'monthly', 'yearly'];
      const updatedPeriods = [...budgetPeriods];

      for (let i = 0; i < periods.length; i++) {
        const period = periods[i];
        try {
          const response = await getBudgets({ period, active_only: true });
          if (response?.data?.budgets) {
            const budgets = response.data.budgets as ApiBudget[];
            
            // Convert and format currency values
            let totalBudgeted = 0;
            let totalSpent = 0;
            
            for (const b of budgets) {
              try {
                // Convert to primary currency if needed
                const convertedBudgeted = b.currency ? 
                  await convertCurrency(b.amount, b.currency) : 
                  b.amount;
                const convertedSpent = b.currency ? 
                  await convertCurrency(b.spent_amount || 0, b.currency) : 
                  (b.spent_amount || 0);
                
                totalBudgeted += convertedBudgeted;
                totalSpent += convertedSpent;
              } catch (error) {
                console.error('Error converting budget currency:', error);
                // Fallback to original values
                totalBudgeted += b.amount;
                totalSpent += (b.spent_amount || 0);
              }
            }
            
            // Format currency values
            try {
              const [formattedBudgeted, formattedSpent, formattedRemaining] = await Promise.all([
                formatCurrency(totalBudgeted),
                formatCurrency(totalSpent),
                formatCurrency(totalBudgeted - totalSpent)
              ]);
              
              updatedPeriods[i] = {
                ...updatedPeriods[i],
                data: {
                  budgeted: totalBudgeted,
                  spent: totalSpent,
                  remaining: totalBudgeted - totalSpent,
                  count: budgets.length,
                  formattedBudgeted,
                  formattedSpent,
                  formattedRemaining
                }
              };
            } catch (error) {
              console.error('Error formatting budget currency:', error);
              // Fallback formatting with no currency symbol to avoid "$"
              updatedPeriods[i] = {
                ...updatedPeriods[i],
                data: {
                  budgeted: totalBudgeted,
                  spent: totalSpent,
                  remaining: totalBudgeted - totalSpent,
                  count: budgets.length,
                  formattedBudgeted: totalBudgeted.toFixed(2),
                  formattedSpent: totalSpent.toFixed(2),
                  formattedRemaining: (totalBudgeted - totalSpent).toFixed(2)
                }
              };
            }
          }
        } catch (error) {
          console.error(`Error loading ${period} budgets:`, error);
        }
      }

      setBudgetPeriods(updatedPeriods);
    } catch (error) {
      console.error('Error loading budget data:', error);
    }
  };

  useEffect(() => {
    loadBudgetData();
    
    // Listen for transaction updates to refresh budget data
    const handleTransactionUpdate = () => {
      loadBudgetData();
    };

    eventEmitter.on('transactionAdded', handleTransactionUpdate);
    eventEmitter.on('transactionUpdated', handleTransactionUpdate);
    eventEmitter.on('transactionDeleted', handleTransactionUpdate);

    return () => {
      eventEmitter.off('transactionAdded', handleTransactionUpdate);
      eventEmitter.off('transactionUpdated', handleTransactionUpdate);
      eventEmitter.off('transactionDeleted', handleTransactionUpdate);
    };
  }, []);

  // Initialize currency formatting for zero values
  useEffect(() => {
    const initializeCurrencyFormatting = async () => {
      // Wait for currency system to be ready
      if (currencyLoading) {
        return;
      }

      try {
        const formattedZero = await formatCurrency(0);
        
        setBudgetPeriods(prev => prev.map(period => ({
          ...period,
          data: {
            ...period.data,
            formattedBudgeted: period.data.formattedBudgeted || formattedZero,
            formattedSpent: period.data.formattedSpent || formattedZero,
            formattedRemaining: period.data.formattedRemaining || formattedZero
          }
        })));
      } catch (error) {
        console.error('Error initializing budget currency formatting:', error);
        // Set fallback formatting without currency symbol to prevent "$" from showing
        setBudgetPeriods(prev => prev.map(period => ({
          ...period,
          data: {
            ...period.data,
            formattedBudgeted: period.data.formattedBudgeted || '0.00',
            formattedSpent: period.data.formattedSpent || '0.00',
            formattedRemaining: period.data.formattedRemaining || '0.00'
          }
        })));
      }
    };

    initializeCurrencyFormatting();
  }, [formatCurrency, currencyLoading]);

  const goToPrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const goToNext = () => {
    if (currentIndex < budgetPeriods.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const gestureHandler = useAnimatedGestureHandler<PanGestureHandlerGestureEvent>({
    onStart: () => {
      opacity.value = withTiming(0.8);
    },
    onActive: (event) => {
      translateX.value = event.translationX;
    },
    onEnd: (event) => {
      opacity.value = withTiming(1);
      
      const threshold = CARD_WIDTH * 0.3;
      
      if (event.translationX > threshold && currentIndex > 0) {
        // Swipe right - go to previous
        translateX.value = withSpring(CARD_WIDTH);
        runOnJS(setCurrentIndex)(currentIndex - 1);
      } else if (event.translationX < -threshold && currentIndex < budgetPeriods.length - 1) {
        // Swipe left - go to next
        translateX.value = withSpring(-CARD_WIDTH);
        runOnJS(setCurrentIndex)(currentIndex + 1);
      } else {
        // Snap back
        translateX.value = withSpring(0);
      }
      
      // Reset position after animation
      setTimeout(() => {
        translateX.value = 0;
      }, 300);
    },
  });

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: translateX.value }],
      opacity: opacity.value,
    };
  });

  const getCurrentPeriod = () => budgetPeriods[currentIndex];
  const currentPeriod = getCurrentPeriod();

  const getProgressColor = (spent: number, budgeted: number) => {
    if (budgeted === 0) return AppColors.primary;
    const percentage = (spent / budgeted) * 100;
    if (percentage >= 100) return AppColors.danger;
    if (percentage >= 80) return '#FF9800';
    return AppColors.primary;
  };

  const getStatusText = (spent: number, budgeted: number) => {
    if (budgeted === 0) return 'No budget set';
    const percentage = (spent / budgeted) * 100;
    if (percentage >= 100) return 'Over budget';
    if (percentage >= 80) return 'Near limit';
    return 'On track';
  };

  const renderDots = () => (
    <View style={styles.dotsContainer}>
      {budgetPeriods.map((_, index) => (
        <View
          key={index}
          style={[
            styles.dot,
            {
              backgroundColor: index === currentIndex ? AppColors.primary : colors.subText,
              opacity: index === currentIndex ? 1 : 0.3,
            }
          ]}
        />
      ))}
    </View>
  );

  if (!currentPeriod) return null;

  const cardContent = (
    <Animated.View style={[styles.card, { backgroundColor: colors.cardBackground }, animatedStyle]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={[styles.title, { color: colors.text }]}>
            {currentPeriod.label}
          </Text>
          <Text style={[styles.subtitle, { color: colors.subText }]}>
            {Platform.OS === 'web' ? 'Use the buttons below to change period' : 'Swipe to change period'}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.addButton, { backgroundColor: AppColors.primary }]}
          onPress={() => onCreateBudget(currentPeriod.id)}
        >
          <FontAwesome name="plus" size={16} color="white" />
        </TouchableOpacity>
      </View>

      {/* Budget Content */}
      {currentPeriod.data.count > 0 ? (
        <>
          {/* Budget Overview */}
          <View style={styles.budgetOverview}>
            <View style={styles.budgetItem}>
              <Text style={[styles.budgetLabel, { color: colors.subText }]}>Budgeted</Text>
              <Text style={[styles.budgetValue, { color: AppColors.primary }]}>
                {(currencyReady !== false) && currentPeriod.data.formattedBudgeted ? currentPeriod.data.formattedBudgeted : '...'}
              </Text>
            </View>
            <View style={styles.budgetItem}>
              <Text style={[styles.budgetLabel, { color: colors.subText }]}>Spent</Text>
              <Text style={[styles.budgetValue, { color: AppColors.danger }]}>
                {(currencyReady !== false) && currentPeriod.data.formattedSpent ? currentPeriod.data.formattedSpent : '...'}
              </Text>
            </View>
            <View style={styles.budgetItem}>
              <Text style={[styles.budgetLabel, { color: colors.subText }]}>Remaining</Text>
              <Text style={[
                styles.budgetValue,
                { color: currentPeriod.data.remaining >= 0 ? AppColors.primary : AppColors.danger }
              ]}>
                {(currencyReady !== false) && currentPeriod.data.formattedRemaining ? currentPeriod.data.formattedRemaining : '...'}
              </Text>
            </View>
          </View>

          {/* Progress Bar */}
          <View style={styles.progressContainer}>
            <View style={[styles.progressBar, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }]}>
              <View style={[
                styles.progressFill,
                {
                  width: `${Math.min(100, (currentPeriod.data.spent / currentPeriod.data.budgeted) * 100)}%`,
                  backgroundColor: getProgressColor(currentPeriod.data.spent, currentPeriod.data.budgeted)
                }
              ]} />
            </View>
            <Text style={[styles.statusText, { 
              color: getProgressColor(currentPeriod.data.spent, currentPeriod.data.budgeted) 
            }]}>
              {getStatusText(currentPeriod.data.spent, currentPeriod.data.budgeted)}
            </Text>
          </View>

          {/* Budget Count */}
          <Text style={[styles.budgetCount, { color: colors.subText }]}>
            {currentPeriod.data.count} active budget{currentPeriod.data.count !== 1 ? 's' : ''}
          </Text>
        </>
      ) : (
        /* No Budget State */
        <View style={styles.noBudgetContainer}>
          <FontAwesome name="pie-chart" size={48} color={colors.subText} style={styles.noBudgetIcon} />
          <Text style={[styles.noBudgetTitle, { color: colors.text }]}>
            No {currentPeriod.id} budget set
          </Text>
          <Text style={[styles.noBudgetSubtitle, { color: colors.subText }]}>
            Tap the + button to create your first {currentPeriod.id} budget
          </Text>
        </View>
      )}

      {/* Web Navigation Buttons at the bottom */}
      {Platform.OS === 'web' && (
        <View style={styles.webButtonContainer}>
          <TouchableOpacity
            style={[
              styles.webNavButton,
              { 
                backgroundColor: currentIndex > 0 ? AppColors.secondary : colors.subText,
                opacity: currentIndex > 0 ? 0.9 : 0.3
              }
            ]}
            onPress={goToPrevious}
            disabled={currentIndex === 0}
          >
            <FontAwesome name="chevron-left" size={16} color="white" />
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[
              styles.webNavButton,
              { 
                backgroundColor: currentIndex < budgetPeriods.length - 1 ? AppColors.secondary : colors.subText,
                opacity: currentIndex < budgetPeriods.length - 1 ? 0.9 : 0.3
              }
            ]}
            onPress={goToNext}
            disabled={currentIndex === budgetPeriods.length - 1}
          >
            <FontAwesome name="chevron-right" size={16} color="white" />
          </TouchableOpacity>
        </View>
      )}
    </Animated.View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.cardWrapper}>
        {/* Card with Gesture Handler for mobile */}
        {Platform.OS === 'web' ? (
          cardContent
        ) : (
          <PanGestureHandler onGestureEvent={gestureHandler}>
            {cardContent}
          </PanGestureHandler>
        )}
      </View>

      {/* Dots Indicator */}
      {renderDots()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginVertical: 10,
  },
  cardWrapper: {
    position: 'relative',
  },
  card: {
    borderRadius: 12,
    padding: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerLeft: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  budgetOverview: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  budgetItem: {
    alignItems: 'center',
  },
  budgetLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  budgetValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  progressContainer: {
    marginBottom: 12,
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
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  budgetCount: {
    fontSize: 12,
    textAlign: 'center',
  },
  noBudgetContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  noBudgetIcon: {
    marginBottom: 12,
  },
  noBudgetTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  noBudgetSubtitle: {
    fontSize: 12,
    textAlign: 'center',
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 10,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
  },
  // New styles for web buttons at bottom
  webButtonContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 16,
    gap: 16,
  },
  webNavButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
});