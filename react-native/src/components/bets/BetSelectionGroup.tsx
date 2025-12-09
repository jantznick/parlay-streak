import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { api } from '../../services/api';
import { BetSelectionCard } from './BetSelectionCard';
import type { BetConfig } from '@shared/types/bets';
import { useToast } from '../../context/ToastContext';
import { useParlay } from '../../context/ParlayContext';
import { useBets } from '../../context/BetsContext';

interface Bet {
  id: string;
  betType: string;
  displayText: string;
  config?: BetConfig;
}

interface Game {
  id: string;
  homeTeam: string;
  awayTeam: string;
  status: string;
  startTime: string;
  metadata?: any;
}

interface BetSelectionGroupProps {
  bet: Bet;
  game: Game;
  onSelectionSaved?: () => void;
  selectedBetId?: string | null;
  onBetSelected?: (betId: string | null) => void;
}

function getBetSideLabels(bet: Bet, game: Game): {
  side1: { value: string; label: string; isSimple?: boolean };
  side2: { value: string; label: string; isSimple?: boolean };
  context?: string; // Optional context to display above buttons
} {
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

    // Add metric and time period for non-team-vs-team bets
    const isTeamVsTeam = participant1?.subject_type === 'TEAM' && participant2?.subject_type === 'TEAM';
    
    if (!isTeamVsTeam) {
      // Add metric info to each participant
      if (participant1?.metric) {
        const timePeriod = participant1.time_period ? ` ${participant1.time_period}` : '';
        name1 = `${name1} - ${participant1.metric}${timePeriod}`;
      }
      if (participant2?.metric) {
        const timePeriod = participant2.time_period ? ` ${participant2.time_period}` : '';
        name2 = `${name2} - ${participant2.metric}${timePeriod}`;
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
      side1: { value: 'participant_1', label: name1 },
      side2: { value: 'participant_2', label: name2 },
      context: bet.displayText || 'Select Winner', // Use displayText or default title
    };
  } else if (bet.betType === 'THRESHOLD') {
    const threshConfig = config as any;
    const threshold = threshConfig.threshold || 0;
    const participant = threshConfig.participant;
    
    // Build context: "{Subject} {Metric} {TimePeriod}"
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
      side1: { value: 'over', label: `OVER ${threshold}`, isSimple: true },
      side2: { value: 'under', label: `UNDER ${threshold}`, isSimple: true },
      context: context || undefined,
    };
  } else if (bet.betType === 'EVENT') {
    // Use displayText for context shown above buttons
    return {
      side1: { value: 'yes', label: 'YES', isSimple: true },
      side2: { value: 'no', label: 'NO', isSimple: true },
      context: bet.displayText || undefined,
    };
  }

  return {
    side1: { value: 'participant_1', label: 'Side 1' },
    side2: { value: 'participant_2', label: 'Side 2' },
  };
}

