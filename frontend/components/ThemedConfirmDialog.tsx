import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { AppColors } from '@/app/(tabs)/_layout';

interface ThemedConfirmDialogProps {
  visible: boolean;
  title: string;
  message: React.ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
  confirmButtonColor?: string;
  cancelButtonColor?: string;
  confirmButtonText?: string;
  cancelButtonText?: string;
  actionType?: 'positive' | 'negative' | 'neutral' | 'warning';
  isDarkMode: boolean;
  colors: any;
}

const ThemedConfirmDialog: React.FC<ThemedConfirmDialogProps> = ({
  visible,
  title,
  message,
  onConfirm,
  onCancel,
  confirmButtonColor,
  cancelButtonColor,
  confirmButtonText = 'Confirm',
  cancelButtonText = 'Cancel',
  actionType = 'neutral',
  isDarkMode,
  colors,
}) => {
  // Determine the button color based on action type if not explicitly set
  const getConfirmButtonColor = () => {
    if (confirmButtonColor) return confirmButtonColor;
    
    switch (actionType) {
      case 'positive':
        return AppColors.primary; // Green for positive actions like save
      case 'negative':
        return '#DC3545'; // Red for dangerous actions like logout
      case 'warning':
        return '#FFC107'; // Yellow for warning actions
      case 'neutral':
      default:
        return AppColors.secondary; // Blue for neutral actions
    }
  };
  
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
    >
      <View style={styles.overlay}>
        <View style={[styles.dialogContainer, { 
          backgroundColor: colors.cardBackground,
        }]}>
          <View style={[styles.titleContainer, {
            borderBottomColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'
          }]}>
            <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
          </View>
          
          <View style={styles.messageContainer}>
            {typeof message === 'string' ? (
              <Text style={[styles.message, { color: colors.text }]}>{message}</Text>
            ) : (
              message
            )}
          </View>
          
          <View style={[styles.buttonsContainer, {
            borderTopColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'
          }]}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton, { 
                backgroundColor: cancelButtonColor || (isDarkMode ? '#444' : '#e0e0e0'),
                borderRightColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'
              }]}
              onPress={onCancel}
            >
              <Text style={[styles.buttonText, { color: isDarkMode ? '#fff' : '#000' }]}>
                {cancelButtonText}
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.button, styles.confirmButton, { backgroundColor: getConfirmButtonColor() }]}
              onPress={onConfirm}
            >
              <Text style={[styles.buttonText, { color: '#fff' }]}>
                {confirmButtonText}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dialogContainer: {
    width: '80%',
    borderRadius: 8,
    overflow: 'hidden',
  },
  titleContainer: {
    padding: 16,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  messageContainer: {
    padding: 16,
    paddingTop: 8,
  },
  message: {
    fontSize: 16,
    lineHeight: 22,
  },
  buttonsContainer: {
    flexDirection: 'row',
    borderTopWidth: 1,
  },
  button: {
    flex: 1,
    padding: 16,
    alignItems: 'center',
  },
  cancelButton: {
    borderRightWidth: 1,
  },
  confirmButton: {},
  buttonText: {
    fontSize: 16,
    fontWeight: '500',
  },
});

export default ThemedConfirmDialog;