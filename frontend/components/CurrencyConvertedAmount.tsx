import React, { useState, useEffect } from 'react';
import { useCurrency } from '@/components/CurrencyProvider';
import currencyService from '@/services/currencyService';

interface CurrencyConvertedAmountProps {
  amount: number;
  currency?: string;
  style?: any;
  fallbackToOriginal?: boolean;
  showOriginal?: boolean;
}

export const CurrencyConvertedAmount: React.FC<CurrencyConvertedAmountProps> = ({
  amount,
  currency,
  style,
  fallbackToOriginal = true,
  showOriginal = false
}) => {
  const { formatCurrency, primaryCurrency } = useCurrency();
  const [convertedAmount, setConvertedAmount] = useState<number | null>(null);
  const [formattedAmount, setFormattedAmount] = useState<string>('');
  const [isConverting, setIsConverting] = useState(false);

  useEffect(() => {
    const convertAndFormat = async () => {
      if (!currency || currency === primaryCurrency) {
        // No conversion needed
        try {
          const formatted = await formatCurrency(amount);
          setFormattedAmount(formatted);
          setConvertedAmount(amount);
        } catch (error) {
          setFormattedAmount(fallbackToOriginal ? amount.toFixed(2) : '0.00');
        }
        return;
      }

      setIsConverting(true);
      try {
        const converted = await currencyService.convertCurrency(amount, currency, primaryCurrency);
        const formatted = await formatCurrency(converted);
        setFormattedAmount(formatted);
        setConvertedAmount(converted);
      } catch (error) {
        console.error('Error converting currency:', error);
        if (fallbackToOriginal) {
          try {
            const originalFormatted = await formatCurrency(amount, currency);
            setFormattedAmount(originalFormatted);
          } catch (formatError) {
            setFormattedAmount(`${currency} ${amount.toFixed(2)}`);
          }
        } else {
          setFormattedAmount('0.00');
        }
        setConvertedAmount(amount);
      } finally {
        setIsConverting(false);
      }
    };

    convertAndFormat();
  }, [amount, currency, primaryCurrency, formatCurrency, fallbackToOriginal]);

  if (isConverting) {
    return <span style={style}>...</span>;
  }

  return (
    <span style={style}>
      {formattedAmount}
      {showOriginal && currency && currency !== primaryCurrency && (
        <span style={{ fontSize: 12, opacity: 0.7, marginLeft: 4 }}>
          ({currency} {amount.toFixed(2)})
        </span>
      )}
    </span>
  );
};

interface CurrencyConvertedTotalProps {
  items: Array<{ amount: number; currency?: string }>;
  style?: any;
  label?: string;
}

export const CurrencyConvertedTotal: React.FC<CurrencyConvertedTotalProps> = ({
  items,
  style,
  label = 'Total'
}) => {
  const { formatCurrency, primaryCurrency } = useCurrency();
  const [total, setTotal] = useState<number>(0);
  const [formattedTotal, setFormattedTotal] = useState<string>('');
  const [isCalculating, setIsCalculating] = useState(false);

  useEffect(() => {
    const calculateTotal = async () => {
      if (!items.length) {
        setTotal(0);
        setFormattedTotal('0.00');
        return;
      }

      setIsCalculating(true);
      try {
        let totalConverted = 0;
        
        for (const item of items) {
          try {
            if (!item.currency || item.currency === primaryCurrency) {
              totalConverted += item.amount;
            } else {
              const converted = await currencyService.convertCurrency(
                item.amount, 
                item.currency, 
                primaryCurrency
              );
              totalConverted += converted;
            }
          } catch (error) {
            console.error('Error converting item:', error);
            totalConverted += item.amount; // fallback to original amount
          }
        }

        setTotal(totalConverted);
        const formatted = await formatCurrency(totalConverted);
        setFormattedTotal(formatted);
      } catch (error) {
        console.error('Error calculating total:', error);
        const fallbackTotal = items.reduce((sum, item) => sum + item.amount, 0);
        setTotal(fallbackTotal);
        setFormattedTotal(fallbackTotal.toFixed(2));
      } finally {
        setIsCalculating(false);
      }
    };

    calculateTotal();
  }, [items, primaryCurrency, formatCurrency]);

  if (isCalculating) {
    return (
      <span style={style}>
        {label}: ...
      </span>
    );
  }

  return (
    <span style={style}>
      {label}: {formattedTotal}
    </span>
  );
};
