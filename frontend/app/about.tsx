import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Linking,
  Platform
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useRouter } from 'expo-router';
import { useTheme } from '@/components/ThemeProvider';
import { AppColors } from '@/app/(tabs)/_layout';

export default function AboutScreen() {
  const { isDarkMode, colors } = useTheme();
  const router = useRouter();

  const openLink = (url: string) => {
    Linking.openURL(url);
  };

  const features = [
    {
      icon: 'shield',
      title: 'Privacy First',
      description: 'Your data stays on your device. Sync only with servers you control.'
    },
    {
      icon: 'wifi',
      title: 'Works Offline',
      description: 'Full functionality without internet. Sync when you\'re back online.'
    },
    {
      icon: 'exchange',
      title: 'Transaction Management',
      description: 'Easily track and categorize your income and expenses.'
    },
    {
      icon: 'mobile',
      title: 'Cross Platform',
      description: 'Works seamlessly on web, iOS, and Android devices.'
    },
    {
      icon: 'lock',
      title: 'Secure',
      description: 'End-to-end encryption for your sensitive financial data.'
    },
    {
      icon: 'chart-line',
      title: 'Analytics',
      description: 'Detailed insights and reports about your spending habits.'
    }
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={isDarkMode ? 'light' : 'dark'} />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* App Logo and Version */}
        <View style={[styles.heroSection, { backgroundColor: AppColors.secondary }]}>
          <Image
            source={require('@/assets/images/icon.png')}
            style={styles.appIcon}
          />
          <Text style={[styles.appName, { color: colors.text }]}>CaptainLedger</Text>
          <Text style={[styles.version, { color: colors.subText }]}>Version 1.0.0</Text>
          <Text style={[styles.tagline, { color: colors.subText }]}>
            Privacy-focused personal finance tracker
          </Text>
        </View>

        {/* Description */}
        <View style={[styles.section, { backgroundColor: colors.cardBackground }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>About</Text>
          <Text style={[styles.description, { color: colors.text }]}>
            CaptainLedger is a privacy-focused personal finance tracking application that works both online and offline. 
            Designed with privacy as a core principle, your financial data stays on your device by default, with optional 
            synchronization to your own server.
          </Text>
          <Text style={[styles.description, { color: colors.text }]}>
            The system provides seamless tracking of income, expenses, loans, investments, assets, and liabilities, 
            all while maintaining full control of your personal financial information. No third-party servers, no data mining, just pure financial tracking.
          </Text>
          <Text style={[styles.description, { color: colors.text }]}>
            Features like offline functionality, secure end-to-end encryption, and a robust real-time currency conversion system make CaptainLedger 
            ideal for privacy-conscious users and travelers who need reliable financial management anywhere.
          </Text>
        </View>

        {/* Features */}
        <View style={[styles.section, { backgroundColor: colors.cardBackground }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Features</Text>
          {features.map((feature, index) => (
            <View key={index} style={styles.featureItem}>
              <View style={[styles.featureIcon, { backgroundColor: AppColors.primary + '22' }]}>
                <FontAwesome name={feature.icon as any} size={20} color={AppColors.primary} />
              </View>
              <View style={styles.featureContent}>
                <Text style={[styles.featureTitle, { color: colors.text }]}>{feature.title}</Text>
                <Text style={[styles.featureDescription, { color: colors.subText }]}>
                  {feature.description}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* Tech Stack */}
        <View style={[styles.section, { backgroundColor: colors.cardBackground }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Technology</Text>
          <View style={styles.techItem}>
            <FontAwesome name="mobile" size={18} color={AppColors.primary} />
            <Text style={[styles.techText, { color: colors.text }]}>React Native with Expo Router</Text>
          </View>
          <View style={styles.techItem}>
            <FontAwesome name="server" size={18} color={AppColors.primary} />
            <Text style={[styles.techText, { color: colors.text }]}>Python/Flask API Backend</Text>
          </View>
          <View style={styles.techItem}>
            <FontAwesome name="database" size={18} color={AppColors.primary} />
            <Text style={[styles.techText, { color: colors.text }]}>SQLite Database</Text>
          </View>
          <View style={styles.techItem}>
            <FontAwesome name="lock" size={18} color={AppColors.primary} />
            <Text style={[styles.techText, { color: colors.text }]}>End-to-End Encryption</Text>
          </View>
        </View>

        {/* License */}
        <View style={[styles.section, { backgroundColor: colors.cardBackground }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>License</Text>
          <Text style={[styles.description, { color: colors.text }]}>
            CaptainLedger is licensed under the GNU Affero General Public License v3.0 (AGPL-3.0).
          </Text>
          <Text style={[styles.description, { color: colors.text }]}>
            This means the software is free and open source. You can use, modify, and distribute it, 
            but any modifications must also be made available under the same license.
          </Text>
          <TouchableOpacity 
            style={styles.linkButton}
            onPress={() => openLink('https://www.gnu.org/licenses/agpl-3.0.en.html')}
          >
            <FontAwesome name="external-link" size={16} color={AppColors.primary} />
            <Text style={[styles.linkText, { color: AppColors.primary }]}>Read Full License</Text>
          </TouchableOpacity>
        </View>

        {/* Links */}
        <View style={[styles.section, { backgroundColor: colors.cardBackground }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Links</Text>
          
          <TouchableOpacity 
            style={styles.linkButton}
            onPress={() => openLink('https://github.com/captainledger/captainledger')}
          >
            <FontAwesome name="github" size={20} color={colors.text} />
            <Text style={[styles.linkText, { color: colors.text }]}>Source Code</Text>
            <FontAwesome name="external-link" size={14} color={colors.subText} />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.linkButton}
            onPress={() => openLink('https://captainledger.com')}
          >
            <FontAwesome name="globe" size={20} color={colors.text} />
            <Text style={[styles.linkText, { color: colors.text }]}>Website</Text>
            <FontAwesome name="external-link" size={14} color={colors.subText} />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.linkButton}
            onPress={() => openLink('https://captainledger.com/docs')}
          >
            <FontAwesome name="book" size={20} color={colors.text} />
            <Text style={[styles.linkText, { color: colors.text }]}>Documentation</Text>
            <FontAwesome name="external-link" size={14} color={colors.subText} />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.linkButton}
            onPress={() => openLink('https://github.com/captainledger/captainledger/issues')}
          >
            <FontAwesome name="bug" size={20} color={colors.text} />
            <Text style={[styles.linkText, { color: colors.text }]}>Report Issues</Text>
            <FontAwesome name="external-link" size={14} color={colors.subText} />
          </TouchableOpacity>

          {/* Donation button */}
          <TouchableOpacity
            style={[styles.linkButton, { marginTop: 20, justifyContent: 'center' }]}
            onPress={() => openLink('https://captainledger.com/donate')}
          >
            <FontAwesome name="heart" size={20} color={AppColors.primary} />
            <Text style={[styles.linkText, { color: AppColors.primary, fontWeight: 'bold' }]}>
              Support CaptainLedger - Donate
            </Text>
          </TouchableOpacity>
        </View>

        {/* Developer Info */}
        <View style={[styles.section, { backgroundColor: colors.cardBackground }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Developer</Text>
          <Text style={[styles.description, { color: colors.text }]}>
            Built with ❤️ by Lusan Sapkota, a passionate developer focused on privacy, offline-first apps, and empowering users with control over their data.
          </Text>
          <Text style={[styles.description, { color: colors.text }]}>
            Reach out on{' '}
            <Text style={{ color: AppColors.primary, textDecorationLine: 'underline' }} onPress={() => openLink('https://linkedin.com/in/lusansapkota')}>
              LinkedIn
            </Text>{' '}
            or{' '}
            <Text style={{ color: AppColors.primary, textDecorationLine: 'underline' }} onPress={() => openLink('https://github.com/lusansapkota')}>
              GitHub
            </Text>.
          </Text>
          <Text style={[styles.description, { color: colors.subText }]}>
            © 2024 CaptainLedger. All rights reserved.
          </Text>
        </View>

        {/* Bottom Spacing */}
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  heroSection: {
    alignItems: 'center',
    padding: 30,
    borderRadius: 15,
    marginBottom: 20,
  },
  appIcon: {
    width: 80,
    height: 80,
    borderRadius: 20,
    marginBottom: 15,
  },
  appName: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  version: {
    fontSize: 16,
    marginBottom: 10,
  },
  tagline: {
    fontSize: 16,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  section: {
    borderRadius: 15,
    padding: 20,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 12,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  featureIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  featureContent: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 5,
  },
  featureDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  techItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  techText: {
    fontSize: 16,
    marginLeft: 12,
  },
  linkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  linkText: {
    fontSize: 16,
    marginLeft: 12,
    flex: 1,
  },
});
