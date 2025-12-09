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
import { Login } from './src/pages/Login';
import { Register } from './src/pages/Register';
import { Dashboard } from './src/pages/Dashboard';
import { Settings } from './src/pages/Settings';
import { AdminHome } from './src/pages/admin/AdminHome';
import { AdminBetBuilder } from './src/pages/admin/AdminBetBuilder';
import { VerifyEmail } from './src/pages/VerifyEmail';
import { VerifyMagicLink } from './src/pages/VerifyMagicLink';
import { ForgotPassword } from './src/pages/ForgotPassword';
import { ResetPassword } from './src/pages/ResetPassword';
import { LoadingScreen } from './src/components/common/LoadingScreen';
import { ParlayBuilder } from './src/components/parlay/ParlayBuilder';

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

export default function App() {
  return (
    <SafeAreaProvider>
      <ToastProvider>
        <AuthProvider>
          <ParlayProvider>
            <BetsProvider>
              <StatusBar style="light" />
              <RootNavigator />
              <ParlayBuilder />
            </BetsProvider>
          </ParlayProvider>
        </AuthProvider>
      </ToastProvider>
    </SafeAreaProvider>
  );
}

