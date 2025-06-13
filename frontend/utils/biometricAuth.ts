import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Configuration keys for secure storage
const BIOMETRIC_ENABLED_KEY = 'biometric_enabled';
const APP_LOCK_ENABLED_KEY = 'app_lock_enabled';
const APP_LOCK_TIMEOUT_KEY = 'app_lock_timeout';
const BIOMETRIC_USER_DATA_KEY = 'biometric_user_data';

export interface BiometricConfig {
  biometricEnabled: boolean;
  appLockEnabled: boolean;
  lockTimeout: number; // in minutes
}

export interface BiometricAuthResult {
  success: boolean;
  error?: string;
  biometricType?: LocalAuthentication.AuthenticationType;
}

export class BiometricAuthManager {
  // Check if biometric authentication is available on the device
  static async isAvailable(): Promise<boolean> {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      return hasHardware && isEnrolled;
    } catch (error) {
      console.error('Error checking biometric availability:', error);
      return false;
    }
  }

  // Get available biometric types
  static async getAvailableTypes(): Promise<LocalAuthentication.AuthenticationType[]> {
    try {
      return await LocalAuthentication.supportedAuthenticationTypesAsync();
    } catch (error) {
      console.error('Error getting biometric types:', error);
      return [];
    }
  }

  // Get a user-friendly description of available biometric types
  static async getBiometricDescription(): Promise<string> {
    try {
      const types = await this.getAvailableTypes();
      if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
        return 'Face ID';
      } else if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
        return 'Fingerprint';
      } else if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) {
        return 'Iris scan';
      } else {
        return 'Biometric authentication';
      }
    } catch (error) {
      console.error('Error getting biometric description:', error);
      return 'Biometric authentication';
    }
  }

  // Authenticate with biometrics
  static async authenticate(
    promptMessage?: string,
    fallbackLabel?: string
  ): Promise<BiometricAuthResult> {
    try {
      const isAvailable = await this.isAvailable();
      if (!isAvailable) {
        return {
          success: false,
          error: 'Biometric authentication is not available on this device'
        };
      }

      const biometricDescription = await this.getBiometricDescription();
      const defaultPrompt = `Use ${biometricDescription} to authenticate`;

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: promptMessage || defaultPrompt,
        fallbackLabel: fallbackLabel || 'Use passcode',
        cancelLabel: 'Cancel',
        requireConfirmation: false,
      });

      if (result.success) {
        return {
          success: true,
          biometricType: (await this.getAvailableTypes())[0]
        };
      } else {
        return {
          success: false,
          error: result.error || 'Authentication failed'
        };
      }
    } catch (error) {
      console.error('Biometric authentication error:', error);
      return {
        success: false,
        error: 'Biometric authentication failed'
      };
    }
  }

  // Enable biometric authentication
  static async enableBiometric(userData: { email: string; userId: string }): Promise<boolean> {
    try {
      const authResult = await this.authenticate(
        'Enable biometric authentication for CaptainLedger'
      );

      if (authResult.success) {
        // Store user data securely for biometric login
        await SecureStore.setItemAsync(
          BIOMETRIC_USER_DATA_KEY,
          JSON.stringify(userData)
        );
        await AsyncStorage.setItem(BIOMETRIC_ENABLED_KEY, 'true');
        return true;
      } else {
        throw new Error(authResult.error || 'Authentication failed');
      }
    } catch (error) {
      console.error('Error enabling biometric authentication:', error);
      return false;
    }
  }

  // Disable biometric authentication
  static async disableBiometric(): Promise<boolean> {
    try {
      await SecureStore.deleteItemAsync(BIOMETRIC_USER_DATA_KEY);
      await AsyncStorage.setItem(BIOMETRIC_ENABLED_KEY, 'false');
      return true;
    } catch (error) {
      console.error('Error disabling biometric authentication:', error);
      return false;
    }
  }

  // Check if biometric authentication is enabled
  static async isBiometricEnabled(): Promise<boolean> {
    try {
      const enabled = await AsyncStorage.getItem(BIOMETRIC_ENABLED_KEY);
      return enabled === 'true';
    } catch (error) {
      console.error('Error checking biometric status:', error);
      return false;
    }
  }

  // Get stored user data for biometric login
  static async getBiometricUserData(): Promise<{ email: string; userId: string } | null> {
    try {
      const userData = await SecureStore.getItemAsync(BIOMETRIC_USER_DATA_KEY);
      return userData ? JSON.parse(userData) : null;
    } catch (error) {
      console.error('Error getting biometric user data:', error);
      return null;
    }
  }

  // Enable app lock
  static async enableAppLock(timeoutMinutes: number = 5): Promise<boolean> {
    try {
      await AsyncStorage.multiSet([
        [APP_LOCK_ENABLED_KEY, 'true'],
        [APP_LOCK_TIMEOUT_KEY, timeoutMinutes.toString()]
      ]);
      return true;
    } catch (error) {
      console.error('Error enabling app lock:', error);
      return false;
    }
  }

  // Disable app lock
  static async disableAppLock(): Promise<boolean> {
    try {
      await AsyncStorage.multiSet([
        [APP_LOCK_ENABLED_KEY, 'false'],
        [APP_LOCK_TIMEOUT_KEY, '0']
      ]);
      return true;
    } catch (error) {
      console.error('Error disabling app lock:', error);
      return false;
    }
  }

  // Check if app lock is enabled
  static async isAppLockEnabled(): Promise<boolean> {
    try {
      const enabled = await AsyncStorage.getItem(APP_LOCK_ENABLED_KEY);
      return enabled === 'true';
    } catch (error) {
      console.error('Error checking app lock status:', error);
      return false;
    }
  }

  // Get app lock timeout in minutes
  static async getAppLockTimeout(): Promise<number> {
    try {
      const timeout = await AsyncStorage.getItem(APP_LOCK_TIMEOUT_KEY);
      return timeout ? parseInt(timeout, 10) : 5; // Default 5 minutes
    } catch (error) {
      console.error('Error getting app lock timeout:', error);
      return 5;
    }
  }

  // Set app lock timeout
  static async setAppLockTimeout(timeoutMinutes: number): Promise<boolean> {
    try {
      await AsyncStorage.setItem(APP_LOCK_TIMEOUT_KEY, timeoutMinutes.toString());
      return true;
    } catch (error) {
      console.error('Error setting app lock timeout:', error);
      return false;
    }
  }

  // Get current biometric configuration
  static async getBiometricConfig(): Promise<BiometricConfig> {
    try {
      const [biometricEnabled, appLockEnabled, lockTimeout] = await Promise.all([
        this.isBiometricEnabled(),
        this.isAppLockEnabled(),
        this.getAppLockTimeout()
      ]);

      return {
        biometricEnabled,
        appLockEnabled,
        lockTimeout
      };
    } catch (error) {
      console.error('Error getting biometric config:', error);
      return {
        biometricEnabled: false,
        appLockEnabled: false,
        lockTimeout: 5
      };
    }
  }

  // Record app becoming inactive (for app lock timeout)
  static async recordAppInactive(): Promise<void> {
    try {
      await AsyncStorage.setItem('app_last_inactive', new Date().toISOString());
    } catch (error) {
      console.error('Error recording app inactive time:', error);
    }
  }

  // Check if app should be locked based on timeout
  static async shouldLockApp(): Promise<boolean> {
    try {
      const isAppLockEnabled = await this.isAppLockEnabled();
      if (!isAppLockEnabled) return false;

      const lastInactive = await AsyncStorage.getItem('app_last_inactive');
      if (!lastInactive) return false;

      const lockTimeoutMinutes = await this.getAppLockTimeout();
      const inactiveTime = new Date(lastInactive);
      const now = new Date();
      const minutesSinceInactive = (now.getTime() - inactiveTime.getTime()) / (1000 * 60);

      return minutesSinceInactive >= lockTimeoutMinutes;
    } catch (error) {
      console.error('Error checking if app should be locked:', error);
      return false;
    }
  }

  // Clear app lock timer (when app becomes active)
  static async clearAppLockTimer(): Promise<void> {
    try {
      await AsyncStorage.removeItem('app_last_inactive');
    } catch (error) {
      console.error('Error clearing app lock timer:', error);
    }
  }

  // Check if biometric login should be offered
  static async shouldOfferBiometricLogin(): Promise<boolean> {
    try {
      const isBiometricEnabled = await this.isBiometricEnabled();
      const isAvailable = await this.isAvailable();
      const userData = await this.getBiometricUserData();
      
      return isBiometricEnabled && isAvailable && userData !== null;
    } catch (error) {
      console.error('Error checking if should offer biometric login:', error);
      return false;
    }
  }

  // Perform biometric login
  static async performBiometricLogin(): Promise<{ success: boolean; userData?: any; error?: string }> {
    try {
      const userData = await this.getBiometricUserData();
      if (!userData) {
        return {
          success: false,
          error: 'No biometric user data found'
        };
      }

      const authResult = await this.authenticate(
        'Use biometric authentication to sign in to CaptainLedger'
      );

      if (authResult.success) {
        return {
          success: true,
          userData
        };
      } else {
        return {
          success: false,
          error: authResult.error || 'Biometric authentication failed'
        };
      }
    } catch (error) {
      console.error('Error performing biometric login:', error);
      return {
        success: false,
        error: 'Biometric login failed'
      };
    }
  }
}

export default BiometricAuthManager;
