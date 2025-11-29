import React from 'react';
import { View, Text } from 'react-native';

export function VerifyEmail() {
  return (
    <View className="flex-1 bg-slate-950 justify-center items-center px-5">
      <Text className="text-2xl font-bold text-white mb-4">Verify Email</Text>
      <Text className="text-slate-400 text-base">Email verification screen</Text>
    </View>
  );
}
