import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  StatusBar,
  SafeAreaView,
  Animated,
  Dimensions,
  Image
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useRouter } from 'expo-router';
import { useTheme } from '@/components/ThemeProvider';
import { AppColors } from '@/app/(tabs)/_layout';
import { LinearGradient } from 'expo-linear-gradient';

interface SidebarProps {
  visible: boolean;
  onClose: () => void;
}

const { width } = Dimensions.get('window');

interface MenuItem {
  id: string;
  title: string;
  icon: string;
  route: string;
  gradient: [string, string];
}

const menuItems: MenuItem[] = [
  { id: 'notifications', title: 'Notifications', icon: 'bell', route: '/notifications', gradient: ['#FF6B6B', '#FF8E8E'] },
  { id: 'loans', title: 'Loans', icon: 'handshake-o', route: '/loans', gradient: ['#4ECDC4', '#44A08D'] },
  { id: 'investments', title: 'Investments', icon: 'line-chart', route: '/investments', gradient: ['#45B7D1', '#96C93D'] },
  { id: 'budgets', title: 'Budgets', icon: 'pie-chart', route: '/budgets', gradient: ['#F093FB', '#F5576C'] },
  { id: 'analytics', title: 'Analytics', icon: 'bar-chart', route: '/analytics', gradient: ['#4facfe', '#00f2fe'] },
  { id: 'categories', title: 'Categories', icon: 'tags', route: '/categoryManagement', gradient: ['#43e97b', '#38f9d7'] },
  { id: 'accounts', title: 'Accounts', icon: 'bank', route: '/accounts', gradient: ['#fa709a', '#fee140'] },
  { id: 'settings', title: 'Settings', icon: 'cog', route: '/settings', gradient: ['#a8edea', '#fed6e3'] },
  { id: 'help', title: 'Help & Support', icon: 'question-circle', route: '/documentation', gradient: ['#ffecd2', '#fcb69f'] },
  { id: 'privacy', title: 'Privacy Policy', icon: 'shield', route: '/privacy', gradient: ['#667eea', '#764ba2'] },
];

export default function Sidebar({ visible, onClose }: SidebarProps) {
  const { isDarkMode, colors } = useTheme();
  const router = useRouter();
  const slideAnim = React.useRef(new Animated.Value(-width * 0.8)).current;

  React.useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 100,
        friction: 8,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: -width * 0.8,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, slideAnim]);

  const handleItemPress = (route: string) => {
    onClose();
    setTimeout(() => {
      router.push(route as any);
    }, 250);
  };

  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <Animated.View 
          style={[
            styles.sidebar, 
            { 
              backgroundColor: colors.cardBackground,
              transform: [{ translateX: slideAnim }]
            }
          ]}
        >
          <SafeAreaView style={styles.safeArea}>
            <StatusBar 
              barStyle={isDarkMode ? 'light-content' : 'dark-content'} 
              backgroundColor="transparent"
              translucent
            />
            
            {/* Modern Header with Gradient */}
            <LinearGradient
              colors={isDarkMode ? ['#2C3E50', '#34495E'] : [AppColors.primary, AppColors.darkGreen]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.header}
            >
              <View style={styles.headerContent}>
                <View style={styles.logoContainer}>
                  <View style={styles.logoCircle}>
                    <Image
                      source={require('@/assets/images/icon.png')}
                      style={styles.logoImage}
                      resizeMode="contain"
                    />
                  </View>
                  <View style={styles.headerTextContainer}>
                    <Text style={styles.headerTitle}>CaptainLedger</Text>
                    <Text style={styles.headerSubtitle}>Financial Control</Text>
                  </View>
                </View>
                <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                  <FontAwesome name="times" size={20} color="white" />
                </TouchableOpacity>
              </View>
            </LinearGradient>

            {/* Menu Items with Modern Design */}
            <ScrollView 
              style={styles.menuContainer} 
              showsVerticalScrollIndicator={false}
              bounces={true}
              scrollEnabled={true}
              contentContainerStyle={styles.scrollContent}
            >
              <View style={styles.menuSection}>
                <Text style={[styles.sectionTitle, { color: colors.subText }]}>MAIN MENU</Text>
                {menuItems.slice(0, 6).map((item, index) => (
                  <TouchableOpacity
                    key={item.id}
                    style={[styles.menuItem, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' }]}
                    onPress={() => handleItemPress(item.route)}
                    activeOpacity={0.7}
                  >
                    <LinearGradient
                      colors={item.gradient}
                      style={styles.menuIconContainer}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                    >
                      <FontAwesome 
                        name={item.icon as any} 
                        size={16} 
                        color="white" 
                      />
                    </LinearGradient>
                    <Text style={[styles.menuText, { color: colors.text }]}>
                      {item.title}
                    </Text>
                    <FontAwesome 
                      name="chevron-right" 
                      size={14} 
                      color={colors.subText} 
                    />
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.menuSection}>
                <Text style={[styles.sectionTitle, { color: colors.subText }]}>SUPPORT</Text>
                {menuItems.slice(6).map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={[styles.menuItem, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' }]}
                    onPress={() => handleItemPress(item.route)}
                    activeOpacity={0.7}
                  >
                    <LinearGradient
                      colors={item.gradient}
                      style={styles.menuIconContainer}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                    >
                      <FontAwesome 
                        name={item.icon as any} 
                        size={16} 
                        color="white" 
                      />
                    </LinearGradient>
                    <Text style={[styles.menuText, { color: colors.text }]}>
                      {item.title}
                    </Text>
                    <FontAwesome 
                      name="chevron-right" 
                      size={14} 
                      color={colors.subText} 
                    />
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            {/* Modern Footer */}
            <View style={[styles.footer, { borderTopColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }]}>
              <View style={styles.footerContent}>
                <FontAwesome name="shield" size={16} color={colors.subText} />
                <Text style={[styles.footerText, { color: colors.subText }]}>
                  Version 1.0.0 • Secure & Private
                </Text>
              </View>
            </View>
          </SafeAreaView>
        </Animated.View>
        
        <TouchableOpacity 
          style={styles.overlayTouch} 
          activeOpacity={1} 
          onPress={onClose}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  overlayTouch: {
    flex: 1,
  },
  sidebar: {
    width: width * 0.8,
    maxWidth: 320,
    height: '100%',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    paddingTop: 20,
    paddingBottom: 25,
    paddingHorizontal: 20,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  logoCircle: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    padding: 8,
  },
  logoImage: {
    width: 30,
    height: 30,
    borderRadius: 15,
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 2,
  },
  headerSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '500',
  },
  closeButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  menuContainer: {
    flex: 1,
    paddingTop: 10,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  menuSection: {
    marginBottom: 25,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    marginLeft: 20,
    marginBottom: 12,
    marginTop: 10,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginHorizontal: 12,
    marginVertical: 2,
    borderRadius: 12,
  },
  menuIconContainer: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  menuText: {
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
  },
  footerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerText: {
    fontSize: 12,
    marginLeft: 8,
    fontWeight: '500',
  },
});