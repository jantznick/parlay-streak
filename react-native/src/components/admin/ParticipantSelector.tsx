import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { BASKETBALL_CONFIG } from '@shared/config/sports/basketball';
import type { TimePeriod } from '@shared/types/bets';
import { useTheme } from '../../context/ThemeContext';
import type { Game, Player, SubjectType } from './types';

interface ParticipantSelectorProps {
  label: string;
  game: Game;
  subjectType: SubjectType;
  setSubjectType: (t: SubjectType) => void;
  team: 'home' | 'away' | '';
  setTeam: (t: 'home' | 'away' | '') => void;
  player: string;
  setPlayer: (p: string) => void;
  metric: string;
  setMetric: (m: string) => void;
  timePeriod: TimePeriod;
  setTimePeriod: (p: TimePeriod) => void;
  playersHome: Player[];
  playersAway: Player[];
  rosterLoading: boolean;
}

export function ParticipantSelector({
  label,
  game,
  subjectType,
  setSubjectType,
  team,
  setTeam,
  player,
  setPlayer,
  metric,
  setMetric,
  timePeriod,
  setTimePeriod,
  playersHome,
  playersAway,
  rosterLoading,
}: ParticipantSelectorProps) {
  const { effectiveTheme } = useTheme();
  const isDark = effectiveTheme === 'dark';
  
  return (
    <View className={`rounded-2xl px-3 py-3 mb-1 ${isDark ? 'bg-slate-800' : 'bg-slate-100 shadow-sm'} dark:shadow-none`}>
      <Text className={`text-[11px] font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-800'}`}>{label}</Text>

      <View className={`flex-row rounded-full p-1 mb-2 ${isDark ? 'bg-slate-900' : 'bg-slate-100'}`}>
        <TouchableOpacity
          onPress={() => {
            setSubjectType('TEAM');
            setPlayer('');
          }}
          className={`flex-1 rounded-full px-3 py-1 items-center ${subjectType === 'TEAM' ? (isDark ? 'bg-slate-100' : 'bg-orange-600') : 'bg-transparent'}`}
        >
          <Text className={`text-[11px] font-medium ${subjectType === 'TEAM' ? (isDark ? 'text-slate-900' : 'text-white') : (isDark ? 'text-slate-300' : 'text-slate-700')}`}>
            Team
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => {
            setSubjectType('PLAYER');
            setTeam('');
          }}
          className={`flex-1 rounded-full px-3 py-1 items-center ${subjectType === 'PLAYER' ? (isDark ? 'bg-slate-100' : 'bg-orange-600') : 'bg-transparent'}`}
        >
          <Text className={`text-[11px] font-medium ${subjectType === 'PLAYER' ? (isDark ? 'text-slate-900' : 'text-white') : (isDark ? 'text-slate-300' : 'text-slate-700')}`}>
            Player
          </Text>
        </TouchableOpacity>
      </View>

      {subjectType === 'TEAM' ? (
        <View className="mb-2">
          <Text className={`text-[11px] mb-1 ${isDark ? 'text-slate-400' : 'text-slate-800'}`}>Team</Text>
          <View className="flex-row">
            <TouchableOpacity
              onPress={() => setTeam('home')}
              className={`px-3 py-1 rounded-full mr-2 border ${team === 'home' ? (isDark ? 'bg-slate-100 border-slate-100' : 'bg-orange-600 border-orange-600') : (isDark ? 'bg-slate-900 border-slate-700' : 'bg-slate-100 border-slate-300')}`}
            >
              <Text className={`text-[11px] ${team === 'home' ? (isDark ? 'text-slate-900' : 'text-white') : (isDark ? 'text-slate-200' : 'text-slate-700')}`}>
                {game.homeTeam}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setTeam('away')}
              className={`px-3 py-1 rounded-full border ${team === 'away' ? (isDark ? 'bg-slate-100 border-slate-100' : 'bg-orange-600 border-orange-600') : (isDark ? 'bg-slate-900 border-slate-700' : 'bg-slate-100 border-slate-300')}`}
            >
              <Text className={`text-[11px] ${team === 'away' ? (isDark ? 'text-slate-900' : 'text-white') : (isDark ? 'text-slate-200' : 'text-slate-700')}`}>
                {game.awayTeam}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View className="mb-2">
          <Text className={`text-[11px] mb-1 ${isDark ? 'text-slate-400' : 'text-slate-800'}`}>Player</Text>
          {rosterLoading ? (
            <View className="flex-row items-center">
              <ActivityIndicator size="small" color="#e5e7eb" />
              <Text className={`text-[11px] ml-2 ${isDark ? 'text-slate-400' : 'text-slate-700'}`}>Loading players…</Text>
            </View>
          ) : playersHome.length + playersAway.length === 0 ? (
            <Text className={`text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-700'}`}>No roster data. Refresh game data on web first.</Text>
          ) : (
            <View className="space-y-2">
              <View>
                <Text className={`text-[11px] mb-1 ${isDark ? 'text-slate-500' : 'text-slate-700'}`}>{game.homeTeam}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {playersHome.map((p) => {
                    const jersey = p.jersey || p.jerseyNumber;
                    const pos = p.position?.displayName || p.position?.name || p.position?.abbreviation;
                    const label = `${p.displayName || p.fullName || 'Unknown'}${jersey ? ` #${jersey}` : ''}${pos ? ` (${pos})` : ''}`;
                    const isSelected = player === String(p.id);
                    return (
                      <TouchableOpacity
                        key={p.id}
                        onPress={() => setPlayer(String(p.id))}
                        className={`px-3 py-1 rounded-full mr-2 border ${isSelected ? (isDark ? 'bg-slate-100 border-slate-100' : 'bg-orange-600 border-orange-600') : (isDark ? 'bg-slate-900 border-slate-700' : 'bg-slate-100 border-slate-300')}`}
                      >
                        <Text className={`text-[11px] ${isSelected ? (isDark ? 'text-slate-900' : 'text-white') : (isDark ? 'text-slate-200' : 'text-slate-700')}`}>
                          {label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
              <View>
                <Text className={`text-[11px] mb-1 ${isDark ? 'text-slate-500' : 'text-slate-700'}`}>{game.awayTeam}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {playersAway.map((p) => {
                    const jersey = p.jersey || p.jerseyNumber;
                    const pos = p.position?.displayName || p.position?.name || p.position?.abbreviation;
                    const label = `${p.displayName || p.fullName || 'Unknown'}${jersey ? ` #${jersey}` : ''}${pos ? ` (${pos})` : ''}`;
                    const isSelected = player === String(p.id);
                    return (
                      <TouchableOpacity
                        key={p.id}
                        onPress={() => setPlayer(String(p.id))}
                        className={`px-3 py-1 rounded-full mr-2 border ${isSelected ? (isDark ? 'bg-slate-100 border-slate-100' : 'bg-orange-600 border-orange-600') : (isDark ? 'bg-slate-900 border-slate-700' : 'bg-slate-100 border-slate-300')}`}
                      >
                        <Text className={`text-[11px] ${isSelected ? (isDark ? 'text-slate-900' : 'text-white') : (isDark ? 'text-slate-200' : 'text-slate-700')}`}>
                          {label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            </View>
          )}
        </View>
      )}

      <View className="mt-1">
        <Text className={`text-[11px] mb-1 ${isDark ? 'text-slate-400' : 'text-slate-800'}`}>Metric</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {BASKETBALL_CONFIG.metrics
            .filter((m) => (subjectType === 'TEAM' ? m.team : m.player))
            .map((m) => (
              <TouchableOpacity
                key={m.value}
                onPress={() => setMetric(m.value)}
                className={`px-3 py-1 rounded-full mr-2 border ${metric === m.value ? (isDark ? 'bg-slate-100 border-slate-100' : 'bg-orange-600 border-orange-600') : (isDark ? 'bg-slate-900 border-slate-700' : 'bg-slate-100 border-slate-300')}`}
              >
                <Text className={`text-[11px] ${metric === m.value ? (isDark ? 'text-slate-900' : 'text-white') : (isDark ? 'text-slate-200' : 'text-slate-700')}`}>
                  {m.label}
                </Text>
              </TouchableOpacity>
            ))}
        </ScrollView>
      </View>

      <View className="mt-2">
        <Text className={`text-[11px] mb-1 ${isDark ? 'text-slate-400' : 'text-slate-800'}`}>Time period</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {BASKETBALL_CONFIG.time_periods.map((tp) => (
            <TouchableOpacity
              key={tp.value}
              onPress={() => setTimePeriod(tp.value)}
              className={`px-3 py-1 rounded-full mr-2 border ${timePeriod === tp.value ? (isDark ? 'bg-slate-100 border-slate-100' : 'bg-orange-600 border-orange-600') : (isDark ? 'bg-slate-900 border-slate-700' : 'bg-slate-100 border-slate-300')}`}
            >
              <Text className={`text-[11px] ${timePeriod === tp.value ? (isDark ? 'text-slate-900' : 'text-white') : (isDark ? 'text-slate-200' : 'text-slate-700')}`}>
                {tp.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </View>
  );
}

