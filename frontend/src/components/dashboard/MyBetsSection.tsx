import { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { useParlay } from '../../context/ParlayContext';
import { useBets } from '../../context/BetsContext';
import { ConfirmModal } from '../common/ConfirmModal';

interface BetSelection {
  id: string;
  betId: string;
  selectedSide: string;
  status: string;
  createdAt: string;
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
      metadata?: any;
    };
  };
}

interface ParlaySelection {
  id: string;
  bet: {
    id: string;
    displayText: string;
    betType: string;
    config?: any;
  };
  selectedSide: string;
  status: string;
  game: {
    id: string;
    homeTeam: string;
    awayTeam: string;
    startTime: string;
    status: string;
    sport: string;
    metadata?: any;
  };
}

interface Parlay {
  id: string;
  betCount: number;
  parlayValue: number;
  insured: boolean;
  insuranceCost: number;
  status: string;
  lockedAt?: string;
  selections: ParlaySelection[];
  createdAt: string;
}

export function MyBetsSection() {
  const { activeParlay, setActiveParlay, isParlayBuilderOpen, setIsParlayBuilderOpen } = useParlay();
  const { refreshTrigger } = useBets();
  const [selections, setSelections] = useState<BetSelection[]>([]);
  const [parlays, setParlays] = useState<Parlay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [expandedParlayId, setExpandedParlayId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [startingParlayId, setStartingParlayId] = useState<string | null>(null);
  const [showNewParlayWarning, setShowNewParlayWarning] = useState(false);
  const [pendingParlayStart, setPendingParlayStart] = useState<{ selectionId: string; betId: string; selectedSide: string } | null>(null);
  const [showOpenParlayWarning, setShowOpenParlayWarning] = useState(false);
  const [pendingParlayToOpen, setPendingParlayToOpen] = useState<Parlay | null>(null);

  useEffect(() => {
    fetchMyData();
  }, [refreshTrigger]);

  const fetchMyData = async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch single bets (selections with no parlay)
      const selectionsResponse = await api.getMySelections();
      if (selectionsResponse.success && selectionsResponse.data) {
        const data = selectionsResponse.data as { selections?: BetSelection[] };
        // Filter to only single bets (parlayId is null in the response, but we check status)
        const singleBets = (data.selections || []).filter(
          (s: any) => !s.parlayId || s.parlayId === null
        );
        setSelections(singleBets);
      } else {
        setSelections([]);
      }

      // Fetch parlays - only show parlays with 2+ bets (valid parlays)
      const parlaysResponse = await api.getParlays('building', true);
      if (parlaysResponse.success && parlaysResponse.data) {
        const data = parlaysResponse.data as { parlays?: Parlay[] };
        // Filter out invalid parlays (betCount < 2)
        const validParlays = (data.parlays || []).filter(p => p.betCount >= 2);
        setParlays(validParlays);
      } else {
        setParlays([]);
      }
    } catch (error: any) {
      setError(error.message || 'Failed to load your bets');
      setSelections([]);
      setParlays([]);
    } finally {
      setLoading(false);
    }
  };

  const performOpenParlay = async (parlay: Parlay) => {
    // If there's an existing active parlay with 1 bet, convert it back to a single bet first
    if (activeParlay && activeParlay.betCount === 1) {
      try {
        await api.deleteParlay(activeParlay.id);
        await fetchMyData(); // Refresh to show the converted single bet
      } catch (err) {
        console.error('Error converting old parlay to single bet:', err);
      }
    }
    setActiveParlay(parlay);
    setIsParlayBuilderOpen(true);
  };

  const handleOpenParlay = (parlay: Parlay) => {
    // If there's an active parlay AND the builder is open, show warning modal
    if (activeParlay && isParlayBuilderOpen) {
      setPendingParlayToOpen(parlay);
      setShowOpenParlayWarning(true);
    } else {
      performOpenParlay(parlay);
    }
  };

  const performStartParlay = async (selectionId: string, betId: string, selectedSide: string) => {
    setStartingParlayId(selectionId);
    try {
      // If builder is closed but activeParlay is still set, clear it first
      if (activeParlay && !isParlayBuilderOpen) {
        setActiveParlay(null);
      }

      // If there's an existing active parlay with 1 bet, convert it back to a single bet first
      if (activeParlay && activeParlay.betCount === 1 && isParlayBuilderOpen) {
        try {
          await api.deleteParlay(activeParlay.id);
          await fetchMyData(); // Refresh to show the converted single bet
        } catch (err) {
          console.error('Error converting old parlay to single bet:', err);
        }
      }

      const response = await api.startParlay(betId, selectedSide, selectionId);
      if (response.success && response.data) {
        const data = response.data as { parlay?: Parlay };
        if (data.parlay) {
          setActiveParlay(data.parlay);
          setIsParlayBuilderOpen(true);
          await fetchMyData();
        } else {
          alert('Failed to start parlay');
        }
      } else {
        const errorMsg = response.error?.message || 'Failed to start parlay';
        if (errorMsg.includes('already in a parlay')) {
          alert('This bet is already in a parlay. Please remove it from the parlay first.');
        } else {
          alert(errorMsg);
        }
      }
    } catch (error: any) {
      if (error.message?.includes('already in a parlay')) {
        alert('This bet is already in a parlay. Please remove it from the parlay first.');
      } else {
        alert(error.message || 'Failed to start parlay');
      }
    } finally {
      setStartingParlayId(null);
    }
  };

  const handleStartParlay = (selectionId: string, betId: string, selectedSide: string) => {
    // Check if this selection is already in a parlay
    const selection = selections.find(s => s.id === selectionId);
    if (selection && (selection as any).parlayId) {
      alert('This bet is already in a parlay. Please remove it from the parlay first.');
      return;
    }

    // Check if there's an active parlay builder open
    if (activeParlay && isParlayBuilderOpen) {
      setPendingParlayStart({ selectionId, betId, selectedSide });
      setShowNewParlayWarning(true);
    } else {
      performStartParlay(selectionId, betId, selectedSide);
    }
  };

  const handleConfirmDelete = async () => {
    if (!confirmDeleteId) return;

    setDeletingId(confirmDeleteId);
    setConfirmDeleteId(null);
    
    try {
      const response = await api.deleteSelection(confirmDeleteId);
      if (response.success) {
        await fetchMyData();
      } else {
        alert(response.error?.message || 'Failed to delete selection');
      }
    } catch (error: any) {
      alert(error.message || 'Failed to delete selection');
    } finally {
      setDeletingId(null);
    }
  };

  const formatSideLabel = (side: string, betType: string, config: any, game: any) => {
    if (betType === 'COMPARISON' && config) {
      const compConfig = config;
      if (side === 'participant_1') {
        const participant = compConfig.participant_1;
        let name = participant?.subject_name || 'Participant 1';
        
        // If it's a team, try to use the game team names
        if (participant?.subject_type === 'TEAM') {
          const metadata = game.metadata;
          const apiData = metadata?.apiData;
          if (apiData?.teams?.home?.id === participant.subject_id) {
            name = game.homeTeam;
          } else if (apiData?.teams?.away?.id === participant.subject_id) {
            name = game.awayTeam;
          }
        }
        
        // Handle spread
        if (compConfig.spread) {
          const spreadValue = compConfig.spread.value;
          const spreadDir = compConfig.spread.direction;
          if (spreadDir === '+') {
            name = `${name} +${spreadValue}`;
          } else {
            name = `${name} -${spreadValue}`;
          }
        }
        
        return name;
      } else if (side === 'participant_2') {
        const participant = compConfig.participant_2;
        let name = participant?.subject_name || 'Participant 2';
        
        // If it's a team, try to use the game team names
        if (participant?.subject_type === 'TEAM') {
          const metadata = game.metadata;
          const apiData = metadata?.apiData;
          if (apiData?.teams?.home?.id === participant.subject_id) {
            name = game.homeTeam;
          } else if (apiData?.teams?.away?.id === participant.subject_id) {
            name = game.awayTeam;
          }
        }
        
        return name;
      }
    } else if (betType === 'THRESHOLD') {
      return side.toUpperCase();
    } else if (betType === 'EVENT') {
      return side.toUpperCase();
    }
    return side;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const getSportEmoji = (sport: string) => {
    switch (sport) {
      case 'BASKETBALL': return '🏀';
      case 'FOOTBALL': return '🏈';
      case 'BASEBALL': return '⚾';
      case 'HOCKEY': return '🏒';
      case 'SOCCER': return '⚽';
      default: return '🏆';
    }
  };

  if (loading) {
    return (
      <div className="bg-slate-900 rounded-lg p-8 text-center">
        <div className="text-4xl mb-4">⏳</div>
        <p className="text-slate-400">Loading your bets...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-900/20 border border-red-800 rounded-lg p-4">
        <p className="text-red-400">{error}</p>
      </div>
    );
  }

  if (selections.length === 0 && parlays.length === 0) {
    return (
      <div className="bg-slate-900 rounded-lg p-8 text-center">
        <div className="text-4xl mb-4">📝</div>
        <p className="text-slate-300 mb-2">You haven't selected any bets yet</p>
        <p className="text-slate-500 text-sm">
          Browse today's bets above and make your selections
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-8">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-white">
              My Bets
            </h2>
            <p className="text-slate-400 text-sm mt-1">
              {selections.length} single bet{selections.length !== 1 ? 's' : ''} • {parlays.length} parlay{parlays.length !== 1 ? 's' : ''}
            </p>
          </div>
          <button
            onClick={fetchMyData}
            className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 transition text-sm"
          >
            Refresh
          </button>
        </div>

        {/* Single Bets Section */}
        {selections.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-xl font-semibold text-white border-b border-slate-800 pb-2">Single Bets</h3>
            <div className="grid gap-4">
              {selections.map((selection) => {
                const canModify = selection.bet.game.status === 'scheduled' && selection.status !== 'locked';
                
                return (
                  <div
                    key={selection.id}
                    className="bg-slate-900 border border-slate-800 rounded-lg p-4 hover:border-slate-700 transition"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="text-2xl">{getSportEmoji(selection.bet.game.sport)}</span>
                          <div>
                            <h3 className="font-semibold text-white">
                              {selection.bet.game.awayTeam} @ {selection.bet.game.homeTeam}
                            </h3>
                            <p className="text-sm text-slate-400">
                              {formatTime(selection.bet.game.startTime)}
                            </p>
                          </div>
                        </div>
                        
                        <div className="mt-3 p-3 bg-slate-800 rounded-lg">
                          <p className="text-sm text-slate-300 mb-2">
                            {selection.bet.displayText}
                          </p>
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-1 bg-orange-900/30 text-orange-400 rounded text-xs font-medium border border-orange-600/30">
                              {formatSideLabel(selection.selectedSide, selection.bet.betType, selection.bet.config, selection.bet.game)}
                            </span>
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              selection.status === 'locked'
                                ? 'bg-yellow-900/30 text-yellow-400 border border-yellow-600/30'
                                : 'bg-green-900/30 text-green-400 border border-green-600/30'
                            }`}>
                              {selection.status.toUpperCase()}
                            </span>
                          </div>
                        </div>
                        
                        <p className="text-xs text-slate-500 mt-2">
                          Selected {formatDate(selection.createdAt)}
                        </p>
                      </div>
                      
                      {canModify && (
                        <div className="flex flex-col gap-2">
                          <button
                            onClick={() => handleStartParlay(selection.id, selection.bet.id, selection.selectedSide)}
                            disabled={startingParlayId === selection.id}
                            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {startingParlayId === selection.id ? 'Starting...' : 'Start Parlay'}
                          </button>
                          <button
                            onClick={() => setConfirmDeleteId(selection.id)}
                            disabled={deletingId === selection.id}
                            className="px-3 py-1.5 bg-red-900/30 text-red-400 rounded-lg hover:bg-red-900/50 transition text-sm font-medium border border-red-800/50 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {deletingId === selection.id ? 'Removing...' : 'Remove'}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Parlays Section */}
        {parlays.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-xl font-semibold text-white border-b border-slate-800 pb-2">Parlays</h3>
            <div className="grid gap-4">
              {parlays.map((parlay) => {
                const isExpanded = expandedParlayId === parlay.id;
                const isLocked = parlay.lockedAt !== null && parlay.lockedAt !== undefined;

                return (
                  <div
                    key={parlay.id}
                    className="bg-gradient-to-br from-blue-900/20 to-slate-900 border-2 border-blue-800/50 rounded-lg overflow-hidden hover:border-blue-700/50 transition"
                  >
                    {/* Parlay Header */}
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <span className="px-3 py-1 bg-blue-600 text-white rounded text-sm font-bold border border-blue-500">
                              PARLAY: {parlay.betCount} bets • +{parlay.parlayValue}
                            </span>
                            {parlay.insured && (
                              <span className="px-2 py-1 bg-orange-900/30 text-orange-400 rounded text-xs font-medium border border-orange-600/30">
                                Insured
                              </span>
                            )}
                            {isLocked && (
                              <span className="px-2 py-1 bg-yellow-900/30 text-yellow-400 rounded text-xs font-medium border border-yellow-600/30">
                                🔒 Locked
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-400">
                            Created {formatDate(parlay.createdAt)}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          {!isLocked && (
                            <button
                              onClick={() => handleOpenParlay(parlay)}
                              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition text-sm font-medium"
                            >
                              Open
                            </button>
                          )}
                          <button
                            onClick={() => setExpandedParlayId(isExpanded ? null : parlay.id)}
                            className="px-3 py-1.5 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 transition text-sm font-medium"
                          >
                            {isExpanded ? 'Collapse' : 'Expand'}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Parlay Selections (when expanded) */}
                    {isExpanded && (
                      <div className="px-4 pb-4 space-y-3 border-t border-blue-800/30">
                        {parlay.selections.map((selection) => (
                          <div
                            key={selection.id}
                            className="p-3 bg-slate-800/50 rounded-lg"
                          >
                            <div className="flex items-center gap-3 mb-2">
                              <span className="text-xl">{getSportEmoji(selection.game.sport)}</span>
                              <div className="flex-1">
                                <h4 className="font-semibold text-white text-sm">
                                  {selection.game.awayTeam} @ {selection.game.homeTeam}
                                </h4>
                                <p className="text-xs text-slate-400">
                                  {formatTime(selection.game.startTime)}
                                </p>
                              </div>
                            </div>
                            <p className="text-sm text-slate-300 mb-2">
                              {selection.bet.displayText}
                            </p>
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-1 bg-orange-900/30 text-orange-400 rounded text-xs font-medium border border-orange-600/30">
                                {formatSideLabel(selection.selectedSide, selection.bet.betType, selection.bet.config, selection.game)}
                              </span>
                              <span className={`px-2 py-1 rounded text-xs font-medium ${
                                selection.status === 'locked'
                                  ? 'bg-yellow-900/30 text-yellow-400 border border-yellow-600/30'
                                  : 'bg-green-900/30 text-green-400 border border-green-600/30'
                              }`}>
                                {selection.status.toUpperCase()}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={confirmDeleteId !== null}
        title="Remove Bet Selection"
        message="Are you sure you want to remove this bet selection? This action cannot be undone."
        confirmText="Remove"
        cancelText="Cancel"
        variant="danger"
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirmDeleteId(null)}
      />

      {/* New Parlay Warning Modal */}
      <ConfirmModal
        isOpen={showNewParlayWarning}
        title="Start New Parlay?"
        message="You have a parlay builder open. Starting a new parlay will close the current one. Continue?"
        confirmText="Continue"
        cancelText="Cancel"
        variant="default"
        onConfirm={() => {
          if (pendingParlayStart) {
            setShowNewParlayWarning(false);
            performStartParlay(pendingParlayStart.selectionId, pendingParlayStart.betId, pendingParlayStart.selectedSide);
            setPendingParlayStart(null);
          }
        }}
        onCancel={() => {
          setShowNewParlayWarning(false);
          setPendingParlayStart(null);
        }}
      />

      {/* Open Parlay Warning Modal */}
      <ConfirmModal
        isOpen={showOpenParlayWarning}
        title="Open Parlay?"
        message="You have a parlay builder open. Opening this parlay will close the current one. Continue?"
        confirmText="Continue"
        cancelText="Cancel"
        variant="default"
        onConfirm={() => {
          if (pendingParlayToOpen) {
            setShowOpenParlayWarning(false);
            performOpenParlay(pendingParlayToOpen);
            setPendingParlayToOpen(null);
          }
        }}
        onCancel={() => {
          setShowOpenParlayWarning(false);
          setPendingParlayToOpen(null);
        }}
      />
    </>
  );
}
