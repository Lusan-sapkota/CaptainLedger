import axios, { AxiosResponse } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import * as Device from 'expo-device';

// Default backend URL - different for iOS simulator vs Android emulator
const getDefaultApiUrl = () => {
  const LOCAL_PORT = '5000';
  
  if (Platform.OS === 'web') {
    return `http://localhost:${LOCAL_PORT}/api`;
  } else if (Platform.OS === 'ios') {
    // For iOS devices & simulator
    return `http://localhost:${LOCAL_PORT}/api`;
  } else if (Platform.OS === 'android') {
    // For Android emulator
    return `http://10.0.2.2:${LOCAL_PORT}/api`;
  } else {
    // For Expo Go on physical devices, use your computer's local IP address
    // Replace with your actual local network IP
    return `http://192.168.18.2:${LOCAL_PORT}/api`;
  }
};

const api = axios.create({
  baseURL: getDefaultApiUrl(),
  withCredentials: true, // This is crucial for CORS with credentials
  headers: {
    'Content-Type': 'application/json',
  }
});

// Add request interceptor to include auth token on every request
api.interceptors.request.use(
  async config => {
    const token = await AsyncStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  error => Promise.reject(error)
);

// Update your interceptor to be more resilient
api.interceptors.response.use(
  response => response,
  async error => {
    // Only redirect on genuine auth failures, not server errors
    if (error.response?.status === 401) {
      // Handle authentication errors
      await AsyncStorage.multiRemove([
        'auth_token', 'user_id', 'is_authenticated'
      ]);
      
      // Don't redirect if we're already on auth page
      const currentPath = window.location?.pathname || '';
      if (!currentPath.includes('/auth')) {
        if (window.location) {
          window.location.href = '/auth';
        }
      }
    }
    return Promise.reject(error);
  }
);

// Auth Types
interface AuthResponse {
  message: string;
  user: {
    id: string;
    email: string;
  };
  token: string;
}

// Update the UserProfile interface to match the backend response
interface UserProfile {
  id: string;
  email: string;
  full_name?: string; // from backend
  fullName?: string;  // Local storage version
  displayName?: string; // Add this property to fix the error
  country?: string;
  gender?: string;
  phone_number?: string;
  bio?: string;
  profile_picture?: string;
  last_login?: string;
  last_login_ip?: string;
  last_login_device?: string;
  last_login_location?: string;
  is_active?: boolean;
  is_verified?: boolean;
  created_at?: string;
  last_sync?: string | null;
}

// Auth APIs
export const register = async (email: string, password: string, fullName: string = '', country: string = 'Nepal', gender: string = '') => {
  try {
    const response = await api.post('/auth/register', {
      email,
      password,
      fullName,
      country,
      gender
    });
    
    console.log('Registration API response:', response.data);
    return response.data;
  } catch (error) {
    console.error('Registration API error:', error);
    throw error;
  }
};

export const login = async (email: string, password: string, deviceId?: string, isTrustedDevice?: boolean) => {
  try {
    const response = await api.post('/auth/login', {
      email,
      password,
      deviceId, // Pass the device ID to the API
      isTrustedDevice // Pass the trusted device flag
    });
    
    return response;
  } catch (error) {
    console.error('Login error:', error);
    throw error;
  }
};

export const getUserProfile = (): Promise<AxiosResponse<UserProfile>> => {
  return api.get<UserProfile>('/auth/profile');
};

// Transaction Types

// Interface for the structure of a transaction object returned by the API
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
  // Add investment-specific fields
  investment_id?: string;  // Link to Investment model
  investment_name?: string;
}

// Add Loan interface
export interface Loan {
  id: string;
  loan_type: 'given' | 'taken';
  amount: number;
  currency: string;
  contact?: string;
  status: 'outstanding' | 'paid';
  date: string;
  deadline?: string;
  interest_rate?: number;
  created_at?: string;
}

// Interface for API response with transactions
interface TransactionsResponse {
  transactions: Transaction[];
}

// Interface for the payload required to create a new transaction
export interface CreateTransactionPayload {
  amount: number;
  currency?: string;
  date: string;
  category?: string;
  note?: string;
}

// Interface for the payload required to update an existing transaction
export interface UpdateTransactionPayload {
  amount?: number;
  currency?: string;
  date?: string;
  category?: string;
  note?: string;
}

// Interface for single transaction response
interface TransactionResponse {
  message: string;
  transaction: Transaction;
}

