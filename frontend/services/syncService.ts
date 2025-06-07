import AsyncStorage from '@react-native-async-storage/async-storage';
import api, { uploadData, downloadData } from './api';
import { Transaction } from './api';
import { isBackendAvailable } from './api';

// Queue for transactions to be synced
interface SyncQueue {
  transactions: Transaction[];
}

// Save transaction to local storage and mark for sync
export const saveTransaction = async (transaction: Transaction): Promise<void> => {
  try {
    // Get existing transactions
    const existingTransactionsJson = await AsyncStorage.getItem('local_transactions');
    let existingTransactions: Transaction[] = existingTransactionsJson 
      ? JSON.parse(existingTransactionsJson) 
      : [];
    
    // Add new transaction
    existingTransactions.push(transaction);
    
    // Save back to storage
    await AsyncStorage.setItem('local_transactions', JSON.stringify(existingTransactions));
    
    // Add to sync queue
    const syncQueueJson = await AsyncStorage.getItem('sync_queue');
    const syncQueue: SyncQueue = syncQueueJson ? JSON.parse(syncQueueJson) : { transactions: [] };
    syncQueue.transactions.push(transaction);
    await AsyncStorage.setItem('sync_queue', JSON.stringify(syncQueue));
    
    // Try to sync immediately if backend is available
    const backendAvailable = await isBackendAvailable();
    if (backendAvailable) {
      await syncWithBackend();
    }
  } catch (error) {
    console.error('Error saving transaction locally:', error);
  }
};

// Sync data with backend
export const syncWithBackend = async (): Promise<boolean> => {
  try {
    // Check if we have anything to sync
    const syncQueueJson = await AsyncStorage.getItem('sync_queue');
    if (!syncQueueJson) return true;
    
    const syncQueue: SyncQueue = JSON.parse(syncQueueJson);
    if (syncQueue.transactions.length === 0) return true;
    
    // Upload data to backend
    const response = await uploadData({ 
      transactions: syncQueue.transactions 
    });
    
    if (response.status === 200) {
      // Clear sync queue after successful upload
      await AsyncStorage.setItem('sync_queue', JSON.stringify({ transactions: [] }));
      
      // Download latest data from backend
      const lastSyncStr = await AsyncStorage.getItem('last_sync');
      const downloadResponse = await downloadData(lastSyncStr || undefined);
      
      // Update local storage with latest data
      if (downloadResponse.data.transactions.length > 0) {
        const existingTransactionsJson = await AsyncStorage.getItem('local_transactions');
        let existingTransactions: Transaction[] = existingTransactionsJson 
          ? JSON.parse(existingTransactionsJson) 
          : [];
          
        // Merge with downloaded transactions
        const mergedTransactions = mergeTransactions(
          existingTransactions, 
          downloadResponse.data.transactions
        );
        
        await AsyncStorage.setItem('local_transactions', JSON.stringify(mergedTransactions));
      }
      
      // Update last sync time
      await AsyncStorage.setItem('last_sync', downloadResponse.data.last_sync);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Error syncing with backend:', error);
    return false;
  }
};

// Helper to merge local and remote transactions
const mergeTransactions = (local: Transaction[], remote: Transaction[]): Transaction[] => {
  const merged: Record<string, Transaction> = {};
  
  // Add local transactions to map
  local.forEach(t => {
    merged[t.id] = t;
  });
  
  // Add or update with remote transactions
  remote.forEach(t => {
    if (!merged[t.id] || (merged[t.id].updated_at && t.updated_at && new Date(t.updated_at) > new Date(merged[t.id].updated_at!))) {
      merged[t.id] = t;
    }
  });
  
  // Convert back to array
  return Object.values(merged);
};