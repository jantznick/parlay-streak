import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';

export function Settings() {
  const navigation = useNavigation();
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
  };

  if (!user) {
    return null;
  }

  const initials = (user.username || 'P').charAt(0).toUpperCase();

  return (
    <SafeAreaView className="flex-1 bg-[#050816]">
      <View className="flex-row items-center justify-between px-5 py-3 border-b border-slate-800 bg-slate-900/95">
        <TouchableOpacity onPress={() => navigation.goBack()} className="pr-4 py-1">
          <Text className="text-purple-300 text-base">‹ Back</Text>
        </TouchableOpacity>
        <Text className="text-lg font-semibold text-white">Settings</Text>
        <View className="w-12" />
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 16, paddingBottom: 32 }}
      >
        {/* Profile header */}
        <View className="flex-row items-center mb-6">
          <View className="h-12 w-12 rounded-full bg-slate-700 items-center justify-center mr-3">
            <Text className="text-base font-semibold text-white">{initials}</Text>
          </View>
          <View>
            <Text className="text-white text-base font-semibold">{user.username}</Text>
            <Text className="text-slate-400 text-xs mt-1">{user.email}</Text>
          </View>
        </View>

        {/* Account section */}
        <Text className="text-xs font-medium text-slate-400 mb-2">Account</Text>
        <View className="bg-slate-900 rounded-2xl border border-slate-700 overflow-hidden mb-6">
          <View className="flex-row items-center justify-between px-4 py-3 border-b border-slate-800">
            <Text className="text-slate-300 text-sm">Username</Text>
            <Text className="text-white text-sm">{user.username}</Text>
          </View>
          <View className="flex-row items-center justify-between px-4 py-3 border-b border-slate-800">
            <Text className="text-slate-300 text-sm">Email</Text>
            <Text className="text-white text-sm" numberOfLines={1}>
              {user.email}
            </Text>
          </View>
          <View className="flex-row items-center justify-between px-4 py-3">
            <Text className="text-slate-300 text-sm">Email verified</Text>
            <Text className={user.emailVerified ? 'text-emerald-400 text-sm' : 'text-yellow-400 text-sm'}>
              {user.emailVerified ? 'Yes' : 'Not yet'}
            </Text>
          </View>
        </View>

        {/* App section placeholder */}
        <Text className="text-xs font-medium text-slate-400 mb-2">App</Text>
        <View className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden mb-8">
          <View className="flex-row items-center justify-between px-4 py-3">
            <Text className="text-slate-300 text-sm">Notifications</Text>
            <Text className="text-slate-500 text-xs">Coming soon</Text>
          </View>
        </View>

        {/* Admin section (only for admins) */}
        {user.isAdmin && (
          <>
            <Text className="text-xs font-medium text-slate-400 mb-2">Admin</Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('AdminHome' as never)}
              className="bg-slate-900 rounded-2xl border border-slate-700 px-4 py-3 flex-row items-center justify-between mb-8"
            >
              <View>
                <Text className="text-white text-sm font-medium">Admin tools</Text>
                <Text className="text-slate-400 text-xs mt-1">
                  Manage games, bets, and users
                </Text>
              </View>
              <Text className="text-slate-500 text-xl">›</Text>
            </TouchableOpacity>
          </>
        )}

        {/* Logout */}
        <TouchableOpacity
          onPress={handleLogout}
          className="rounded-2xl bg-red-500/10 border border-red-500/40 px-4 py-3 items-center"
        >
          <Text className="text-red-400 text-sm font-semibold">Log out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
