import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BetSelectionCard } from './BetSelectionCard';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useParlay } from '../../context/ParlayContext';
import { useBets } from '../../context/BetsContext';
import { ConfirmModal } from '../common/ConfirmModal';
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
  const { activeParlay, setActiveParlay, isParlayBuilderOpen, setIsParlayBuilderOpen, refreshActiveParlay } = useParlay();
  const { triggerRefresh } = useBets();
  const [selectedSide, setSelectedSide] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [showNewParlayWarning, setShowNewParlayWarning] = useState(false);

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
        triggerRefresh(); // Auto-refresh My Bets section
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

  const performStartParlay = async () => {
    if (!selectedSide || disabled) return;

    setLoading(true);
    setError(null);

    try {
      // If builder is closed but activeParlay is still set, clear it first
      if (activeParlay && !isParlayBuilderOpen) {
        setActiveParlay(null);
      }

      // If there's an existing active parlay with 1 bet, convert it back to a single bet first
      // Note: We temporarily close the builder to allow refresh, then reopen with new parlay
      if (activeParlay && activeParlay.betCount === 1 && isParlayBuilderOpen) {
        try {
          await api.deleteParlay(activeParlay.id);
          setIsParlayBuilderOpen(false); // Temporarily close to allow refresh
          triggerRefresh(); // Refresh to show the converted single bet
          // Builder will be reopened below when new parlay is set
        } catch (err) {
          console.error('Error converting old parlay to single bet:', err);
        }
      }

      const response = await api.startParlay(bet.id, selectedSide);
      if (response.success && response.data) {
        const data = response.data as { parlay?: any };
        if (data.parlay) {
          setActiveParlay(data.parlay);
          setIsParlayBuilderOpen(true);
          setSaved(true);
          // Don't refresh - bet will show overlay in My Bets instead
          if (onSelectionSaved) {
            onSelectionSaved();
          }
        } else {
          setError('Failed to start parlay');
        }
      } else {
        const errorMsg = response.error?.message || 'Failed to start parlay';
        if (errorMsg.includes('already in a parlay')) {
          setError('This bet is already in a parlay. Please remove it from the parlay first.');
        } else {
          setError(errorMsg);
        }
      }
    } catch (err: any) {
      if (err.message?.includes('already in a parlay')) {
        setError('This bet is already in a parlay. Please remove it from the parlay first.');
      } else {
        setError(err.message || 'Failed to start parlay');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleStartParlay = () => {
    if (!selectedSide || disabled) return;

    // If there's an active parlay AND the builder is open, show warning modal
    if (activeParlay && isParlayBuilderOpen) {
      setShowNewParlayWarning(true);
    } else {
      performStartParlay();
    }
  };

  const handleAddToParlay = async () => {
    if (!selectedSide || disabled) return;

    // If builder is not open, start a new parlay instead
    if (!isParlayBuilderOpen || !activeParlay) {
      handleStartParlay();
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await api.addSelectionToParlay(activeParlay.id, bet.id, selectedSide);
      if (response.success && response.data) {
        const data = response.data as { parlay?: any };
        if (data.parlay) {
          setActiveParlay(data.parlay);
          await refreshActiveParlay();
          setSaved(true);
          // Don't refresh - bet will show overlay in My Bets instead
          if (onSelectionSaved) {
            onSelectionSaved();
          }
        } else {
          setError('Failed to add bet to parlay');
        }
      } else {
        setError(response.error?.message || 'Failed to add bet to parlay');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to add bet to parlay');
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

      {/* Action Buttons - appear when a side is selected */}
      {selectedSide && !saved && (
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={loading || gameStarted}
            className={`
              flex-1 px-4 py-2 rounded-lg font-medium transition
              ${loading || gameStarted
                ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                : 'bg-orange-600 hover:bg-orange-700 text-white'
              }
            `}
          >
            {loading ? 'Saving...' : 'Save Bet'}
          </button>
          {isParlayBuilderOpen && activeParlay ? (
            <button
              onClick={handleAddToParlay}
              disabled={loading || gameStarted || activeParlay.betCount >= 5}
              className={`
                flex-1 px-4 py-2 rounded-lg font-medium transition
                ${loading || gameStarted || activeParlay.betCount >= 5
                  ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
                }
              `}
            >
              {loading ? 'Adding...' : 'Add to Parlay'}
            </button>
          ) : (
            <button
              onClick={handleStartParlay}
              disabled={loading || gameStarted}
              className={`
                flex-1 px-4 py-2 rounded-lg font-medium transition
                ${loading || gameStarted
                  ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
                }
              `}
            >
              {loading ? 'Starting...' : 'Start Parlay'}
            </button>
          )}
        </div>
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

      {/* New Parlay Warning Modal */}
      <ConfirmModal
        isOpen={showNewParlayWarning}
        title="Start New Parlay?"
        message="You have a parlay builder open. Starting a new parlay will close the current one. Continue?"
        confirmText="Continue"
        cancelText="Cancel"
        variant="default"
        onConfirm={() => {
          setShowNewParlayWarning(false);
          performStartParlay();
        }}
        onCancel={() => setShowNewParlayWarning(false)}
      />
    </div>
  );
}

