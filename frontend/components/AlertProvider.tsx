import React, { createContext, useState, useContext, ReactNode } from 'react';
import { Alert, Platform, View, Text, StyleSheet, Animated } from 'react-native';

interface AlertContextType {
  showAlert: (title: string, message: string, type?: 'success' | 'error' | 'info') => void;
}

const AlertContext = createContext<AlertContextType>({
  showAlert: () => {},
});

export function useAlert() {
  return useContext(AlertContext);
}

type AlertProviderProps = {
  children: ReactNode;
};

export function AlertProvider({ children }: AlertProviderProps) {
  const [visible, setVisible] = useState(false);
  const [alertInfo, setAlertInfo] = useState({
    title: '',
    message: '',
    type: 'info' as 'success' | 'error' | 'info'
  });
  const opacity = useState(new Animated.Value(0))[0];
  
  const showAlert = (title: string, message: string, type: 'success' | 'error' | 'info' = 'info') => {
    if (Platform.OS === 'web') {
      // For web, use the browser's alert
      window.alert(`${title}\n${message}`);
    } else {
      // For native platforms, use custom alert
      setAlertInfo({ title, message, type });
      setVisible(true);
      
      // Animate in
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true
        }),
        Animated.delay(2500),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true
        })
      ]).start(() => {
        setVisible(false);
      });
    }
  };

  return (
    <AlertContext.Provider value={{ showAlert }}>
      {children}
      {visible && Platform.OS !== 'web' && (
        <Animated.View 
          style={[
            styles.alertContainer, 
            { opacity },
            alertInfo.type === 'success' ? styles.success : 
            alertInfo.type === 'error' ? styles.error : 
            styles.info
          ]}
        >
          <Text style={styles.alertTitle}>{alertInfo.title}</Text>
          <Text style={styles.alertMessage}>{alertInfo.message}</Text>
        </Animated.View>
      )}
    </AlertContext.Provider>
  );
}

const styles = StyleSheet.create({
  alertContainer: {
    position: 'absolute',
    top: 40,
    left: 20,
    right: 20,
    padding: 15,
    borderRadius: 10,
    zIndex: 1000,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.22,
    shadowRadius: 2.22
  },
  success: {
    backgroundColor: '#D4EDDA',
    borderColor: '#C3E6CB',
  },
  error: {
    backgroundColor: '#F8D7DA',
    borderColor: '#F5C6CB',
  },
  info: {
    backgroundColor: '#D1ECF1',
    borderColor: '#BEE5EB',
  },
  alertTitle: {
    fontWeight: '600',
    fontSize: 16,
    marginBottom: 5,
    color: '#212529',
  },
  alertMessage: {
    color: '#212529',
    fontSize: 14,
  }
});