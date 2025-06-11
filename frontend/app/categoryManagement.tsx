import React, { useState, useEffect } from 'react';
import { 
  View, Text, FlatList, TouchableOpacity, TextInput, StyleSheet, 
  Modal, ActivityIndicator, SafeAreaView 
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTheme } from '@/components/ThemeProvider';
import { useAlert } from '@/components/AlertProvider';
import { getCategoriesApi, addCategory, deleteCategory, updateCategory } from '@/services/api';
import { AppColors } from '@/app/(tabs)/_layout';

export default function CategoryManagementScreen() {
  const { isDarkMode, colors } = useTheme();
  const { showAlert } = useAlert();
  const router = useRouter();
  
  // Get the category type from params (if provided)
  const params = useLocalSearchParams();
  const initialCategoryType = (params.type as 'income' | 'expense') || 'expense';
  
  // Category type
  type Category = {
    name: string;
    color: string;
    icon: string;
    type: 'income' | 'expense';
  };
  
  // States
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [selectedCategoryColor, setSelectedCategoryColor] = useState('#FF5722');
  const [categoryType, setCategoryType] = useState<'income' | 'expense'>(initialCategoryType);
  const [activeTab, setActiveTab] = useState<'income' | 'expense'>(initialCategoryType);
  const [isEditing, setIsEditing] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  
  // Predefined colors for category selection
  const CATEGORY_COLORS = [
    '#FF5722', '#E91E63', '#9C27B0', '#673AB7', '#3F51B5',
    '#2196F3', '#03A9F4', '#00BCD4', '#009688', '#4CAF50',
    '#8BC34A', '#CDDC39', '#FFEB3B', '#FFC107', '#FF9800'
  ];

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    setLoading(true);
    try {
      const response = await getCategoriesApi();
      if (response?.data?.categories) {
        setCategories(
          response.data.categories.map((cat: any) => ({
            name: cat.name,
            color: cat.color,
            icon: cat.icon ?? 'ellipsis-horizontal',
            type: cat.type || (isIncomeCategory(cat.name) ? 'income' : 'expense')
          }))
        );
      }
    } catch (err) {
      console.error('Error loading categories:', err);
      showAlert('Error', 'Failed to load categories', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Helper function to determine if a category is for income
  const isIncomeCategory = (name: string): boolean => {
    const incomeCategories = ['Income', 'Salary', 'Investments'];
    return incomeCategories.includes(name);
  };

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) {
      showAlert('Error', 'Category name is required', 'error');
      return;
    }

    setLoading(true);
    try {
      // Create the category object
      const newCategory = {
        name: newCategoryName.trim(),
        color: selectedCategoryColor,
        icon: 'apps', // Default icon
        type: categoryType
      };
      
      // Call the API to save the category
      await addCategory(newCategory.name, newCategory.color, newCategory.type);
      
      // Add to local state
      setCategories([...categories, newCategory]);
      setNewCategoryName('');
      setSelectedCategoryColor('#FF5722');
      setShowCategoryModal(false);
      showAlert('Success', 'Category added successfully', 'success');
      
      // If coming from transaction screen, go back
      if (params.from === 'transaction') {
        router.back();
      }
    } catch (error) {
      console.error('Error adding category:', error);
      const errorMessage = (error as any).response?.data?.error || 'Failed to add category';
      showAlert('Error', errorMessage, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCategory = async (categoryName: string) => {
    try {
      await deleteCategory(categoryName);
      const updatedCategories = categories.filter(c => c.name !== categoryName);
      setCategories(updatedCategories);
      showAlert('Success', 'Category deleted successfully', 'success');
    } catch (error) {
      console.error('Error deleting category:', error);
      showAlert('Error', 'Failed to delete category', 'error');
    }
  };
  
  const handleEditCategory = (item: Category) => {
    setIsEditing(true);
    setEditingCategory(item);
    setNewCategoryName(item.name);
    setSelectedCategoryColor(item.color);
    setCategoryType(item.type);
    setShowCategoryModal(true);
  };

  // Add this function to handle updating categories
  const handleUpdateCategory = async () => {
    if (!newCategoryName.trim() || !editingCategory) {
      showAlert('Error', 'Category name is required', 'error');
      return;
    }

    setLoading(true);
    try {
      // Create the updated category object
      const updatedCategory = {
        name: newCategoryName.trim(),
        color: selectedCategoryColor,
        type: categoryType
      };
      
      // Call the API to update the category
      await updateCategory(editingCategory.name, updatedCategory);
      
      // Update local state
      const updatedCategories = categories.map(c => 
        c.name === editingCategory.name ? { 
          ...updatedCategory,
          icon: c.icon // Preserve the existing icon
        } : c
      );
      
      setCategories(updatedCategories);
      
      // Reset form
      setNewCategoryName('');
      setSelectedCategoryColor('#FF5722');
      setShowCategoryModal(false);
      setIsEditing(false);
      setEditingCategory(null);
      
      showAlert('Success', 'Category updated successfully', 'success');
    } catch (error) {
      console.error('Error updating category:', error);
      const errorMessage = (error as any).response?.data?.error || 'Failed to update category';
      showAlert('Error', errorMessage, 'error');
    } finally {
      setLoading(false);
    }
  };

  const renderCategoryItem = ({ item }: { item: Category }) => (
    <View style={[
      styles.categoryItem, 
      { 
        backgroundColor: colors.cardBackground,
        borderColor: item.type === 'income' ? AppColors.primary : AppColors.danger,
        borderWidth: 1
      }
    ]}>
      <View style={[styles.categoryItemIcon, { backgroundColor: item.color }]}>
        <FontAwesome name="tag" size={16} color="#fff" />
      </View>
      <Text style={[styles.categoryName, { color: colors.text }]}>{item.name}</Text>
      <Text style={[
        styles.categoryType, 
        { 
          color: item.type === 'income' ? AppColors.primary : AppColors.danger 
        }
      ]}>
        {item.type === 'income' ? 'Income' : 'Expense'}
      </Text>
      <View style={styles.actionButtons}>
        <TouchableOpacity 
          style={styles.editButton}
          onPress={() => handleEditCategory(item)}
        >
          <FontAwesome name="pencil" size={16} color={AppColors.secondary} />
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.deleteButton}
          onPress={() => handleDeleteCategory(item.name)}
        >
          <FontAwesome name="trash" size={16} color={AppColors.danger} />
        </TouchableOpacity>
      </View>
    </View>
  );

  // Add this function to reset modal state
  const resetModal = () => {
    setNewCategoryName('');
    setSelectedCategoryColor('#FF5722');
    setIsEditing(false);
    setEditingCategory(null);
    setShowCategoryModal(false);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      
      <View style={styles.typeToggle}>
        <TouchableOpacity 
          style={[
            styles.typeButton, 
            { 
              backgroundColor: AppColors.danger,
              opacity: activeTab === 'expense' ? 1 : 0.6
            }
          ]}
          onPress={() => setActiveTab('expense')}
        >
          <Text style={styles.typeButtonText}>Expense Categories</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[
            styles.typeButton, 
            { 
              backgroundColor: AppColors.primary,
              opacity: activeTab === 'income' ? 1 : 0.6
            }
          ]}
          onPress={() => setActiveTab('income')}
        >
          <Text style={styles.typeButtonText}>Income Categories</Text>
        </TouchableOpacity>
      </View>
      
      {loading ? (
        <ActivityIndicator size="large" color={AppColors.primary} style={styles.loader} />
      ) : (
        <FlatList
          data={categories.filter(c => c.type === activeTab)}
          renderItem={renderCategoryItem}
          keyExtractor={item => item.name}
          contentContainerStyle={styles.list}
          numColumns={2}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <FontAwesome name="tags" size={50} color={colors.text} style={{opacity: 0.5}} />
              <Text style={[styles.emptyText, {color: colors.text}]}>
                No {activeTab} categories yet
              </Text>
              <TouchableOpacity 
                style={[styles.emptyButton, {backgroundColor: activeTab === 'income' ? AppColors.primary : AppColors.danger}]}
                onPress={() => {
                  setCategoryType(activeTab);
                  setShowCategoryModal(true);
                }}
              >
                <Text style={styles.emptyButtonText}>Add {activeTab} category</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}
      
      {/* Add Category Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={showCategoryModal}
        onRequestClose={() => setShowCategoryModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.cardBackground }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {isEditing ? 'Edit Category' : 'Add New Category'}
              </Text>
              <TouchableOpacity onPress={() => {
                setShowCategoryModal(false);
                // Reset editing state when modal is closed
                if (isEditing) {
                  setIsEditing(false);
                  setEditingCategory(null);
                }
              }}>
                <FontAwesome name="times" size={20} color={colors.text} />
              </TouchableOpacity>
            </View>
            
            <Text style={[styles.inputLabel, { color: colors.text }]}>Name</Text>
            <TextInput
              style={[styles.input, { 
                backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)',
                color: colors.text,
                borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'
              }]}
              placeholder="Category name"
              placeholderTextColor={isDarkMode ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)'}
              value={newCategoryName}
              onChangeText={setNewCategoryName}
            />
            
            <Text style={[styles.inputLabel, { color: colors.text, marginTop: 15 }]}>Category Type</Text>
            <View style={styles.typeToggleSmall}>
              <TouchableOpacity 
                style={[
                  styles.typeButtonSmall, 
                  { 
                    backgroundColor: categoryType === 'expense' ? AppColors.danger : 'transparent',
                    borderColor: AppColors.danger,
                  }
                ]}
                onPress={() => setCategoryType('expense')}
              >
                <Text 
                  style={[
                    styles.typeButtonTextSmall, 
                    { color: categoryType === 'expense' ? '#fff' : AppColors.danger }
                  ]}
                >
                  Expense
                </Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[
                  styles.typeButtonSmall, 
                  { 
                    backgroundColor: categoryType === 'income' ? AppColors.primary : 'transparent',
                    borderColor: AppColors.primary,
                  }
                ]}
                onPress={() => setCategoryType('income')}
              >
                <Text 
                  style={[
                    styles.typeButtonTextSmall, 
                    { color: categoryType === 'income' ? '#fff' : AppColors.primary }
                  ]}
                >
                  Income
                </Text>
              </TouchableOpacity>
            </View>
            
            <Text style={[styles.inputLabel, { color: colors.text, marginTop: 15 }]}>Color</Text>
            <View style={styles.colorGrid}>
              {CATEGORY_COLORS.map(color => (
                <TouchableOpacity 
                  key={color}
                  style={[
                    styles.colorOption,
                    {
                      backgroundColor: color,
                      borderWidth: selectedCategoryColor === color ? 2 : 0,
                      borderColor: isDarkMode ? '#fff' : '#000'
                    }
                  ]}
                  onPress={() => setSelectedCategoryColor(color)}
                />
              ))}
            </View>
            
            <View style={[styles.actions, { marginTop: 20 }]}>
              <TouchableOpacity 
                style={[styles.button, { 
                  backgroundColor: 'transparent',
                  borderWidth: 1,
                  borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'
                }]}
                onPress={() => setShowCategoryModal(false)}
              >
                <Text style={{ color: colors.text }}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[
                  styles.button, 
                  { backgroundColor: categoryType === 'income' ? AppColors.primary : AppColors.danger }
                ]}
                onPress={isEditing ? handleUpdateCategory : handleAddCategory}
              >
                <Text style={{ color: '#fff' }}>{isEditing ? 'Update Category' : 'Add Category'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingVertical: 10,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  addButton: {
    backgroundColor: AppColors.primary,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeToggle: {
    flexDirection: 'row',
    marginBottom: 15,
    borderRadius: 8,
    overflow: 'hidden',
  },
  typeButton: {
    flex: 1,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  typeToggleSmall: {
    flexDirection: 'row',
    marginBottom: 15,
    justifyContent: 'space-between',
  },
  typeButtonSmall: {
    width: '48%',
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    borderWidth: 1,
  },
  typeButtonTextSmall: {
    fontWeight: '500',
  },
  list: {
    paddingBottom: 20,
  },
  categoryItem: {
    width: '47%',
    margin: '1.5%',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  categoryItemIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  categoryName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 5,
    textAlign: 'center',
  },
  categoryType: {
    fontSize: 12,
    marginBottom: 10,
  },
  actionButtons: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'row',
  },
  editButton: {
    padding: 5,
    marginRight: 5,
  },
  deleteButton: {
    padding: 5,
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
    maxWidth: 400,
    borderRadius: 15,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  input: {
    padding: 15,
    borderRadius: 8,
    height: 50,
    borderWidth: 1,
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  colorOption: {
    width: '30%',
    height: 40,
    borderRadius: 5,
    marginBottom: 10,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  button: {
    width: '48%',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 50,
  },
  emptyText: {
    fontSize: 16,
    marginVertical: 15,
  },
  emptyButton: {
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 8,
  },
  emptyButtonText: {
    color: 'white',
    fontWeight: '500',
  }
});