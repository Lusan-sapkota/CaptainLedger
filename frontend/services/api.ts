import axios, { AxiosResponse } from 'axios';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

// Configure baseURL based on platform
let baseURL: string;
if (Platform.OS === 'android') {
  // Use your actual machine IP for Android (works for both emulator and real device)
  baseURL = 'http://192.168.18.2:5000/api';
} else if (Platform.OS === 'ios') {
  // Use your actual machine IP for iOS as well
  baseURL = 'http://192.168.18.2:5000/api';
} else {
  // Web uses regular localhost
  baseURL = 'http://localhost:5000/api';
}

// Create our axios instance
const api = axios.create({
  baseURL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add request interceptor for auth token
api.interceptors.request.use(
  async (config) => {
    // Try to get the token from storage
    const token = await AsyncStorage.getItem('auth_token');
    
    // If token exists, add it to the headers
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    
    // Check for custom server IP
    const customServerIp = await AsyncStorage.getItem('server_ip');
    if (customServerIp) {
      config.baseURL = `http://${customServerIp}:5000/api`;
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add interfaces for database operations
export interface ImportOptions {
  merge_strategies: Array<{
    id: string;
    name: string;
    description: string;
  }>;
}

export interface ImportResult {
  success: boolean;
  message: string;
  records_imported: {
    transactions: number;
    categories: number;
    budgets: number;
    loans: number;
  };
  total_records: number;
}

// Get available import options
export const getImportOptions = (): Promise<AxiosResponse<ImportOptions>> => {
  return api.get('/data/import-options');
};

// Export database
export const exportDatabase = async () => {
  try {
    // Direct file download approach
    const token = await AsyncStorage.getItem('auth_token');
    
    // Use the URL instead of axios for direct download
    const baseUrl = api.defaults.baseURL?.replace('/api', '') || 'http://localhost:5000';
    const url = `${baseUrl}/api/data/export`;
    
    // For web platform
    if (Platform.OS === 'web') {
      // Create a link and click it programmatically
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `captainledger_data_${new Date().toISOString().split('T')[0]}.db`);
      
      // Handle auth header via fetch first
      await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }).then(response => response.blob())
        .then(blob => {
          const url = window.URL.createObjectURL(blob);
          link.setAttribute('href', url);
          link.click();
        });
    } else {
      // For mobile platforms
      const downloadDir = FileSystem.documentDirectory + 'downloads/';
      
      // Create downloads directory if it doesn't exist
      const dirInfo = await FileSystem.getInfoAsync(downloadDir);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(downloadDir, { intermediates: true });
      }
      
      const fileName = `captainledger_data_${new Date().toISOString().split('T')[0]}.db`;
      const fileUri = downloadDir + fileName;
      
      // Download file
      await FileSystem.downloadAsync(
        url, 
        fileUri,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      // Share the downloaded file
      await Sharing.shareAsync(fileUri);
    }
    
    return { success: true, message: 'Database exported successfully' };
  } catch (error) {
    console.error('Error exporting database:', error);
    throw error;
  }
};

// Import database (for web)
export const importDatabase = (file: File | Blob, mergeStrategy: string = 'newest_wins'): Promise<AxiosResponse<ImportResult>> => {
  const formData = new FormData();
  formData.append('file', file);
  
  return api.post(`/data/import?merge_strategy=${mergeStrategy}`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  });
};

// For mobile platforms
export const importDatabaseFromUri = async (fileUri: string, mergeStrategy: string = 'newest_wins'): Promise<ImportResult> => {
  try {
    // Get the auth token
    const token = await AsyncStorage.getItem('auth_token');
    
    // Create form data
    const formData = new FormData();
    
    // Add file to form data - the approach varies by platform
    if (Platform.OS === 'web') {
      throw new Error('importDatabaseFromUri is not supported on web. Use importDatabase instead.');
    } else {
      // For React Native
      const fileInfo = await FileSystem.getInfoAsync(fileUri);
      if (!fileInfo.exists) {
        throw new Error('File does not exist');
      }
      
      // Get file name from URI
      const fileName = fileUri.split('/').pop() || 'import.db';
      
      // Create the file object for the form data
      // @ts-ignore - React Native specific
      formData.append('file', {
        uri: fileUri,
        name: fileName,
        type: 'application/octet-stream'
      });
    }
    
    // Get the base URL
    const baseUrl = api.defaults.baseURL?.replace('/api', '') || 'http://localhost:5000';
    
    // Make the request using fetch API
    const response = await fetch(`${baseUrl}/api/data/import?merge_strategy=${mergeStrategy}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formData
    });
    
    if (!response.ok) {
      throw new Error(`Import failed with status: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error importing database:', error);
    throw error;
  }
};

// Correctly export UserProfile interface and getUserProfile function
export const getUserProfile = async () => {
  try {
    const token = await AsyncStorage.getItem('auth_token');
    if (!token) {
      return { status: 401, data: null };
    }

    // Check if api instance is available and properly initialized
    if (!api || typeof api.get !== 'function') {
      console.error('API instance not properly initialized');
      return { status: 500, data: null, error: 'API not initialized' };
    }

    const response = await api.get('/auth/profile');
    
    return { 
      status: response.status, 
      data: response.data
    };
  } catch (error) {
    console.error('Failed to fetch user profile:', error);
    
    if (error && typeof error === 'object' && 'response' in error) {
      const axiosError = error as any;
      return { 
        status: axiosError.response?.status || 500, 
        data: null 
      };
    } else {
      return { status: 500, data: null };
    }
  }
};

// Authentication functions
export const login = async (
  email: string, 
  password: string, 
  deviceId?: string, 
  isTrustedDevice: boolean = false
) => {
  try {
    const response = await api.post('/auth/login', {
      email,
      password,
      deviceId,
      isTrustedDevice
    });
    
    return response;
  } catch (error) {
    console.error('Login error:', error);
    throw error;
  }
};

export const register = async (
  email: string,
  password: string,
  fullName: string,
  country: string = 'Nepal',
  gender: string = ''
) => {
  try {
    const response = await api.post('/auth/register', {
      email,
      password,
      fullName,
      country,
      gender
    });
    
    return response;
  } catch (error) {
    console.error('Registration error:', error);
    throw error;
  }
};

export const verifyOtp = async (email: string, otp: string) => {
  try {
    const response = await api.post('/auth/verify-otp', {
      email,
      otp
    });
    
    return response.data;
  } catch (error) {
    console.error('OTP verification error:', error);
    throw error;
  }
};

export const resendOtp = async (email: string) => {
  try {
    const response = await api.post('/auth/resend-otp', { email });
    return response.data;
  } catch (error) {
    console.error('Resend OTP error:', error);
    throw error;
  }
};

export const getUserLoginHistory = async () => {
  try {
    const response = await api.get('/auth/login-history');
    return { status: response.status, data: response.data };
  } catch (error) {
    console.error('Failed to fetch login history:', error);
    return { status: 500, data: null };
  }
};

// Add this new function to remove trusted devices
export const removeTrustedDevice = async (deviceId: string) => {
  try {
    const response = await api.post('/auth/remove-device', { deviceId });
    return response.data;
  } catch (error) {
    console.error('Failed to remove trusted device:', error);
    throw error;
  }
};

export const updateProfile = async (profileData: any) => {
  try {
    const response = await api.put('/auth/update-profile', profileData);
    return response.data;
  } catch (error) {
    console.error('Profile update error:', error);
    throw error;
  }
};

// Upload profile picture
export const uploadProfilePicture = async (imageUri: string) => {
  try {
    const formData = new FormData();
    
    if (imageUri.startsWith('data:')) {
      // Handle data URL (common in web environment)
      console.log('Uploading data URL image');
      
      // Convert data URL to blob
      const response = await fetch(imageUri);
      const blob = await response.blob();
      
      // Generate filename and type
      const filename = `profile_${Date.now()}.jpg`;
      const type = blob.type || 'image/jpeg';
      
      formData.append('profile_picture', blob, filename);
    } else {
      // Handle file URI (mobile environments)
      console.log('Uploading file URI image');
      
      const filename = imageUri.split('/').pop() || 'profile.jpg';
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : 'image/jpeg';

      formData.append('profile_picture', {
        uri: imageUri,
        name: filename,
        type
      } as any);
    }

    const response = await api.post('/auth/upload-profile-picture', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    return response.data;
  } catch (error) {
    console.error('Profile picture upload error:', error);
    throw error;
  }
};

// Add near the top of the file
export const configureApi = (options: { baseURL?: string, timeout?: number } = {}) => {
  if (options.baseURL) {
    api.defaults.baseURL = options.baseURL;
  }
  
  if (options.timeout) {
    api.defaults.timeout = options.timeout;
  }
  
  return api;
};

// Add interfaces and types for transactions
export interface Transaction {
  id: string;
  amount: number;
  currency: string;
  date: string;
  category: string;
  note?: string;
  deadline?: string;
  transaction_type?: 'regular' | 'loan' | 'investment' | 'loan_repayment' | 'investment_return';
  interest_rate?: number;
  roi_percentage?: number;
  lender_name?: string;
  investment_platform?: string;
  status?: 'active' | 'repaid' | 'matured' | 'pending';
  linked_transaction_id?: string;
  created_at?: string;
  updated_at?: string;
}

export interface TransactionFilters {
  start_date?: string;
  end_date?: string;
  transaction_type?: string;
  category?: string;
}

// Transaction API functions
export const getTransactions = async (filters?: TransactionFilters) => {
  try {
    let url = '/transactions';
    if (filters) {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });
      if (params.toString()) {
        url += `?${params.toString()}`;
      }
    }
    
    const response = await api.get(url);
    return { 
      status: response.status, 
      data: response.data 
    };
  } catch (error) {
    console.error('Failed to fetch transactions:', error);
    throw error;
  }
};

export const createTransaction = async (transactionData: Partial<Transaction>) => {
  try {
    const response = await api.post('/transactions', transactionData);
    return { 
      status: response.status, 
      data: response.data 
    };
  } catch (error) {
    console.error('Failed to create transaction:', error);
    throw error;
  }
};

export const updateTransaction = async (id: string, transactionData: Partial<Transaction>) => {
  try {
    const response = await api.put(`/transactions/${id}`, transactionData);
    return { 
      status: response.status, 
      data: response.data 
    };
  } catch (error) {
    console.error('Failed to update transaction:', error);
    throw error;
  }
};

export const deleteTransaction = async (id: string) => {
  try {
    const response = await api.delete(`/transactions/${id}`);
    return { 
      status: response.status, 
      data: response.data 
    };
  } catch (error) {
    console.error('Failed to delete transaction:', error);
    throw error;
  }
};

export const getTransactionSummary = async (filters?: { start_date?: string; end_date?: string }) => {
  try {
    let url = '/transactions/analytics/summary';
    if (filters) {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });
      if (params.toString()) {
        url += `?${params.toString()}`;
      }
    }
    
    const response = await api.get(url);
    return { 
      status: response.status, 
      data: response.data 
    };
  } catch (error) {
    console.error('Failed to fetch transaction summary:', error);
    throw error;
  }
};

