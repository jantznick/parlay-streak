import React, { useEffect, useRef } from 'react';
import { View, TouchableOpacity, Animated, Platform, Dimensions } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const TAB_BAR_HEIGHT = 64;
const PILL_HEIGHT = 48;
const PILL_WIDTH = 140;
const TAB_COUNT = 2; // Home and Profile
const CONTAINER_PADDING = 40; // left: 20 + right: 20
const INNER_PADDING = 16; // paddingHorizontal: 8 * 2
const AVAILABLE_WIDTH = SCREEN_WIDTH - CONTAINER_PADDING - INNER_PADDING;
const TAB_WIDTH = AVAILABLE_WIDTH / TAB_COUNT;

export function FloatingTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { effectiveTheme } = useTheme();
  const isDark = effectiveTheme === 'dark';
  const insets = useSafeAreaInsets();
  
  // Get the current route index
  const currentIndex = state.index;
  
  // Calculate initial position based on current index
  const initialPosition = currentIndex * TAB_WIDTH + (TAB_WIDTH - PILL_WIDTH) / 2;
  
  // Animated value for the pill position
  const pillPosition = useRef(new Animated.Value(initialPosition)).current;

  // Animate pill position when route changes
  useEffect(() => {
    const targetPosition = currentIndex * TAB_WIDTH + (TAB_WIDTH - PILL_WIDTH) / 2;
    Animated.spring(pillPosition, {
      toValue: targetPosition,
      useNativeDriver: true,
      tension: 65,
      friction: 11,
    }).start();
  }, [currentIndex, pillPosition]);

  return (
    <View
      style={{
        position: 'absolute',
        bottom: insets.bottom + 16,
        left: 20,
        right: 20,
        height: TAB_BAR_HEIGHT,
        flexDirection: 'row',
        backgroundColor: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
        borderRadius: 32,
        paddingHorizontal: 8,
        paddingVertical: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: isDark ? 0.4 : 0.15,
        shadowRadius: 16,
        elevation: 20,
        borderWidth: 1,
        borderColor: isDark ? 'rgba(30, 41, 59, 0.5)' : 'rgba(226, 232, 240, 0.5)',
      }}
    >
      {/* Animated pill indicator */}
      <Animated.View
        style={{
          position: 'absolute',
          left: 8,
          top: 8,
          width: PILL_WIDTH,
          height: PILL_HEIGHT,
          backgroundColor: isDark ? '#1e293b' : '#090088', // slate-800 vs dark blue
          borderRadius: 24,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: isDark ? 0.3 : 0.15,
          shadowRadius: 8,
          elevation: 8,
          transform: [{ translateX: pillPosition }],
        }}
      />

      {/* Tab buttons */}
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const isFocused = state.index === index;

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });

          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        const onLongPress = () => {
          navigation.emit({
            type: 'tabLongPress',
            target: route.key,
          });
        };

        let iconName: any;
        if (route.name === 'Home') {
          iconName = isFocused ? 'home' : 'home-outline';
        } else if (route.name === 'Profile') {
          iconName = isFocused ? 'person' : 'person-outline';
        }

        const iconColor = isFocused
          ? (isDark ? '#ea580c' : '#ffffff') // orange-600 in dark, white in light (for dark blue background)
          : isDark
          ? '#94a3b8' // slate-400
          : '#64748b'; // slate-500

        return (
          <TouchableOpacity
            key={route.key}
            accessibilityRole="button"
            accessibilityState={isFocused ? { selected: true } : {}}
            accessibilityLabel={options.tabBarAccessibilityLabel}
            testID={options.tabBarTestID}
            onPress={onPress}
            onLongPress={onLongPress}
            style={{
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
              height: PILL_HEIGHT,
              zIndex: 1,
            }}
          >
            <Ionicons name={iconName} size={24} color={iconColor} />
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

