import AsyncStorage from '@react-native-async-storage/async-storage';
import { getCurrencies, getExchangeRate, updateCurrencyPreferences, getUserCurrencyPreferences } from './api';

export interface Currency {
  id: string;
  code: string;
  name: string;
  symbol: string;
  country: string;
  decimal_places: number;
  is_active: boolean;
}

export interface ExchangeRate {
  id: string;
  from_currency: string;
  to_currency: string;
  rate: number;
  date: string;
  source: string;
}

export interface CurrencyPreference {
  id: string;
  currency_code: string;
  is_primary: boolean;
  display_order: number;
}

// Currency mapping based on country
export const COUNTRY_CURRENCY_MAP: Record<string, string> = {
  'United States': 'USD',
  'Canada': 'CAD',
  'United Kingdom': 'GBP',
  'Australia': 'AUD',
  'Germany': 'EUR',
  'France': 'EUR',
  'Italy': 'EUR',
  'Spain': 'EUR',
  'Japan': 'JPY',
  'China': 'CNY',
  'India': 'INR',
  'Nepal': 'NPR',
  'Pakistan': 'PKR',
  'Bangladesh': 'BDT',
  'Sri Lanka': 'LKR',
  'South Korea': 'KRW',
  'Singapore': 'SGD',
  'Thailand': 'THB',
  'Malaysia': 'MYR',
  'Indonesia': 'IDR',
  'Brazil': 'BRL',
  'Mexico': 'MXN',
  'South Africa': 'ZAR',
  'Nigeria': 'NGN',
  'United Arab Emirates': 'AED',
  'Saudi Arabia': 'SAR',
  'Switzerland': 'CHF',
  'Norway': 'NOK',
  'Sweden': 'SEK',
  'Russia': 'RUB',
};

class CurrencyService {
  private exchangeRateCache: Map<string, ExchangeRate> = new Map();
  private currencyCache: Currency[] | null = null;
  private lastCacheUpdate: Date | null = null;
  private lastCurrencyCacheUpdate: Date | null = null;
  private cacheExpiry = 1000 * 60 * 60; // 1 hour
  private currencyCacheExpiry = 1000 * 60 * 60 * 24; // 24 hours for currencies

  // Get all available currencies with caching
  async getCurrencies(): Promise<Currency[]> {
    try {
      // Check if we have valid cached currencies
      if (this.currencyCache && this.isCurrencyCacheValid()) {
        return this.currencyCache;
      }

      const response = await getCurrencies();
      const apiCurrencies = response.data.currencies;
      let currenciesToCache: Currency[];

      if (apiCurrencies) {
        // Map from the API's Currency type to this service's Currency type.
        // The API's Currency type (from api.ts) is missing id, country, decimal_places, is_active.
        // We assume code, name, symbol are present in apiCurrencies objects.
        currenciesToCache = apiCurrencies.map((apiObj: any) => ({
          id: apiObj.id ?? `api-${apiObj.code}`, // Provide a default if id is missing
          code: apiObj.code,
          name: apiObj.name,
          symbol: apiObj.symbol,
          country: apiObj.country ?? '', // Provide a default if country is missing
          decimal_places: apiObj.decimal_places ?? 2, // Provide a default if decimal_places is missing
          is_active: apiObj.is_active ?? true, // Provide a default if is_active is missing
        }));
      } else {
        currenciesToCache = this.getDefaultCurrencies();
      }
      
      // Cache the currencies
      this.currencyCache = currenciesToCache;
      this.lastCurrencyCacheUpdate = new Date();
      
      return currenciesToCache;
    } catch (error) {
      console.error('Error fetching currencies:', error);
      // Return cached data if available, otherwise default
      return this.currencyCache || this.getDefaultCurrencies();
    }
  }