export function BetSelectionGroup({ bet, game, onSelectionSaved, selectedBetId, onBetSelected }: BetSelectionGroupProps) {
  const [selectedSide, setSelectedSide] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [parlayLoading, setParlayLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const { showToast } = useToast();
  const { activeParlay, setActiveParlay, isParlayBuilderOpen, setIsParlayBuilderOpen, refreshActiveParlay } = useParlay();
  const { triggerRefresh } = useBets();

  const sideLabels = getBetSideLabels(bet, game);
  const gameStarted = game.status !== 'scheduled';
  const disabled = gameStarted || loading || parlayLoading || saved;

  // Check if parlay is full (5 bets max)
  const parlayFull = activeParlay && activeParlay.betCount >= 5;

  // Clear selection if another bet was selected
  useEffect(() => {
    if (selectedBetId !== null && selectedBetId !== bet.id && selectedSide !== null) {
      setSelectedSide(null);
    }
  }, [selectedBetId, bet.id, selectedSide]);

  const handleCardPress = (side: string) => {
    if (disabled) return;
    // Toggle selection - if clicking the same side, deselect it
    if (selectedSide === side) {
      setSelectedSide(null);
      if (onBetSelected) {
        onBetSelected(null);
      }
    } else {
      setSelectedSide(side);
      if (onBetSelected) {
        onBetSelected(bet.id);
      }
    }
    setError(null);
  };

  const handleSave = async () => {
    if (!selectedSide || disabled) return;

    setLoading(true);
    setError(null);

    try {
      const response = await api.selectBet(bet.id, selectedSide);
      if (response.success) {
        setSaved(true);
        showToast('Bet selection saved!', 'success');
        triggerRefresh();
        if (onSelectionSaved) {
          onSelectionSaved();
        }
      } else {
        const errorMsg = response.error?.message || 'Failed to save bet selection';
        setError(errorMsg);
        showToast(errorMsg, 'error');
      }
    } catch (err: any) {
      const errorMsg = err.message || 'Failed to save bet selection';
      setError(errorMsg);
      showToast(errorMsg, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleStartParlay = async () => {
    if (!selectedSide || disabled) return;

    setParlayLoading(true);
    setError(null);

    try {
      // If there's an existing 1-bet parlay open, close it first
      if (activeParlay && activeParlay.betCount === 1 && isParlayBuilderOpen) {
        try {
          await api.deleteParlay(activeParlay.id);
          setIsParlayBuilderOpen(false);
          triggerRefresh();
        } catch (err) {
          console.error('Error closing old parlay:', err);
        }
      }

      const response = await api.startParlay(bet.id, selectedSide);
      if (response.success && response.data) {
        const data = response.data as { parlay?: any };
        if (data.parlay) {
          setActiveParlay(data.parlay);
          setIsParlayBuilderOpen(true);
          setSaved(true);
          if (onSelectionSaved) {
            onSelectionSaved();
          }
        } else {
          showToast('Failed to start parlay', 'error');
        }
      } else {
        const errorMsg = response.error?.message || 'Failed to start parlay';
        if (errorMsg.includes('already in a parlay')) {
          showToast('This bet is already in a parlay', 'error');
        } else {
          showToast(errorMsg, 'error');
        }
        setError(errorMsg);
      }
    } catch (err: any) {
      const errorMsg = err.message || 'Failed to start parlay';
      showToast(errorMsg, 'error');
      setError(errorMsg);
    } finally {
      setParlayLoading(false);
    }
  };

  const handleAddToParlay = async () => {
    if (!selectedSide || disabled || !activeParlay) return;

    setParlayLoading(true);
    setError(null);

    try {
      const response = await api.addSelectionToParlay(activeParlay.id, bet.id, selectedSide);
      if (response.success && response.data) {
        const data = response.data as { parlay?: any };
        if (data.parlay) {
          setActiveParlay(data.parlay);
          await refreshActiveParlay();
          setSaved(true);
          if (onSelectionSaved) {
            onSelectionSaved();
          }
        } else {
          showToast('Failed to add to parlay', 'error');
        }
      } else {
        const errorMsg = response.error?.message || 'Failed to add to parlay';
        showToast(errorMsg, 'error');
        setError(errorMsg);
      }
    } catch (err: any) {
      const errorMsg = err.message || 'Failed to add to parlay';
      showToast(errorMsg, 'error');
      setError(errorMsg);
    } finally {
      setParlayLoading(false);
    }
  };

  return (
    <View className="bg-transparent dark:bg-slate-800 rounded-2xl px-3 py-2 mb-0.5">
      {sideLabels.context && (
        <View className="mb-2 px-3 py-1.5 bg-slate-100 dark:bg-slate-900/70 rounded-lg border border-slate-200 dark:border-slate-700">
          <Text className="text-sm font-semibold text-slate-700 dark:text-slate-200" numberOfLines={2}>
            {sideLabels.context}
          </Text>
        </View>
      )}
      <View className="flex-row gap-1.5">
        <BetSelectionCard
          side={sideLabels.side1.value}
          label={sideLabels.side1.label}
          isSelected={selectedSide === sideLabels.side1.value}
          disabled={disabled}
          onPress={() => handleCardPress(sideLabels.side1.value)}
          isSimple={sideLabels.side1.isSimple}
          hasContext={!!sideLabels.context}
        />
        <BetSelectionCard
          side={sideLabels.side2.value}
          label={sideLabels.side2.label}
          isSelected={selectedSide === sideLabels.side2.value}
          disabled={disabled}
          onPress={() => handleCardPress(sideLabels.side2.value)}
          isSimple={sideLabels.side2.isSimple}
          hasContext={!!sideLabels.context}
        />
      </View>

      {error && (
        <View className="bg-red-100 dark:bg-red-900/40 border border-red-200 dark:border-red-500/70 rounded-xl px-2 py-1 mb-2">
          <Text className="text-red-700 dark:text-red-200 text-xs text-center">{error}</Text>
        </View>
      )}

      {selectedSide && !saved && (
        <View className="flex-row gap-2 mt-2">
          {/* Save Button */}
          <TouchableOpacity
            onPress={handleSave}
            disabled={loading || parlayLoading || gameStarted}
            className={`flex-1 px-3 py-2.5 rounded-xl ${
              loading || parlayLoading || gameStarted ? 'bg-slate-300 dark:bg-slate-700' : 'bg-orange-600 shadow-lg shadow-orange-500/40 dark:shadow-none'
            } flex-row items-center justify-center`}
          >
            {loading && <ActivityIndicator size="small" color="#fff" style={{ marginRight: 6 }} />}
            <Text className="text-white text-sm font-semibold">
              {loading ? 'Saving…' : 'Save'}
            </Text>
          </TouchableOpacity>

          {/* Parlay Button */}
          {isParlayBuilderOpen && activeParlay ? (
            <TouchableOpacity
              onPress={handleAddToParlay}
              disabled={loading || parlayLoading || gameStarted || parlayFull}
              className={`flex-1 px-3 py-2.5 rounded-xl ${
                loading || parlayLoading || gameStarted || parlayFull ? 'bg-slate-300 dark:bg-slate-700' : 'bg-blue-600 shadow-lg shadow-blue-500/40 dark:shadow-none'
              } flex-row items-center justify-center`}
            >
              {parlayLoading && <ActivityIndicator size="small" color="#fff" style={{ marginRight: 6 }} />}
              <Text className={`text-sm font-semibold ${
                parlayFull ? 'text-slate-500' : 'text-white'
              }`}>
                {parlayLoading ? 'Adding…' : parlayFull ? 'Full' : '+ Parlay'}
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={handleStartParlay}
              disabled={loading || parlayLoading || gameStarted}
              className={`flex-1 px-3 py-2.5 rounded-xl ${
                loading || parlayLoading || gameStarted ? 'bg-slate-700' : 'bg-blue-600 shadow-lg shadow-blue-500/40 dark:shadow-none'
              } flex-row items-center justify-center`}
            >
              {parlayLoading && <ActivityIndicator size="small" color="#fff" style={{ marginRight: 6 }} />}
              <Text className="text-white text-sm font-semibold">
                {parlayLoading ? 'Starting…' : 'Parlay'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {saved && (
        <View className="bg-emerald-100 dark:bg-emerald-900/40 border border-emerald-200 dark:border-emerald-500/70 rounded-xl px-2 py-1">
          <Text className="text-emerald-700 dark:text-emerald-200 text-xs text-center">Selection saved!</Text>
        </View>
      )}

      {gameStarted && (
        <Text className="text-slate-500 dark:text-slate-500 text-xs text-center mt-1">Game has started</Text>
      )}
    </View>
  );
}
