import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  Platform,
  RefreshControl,
  View as RNView,
  ActivityIndicator,
  FlatList
} from 'react-native';
import { Text, View } from '@/components/Themed';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

// Local components
import { useAlert } from '@/components/AlertProvider';
import { useTheme } from '@/components/ThemeProvider';

// Services & API
import {
  getInvestments,
  createInvestment,
  updateInvestment,
  deleteInvestment,
  addROIEntry,
  getROIHistory,
  getInvestmentAnalytics,
  Investment,
  ROIEntry,
  InvestmentAnalytics
} from '@/services/api';
import { AppColors } from './(tabs)/_layout';

export default function InvestmentsScreen() {
  const { isDarkMode, colors } = useTheme();
  const { showAlert } = useAlert();
  
  // States
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [analytics, setAnalytics] = useState<InvestmentAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Modal states
  const [modalVisible, setModalVisible] = useState(false);
  const [roiModalVisible, setROIModalVisible] = useState(false);
  const [selectedInvestment, setSelectedInvestment] = useState<Investment | null>(null);
  const [roiHistory, setROIHistory] = useState<ROIEntry[]>([]);
  
  // Form states
  const [newInvestment, setNewInvestment] = useState({
    name: '',
    platform: '',
    investment_type: 'stocks',
    initial_amount: '',
    current_value: '',
    expected_roi: '',
    currency: 'USD',
    purchase_date: new Date().toISOString().split('T')[0],
    maturity_date: '',
    status: 'active' as 'active' | 'matured' | 'sold',
    notes: ''
  });
  
  const [roiEntry, setROIEntry] = useState({
    recorded_value: '',
    entry_date: new Date().toISOString().split('T')[0],
    note: ''
  });
  
  // Date picker states
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [datePickerMode, setDatePickerMode] = useState<'purchase' | 'maturity' | 'roi'>('purchase');
  
  const [editingInvestmentId, setEditingInvestmentId] = useState<string | null>(null);

  useEffect(() => {
    loadInvestments();
    loadAnalytics();
  }, []);

  const loadInvestments = async (isRefreshing = false) => {
    if (isRefreshing) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    
    try {
      const response = await getInvestments();
      if (response?.data?.investments) {
        setInvestments(response.data.investments);
      }
    } catch (err) {
      console.error('Error loading investments:', err);
      showAlert('Error', 'Failed to load investments', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadAnalytics = async () => {
    try {
      const response = await getInvestmentAnalytics();
      if (response?.data?.analytics) {
        setAnalytics(response.data.analytics);
      }
    } catch (err) {
      console.error('Error loading analytics:', err);
    }
  };

  const handleAddInvestment = async () => {
    if (!newInvestment.name || !newInvestment.initial_amount) {
      showAlert('Invalid Input', 'Please enter investment name and initial amount', 'error');
      return;
    }

    try {
      setLoading(true);
      
      const investmentData = {
        ...newInvestment,
        initial_amount: parseFloat(newInvestment.initial_amount),
        current_value: newInvestment.current_value ? parseFloat(newInvestment.current_value) : parseFloat(newInvestment.initial_amount),
        expected_roi: newInvestment.expected_roi ? parseFloat(newInvestment.expected_roi) : undefined
      };

      if (editingInvestmentId) {
        await updateInvestment(editingInvestmentId, investmentData);
        showAlert('Success', 'Investment updated successfully', 'success');
      } else {
        await createInvestment(investmentData);
        showAlert('Success', 'Investment added successfully', 'success');
      }

      setModalVisible(false);
      resetForm();
      loadInvestments();
      loadAnalytics();
    } catch (error) {
      console.error('Error saving investment:', error);
      showAlert('Error', 'Failed to save investment', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleAddROI = async () => {
    if (!roiEntry.recorded_value || !selectedInvestment) {
      showAlert('Invalid Input', 'Please enter the current value', 'error');
      return;
    }

    try {
      setLoading(true);
      
      const roiData = {
        recorded_value: parseFloat(roiEntry.recorded_value),
        entry_date: roiEntry.entry_date,
        note: roiEntry.note
      };

      await addROIEntry(selectedInvestment.id, roiData);
      showAlert('Success', 'ROI entry added successfully', 'success');
      
      setROIModalVisible(false);
      setROIEntry({
        recorded_value: '',
        entry_date: new Date().toISOString().split('T')[0],
        note: ''
      });
      
      loadInvestments();
      loadAnalytics();
    } catch (error) {
      console.error('Error adding ROI entry:', error);
      showAlert('Error', 'Failed to add ROI entry', 'error');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setNewInvestment({
      name: '',
      platform: '',
      investment_type: 'stocks',
      initial_amount: '',
      current_value: '',
      expected_roi: '',
      currency: 'USD',
      purchase_date: new Date().toISOString().split('T')[0],
      maturity_date: '',
      status: 'active',
      notes: ''
    });
    setEditingInvestmentId(null);
  };

  const handleEditInvestment = (investment: Investment) => {
    setNewInvestment({
      name: investment.name,
      platform: investment.platform || '',
      investment_type: investment.investment_type || 'stocks',
      initial_amount: investment.initial_amount.toString(),
      current_value: investment.current_value?.toString() || '',
      expected_roi: investment.expected_roi?.toString() || '',
      currency: investment.currency || 'USD',
      purchase_date: investment.purchase_date,
      maturity_date: investment.maturity_date || '',
      status: (investment.status || 'active') as 'active' | 'matured' | 'sold',
      notes: investment.notes || ''
    });
    setEditingInvestmentId(investment.id);
    setModalVisible(true);
  };

  const confirmDeleteInvestment = (investment: Investment) => {
    Alert.alert(
      'Delete Investment',
      'Are you sure you want to delete this investment?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive', 
          onPress: async () => {
            try {
              await deleteInvestment(investment.id);
              showAlert('Success', 'Investment deleted successfully', 'success');
              loadInvestments();
              loadAnalytics();
            } catch (error) {
              showAlert('Error', 'Failed to delete investment', 'error');
            }
          }
        }
      ]
    );
  };

  const openROIModal = (investment: Investment) => {
    setSelectedInvestment(investment);
    setROIEntry({
      recorded_value: investment.current_value?.toString() || '',
      entry_date: new Date().toISOString().split('T')[0],
      note: ''
    });
    setROIModalVisible(true);
  };

  const handleDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    
    if (selectedDate) {
      const formattedDate = selectedDate.toISOString().split('T')[0];
      
      if (datePickerMode === 'purchase') {
        setNewInvestment({...newInvestment, purchase_date: formattedDate});
      } else if (datePickerMode === 'maturity') {
        setNewInvestment({...newInvestment, maturity_date: formattedDate});
      } else if (datePickerMode === 'roi') {
        setROIEntry({...roiEntry, entry_date: formattedDate});
      }
    }
  };

  const renderAnalyticsCard = () => {
    if (!analytics) return null;

    return (
      <View style={[styles.analyticsCard, { backgroundColor: colors.cardBackground }]}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>Investment Overview</Text>
        
        <View style={[styles.analyticsGrid, { backgroundColor: 'transparent' }]}>
          <View style={[styles.analyticsItem, { backgroundColor: 'transparent' }]}>
            <Text style={[styles.analyticsLabel, { color: colors.subText }]}>Total Invested</Text>
            <Text style={[styles.analyticsValue, { color: AppColors.primary }]}>
              ${analytics.total_invested.toFixed(2)}
            </Text>
          </View>
          
          <View style={[styles.analyticsItem, { backgroundColor: 'transparent' }]}>
            <Text style={[styles.analyticsLabel, { color: colors.subText }]}>Current Value</Text>
            <Text style={[styles.analyticsValue, { color: AppColors.secondary }]}>
              ${analytics.total_current_value.toFixed(2)}
            </Text>
          </View>
          
          <View style={[styles.analyticsItem, { backgroundColor: 'transparent' }]}>
            <Text style={[styles.analyticsLabel, { color: colors.subText }]}>Total ROI</Text>
            <Text style={[styles.analyticsValue, { 
              color: analytics.total_roi_percentage >= 0 ? AppColors.primary : AppColors.danger 
            }]}>
              {analytics.total_roi_percentage.toFixed(2)}%
            </Text>
          </View>
          
          <View style={[styles.analyticsItem, { backgroundColor: 'transparent' }]}>
            <Text style={[styles.analyticsLabel, { color: colors.subText }]}>Gain/Loss</Text>
            <Text style={[styles.analyticsValue, { 
              color: analytics.total_gain_loss >= 0 ? AppColors.primary : AppColors.danger 
            }]}>
              {analytics.total_gain_loss >= 0 ? '+' : ''}${analytics.total_gain_loss.toFixed(2)}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  const renderInvestmentItem = ({ item }: { item: Investment }) => {
    const roiColor = (item.actual_roi || 0) >= 0 ? AppColors.primary : AppColors.danger;
    
    return (
      <TouchableOpacity 
        style={[styles.investmentItem, { backgroundColor: colors.cardBackground }]}
        onLongPress={() => confirmDeleteInvestment(item)}
      >
        <View style={[styles.investmentLeft, { backgroundColor: 'transparent' }]}>
          <View style={[styles.investmentIcon, { backgroundColor: AppColors.secondary }]}>
            <Ionicons name="trending-up" size={20} color="white" />
          </View>
          
          <View style={[styles.investmentDetails, { backgroundColor: 'transparent' }]}>
            <Text style={[styles.investmentName, { color: colors.text }]}>
              {item.name}
            </Text>
            <Text style={[styles.investmentPlatform, { color: colors.subText }]}>
              {item.platform || item.investment_type} • {item.days_held || 0} days
            </Text>
            <Text style={[styles.investmentDate, { color: colors.subText }]}>
              Purchased: {new Date(item.purchase_date).toLocaleDateString()}
            </Text>
          </View>
        </View>
        
        <View style={[styles.investmentRight, { backgroundColor: 'transparent' }]}>
          <Text style={[styles.investmentValue, { color: colors.text }]}>
            ${item.current_value?.toFixed(2) || item.initial_amount.toFixed(2)}
          </Text>
          <Text style={[styles.investmentROI, { color: roiColor }]}>
            {(item.actual_roi || 0) >= 0 ? '+' : ''}{(item.actual_roi || 0).toFixed(2)}%
          </Text>
          
          <View style={[styles.actionButtons, { backgroundColor: 'transparent' }]}>
            <TouchableOpacity 
              style={[styles.actionButton, { backgroundColor: 'transparent' }]}
              onPress={() => openROIModal(item)}
            >
              <FontAwesome name="plus" size={12} color={AppColors.primary} />
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.actionButton, { backgroundColor: 'transparent' }]}
              onPress={() => handleEditInvestment(item)}
            >
              <FontAwesome name="pencil" size={12} color={AppColors.secondary} />
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const onRefresh = useCallback(() => {
    loadInvestments(true);
    loadAnalytics();
  }, []);

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={AppColors.primary} />
          <Text style={[styles.loadingText, { color: colors.text }]}>Loading investments...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={isDarkMode ? 'light' : 'dark'} />
      
      <ScrollView 
        style={styles.scrollView}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh}
            colors={[AppColors.primary]}
            tintColor={AppColors.primary}
          />
        }
      >
        {/* Analytics Card */}
        {renderAnalyticsCard()}
        
        {/* Investments List */}
        <View style={[styles.investmentsList, { backgroundColor: 'transparent' }]}>
          {investments.length > 0 ? (
            investments.map((investment) => (
              <View key={investment.id}>
                {renderInvestmentItem({ item: investment })}
              </View>
            ))
          ) : (
            <View style={styles.emptyContainer}>
              <FontAwesome name="line-chart" size={60} color={colors.subText} style={{ opacity: 0.5 }} />
              <Text style={[styles.emptyText, { color: colors.text }]}>No investments yet</Text>
              <Text style={[styles.emptySubtext, { color: colors.subText }]}>
                Start tracking your investments to see ROI and analytics
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Floating Action Button */}
      <TouchableOpacity 
        style={[styles.fab, { backgroundColor: AppColors.primary }]}
        onPress={() => setModalVisible(true)}
      >
        <FontAwesome name="plus" size={24} color="white" />
      </TouchableOpacity>

      {/* Add/Edit Investment Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.cardBackground }]}>
            <View style={[styles.modalHeader, { backgroundColor: 'transparent' }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {editingInvestmentId ? 'Edit Investment' : 'Add Investment'}
              </Text>
              <TouchableOpacity onPress={() => {
                setModalVisible(false);
                resetForm();
              }}>
                <FontAwesome name="times" size={20} color={colors.text} />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.modalScroll}>
              {/* Investment Name */}
              <Text style={[styles.inputLabel, { color: colors.text }]}>Investment Name *</Text>
              <TextInput
                style={[styles.input, { 
                  backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)',
                  color: colors.text 
                }]}
                placeholder="Apple Stock, Bitcoin, Real Estate, etc."
                placeholderTextColor={colors.subText}
                value={newInvestment.name}
                onChangeText={(text) => setNewInvestment({...newInvestment, name: text})}
              />
              
              {/* Investment Type */}
              <Text style={[styles.inputLabel, { color: colors.text }]}>Investment Type</Text>
              <View style={[styles.typeSelector, { backgroundColor: 'transparent' }]}>
                {['stocks', 'crypto', 'bonds', 'real_estate', 'mutual_funds', 'other'].map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.typeButton,
                      {
                        backgroundColor: newInvestment.investment_type === type 
                          ? AppColors.primary 
                          : (isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)')
                      }
                    ]}
                    onPress={() => setNewInvestment({...newInvestment, investment_type: type})}
                  >
                    <Text style={{
                      color: newInvestment.investment_type === type ? 'white' : colors.text,
                      fontSize: 12,
                      textTransform: 'capitalize'
                    }}>
                      {type.replace('_', ' ')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              
              {/* Platform */}
              <Text style={[styles.inputLabel, { color: colors.text }]}>Platform/Broker</Text>
              <TextInput
                style={[styles.input, { 
                  backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)',
                  color: colors.text 
                }]}
                placeholder="Robinhood, Coinbase, etc."
                placeholderTextColor={colors.subText}
                value={newInvestment.platform}
                onChangeText={(text) => setNewInvestment({...newInvestment, platform: text})}
              />
              
              {/* Amount Fields */}
              <View style={[styles.amountRow, { backgroundColor: 'transparent' }]}>
                <View style={[styles.amountField, { backgroundColor: 'transparent' }]}>
                  <Text style={[styles.inputLabel, { color: colors.text }]}>Initial Amount *</Text>
                  <TextInput
                    style={[styles.input, { 
                      backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)',
                      color: colors.text 
                    }]}
                    placeholder="1000"
                    placeholderTextColor={colors.subText}
                    keyboardType="decimal-pad"
                    value={newInvestment.initial_amount}
                    onChangeText={(text) => setNewInvestment({...newInvestment, initial_amount: text})}
                  />
                </View>
                
                <View style={[styles.amountField, { backgroundColor: 'transparent' }]}>
                  <Text style={[styles.inputLabel, { color: colors.text }]}>Current Value</Text>
                  <TextInput
                    style={[styles.input, { 
                      backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)',
                      color: colors.text 
                    }]}
                    placeholder="1200"
                    placeholderTextColor={colors.subText}
                    keyboardType="decimal-pad"
                    value={newInvestment.current_value}
                    onChangeText={(text) => setNewInvestment({...newInvestment, current_value: text})}
                  />
                </View>
              </View>
              
              {/* Expected ROI */}
              <Text style={[styles.inputLabel, { color: colors.text }]}>Expected ROI (% per year)</Text>
              <TextInput
                style={[styles.input, { 
                  backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)',
                  color: colors.text 
                }]}
                placeholder="12.5"
                placeholderTextColor={colors.subText}
                keyboardType="decimal-pad"
                value={newInvestment.expected_roi}
                onChangeText={(text) => setNewInvestment({...newInvestment, expected_roi: text})}
              />
              
              {/* Purchase Date */}
              <Text style={[styles.inputLabel, { color: colors.text }]}>Purchase Date</Text>
              <TouchableOpacity 
                style={[styles.dateField, { 
                  backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)'
                }]}
                onPress={() => {
                  setDatePickerMode('purchase');
                  setShowDatePicker(true);
                }}
              >
                <FontAwesome name="calendar" size={16} color={colors.text} />
                <Text style={[styles.dateText, { color: colors.text }]}>
                  {new Date(newInvestment.purchase_date).toLocaleDateString()}
                </Text>
              </TouchableOpacity>
              
              {/* Notes */}
              <Text style={[styles.inputLabel, { color: colors.text }]}>Notes</Text>
              <TextInput
                style={[styles.input, styles.notesInput, { 
                  backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)',
                  color: colors.text 
                }]}
                placeholder="Investment strategy, goals, etc."
                placeholderTextColor={colors.subText}
                multiline
                numberOfLines={3}
                value={newInvestment.notes}
                onChangeText={(text) => setNewInvestment({...newInvestment, notes: text})}
              />
              
              {/* Action Buttons */}
              <View style={[styles.modalActions, { backgroundColor: 'transparent' }]}>
                <TouchableOpacity 
                  style={[styles.cancelButton, { borderColor: colors.subText }]}
                  onPress={() => {
                    setModalVisible(false);
                    resetForm();
                  }}
                >
                  <Text style={[styles.cancelButtonText, { color: colors.subText }]}>Cancel</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[styles.saveButton, { backgroundColor: AppColors.primary }]}
                  onPress={handleAddInvestment}
                >
                  <Text style={styles.saveButtonText}>
                    {editingInvestmentId ? 'Update' : 'Add Investment'}
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ROI Entry Modal */}
      <Modal visible={roiModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.cardBackground }]}>
            <View style={[styles.modalHeader, { backgroundColor: 'transparent' }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                Update ROI for {selectedInvestment?.name}
              </Text>
              <TouchableOpacity onPress={() => setROIModalVisible(false)}>
                <FontAwesome name="times" size={20} color={colors.text} />
              </TouchableOpacity>
            </View>
            
            <View style={[styles.roiModalContent, { backgroundColor: 'transparent' }]}>
              {/* Current Value Input */}
              <Text style={[styles.inputLabel, { color: colors.text }]}>Current Value *</Text>
              <TextInput
                style={[styles.input, { 
                  backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)',
                  color: colors.text 
                }]}
                placeholder="Enter current value"
                placeholderTextColor={colors.subText}
                keyboardType="decimal-pad"
                value={roiEntry.recorded_value}
                onChangeText={(text) => setROIEntry({...roiEntry, recorded_value: text})}
              />
              
              {/* Entry Date */}
              <Text style={[styles.inputLabel, { color: colors.text }]}>Entry Date</Text>
              <TouchableOpacity 
                style={[styles.dateField, { 
                  backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)'
                }]}
                onPress={() => {
                  setDatePickerMode('roi');
                  setShowDatePicker(true);
                }}
              >
                <FontAwesome name="calendar" size={16} color={colors.text} />
                <Text style={[styles.dateText, { color: colors.text }]}>
                  {new Date(roiEntry.entry_date).toLocaleDateString()}
                </Text>
              </TouchableOpacity>
              
              {/* Note */}
              <Text style={[styles.inputLabel, { color: colors.text }]}>Note (Optional)</Text>
              <TextInput
                style={[styles.input, { 
                  backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)',
                  color: colors.text 
                }]}
                placeholder="Market update, news, etc."
                placeholderTextColor={colors.subText}
                value={roiEntry.note}
                onChangeText={(text) => setROIEntry({...roiEntry, note: text})}
              />
              
              {/* ROI Calculation Preview */}
              {selectedInvestment && roiEntry.recorded_value && (
                <View style={[styles.roiPreview, { 
                  backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)',
                  borderColor: AppColors.primary
                }]}>
                  <Text style={[styles.roiPreviewTitle, { color: AppColors.primary }]}>ROI Preview</Text>
                  {(() => {
                    const initialAmount = selectedInvestment.initial_amount;
                    const currentValue = parseFloat(roiEntry.recorded_value);
                    const roi = ((currentValue - initialAmount) / initialAmount) * 100;
                    const gainLoss = currentValue - initialAmount;
                    
                    return (
                      <>
                        <Text style={[styles.roiPreviewText, { color: colors.text }]}>
                          Initial: ${initialAmount.toFixed(2)}
                        </Text>
                        <Text style={[styles.roiPreviewText, { color: colors.text }]}>
                          Current: ${currentValue.toFixed(2)}
                        </Text>
                        <Text style={[styles.roiPreviewText, { 
                          color: roi >= 0 ? AppColors.primary : AppColors.danger 
                        }]}>
                          ROI: {roi >= 0 ? '+' : ''}{roi.toFixed(2)}%
                        </Text>
                        <Text style={[styles.roiPreviewText, { 
                          color: gainLoss >= 0 ? AppColors.primary : AppColors.danger 
                        }]}>
                          Gain/Loss: {gainLoss >= 0 ? '+' : ''}${gainLoss.toFixed(2)}
                        </Text>
                      </>
                    );
                  })()}
                </View>
              )}
              
              {/* Action Buttons */}
              <View style={[styles.modalActions, { backgroundColor: 'transparent' }]}>
                <TouchableOpacity 
                  style={[styles.cancelButton, { borderColor: colors.subText }]}
                  onPress={() => setROIModalVisible(false)}
                >
                  <Text style={[styles.cancelButtonText, { color: colors.subText }]}>Cancel</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[styles.saveButton, { backgroundColor: AppColors.primary }]}
                  onPress={handleAddROI}
                >
                  <Text style={styles.saveButtonText}>Add ROI Entry</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* Date Picker */}
      {showDatePicker && (
        <DateTimePicker
          value={new Date()}
          mode="date"
          display="default"
          onChange={handleDateChange}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
  scrollView: {
    flex: 1,
  },
  analyticsCard: {
    margin: 16,
    borderRadius: 12,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  analyticsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  analyticsItem: {
    width: '48%',
    marginBottom: 15,
  },
  analyticsLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  analyticsValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  investmentsList: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  investmentItem: {
    flexDirection: 'row',
    padding: 16,
    marginBottom: 12,
    borderRadius: 12,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  investmentLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  investmentIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  investmentDetails: {
    flex: 1,
  },
  investmentName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  investmentPlatform: {
    fontSize: 12,
    marginBottom: 2,
  },
  investmentDate: {
    fontSize: 11,
  },
  investmentRight: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  investmentValue: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  investmentROI: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  actionButtons: {
    flexDirection: 'row',
  },
  actionButton: {
    padding: 8,
    marginLeft: 8,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 10,
    marginBottom: 5,
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
    maxHeight: '80%',
    borderRadius: 12,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalScroll: {
    maxHeight: 400,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 6,
    marginTop: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  typeSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 10,
  },
  typeButton: {
    padding: 8,
    borderRadius: 6,
    marginRight: 8,
    marginBottom: 8,
  },
  amountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  amountField: {
    width: '48%',
  },
  dateField: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
    borderRadius: 8,
    padding: 12,
  },
  dateText: {
    marginLeft: 8,
    fontSize: 16,
  },
  notesInput: {
    height: 80,
    textAlignVertical: 'top',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  cancelButton: {
    flex: 1,
    padding: 12,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: 'center',
    marginRight: 10,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
  saveButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginLeft: 10,
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  roiModalContent: {
    paddingBottom: 20,
  },
  roiPreview: {
    padding: 15,
    borderRadius: 8,
    marginTop: 15,
    borderWidth: 1,
  },
  roiPreviewTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  roiPreviewText: {
    fontSize: 14,
    marginBottom: 4,
  },
});