import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useColorScheme as useNativeWindColorScheme } from 'nativewind';
import { useColorScheme as useSystemColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

type Theme = 'light' | 'dark' | 'system';
type EffectiveTheme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  effectiveTheme: EffectiveTheme;
  setTheme: (theme: Theme) => Promise<void>;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = 'theme';

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemAppearanceScheme = useSystemColorScheme();
  const { setColorScheme: setNativeWindColorScheme } = useNativeWindColorScheme();

  // 'theme' is the user's preference (can be 'system')
  const [theme, setThemeState] = useState<Theme>('system');
  // 'effectiveTheme' is what is actually rendered (light or dark)
  const [effectiveTheme, setEffectiveTheme] = useState<EffectiveTheme>(systemAppearanceScheme || 'light');

  useEffect(() => {
    const loadTheme = async () => {
      try {
        const savedTheme = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (savedTheme && (savedTheme === 'light' || savedTheme === 'dark' || savedTheme === 'system')) {
          setThemeState(savedTheme as Theme);
        }
      } catch (error) {
        console.error('Failed to load theme from storage', error);
      }
    };
    loadTheme();
  }, []);

  useEffect(() => {
    let currentEffectiveTheme: EffectiveTheme;
    
    if (theme === 'system') {
      currentEffectiveTheme = systemAppearanceScheme || 'light';
    } else {
      currentEffectiveTheme = theme;
    }
    
    setEffectiveTheme(currentEffectiveTheme);
    // Sync NativeWind so Tailwind classes work
    setNativeWindColorScheme(currentEffectiveTheme);
    
  }, [theme, systemAppearanceScheme, setNativeWindColorScheme]);

  const handleSetTheme = async (newTheme: Theme) => {
    setThemeState(newTheme);
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, newTheme);
    } catch (error) {
      console.error('Failed to save theme to storage', error);
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, effectiveTheme, setTheme: handleSetTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