// Categories API functions
export const getCategoriesApi = async () => {
  try {
    const response = await api.get('/transactions/categories');
    return { 
      status: response.status, 
      data: response.data 
    };
  } catch (error) {
    console.error('Failed to fetch categories:', error);
    throw error;
  }
};

export const addCategory = async (categoryData: { name: string; color?: string; type?: string; icon?: string }) => {
  try {
    const response = await api.post('/transactions/categories', categoryData);
    return { 
      status: response.status, 
      data: response.data 
    };
  } catch (error) {
    console.error('Failed to add category:', error);
    throw error;
  }
};

export const deleteCategory = async (categoryName: string) => {
  try {
    const response = await api.delete(`/transactions/categories/${encodeURIComponent(categoryName)}`);
    return { 
      status: response.status, 
      data: response.data 
    };
  } catch (error) {
    console.error('Failed to delete category:', error);
    throw error;
  }
};

export const updateCategory = async (categoryName: string, categoryData: { name?: string; color?: string; type?: string; icon?: string }) => {
  try {
    const response = await api.put(`/transactions/categories/${encodeURIComponent(categoryName)}`, categoryData);
    return { 
      status: response.status, 
      data: response.data 
    };
  } catch (error) {
    console.error('Failed to update category:', error);
    throw error;
  }
};

