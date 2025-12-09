import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Parlay, ParlaySelection } from '../../interfaces/parlay';
import { LockTimer } from '../common/LockTimer';

interface ParlayCardProps {
  parlay: Parlay;
  onOpen: (parlay: Parlay) => void;
  onDelete: (parlayId: string) => void;
  deletingId: string | null;
  onSelectionPress?: (selection: ParlaySelection) => void;
  hideLockIcon?: boolean;
  initiallyExpanded?: boolean;
  collapsible?: boolean;
}

// Returns labels for both sides of a bet + optional context
function getBetSideLabels(selection: ParlaySelection): {
  side1: { value: string; label: string };
  side2: { value: string; label: string };
  context?: string;
} {
  const { bet, game } = selection;
  const config = bet.config;

  if (!config) {
    return {
      side1: { value: 'participant_1', label: 'Side 1' },
      side2: { value: 'participant_2', label: 'Side 2' },
    };
  }

  if (bet.betType === 'COMPARISON') {
    const compConfig = config as any;
    const participant1 = compConfig.participant_1;
    const participant2 = compConfig.participant_2;
    const isTeamVsTeam = participant1?.subject_type === 'TEAM' && participant2?.subject_type === 'TEAM';

    let name1 = participant1?.subject_name || 'Participant 1';
    let name2 = participant2?.subject_name || 'Participant 2';

    // For teams, try to get actual team name from game data
    if (participant1?.subject_type === 'TEAM' && game) {
      const metadata = game.metadata;
      const apiData = metadata?.apiData;
      if (apiData?.teams?.home?.id === participant1.subject_id) {
        name1 = game.homeTeam;
      } else if (apiData?.teams?.away?.id === participant1.subject_id) {
        name1 = game.awayTeam;
      }
    }

    if (participant2?.subject_type === 'TEAM' && game) {
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
    const threshConfig = config as any;
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

function getSportEmoji(sport?: string): string {
  if (!sport) return '🎮';
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

export function ParlayCard({ 
  parlay, 
  onOpen, 
  onDelete, 
  deletingId, 
  onSelectionPress, 
  hideLockIcon = false,
  initiallyExpanded = false,
  collapsible = true
}: ParlayCardProps) {
  const [isExpanded, setIsExpanded] = useState(initiallyExpanded);
  
  const isLocked = parlay.lockedAt !== null && parlay.lockedAt !== undefined;
  const canModify = !isLocked && parlay.status === 'building';
  
  const getParlayOutcome = () => {
    if (parlay.status === 'won') return 'win';
    if (parlay.status === 'lost') return 'loss';
    if (parlay.status === 'push') return 'push';
    return null;
  };
  
  const parlayOutcome = getParlayOutcome();

  // Find the earliest game start time (parlay locks when first game starts)
  const earliestGame = parlay.selections.reduce((earliest, selection) => {
    if (!earliest) return selection;
    const currentStart = new Date(selection.game.startTime).getTime();
    const earliestStart = new Date(earliest.game.startTime).getTime();
    return currentStart < earliestStart ? selection : earliest;
  }, parlay.selections[0]);

  const earliestStartTime = earliestGame?.game.startTime;
  const earliestGameStatus = earliestGame?.game.status || 'scheduled';

  // Get sport emojis for display
  const sportEmojis = parlay.selections
    .map(s => getSportEmoji(s.game.sport))
    .join('');

  // Get first pick preview
  const firstSelection = parlay.selections[0];
  const firstSideLabels = firstSelection ? getBetSideLabels(firstSelection) : null;
  const firstPick = firstSelection && firstSideLabels
    ? (firstSelection.selectedSide === firstSideLabels.side1.value 
        ? firstSideLabels.side1.label 
        : firstSideLabels.side2.label)
    : '';

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
        onPress={() => collapsible && setIsExpanded(!isExpanded)}
        activeOpacity={collapsible ? 0.8 : 1}
        style={{ padding: 16 }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
            <View style={{ backgroundColor: '#2563eb', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 }}>
              <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 13 }}>
                {parlay.betCount} Leg
              </Text>
            </View>
            <Text style={{ fontSize: 14 }}>{sportEmojis}</Text>
            <Text style={{ color: '#94a3b8', fontSize: 13, flex: 1 }} numberOfLines={1}>
              {firstPick}{parlay.betCount > 1 ? '...' : ''}
            </Text>
          </View>
          
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {!isLocked && earliestStartTime && (
              <LockTimer startTime={earliestStartTime} status={earliestGameStatus} />
            )}
            {isLocked && !hideLockIcon && <Text style={{ fontSize: 14 }}>🔒</Text>}
            <Text style={{ color: '#fb923c', fontWeight: 'bold', fontSize: 18 }}>
              +{parlay.insured && parlay.insuranceCost ? parlay.parlayValue - parlay.insuranceCost : parlay.parlayValue}
            </Text>
            {parlay.insured && (
              <View style={{ backgroundColor: 'rgba(251, 146, 60, 0.2)', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 4 }}>
                <Text style={{ color: '#fb923c', fontSize: 10, fontWeight: '600' }}>INS</Text>
              </View>
            )}
            {parlayOutcome && (
              <View style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: parlayOutcome === 'win' ? 'rgba(16, 185, 129, 0.2)' : parlayOutcome === 'loss' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(250, 204, 21, 0.2)' }}>
                <Text style={{ fontSize: 11, fontWeight: 'bold', color: parlayOutcome === 'win' ? '#34d399' : parlayOutcome === 'loss' ? '#f87171' : '#fbbf24' }}>{parlayOutcome.toUpperCase()}</Text>
              </View>
            )}
            {collapsible && (
              <Ionicons 
                name={isExpanded ? 'chevron-up' : 'chevron-down'} 
                size={20} 
                color="#64748b" 
              />
            )}
          </View>
        </View>
      </TouchableOpacity>

      {/* Expanded content */}
      {isExpanded && (
        <View style={{ paddingHorizontal: 16, paddingBottom: 16, borderTopWidth: 1, borderTopColor: '#1e293b' }}>
          {/* Selections - simple list showing pick and context */}
          <View style={{ gap: 8, marginTop: 12 }}>
            {parlay.selections.map((selection) => {
              const sideLabels = getBetSideLabels(selection);
              const isSelected1 = selection.selectedSide === sideLabels.side1.value;
              const selectedLabel = isSelected1 ? sideLabels.side1.label : sideLabels.side2.label;
              
              const SelectionWrapper = onSelectionPress ? TouchableOpacity : View;

              return (
                <SelectionWrapper 
                  key={selection.id} 
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 }}
                  onPress={onSelectionPress ? () => onSelectionPress(selection) : undefined}
                >
                  <Text style={{ fontSize: 16 }}>{getSportEmoji(selection.game.sport)}</Text>
                  <View style={{ flex: 1 }}>
                    {/* Context/bet name */}
                    {sideLabels.context && (
                      <Text style={{ color: '#94a3b8', fontSize: 11 }} numberOfLines={1}>
                        {sideLabels.context}
                      </Text>
                    )}
                    {!sideLabels.context && (
                      <Text style={{ color: '#94a3b8', fontSize: 11 }} numberOfLines={1}>
                        {selection.game.awayTeam} @ {selection.game.homeTeam}
                      </Text>
                    )}
                    {/* Selected pick */}
                    <Text style={{ color: '#fb923c', fontSize: 13, fontWeight: '600' }} numberOfLines={1}>
                      {selectedLabel}
                    </Text>
                  </View>
                  {selection.outcome && selection.outcome !== 'pending' && (
                    <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, backgroundColor: selection.outcome === 'win' ? 'rgba(16, 185, 129, 0.2)' : selection.outcome === 'loss' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(250, 204, 21, 0.2)' }}>
                      <Text style={{ fontSize: 10, fontWeight: 'bold', color: selection.outcome === 'win' ? '#34d399' : selection.outcome === 'loss' ? '#f87171' : '#fbbf24' }}>
                        {selection.outcome.toUpperCase()}
                      </Text>
                    </View>
                  )}
                </SelectionWrapper>
              );
            })}
          </View>

          {/* Actions */}
          {canModify && (
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
              <TouchableOpacity 
                onPress={() => onOpen(parlay)} 
                style={{ flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center', backgroundColor: '#2563eb' }}
              >
                <Text style={{ color: '#fff', fontWeight: '600', fontSize: 15 }}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={() => onDelete(parlay.id)} 
                disabled={deletingId === parlay.id} 
                style={{ flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(127, 29, 29, 0.3)', borderWidth: 1, borderColor: 'rgba(127, 29, 29, 0.5)' }}
              >
                {deletingId === parlay.id ? (
                  <ActivityIndicator size="small" color="#f87171" />
                ) : (
                  <Text style={{ color: '#f87171', fontWeight: '600', fontSize: 15 }}>Delete</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}
    </View>
  );
}
