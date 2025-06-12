import AsyncStorage from '@react-native-async-storage/async-storage';

export class SessionManager {
  private static instance: SessionManager;
  private lastActivityUpdateTime: number = 0;
  private readonly UPDATE_INTERVAL = 5 * 60 * 1000; // Update every 5 minutes

  static getInstance(): SessionManager {
    if (!SessionManager.instance) {
      SessionManager.instance = new SessionManager();
    }
    return SessionManager.instance;
  }

  /**
   * Update the last activity timestamp for session management
   */
  async updateActivity(): Promise<void> {
    const now = Date.now();
    
    // Only update if enough time has passed since last update
    if (now - this.lastActivityUpdateTime < this.UPDATE_INTERVAL) {
      return;
    }

    this.lastActivityUpdateTime = now;

    try {
      const authToken = await AsyncStorage.getItem('auth_token');
      const isAuthenticated = await AsyncStorage.getItem('is_authenticated');
      
      if (authToken && isAuthenticated === 'true') {
        await AsyncStorage.setItem('last_activity', new Date().toISOString());
        
        // Check if session needs extension
        await this.checkAndExtendSession();
      }
    } catch (error) {
      console.error('Error updating session activity:', error);
    }
  }

  /**
   * Check if the session needs to be extended and extend it if necessary
   */
  private async checkAndExtendSession(): Promise<void> {
    try {
      const authExpiration = await AsyncStorage.getItem('auth_expiration');
      const lastActivity = await AsyncStorage.getItem('last_activity');
      
      if (!authExpiration || !lastActivity) {
        return;
      }

      const expirationDate = new Date(authExpiration);
      const lastActivityDate = new Date(lastActivity);
      const now = new Date();

      // Check if session is getting close to expiration (within 7 days)
      const daysUntilExpiration = (expirationDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      
      if (daysUntilExpiration < 7) {
        // Extend session by another 30 days
        const newExpirationDate = new Date();
        newExpirationDate.setDate(newExpirationDate.getDate() + 30);
        
        await AsyncStorage.setItem('auth_expiration', newExpirationDate.toISOString());
        console.log('Session automatically extended for another 30 days');
      }
    } catch (error) {
      console.error('Error checking/extending session:', error);
    }
  }

  /**
   * Check if the current session is valid
   */
  async isSessionValid(): Promise<boolean> {
    try {
      const authToken = await AsyncStorage.getItem('auth_token');
      const authExpiration = await AsyncStorage.getItem('auth_expiration');
      const isAuthenticated = await AsyncStorage.getItem('is_authenticated');

      if (!authToken || isAuthenticated !== 'true') {
        return false;
      }

      if (authExpiration) {
        const expirationDate = new Date(authExpiration);
        const now = new Date();
        
        if (now > expirationDate) {
          console.log('Session has expired');
          await this.clearSession();
          return false;
        }
      }

      return true;
    } catch (error) {
      console.error('Error checking session validity:', error);
      return false;
    }
  }

  /**
   * Clear all session data
   */
  async clearSession(): Promise<void> {
    try {
      const keysToRemove = [
        'auth_token',
        'user_id', 
        'user_email',
        'is_authenticated',
        'auth_expiration',
        'session_created',
        'last_activity',
        'device_id',
        'server_ip',
        'is_custom_server'
      ];

      await AsyncStorage.multiRemove(keysToRemove);

      // Clear all trusted device data
      const allKeys = await AsyncStorage.getAllKeys();
      const trustedDeviceKeys = allKeys.filter(key => key.startsWith('trusted_device_'));
      if (trustedDeviceKeys.length > 0) {
        await AsyncStorage.multiRemove(trustedDeviceKeys);
      }

      console.log('Session cleared successfully');
    } catch (error) {
      console.error('Error clearing session:', error);
    }
  }

  /**
   * Get session information
   */
  async getSessionInfo(): Promise<{
    isValid: boolean;
    expiresAt: string | null;
    createdAt: string | null;
    lastActivity: string | null;
    daysRemaining: number | null;
  }> {
    try {
      const authExpiration = await AsyncStorage.getItem('auth_expiration');
      const sessionCreated = await AsyncStorage.getItem('session_created');
      const lastActivity = await AsyncStorage.getItem('last_activity');
      const isValid = await this.isSessionValid();

      let daysRemaining: number | null = null;
      if (authExpiration) {
        const expirationDate = new Date(authExpiration);
        const now = new Date();
        daysRemaining = Math.max(0, Math.ceil((expirationDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
      }

      return {
        isValid,
        expiresAt: authExpiration,
        createdAt: sessionCreated,
        lastActivity,
        daysRemaining
      };
    } catch (error) {
      console.error('Error getting session info:', error);
      return {
        isValid: false,
        expiresAt: null,
        createdAt: null,
        lastActivity: null,
        daysRemaining: null
      };
    }
  }
}

export default SessionManager.getInstance();
