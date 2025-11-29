import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { api } from '../services/api';

export function ResetPassword() {
  const navigation = useNavigation();
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!token || !password || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      await api.resetPassword(token, password, confirmPassword);
      Alert.alert('Success', 'Password reset successfully');
      navigation.goBack();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-[#050816]">
      <View className="flex-1 px-6 pt-10 pb-8">
        {/* Header */}
        <View className="mb-10">
          <Text className="text-xs font-semibold text-purple-300 tracking-[0.2em] uppercase">
            PARLAY STREAK
          </Text>
          <Text className="text-[28px] font-extrabold text-white mt-4">
            Choose a new password
          </Text>
          <Text className="text-sm text-slate-400 mt-2">
            Paste the reset token from your email and set a strong new password.
          </Text>
        </View>

        {/* Form */}
        <View className="space-y-4">
          <View className="space-y-2">
            <Text className="text-slate-200 text-xs font-medium">Reset Token</Text>
            <TextInput
              className="bg-[#141626] rounded-full px-5 py-3.5 text-base text-white"
              placeholder="Paste token from your email"
              placeholderTextColor="#6b7280"
              value={token}
              onChangeText={setToken}
            />
          </View>

          <View className="space-y-2">
            <Text className="text-slate-200 text-xs font-medium">New Password</Text>
            <TextInput
              className="bg-[#141626] rounded-full px-5 py-3.5 text-base text-white"
              placeholder="••••••••"
              placeholderTextColor="#6b7280"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
          </View>

          <View className="space-y-2">
            <Text className="text-slate-200 text-xs font-medium">Confirm Password</Text>
            <TextInput
              className="bg-[#141626] rounded-full px-5 py-3.5 text-base text-white"
              placeholder="Repeat password"
              placeholderTextColor="#6b7280"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
            />
          </View>

          <TouchableOpacity
            className={`mt-4 rounded-full px-4 py-3.5 items-center justify-center bg-[#7C3AED] ${
              loading ? 'opacity-60' : ''
            }`}
            onPress={handleSubmit}
            disabled={loading}
          >
            <Text className="text-white text-base font-semibold">
              {loading ? 'Resetting…' : 'Reset Password'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Spacer */}
        <View className="flex-1" />

        <View className="items-center mt-8">
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text className="text-xs text-slate-400">Back to login</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}
