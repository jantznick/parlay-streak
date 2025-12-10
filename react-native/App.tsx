import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import * as Linking from 'expo-linking';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import './global.css';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { ParlayProvider } from './src/context/ParlayContext';
import { BetsProvider } from './src/context/BetsContext';
import { ToastProvider } from './src/context/ToastContext';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { Login } from './src/pages/Login';
import { Register } from './src/pages/Register';
import { Dashboard } from './src/pages/Dashboard';
import { AdminHome } from './src/pages/admin/AdminHome';
import { AdminBetBuilder } from './src/pages/admin/AdminBetBuilder';
import { VerifyEmail } from './src/pages/VerifyEmail';
import { VerifyMagicLink } from './src/pages/VerifyMagicLink';
import { ForgotPassword } from './src/pages/ForgotPassword';
import { ResetPassword } from './src/pages/ResetPassword';
import { LoadingScreen } from './src/components/common/LoadingScreen';
import { ParlayBuilder } from './src/components/parlay/ParlayBuilder';
import mobileAds from 'react-native-google-mobile-ads';

const Stack = createNativeStackNavigator();

function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={Login} />
      <Stack.Screen name="Register" component={Register} />
      <Stack.Screen name="VerifyEmail" component={VerifyEmail} />
      <Stack.Screen name="VerifyMagicLink" component={VerifyMagicLink} />
      <Stack.Screen name="ForgotPassword" component={ForgotPassword} />
      <Stack.Screen name="ResetPassword" component={ResetPassword} />
    </Stack.Navigator>
  );
}

import { TabNavigator } from './src/navigation/TabNavigator';

function AppStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MainTabs" component={TabNavigator} />
      <Stack.Screen name="AdminHome" component={AdminHome} />
      <Stack.Screen name="AdminBetBuilder" component={AdminBetBuilder} />
    </Stack.Navigator>
  );
}

function RootNavigator() {
  const { user, loading } = useAuth();

  useEffect(() => {
    mobileAds()
      .initialize()
      .then(adapterStatuses => {
        // Initialization complete
        console.log('Mobile ads initialized');
      });
  }, []);

  if (loading) {
    return <LoadingScreen />;
  }

  const linking = {
    prefixes: ['parlaystreak://', 'https://parlaystreak.com'],
    config: {
      screens: {
        AuthStack: {
          screens: {
            VerifyMagicLink: {
              path: 'auth/verify',
              parse: {
                token: (token: string) => token,
              },
            },
          },
        },
      },
    },
  };

  return (
    <NavigationContainer linking={linking}>
      {user ? <AppStack /> : <AuthStack />}
    </NavigationContainer>
  );
}

function ThemedApp() {
  const { effectiveTheme } = useTheme();
  return (
    <>
      <StatusBar style={effectiveTheme === 'dark' ? 'light' : 'dark'} />
      <RootNavigator />
      <ParlayBuilder />
    </>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <ToastProvider>
    <AuthProvider>
      <ParlayProvider>
        <BetsProvider>
                <ThemedApp />
        </BetsProvider>
      </ParlayProvider>
    </AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