// Loans API functions
export interface Loan {
  id: string;
  loan_type: 'given' | 'taken';
  amount: number;
  currency: string;
  contact: string;
  status: 'outstanding' | 'paid' | 'overdue';
  date: string;
  deadline?: string;
  interest_rate?: number;
  notes?: string;
  created_at?: string;
}

export const getLoans = async (params?: { status?: string; borrower?: string }) => {
  try {
    let url = '/loans';
    if (params) {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value) searchParams.append(key, value);
      });
      if (searchParams.toString()) {
        url += `?${searchParams.toString()}`;
      }
    }
    
    const response = await api.get(url);
    return { 
      status: response.status, 
      data: response.data 
    };
  } catch (error) {
    console.error('Failed to fetch loans:', error);
    throw error;
  }
};

export const createLoan = async (loanData: Partial<Loan>) => {
  try {
    const response = await api.post('/loans', loanData);
    return { 
      status: response.status, 
      data: response.data 
    };
  } catch (error) {
    console.error('Failed to create loan:', error);
    throw error;
  }
};

export const updateLoan = async (id: string, loanData: Partial<Loan>) => {
  try {
    const response = await api.put(`/loans/${id}`, loanData);
    return { 
      status: response.status, 
      data: response.data 
    };
  } catch (error) {
    console.error('Failed to update loan:', error);
    throw error;
  }
};

