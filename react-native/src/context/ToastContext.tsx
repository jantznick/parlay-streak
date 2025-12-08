import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { View, Text, Animated, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';

type ToastType = 'success' | 'error' | 'info';

interface ToastContextData {
  showToast: (message: string, type?: ToastType, duration?: number) => void;
  hideToast: () => void;
}

const ToastContext = createContext<ToastContextData | undefined>(undefined);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

interface ToastProviderProps {
  children: React.ReactNode;
}

export function ToastProvider({ children }: ToastProviderProps) {
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState('');
  const [type, setType] = useState<ToastType>('success');
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const timeoutRef = useRef<NodeJS.Timeout>();

  const showToast = useCallback((msg: string, toastType: ToastType = 'success', duration = 3000) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    setMessage(msg);
    setType(toastType);
    setVisible(true);

    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();

    timeoutRef.current = setTimeout(() => {
      hideToast();
    }, duration);
  }, [fadeAnim]);

  const hideToast = useCallback(() => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setVisible(false);
    });
  }, [fadeAnim]);

  const getBackgroundColor = () => {
    switch (type) {
      case 'success': return 'bg-emerald-600';
      case 'error': return 'bg-red-600';
      case 'info': return 'bg-blue-600';
      default: return 'bg-slate-800';
    }
  };

  const getIconName = () => {
    switch (type) {
      case 'success': return 'checkmark-circle';
      case 'error': return 'alert-circle';
      case 'info': return 'information-circle';
      default: return 'notifications';
    }
  };

  return (
    <ToastContext.Provider value={{ showToast, hideToast }}>
      {children}
      {visible && (
        <SafeAreaInsetsContext.Consumer>
          {(insets) => (
            <Animated.View
              style={{
                opacity: fadeAnim,
                transform: [
                  {
                    translateY: fadeAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-20, 0],
                    }),
                  },
                ],
                position: 'absolute',
                top: (insets?.top || 0) + 16,
                left: 16,
                right: 16,
                zIndex: 9999,
              }}
            >
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={hideToast}
                className={`${getBackgroundColor()} flex-row items-center px-4 py-4 rounded-[20px] shadow-lg shadow-black/30`}
              >
                <Ionicons name={getIconName()} size={24} color="white" />
                <Text className="flex-1 text-white font-medium ml-3 text-sm">
                  {message}
                </Text>
              </TouchableOpacity>
            </Animated.View>
          )}
        </SafeAreaInsetsContext.Consumer>
      )}
    </ToastContext.Provider>
  );
}