// Transaction APIs
export const getTransactions = (filters: {
  category?: string;
  start_date?: string;
  end_date?: string;
} = {}): Promise<AxiosResponse<TransactionsResponse>> => {
  return api.get<TransactionsResponse>('/transactions', { params: filters });
};

export const createTransaction = (transactionData: Partial<Transaction>): Promise<AxiosResponse> => {
  return api.post('/transactions', transactionData);
};

export const updateTransaction = (id: string, transactionData: Partial<Transaction>): Promise<AxiosResponse> => {
  return api.put(`/transactions/${id}`, transactionData);
};

export const deleteTransaction = (id: string): Promise<AxiosResponse> => {
  return api.delete(`/transactions/${id}`);
};

// Sync Types
interface SyncUploadResponse {
  message: string;
  last_sync: string;
}

interface SyncDownloadResponse {
  transactions: Transaction[];
  last_sync: string;
}

// Sync APIs
export const uploadData = (data: {transactions?: Transaction[]}): Promise<AxiosResponse<SyncUploadResponse>> => {
  return api.post<SyncUploadResponse>('/sync/upload', data);
};

export const downloadData = (lastSync?: string): Promise<AxiosResponse<SyncDownloadResponse>> => {
  return api.get<SyncDownloadResponse>('/sync/download', { 
    params: { last_sync: lastSync } 
  });
};

// Update API base URL (for when user sets their own server)
export const updateServerURL = async (url: string): Promise<void> => {
  // Store server URL
  await AsyncStorage.setItem('server_url', url);
  // Update axios instance
  api.defaults.baseURL = `${url}/api`;
};

// Initialize from stored settings
export const initializeApi = async (): Promise<void> => {
  try {
    // Add a timeout for this operation
    const timeoutPromise = new Promise<void>((_, reject) => 
      setTimeout(() => reject(new Error('API initialization timeout')), 3000)
    );
    
    const initPromise = async () => {
      const serverUrl = await AsyncStorage.getItem('server_url');
      if (serverUrl) {
        api.defaults.baseURL = `${serverUrl}/api`;
      }
      // Add a timeout to all requests
      api.defaults.timeout = 5000; // 5 seconds timeout
    };
    
    // Race between initialization and timeout
    await Promise.race([initPromise(), timeoutPromise]);
  } catch (error) {
    console.error('Error initializing API:', error);
    // Ensure we're using default URL when there's an error
    api.defaults.baseURL = getDefaultApiUrl();
    api.defaults.timeout = 5000;
  }
};

