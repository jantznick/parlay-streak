import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTheme } from '../../context/ThemeContext';
import { api } from '../../services/api';
import { ComparisonBetForm } from '../../components/admin/ComparisonBetForm';
import { ThresholdBetForm } from '../../components/admin/ThresholdBetForm';
import { EventBetForm } from '../../components/admin/EventBetForm';
import type { Game, Player } from '../../components/admin/types';

interface RouteParams {
  game: Game;
}

export function AdminBetBuilder() {
  const navigation = useNavigation();
  const route = useRoute();
  const { game } = route.params as RouteParams;
  const { effectiveTheme } = useTheme();
  const isDark = effectiveTheme === 'dark';

  // Tabs map directly to bet types
  const [tab, setTab] = useState<'COMPARISON' | 'THRESHOLD' | 'EVENT'>('COMPARISON');

  const [rosterLoading, setRosterLoading] = useState(false);
  const [playersHome, setPlayersHome] = useState<Player[]>([]);
  const [playersAway, setPlayersAway] = useState<Player[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Load roster and flatten player list (similar to web BetModal)
  useEffect(() => {
    let isMounted = true;

    const loadRoster = async () => {
      try {
        setRosterLoading(true);
        const response: any = await api.getGameRoster(game.id);
        if (!response.success || !response.data) {
          if (!isMounted) return;
          setError(response.error?.message || 'Failed to load roster data.');
          return;
        }

        const data = response.data;
        const homeRoster = data.home?.roster?.athletes || [];
        const awayRoster = data.away?.roster?.athletes || [];

        const flatten = (athletes: any[], team: 'home' | 'away'): Player[] => {
          if (!Array.isArray(athletes) || athletes.length === 0) return [];
          // If items-based grouping, flatten items
          if (athletes[0] && 'items' in athletes[0]) {
            const result: Player[] = [];
            for (const group of athletes as any[]) {
              if (Array.isArray(group.items)) {
                for (const p of group.items) {
                  result.push({ ...(p as any), team });
                }
              }
            }
            return result;
          }
          return athletes.map((p: any) => ({ ...(p as any), team }));
        };

        if (!isMounted) return;
        setPlayersHome(flatten(homeRoster, 'home'));
        setPlayersAway(flatten(awayRoster, 'away'));
      } catch (e: any) {
        if (!isMounted) return;
        setError(e.message || 'Failed to load roster data.');
      } finally {
        if (isMounted) {
          setRosterLoading(false);
        }
      }
    };

    loadRoster();

    return () => {
      isMounted = false;
    };
  }, [game.id]);

  const handleBetCreated = () => {
    Alert.alert('Success', 'Bet created successfully!', [
      {
        text: 'OK',
        onPress: () => navigation.goBack(),
      },
    ]);
  };

  return (
    <SafeAreaView className={`flex-1 ${isDark ? 'bg-slate-900' : 'bg-light-bg'}`}>
      {/* Header with back button */}
      <View className={`flex-row items-center justify-between px-5 py-3 border-b ${isDark ? 'border-slate-800 bg-slate-950' : 'border-slate-300 bg-light-bg-alt'}`}>
        <TouchableOpacity onPress={() => navigation.goBack()} className="pr-4 py-1">
          <Text className={`text-base ${isDark ? 'text-purple-300' : 'text-purple-600'}`}>‹ Back</Text>
        </TouchableOpacity>
        <Text className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>Bet builder</Text>
        <View className="w-12" />
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 16 }}>
        {/* Game summary */}
        <View className={`rounded-3xl border px-4 py-4 mb-5 ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200 shadow-lg shadow-slate-900/10'} dark:shadow-none`}>
          <Text className={`text-xs font-medium mb-1 ${isDark ? 'text-slate-400' : 'text-slate-800'}`}>Game</Text>
          <Text className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`} numberOfLines={1}>
            {game.awayTeam} @ {game.homeTeam}
          </Text>
          <Text className={`text-[11px] mt-1 ${isDark ? 'text-slate-400' : 'text-slate-800'}`}>
            {new Date(game.startTime).toLocaleTimeString(undefined, {
              hour: 'numeric',
              minute: '2-digit',
            })}
            {' • '}
            {new Date(game.startTime).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
            })}
          </Text>
        </View>

        {/* Bet type tabs – COMPARISON / THRESHOLD / EVENT */}
        <View className={`rounded-3xl border px-3 py-2 mb-5 ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-light-bg-alt border-slate-300 shadow-sm dark:shadow-none'}`}>
          <View className={`flex-row rounded-full p-1 ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
            <TouchableOpacity
              onPress={() => setTab('COMPARISON')}
              className={`flex-1 rounded-full px-3 py-1 items-center ${
                tab === 'COMPARISON' ? (isDark ? 'bg-slate-100' : 'bg-orange-600') : 'bg-transparent'
              }`}
            >
              <Text
                className={`text-[11px] font-medium ${
                  tab === 'COMPARISON' ? (isDark ? 'text-slate-900' : 'text-white') : (isDark ? 'text-slate-300' : 'text-slate-700')
                }`}
              >
                COMPARISON
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setTab('THRESHOLD')}
              className={`flex-1 rounded-full px-3 py-1 items-center ${
                tab === 'THRESHOLD' ? (isDark ? 'bg-slate-100' : 'bg-orange-600') : 'bg-transparent'
              }`}
            >
              <Text
                className={`text-[11px] font-medium ${
                  tab === 'THRESHOLD' ? (isDark ? 'text-slate-900' : 'text-white') : (isDark ? 'text-slate-300' : 'text-slate-700')
                }`}
              >
                THRESHOLD
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setTab('EVENT')}
              className={`flex-1 rounded-full px-3 py-1 items-center ${
                tab === 'EVENT' ? (isDark ? 'bg-slate-100' : 'bg-orange-600') : 'bg-transparent'
              }`}
            >
              <Text
                className={`text-[11px] font-medium ${
                  tab === 'EVENT' ? (isDark ? 'text-slate-900' : 'text-white') : (isDark ? 'text-slate-300' : 'text-slate-700')
                }`}
              >
                EVENT
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Inline status */}
        {error && (
          <View className="bg-red-900/40 border border-red-500/70 rounded-2xl px-4 py-3 mb-4">
            <Text className="text-red-200 text-xs text-center">{error}</Text>
          </View>
        )}
        {success && (
          <View className="bg-emerald-900/40 border border-emerald-500/70 rounded-2xl px-4 py-3 mb-4">
            <Text className="text-emerald-200 text-xs text-center">{success}</Text>
          </View>
        )}

        {/* COMPARISON form */}
        {tab === 'COMPARISON' && (
          <ComparisonBetForm
            game={game}
            playersHome={playersHome}
            playersAway={playersAway}
            rosterLoading={rosterLoading}
            onSuccess={handleBetCreated}
          />
        )}

        {/* THRESHOLD form */}
        {tab === 'THRESHOLD' && (
          <ThresholdBetForm
            game={game}
            playersHome={playersHome}
            playersAway={playersAway}
            rosterLoading={rosterLoading}
            onSuccess={handleBetCreated}
          />
        )}

        {/* EVENT form */}
        {tab === 'EVENT' && (
          <EventBetForm
            game={game}
            playersHome={playersHome}
            playersAway={playersAway}
            rosterLoading={rosterLoading}
            onSuccess={handleBetCreated}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
