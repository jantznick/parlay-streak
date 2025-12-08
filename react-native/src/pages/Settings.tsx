import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';

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
    <SafeAreaView className="flex-1 bg-slate-950" edges={['top', 'left', 'right']}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        {/* Header */}
        <View className="px-6 pt-6 pb-6">
          <Text className="text-3xl font-bold text-white">Profile</Text>
        </View>

        <View className="px-6">
          {/* Profile Card */}
          <View className="bg-slate-900 rounded-2xl p-4 mb-8 flex-row items-center border border-slate-800">
            <View className="h-16 w-16 rounded-full bg-slate-800 items-center justify-center mr-4 border border-slate-700">
              <Text className="text-2xl font-bold text-slate-300">{initials}</Text>
            </View>
            <View className="flex-1">
              <Text className="text-xl font-bold text-white mb-1">{user.username}</Text>
              <Text className="text-slate-400 text-sm">{user.email}</Text>
            </View>
          </View>

          {/* Account section */}
          <Text className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 ml-1">Account</Text>
          <View className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden mb-8">
            <View className="flex-row items-center justify-between px-4 py-4 border-b border-slate-800">
              <Text className="text-slate-300 text-base">Username</Text>
              <Text className="text-white text-base font-medium">{user.username}</Text>
            </View>
            <View className="flex-row items-center justify-between px-4 py-4 border-b border-slate-800">
              <Text className="text-slate-300 text-base">Email</Text>
              <Text className="text-white text-base font-medium" numberOfLines={1}>
                {user.email}
              </Text>
            </View>
            <View className="flex-row items-center justify-between px-4 py-4">
              <Text className="text-slate-300 text-base">Verified</Text>
              <View className={`px-2 py-1 rounded-md ${user.emailVerified ? 'bg-emerald-500/10' : 'bg-yellow-500/10'}`}>
                <Text className={`text-xs font-bold ${user.emailVerified ? 'text-emerald-400' : 'text-yellow-400'}`}>
                  {user.emailVerified ? 'VERIFIED' : 'PENDING'}
                </Text>
              </View>
            </View>
          </View>

          {/* Admin section (only for admins) */}
          {user.isAdmin && (
            <>
              <Text className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 ml-1">Administration</Text>
              <TouchableOpacity
                onPress={() => navigation.navigate('AdminHome' as never)}
                className="bg-slate-900 rounded-2xl border border-slate-800 px-4 py-4 flex-row items-center justify-between mb-8"
              >
                <View className="flex-row items-center gap-3">
                  <View className="bg-indigo-500/10 p-2 rounded-lg">
                    <Ionicons name="shield-checkmark" size={20} color="#818cf8" />
                  </View>
                  <View>
                    <Text className="text-white text-base font-medium">Admin Panel</Text>
                    <Text className="text-slate-400 text-xs">Manage games & users</Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#64748b" />
              </TouchableOpacity>
            </>
          )}

          {/* Logout */}
          <TouchableOpacity
            onPress={handleLogout}
            className="rounded-2xl bg-red-500/10 border border-red-500/20 px-4 py-4 items-center flex-row justify-center gap-2"
          >
            <Ionicons name="log-out-outline" size={20} color="#f87171" />
            <Text className="text-red-400 text-base font-semibold">Sign Out</Text>
          </TouchableOpacity>
          
          <Text className="text-slate-600 text-xs text-center mt-8 pb-4">
            Version 1.0.0
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
