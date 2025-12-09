import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { Platform } from 'react-native';

import { Dashboard } from '../pages/Dashboard';
import { Settings } from '../pages/Settings';
import { AdminHome } from '../pages/admin/AdminHome';
import { AdminBetBuilder } from '../pages/admin/AdminBetBuilder';
import { useTheme } from '../context/ThemeContext';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function AdminStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="AdminHomeMain" component={AdminHome} />
      <Stack.Screen name="AdminBetBuilder" component={AdminBetBuilder} />
    </Stack.Navigator>
  );
}

export function TabNavigator() {
  // const { effectiveTheme } = useTheme();
  // const isDark = effectiveTheme === 'dark';

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#0f172a', // slate-900 
          borderTopColor: '#1e293b', // slate-800
          height: Platform.OS === 'ios' ? 88 : 60,
          paddingBottom: Platform.OS === 'ios' ? 28 : 8,
          paddingTop: 8,
        },
        tabBarActiveTintColor: '#ea580c', // orange-600
        tabBarInactiveTintColor: '#94a3b8', // slate-400
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: any;

          if (route.name === 'Home') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Profile') {
            iconName = focused ? 'person' : 'person-outline';
          } else if (route.name === 'Admin') {
            iconName = focused ? 'shield' : 'shield-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Home" component={Dashboard} />
      {/* We can conditionally render Admin tab or keep it hidden/nested */}
      <Tab.Screen name="Profile" component={Settings} />
    </Tab.Navigator>
  );
}

