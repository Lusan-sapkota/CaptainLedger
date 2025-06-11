import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { AxiosResponse } from 'axios'; 
import { router } from 'expo-router';
import * as Device from 'expo-device';

// Default backend URL - different for iOS simulator vs Android emulator
const getDefaultApiUrl = () => {
  const LOCAL_PORT = '5000'; // This is correct, but needs to be enforced
  
  // For web platform, instead of using a relative URL, specify the full URL with port
  if (Platform.OS === 'web') {
    return `http://localhost:${LOCAL_PORT}/api`;
  } else if (Platform.OS === 'ios') {
    return `http://localhost:${LOCAL_PORT}/api`;
  } else if (Platform.OS === 'android') {
    return `http://10.0.2.2:${LOCAL_PORT}/api`;
  } else {
    return `http://localhost:${LOCAL_PORT}/api`;
  }
};

// Create axios instance with the dynamically determined URL
const api = axios.create({
  baseURL: getDefaultApiUrl(),
  timeout: 10000, // Reduce timeout for better user feedback
  headers: {
    'Content-Type': 'application/json',
  },
  // Add withCredentials to help with CORS
  withCredentials: Platform.OS === 'web'
});

// Add a request interceptor to add the token
api.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem('auth_token');
    
    console.log(`Request to ${config.url} with token: ${token ? 'Present' : 'None'}`);
    
    if (token && !token.includes('offline') && !token.includes('guest')) {
      config.headers['Authorization'] = `Bearer ${token}`;
    } else if (config.url?.includes('/auth/')) {
      console.log('No valid token for auth endpoint, request may fail');
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Update the API error interceptor
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response && error.response.status === 401) {
      console.log('Authentication error: Invalid or expired token');
      
      // Check if this is a login attempt (don't clear auth data on login failures)
      const isLoginAttempt = error.config.url.includes('/login') || 
                           error.config.url.includes('/register');
      
      if (!isLoginAttempt) {
        // Only clear auth data for non-login requests that get 401s
        await AsyncStorage.multiRemove([
          'auth_token', 'user_id', 'user_email', 'is_authenticated'
        ]);
        
        // Navigate back to auth
        router.replace('/auth');
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

export const login = async (email: string, password: string, deviceId?: string) => {
  try {
    const response = await api.post('/auth/login', {
      email,
      password,
      deviceId // Pass the device ID to the API
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
  note: string;
  created_at?: string;
  updated_at?: string;
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

export const createTransaction = (transaction: CreateTransactionPayload): Promise<AxiosResponse<TransactionResponse>> => {
  return api.post<TransactionResponse>('/transactions', transaction);
};

export const updateTransaction = (id: string, transaction: UpdateTransactionPayload): Promise<AxiosResponse<TransactionResponse>> => {
  return api.put<TransactionResponse>(`/transactions/${id}`, transaction);
};

export const deleteTransaction = (id: string): Promise<AxiosResponse<{message: string}>> => {
  return api.delete<{message: string}>(`/transactions/${id}`);
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

// Budgets API
export const getBudgets = (): Promise<AxiosResponse<{budgets: Budget[]}>> => {
  return api.get('/budget');
};

// Add this new function
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

export default api;
