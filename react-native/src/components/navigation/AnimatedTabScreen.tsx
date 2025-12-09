import React, { useEffect, useRef } from 'react';
import { Animated, Dimensions } from 'react-native';
import { useTheme } from '../../context/ThemeContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface AnimatedTabScreenProps {
  children: React.ReactNode;
  isFocused: boolean;
  direction: 'left' | 'right';
}

export function AnimatedTabScreen({ children, isFocused, direction }: AnimatedTabScreenProps) {
  const { effectiveTheme } = useTheme();
  const isDark = effectiveTheme === 'dark';
  
  const slideAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isFocused) {
      // Set background immediately, then animate
      const startPosition = direction === 'left' ? -SCREEN_WIDTH : SCREEN_WIDTH;
      slideAnim.setValue(startPosition);
      opacityAnim.setValue(0);
      
      // Small delay to ensure background is set before animation
      setTimeout(() => {
        Animated.parallel([
          Animated.spring(slideAnim, {
            toValue: 0,
            useNativeDriver: true,
            tension: 65,
            friction: 11,
          }),
          Animated.timing(opacityAnim, {
            toValue: 1,
            duration: 250,
            useNativeDriver: true,
          }),
        ]).start();
      }, 10);
    } else {
      // Slide out in the opposite direction
      const exitDirection = direction === 'left' ? SCREEN_WIDTH : -SCREEN_WIDTH;
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: exitDirection,
          useNativeDriver: true,
          tension: 65,
          friction: 11,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isFocused, direction, slideAnim, opacityAnim]);

  const backgroundColor = isDark ? '#020617' : '#f8fafc'; // slate-950 vs slate-50

  return (
    <Animated.View
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: backgroundColor,
        transform: [{ translateX: slideAnim }],
        opacity: opacityAnim,
      }}
    >
      {children}
    </Animated.View>
  );
}

