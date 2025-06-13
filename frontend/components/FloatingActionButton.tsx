import React from 'react';
import { TouchableOpacity, StyleSheet, Animated } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { AppColors } from '@/app/(tabs)/_layout';

interface FloatingActionButtonProps {
  onPress: () => void;
  icon?: string;
  backgroundColor?: string;
  size?: number;
  bottom?: number;
  right?: number;
}

export default function FloatingActionButton({
  onPress,
  icon = 'plus',
  backgroundColor = AppColors.primary,
  size = 56,
  bottom = 20,
  right = 20
}: FloatingActionButtonProps) {
  return (
    <TouchableOpacity
      style={[
        styles.fab,
        {
          backgroundColor,
          width: size,
          height: size,
          borderRadius: size / 2,
          bottom,
          right,
        }
      ]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <FontAwesome name={icon as any} size={size * 0.4} color="white" />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    zIndex: 1000,
  },
});