export const deleteLoan = async (id: string) => {
  try {
    const response = await api.delete(`/loans/${id}`);
    return { 
      status: response.status, 
      data: response.data 
    };
  } catch (error) {
    console.error('Failed to delete loan:', error);
    throw error;
  }
};

// Notifications API functions
export interface NotificationData {
  title: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
  user_id?: string;
}

export const createNotification = async (notificationData: NotificationData) => {
  try {
    const response = await api.post('/notifications', notificationData);
    return { 
      status: response.status, 
      data: response.data 
    };
  } catch (error) {
    console.error('Failed to create notification:', error);
    throw error;
  }
};

export const sendEmailNotification = async (emailData: { to: string; subject: string; message: string }) => {
  try {
    const response = await api.post('/notifications/email', emailData);
    return { 
      status: response.status, 
      data: response.data 
    };
  } catch (error) {
    console.error('Failed to send email notification:', error);
    throw error;
  }
};

// Budget API functions
export interface Budget {
  id: string;
  name: string;
  category: string;
  amount: number;
  spent_amount?: number;
  remaining_amount?: number;
  period: 'daily' | 'weekly' | 'monthly' | 'yearly';
  start_date?: string;
  end_date?: string;
  alert_threshold: number;
  is_active: boolean;
  currency: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  progress_percentage?: number;
  status?: string;
}

export interface BudgetFilters {
  period?: string;
  category?: string;
  active_only?: boolean;
}

export const getBudgets = async (filters?: BudgetFilters) => {
  try {
    let url = '/budget';
    if (filters) {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined) params.append(key, value.toString());
      });
      if (params.toString()) {
        url += `?${params.toString()}`;
      }
    }
    
    const response = await api.get(url);
    return { 
      status: response.status, 
      data: response.data 
    };
  } catch (error) {
    console.error('Failed to fetch budgets:', error);
    throw error;
  }
};

export const createBudget = async (budgetData: Partial<Budget>) => {
  try {
    const response = await api.post('/budget', budgetData);
    return { 
      status: response.status, 
      data: response.data 
    };
  } catch (error) {
    console.error('Failed to create budget:', error);
    throw error;
  }
};

export const updateBudget = async (id: string, budgetData: Partial<Budget>) => {
  try {
    const response = await api.put(`/budget/${id}`, budgetData);
    return { 
      status: response.status, 
      data: response.data 
    };
  } catch (error) {
    console.error('Failed to update budget:', error);
    throw error;
  }
};

export const deleteBudget = async (id: string) => {
  try {
    const response = await api.delete(`/budget/${id}`);
    return { 
      status: response.status, 
      data: response.data 
    };
  } catch (error) {
    console.error('Failed to delete budget:', error);
    throw error;
  }
};

export const getBudgetCategories = async () => {
  try {
    const response = await api.get('/budget/categories');
    return { 
      status: response.status, 
      data: response.data 
    };
  } catch (error) {
    console.error('Failed to fetch budget categories:', error);
    throw error;
  }
};

export const getBudgetAnalytics = async (period?: string) => {
  try {
    let url = '/budgets/analytics';
    if (period) {
      url += `?period=${period}`;
    }
    
    const response = await api.get(url);
    return { 
      status: response.status, 
      data: response.data 
    };
  } catch (error) {
    console.error('Failed to fetch budget analytics:', error);
    throw error;
  }
};

