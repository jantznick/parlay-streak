import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';

type AuthMode = 'login' | 'register' | 'forgot' | 'reset';

export function AuthScreen({ mode: propMode }: { mode?: AuthMode }) {
  const navigation = useNavigation();
  const [mode, setMode] = useState<AuthMode>(propMode || 'login');

  const { login, register, checkAuth } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [username, setUsername] = useState('');
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [sendingMagicLink, setSendingMagicLink] = useState(false);
  const [success, setSuccess] = useState('');
  const [formError, setFormError] = useState('');
  const [devLoggingIn, setDevLoggingIn] = useState(false);

  const isLogin = mode === 'login';
  const isRegister = mode === 'register';
  const isForgot = mode === 'forgot';
  const isReset = mode === 'reset';

  const title =
    (isLogin && 'Sign in to your account') ||
    (isRegister && 'Create your account') ||
    (isForgot && 'Reset your password') ||
    'Choose a new password';

  const subtitle =
    (isLogin && 'Access your bets, track your streak, and keep building parlays.') ||
    (isRegister && 'Join Parlay Streak and start building your winning streak.') ||
    (isForgot &&
      "Enter the email associated with your account and we'll send you a reset link.") ||
    'Paste the reset token from your email and set a strong new password.';

  const handleMagicLink = async () => {
    if (!email) {
      setFormError('Please enter your email first.');
      return;
    }

    setSendingMagicLink(true);
    setSuccess('');
    setFormError('');
    try {
      await api.requestMagicLink(email, isRegister ? username || undefined : undefined);
      setSuccess('✨ Check your email for a magic link!');
    } catch (error: any) {
      setFormError(error.message || 'Failed to send magic link.');
    } finally {
      setSendingMagicLink(false);
    }
  };

  const handlePrimary = async () => {
    setFormError('');
    setSuccess('');

    try {
      if (isLogin) {
        if (!email || !password) {
          setFormError('Please fill in both email and password.');
          return;
        }
        setLoading(true);
        await login(email, password);
      } else if (isRegister) {
        if (!username || !email || !password || !confirmPassword) {
          setFormError('Please fill in all fields.');
          return;
        }
        if (password !== confirmPassword) {
          setFormError('Passwords do not match.');
          return;
        }
        setLoading(true);
        await register(username, email, password);
      } else if (isForgot) {
        if (!email) {
          setFormError('Please enter your email.');
          return;
        }
        setLoading(true);
        await api.forgotPassword(email);
        setSuccess('Password reset email sent.');
      } else if (isReset) {
        if (!token || !password || !confirmPassword) {
          setFormError('Please fill in all fields.');
          return;
        }
        if (password !== confirmPassword) {
          setFormError('Passwords do not match.');
          return;
        }
        setLoading(true);
        await api.resetPassword(token, password, confirmPassword);
        setSuccess('Password reset successfully. You can now sign in.');
      }
    } catch (error: any) {
      setFormError(
        error.message ||
          (isLogin
            ? 'Login failed. Please check your details and try again.'
            : isRegister
            ? 'Registration failed. Please check your details and try again.'
            : 'Something went wrong. Please try again.')
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDevAdminLogin = async () => {
    if (!__DEV__) return;

    setDevLoggingIn(true);
    setSuccess('');
    setFormError('');
    try {
      const response = await api.devLoginAdmin();
      if (response.success && checkAuth) {
        await checkAuth();
      }
    } catch (error: any) {
      setFormError(error.message || 'Dev admin login failed.');
    } finally {
      setDevLoggingIn(false);
    }
  };

  const goToMode = (next: AuthMode) => {
    // Single-screen auth flow: just swap internal mode, reset messages
    setMode(next);
    setFormError('');
    setSuccess('');
  };

  const primaryLabel =
    (isLogin && 'Sign In') ||
    (isRegister && 'Create Account') ||
    (isForgot && 'Send Reset Link') ||
    'Reset Password';

  return (
    <SafeAreaView className="flex-1 bg-slate-900">
      <ScrollView
        className="flex-1"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ flexGrow: 1 }}
      >
        <View className="flex-1 px-6 pt-10 pb-8">
          {/* Header */}
          <View className="mb-10">
            <Text className="text-xs font-semibold text-purple-300 tracking-[0.2em] uppercase">
              PARLAY STREAK
            </Text>
            <Text className="text-[30px] font-extrabold text-white mt-4">{title}</Text>
            <Text className="text-sm text-slate-400 mt-2">{subtitle}</Text>
          </View>

          {/* Form */}
          <View className="space-y-5">
            {formError ? (
              <View className="bg-red-900/40 border border-red-500/70 rounded-2xl px-4 py-3">
                <Text className="text-red-200 text-xs text-center">{formError}</Text>
              </View>
            ) : null}

            {success ? (
              <View className="bg-emerald-900/40 border border-emerald-500/70 rounded-2xl px-4 py-3">
                <Text className="text-emerald-200 text-xs text-center">{success}</Text>
              </View>
            ) : null}

            {isRegister && (
              <View className="space-y-2">
                <Text className="text-slate-200 text-xs font-medium">Username</Text>
                <TextInput
                  className="bg-[#141626] rounded-full px-5 py-3.5 text-base text-white"
                  placeholder="thenickjantz"
                  placeholderTextColor="#6b7280"
                  value={username}
                  onChangeText={setUsername}
                  autoCapitalize="none"
                />
              </View>
            )}

            {(isLogin || isRegister || isForgot) && (
              <View className="space-y-2">
                <Text className="text-slate-200 text-xs font-medium">Email</Text>
                <TextInput
                  className="bg-[#141626] rounded-full px-5 py-3.5 text-base text-white"
                  placeholder="you@example.com"
                  placeholderTextColor="#6b7280"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
                {(isLogin || isRegister) && (
                  <TouchableOpacity onPress={handleMagicLink} disabled={sendingMagicLink || !email}>
                    <Text
                      className={`text-xs mt-1 ${
                        sendingMagicLink || !email ? 'text-orange-400/60' : 'text-orange-400'
                      }`}
                    >
                      {sendingMagicLink ? 'Sending magic link…' : 'Send me a magic link instead →'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {(isLogin || isRegister || isReset) && (
              <View className="space-y-2">
                <Text className="text-slate-200 text-xs font-medium">
                  {isReset ? 'New Password' : 'Password'}
                </Text>
                <TextInput
                  className="bg-[#141626] rounded-full px-5 py-3.5 text-base text-white"
                  placeholder="••••••••"
                  placeholderTextColor="#6b7280"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                />
              </View>
            )}

            {(isRegister || isReset) && (
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
            )}

            {isReset && (
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
            )}

            <TouchableOpacity
              className={`mt-4 rounded-full px-4 py-3.5 items-center justify-center bg-gradient-to-r from-orange-500 to-red-600 ${
                loading ? 'opacity-60' : ''
              }`}
              onPress={handlePrimary}
              disabled={loading}
            >
              <Text className="text-white text-base font-semibold">
                {loading ? (isForgot ? 'Sending…' : isReset ? 'Resetting…' : 'Working…') : primaryLabel}
              </Text>
            </TouchableOpacity>

            {isLogin && (
              <TouchableOpacity
                onPress={() => goToMode('forgot')}
                className="mt-2 items-center"
              >
                <Text className="text-xs text-slate-400">Forgot password?</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Spacer */}
          <View className="flex-1" />

          {/* Footer */}
          <View className="items-center mt-8">
            {isLogin && (
              <TouchableOpacity onPress={() => goToMode('register')}>
                <Text className="text-xs text-slate-400">
                  Don&apos;t have an account?{' '}
                  <Text className="text-purple-400 font-semibold">Sign up</Text>
                </Text>
              </TouchableOpacity>
            )}
            {isRegister && (
              <TouchableOpacity onPress={() => goToMode('login')}>
                <Text className="text-xs text-slate-400">
                  Already have an account?{' '}
                  <Text className="text-purple-400 font-semibold">Sign in</Text>
                </Text>
              </TouchableOpacity>
            )}
            {(isForgot || isReset) && (
              <TouchableOpacity onPress={() => goToMode('login')}>
                <Text className="text-xs text-slate-400">Back to login</Text>
              </TouchableOpacity>
            )}

            {isLogin && __DEV__ && (
              <TouchableOpacity onPress={handleDevAdminLogin} className="mt-3">
                <Text
                  className={`text-[11px] ${devLoggingIn ? 'text-red-400/60' : 'text-red-400'}`}
                >
                  {devLoggingIn ? 'Logging in as dev admin…' : 'Dev: Login as admin (no password)'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}


