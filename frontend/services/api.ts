import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { AxiosResponse } from 'axios'; 
import { router } from 'expo-router';

// Default backend URL - different for iOS simulator vs Android emulator
const getDefaultApiUrl = () => {
  // Your computer's IP address on the same network as your mobile device
  const DEV_MACHINE_IP = '192.168.18.2'; // Change this to your computer's actual IP
  
  if (Platform.OS === 'ios') {
    return `http://${DEV_MACHINE_IP}:5000/api`; // Use IP instead of localhost
  } else if (Platform.OS === 'android') {
    return `http://${DEV_MACHINE_IP}:5000/api`;
  } else {
    return 'http://localhost:5000/api'; // Web can still use localhost
  }
};

// Create axios instance with the dynamically determined URL
const api = axios.create({
  baseURL: getDefaultApiUrl(),
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  }
});

// Add a request interceptor to add the token
api.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem('auth_token');
    
    // Only add header if we have a valid token (not offline/guest tokens)
    if (token && !token.includes('offline') && !token.includes('guest')) {
      config.headers['Authorization'] = `Bearer ${token}`;
    } else if (config.url?.includes('/auth/')) {
      // For auth endpoints, we might want to handle this differently
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

export const login = (email: string, password: string): Promise<AxiosResponse<AuthResponse>> => {
  return api.post<AuthResponse>('/auth/login', { email, password });
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
export const getTransactions = (filters = {}): Promise<AxiosResponse<TransactionsResponse>> => {
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

export default api;