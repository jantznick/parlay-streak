import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LockTimer } from '../common/LockTimer';
import { useParlay } from '../../context/ParlayContext';

interface BetSelection {
  id: string;
  betId: string;
  selectedSide: string;
  status: string;
  outcome?: string;
  bet: {
    id: string;
    displayText: string;
    betType: string;
    outcome: string;
    config?: any;
    game: {
      id: string;
      homeTeam: string;
      awayTeam: string;
      startTime: string;
      status: string;
      sport: string;
      homeScore?: number | null;
      awayScore?: number | null;
      metadata?: any;
    };
  };
}

interface SingleBetCardProps {
  selection: BetSelection;
  onDelete: (id: string) => void;
  onMakeParlay: (selection: BetSelection) => void;
  deletingId: string | null;
}

function getSportEmoji(sport: string): string {
  const emojiMap: Record<string, string> = {
    basketball: '🏀',
    football: '🏈',
    baseball: '⚾',
    hockey: '🏒',
    soccer: '⚽',
  };
  return emojiMap[sport.toLowerCase()] || '🎮';
}

function formatTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

// Returns labels for both sides of a bet + optional context
function getBetSideLabels(bet: any, game: any): {
  side1: { value: string; label: string };
  side2: { value: string; label: string };
  context?: string;
} {
  const config = bet.config;

  if (!config) {
    return {
      side1: { value: 'participant_1', label: 'Side 1' },
      side2: { value: 'participant_2', label: 'Side 2' },
    };
  }

  if (bet.betType === 'COMPARISON') {
    const compConfig = config;
    const participant1 = compConfig.participant_1;
    const participant2 = compConfig.participant_2;
    const isTeamVsTeam = participant1?.subject_type === 'TEAM' && participant2?.subject_type === 'TEAM';

    let name1 = participant1?.subject_name || 'Participant 1';
    let name2 = participant2?.subject_name || 'Participant 2';

    // For teams, try to get actual team name from game data
    if (participant1?.subject_type === 'TEAM') {
      const metadata = game.metadata;
      const apiData = metadata?.apiData;
      if (apiData?.teams?.home?.id === participant1.subject_id) {
        name1 = game.homeTeam;
      } else if (apiData?.teams?.away?.id === participant1.subject_id) {
        name1 = game.awayTeam;
      }
    }

    if (participant2?.subject_type === 'TEAM') {
      const metadata = game.metadata;
      const apiData = metadata?.apiData;
      if (apiData?.teams?.home?.id === participant2.subject_id) {
        name2 = game.homeTeam;
      } else if (apiData?.teams?.away?.id === participant2.subject_id) {
        name2 = game.awayTeam;
      }
    }

    // For non-team-vs-team, add metric and time period to labels
    if (!isTeamVsTeam) {
      if (participant1?.metric) {
        const timePeriod = participant1.time_period && participant1.time_period !== 'FULL_GAME'
          ? ` (${participant1.time_period})`
          : '';
        name1 = `${name1} - ${participant1.metric}${timePeriod}`;
      }
      if (participant2?.metric) {
        const timePeriod = participant2.time_period && participant2.time_period !== 'FULL_GAME'
          ? ` (${participant2.time_period})`
          : '';
        name2 = `${name2} - ${participant2.metric}${timePeriod}`;
      }
    }

    // Add spread if applicable (only for participant_1)
    if (compConfig.spread) {
      const spreadValue = compConfig.spread.value;
      const spreadDir = compConfig.spread.direction;
      name1 = spreadDir === '+' ? `${name1} +${spreadValue}` : `${name1} -${spreadValue}`;
    }

    return {
      side1: { value: 'participant_1', label: name1 },
      side2: { value: 'participant_2', label: name2 },
    };

  } else if (bet.betType === 'THRESHOLD') {
    const threshConfig = config;
    const threshold = threshConfig.threshold || 0;
    const participant = threshConfig.participant;

    let context = '';
    if (participant) {
      const subjectName = participant.subject_name || '';
      const metric = participant.metric || '';
      const timePeriod = participant.time_period && participant.time_period !== 'FULL_GAME'
        ? ` (${participant.time_period})`
        : '';
      context = `${subjectName} ${metric}${timePeriod}`.trim();
    }

    return {
      side1: { value: 'over', label: `OVER ${threshold}` },
      side2: { value: 'under', label: `UNDER ${threshold}` },
      context: context || undefined,
    };

  } else if (bet.betType === 'EVENT') {
    return {
      side1: { value: 'yes', label: 'YES' },
      side2: { value: 'no', label: 'NO' },
      context: bet.displayText || undefined,
    };
  }

  return {
    side1: { value: 'participant_1', label: 'Side 1' },
    side2: { value: 'participant_2', label: 'Side 2' },
  };
}

