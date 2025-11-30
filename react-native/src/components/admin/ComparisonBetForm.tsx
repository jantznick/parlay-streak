import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, ActivityIndicator } from 'react-native';
import { BASKETBALL_CONFIG } from '@shared/config/sports/basketball';
import type { TimePeriod } from '@shared/types/bets';
import { api } from '../../services/api';
import type { Game, Player, SubjectType } from './types';
import { ParticipantSelector } from './ParticipantSelector';

interface ComparisonBetFormProps {
  game: Game;
  playersHome: Player[];
  playersAway: Player[];
  rosterLoading: boolean;
  onSuccess: () => void;
}

export function ComparisonBetForm({
  game,
  playersHome,
  playersAway,
  rosterLoading,
  onSuccess,
}: ComparisonBetFormProps) {
  const [subjectType1, setSubjectType1] = useState<SubjectType>('TEAM');
  const [team1, setTeam1] = useState<'home' | 'away' | ''>('home');
  const [player1, setPlayer1] = useState<string>('');
  const [metric1, setMetric1] = useState<string>('points');
  const [timePeriod1, setTimePeriod1] = useState<TimePeriod>('FULL_GAME');

  const [subjectType2, setSubjectType2] = useState<SubjectType>('TEAM');
  const [team2, setTeam2] = useState<'home' | 'away' | ''>('away');
  const [player2, setPlayer2] = useState<string>('');
  const [metric2, setMetric2] = useState<string>('points');
  const [timePeriod2, setTimePeriod2] = useState<TimePeriod>('FULL_GAME');

  const [compOperator, setCompOperator] = useState<'GREATER_THAN' | 'spread'>('GREATER_THAN');
  const [spreadDirection, setSpreadDirection] = useState<'+' | '-'>('+');
  const [spreadValue, setSpreadValue] = useState('3.5');

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

    const buildParticipant = (
      whichSubject: SubjectType,
      whichTeam: 'home' | 'away' | '',
      playerId: string,
      metric: string,
      timePeriod: TimePeriod,
      label: 'Participant 1' | 'Participant 2'
    ) => {
      if (whichSubject === 'TEAM') {
        if (whichTeam !== 'home' && whichTeam !== 'away') {
          throw new Error(`Select a team for ${label}.`);
        }
        return buildTeamParticipant(whichTeam, metric, timePeriod);
      }

      if (!playerId) {
        throw new Error(`Select a player for ${label}.`);
      }
      const player = findPlayer(playerId);
      if (!player) {
        throw new Error(`Could not find the selected player for ${label}.`);
      }

      const name = player.displayName || player.fullName || `Player ${playerId}`;

      return {
        subject_type: 'PLAYER' as const,
        subject_id: String(player.id),
        subject_name: name,
        metric,
        time_period: timePeriod,
      };
    };

    let participant_1;
    let participant_2;
    try {
      participant_1 = buildParticipant(subjectType1, team1, player1, metric1, timePeriod1, 'Participant 1');
      participant_2 = buildParticipant(subjectType2, team2, player2, metric2, timePeriod2, 'Participant 2');
    } catch (validationError: any) {
      setError(validationError.message || 'Invalid participant configuration.');
      return;
    }

    let spreadConfig: { direction: '+' | '-'; value: number } | undefined;
    if (compOperator === 'spread') {
      const val = parseFloat(spreadValue);
      if (Number.isNaN(val) || val <= 0) {
        setError('Enter a valid positive spread value (e.g. 3.5).');
        return;
      }
      spreadConfig = {
        direction: spreadDirection,
        value: val,
      };
    }

    const config: any = {
      type: 'COMPARISON',
      participant_1,
      participant_2,
      operator: 'GREATER_THAN',
      ...(spreadConfig && { spread: spreadConfig }),
    };

    try {
      setLoading(true);
      const response: any = await api.createBet(game.id, 'COMPARISON', config);
      if (!response.success) {
        const message = response.error?.message || 'Failed to create comparison bet.';
        setError(message);
      } else {
        onSuccess();
      }
    } catch (e: any) {
      const message = e.message || 'Failed to create comparison bet.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const buildPreviewSubjectName = (
    whichSubject: SubjectType,
    whichTeam: 'home' | 'away' | '',
    playerId: string,
    fallbackTeamLabel: string
  ) => {
    if (whichSubject === 'TEAM') {
      if (whichTeam === 'home') return game.homeTeam;
      if (whichTeam === 'away') return game.awayTeam;
      return fallbackTeamLabel;
    }
    if (!playerId) return whichSubject === 'PLAYER' ? fallbackTeamLabel : fallbackTeamLabel;
    const allPlayers = playersHome.concat(playersAway);
    const p = allPlayers.find((pl) => String(pl.id) === String(playerId));
    return p?.displayName || p?.fullName || fallbackTeamLabel;
  };

  const generatePreview = () => {
    const previewParticipant1 = {
      subject_name: buildPreviewSubjectName(subjectType1, team1, player1, subjectType1 === 'TEAM' ? 'Team 1' : 'Player 1'),
      metric: metric1,
      time_period: timePeriod1,
      subject_type: subjectType1,
    };

    const previewParticipant2 = {
      subject_name: buildPreviewSubjectName(subjectType2, team2, player2, subjectType2 === 'TEAM' ? 'Team 2' : 'Player 2'),
      metric: metric2,
      time_period: timePeriod2,
      subject_type: subjectType2,
    };

    if (!previewParticipant1.subject_name || !previewParticipant2.subject_name || !previewParticipant1.metric || !previewParticipant2.metric) {
      return 'Complete the form to see preview';
    }

    const spread = compOperator === 'spread' ? { direction: spreadDirection, value: parseFloat(spreadValue || '0') || 0 } : undefined;
    const participant_1: any = previewParticipant1;
    const participant_2: any = previewParticipant2;

    // Moneyline
    if (!spread && participant_1.metric === 'points' && participant_1.time_period === 'FULL_GAME' && participant_1.subject_type === 'TEAM' && participant_2.subject_type === 'TEAM' && participant_2.metric === 'points' && participant_2.time_period === 'FULL_GAME') {
      return `${participant_1.subject_name} ML`;
    }

    // Spread
    if (spread && participant_1.metric === 'points' && participant_1.time_period === 'FULL_GAME' && participant_1.subject_type === 'TEAM' && participant_2.subject_type === 'TEAM' && participant_2.metric === 'points' && participant_2.time_period === 'FULL_GAME') {
      return `${participant_1.subject_name} ${spread.direction}${spread.value}`;
    }

    // Generic comparison
    const metric1Label = formatMetricLabel(participant_1.metric);
    const metric2Label = formatMetricLabel(participant_2.metric);
    const period1 = participant_1.time_period !== 'FULL_GAME' ? ` (${formatTimePeriodLabel(participant_1.time_period)})` : '';
    const period2 = participant_2.time_period !== 'FULL_GAME' ? ` (${formatTimePeriodLabel(participant_2.time_period)})` : '';

    if (spread) {
      return `${participant_1.subject_name} ${metric1Label}${period1} ${spread.direction}${spread.value} > ${participant_2.subject_name} ${metric2Label}${period2}`;
    }

    return `${participant_1.subject_name} ${metric1Label}${period1} > ${participant_2.subject_name} ${metric2Label}${period2}`;
  };


  return (
    <View className="bg-slate-900 rounded-3xl border border-slate-700 px-4 py-4 mb-5 space-y-4">
      <Text className="text-xs font-medium text-slate-400">Comparison bet</Text>

      {error && (
        <View className="bg-red-900/40 border border-red-500/70 rounded-2xl px-4 py-3">
          <Text className="text-red-200 text-xs text-center">{error}</Text>
        </View>
      )}

      <ParticipantSelector
        label="Participant 1"
        game={game}
        subjectType={subjectType1}
        setSubjectType={setSubjectType1}
        team={team1}
        setTeam={setTeam1}
        player={player1}
        setPlayer={setPlayer1}
        metric={metric1}
        setMetric={setMetric1}
        timePeriod={timePeriod1}
        setTimePeriod={setTimePeriod1}
        playersHome={playersHome}
        playersAway={playersAway}
        rosterLoading={rosterLoading}
      />

      <View className="bg-slate-800 rounded-2xl px-3 py-3">
        <Text className="text-[11px] font-medium text-slate-300 mb-2">Operator</Text>
        <View className="flex-row bg-slate-900 rounded-full p-1 mb-3">
          <TouchableOpacity
            onPress={() => setCompOperator('GREATER_THAN')}
            className={`flex-1 rounded-full px-3 py-1 items-center ${compOperator === 'GREATER_THAN' ? 'bg-slate-100' : 'bg-transparent'}`}
          >
            <Text className={`text-[11px] font-medium ${compOperator === 'GREATER_THAN' ? 'text-slate-900' : 'text-slate-300'}`}>
              Greater than (&gt;)
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setCompOperator('spread')}
            className={`flex-1 rounded-full px-3 py-1 items-center ${compOperator === 'spread' ? 'bg-slate-100' : 'bg-transparent'}`}
          >
            <Text className={`text-[11px] font-medium ${compOperator === 'spread' ? 'text-slate-900' : 'text-slate-300'}`}>
              Spread (+/-)
            </Text>
          </TouchableOpacity>
        </View>

        {compOperator === 'spread' && (
          <View className="flex-row items-center">
            <View className="mr-2">
              <View className="flex-row bg-slate-900 rounded-full p-1">
                <TouchableOpacity
                  onPress={() => setSpreadDirection('+')}
                  className={`px-3 py-1 rounded-full ${spreadDirection === '+' ? 'bg-slate-100' : 'bg-transparent'}`}
                >
                  <Text className={`text-[11px] font-medium ${spreadDirection === '+' ? 'text-slate-900' : 'text-slate-300'}`}>
                    +
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setSpreadDirection('-')}
                  className={`px-3 py-1 rounded-full ${spreadDirection === '-' ? 'bg-slate-100' : 'bg-transparent'}`}
                >
                  <Text className={`text-[11px] font-medium ${spreadDirection === '-' ? 'text-slate-900' : 'text-slate-300'}`}>
                    -
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
            <TextInput
              className="flex-1 bg-[#141626] rounded-full px-4 py-2 text-xs text-white"
              placeholder="3.5"
              placeholderTextColor="#6b7280"
              keyboardType="numeric"
              value={spreadValue}
              onChangeText={setSpreadValue}
            />
          </View>
        )}
      </View>

      <ParticipantSelector
        label="Participant 2"
        game={game}
        subjectType={subjectType2}
        setSubjectType={setSubjectType2}
        team={team2}
        setTeam={setTeam2}
        player={player2}
        setPlayer={setPlayer2}
        metric={metric2}
        setMetric={setMetric2}
        timePeriod={timePeriod2}
        setTimePeriod={setTimePeriod2}
        playersHome={playersHome}
        playersAway={playersAway}
        rosterLoading={rosterLoading}
      />

      <View className="mt-2 bg-slate-800 rounded-2xl px-3 py-3">
        <Text className="text-[11px] text-slate-400 mb-1">Preview</Text>
        <Text className="text-xs text-slate-100 font-medium">{generatePreview()}</Text>
      </View>

      <View className="mt-3 items-end">
        <TouchableOpacity
          onPress={handleCreate}
          disabled={loading}
          className={`px-4 py-2 rounded-full ${loading ? 'bg-slate-700' : 'bg-blue-600'} flex-row items-center justify-center`}
        >
          {loading && <ActivityIndicator size="small" color="#e5e7eb" className="mr-2" />}
          <Text className="text-white text-xs font-semibold">{loading ? 'Creating…' : 'Create comparison bet'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

