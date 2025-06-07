import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { AxiosResponse } from 'axios'; 

// Default backend URL - different for iOS simulator vs Android emulator
const getDefaultApiUrl = () => {
  if (Platform.OS === 'ios') {
    return 'http://localhost:5000/api'; // iOS simulator can use localhost
  } else if (Platform.OS === 'android') {
    return 'http://10.0.2.2:5000/api'; // Android emulator needs this IP for host machine
  } else {
    return 'http://localhost:5000/api'; // Web or unknown
  }
};

// Create axios instance
const api = axios.create({
  baseURL: getDefaultApiUrl(),
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  }
});

// Add a request interceptor to add the token
api.interceptors.request.use(
  async (config) => {
    // Get token from storage
    const token = await AsyncStorage.getItem('auth_token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
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

interface UserProfile {
  id: string;
  email: string;
  created_at: string;
  last_sync: string | null;
}

// Auth APIs
export const register = (email: string, password: string): Promise<AxiosResponse<AuthResponse>> => {
  return api.post<AuthResponse>('/auth/register', { email, password });
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
  const serverUrl = await AsyncStorage.getItem('server_url');
  if (serverUrl) {
    api.defaults.baseURL = `${serverUrl}/api`;
  }
};

export default api;