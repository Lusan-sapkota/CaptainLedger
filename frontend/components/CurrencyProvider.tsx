import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import * as Localization from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import currencyService, { Currency } from '@/services/currencyService';
import currencyConversionManager from '@/services/currencyConversionManager';
import { useAlert } from './AlertProvider';
import { Alert } from 'react-native';

interface CurrencyContextType {
  primaryCurrency: string;
  setPrimaryCurrency: (currency: string) => Promise<void>;
  formatCurrency: (amount: number, currencyCode?: string) => Promise<string>;
  convertCurrency: (amount: number, fromCurrency: string, toCurrency?: string) => Promise<number>;
  currencies: Currency[];
  loading: boolean;
  refreshCurrencies: () => Promise<void>;
  getUserCountryCurrency: () => string;
  // Real-time conversion functions
  requestCurrencyConversion: (fromCurrency: string, toCurrency: string) => Promise<boolean>;
  isOnline: boolean;
  conversionInProgress: boolean;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

interface CurrencyProviderProps {
  children: ReactNode;
}

export const CurrencyProvider: React.FC<CurrencyProviderProps> = ({ children }) => {
  const [primaryCurrency, setPrimaryCurrencyState] = useState<string>('USD');
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(true);
  const [conversionInProgress, setConversionInProgress] = useState(false);
  const { showAlert } = useAlert();

  // Monitor network connectivity
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsOnline(state.isConnected || false);
    });

    return () => unsubscribe();
  }, []);

  // Get user's country-based currency from locale
  const getUserCountryCurrency = (): string => {
    try {
      const locale = Localization.getLocales()[0];
      const region = locale?.regionCode;
      
      // Map region codes to country names for our currency mapping
      const regionToCurrency: Record<string, string> = {
        'US': 'USD',
        'CA': 'CAD',
        'GB': 'GBP',
        'AU': 'AUD',
        'DE': 'EUR',
        'FR': 'EUR',
        'IT': 'EUR',
        'ES': 'EUR',
        'NL': 'EUR',
        'JP': 'JPY',
        'CN': 'CNY',
        'IN': 'INR',
        'NP': 'NPR',
        'PK': 'PKR',
        'BD': 'BDT',
        'LK': 'LKR',
        'KR': 'KRW',
        'SG': 'SGD',
        'TH': 'THB',
        'MY': 'MYR',
        'ID': 'IDR',
        'PH': 'PHP',
        'VN': 'VND',
        'BR': 'BRL',
        'MX': 'MXN',
        'AR': 'ARS',
        'CL': 'CLP',
        'CO': 'COP',
        'NO': 'NOK',
        'SE': 'SEK',
        'DK': 'DKK',
        'PL': 'PLN',
        'CZ': 'CZK',
        'HU': 'HUF',
        'RU': 'RUB',
        'ZA': 'ZAR',
        'NG': 'NGN',
        'EG': 'EGP',
        'AE': 'AED',
        'SA': 'SAR',
        'QA': 'QAR',
        'CH': 'CHF',
        'HK': 'HKD',
        'TW': 'TWD',
        'TR': 'TRY',
        'IL': 'ILS',
        'KW': 'KWD',
        'BH': 'BHD',
        'OM': 'OMR',
        'JO': 'JOD',
        'LB': 'LBP',
      };

      return regionToCurrency[region || ''] || 'USD';
    } catch (error) {
      console.error('Error detecting user currency:', error);
      return 'USD';
    }
  };

  // Initialize currency system
  useEffect(() => {
    const initializeCurrency = async () => {
      try {
        setLoading(true);
        
        // Check if user is authenticated before making API calls
        const authToken = await AsyncStorage.getItem('auth_token');
        const isAuthenticated = await AsyncStorage.getItem('is_authenticated');
        
        // Load available currencies (this endpoint doesn't require auth)
        const allCurrencies = await currencyService.getCurrencies();
        setCurrencies(allCurrencies);
        
        // Only fetch user preferences if authenticated
        let savedCurrency = 'USD'; // Default fallback
        
        if (authToken && isAuthenticated === 'true') {
          try {
            // Try to get user's saved primary currency
            savedCurrency = await currencyService.getPrimaryCurrency();
          } catch (error) {
            console.log('Could not fetch user currency preferences, using local storage fallback');
            // Fallback to local storage
            savedCurrency = await AsyncStorage.getItem('primary_currency') || 'USD';
          }
        } else {
          // For unauthenticated users, use local storage only
          savedCurrency = await AsyncStorage.getItem('primary_currency') || 'USD';
        }
        
        // Check if this is a first-time user with no saved preference
        const hasSavedPreference = await AsyncStorage.getItem('primary_currency');
        
        // Only auto-detect if there's no saved preference at all and user is authenticated
        if (!hasSavedPreference && authToken && isAuthenticated === 'true') {
          const detectedCurrency = getUserCountryCurrency();
          
          // Only set if we have the detected currency in our list and it's not USD
          const currencyExists = allCurrencies.some(c => c.code === detectedCurrency);
          if (currencyExists && detectedCurrency !== 'USD') {
            savedCurrency = detectedCurrency;
            try {
              await currencyService.setPrimaryCurrency(detectedCurrency);
              showAlert(
                'Currency Set',
                `We've set your primary currency to ${detectedCurrency} based on your location. You can change this in Settings.`,
                'info'
              );
            } catch (error) {
              console.log('Could not save currency preference to server, saving locally');
              await AsyncStorage.setItem('primary_currency', detectedCurrency);
            }
          }
        }
        
        setPrimaryCurrencyState(savedCurrency);
        console.log('Currency provider initialized with primary currency:', savedCurrency);
        console.log('Current primaryCurrency state after initialization:', savedCurrency);
      } catch (error) {
        console.error('Error initializing currency:', error);
        console.log('Currency initialization failed, staying with default USD');
        // Don't show alert for authentication errors during initialization
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (!errorMessage.includes('401') && !errorMessage.includes('Request failed with status code 401')) {
          showAlert('Currency Error', 'Could not load currency settings. Using USD as default.', 'error');
        }
      } finally {
        setLoading(false);
      }
    };

    initializeCurrency();
  }, []);

  // Set primary currency with real-time conversion support
  const setPrimaryCurrency = async (currency: string) => {
    try {
      await currencyService.setPrimaryCurrency(currency);
      setPrimaryCurrencyState(currency);
      
      // Cache locally
      await AsyncStorage.setItem('primary_currency', currency);
    } catch (error) {
      console.error('Error setting primary currency:', error);
      showAlert('Error', 'Could not update currency preference.', 'error');
      throw error;
    }
  };

  // Request currency conversion with connectivity handling
  const requestCurrencyConversion = async (fromCurrency: string, toCurrency: string): Promise<boolean> => {
    if (!isOnline) {
      // Show offline message and queue the conversion
      showAlert(
        'Offline Mode',
        'You need to be connected to the internet to do this task. We will do it for you after the connection is restored.',
        'info'
      );
      
      // Queue the conversion
      return await currencyConversionManager.requestCurrencyChange(fromCurrency, toCurrency, false);
    }

    return new Promise((resolve) => {
      Alert.alert(
        'Currency Conversion',
        'Proceed with the currency conversion as well? This will convert all your existing transactions, budgets, loans, and investments to the new currency.',
        [
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => resolve(false)
          },
          {
            text: 'Convert',
            onPress: async () => {
              setConversionInProgress(true);
              try {
                const success = await currencyConversionManager.performCurrencyConversion(fromCurrency, toCurrency);
                if (success) {
                  showAlert(
                    'Conversion Complete',
                    'All your financial data has been successfully converted to the new currency.',
                    'success'
                  );
                } else {
                  showAlert(
                    'Conversion Failed',
                    'There was an error converting your data. Please try again later.',
                    'error'
                  );
                }
                resolve(success);
              } catch (error) {
                console.error('Currency conversion error:', error);
                showAlert(
                  'Conversion Error',
                  'An unexpected error occurred during conversion.',
                  'error'
                );
                resolve(false);
              } finally {
                setConversionInProgress(false);
              }
            }
          }
        ]
      );
    });
  };

  // Format currency with the primary currency or specified currency
  const formatCurrency = async (amount: number, currencyCode?: string): Promise<string> => {
    const currency = currencyCode || primaryCurrency;
    return await currencyService.formatCurrency(amount, currency);
  };

  // Convert currency to primary currency or specified target currency
  const convertCurrency = async (
    amount: number, 
    fromCurrency: string, 
    toCurrency?: string
  ): Promise<number> => {
    const targetCurrency = toCurrency || primaryCurrency;
    return await currencyService.convertCurrency(amount, fromCurrency, targetCurrency);
  };

  // Refresh currencies from server
  const refreshCurrencies = async () => {
    try {
      setLoading(true);
      currencyService.clearCache();
      const allCurrencies = await currencyService.getCurrencies();
      setCurrencies(allCurrencies);
    } catch (error) {
      console.error('Error refreshing currencies:', error);
      showAlert('Error', 'Could not refresh currency data.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const value: CurrencyContextType = {
    primaryCurrency,
    setPrimaryCurrency,
    formatCurrency,
    convertCurrency,
    currencies,
    loading,
    refreshCurrencies,
    getUserCountryCurrency,
    requestCurrencyConversion,
    isOnline,
    conversionInProgress,
  };

  return (
    <CurrencyContext.Provider value={value}>
      {children}
    </CurrencyContext.Provider>
  );
};

export const useCurrency = (): CurrencyContextType => {
  const context = useContext(CurrencyContext);
  if (context === undefined) {
    throw new Error('useCurrency must be used within a CurrencyProvider');
  }
  return context;
};

export default CurrencyProvider;
