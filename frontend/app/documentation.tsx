import React, { useState } from 'react';
import { StyleSheet, View, ScrollView, TouchableOpacity, Image, Platform } from 'react-native';
import { Text } from '@/components/Themed';
import { Stack } from 'expo-router';
import { useTheme } from '@/components/ThemeProvider';
import { AppColors } from './(tabs)/_layout';
import FontAwesome from '@expo/vector-icons/FontAwesome';

export default function DocumentationScreen() {
  const { isDarkMode, colors } = useTheme();
  const [expandedSection, setExpandedSection] = useState<string | null>('basics');
  
  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen 
        options={{ 
          title: "Documentation",
          headerStyle: {
            backgroundColor: isDarkMode ? colors.cardBackground : AppColors.primary,
          },
          headerTintColor: isDarkMode ? colors.text : AppColors.white,
        }} 
      />
      
      <ScrollView style={styles.scrollView}>
        <View style={[styles.header, { backgroundColor: AppColors.secondary }]}>
          <Image 
            source={require('../assets/images/icon.png')}
            style={styles.logo}
          />
          <Text style={styles.headerTitle}>CaptainLedger Documentation</Text>
          <Text style={styles.headerSubtitle}>Learn how to use CaptainLedger effectively</Text>
        </View>
        
        <View style={[styles.intro, { backgroundColor: colors.cardBackground }]}>
          <Text style={[styles.introTitle, { color: colors.text }]}>Welcome to CaptainLedger</Text>
          <Text style={[styles.introParagraph, { color: colors.text }]}>
            CaptainLedger is a privacy-focused financial tracker that works both online and offline.
            This guide will help you understand how to make the most of the application.
          </Text>
        </View>
        
        {/* Getting Started Section */}
        <TouchableOpacity 
          style={[styles.sectionHeader, { backgroundColor: colors.cardBackground }]} 
          onPress={() => toggleSection('basics')}
        >
          <View style={styles.sectionTitleContainer}>
            <FontAwesome name="rocket" size={20} color={AppColors.primary} style={styles.sectionIcon} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Getting Started</Text>
          </View>
          <FontAwesome 
            name={expandedSection === 'basics' ? 'chevron-up' : 'chevron-down'} 
            size={16} 
            color={colors.subText} 
          />
        </TouchableOpacity>
        
        {expandedSection === 'basics' && (
          <View style={[styles.sectionContent, { backgroundColor: colors.cardBackground }]}>
            <Text style={[styles.sectionSubtitle, { color: colors.text }]}>Account Setup</Text>
            <Text style={[styles.paragraph, { color: colors.text }]}>
              You can create an account or use CaptainLedger as a guest. Creating an account allows you to:
            </Text>
            <Text style={[styles.bulletPoint, { color: colors.text }]}>• Securely sync your data between devices</Text>
            <Text style={[styles.bulletPoint, { color: colors.text }]}>• Back up your financial data</Text>
            <Text style={[styles.bulletPoint, { color: colors.text }]}>• Access advanced features</Text>
            
            <Text style={[styles.sectionSubtitle, { color: colors.text }]}>Dashboard Overview</Text>
            <Text style={[styles.paragraph, { color: colors.text }]}>
              The Dashboard provides a snapshot of your finances with:
            </Text>
            <Text style={[styles.bulletPoint, { color: colors.text }]}>• Monthly overview summary</Text>
            <Text style={[styles.bulletPoint, { color: colors.text }]}>• Quick access to core features</Text>
            <Text style={[styles.bulletPoint, { color: colors.text }]}>• Recent transactions list</Text>
          </View>
        )}
        
        {/* Transactions Section */}
        <TouchableOpacity 
          style={[styles.sectionHeader, { backgroundColor: colors.cardBackground }]} 
          onPress={() => toggleSection('transactions')}
        >
          <View style={styles.sectionTitleContainer}>
            <FontAwesome name="money" size={20} color={AppColors.primary} style={styles.sectionIcon} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Managing Transactions</Text>
          </View>
          <FontAwesome 
            name={expandedSection === 'transactions' ? 'chevron-up' : 'chevron-down'} 
            size={16} 
            color={colors.subText} 
          />
        </TouchableOpacity>
        
        {expandedSection === 'transactions' && (
          <View style={[styles.sectionContent, { backgroundColor: colors.cardBackground }]}>
            <Text style={[styles.sectionSubtitle, { color: colors.text }]}>Adding Transactions</Text>
            <Text style={[styles.paragraph, { color: colors.text }]}>
              To add a new transaction:
            </Text>
            <Text style={[styles.bulletPoint, { color: colors.text }]}>• Tap the + button in the Transactions tab</Text>
            <Text style={[styles.bulletPoint, { color: colors.text }]}>• Enter the amount (negative for expenses, positive for income)</Text>
            <Text style={[styles.bulletPoint, { color: colors.text }]}>• Select a category</Text>
            <Text style={[styles.bulletPoint, { color: colors.text }]}>• Add a note (optional)</Text>
            <Text style={[styles.bulletPoint, { color: colors.text }]}>• Tap Save</Text>
            
            <Text style={[styles.sectionSubtitle, { color: colors.text }]}>Transaction History</Text>
            <Text style={[styles.paragraph, { color: colors.text }]}>
              View your complete transaction history in the History tab. You can filter transactions by:
            </Text>
            <Text style={[styles.bulletPoint, { color: colors.text }]}>• Date range</Text>
            <Text style={[styles.bulletPoint, { color: colors.text }]}>• Category</Text>
            <Text style={[styles.bulletPoint, { color: colors.text }]}>• Transaction type (income/expense)</Text>
          </View>
        )}
        
        {/* Sync Section */}
        <TouchableOpacity 
          style={[styles.sectionHeader, { backgroundColor: colors.cardBackground }]} 
          onPress={() => toggleSection('sync')}
        >
          <View style={styles.sectionTitleContainer}>
            <FontAwesome name="refresh" size={20} color={AppColors.primary} style={styles.sectionIcon} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Data Synchronization</Text>
          </View>
          <FontAwesome 
            name={expandedSection === 'sync' ? 'chevron-up' : 'chevron-down'} 
            size={16} 
            color={colors.subText} 
          />
        </TouchableOpacity>
        
        {expandedSection === 'sync' && (
          <View style={[styles.sectionContent, { backgroundColor: colors.cardBackground }]}>
            <Text style={[styles.paragraph, { color: colors.text }]}>
              CaptainLedger is designed to work offline-first, but you can optionally sync your data:
            </Text>
            
            <Text style={[styles.sectionSubtitle, { color: colors.text }]}>Setting Up Sync</Text>
            <Text style={[styles.paragraph, { color: colors.text }]}>
              To enable synchronization:
            </Text>
            <Text style={[styles.bulletPoint, { color: colors.text }]}>• Go to Profile > Connect to Your Server</Text>
            <Text style={[styles.bulletPoint, { color: colors.text }]}>• Enter your self-hosted server address</Text>
            <Text style={[styles.bulletPoint, { color: colors.text }]}>• Enable Auto Sync in Settings if desired</Text>
            
            <Text style={[styles.paragraph, { color: colors.text }]}>
              For privacy reasons, CaptainLedger only syncs with servers you control. We don't store your financial data on our servers.
            </Text>
          </View>
        )}
        
        {/* Privacy Section */}
        <TouchableOpacity 
          style={[styles.sectionHeader, { backgroundColor: colors.cardBackground }]} 
          onPress={() => toggleSection('privacy')}
        >
          <View style={styles.sectionTitleContainer}>
            <FontAwesome name="lock" size={20} color={AppColors.primary} style={styles.sectionIcon} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Privacy & Security</Text>
          </View>
          <FontAwesome 
            name={expandedSection === 'privacy' ? 'chevron-up' : 'chevron-down'} 
            size={16} 
            color={colors.subText} 
          />
        </TouchableOpacity>
        
        {expandedSection === 'privacy' && (
          <View style={[styles.sectionContent, { backgroundColor: colors.cardBackground }]}>
            <Text style={[styles.paragraph, { color: colors.text }]}>
              CaptainLedger is built with privacy as a core principle:
            </Text>
            
            <Text style={[styles.bulletPoint, { color: colors.text }]}>• Your data is stored locally on your device</Text>
            <Text style={[styles.bulletPoint, { color: colors.text }]}>• We don't track your financial behavior</Text>
            <Text style={[styles.bulletPoint, { color: colors.text }]}>• Sync is optional and can be self-hosted</Text>
            <Text style={[styles.bulletPoint, { color: colors.text }]}>• No third-party analytics in your financial data</Text>
            
            <Text style={[styles.sectionSubtitle, { color: colors.text }]}>Data Backup</Text>
            <Text style={[styles.paragraph, { color: colors.text }]}>
              It's recommended to regularly back up your data:
            </Text>
            <Text style={[styles.bulletPoint, { color: colors.text }]}>• Use the Sync feature with your own server</Text>
            <Text style={[styles.bulletPoint, { color: colors.text }]}>• Export data to CSV (in Settings)</Text>
          </View>
        )}
        
        <View style={[styles.footer, { backgroundColor: colors.cardBackground }]}>
          <Text style={[styles.footerText, { color: colors.subText }]}>
            Need more help? Contact us at support@captainledger.com
          </Text>
          <Text style={[styles.versionText, { color: colors.subText }]}>
            CaptainLedger v1.0.0
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    padding: 30,
    alignItems: 'center',
    marginBottom: 16,
  },
  logo: {
    width: 60,
    height: 60,
    marginBottom: 10,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: AppColors.white,
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
  },
  intro: {
    padding: 20,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  introTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  introParagraph: {
    fontSize: 15,
    lineHeight: 22,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 1,
  },
  sectionTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionIcon: {
    marginRight: 10,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  sectionContent: {
    padding: 16,
    paddingTop: 0,
    marginHorizontal: 16,
    marginBottom: 8,
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 1,
  },
  sectionSubtitle: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  paragraph: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 8,
  },
  bulletPoint: {
    fontSize: 15,
    lineHeight: 22,
    marginLeft: 15,
    marginBottom: 5,
  },
  footer: {
    padding: 20,
    marginHorizontal: 16,
    marginVertical: 20,
    alignItems: 'center',
    borderRadius: 10,
  },
  footerText: {
    fontSize: 14,
    marginBottom: 8,
    textAlign: 'center',
  },
  versionText: {
    fontSize: 12,
  }
});