import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LockTimer } from '../common/LockTimer';

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

function getBetSideLabels(bet: any, game: any): { side1: { label: string }; side2: { label: string } } {
  const config = bet.config;
  if (!config) {
    return { side1: { label: 'Side 1' }, side2: { label: 'Side 2' } };
  }
  if (bet.betType === 'COMPARISON') {
    const compConfig = config;
    const participant1 = compConfig.participant_1;
    const participant2 = compConfig.participant_2;
    let name1 = participant1?.subject_name || 'Participant 1';
    let name2 = participant2?.subject_name || 'Participant 2';
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
    if (compConfig.spread) {
      const spreadValue = compConfig.spread.value;
      const spreadDir = compConfig.spread.direction;
      if (spreadDir === '+') {
        name1 = `${name1} +${spreadValue}`;
      } else {
        name1 = `${name1} -${spreadValue}`;
      }
    }
    return {
      side1: { label: name1 },
      side2: { label: name2 },
    };
  } else if (bet.betType === 'THRESHOLD') {
    const threshConfig = config;
    const threshold = threshConfig.threshold || 0;
    return {
      side1: { label: `OVER ${threshold}` },
      side2: { label: `UNDER ${threshold}` },
    };
  } else if (bet.betType === 'EVENT') {
    return {
      side1: { label: 'YES' },
      side2: { label: 'NO' },
    };
  }
  return { side1: { label: 'Side 1' }, side2: { label: 'Side 2' } };
}

export function SingleBetCard({ selection, onDelete, onMakeParlay, deletingId }: SingleBetCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const game = selection.bet.game;
  const sideLabels = getBetSideLabels(selection.bet, game);
  const selectedLabel =
    selection.selectedSide === 'participant_1' || selection.selectedSide === 'over' || selection.selectedSide === 'yes'
      ? sideLabels.side1.label
      : sideLabels.side2.label;

  const canModify = selection.status !== 'locked' && game.status === 'scheduled';

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
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
            <Text style={{ fontSize: 20 }}>{getSportEmoji(game.sport)}</Text>
            <Text style={{ color: '#fff', fontSize: 15, fontWeight: '600', flex: 1 }} numberOfLines={1}>
              {selectedLabel}
            </Text>
          </View>
          
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
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
          {/* Game details */}
          <View style={{ marginTop: 12 }}>
            <Text style={{ color: '#94a3b8', fontSize: 13 }}>
              {game.awayTeam} @ {game.homeTeam}
            </Text>
            <Text style={{ color: '#64748b', fontSize: 12, marginTop: 2 }}>
              {formatTime(game.startTime)}
            </Text>
          </View>

          {/* Final score if completed */}
          {game.status === 'completed' && game.homeScore !== null && game.awayScore !== null && (
            <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#1e293b', flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: '#64748b', fontSize: 12 }}>Final Score</Text>
              <Text style={{ color: '#94a3b8', fontSize: 12, fontWeight: '500' }}>
                {game.awayTeam} {game.awayScore} - {game.homeScore} {game.homeTeam}
              </Text>
            </View>
          )}

          {/* Actions */}
          {canModify && (
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
              <TouchableOpacity
                onPress={() => onMakeParlay(selection)}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  borderRadius: 10,
                  alignItems: 'center',
                  backgroundColor: '#2563eb',
                }}
              >
                <Text style={{ color: '#fff', fontWeight: '600', fontSize: 15 }}>Parlay</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => onDelete(selection.id)}
                disabled={deletingId === selection.id}
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 10,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: 'rgba(127, 29, 29, 0.3)',
                  borderWidth: 1,
                  borderColor: 'rgba(127, 29, 29, 0.5)',
                }}
              >
                {deletingId === selection.id ? (
                  <ActivityIndicator size="small" color="#f87171" />
                ) : (
                  <Ionicons name="trash-outline" size={20} color="#f87171" />
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

