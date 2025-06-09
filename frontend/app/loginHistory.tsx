import React, { useState, useEffect } from 'react';
import { StyleSheet, View as RNView, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Text, View } from '@/components/Themed';
import { StatusBar } from 'expo-status-bar';
import { FontAwesome } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '@/components/ThemeProvider';
import { AppColors } from './(tabs)/_layout';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getUserLoginHistory } from '@/services/api';

// Define types for login history item
interface LoginHistoryItem {
  date: string;
  device?: string;
  location?: string;
  ip?: string;
  type: 'login' | 'logout' | 'guest' | 'signup';
}

export default function LoginHistoryScreen() {
  const { isDarkMode, colors } = useTheme();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [loginHistory, setLoginHistory] = useState<LoginHistoryItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadLoginHistory();
  }, []);

  const loadLoginHistory = async () => {
    try {
      setLoading(true);
      setError(null);
      
      try {
        const response = await getUserLoginHistory();
        if (response?.data) {
          setLoginHistory(response.data);
        } else {
          throw new Error('Invalid API response');
        }
      } catch (apiError) {
        console.log('Failed to load login history from API, using local');
        // Fall back to local storage
        const historyString = await AsyncStorage.getItem('login_history');
        if (historyString) {
          try {
            const history = JSON.parse(historyString);
            if (Array.isArray(history)) {
              setLoginHistory(history);
            } else {
              throw new Error('Invalid login history format in storage');
            }
          } catch (parseError) {
            console.error('Error parsing login history:', parseError);
            setError('Could not load login history data');
            setLoginHistory([]);
          }
        } else {
          // No local history
          setLoginHistory([]);
        }
      }
    } catch (error) {
      console.error('Error loading login history:', error);
      setError('An error occurred while loading login history');
      setLoginHistory([]);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string): string => {
    try {
      return new Date(dateString).toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      console.error('Date format error:', e);
      return 'Invalid date';
    }
  };

  const getBadgeStyle = (type: string): { color: string; backgroundColor: string; icon: string } => {
    switch (type) {
      case 'login':
        return { color: 'white', backgroundColor: AppColors.primary, icon: 'sign-in' };
      case 'logout':
        return { color: 'white', backgroundColor: AppColors.danger, icon: 'sign-out' };
      case 'signup':
        return { color: 'white', backgroundColor: AppColors.lightGreen, icon: 'user-plus' };
      case 'guest':
        return { color: 'white', backgroundColor: AppColors.secondary, icon: 'user-secret' };
      default:
        return { color: 'white', backgroundColor: colors.subText, icon: 'user' };
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={isDarkMode ? 'light' : 'dark'} />
      
      {/* Header with back button */}
      <RNView style={[styles.header, { backgroundColor: colors.background }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <FontAwesome name="arrow-left" size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Login History</Text>
        <RNView style={{ width: 40 }} />
      </RNView>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={AppColors.primary} />
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <FontAwesome name="exclamation-circle" size={60} color={AppColors.danger} style={styles.emptyIcon} />
          <Text style={[styles.errorText, { color: AppColors.danger }]}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadLoginHistory}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : loginHistory.length === 0 ? (
        <View style={styles.emptyContainer}>
          <FontAwesome name="clock-o" size={60} color={colors.subText} style={styles.emptyIcon} />
          <Text style={[styles.emptyText, { color: colors.subText }]}>No login history available</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          {loginHistory.map((login, index) => {
            const badge = getBadgeStyle(login.type || 'unknown');
            return (
              <RNView
                key={index}
                style={[
                  styles.card,
                  {
                    backgroundColor: colors.cardBackground,
                    shadowColor: isDarkMode ? '#000' : '#aaa'
                  }
                ]}
              >
                <RNView style={{ flex: 1 }}>
                  <Text style={[styles.dateText, { color: colors.text }]}>{formatDate(login.date)}</Text>
                  <Text style={[styles.detailText, { color: colors.subText }]}>
                    {login.device || 'Unknown device'}{login.location ? ` • ${login.location}` : ''}
                  </Text>
                  {login.ip && (
                    <Text style={[styles.ipText, { color: colors.subText }]}>IP: {login.ip}</Text>
                  )}
                </RNView>

                <RNView style={[styles.badge, { backgroundColor: badge.backgroundColor }]}>
                  <FontAwesome name={badge.icon} size={14} color="white" style={{ marginRight: 6 }} />
                  <Text style={styles.badgeText}>
                    {login.type === 'login' ? 'Login' : login.type === 'logout' ? 'Logout' : login.type === 'signup' ? 'Signup' : 'Guest'}
                  </Text>
                </RNView>
              </RNView>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1 
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 50, // Add extra padding for status bar
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  backButton: {
    padding: 8,
  },
  loadingContainer: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    marginVertical: 16,
  },
  retryButton: {
    backgroundColor: AppColors.primary,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginTop: 16,
  },
  retryText: {
    color: 'white',
    fontWeight: 'bold',
  },
  emptyContainer: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    paddingHorizontal: 20 
  },
  emptyIcon: { 
    marginBottom: 20 
  },
  emptyText: { 
    fontSize: 16, 
    textAlign: 'center' 
  },
  scrollContainer: { 
    padding: 12 
  },
  card: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 3,
  },
  dateText: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  detailText: {
    fontSize: 13,
    marginBottom: 2,
  },
  ipText: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    marginLeft: 10,
    minWidth: 80,
    justifyContent: 'center',
  },
  badgeText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 13,
  },
});
