import React, { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import type { TimePeriod } from '@shared/types/bets';
import { useTheme } from '../../context/ThemeContext';
import { api } from '../../services/api';
import type { Game, Player, SubjectType } from './types';
import { ParticipantSelector } from './ParticipantSelector';

interface ThresholdBetFormProps {
  game: Game;
  playersHome: Player[];
  playersAway: Player[];
  rosterLoading: boolean;
  onSuccess: () => void;
}

export function ThresholdBetForm({
  game,
  playersHome,
  playersAway,
  rosterLoading,
  onSuccess,
}: ThresholdBetFormProps) {
  const { effectiveTheme } = useTheme();
  const isDark = effectiveTheme === 'dark';
  const [subjectType, setSubjectType] = useState<SubjectType>('TEAM');
  const [team, setTeam] = useState<'home' | 'away' | ''>('home');
  const [player, setPlayer] = useState<string>('');
  const [metric, setMetric] = useState<string>('points');
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('FULL_GAME');
  const [operator, setOperator] = useState<'OVER' | 'UNDER'>('OVER');
  const [threshold, setThreshold] = useState('28.5');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const formatMetricLabel = (metric: string): string =>
    metric.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());

  const formatTimePeriodLabel = (period: TimePeriod | string): string => {
    const map: Record<string, string> = {
      FULL_GAME: 'Full Game',
      Q1: 'Q1',
      Q2: 'Q2',
      Q3: 'Q3',
      Q4: 'Q4',
      H1: '1H',
      H2: '2H',
      OT: 'OT',
    };
    return map[period] || period;
  };

  const handleCreate = async () => {
    if (loading) return;
    setError(null);

    const metadata: any = (game as any).metadata;
    const apiData = metadata?.apiData;
    const homeTeamId = apiData?.teams?.home?.id;
    const awayTeamId = apiData?.teams?.away?.id;

    if (!homeTeamId || !awayTeamId) {
      setError('Missing team IDs for this game. Refresh the game data in the web admin first.');
      return;
    }

    const buildTeamParticipant = (which: 'home' | 'away', metric: string, timePeriod: TimePeriod) => {
      const isHome = which === 'home';
      return {
        subject_type: 'TEAM' as const,
        subject_id: isHome ? homeTeamId : awayTeamId,
        subject_name: isHome ? game.homeTeam : game.awayTeam,
        metric,
        time_period: timePeriod,
      };
    };

    const findPlayer = (id: string): Player | undefined =>
      playersHome.concat(playersAway).find((p) => String(p.id) === String(id));

    const thresholdValue = parseFloat(threshold);
    if (isNaN(thresholdValue)) {
      setError('Please enter a valid threshold value (e.g. 28.5).');
      return;
    }

    let participant;
    try {
      if (subjectType === 'TEAM') {
        if (team !== 'home' && team !== 'away') {
          throw new Error('Select a team for the participant.');
        }
        participant = buildTeamParticipant(team, metric, timePeriod);
      } else {
        if (!player) {
          throw new Error('Select a player for the participant.');
        }
        const foundPlayer = findPlayer(player);
        if (!foundPlayer) {
          throw new Error('Could not find the selected player.');
        }
        const name = foundPlayer.displayName || foundPlayer.fullName || `Player ${player}`;
        participant = {
          subject_type: 'PLAYER' as const,
          subject_id: String(foundPlayer.id),
          subject_name: name,
          metric,
          time_period: timePeriod,
        };
      }
    } catch (e: any) {
      const message = e.message || 'Invalid participant selection.';
      setError(message);
      return;
    }

    try {
      setLoading(true);
      const config = {
        type: 'THRESHOLD' as const,
        participant,
        operator,
        threshold: thresholdValue,
      };

      const response: any = await api.createBet(game.id, 'THRESHOLD', config);
      if (!response.success) {
        const message = response.error?.message || 'Failed to create threshold bet.';
        setError(message);
      } else {
        onSuccess();
      }
    } catch (e: any) {
      const message = e.message || 'Failed to create threshold bet.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const buildPreviewSubjectName = (
    subjectType: SubjectType,
    team: 'home' | 'away' | '',
    playerId: string,
    fallback: string
  ) => {
    if (subjectType === 'TEAM') {
      if (team === 'home') return game.homeTeam;
      if (team === 'away') return game.awayTeam;
      return fallback;
    }
    const p = playersHome.concat(playersAway).find((pl) => String(pl.id) === String(playerId));
    return p?.displayName || p?.fullName || fallback;
  };

  const generatePreview = () => {
    const participant = {
      subject_name: buildPreviewSubjectName(subjectType, team, player, subjectType === 'TEAM' ? 'Team' : 'Player'),
      metric,
      time_period: timePeriod,
    };

    if (!participant.subject_name || !participant.metric) {
      return 'Complete the form to see preview';
    }

    const thresholdValue = parseFloat(threshold) || 0;
    const metricLabel = formatMetricLabel(participant.metric);
    const period = participant.time_period !== 'FULL_GAME' ? ` (${formatTimePeriodLabel(participant.time_period)})` : '';

    return `${participant.subject_name} ${operator} ${thresholdValue} ${metricLabel}${period}`;
  };

  return (
    <View className={`rounded-3xl border px-4 py-4 mb-5 space-y-4 ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200 shadow-lg shadow-slate-900/10'} dark:shadow-none`}>
      <Text className={`text-xs font-medium ${isDark ? 'text-slate-400' : 'text-slate-800'}`}>Threshold bet</Text>

      {error && (
        <View className="bg-red-900/40 border border-red-500/70 rounded-2xl px-4 py-3">
          <Text className="text-red-200 text-xs text-center">{error}</Text>
        </View>
      )}

      <ParticipantSelector
        label="Participant"
        game={game}
        subjectType={subjectType}
        setSubjectType={setSubjectType}
        team={team}
        setTeam={setTeam}
        player={player}
        setPlayer={setPlayer}
        metric={metric}
        setMetric={setMetric}
        timePeriod={timePeriod}
        setTimePeriod={setTimePeriod}
        playersHome={playersHome}
        playersAway={playersAway}
        rosterLoading={rosterLoading}
      />

      <View className={`rounded-2xl px-3 py-3 ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
        <Text className={`text-[11px] font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Operator & Threshold</Text>
        <View className="flex-row items-center mb-3">
          <View className={`flex-row rounded-full p-1 mr-2 ${isDark ? 'bg-slate-900' : 'bg-slate-100'}`}>
            <TouchableOpacity
              onPress={() => setOperator('OVER')}
              className={`px-3 py-1 rounded-full ${operator === 'OVER' ? (isDark ? 'bg-slate-100' : 'bg-orange-600') : 'bg-transparent'}`}
            >
              <Text className={`text-[11px] font-medium ${operator === 'OVER' ? (isDark ? 'text-slate-900' : 'text-white') : (isDark ? 'text-slate-300' : 'text-slate-700')}`}>
                Over
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setOperator('UNDER')}
              className={`px-3 py-1 rounded-full ${operator === 'UNDER' ? (isDark ? 'bg-slate-100' : 'bg-orange-600') : 'bg-transparent'}`}
            >
              <Text className={`text-[11px] font-medium ${operator === 'UNDER' ? (isDark ? 'text-slate-900' : 'text-white') : (isDark ? 'text-slate-300' : 'text-slate-700')}`}>
                Under
              </Text>
            </TouchableOpacity>
          </View>
          <TextInput
            className={`flex-1 rounded-full px-4 py-2 text-xs ${isDark ? 'bg-[#141626] text-white' : 'bg-slate-100 text-slate-900'}`}
            placeholder="28.5"
            placeholderTextColor="#6b7280"
            keyboardType="numeric"
            value={threshold}
            onChangeText={setThreshold}
          />
        </View>
      </View>

      <View className={`mt-2 rounded-2xl px-3 py-3 ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
        <Text className={`text-[11px] mb-1 ${isDark ? 'text-slate-400' : 'text-slate-800'}`}>Preview</Text>
        <Text className={`text-xs font-medium ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{generatePreview()}</Text>
      </View>

      <View className="mt-3 items-end">
        <TouchableOpacity
          onPress={handleCreate}
          disabled={loading}
          className={`px-4 py-2 rounded-full ${loading ? (isDark ? 'bg-slate-700' : 'bg-slate-300') : 'bg-blue-600'} flex-row items-center justify-center`}
        >
          {loading && <ActivityIndicator size="small" color="#e5e7eb" className="mr-2" />}
          <Text className="text-white text-xs font-semibold">{loading ? 'Creating…' : 'Create threshold bet'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