export function SingleBetCard({ selection, onDelete, onMakeParlay, deletingId }: SingleBetCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { isParlayBuilderOpen } = useParlay();

  const game = selection.bet.game;
  const sideLabels = getBetSideLabels(selection.bet, game);
  const canModify = selection.status !== 'locked' && game.status === 'scheduled';

  const isSelected1 = selection.selectedSide === sideLabels.side1.value;
  const isSelected2 = selection.selectedSide === sideLabels.side2.value;

  return (
    <View
      style={{
        backgroundColor: '#0f172a',
        borderWidth: 1,
        borderColor: '#1e293b',
        borderRadius: 16,
        overflow: 'hidden',
      }}
    >
      {/* Header - always visible, tap to expand */}
      <TouchableOpacity
        onPress={() => setIsExpanded(!isExpanded)}
        activeOpacity={0.8}
        style={{ padding: 16 }}
      >
        {/* Top row: emoji, context/pick, lock timer, chevron */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, marginRight: 8 }}>
            <Text style={{ fontSize: 18 }}>{getSportEmoji(game.sport)}</Text>
            {/* Show context as main text if exists, otherwise show selected pick */}
            <Text style={{ color: '#fff', fontSize: 15, fontWeight: '600', flex: 1 }} numberOfLines={1}>
              {sideLabels.context || (isSelected1 ? sideLabels.side1.label : sideLabels.side2.label)}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            {!canModify && game.status !== 'scheduled' && (
              <Text style={{ fontSize: 14 }}>🔒</Text>
            )}
            {canModify && (
              <LockTimer startTime={game.startTime} status={game.status} />
            )}
            {selection.outcome && selection.outcome !== 'pending' && (
              <View
                style={{
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                  borderRadius: 6,
                  backgroundColor:
                    selection.outcome === 'win'
                      ? 'rgba(16, 185, 129, 0.2)'
                      : selection.outcome === 'loss'
                      ? 'rgba(239, 68, 68, 0.2)'
                      : 'rgba(250, 204, 21, 0.2)',
                }}
              >
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: 'bold',
                    color:
                      selection.outcome === 'win'
                        ? '#34d399'
                        : selection.outcome === 'loss'
                        ? '#f87171'
                        : '#fbbf24',
                  }}
                >
                  {selection.outcome.toUpperCase()}
                </Text>
              </View>
            )}
            <Ionicons
              name={isExpanded ? 'chevron-up' : 'chevron-down'}
              size={20}
              color="#64748b"
            />
          </View>
        </View>
      </TouchableOpacity>

      {/* Expanded content */}
      {isExpanded && (
        <View style={{ paddingHorizontal: 16, paddingBottom: 16, borderTopWidth: 1, borderTopColor: '#1e293b' }}>
          {/* Game info row */}
          <View style={{ marginTop: 12, marginBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ color: '#94a3b8', fontSize: 12, flex: 1 }} numberOfLines={1}>
              {game.awayTeam} @ {game.homeTeam}
            </Text>
            <Text style={{ color: '#64748b', fontSize: 12 }}>
              {formatTime(game.startTime)}
              {game.status === 'completed' && game.homeScore !== null && game.awayScore !== null && (
                ` • ${game.awayScore}-${game.homeScore}`
              )}
            </Text>
          </View>

          {/* Selection buttons - both shown, selected one highlighted */}
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
            <View
              style={{
                flex: 1,
                paddingHorizontal: 12,
                paddingVertical: 10,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: isSelected1 ? '#f97316' : '#334155',
                backgroundColor: isSelected1 ? 'rgba(249, 115, 22, 0.15)' : '#0f172a',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: '600',
                  color: isSelected1 ? '#fb923c' : '#64748b',
                  textAlign: 'center',
                }}
                numberOfLines={2}
              >
                {sideLabels.side1.label}
              </Text>
            </View>
            <View
              style={{
                flex: 1,
                paddingHorizontal: 12,
                paddingVertical: 10,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: isSelected2 ? '#f97316' : '#334155',
                backgroundColor: isSelected2 ? 'rgba(249, 115, 22, 0.15)' : '#0f172a',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: '600',
                  color: isSelected2 ? '#fb923c' : '#64748b',
                  textAlign: 'center',
                }}
                numberOfLines={2}
              >
                {sideLabels.side2.label}
              </Text>
            </View>
          </View>

          {/* Actions */}
          {canModify && (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity
                onPress={() => onMakeParlay(selection)}
                style={{
                  flex: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  paddingVertical: 12,
                  borderRadius: 10,
                  backgroundColor: '#2563eb',
                }}
              >
                <Text style={{ color: '#fff', fontWeight: '600', fontSize: 14 }}>
                  {isParlayBuilderOpen ? 'Add to Parlay' : 'Convert to Parlay'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => onDelete(selection.id)}
                disabled={deletingId === selection.id}
                style={{
                  flex: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  paddingVertical: 12,
                  borderRadius: 10,
                  backgroundColor: 'rgba(127, 29, 29, 0.3)',
                  borderWidth: 1,
                  borderColor: 'rgba(127, 29, 29, 0.5)',
                }}
              >
                {deletingId === selection.id ? (
                  <ActivityIndicator size="small" color="#f87171" />
                ) : (
                  <>
                    <Ionicons name="trash-outline" size={18} color="#f87171" />
                    <Text style={{ color: '#f87171', fontWeight: '600', fontSize: 14 }}>Delete</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}
    </View>
  );
}
