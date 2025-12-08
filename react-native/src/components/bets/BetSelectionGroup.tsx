import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { api } from '../../services/api';
import { BetSelectionCard } from './BetSelectionCard';
import type { BetConfig } from '@shared/types/bets';
import { useToast } from '../../context/ToastContext';

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
}

function getBetSideLabels(bet: Bet, game: Game): {
  side1: { value: string; label: string };
  side2: { value: string; label: string };
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
    };
  } else if (bet.betType === 'THRESHOLD') {
    const threshConfig = config as any;
    const threshold = threshConfig.threshold || 0;

    return {
      side1: { value: 'over', label: `OVER ${threshold}` },
      side2: { value: 'under', label: `UNDER ${threshold}` },
    };
  } else if (bet.betType === 'EVENT') {
    return {
      side1: { value: 'yes', label: 'YES' },
      side2: { value: 'no', label: 'NO' },
    };
  }

  return {
    side1: { value: 'participant_1', label: 'Side 1' },
    side2: { value: 'participant_2', label: 'Side 2' },
  };
}

export function BetSelectionGroup({ bet, game, onSelectionSaved }: BetSelectionGroupProps) {
  const [selectedSide, setSelectedSide] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const { showToast } = useToast();

  const sideLabels = getBetSideLabels(bet, game);
  const gameStarted = game.status !== 'scheduled';
  const disabled = gameStarted || loading || saved;

  const handleCardPress = (side: string) => {
    if (disabled) return;
    setSelectedSide(side);
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
        showToast('Bet selection saved successfully!');
        if (onSelectionSaved) {
          onSelectionSaved();
        }
      } else {
        const errorMsg = response.error?.message || 'Failed to save bet selection';
        setError(errorMsg);
        Alert.alert('Error', errorMsg);
      }
    } catch (err: any) {
      const errorMsg = err.message || 'Failed to save bet selection';
      setError(errorMsg);
      Alert.alert('Error', errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="bg-slate-800 rounded-2xl px-3 py-3 mb-2">
      <Text className="text-xs font-medium text-slate-200 mb-2" numberOfLines={2}>
        {bet.displayText}
      </Text>

      <View className="flex-row gap-2 mb-2">
        <BetSelectionCard
          side={sideLabels.side1.value}
          label={sideLabels.side1.label}
          isSelected={selectedSide === sideLabels.side1.value}
          disabled={disabled}
          onPress={() => handleCardPress(sideLabels.side1.value)}
        />
        <BetSelectionCard
          side={sideLabels.side2.value}
          label={sideLabels.side2.label}
          isSelected={selectedSide === sideLabels.side2.value}
          disabled={disabled}
          onPress={() => handleCardPress(sideLabels.side2.value)}
        />
      </View>

      {error && (
        <View className="bg-red-900/40 border border-red-500/70 rounded-xl px-2 py-1 mb-2">
          <Text className="text-red-200 text-[10px] text-center">{error}</Text>
        </View>
      )}

      {selectedSide && !saved && (
        <TouchableOpacity
          onPress={handleSave}
          disabled={loading || disabled}
          className={`px-3 py-2 rounded-xl ${
            loading || disabled ? 'bg-slate-700' : 'bg-orange-600'
          } flex-row items-center justify-center`}
        >
          {loading && <ActivityIndicator size="small" color="#e5e7eb" className="mr-2" />}
          <Text className="text-white text-xs font-semibold">
            {loading ? 'Saving…' : 'Save Selection'}
          </Text>
        </TouchableOpacity>
      )}

      {saved && (
        <View className="bg-emerald-900/40 border border-emerald-500/70 rounded-xl px-2 py-1">
          <Text className="text-emerald-200 text-[10px] text-center">Selection saved!</Text>
        </View>
      )}

      {gameStarted && (
        <Text className="text-slate-500 text-[10px] text-center mt-1">Game has started</Text>
      )}
    </View>
  );
}

