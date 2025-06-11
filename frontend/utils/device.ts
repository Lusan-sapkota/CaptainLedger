import { Platform } from 'react-native';
import * as Device from 'expo-device';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

/**
 * Get a unique identifier for the current device
 */
export async function getDeviceIdentifier(): Promise<string> {
  // First check if we already have a stored device ID
  const existingId = await AsyncStorage.getItem('device_id');
  if (existingId) {
    return existingId;
  }
  
  // Otherwise generate a new device ID
  const deviceInfo = {
    brand: Device.brand || '',
    modelName: Device.modelName || '',
    osName: Device.osName || Platform.OS,
    osVersion: Device.osVersion || Platform.Version.toString(),
    deviceName: Device.deviceName || '',
    timestamp: new Date().getTime(),
    // Add a random element to ensure uniqueness
    random: Math.random().toString(36).substring(2, 15),
  };
  
  const deviceString = JSON.stringify(deviceInfo);
  const deviceHash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    deviceString
  );
  
  // Store the new device ID
  await AsyncStorage.setItem('device_id', deviceHash);
  
  return deviceHash;
}