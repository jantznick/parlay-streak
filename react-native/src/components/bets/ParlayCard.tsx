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
}

function getSideDisplayLabel(selection: ParlaySelection): string {
  const { bet, selectedSide } = selection;
  const config = bet.config;

  if (bet.betType === 'COMPARISON') {
    const compConfig = config as any;
    const participant = selectedSide === 'participant_1' ? compConfig.participant_1 : compConfig.participant_2;
    let name = participant?.subject_name || 'Participant';
    
    if (compConfig.spread && selectedSide === 'participant_1') {
      const spreadValue = compConfig.spread.value;
      const spreadDir = compConfig.spread.direction;
      name = spreadDir === '+' ? name + ' +' + spreadValue : name + ' -' + spreadValue;
    }
    
    return name;
  } else if (bet.betType === 'THRESHOLD') {
    const threshConfig = config as any;
    const threshold = threshConfig.threshold || 0;
    return selectedSide === 'over' ? 'OVER ' + threshold : 'UNDER ' + threshold;
  } else if (bet.betType === 'EVENT') {
    return selectedSide === 'yes' ? 'YES' : 'NO';
  }
  
  return selectedSide;
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

export function ParlayCard({ parlay, onOpen, onDelete, deletingId }: ParlayCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  
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

  // Get team abbreviations for collapsed view
  const teamSummary = parlay.selections
    .map(s => s.game.homeTeam.slice(0, 3).toUpperCase())
    .join(', ');

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
            <View style={{ backgroundColor: '#2563eb', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 }}>
              <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 13 }}>
                {parlay.betCount} Leg
              </Text>
            </View>
            <Text style={{ color: '#94a3b8', fontSize: 13, flex: 1 }} numberOfLines={1}>
              {teamSummary}
            </Text>
          </View>
          
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {!isLocked && earliestStartTime && (
              <LockTimer startTime={earliestStartTime} status={earliestGameStatus} />
            )}
            {isLocked && <Text style={{ fontSize: 14 }}>🔒</Text>}
            {parlay.insured && (
              <View style={{ backgroundColor: 'rgba(251, 146, 60, 0.2)', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 4 }}>
                <Text style={{ color: '#fb923c', fontSize: 10, fontWeight: '600' }}>INS</Text>
              </View>
            )}
            <Text style={{ color: '#fb923c', fontWeight: 'bold', fontSize: 18 }}>+{parlay.parlayValue}</Text>
            {parlayOutcome && (
              <View style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: parlayOutcome === 'win' ? 'rgba(16, 185, 129, 0.2)' : parlayOutcome === 'loss' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(250, 204, 21, 0.2)' }}>
                <Text style={{ fontSize: 11, fontWeight: 'bold', color: parlayOutcome === 'win' ? '#34d399' : parlayOutcome === 'loss' ? '#f87171' : '#fbbf24' }}>{parlayOutcome.toUpperCase()}</Text>
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
          {/* Selections */}
          <View style={{ gap: 8, marginTop: 12 }}>
            {parlay.selections.map((selection, index) => (
              <View key={selection.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Text style={{ fontSize: 16 }}>{getSportEmoji(selection.game.sport)}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#94a3b8', fontSize: 12 }}>
                    {selection.game.awayTeam} @ {selection.game.homeTeam} • {formatTime(selection.game.startTime)}
                  </Text>
                  <Text style={{ color: '#fff', fontSize: 14, fontWeight: '500' }} numberOfLines={1}>
                    {getSideDisplayLabel(selection)}
                  </Text>
                </View>
                {selection.outcome && selection.outcome !== 'pending' && (
                  <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, backgroundColor: selection.outcome === 'win' ? 'rgba(16, 185, 129, 0.2)' : selection.outcome === 'loss' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(250, 204, 21, 0.2)' }}>
                    <Text style={{ fontSize: 11, fontWeight: 'bold', color: selection.outcome === 'win' ? '#34d399' : selection.outcome === 'loss' ? '#f87171' : '#fbbf24' }}>
                      {selection.outcome.toUpperCase()}
                    </Text>
                  </View>
                )}
              </View>
            ))}
          </View>

          {/* Actions */}
          {canModify && (
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
              <TouchableOpacity 
                onPress={() => onOpen(parlay)} 
                style={{ flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center', backgroundColor: '#2563eb' }}
              >
                <Text style={{ color: '#fff', fontWeight: '600', fontSize: 15 }}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={() => onDelete(parlay.id)} 
                disabled={deletingId === parlay.id} 
                style={{ width: 48, height: 48, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(127, 29, 29, 0.3)', borderWidth: 1, borderColor: 'rgba(127, 29, 29, 0.5)' }}
              >
                {deletingId === parlay.id ? (
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