  // Get user's currency preferences
  async getUserCurrencyPreferences(): Promise<CurrencyPreference[]> {
    try {
      console.log('Fetching user currency preferences from API...');
      const response = await getUserCurrencyPreferences();
      console.log('API response:', response.data);
      
      // Map API preferences to local CurrencyPreference type
      const apiPreferences = response.data.preferences || [];
      console.log('API preferences:', apiPreferences);
      
      const mapped = apiPreferences.map((pref: any) => ({
        id: pref.id ?? '',
        currency_code: pref.currency_code ?? pref.code ?? '',
        is_primary: pref.is_primary ?? false,
        display_order: pref.display_order ?? 0,
      }));
      console.log('Mapped preferences:', mapped);
      
      return mapped;
    } catch (error) {
      console.error('Error fetching currency preferences:', error);
      return [];
    }
  }

  // Set user's primary currency
  async setPrimaryCurrency(currencyCode: string): Promise<void> {
    try {
      await updateCurrencyPreferences({
        primary_currency: currencyCode
      });
      
      // Cache locally
      await AsyncStorage.setItem('primary_currency', currencyCode);
    } catch (error) {
      console.error('Error setting primary currency:', error);
      throw error;
    }
  }

  // Get user's primary currency
  async getPrimaryCurrency(): Promise<string> {
    try {
      console.log('Getting primary currency...');
      
      // First check local cache
      const cached = await AsyncStorage.getItem('primary_currency');
      console.log('Cached primary currency:', cached);
      
      if (cached) return cached;

      // Then check user preferences from API
      console.log('No cached currency, fetching from API...');
      const preferences = await this.getUserCurrencyPreferences();
      console.log('API preferences:', preferences);
      
      const primary = preferences.find(p => p.is_primary);
      console.log('Primary preference found:', primary);
      
      if (primary) {
        console.log('Setting cached currency to:', primary.currency_code);
        await AsyncStorage.setItem('primary_currency', primary.currency_code);
        return primary.currency_code;
      }

      // Fallback to USD
      console.log('No primary preference found, falling back to USD');
      return 'USD';
    } catch (error) {
      console.error('Error getting primary currency:', error);
      return 'USD';
    }
  }

  // Get currency based on user's country
  getCurrencyByCountry(country: string): string {
    return COUNTRY_CURRENCY_MAP[country] || 'USD';
  }

  // Get exchange rate between two currencies
  async getExchangeRate(fromCurrency: string, toCurrency: string): Promise<number> {
    if (fromCurrency === toCurrency) return 1;

    const cacheKey = `${fromCurrency}-${toCurrency}`;
    
    // Check cache first
    const cached = this.exchangeRateCache.get(cacheKey);
    if (cached && this.isCacheValid()) {
      return cached.rate;
    }

    try {
      const response = await getExchangeRate(fromCurrency, toCurrency);
      const rate = response.data.rate;
      
      // Cache the result
      this.exchangeRateCache.set(cacheKey, {
        id: '',
        from_currency: fromCurrency,
        to_currency: toCurrency,
        rate: rate,
        date: new Date().toISOString(),
        source: 'api'
      });
      this.lastCacheUpdate = new Date();
      
      return rate;
    } catch (error) {
      console.error('Error fetching exchange rate:', error);
      // Return fallback rate (you might want to implement offline rates)
      return 1;
    }
  }

  // Enhanced conversion with better caching and fallbacks
  async convertCurrency(amount: number, fromCurrency: string, toCurrency?: string): Promise<number> {
    if (!toCurrency) {
      toCurrency = await this.getPrimaryCurrency();
    }
    
    if (fromCurrency === toCurrency) return amount;
    
    const rate = await this.getExchangeRate(fromCurrency, toCurrency);
    return amount * rate;
  }

  // Convert multiple amounts with single API call when possible
  async convertMultiple(items: Array<{amount: number, currency: string}>): Promise<Array<{amount: number, convertedAmount: number}>> {
    const primaryCurrency = await this.getPrimaryCurrency();
    const results = [];
    
    for (const item of items) {
      try {
        const convertedAmount = await this.convertCurrency(item.amount, item.currency, primaryCurrency);
        results.push({
          amount: item.amount,
          convertedAmount
        });
      } catch (error) {
        console.error('Error converting amount:', error);
        results.push({
          amount: item.amount,
          convertedAmount: item.amount // fallback to original amount
        });
      }
    }
    
    return results;
  }

