import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useTheme } from '@/components/ThemeProvider';
import { AppColors } from '@/app/(tabs)/_layout';

export default function DonationScreen() {
  const { isDarkMode, colors } = useTheme();

  const openDonateLink = () => {
    Linking.openURL('https://donate.lusansapkota.com.np/donation');
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={isDarkMode ? 'light' : 'dark'} />
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>

        {/* Hero Section */}
        <View style={[styles.heroSection, { backgroundColor: AppColors.secondary }]}>
          <FontAwesome name="heart" size={40} color="white" />
          <Text style={[styles.title, { color: 'white' }]}>Support CaptainLedger</Text>
          <Text style={[styles.subtitle, { color: '#f0f0f0' }]}>
            A solo-built, privacy-first expense manager that respects your data and your freedom.
          </Text>
        </View>

        {/* Why Donate Section */}
        <View style={[styles.section, { backgroundColor: colors.cardBackground }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Why Donate?</Text>
          <Text style={[styles.description, { color: colors.text }]}>
            CaptainLedger is not a startup with investors. It's not backed by a corporation. It's a personal, independent project built and maintained by just one developer — me, <Text style={{ fontWeight: 'bold' }}>Lusan Sapkota</Text>.
          </Text>
          <Text style={[styles.description, { color: colors.text }]}>
            I created this app because I believe financial tools should be private, offline-capable, and user-owned. Your data should be yours — not sold, not harvested, and not stored on someone else's server unless you choose to.
          </Text>
          <Text style={[styles.description, { color: colors.text }]}>
            Every feature, every update, every bug fix — it's all done by hand, without a team, and without funding. If CaptainLedger has helped you manage your finances, stay organized, or simply feel more in control, consider giving back.
          </Text>
        </View>

        {/* Donation Impact */}
        <View style={[styles.section, { backgroundColor: colors.cardBackground }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>What Your Donation Supports</Text>

          <View style={styles.supportItem}>
            <FontAwesome name="code" size={20} color={AppColors.primary} />
            <Text style={[styles.supportText, { color: colors.text }]}>
              Time spent building features, fixing bugs, and testing on multiple platforms
            </Text>
          </View>

          <View style={styles.supportItem}>
            <FontAwesome name="server" size={20} color={AppColors.primary} />
            <Text style={[styles.supportText, { color: colors.text }]}>
              Email servers, custom domain costs, and distribution fees (like app stores)
            </Text>
          </View>

          <View style={styles.supportItem}>
            <FontAwesome name="book" size={20} color={AppColors.primary} />
            <Text style={[styles.supportText, { color: colors.text }]}>
              Writing and maintaining helpful documentation for users and developers
            </Text>
          </View>

          <View style={styles.supportItem}>
            <FontAwesome name="lock" size={20} color={AppColors.primary} />
            <Text style={[styles.supportText, { color: colors.text }]}>
              Improving privacy and security features with every release
            </Text>
          </View>

          <View style={styles.supportItem}>
            <FontAwesome name="coffee" size={20} color={AppColors.primary} />
            <Text style={[styles.supportText, { color: colors.text }]}>
              A few cups of coffee ☕ that help keep the focus and energy alive
            </Text>
          </View>
        </View>

        {/* Call to Action */}
        <View style={[styles.section, { backgroundColor: colors.cardBackground }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Be Part of the Journey</Text>
          <Text style={[styles.description, { color: colors.text }]}>
            By donating, you're directly helping an independent developer continue building ethical software that prioritizes your privacy and control.
          </Text>
          <Text style={[styles.description, { color: colors.text }]}>
            Whether it's a small tip or a generous contribution, every donation counts—and it helps keep CaptainLedger forever free of ads and bloat. As long as basic costs are covered, this app will always stay focused, fast, and respectful of your attention.
          </Text>
          <TouchableOpacity style={styles.donateButton} onPress={openDonateLink}>
            <FontAwesome name="heart" size={18} color="white" />
            <Text style={styles.donateButtonText}>Donate Here</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 80 }} />
      </ScrollView>

      {/* Floating Donate Button */}
      <TouchableOpacity style={styles.fab} onPress={openDonateLink}>
        <FontAwesome name="heart" size={24} color="white" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  heroSection: {
    alignItems: 'center',
    padding: 30,
    borderRadius: 15,
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginTop: 10,
  },
  subtitle: {
    fontSize: 16,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 10,
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
  supportItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  supportText: {
    fontSize: 16,
    marginLeft: 12,
  },
  donateButton: {
    flexDirection: 'row',
    backgroundColor: AppColors.primary,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginTop: 10,
  },
  donateButtonText: {
    fontSize: 16,
    color: 'white',
    marginLeft: 10,
    fontWeight: 'bold',
  },
  fab: {
    position: 'absolute',
    bottom: 25,
    right: 25,
    backgroundColor: AppColors.primary,
    borderRadius: 30,
    width: 60,
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
  },
});
