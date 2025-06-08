import React, { useState, useRef, useEffect } from 'react';
import { StyleSheet, View, FlatList, Dimensions, TouchableOpacity, Image, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Text } from '@/components/Themed';
import { useRouter } from 'expo-router';
import { AppColors } from './(tabs)/_layout';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { StatusBar } from 'expo-status-bar';

const { width, height } = Dimensions.get('window');

const slides = [
  {
    id: '1',
    title: 'Welcome to CaptainLedger',
    description: 'Your complete personal finance tracker that works both online and offline.',
    image: require('@/assets/images/icon.png'),
    iconName: 'ship'
  },
  {
    id: '2',
    title: 'Track Transactions',
    description: 'Easily record and categorize your income and expenses.',
    image: require('@/assets/images/icon.png'),
    iconName: 'money'
  },
  {
    id: '3',
    title: 'Works Offline',
    description: 'Use the app without internet. Your data syncs when you\'re back online.',
    image: require('@/assets/images/icon.png'),
    iconName: 'cloud-download'
  },
  {
    id: '4',
    title: 'Privacy First',
    description: 'Your data stays on your device. Optionally sync with your own server.',
    image: require('@/assets/images/icon.png'),
    iconName: 'lock'
  }
];

export default function OnboardingScreen() {
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const router = useRouter();
  const [isInitialized, setIsInitialized] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);

  // On component mount, set flag to prevent redirect loop
  useEffect(() => {
    const initializeOnboarding = async () => {
      try {
        console.log('Onboarding screen mounted');
        // Set completed_onboarding to false explicitly to prevent loops
        await AsyncStorage.removeItem('completed_onboarding');
        // Set in-progress flag
        await AsyncStorage.setItem('onboarding_in_progress', 'true');
        
        // For Android, we'll do a pre-check to make sure our flags are set
        if (Platform.OS === 'android') {
          // Verify our flags were set correctly
          const inProgress = await AsyncStorage.getItem('onboarding_in_progress');
          console.log('Verified onboarding_in_progress set to:', inProgress);
        }
        
        setIsInitialized(true);
      } catch (err) {
        console.error('Failed to initialize onboarding:', err);
        // Force initialization to prevent permanent loading screen
        setIsInitialized(true);
      }
    };

    initializeOnboarding();
    
    return () => {
      console.log('Onboarding screen unmounting');
    };
  }, []);
  
  const handleNext = () => {
    if (currentSlideIndex < slides.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentSlideIndex + 1 });
      setCurrentSlideIndex(currentSlideIndex + 1);
    } else {
      handleDone();
    }
  };
  
  const handleSkip = () => {
    flatListRef.current?.scrollToIndex({ index: slides.length - 1 });
    setCurrentSlideIndex(slides.length - 1);
  };
  
  const handleDone = async () => {
    if (isNavigating) return;
    setIsNavigating(true);
    
    try {
      console.log('Saving onboarding completed status...');
      
      // For Android, use a different approach to ensure flags are set
      if (Platform.OS === 'android') {
        // First remove in-progress flag
        await AsyncStorage.removeItem('onboarding_in_progress');
        // Wait a moment to ensure the operation completes
        await new Promise(resolve => setTimeout(resolve, 100));
        // Then set completed flag
        await AsyncStorage.setItem('completed_onboarding', 'true');
        // Verify it was set
        const completed = await AsyncStorage.getItem('completed_onboarding');
        console.log('Verified completed_onboarding set to:', completed);
      } else {
        await AsyncStorage.setItem('completed_onboarding', 'true');
        await AsyncStorage.removeItem('onboarding_in_progress');
      }
      
      console.log('Navigating to auth screen...');
      
      // Use setTimeout to ensure navigation happens after state updates
      setTimeout(() => {
        router.replace('/auth');
      }, 100);
    } catch (err) {
      console.error('Error saving onboarding state:', err);
      
      // Force navigation even if there was an error
      setTimeout(() => {
        router.replace('/auth');
      }, 100);
    }
  };

  // Only render content when initialized to prevent flash
  if (!isInitialized) {
    return (
      <View style={styles.container}>
        <StatusBar style="light" />
        <View style={{flex: 1, justifyContent: 'center', alignItems: 'center'}}>
          <Text style={{color: 'white', fontSize: 18}}>Loading...</Text>
        </View>
      </View>
    );
  }
  
  const renderSlide = ({ item }: { item: (typeof slides)[0] }) => {
    return (
      <View style={styles.slide}>
        <View style={styles.imageContainer}>
          <View style={styles.iconCircle}>
            <FontAwesome name={item.iconName as any} size={60} color={AppColors.white} />
          </View>
        </View>
        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.description}>{item.description}</Text>
      </View>
    );
  };
  
  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      
      <FlatList
        ref={flatListRef}
        data={slides}
        renderItem={renderSlide}
        horizontal
        showsHorizontalScrollIndicator={false}
        pagingEnabled
        bounces={false}
        keyExtractor={item => item.id}
        onMomentumScrollEnd={(event) => {
          const index = Math.round(event.nativeEvent.contentOffset.x / width);
          setCurrentSlideIndex(index);
        }}
      />
      
      <View style={styles.footer}>
        <View style={styles.indicators}>
          {slides.map((_, i) => (
            <View
              key={i}
              style={[
                styles.indicator,
                i === currentSlideIndex && styles.activeIndicator
              ]}
            />
          ))}
        </View>
        
        <View style={styles.buttonsContainer}>
          {currentSlideIndex < slides.length - 1 ? (
            <>
              <TouchableOpacity style={[styles.button, styles.skipButton]} onPress={handleSkip}>
                <Text style={styles.skipButtonText}>Skip</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={[styles.button, styles.nextButton]} onPress={handleNext}>
                <Text style={styles.nextButtonText}>Next</Text>
                <FontAwesome name="arrow-right" size={16} color="white" style={styles.buttonIcon} />
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity style={[styles.button, styles.getStartedButton]} onPress={handleDone}>
              <Text style={styles.getStartedText}>Get Started</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppColors.secondary,
  },
  slide: {
    width,
    alignItems: 'center',
    padding: 40,
    paddingTop: 100,
  },
  imageContainer: {
    marginBottom: 40,
  },
  iconCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: AppColors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
    marginBottom: 20,
  },
  description: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'transparent',
    paddingVertical: 50,
    paddingHorizontal: 20,
  },
  indicators: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 30,
  },
  indicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    marginHorizontal: 5,
  },
  activeIndicator: {
    backgroundColor: 'white',
    width: 20,
  },
  buttonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  button: {
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  skipButton: {
    paddingHorizontal: 20,
  },
  skipButtonText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 16,
  },
  nextButton: {
    backgroundColor: AppColors.primary,
    paddingHorizontal: 30,
    flexDirection: 'row',
  },
  nextButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
    marginRight: 10,
  },
  getStartedButton: {
    backgroundColor: AppColors.primary,
    paddingHorizontal: 50,
    flex: 1,
  },
  getStartedText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  buttonIcon: {
    marginLeft: 5,
  },
});
