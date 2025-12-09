import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { Dashboard } from '../pages/Dashboard';
import { Settings } from '../pages/Settings';
import { AdminHome } from '../pages/admin/AdminHome';
import { AdminBetBuilder } from '../pages/admin/AdminBetBuilder';
import { FloatingTabBar } from '../components/navigation/FloatingTabBar';

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
  return (
    <Tab.Navigator
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tab.Screen name="Home" component={Dashboard} />
      <Tab.Screen name="Profile" component={Settings} />
    </Tab.Navigator>
  );
}

