import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  FlatList,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useTheme } from '@/components/ThemeProvider';
import { useCurrency } from '@/components/CurrencyProvider';
import { Currency } from '@/services/currencyService';
import { AppColors } from '@/app/(tabs)/_layout';

interface CurrencySettingsModalProps {
  visible: boolean;
  onClose: () => void;
}

const CurrencySettingsModal: React.FC<CurrencySettingsModalProps> = ({
  visible,
  onClose,
}) => {
  const { colors, isDarkMode } = useTheme();
  const {
    primaryCurrency,
    setPrimaryCurrency,
    currencies,
    loading,
    refreshCurrencies,
    getUserCountryCurrency,
    requestCurrencyConversion,
    isOnline,
    conversionInProgress,
  } = useCurrency();

  const [searchQuery, setSearchQuery] = useState('');
  const [filteredCurrencies, setFilteredCurrencies] = useState<Currency[]>([]);
  const [saving, setSaving] = useState(false);

  // Filter currencies based on search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredCurrencies(currencies);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = currencies.filter(
        (currency) =>
          currency.name.toLowerCase().includes(query) ||
          currency.code.toLowerCase().includes(query) ||
          currency.country.toLowerCase().includes(query)
      );
      setFilteredCurrencies(filtered);
    }
  }, [searchQuery, currencies]);

  // Initialize filtered currencies when modal becomes visible
  useEffect(() => {
    if (visible && currencies.length > 0) {
      setFilteredCurrencies(currencies);
      // Refresh currencies when modal opens to ensure latest data
      if (!loading) {
        refreshCurrencies();
      }
    }
  }, [visible, currencies.length]);

  // Get user's detected currency
  const detectedCurrency = getUserCountryCurrency();
  
  const handleCurrencySelect = async (currencyCode: string) => {
    if (currencyCode === primaryCurrency) {
      onClose();
      return;
    }

    try {
      setSaving(true);
      
      // First set the new primary currency
      await setPrimaryCurrency(currencyCode);
      
      // Then request conversion of existing data
      const shouldConvert = await requestCurrencyConversion(primaryCurrency, currencyCode);
      
      if (shouldConvert) {
        console.log(`Currency conversion initiated from ${primaryCurrency} to ${currencyCode}`);
      }
      
      onClose();
    } catch (error) {
      console.error('Error setting currency:', error);
    } finally {
      setSaving(false);
    }
  };

  const renderCurrencyItem = ({ item }: { item: Currency }) => {
    const isSelected = item.code === primaryCurrency;
    const isDetected = item.code === detectedCurrency;

    return (
      <TouchableOpacity
        style={[
          styles.currencyItem,
          {
            backgroundColor: isSelected
              ? AppColors.primary + '15'
              : colors.cardBackground,
            borderColor: isSelected ? AppColors.primary : colors.border,
          },
        ]}
        onPress={() => handleCurrencySelect(item.code)}
        disabled={saving}
      >
        <View style={styles.currencyInfo}>
          <View style={styles.currencyHeader}>
            <Text
              style={[
                styles.currencyCode,
                {
                  color: isSelected ? AppColors.primary : colors.text,
                  fontWeight: isSelected ? 'bold' : '600',
                },
              ]}
            >
              {item.code}
            </Text>
            {isDetected && (
              <View style={[styles.detectedBadge, { backgroundColor: AppColors.secondary }]}>
                <Text style={styles.detectedText}>Auto-detected</Text>
              </View>
            )}
          </View>
          <Text style={[styles.currencyName, { color: colors.text }]}>
            {item.name}
          </Text>
          <Text style={[styles.currencyCountry, { color: colors.subText }]}>
            {item.country} • {item.symbol}
          </Text>
        </View>
        <View style={styles.currencyActions}>
          {isSelected && (
            <FontAwesome name="check-circle" size={20} color={AppColors.primary} />
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <FontAwesome name="times" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            Currency Settings
          </Text>
          <TouchableOpacity onPress={refreshCurrencies} style={styles.refreshButton}>
            <FontAwesome name="refresh" size={20} color={AppColors.primary} />
          </TouchableOpacity>
        </View>

        {/* Current Currency Info */}
        <View style={[styles.currentSection, { backgroundColor: colors.cardBackground }]}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Current Currency
            </Text>
            {/* Connectivity and Conversion Status */}
            <View style={styles.statusContainer}>
              {!isOnline && (
                <View style={[styles.statusBadge, { backgroundColor: '#FF9800' }]}>
                  <FontAwesome name="wifi" size={12} color="white" />
                  <Text style={styles.statusText}>Offline</Text>
                </View>
              )}
              {conversionInProgress && (
                <View style={[styles.statusBadge, { backgroundColor: AppColors.primary }]}>
                  <ActivityIndicator size="small" color="white" />
                  <Text style={styles.statusText}>Converting...</Text>
                </View>
              )}
            </View>
          </View>
          <View style={styles.currentCurrencyInfo}>
            <Text style={[styles.currentCurrency, { color: AppColors.primary }]}>
              {primaryCurrency}
            </Text>
            <Text style={[styles.currentCurrencyName, { color: colors.text }]}>
              {currencies.find(c => c.code === primaryCurrency)?.name || 'Unknown'}
            </Text>
          </View>
          {!isOnline && (
            <View style={[styles.offlineNotice, { backgroundColor: '#FF9800' + '20', borderColor: '#FF9800' }]}>
              <FontAwesome name="info-circle" size={14} color="#FF9800" />
              <Text style={[styles.offlineText, { color: '#FF9800' }]}>
                Currency changes will be queued and processed when connection is restored
              </Text>
            </View>
          )}
        </View>

        {/* Search */}
        <View style={[styles.searchSection, { backgroundColor: colors.cardBackground }]}>
          <View style={[styles.searchContainer, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}>
            <FontAwesome name="search" size={16} color={colors.subText} style={styles.searchIcon} />
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              placeholder="Search currencies..."
              placeholderTextColor={colors.subText}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <FontAwesome name="times-circle" size={16} color={colors.subText} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Currency List */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={AppColors.primary} />
            <Text style={[styles.loadingText, { color: colors.text }]}>
              Loading currencies...
            </Text>
          </View>
        ) : (
          <FlatList
            data={filteredCurrencies}
            renderItem={renderCurrencyItem}
            keyExtractor={(item) => item.code}
            style={styles.currencyList}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <FontAwesome name="search" size={40} color={colors.subText} style={{ opacity: 0.5 }} />
                <Text style={[styles.emptyText, { color: colors.text }]}>
                  No currencies found
                </Text>
                <Text style={[styles.emptySubtext, { color: colors.subText }]}>
                  Try adjusting your search terms
                </Text>
              </View>
            }
          />
        )}

        {/* Footer */}
        <View style={[styles.footer, { borderTopColor: colors.border }]}>
          <Text style={[styles.footerText, { color: colors.subText }]}>
            All transactions will be displayed in your selected currency using current exchange rates
          </Text>
          {!isOnline && (
            <Text style={[styles.footerText, { color: '#FF9800', marginTop: 8, fontWeight: '600' }]}>
              ⚠️ Offline mode: Currency changes will be processed when connection is restored
            </Text>
          )}
        </View>

        {/* Saving Overlay */}
        {(saving || conversionInProgress) && (
          <View style={styles.savingOverlay}>
            <ActivityIndicator size="large" color={AppColors.primary} />
            <Text style={[styles.savingText, { color: colors.text }]}>
              {conversionInProgress ? 'Converting all data...' : 'Updating currency...'}
            </Text>
            {conversionInProgress && (
              <Text style={[styles.footerText, { color: colors.subText, marginTop: 8, textAlign: 'center' }]}>
                This may take a few moments depending on the amount of data
              </Text>
            )}
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
  },
  closeButton: {
    padding: 5,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  refreshButton: {
    padding: 5,
  },
  currentSection: {
    padding: 20,
    margin: 16,
    borderRadius: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  currentCurrencyInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  currentCurrency: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  currentCurrencyName: {
    fontSize: 16,
  },
  searchSection: {
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
  },
  currencyList: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  currencyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    marginBottom: 8,
    borderRadius: 12,
    borderWidth: 2,
  },
  currencyInfo: {
    flex: 1,
  },
  currencyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  currencyCode: {
    fontSize: 16,
    fontWeight: '600',
    marginRight: 8,
  },
  detectedBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  detectedText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '600',
  },
  currencyName: {
    fontSize: 14,
    marginBottom: 2,
  },
  currencyCountry: {
    fontSize: 12,
  },
  currencyActions: {
    marginLeft: 12,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    marginTop: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: 'center',
  },
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderTopWidth: 1,
  },
  footerText: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 16,
  },
  savingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  savingText: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: '600',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  statusText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '600',
  },
  offlineNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
  },
  offlineText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '500',
  },
});

export default CurrencySettingsModal;
