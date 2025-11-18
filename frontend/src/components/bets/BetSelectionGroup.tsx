import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BetSelectionCard } from './BetSelectionCard';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import type { BetConfig } from '@shared/types/bets';

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

/**
 * Get the labels for the two sides of a bet
 */
function getBetSideLabels(bet: Bet, game: Game): { side1: { value: string; label: string }; side2: { value: string; label: string } } {
  const config = bet.config;
  
  if (!config) {
    // Fallback if config is missing
    return {
      side1: { value: 'participant_1', label: 'Side 1' },
      side2: { value: 'participant_2', label: 'Side 2' }
    };
  }

  if (bet.betType === 'COMPARISON') {
    const compConfig = config as any;
    const participant1 = compConfig.participant_1;
    const participant2 = compConfig.participant_2;
    
    // Get participant names
    let name1 = participant1?.subject_name || 'Participant 1';
    let name2 = participant2?.subject_name || 'Participant 2';
    
    // If it's a team and we have the team names from the game, use those
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
    
    // Handle spread
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
      side2: { value: 'participant_2', label: name2 }
    };
  } else if (bet.betType === 'THRESHOLD') {
    const threshConfig = config as any;
    const threshold = threshConfig.threshold || 0;
    const participant = threshConfig.participant;
    const participantName = participant?.subject_name || 'Player';
    
    return {
      side1: { value: 'over', label: `OVER ${threshold}` },
      side2: { value: 'under', label: `UNDER ${threshold}` }
    };
  } else if (bet.betType === 'EVENT') {
    return {
      side1: { value: 'yes', label: 'YES' },
      side2: { value: 'no', label: 'NO' }
    };
  }
  
  // Fallback
  return {
    side1: { value: 'participant_1', label: 'Side 1' },
    side2: { value: 'participant_2', label: 'Side 2' }
  };
}

export function BetSelectionGroup({ bet, game, onSelectionSaved }: BetSelectionGroupProps) {
  const { user } = useAuth();
  const [selectedSide, setSelectedSide] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const sideLabels = getBetSideLabels(bet, game);
  const gameStarted = game.status !== 'scheduled';
  const disabled = gameStarted || loading || saved || !user;

  const handleCardClick = (side: string) => {
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
        if (onSelectionSaved) {
          onSelectionSaved();
        }
      } else {
        setError(response.error?.message || 'Failed to save bet selection');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to save bet selection');
    } finally {
      setLoading(false);
    }
  };

  // Show signup prompt if not authenticated
  if (!user) {
    return (
      <div className="space-y-3">
        <div className="text-sm text-slate-400 mb-2">
          {bet.displayText}
        </div>
        <div className="flex gap-2">
          <BetSelectionCard
            side={sideLabels.side1.value}
            label={sideLabels.side1.label}
            isSelected={false}
            disabled={true}
            onClick={() => {}}
          />
          <BetSelectionCard
            side={sideLabels.side2.value}
            label={sideLabels.side2.label}
            isSelected={false}
            disabled={true}
            onClick={() => {}}
          />
        </div>
        <div className="px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-center">
          <p className="text-slate-300 text-sm mb-2">
            Sign up to select bets and build your streak!
          </p>
          <Link
            to="/"
            className="inline-block px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm font-medium transition"
          >
            Get Started
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Two Side Cards */}
      <div className="flex gap-2">
        <BetSelectionCard
          side={sideLabels.side1.value}
          label={sideLabels.side1.label}
          isSelected={selectedSide === sideLabels.side1.value}
          disabled={disabled}
          onClick={() => handleCardClick(sideLabels.side1.value)}
        />
        <BetSelectionCard
          side={sideLabels.side2.value}
          label={sideLabels.side2.label}
          isSelected={selectedSide === sideLabels.side2.value}
          disabled={disabled}
          onClick={() => handleCardClick(sideLabels.side2.value)}
        />
      </div>

      {/* Save Button - appears when a side is selected */}
      {selectedSide && !saved && (
        <button
          onClick={handleSave}
          disabled={loading || gameStarted}
          className={`
            w-full px-4 py-2 rounded-lg font-medium transition
            ${loading || gameStarted
              ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
              : 'bg-orange-600 hover:bg-orange-700 text-white'
            }
          `}
        >
          {loading ? 'Saving...' : 'Save Bet'}
        </button>
      )}

      {/* Success Message */}
      {saved && (
        <div className="px-4 py-2 bg-green-900/30 border border-green-800 rounded-lg text-green-400 text-sm text-center">
          Bet saved! You can add it to a parlay later.
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="px-4 py-2 bg-red-900/30 border border-red-800 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Game Started Warning */}
      {gameStarted && (
        <div className="px-4 py-2 bg-yellow-900/30 border border-yellow-800 rounded-lg text-yellow-400 text-sm text-center">
          Game has started - bets can no longer be selected
        </div>
      )}
    </div>
  );
}

