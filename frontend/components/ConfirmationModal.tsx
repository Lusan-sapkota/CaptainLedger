import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  Platform
} from 'react-native';
import { useTheme } from '@/components/ThemeProvider';
import { AppColors } from '../app/(tabs)/_layout';

interface ConfirmationModalProps {
  visible: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
}

export default function ConfirmationModal({
  visible,
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  destructive = false
}: ConfirmationModalProps) {
  const { isDarkMode, colors } = useTheme();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={styles.overlay}>
        <View style={[
          styles.modalContainer,
          { 
            backgroundColor: colors.background,
            borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'
          }
        ]}>
          <Text style={[styles.title, { color: colors.text }]}>
            {title}
          </Text>
          
          <ScrollView style={styles.messageContainer}>
            <Text style={[styles.message, { color: colors.subText }]}>
              {message}
            </Text>
          </ScrollView>
          
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[
                styles.button,
                styles.cancelButton,
                { 
                  backgroundColor: isDarkMode ? 'rgba(255,255,255,0.1)' : '#F5F5F5',
                  borderColor: isDarkMode ? 'rgba(255,255,255,0.2)' : '#E0E0E0'
                }
              ]}
              onPress={onCancel}
            >
              <Text style={[
                styles.buttonText,
                { color: isDarkMode ? colors.text : '#666' }
              ]}>
                {cancelText}
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.button,
                styles.confirmButton,
                { backgroundColor: destructive ? AppColors.danger : AppColors.primary }
              ]}
              onPress={onConfirm}
            >
              <Text style={[styles.buttonText, { color: 'white' }]}>
                {confirmText}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    ...Platform.select({
      web: {
        boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 8,
      },
    }),
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 15,
  },
  messageContainer: {
    maxHeight: 200,
    marginBottom: 20,
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'left',
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  cancelButton: {
    // Styles applied via inline styles above
  },
  confirmButton: {
    borderWidth: 0,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '500',
  },
});
