import React, { useState, useEffect } from 'react';
import { StyleSheet, FlatList, TouchableOpacity, Alert, View as RNView } from 'react-native';
import { Stack } from 'expo-router';
import { Text, View } from '@/components/Themed';
import { AppColors } from './(tabs)/_layout';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useTheme } from '@/components/ThemeProvider';

type Notification = {
  id: string;
  title: string;
  message: string;
  date: string;
  read: boolean;
  type: 'transaction' | 'alert' | 'reminder' | 'system';
};

export default function NotificationsScreen() {
  const { isDarkMode, colors } = useTheme();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  
  useEffect(() => {
    // Mock notifications data - in a real app, this would come from an API
    setNotifications([
      {
        id: '1',
        title: 'New Transaction Added',
        message: 'Your recent transaction of $25.99 has been added successfully.',
        date: '2023-10-27T10:23:00',
        read: false,
        type: 'transaction'
      },
      {
        id: '2',
        title: 'Budget Alert',
        message: 'You have reached 80% of your Food budget for this month.',
        date: '2023-10-26T16:45:00',
        read: false,
        type: 'alert'
      },
      {
        id: '3',
        title: 'Payment Reminder',
        message: 'Your internet bill is due in 3 days.',
        date: '2023-10-25T09:15:00',
        read: true,
        type: 'reminder'
      },
      {
        id: '4',
        title: 'System Update',
        message: 'CaptainLedger was updated to version 1.0.1.',
        date: '2023-10-20T14:30:00',
        read: true,
        type: 'system'
      }
    ]);
  }, []);
  
  const markAsRead = (id: string) => {
    setNotifications(prev => 
      prev.map(notification => 
        notification.id === id ? { ...notification, read: true } : notification
      )
    );
  };
  
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 24) {
      if (diffInHours < 1) {
        const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
        return `${diffInMinutes} min ago`;
      }
      return `${diffInHours} hours ago`;
    } else if (diffInHours < 48) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };
  
  const getIconForType = (type: string) => {
    switch (type) {
      case 'transaction': return 'exchange';
      case 'alert': return 'exclamation-circle';
      case 'reminder': return 'calendar-check-o';
      case 'system': return 'cogs';
      default: return 'bell';
    }
  };
  
  const getColorForType = (type: string) => {
    switch (type) {
      case 'transaction': return AppColors.primary;
      case 'alert': return AppColors.danger;
      case 'reminder': return '#3498DB';
      case 'system': return AppColors.secondary;
      default: return AppColors.lightGreen;
    }
  };
  
  const markAllAsRead = () => {
    setNotifications(prev => prev.map(notification => ({ ...notification, read: true })));
    Alert.alert('Success', 'All notifications marked as read');
  };
  
  const renderNotification = ({ item }: { item: Notification }) => {
    const notificationBg = !item.read && isDarkMode ? 
      'rgba(39, 174, 96, 0.15)' : 
      !item.read ? 
        'rgba(39, 174, 96, 0.05)' : 
        colors.cardBackground;
    
    return (
      <TouchableOpacity 
        style={[
          styles.notificationItem, 
          { 
            backgroundColor: notificationBg,
            borderLeftColor: getColorForType(item.type),
          }
        ]}
        onPress={() => markAsRead(item.id)}
      >
        <RNView style={[styles.iconContainer, { backgroundColor: getColorForType(item.type) }]}>
          <FontAwesome name={getIconForType(item.type)} size={16} color="#FFF" />
        </RNView>
        <RNView style={[styles.contentContainer, { backgroundColor: 'transparent' }]}>
          <RNView style={[styles.headerRow, { backgroundColor: 'transparent' }]}>
            <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>{item.title}</Text>
            {!item.read && <RNView style={styles.unreadIndicator} />}
          </RNView>
          <Text style={[styles.message, { color: colors.subText }]} numberOfLines={2}>
            {item.message}
          </Text>
          <Text style={[styles.date, { color: colors.subText }]}>{formatDate(item.date)}</Text>
        </RNView>
      </TouchableOpacity>
    );
  };
  
  const unreadCount = notifications.filter(n => !n.read).length;
  
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen 
        options={{ 
          headerStyle: {
            backgroundColor: isDarkMode ? colors.cardBackground : AppColors.primary,
          },
          headerTintColor: isDarkMode ? colors.text : AppColors.white,
          headerRight: () => (
            <TouchableOpacity 
              style={styles.headerButton} 
              onPress={markAllAsRead}
            >
              <Text style={[styles.headerButtonText, { color: isDarkMode ? colors.primary : AppColors.white }]}>
                Mark all read
              </Text>
            </TouchableOpacity>
          )
        }} 
      />
      
      {notifications.length === 0 ? (
        <View style={styles.emptyContainer}>
          <FontAwesome name="bell-slash" size={60} color={colors.subText} />
          <Text style={[styles.emptyText, { color: colors.text }]}>No notifications yet</Text>
          <Text style={[styles.emptySubtext, { color: colors.subText }]}>
            When you get notifications, they'll appear here
          </Text>
        </View>
      ) : (
        <>
          <View style={[styles.summaryContainer, { backgroundColor: colors.cardBackground }]}>
            <Text style={[styles.summaryText, { color: colors.text }]}>
              You have {unreadCount} unread {unreadCount === 1 ? 'notification' : 'notifications'}
            </Text>
          </View>
          
          <FlatList
            data={notifications}
            renderItem={renderNotification}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.list}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerButton: {
    paddingHorizontal: 15,
  },
  headerButtonText: {
    fontWeight: '500',
  },
  summaryContainer: {
    padding: 12,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  summaryText: {
    fontSize: 14,
    textAlign: 'center',
  },
  list: {
    padding: 16,
    paddingTop: 8,
  },
  notificationItem: {
    flexDirection: 'row',
    padding: 16,
    marginBottom: 12,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
    borderLeftWidth: 4,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  contentContainer: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  unreadIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: AppColors.primary,
    marginLeft: 8,
  },
  message: {
    fontSize: 14,
    marginBottom: 6,
  },
  date: {
    fontSize: 12,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
});