  // Bulk convert multiple items efficiently
  async convertBulk(items: Array<{
    item_id: string;
    item_type: string;
    amount: number;
    from_currency: string;
    to_currency: string;
  }>): Promise<Array<{
    item_id: string;
    item_type: string;
    success: boolean;
    original_amount?: number;
    converted_amount?: number;
    from_currency?: string;
    to_currency?: string;
    exchange_rate?: number;
    error?: string;
  }>> {
    try {
      const { convertBulkCurrency } = await import('./api');
      const response = await convertBulkCurrency(items);
      return response.data.conversions;
    } catch (error) {
      console.error('Error in bulk currency conversion:', error);
      
      // Fallback to individual conversions
      const results = [];
      for (const item of items) {
        try {
          const convertedAmount = await this.convertCurrency(
            item.amount, 
            item.from_currency, 
            item.to_currency
          );
          const rate = item.from_currency === item.to_currency ? 1 : convertedAmount / item.amount;
          
          results.push({
            item_id: item.item_id,
            item_type: item.item_type,
            success: true,
            original_amount: item.amount,
            converted_amount: convertedAmount,
            from_currency: item.from_currency,
            to_currency: item.to_currency,
            exchange_rate: rate
          });
        } catch (conversionError) {
          results.push({
            item_id: item.item_id,
            item_type: item.item_type,
            success: false,
            error: 'Conversion failed'
          });
        }
      }
      return results;
    }
  }

  // Format currency amount with proper symbol and decimal places
  async formatCurrency(amount: number, currencyCode: string): Promise<string> {
    try {
      const currencies = await this.getCurrencies();
      const currency = currencies.find(c => c.code === currencyCode);
      
      if (currency) {
        const formatted = amount.toFixed(currency.decimal_places);
        return `${currency.symbol}${formatted}`;
      }
      
      // Fallback formatting
      return `${currencyCode} ${amount.toFixed(2)}`;
    } catch (error) {
      return `${currencyCode} ${amount.toFixed(2)}`;
    }
  }

  // Clear all caches (useful for logout or data refresh)
  clearCache(): void {
    this.exchangeRateCache.clear();
    this.currencyCache = null;
    this.lastCacheUpdate = null;
    this.lastCurrencyCacheUpdate = null;
  }

  // Get default currencies for offline use
  private getDefaultCurrencies(): Currency[] {
    return [
      { id: '1', code: 'USD', name: 'US Dollar', symbol: '$', country: 'United States', decimal_places: 2, is_active: true },
      { id: '2', code: 'EUR', name: 'Euro', symbol: '€', country: 'Eurozone', decimal_places: 2, is_active: true },
      { id: '3', code: 'GBP', name: 'British Pound', symbol: '£', country: 'United Kingdom', decimal_places: 2, is_active: true },
      { id: '4', code: 'JPY', name: 'Japanese Yen', symbol: '¥', country: 'Japan', decimal_places: 0, is_active: true },
      { id: '5', code: 'NPR', name: 'Nepalese Rupee', symbol: 'Rs.', country: 'Nepal', decimal_places: 2, is_active: true },
      { id: '6', code: 'INR', name: 'Indian Rupee', symbol: '₹', country: 'India', decimal_places: 2, is_active: true },
    ];
  }

  private isCacheValid(): boolean {
    if (!this.lastCacheUpdate) return false;
    return (Date.now() - this.lastCacheUpdate.getTime()) < this.cacheExpiry;
  }

  private isCurrencyCacheValid(): boolean {
    if (!this.lastCurrencyCacheUpdate) return false;
    return (Date.now() - this.lastCurrencyCacheUpdate.getTime()) < this.currencyCacheExpiry;
  }
}

// Export a singleton instance
export const currencyService = new CurrencyService();
export default currencyService;

