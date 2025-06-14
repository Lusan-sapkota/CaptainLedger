import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useTheme } from '@/components/ThemeProvider';
import { useCurrency } from '@/components/CurrencyProvider';
import { AppColors } from '@/app/(tabs)/_layout';

export interface Transaction {
  id: string;
  amount: number;
  currency: string;
  category: string;
  note?: string;
  date: string;
  transaction_type?: string;
  status?: string;
}

interface TransactionItemProps {
  item: Transaction;
  onPress?: () => void;
  showDate?: boolean;
  compact?: boolean;
}

const TransactionItem: React.FC<TransactionItemProps> = ({
  item,
  onPress,
  showDate = true,
  compact = false,
}) => {
  const { colors } = useTheme();
  const { formatCurrency, convertCurrency, primaryCurrency } = useCurrency();
  const [formattedAmount, setFormattedAmount] = useState<string>('');
  const [loading, setLoading] = useState(true);

  const date = new Date(item.date);
  const formattedDate = date.toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
  });

  const isIncome = item.amount > 0;
  const amountColor = isIncome ? AppColors.primary : AppColors.danger;

  useEffect(() => {
    const formatAmount = async () => {
      try {
        setLoading(true);
        
        // Convert amount to user's primary currency
        let convertedAmount = Math.abs(item.amount);
        if (item.currency !== primaryCurrency) {
          convertedAmount = await convertCurrency(Math.abs(item.amount), item.currency);
        }
        
        // Format the amount
        const formatted = await formatCurrency(convertedAmount);
        setFormattedAmount((item.amount < 0 ? '-' : '+') + formatted);
      } catch (error) {
        console.error('Error formatting currency:', error);
        // Fallback to basic formatting
        setFormattedAmount(`${item.amount < 0 ? '-' : '+'}${Math.abs(item.amount).toFixed(2)}`);
      } finally {
        setLoading(false);
      }
    };

    formatAmount();
  }, [item.amount, item.currency, primaryCurrency, formatCurrency, convertCurrency]);

  const getTransactionIcon = () => {
    if (item.transaction_type === 'investment') return 'line-chart';
    if (item.transaction_type === 'loan_repayment') return 'credit-card';
    if (item.transaction_type === 'loan_disbursement') return 'money';
    return isIncome ? 'arrow-down' : 'arrow-up';
  };

  const getTransactionColor = () => {
    if (item.transaction_type === 'investment') return AppColors.secondary;
    if (item.transaction_type?.includes('loan')) return AppColors.warning;
    return amountColor;
  };

  return (
    <TouchableOpacity
      style={[
        compact ? styles.compactItem : styles.transactionItem,
        { backgroundColor: colors.cardBackground }
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[
        styles.transactionIconContainer,
        { 
          backgroundColor: getTransactionColor() + '15',
        }
      ]}>
        <FontAwesome 
          name={getTransactionIcon()} 
          size={compact ? 14 : 16} 
          color={getTransactionColor()} 
        />
      </View>
      
      <View style={styles.transactionDetails}>
        <Text style={[
          compact ? styles.compactNote : styles.transactionNote,
          { color: colors.text }
        ]} numberOfLines={1}>
          {item.note || item.category}
        </Text>
        {showDate && (
          <Text style={[
            compact ? styles.compactCategory : styles.transactionCategory,
            { color: colors.subText }
          ]}>
            {formattedDate} • {item.category}
          </Text>
        )}
        {!showDate && (
          <Text style={[
            compact ? styles.compactCategory : styles.transactionCategory,
            { color: colors.subText }
          ]}>
            {item.category}
          </Text>
        )}
      </View>
      
      <View style={styles.transactionAmountContainer}>
        <Text style={[
          compact ? styles.compactAmount : styles.transactionAmount,
          { color: amountColor }
        ]}>
          {loading ? '...' : formattedAmount}
        </Text>
        
        {/* Show original currency if different from primary */}
        {!loading && item.currency !== primaryCurrency && (
          <Text style={[styles.originalCurrency, { color: colors.subText }]}>
            {item.currency} {Math.abs(item.amount).toFixed(2)}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  compactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginHorizontal: 8,
    marginBottom: 6,
    borderRadius: 8,
  },
  transactionIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  transactionDetails: {
    flex: 1,
    marginRight: 12,
  },
  transactionNote: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  compactNote: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  transactionCategory: {
    fontSize: 14,
  },
  compactCategory: {
    fontSize: 12,
  },
  transactionAmountContainer: {
    alignItems: 'flex-end',
  },
  transactionAmount: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  compactAmount: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  originalCurrency: {
    fontSize: 11,
    marginTop: 2,
    opacity: 0.7,
  },
});

export default TransactionItem;
