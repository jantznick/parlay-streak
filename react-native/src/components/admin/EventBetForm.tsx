import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import type { TimePeriod } from '@shared/types/bets';
import { api } from '../../services/api';
import type { Game, Player, SubjectType } from './types';
import { ParticipantSelector } from './ParticipantSelector';

interface EventBetFormProps {
  game: Game;
  playersHome: Player[];
  playersAway: Player[];
  rosterLoading: boolean;
  onSuccess: () => void;
}

export function EventBetForm({
  game,
  playersHome,
  playersAway,
  rosterLoading,
  onSuccess,
}: EventBetFormProps) {
  const [subjectType, setSubjectType] = useState<SubjectType>('PLAYER');
  const [team, setTeam] = useState<'home' | 'away' | ''>('home');
  const [player, setPlayer] = useState<string>('');
  const [metric, setMetric] = useState<string>('points');
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('FULL_GAME');
  const [eventType, setEventType] = useState<'DOUBLE_DOUBLE' | 'TRIPLE_DOUBLE'>('DOUBLE_DOUBLE');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        type: 'EVENT' as const,
        participant,
        event_type: eventType,
        time_period: timePeriod,
      };

      const response: any = await api.createBet(game.id, 'EVENT', config);
      if (!response.success) {
        const message = response.error?.message || 'Failed to create event bet.';
        setError(message);
      } else {
        onSuccess();
      }
    } catch (e: any) {
      const message = e.message || 'Failed to create event bet.';
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
      time_period: timePeriod,
    };

    if (!participant.subject_name) {
      return 'Complete the form to see preview';
    }

    const eventTypeLabel = eventType === 'DOUBLE_DOUBLE' ? 'Double Double' : 'Triple Double';
    const period = participant.time_period !== 'FULL_GAME' ? ` (${formatTimePeriodLabel(participant.time_period)})` : '';

    return `${participant.subject_name} ${eventTypeLabel}${period}`;
  };

  return (
    <View className="bg-slate-900 rounded-3xl border border-slate-700 px-4 py-4 mb-5 space-y-4">
      <Text className="text-xs font-medium text-slate-400">Event bet</Text>

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

      <View className="bg-slate-800 rounded-2xl px-3 py-3">
        <Text className="text-[11px] font-medium text-slate-300 mb-2">Event Type</Text>
        <View className="flex-row bg-slate-900 rounded-full p-1">
          <TouchableOpacity
            onPress={() => setEventType('DOUBLE_DOUBLE')}
            className={`flex-1 rounded-full px-3 py-1 items-center ${eventType === 'DOUBLE_DOUBLE' ? 'bg-slate-100' : 'bg-transparent'}`}
          >
            <Text className={`text-[11px] font-medium ${eventType === 'DOUBLE_DOUBLE' ? 'text-slate-900' : 'text-slate-300'}`}>
              Double Double
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setEventType('TRIPLE_DOUBLE')}
            className={`flex-1 rounded-full px-3 py-1 items-center ${eventType === 'TRIPLE_DOUBLE' ? 'bg-slate-100' : 'bg-transparent'}`}
          >
            <Text className={`text-[11px] font-medium ${eventType === 'TRIPLE_DOUBLE' ? 'text-slate-900' : 'text-slate-300'}`}>
              Triple Double
            </Text>
          </TouchableOpacity>
        </View>
      </View>

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
          <Text className="text-white text-xs font-semibold">{loading ? 'Creating…' : 'Create event bet'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

