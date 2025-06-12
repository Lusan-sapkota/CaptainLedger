import AsyncStorage from '@react-native-async-storage/async-storage';
import { eventEmitter } from '@/utils/eventEmitter';

export interface NotificationData {
  id: string;
  type: 'transaction' | 'budget' | 'loan' | 'system' | 'reminder';
  title: string;
  message: string;
  data?: any;
  timestamp: string;
  read: boolean;
}

class WebSocketService {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private isConnecting = false;
  private baseUrl = 'ws://192.168.18.2:5000'; // Update with your backend URL

  constructor() {
    this.connect();
  }

  async connect() {
    if (this.isConnecting || (this.ws && this.ws.readyState === WebSocket.OPEN)) {
      return;
    }

    this.isConnecting = true;

    try {
      const authToken = await AsyncStorage.getItem('auth_token');
      const userId = await AsyncStorage.getItem('user_id');

      if (!authToken || !userId) {
        console.log('No auth token or user ID, skipping WebSocket connection');
        this.isConnecting = false;
        return;
      }

      const wsUrl = `${this.baseUrl}/ws?token=${authToken}&user_id=${userId}`;
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('WebSocket connected');
        this.reconnectAttempts = 0;
        this.isConnecting = false;
        
        // Send ping to keep connection alive
        this.startHeartbeat();
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleMessage(data);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      this.ws.onclose = (event) => {
        console.log('WebSocket disconnected:', event.code, event.reason);
        this.isConnecting = false;
        this.stopHeartbeat();
        
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          this.scheduleReconnect();
        }
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.isConnecting = false;
      };

    } catch (error) {
      console.error('Error connecting to WebSocket:', error);
      this.isConnecting = false;
      this.scheduleReconnect();
    }
  }

  private handleMessage(data: any) {
    console.log('Received WebSocket message:', data);

    switch (data.type) {
      case 'notification':
        this.handleNotification(data.payload);
        break;
      case 'transaction_update':
        eventEmitter.emit('transactionUpdated', data.payload);
        break;
      case 'budget_alert':
        this.handleBudgetAlert(data.payload);
        break;
      case 'loan_reminder':
        this.handleLoanReminder(data.payload);
        break;
      case 'system_message':
        this.handleSystemMessage(data.payload);
        break;
      default:
        console.log('Unknown message type:', data.type);
    }
  }

  private handleNotification(notification: NotificationData) {
    // Store notification locally
    this.storeNotification(notification);
    
    // Emit event for UI updates
    eventEmitter.emit('newNotification', notification);
    
    // Show platform-specific notification
    this.showPlatformNotification(notification);
  }

  private handleBudgetAlert(data: any) {
    const notification: NotificationData = {
      id: Date.now().toString(),
      type: 'budget',
      title: 'Budget Alert',
      message: data.message,
      data: data,
      timestamp: new Date().toISOString(),
      read: false
    };
    
    this.handleNotification(notification);
  }

  private handleLoanReminder(data: any) {
    const notification: NotificationData = {
      id: Date.now().toString(),
      type: 'loan',
      title: 'Loan Payment Reminder',
      message: data.message,
      data: data,
      timestamp: new Date().toISOString(),
      read: false
    };
    
    this.handleNotification(notification);
  }

  private handleSystemMessage(data: any) {
    const notification: NotificationData = {
      id: Date.now().toString(),
      type: 'system',
      title: data.title || 'System Message',
      message: data.message,
      data: data,
      timestamp: new Date().toISOString(),
      read: false
    };
    
    this.handleNotification(notification);
  }

  private async storeNotification(notification: NotificationData) {
    try {
      const existingNotifications = await AsyncStorage.getItem('notifications');
      const notifications = existingNotifications ? JSON.parse(existingNotifications) : [];
      
      notifications.unshift(notification);
      
      // Keep only last 100 notifications
      if (notifications.length > 100) {
        notifications.splice(100);
      }
      
      await AsyncStorage.setItem('notifications', JSON.stringify(notifications));
    } catch (error) {
      console.error('Error storing notification:', error);
    }
  }

  private showPlatformNotification(notification: NotificationData) {
    // For web platforms
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'granted') {
        new Notification(notification.title, {
          body: notification.message,
          icon: '/icon.png'
        });
      }
    }
    
    // For mobile platforms, you can use expo-notifications here
    // This would require additional setup
  }

  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;

  private startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000); // Send ping every 30 seconds
  }

  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private scheduleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts);
      
      setTimeout(() => {
        this.reconnectAttempts++;
        console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
        this.connect();
      }, delay);
    }
  }

  sendMessage(message: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket is not connected');
    }
  }

  disconnect() {
    this.stopHeartbeat();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  // Public method to get stored notifications
  async getNotifications(): Promise<NotificationData[]> {
    try {
      const notifications = await AsyncStorage.getItem('notifications');
      return notifications ? JSON.parse(notifications) : [];
    } catch (error) {
      console.error('Error getting notifications:', error);
      return [];
    }
  }

  // Public method to mark notification as read
  async markAsRead(notificationId: string) {
    try {
      const notifications = await this.getNotifications();
      const updatedNotifications = notifications.map(notification =>
        notification.id === notificationId ? { ...notification, read: true } : notification
      );
      await AsyncStorage.setItem('notifications', JSON.stringify(updatedNotifications));
      eventEmitter.emit('notificationRead', notificationId);
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  }
}

export const websocketService = new WebSocketService();