import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

type VerifyMagicLinkRouteParams = {
  VerifyMagicLink: {
    token?: string;
  };
};

export function VerifyMagicLink() {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<VerifyMagicLinkRouteParams, 'VerifyMagicLink'>>();
  const { checkAuth } = useAuth();
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [error, setError] = useState('');
  
  // Get token from route params (React Navigation will parse it from URL)
  const token = route.params?.token;

  useEffect(() => {
    const verifyToken = async () => {
      if (!token) {
        setStatus('error');
        setError('No token provided');
        return;
      }

      try {
        const response = await api.verifyMagicLink(token);
        
        if (response.success) {
          setStatus('success');
          // Refresh auth context
          if (checkAuth) await checkAuth();
          // Navigate to dashboard after 2 seconds
          setTimeout(() => {
            navigation.reset({
              index: 0,
              routes: [{ name: 'Dashboard' as never }],
            });
          }, 2000);
        } else {
          setStatus('error');
          setError(response.error?.message || 'Verification failed');
        }
      } catch (err: any) {
        setStatus('error');
        setError(err.message || 'Verification failed');
      }
    };

    if (token) {
      verifyToken();
    }
  }, [token, checkAuth, navigation]);

  return (
    <View className="flex-1 bg-slate-950 justify-center items-center px-5">
      {status === 'verifying' && (
        <View className="items-center max-w-sm bg-slate-900 border border-slate-800 rounded-2xl px-6 py-8">
          <Text className="text-6xl mb-4">⚡</Text>
          <Text className="text-2xl font-bold text-white mb-2 text-center">Verifying magic link…</Text>
          <Text className="text-sm text-slate-400 text-center mb-6">
            Hang tight while we log you in to Parlay Streak.
          </Text>
          <ActivityIndicator size="large" color="#3b82f6" className="mt-2" />
        </View>
      )}

      {status === 'success' && (
        <View className="items-center max-w-sm bg-slate-900 border border-emerald-600/60 rounded-2xl px-6 py-8">
          <Text className="text-6xl mb-4">✅</Text>
          <Text className="text-2xl font-bold text-white mb-2 text-center">You&apos;re in!</Text>
          <Text className="text-sm text-slate-300 text-center mb-2">
            Redirecting you to your dashboard…
          </Text>
        </View>
      )}

      {status === 'error' && (
        <View className="items-center max-w-sm bg-slate-900 border border-red-600/60 rounded-2xl px-6 py-8">
          <Text className="text-6xl mb-4">❌</Text>
          <Text className="text-2xl font-bold text-white mb-2 text-center">Magic link error</Text>
          <Text className="text-sm text-slate-300 text-center mb-6">{error}</Text>
          <TouchableOpacity
            className="bg-gradient-to-r from-orange-500 to-red-600 rounded-xl px-4 py-3 min-w-[200px] items-center"
            onPress={() => navigation.navigate('Login' as never)}
          >
            <Text className="text-white text-sm font-semibold">Back to Login</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}