export const getBudgetSummary = async () => {
  try {
    const response = await api.get('/budgets/summary');
    return { 
      status: response.status, 
      data: response.data 
    };
  } catch (error) {
    console.error('Failed to fetch budget summary:', error);
    throw error;
  }
};

export const rolloverBudgets = async (data: { period?: string; budget_ids?: string[] }) => {
  try {
    const response = await api.post('/budgets/rollover', data);
    return { 
      status: response.status, 
      data: response.data 
    };
  } catch (error) {
    console.error('Failed to rollover budgets:', error);
    throw error;
  }
};

// Investment API functions
export interface Investment {
  id: string;
  name: string;
  platform?: string;
  investment_type?: string;
  initial_amount: number;
  current_value?: number;
  expected_roi?: number;
  actual_roi?: number;
  currency?: string;
  purchase_date: string;
  maturity_date?: string;
  status?: 'active' | 'matured' | 'sold';
  notes?: string;
  created_at?: string;
  updated_at?: string;
  days_held?: number;
  latest_roi_entry?: ROIEntry;
}

export interface ROIEntry {
  id: string;
  investment_id: string;
  recorded_value: number;
  price_per_unit?: number;
  quantity?: number;
  roi_percentage: number;
  gain_loss?: number;
  entry_date: string;
  note?: string;
  data_source?: string;
  created_at?: string;
}

export interface InvestmentAnalytics {
  total_investments: number;
  total_invested: number;
  total_current_value: number;
  total_roi_percentage: number;
  total_gain_loss: number;
  by_investment_type: Record<string, {
    count: number;
    total_invested: number;
    total_current_value: number;
    avg_roi: number;
  }>;
  best_performer?: {
    name: string;
    roi: number;
  };
  worst_performer?: {
    name: string;
    roi: number;
  };
}

export const getInvestments = async (params?: { status?: string; investment_type?: string }) => {
  try {
    let url = '/investments';
    if (params) {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value) searchParams.append(key, value);
      });
      if (searchParams.toString()) {
        url += `?${searchParams.toString()}`;
      }
    }
    
    const response = await api.get(url);
    return { 
      status: response.status, 
      data: response.data 
    };
  } catch (error) {
    console.error('Failed to fetch investments:', error);
    throw error;
  }
};

export const createInvestment = async (investmentData: Partial<Investment>) => {
  try {
    const response = await api.post('/investments', investmentData);
    return { 
      status: response.status, 
      data: response.data 
    };
  } catch (error) {
    console.error('Failed to create investment:', error);
    throw error;
  }
};

export const updateInvestment = async (id: string, investmentData: Partial<Investment>) => {
  try {
    const response = await api.put(`/investments/${id}`, investmentData);
    return { 
      status: response.status, 
      data: response.data 
    };
  } catch (error) {
    console.error('Failed to update investment:', error);
    throw error;
  }
};

export const deleteInvestment = async (id: string) => {
  try {
    const response = await api.delete(`/investments/${id}`);
    return { 
      status: response.status, 
      data: response.data 
    };
  } catch (error) {
    console.error('Failed to delete investment:', error);
    throw error;
  }
};

export const addROIEntry = async (investmentId: string, roiData: { recorded_value: number; entry_date: string; note?: string }) => {
  try {
    const response = await api.post(`/investments/${investmentId}/roi`, roiData);
    return { 
      status: response.status, 
      data: response.data 
    };
  } catch (error) {
    console.error('Failed to add ROI entry:', error);
    throw error;
  }
};

export const getROIHistory = async (investmentId: string) => {
  try {
    const response = await api.get(`/investments/${investmentId}/roi`);
    return { 
      status: response.status, 
      data: response.data 
    };
  } catch (error) {
    console.error('Failed to fetch ROI history:', error);
    throw error;
  }
};

export const getInvestmentAnalytics = async () => {
  try {
    const response = await api.get('/investments/analytics');
    return { 
      status: response.status, 
      data: response.data 
    };
  } catch (error) {
    console.error('Failed to fetch investment analytics:', error);
    throw error;
  }
};

// Export the api instance for use elsewhere
export default api;

