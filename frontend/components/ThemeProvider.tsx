import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme } from './useColorScheme';

type ThemeContextType = {
  isDarkMode: boolean;
  colors: {
    background: string;
    cardBackground: string;
    text: string;
    subText: string;
    border: string;
    buttonText: string;
    primary: string;
    inputBackground: string; // Added this property
  };
  toggleTheme: (value?: boolean) => void;
};

const lightColors = {
  background: '#ECF0F1',
  cardBackground: '#FFFFFF',
  text: '#2C3E50',
  subText: '#7F8C8D',
  border: 'rgba(0,0,0,0.1)',
  buttonText: '#FFFFFF',
  primary: '#27AE60',
  inputBackground: '#F5F5F5', // Added light input background
};

const darkColors = {
  background: '#121212',
  cardBackground: '#1E1E1E', 
  text: '#FFFFFF',
  subText: '#AAAAAA',
  border: 'rgba(255,255,255,0.1)',
  buttonText: '#FFFFFF',
  primary: '#27AE60',
  inputBackground: '#2A2A2A', // Added dark input background
};

const ThemeContext = createContext<ThemeContextType>({
  isDarkMode: false,
  colors: lightColors,
  toggleTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemColorScheme = useColorScheme();
  const [isDarkMode, setIsDarkMode] = useState(systemColorScheme === 'dark');

  useEffect(() => {
    // Load saved theme preference
    const loadTheme = async () => {
      try {
        const savedTheme = await AsyncStorage.getItem('isDarkMode');
        if (savedTheme !== null) {
          setIsDarkMode(JSON.parse(savedTheme));
        } else {
          setIsDarkMode(systemColorScheme === 'dark');
        }
      } catch (e) {
        console.error('Error loading theme preference:', e);
      }
    };

    loadTheme();
  }, [systemColorScheme]);

  const toggleTheme = (value?: boolean) => {
    setIsDarkMode(prev => {
      const newValue = value !== undefined ? value : !prev;
      AsyncStorage.setItem('isDarkMode', JSON.stringify(newValue));
      return newValue;
    });
  };

  const colors = isDarkMode ? darkColors : lightColors;

  return (
    <ThemeContext.Provider value={{ isDarkMode, colors, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);