// Function to check if backend is available
export const isBackendAvailable = async (): Promise<boolean> => {
  try {
    const response = await fetch(`${api.defaults.baseURL}/status`, { 
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    
    return response.status === 200;
  } catch (error) {
    console.log('Backend not available:', error);
    return false;
  }
};

// Add this function to help test if routes are working

// Function to check if a route exists
export const checkRouteExists = (route: string): boolean => {
  const availableRoutes = [
    '/terms',
    '/privacy', 
    '/documentation',
    '/auth',
    '/'
  ];
  
  return availableRoutes.includes(route);
};

// OTP verification interfaces
interface VerifyOtpRequest {
  email: string;
  otp: string;
}

interface VerifyOtpResponse {
  success: boolean;
  message: string;
  verified: boolean;
}

interface ResendOtpResponse {
  success: boolean;
  message: string;
}

// OTP verification APIs
export const verifyOtp = async (email: string, otp: string) => {
  const response = await api.post('/auth/verify-otp', { email, otp });
  return response.data;
};

export const resendOtp = async (email: string) => {
  const response = await api.post('/auth/resend-otp', { email });
  return response.data;
};

// Profile Types
interface UpdateProfileRequest {
  full_name?: string;
  bio?: string;
  phone_number?: string;
  country?: string;
  gender?: string;
}

interface ProfileUpdateResponse {
  message: string;
  user: UserProfile;
}

interface ProfilePictureUploadResponse {
  message: string;
  profile_picture_url: string;
}

// Profile APIs
export const updateProfile = (profileData: UpdateProfileRequest): Promise<AxiosResponse<ProfileUpdateResponse>> => {
  return api.put<ProfileUpdateResponse>('/auth/update-profile', profileData);
};

export const uploadProfilePicture = async (imageUri: string): Promise<string> => {
  // Create form data for file upload
  const formData = new FormData();
  
  // Extract filename from image URI
  const uriParts = imageUri.split('/');
  const fileName = uriParts[uriParts.length - 1];
  
  // On web, we might need to do a fetch of the image to get a blob
  let fileBlob;
  if (Platform.OS === 'web') {
    const response = await fetch(imageUri);
    fileBlob = await response.blob();
  }
  
  // Append the image to form data
  formData.append('profile_picture', Platform.OS === 'web' 
    ? fileBlob 
    : {
        uri: imageUri,
        name: fileName,
        type: 'image/jpeg', // Adjust based on your image type
      } as any);
  
  // Make the API request
  const response = await api.post<ProfilePictureUploadResponse>(
    '/auth/upload-profile-picture', 
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }
  );
  
  return response.data.profile_picture_url;
};

// Add this function
export const getUserLoginHistory = async (): Promise<AxiosResponse<any[]>> => {
  return api.get('/auth/login-history');
};

// Interface for API response with categories
export interface Category {
  name: string;
  color: string;
}

interface CategoriesResponse {
  categories: Category[];
}

// Get categories API function
export const getCategoriesApi = (): Promise<AxiosResponse<CategoriesResponse>> => {
  return api.get<CategoriesResponse>('/transactions/categories')
    .catch(error => {
      console.error('Error loading categories:', error);
      // Return a default response with empty categories to prevent crashes
      return {
        data: { categories: [] },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: { headers: {} as import('axios').AxiosRequestHeaders }
      };
    });
};

// Add this to the existing API functions
export const registerTrustedDevice = async (userId: string, deviceId: string) => {
  try {
    const response = await api.post('/auth/register-device', {
      userId,
      deviceId,
      deviceInfo: {
        platform: Platform.OS,
        name: Device.modelName || 'Unknown device',
        timestamp: new Date().toISOString()
      }
    });
    return response.data;
  } catch (error) {
    console.error('Failed to register trusted device:', error);
    // Don't throw - this is non-critical
    return null;
  }
};

export const removeTrustedDevice = async (deviceId: string) => {
  try {
    const response = await api.post('/auth/remove-device', {
      deviceId
    });
    return response.data;
  } catch (error) {
    console.error('Failed to remove trusted device:', error);
    throw error;
  }
};

// Add this to the existing API functions
export const addCategory = async (
  name: string, 
  color: string, 
  type: 'income' | 'expense' = 'expense'
): Promise<AxiosResponse<any>> => {
  return api.post('/transactions/categories', {
    name,
    color,
    type
  });
};

export const deleteCategory = async (categoryName: string): Promise<AxiosResponse<any>> => {
  return api.delete(`/transactions/categories/${categoryName}`);
};

export const getCategories = async (): Promise<AxiosResponse<any>> => {
  return api.get('/transactions/categories');
};

// Budget Types
export interface Budget {
  id: string;
  category: string;
  amount: number;
  period: string;
}

export const updateCategory = async (
  originalName: string,
  updatedCategory: {
    name: string;
    color: string;
    type: 'income' | 'expense';
  }
): Promise<AxiosResponse<any>> => {
  return api.put(`/transactions/categories/${originalName}`, updatedCategory);
};

// Allow API client to use device's network IP when running in Expo Go
export const configureApiForDevice = async (ip?: string) => {
  // If IP is provided (from device settings), use it
  if (ip) {
    api.defaults.baseURL = `http://${ip}:5000/api`;
    await AsyncStorage.setItem('api_base_url', api.defaults.baseURL);
    console.log('API base URL set to:', api.defaults.baseURL);
    return;
  }
  
  // Try to get saved IP from storage
  const savedBaseUrl = await AsyncStorage.getItem('api_base_url');
  if (savedBaseUrl) {
    api.defaults.baseURL = savedBaseUrl;
    console.log('Using saved API base URL:', api.defaults.baseURL);
  }
};

export async function createNotification(notificationData: {
  title: string;
  message: string;
  type: string;
}) {
  try {
    const response = await api.post('/notifications', notificationData);
    return response;
  } catch (error) {
    console.error('Error creating notification:', error);
    throw error;
  }
}

export async function sendEmailNotification(emailData: {
  type: string;
  data: any;
}) {
  try {
    const response = await api.post('/notifications/email', emailData);
    return response;
  } catch (error) {
    console.error('Error sending email notification:', error);
    throw error;
  }
}

interface LoansResponse {
  loans: Loan[];
}

// Add this function to your exported API functions
export const getLoans = (params?: { status?: string; loan_type?: string }): Promise<AxiosResponse<{ loans: Loan[] }>> => {
  const searchParams = new URLSearchParams();
  if (params?.status) searchParams.append('status', params.status);
  if (params?.loan_type) searchParams.append('loan_type', params.loan_type);
  
  const queryString = searchParams.toString();
  return api.get<{ loans: Loan[] }>(`/loans${queryString ? `?${queryString}` : ''}`);
};

export const createLoan = (loanData: Partial<Loan>): Promise<AxiosResponse> => {
  return api.post('/loans', loanData);
};

export const updateLoan = (id: string, loanData: Partial<Loan>): Promise<AxiosResponse> => {
  return api.put(`/loans/${id}`, loanData);
};

export const deleteLoan = (id: string): Promise<AxiosResponse> => {
  return api.delete(`/loans/${id}`);
};

// Analytics functions
export const getTransactionSummary = (params?: { start_date?: string; end_date?: string }): Promise<AxiosResponse> => {
  const searchParams = new URLSearchParams();
  if (params?.start_date) searchParams.append('start_date', params.start_date);
  if (params?.end_date) searchParams.append('end_date', params.end_date);
  
  const queryString = searchParams.toString();
  return api.get(`/transactions/analytics/summary${queryString ? `?${queryString}` : ''}`);
};

// Investment interfaces
export interface Investment {
  id: string;
  name: string;
  platform?: string;
  investment_type?: string;
  initial_amount: number;
  current_value?: number;
  expected_roi?: number;
  actual_roi?: number;
  currency: string;
  purchase_date: string;
  maturity_date?: string;
  status: 'active' | 'matured' | 'sold' | 'partial_sold';
  notes?: string;
  days_held?: number;
  latest_roi_entry?: ROIEntry;
  created_at?: string;
  updated_at?: string;
}

export interface ROIEntry {
  id: string;
  recorded_value: number;
  roi_percentage: number;
  entry_date: string;
  note?: string;
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

// Investment API functions
export const getInvestments = (params?: { 
  status?: string; 
  investment_type?: string; 
}): Promise<AxiosResponse<{ investments: Investment[] }>> => {
  const searchParams = new URLSearchParams();
  if (params?.status) searchParams.append('status', params.status);
  if (params?.investment_type) searchParams.append('investment_type', params.investment_type);
  
  const queryString = searchParams.toString();
  return api.get<{ investments: Investment[] }>(`/investments${queryString ? `?${queryString}` : ''}`);
};

export const createInvestment = (investmentData: Partial<Investment>): Promise<AxiosResponse> => {
  return api.post('/investments', investmentData);
};

export const updateInvestment = (id: string, investmentData: Partial<Investment>): Promise<AxiosResponse> => {
  return api.put(`/investments/${id}`, investmentData);
};

export const deleteInvestment = (id: string): Promise<AxiosResponse> => {
  return api.delete(`/investments/${id}`);
};

// ROI tracking functions
export const addROIEntry = (investmentId: string, roiData: {
  recorded_value: number;
  entry_date: string;
  note?: string;
}): Promise<AxiosResponse> => {
  return api.post(`/investments/${investmentId}/roi`, roiData);
};

export const getROIHistory = (investmentId: string): Promise<AxiosResponse<{
  roi_history: ROIEntry[];
  investment_name: string;
  total_entries: number;
}>> => {
  return api.get(`/investments/${investmentId}/roi`);
};

// Account interfaces
export interface Account {
  id: string;
  name: string;
  account_type: 'checking' | 'savings' | 'credit_card' | 'investment' | 'cash';
  account_number?: string;
  bank_name?: string;
  balance: number;
  currency: string;
  is_primary: boolean;
  is_active: boolean;
  credit_limit?: number;
  interest_rate?: number;
  opening_date?: string;
  notes?: string;
  icon: string;
  color: string;
  created_at: string;
  updated_at: string;
}

// Budget interfaces
export interface Budget {
  id: string;
  name: string;
  category: string;
  amount: number;
  currency: string;
  period: string;
  start_date: string;
  end_date?: string;
  spent_amount: number;
  remaining_amount: number;
  alert_threshold: number;
  is_active: boolean;
  auto_rollover: boolean;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface BudgetAlert {
  id: string;
  budget_id: string;
  alert_type: 'threshold' | 'exceeded' | 'depleted';
  percentage_used: number;
  amount_spent: number;
  triggered_at: string;
  is_read: boolean;
  message: string;
}

// Goal interfaces
export interface Goal {
  id: string;
  name: string;
  description?: string;
  target_amount: number;
  current_amount: number;
  currency: string;
  target_date?: string;
  category?: string;
  priority: 'low' | 'medium' | 'high';
  status: 'active' | 'completed' | 'paused' | 'cancelled';
  auto_contribute: boolean;
  contribution_amount?: number;
  contribution_frequency?: string;
  created_at: string;
  updated_at: string;
  completed_at?: string;
}

// Notification interfaces
export interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  category?: string;
  is_read: boolean;
  is_email_sent: boolean;
  is_push_sent: boolean;
  data?: string;
  expires_at?: string;
  created_at: string;
  read_at?: string;
}

// API Functions for Accounts
export const getAccounts = (): Promise<AxiosResponse<{ accounts: Account[] }>> => {
  return api.get('/accounts');
};

export const createAccount = (accountData: Partial<Account>): Promise<AxiosResponse> => {
  return api.post('/accounts', accountData);
};

export const updateAccount = (id: string, accountData: Partial<Account>): Promise<AxiosResponse> => {
  return api.put(`/accounts/${id}`, accountData);
};

export const deleteAccount = (id: string): Promise<AxiosResponse> => {
  return api.delete(`/accounts/${id}`);
};

// API Functions for Budgets
export const getBudgets = (): Promise<AxiosResponse<{ budgets: Budget[] }>> => {
  return api.get('/budgets');
};

export const createBudget = (budgetData: Partial<Budget>): Promise<AxiosResponse> => {
  return api.post('/budgets', budgetData);
};

export const updateBudget = (id: string, budgetData: Partial<Budget>): Promise<AxiosResponse> => {
  return api.put(`/budgets/${id}`, budgetData);
};

export const deleteBudget = (id: string): Promise<AxiosResponse> => {
  return api.delete(`/budgets/${id}`);
};

export const getBudgetAlerts = (): Promise<AxiosResponse<{ alerts: BudgetAlert[] }>> => {
  return api.get('/budgets/alerts');
};

// API Functions for Goals
export const getGoals = (): Promise<AxiosResponse<{ goals: Goal[] }>> => {
  return api.get('/goals');
};

export const createGoal = (goalData: Partial<Goal>): Promise<AxiosResponse> => {
  return api.post('/goals', goalData);
};

export const updateGoal = (id: string, goalData: Partial<Goal>): Promise<AxiosResponse> => {
  return api.put(`/goals/${id}`, goalData);
};

export const deleteGoal = (id: string): Promise<AxiosResponse> => {
  return api.delete(`/goals/${id}`);
};

export const contributeToGoal = (id: string, amount: number): Promise<AxiosResponse> => {
  return api.post(`/goals/${id}/contribute`, { amount });
};

// API Functions for Notifications
export const getNotifications = (): Promise<AxiosResponse<{ notifications: Notification[] }>> => {
  return api.get('/notifications');
};

export const markNotificationAsRead = (id: string): Promise<AxiosResponse> => {
  return api.put(`/notifications/${id}/read`);
};

export const deleteNotification = (id: string): Promise<AxiosResponse> => {
  return api.delete(`/notifications/${id}`);
};

// API Functions for Currencies

// Define the Currency interface
export interface Currency {
  code: string;
  name: string;
  symbol: string;
  decimal_digits?: number;
  rounding?: number;
  symbol_native?: string;
  name_plural?: string;
}

export const getCurrencies = (): Promise<AxiosResponse<{ currencies: Currency[] }>> => {
  return api.get('/currencies');
};

export const getExchangeRate = (from: string, to: string): Promise<AxiosResponse<{ rate: number }>> => {
  return api.get(`/currencies/exchange-rate?from=${from}&to=${to}`);
};

// Define CurrencyPreference interface
export interface CurrencyPreference {
  primary_currency: string;
  secondary_currencies?: string[];
  default_account_currency?: string;
}

export const updateCurrencyPreferences = (preferences: Partial<CurrencyPreference>): Promise<AxiosResponse> => {
  return api.put('/currencies/preferences', preferences);
};

// Add this function to your existing api.ts file
export const getUserCurrencyPreferences = (): Promise<AxiosResponse<{ preferences: CurrencyPreference[] }>> => {
  return api.get('/currencies/preferences');
};


export function get(arg0: string) {
    throw new Error('Function not implemented.');
}

export { api };

