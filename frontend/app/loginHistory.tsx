import React, { useState, useEffect } from 'react';
import { StyleSheet, View as RNView, ScrollView, ActivityIndicator } from 'react-native';
import { Text, View } from '@/components/Themed';
import { StatusBar } from 'expo-status-bar';
import { FontAwesome } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '@/components/ThemeProvider';
import { AppColors } from './(tabs)/_layout';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getUserLoginHistory } from '@/services/api';

export default function LoginHistoryScreen() {
  const { isDarkMode, colors } = useTheme();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [loginHistory, setLoginHistory] = useState([]);

  useEffect(() => {
    loadLoginHistory();
  }, []);

  const loadLoginHistory = async () => {
    try {
      setLoading(true);
      try {
        const response = await getUserLoginHistory();
        setLoginHistory(response.data);
      } catch (error) {
        console.log('Failed to load login history from API, using local');
        const history = await AsyncStorage.getItem('login_history');
        if (history) {
          setLoginHistory(JSON.parse(history));
        }
      }
    } catch (error) {
      console.error('Error loading login history:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getBadgeStyle = (type) => {
    switch (type) {
      case 'login':
        return { color: 'white', backgroundColor: AppColors.primary, icon: 'sign-in' };
      case 'logout':
        return { color: 'white', backgroundColor: AppColors.danger, icon: 'sign-out' };
      default:
        return { color: 'white', backgroundColor: colors.subText, icon: 'user' };
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={isDarkMode ? 'light' : 'dark'} />

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={AppColors.primary} />
        </View>
      ) : loginHistory.length === 0 ? (
        <View style={styles.emptyContainer}>
          <FontAwesome name="clock-o" size={60} color={colors.subText} style={styles.emptyIcon} />
          <Text style={[styles.emptyText, { color: colors.subText }]}>No login history available</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          {loginHistory.map((login, index) => {
            const badge = getBadgeStyle(login.type);
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
                    {login.type === 'login' ? 'Login' : login.type === 'logout' ? 'Logout' : 'Guest'}
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
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
  emptyIcon: { marginBottom: 20 },
  emptyText: { fontSize: 16, textAlign: 'center' },
  scrollContainer: { padding: 12 },
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
