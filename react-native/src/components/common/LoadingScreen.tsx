import React from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import type { LoadingScreenProps } from '../../interfaces';

export function LoadingScreen({ message = 'Loading...' }: LoadingScreenProps) {
  return (
    <View className="flex-1 bg-slate-950 items-center justify-center">
      <Text className="text-5xl mb-4">🎮</Text>
      <ActivityIndicator size="large" color="#64748b" className="mb-4" />
      <Text className="text-slate-400 text-base">{message}</Text>
    </View>
  );
}

