import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  Modal,
  ActivityIndicator,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import FontAwesome from '@expo/vector-icons/FontAwesome';

// Import services
import { getCategoriesApi, addCategory, deleteCategory } from '@/services/api';
import { useAlert } from '@/components/AlertProvider';
import { useTheme } from '@/components/ThemeProvider';
import { AppColors } from '@/app/(tabs)/_layout';

type Category = {
  id?: string;
  name: string;
  color: string;
  icon: string;
};

export default function CategoryManager() {
  const { isDarkMode, colors } = useTheme();
  const { showAlert } = useAlert();
  
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [selectedCategoryColor, setSelectedCategoryColor] = useState('#FF5722');
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
        setCategories(response.data.categories.map((cat: any) => ({
          id: cat.id,
          name: cat.name,
          color: cat.color,
          icon: cat.icon ?? 'ellipsis-horizontal'
        })));
      }
    } catch (error) {
      console.error('Error loading categories:', error);
      showAlert('Error', 'Failed to load categories', 'error');
    } finally {
      setLoading(false);
    }
  };
  
  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) {
      showAlert('Error', 'Category name is required', 'error');
      return;
    }
    
    setLoading(true);
    try {
      await addCategory({
        name: newCategoryName.trim(),
        color: selectedCategoryColor
      });
      showAlert('Success', 'Category added successfully', 'success');
      await loadCategories();
      resetForm();
    } catch (error: any) {
      console.error('Error adding category:', error);
      const errorMessage = error.response?.data?.error || 'Failed to add category';
      showAlert('Error', errorMessage, 'error');
    } finally {
      setLoading(false);
    }
  };
  
  const handleDeleteCategory = (category: Category) => {
    Alert.alert(
      'Delete Category',
      `Are you sure you want to delete "${category.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              await deleteCategory(category.name);
              showAlert('Success', 'Category deleted successfully', 'success');
              await loadCategories();
            } catch (error) {
              console.error('Error deleting category:', error);
              showAlert('Error', 'Failed to delete category', 'error');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };
  
  const openEditModal = (category: Category) => {
    setEditingCategory(category);
    setNewCategoryName(category.name);
    setSelectedCategoryColor(category.color);
    setShowModal(true);
  };
  
  const resetForm = () => {
    setNewCategoryName('');
    setSelectedCategoryColor('#FF5722');
    setEditingCategory(null);
    setShowModal(false);
  };
  
  const renderCategoryItem = ({ item }: { item: Category }) => (
    <View style={[
      styles.categoryItem, 
      { backgroundColor: colors.cardBackground }
    ]}>
      <View style={[styles.categoryColorIndicator, { backgroundColor: item.color }]} />
      <Text style={[styles.categoryName, { color: colors.text }]}>{item.name}</Text>
      
      <View style={styles.categoryActions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => openEditModal(item)}
        >
          <FontAwesome name="pencil" size={18} color={AppColors.primary} />
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.actionButton, { marginLeft: 15 }]}
          onPress={() => handleDeleteCategory(item)}
        >
          <FontAwesome name="trash-o" size={18} color={AppColors.danger} />
        </TouchableOpacity>
      </View>
    </View>
  );
  
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Categories</Text>
        
        <TouchableOpacity 
          style={styles.addButton}
          onPress={() => setShowModal(true)}
        >
          <Text style={{ color: AppColors.primary }}>Add Category</Text>
          <FontAwesome name="plus" size={16} color={AppColors.primary} style={{ marginLeft: 5 }} />
        </TouchableOpacity>
      </View>
      
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={AppColors.primary} />
        </View>
      ) : (
        <FlatList
          data={categories}
          keyExtractor={(item) => item.id || item.name}
          renderItem={renderCategoryItem}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={[styles.emptyText, { color: colors.text }]}>
                No custom categories yet
              </Text>
            </View>
          }
        />
      )}
      
      {/* Add/Edit Category Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={showModal}
        onRequestClose={resetForm}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.cardBackground }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {editingCategory ? 'Edit Category' : 'Add Category'}
              </Text>
              <TouchableOpacity onPress={resetForm}>
                <FontAwesome name="times" size={20} color={colors.text} />
              </TouchableOpacity>
            </View>
            
            <Text style={[styles.inputLabel, { color: colors.text }]}>Name</Text>
            <TextInput
              style={[styles.input, { 
                backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)',
                borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                color: colors.text
              }]}
              placeholder="Category name"
              placeholderTextColor={isDarkMode ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)'}
              value={newCategoryName}
              onChangeText={setNewCategoryName}
            />
            
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
            
            <View style={styles.actions}>
              <TouchableOpacity 
                style={[styles.cancelButton, { 
                  borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'
                }]}
                onPress={resetForm}
              >
                <Text style={{ color: colors.text }}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.saveButton, { backgroundColor: AppColors.primary }]}
                onPress={handleAddCategory}
              >
                <Text style={{ color: '#fff', fontWeight: '600' }}>
                  {editingCategory ? 'Update' : 'Add'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
  },
  list: {
    paddingBottom: 20,
  },
  categoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    marginBottom: 10,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  categoryColorIndicator: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginRight: 12,
  },
  categoryName: {
    flex: 1,
    fontSize: 16,
  },
  categoryActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    padding: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  emptyText: {
    fontSize: 16,
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
    maxWidth: 400,
    borderRadius: 15,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
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
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  input: {
    padding: 15,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 15,
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  colorOption: {
    width: '18%',
    aspectRatio: 1,
    borderRadius: 8,
    marginBottom: 10,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cancelButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    marginRight: 10,
  },
  saveButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
});