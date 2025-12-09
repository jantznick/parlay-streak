import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LockTimer } from '../common/LockTimer';
import { useParlay } from '../../context/ParlayContext';
import { useTheme } from '../../context/ThemeContext';
import { BetSelection } from '../../interfaces/bet';
import { openEspnGame } from '../../utils/espn';

interface SingleBetCardProps {
  selection: BetSelection;
  onDelete: (id: string) => void;
  onMakeParlay: (selection: BetSelection) => void;
  deletingId: string | null;
  collapsible?: boolean;
  onPress?: () => void;
  initiallyExpanded?: boolean;
  hideLockIcon?: boolean;
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

export function SingleBetCard({ 
  selection, 
  onDelete, 
  onMakeParlay, 
  deletingId,
  collapsible = true,
  onPress,
  initiallyExpanded = false,
  hideLockIcon = false
}: SingleBetCardProps) {
  const [isExpanded, setIsExpanded] = useState(initiallyExpanded);
  const { isParlayBuilderOpen } = useParlay();
  const { effectiveTheme } = useTheme();
  const isDark = effectiveTheme === 'dark';
  
  // Use selection.game if available, otherwise try selection.bet.game (legacy fallback)
  const game = selection.game || (selection.bet as any).game;
  
  if (!game) {
    console.warn('SingleBetCard: Game data missing for selection', selection.id);
    return null;
  }

  const sideLabels = getBetSideLabels(selection.bet, game);
  // Ensure we have valid strings for status checks
  const selectionStatus = selection.status || 'selected';
  const gameStatus = game.status || 'scheduled';
  
  const canModify = selectionStatus !== 'locked' && gameStatus === 'scheduled';

  const isSelected1 = selection.selectedSide === sideLabels.side1.value;
  const isSelected2 = selection.selectedSide === sideLabels.side2.value;

  return (
    <View
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-lg shadow-slate-900/10"
    >
      {/* Header - always visible, tap to expand */}
      <TouchableOpacity
        onPress={() => {
          if (!collapsible && onPress) {
            onPress();
          } else if (collapsible) {
            setIsExpanded(!isExpanded);
          }
        }}
        activeOpacity={0.8}
        style={{ padding: 16 }}
      >
        {/* Top row: emoji, context/pick, lock timer, chevron */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, marginRight: 8 }}>
            <Text style={{ fontSize: 18 }}>{getSportEmoji(game.sport)}</Text>
            {/* Show context as main text if exists, otherwise show selected pick */}
            <Text className="text-slate-800 dark:text-white text-base font-bold flex-1" numberOfLines={1}>
              {sideLabels.context ? (
                <>
                  {sideLabels.context} • <Text style={{ color: '#fb923c' }}>{isSelected1 ? sideLabels.side1.label : sideLabels.side2.label}</Text>
                </>
              ) : (
                <Text style={{ color: '#fb923c' }}>{isSelected1 ? sideLabels.side1.label : sideLabels.side2.label}</Text>
              )}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            {!canModify && gameStatus !== 'scheduled' && !hideLockIcon && (
              <Text style={{ fontSize: 14 }}>🔒</Text>
            )}
            {canModify && (
              <LockTimer startTime={game.startTime} status={gameStatus} />
            )}
            {selection.outcome && selection.outcome !== 'pending' && (
              <>
                {game.externalId && (
                  <TouchableOpacity 
                    onPress={() => openEspnGame(game.sport, game.externalId)} 
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Image 
                      source={require('../../../assets/images/espn.png')}
                      style={{ width: 20, height: 20 }}
                      resizeMode="contain"
                    />
                  </TouchableOpacity>
                )}
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
              </>
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
        <View className="px-4 pb-4 border-t border-slate-200 dark:border-slate-800">
          {/* Read-Only Tabular View */}
          {!canModify && (
            <View className="bg-slate-100 dark:bg-slate-800/50 rounded-xl p-3 mt-4 gap-2.5">
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text className="text-slate-500 dark:text-slate-400 text-sm w-20">Matchup</Text>
                <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 8 }}>
                    <Text className="text-slate-700 dark:text-white text-sm text-right">{game.awayTeam} @ {game.homeTeam}</Text>
                </View>
              </View>

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text className="text-slate-500 dark:text-slate-400 text-sm w-20">Time</Text>
                <Text className="text-slate-600 dark:text-slate-300 text-sm text-right">
                  {formatTime(game.startTime)}
                  {game.status === 'completed' && game.homeScore !== null && game.awayScore !== null && (
                    ` • ${game.awayScore}-${game.homeScore}`
                  )}
                </Text>
              </View>
              
              <View className="h-px bg-slate-200 dark:bg-slate-700/50" />

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Text className="text-slate-500 dark:text-slate-400 text-sm w-20">Selection</Text>
                <View style={{ flex: 1, alignItems: 'flex-end' }}>
                   {sideLabels.context && <Text className="text-slate-700 dark:text-e2e8f0 text-sm text-right mb-0.5">{sideLabels.context}</Text>}
                   <Text className="text-orange-600 dark:text-orange-400 text-base font-bold text-right">
                     {isSelected1 ? sideLabels.side1.label : sideLabels.side2.label}
                   </Text>
                </View>
              </View>

              {selection.outcome && selection.outcome !== 'pending' && (
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text className="text-slate-500 dark:text-slate-400 text-sm w-20">Result</Text>
                  <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, backgroundColor: selection.outcome === 'win' ? 'rgba(16, 185, 129, 0.2)' : selection.outcome === 'loss' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(250, 204, 21, 0.2)' }}>
                    <Text style={{ fontSize: 11, fontWeight: 'bold', color: selection.outcome === 'win' ? '#34d399' : selection.outcome === 'loss' ? '#f87171' : '#fbbf24' }}>
                        {selection.outcome.toUpperCase()}
                    </Text>
                  </View>
                </View>
              )}
            </View>
          )}

          {/* Active Bet Content */}
          {canModify && (
            <>
              {/* Game info row */}
              <View style={{ marginTop: 12, marginBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text className="text-slate-500 dark:text-slate-400 text-xs flex-1" numberOfLines={1}>
                  {game.awayTeam} @ {game.homeTeam}
                </Text>
                <Text className="text-slate-500 dark:text-slate-500 text-xs">
                  {formatTime(game.startTime)}
                  {game.status === 'completed' && game.homeScore !== null && game.awayScore !== null && (
                    ` • ${game.awayScore}-${game.homeScore}`
                  )}
                </Text>
              </View>

              {/* Selection buttons - both shown, selected one highlighted */}
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                <View
                  className={`flex-1 p-2.5 rounded-xl border ${
                    isSelected1 
                      ? 'border-orange-500 bg-orange-500/10' 
                      : 'border-slate-200 bg-slate-100/30 dark:border-slate-700 dark:bg-slate-800'
                  } items-center justify-center`}
                >
                  <Text
                    className={`text-sm font-semibold text-center ${
                      isSelected1
                        ? 'text-orange-600 dark:text-orange-400'
                        : 'text-slate-500 dark:text-slate-400'
                    }`}
                    numberOfLines={2}
                  >
                    {sideLabels.side1.label}
                  </Text>
                </View>
                <View
                  className={`flex-1 p-2.5 rounded-xl border ${
                    isSelected2 
                      ? 'border-orange-500 bg-orange-500/10' 
                      : 'border-slate-200 bg-slate-100/30 dark:border-slate-700 dark:bg-slate-800'
                  } items-center justify-center`}
                >
                  <Text
                    className={`text-sm font-semibold text-center ${
                      isSelected2
                        ? 'text-orange-600 dark:text-orange-400'
                        : 'text-slate-500 dark:text-slate-400'
                    }`}
                    numberOfLines={2}
                  >
                    {sideLabels.side2.label}
                  </Text>
                </View>
              </View>
            </>
          )}

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
