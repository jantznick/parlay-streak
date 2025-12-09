import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { StreakHistoryCard } from '../components/profile/StreakHistoryCard';
import { MOCK_STREAK_HISTORY } from '../data/mockStreakData';
import { useTheme } from '../context/ThemeContext';

export function Settings() {
  const navigation = useNavigation();
  const { user, logout } = useAuth();
  const [visibleStreaks, setVisibleStreaks] = useState(3);
  const { theme, effectiveTheme, setTheme } = useTheme();

  const handleLogout = async () => {
    await logout();
  };

  // Theme loading is now handled in ThemeProvider

  const changeTheme = async (newTheme: 'light' | 'dark' | 'system') => {
    await setTheme(newTheme);
  };

  if (!user) {
    return null;
  }

  const initials = (user.username || 'P').charAt(0).toUpperCase();

  return (
    <SafeAreaView className="flex-1 bg-slate-50 dark:bg-slate-950" edges={['top', 'left', 'right']}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        {/* Header */}
        <View className="px-6 pt-6 pb-6">
          <Text className="text-3xl font-bold text-slate-900 dark:text-white">Profile</Text>
        </View>

        <View className="px-6">
          {/* Profile Card */}
          <View className="bg-white dark:bg-slate-900 rounded-2xl p-4 mb-8 flex-row items-center border border-slate-200 dark:border-slate-800 shadow-lg shadow-slate-900/10 dark:shadow-none">
            <View style={{ backgroundColor: '#ea580c' }} className="h-16 w-16 rounded-full dark:bg-slate-800 items-center justify-center mr-4 shadow-lg shadow-orange-500/40 dark:shadow-none">
              <Text className="text-2xl font-bold text-white dark:text-slate-300">{initials}</Text>
            </View>
            <View className="flex-1">
              <Text className="text-xl font-bold text-slate-900 dark:text-white mb-1">{user.username}</Text>
              <Text className="text-slate-700 dark:text-slate-400 text-sm">{user.email}</Text>
            </View>
          </View>

          {/* Preferences Section */}
          <Text className="text-xs font-bold text-slate-700 dark:text-slate-500 uppercase tracking-wider mb-3 ml-1">Preferences</Text>
          <View className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden mb-8 shadow-lg shadow-slate-900/10 dark:shadow-none">
            <View className="flex-row items-center justify-between px-4 py-4">
              <View className="flex-row items-center gap-3">
                <View className="bg-blue-500/10 p-2 rounded-lg">
                  <Ionicons name="moon" size={20} color="#3b82f6" />
                </View>
                <Text className="text-slate-900 dark:text-white text-base font-medium">Theme</Text>
              </View>
              
              <View className="flex-row bg-slate-100 dark:bg-slate-800 rounded-lg p-1 shadow-sm dark:shadow-none">
                {(['light', 'dark', 'system'] as const).map((t) => {
                  const isActive = theme === t;
                  return (
                    <TouchableOpacity
                        key={t}
                        onPress={() => changeTheme(t)}
                        style={{
                            backgroundColor: isActive ? (effectiveTheme === 'dark' ? '#475569' : '#ffffff') : 'transparent',
                            paddingHorizontal: 12,
                            paddingVertical: 6,
                            borderRadius: 6,
                            shadowOpacity: isActive ? 0.1 : 0,
                            shadowRadius: 2,
                            elevation: isActive ? 1 : 0,
                        }}
                    >
                        <Text className={`text-xs font-semibold capitalize ${isActive ? 'text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}>
                        {t}
                        </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </View>

          {/* Account section */}
          <Text className="text-xs font-bold text-slate-700 dark:text-slate-500 uppercase tracking-wider mb-3 ml-1">Account</Text>
          <View className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden mb-8 shadow-lg shadow-slate-900/10 dark:shadow-none">
            <View className="flex-row items-center justify-between px-4 py-4 border-b border-slate-200 dark:border-slate-800">
              <Text className="text-slate-600 dark:text-slate-300 text-base">Username</Text>
              <Text className="text-slate-900 dark:text-white text-base font-medium">{user.username}</Text>
            </View>
            <View className="flex-row items-center justify-between px-4 py-4 border-b border-slate-200 dark:border-slate-800">
              <Text className="text-slate-600 dark:text-slate-300 text-base">Email</Text>
              <Text className="text-slate-900 dark:text-white text-base font-medium" numberOfLines={1}>
                {user.email}
              </Text>
            </View>
            <View className="flex-row items-center justify-between px-4 py-4">
              <Text className="text-slate-600 dark:text-slate-300 text-base">Verified</Text>
              <View className={`px-2 py-1 rounded-md ${user.emailVerified ? 'bg-emerald-500/10' : 'bg-yellow-500/10'}`}>
                <Text className={`text-xs font-bold ${user.emailVerified ? 'text-emerald-600 dark:text-emerald-400' : 'text-yellow-600 dark:text-yellow-400'}`}>
                  {user.emailVerified ? 'VERIFIED' : 'PENDING'}
                </Text>
              </View>
            </View>
          </View>

          {/* Streak History Section */}
          <Text className="text-xs font-bold text-slate-700 dark:text-slate-500 uppercase tracking-wider mb-3 ml-1">Streak History</Text>
          <View className="mb-8">
            <ScrollView 
              style={{ maxHeight: 500 }} 
              nestedScrollEnabled={true}
              showsVerticalScrollIndicator={true}
            >
              {MOCK_STREAK_HISTORY.slice(0, visibleStreaks).map((group) => (
                <StreakHistoryCard key={group.id} group={group} />
              ))}
              
              {visibleStreaks < MOCK_STREAK_HISTORY.length && (
                <TouchableOpacity
                  onPress={() => setVisibleStreaks(prev => prev + 3)}
                  className="bg-white dark:bg-slate-800/50 py-3 rounded-xl items-center border border-slate-200 dark:border-slate-700/50 mt-2 mb-2 shadow-md shadow-slate-900/10 dark:shadow-none"
                >
                  <Text className="text-slate-700 dark:text-slate-400 font-semibold">Load More</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>

          {/* Admin section (only for admins) */}
          {user.isAdmin && (
            <>
              <Text className="text-xs font-bold text-slate-700 dark:text-slate-500 uppercase tracking-wider mb-3 ml-1">Administration</Text>
              <TouchableOpacity
                onPress={() => navigation.navigate('AdminHome' as never)}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 px-4 py-4 flex-row items-center justify-between mb-8 shadow-lg shadow-slate-900/10 dark:shadow-none"
              >
                <View className="flex-row items-center gap-3">
                  <View className="bg-indigo-500/10 p-2 rounded-lg">
                    <Ionicons name="shield-checkmark" size={20} color="#818cf8" />
                  </View>
                  <View>
                    <Text className="text-slate-900 dark:text-white text-base font-medium">Admin Panel</Text>
                    <Text className="text-slate-800 dark:text-slate-400 text-xs">Manage games & users</Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#64748b" />
              </TouchableOpacity>
            </>
          )}

          {/* Logout */}
          <TouchableOpacity
            onPress={handleLogout}
            className="rounded-2xl bg-red-500/10 border border-red-500/20 px-4 py-4 items-center flex-row justify-center gap-2 shadow-md shadow-red-500/20 dark:shadow-none"
          >
            <Ionicons name="log-out-outline" size={20} color="#f87171" />
            <Text className="text-red-400 text-base font-semibold">Sign Out</Text>
          </TouchableOpacity>
          
          <Text className="text-slate-700 dark:text-slate-600 text-xs text-center mt-8 pb-4">
            Version 1.0.0
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
