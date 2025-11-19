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
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [startingParlayId, setStartingParlayId] = useState<string | null>(null);
  const [showNewParlayWarning, setShowNewParlayWarning] = useState(false);
  const [pendingParlayStart, setPendingParlayStart] = useState<{ selectionId: string; betId: string; selectedSide: string } | null>(null);
  const [showOpenParlayWarning, setShowOpenParlayWarning] = useState(false);
  const [pendingParlayToOpen, setPendingParlayToOpen] = useState<Parlay | null>(null);

  useEffect(() => {
    // Only refresh if builder is closed, or if it's a non-parlay operation (like delete)
    // This prevents UI updates while user is building a parlay
    if (!isParlayBuilderOpen) {
      fetchMyData();
    }
  }, [refreshTrigger, isParlayBuilderOpen]);

  const fetchMyData = async () => {
    // Don't set loading to true if we already have data - prevents jump
    const isInitialLoad = selections.length === 0 && parlays.length === 0;
    if (isInitialLoad) {
      setLoading(true);
    }
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
        // Only refresh if builder is closed (it will be after conversion)
        if (!isParlayBuilderOpen) {
          await fetchMyData();
        }
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
      // Note: We temporarily close the builder to allow refresh, then reopen with new parlay
      if (activeParlay && activeParlay.betCount === 1 && isParlayBuilderOpen) {
        try {
          await api.deleteParlay(activeParlay.id);
          setIsParlayBuilderOpen(false); // Temporarily close to allow refresh
          await fetchMyData(); // Refresh to show the converted single bet
          // Builder will be reopened below when new parlay is set
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
          // Don't refresh - bet will show overlay instead
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

  const formatSelectionText = (side: string, betType: string, config: any, game: any) => {
    if (betType === 'COMPARISON' && config) {
      const compConfig = config;
      const p1 = compConfig.participant_1;
      const p2 = compConfig.participant_2;
      
      let name1 = p1?.subject_name || 'A';
      let name2 = p2?.subject_name || 'B';
      
      // Use short names if available
      if (p1?.subject_type === 'TEAM') {
        const metadata = game.metadata;
        const apiData = metadata?.apiData;
        if (apiData?.teams?.home?.id === p1.subject_id) {
          name1 = game.homeTeam.split(' ').pop() || name1;
        } else if (apiData?.teams?.away?.id === p1.subject_id) {
          name1 = game.awayTeam.split(' ').pop() || name1;
        }
      }
      
      if (p2?.subject_type === 'TEAM') {
        const metadata = game.metadata;
        const apiData = metadata?.apiData;
        if (apiData?.teams?.home?.id === p2.subject_id) {
          name2 = game.homeTeam.split(' ').pop() || name2;
        } else if (apiData?.teams?.away?.id === p2.subject_id) {
          name2 = game.awayTeam.split(' ').pop() || name2;
        }
      }
      
      // Handle spread
      if (compConfig.spread) {
        const spreadValue = compConfig.spread.value;
        const spreadDir = compConfig.spread.direction;
        if (side === 'participant_1') {
          name1 = spreadDir === '+' ? `${name1} +${spreadValue}` : `${name1} -${spreadValue}`;
        } else {
          name2 = spreadDir === '+' ? `${name2} +${spreadValue}` : `${name2} -${spreadValue}`;
        }
      }
      
      return side === 'participant_1' ? `${name1} over ${name2}` : `${name2} over ${name1}`;
    } else if (betType === 'THRESHOLD' && config) {
      const threshold = config.threshold;
      const participant = config.participant;
      let name = participant?.subject_name || 'Player';
      
      // Use short name
      if (participant?.subject_type === 'TEAM') {
        const metadata = game.metadata;
        const apiData = metadata?.apiData;
        if (apiData?.teams?.home?.id === participant.subject_id) {
          name = game.homeTeam.split(' ').pop() || name;
        } else if (apiData?.teams?.away?.id === participant.subject_id) {
          name = game.awayTeam.split(' ').pop() || name;
        }
      }
      
      return side === 'over' ? `${name} over ${threshold}` : `${name} under ${threshold}`;
    } else if (betType === 'EVENT' && config) {
      const event = config.event || 'Event';
      return side === 'yes' ? `${event} ✓` : `${event} ✗`;
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

  // Check if a bet is in the active parlay builder
  const isBetInActiveParlay = (selectionId: string, betId: string): boolean => {
    if (!activeParlay || !isParlayBuilderOpen) return false;
    return activeParlay.selections.some(
      sel => sel.id === selectionId || sel.bet.id === betId
    );
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

  if (loading && selections.length === 0 && parlays.length === 0) {
    return (
      <div className="bg-slate-900 rounded-lg p-8 text-center animate-pulse">
        <div className="text-4xl mb-4">⏳</div>
        <p className="text-slate-400">Loading your bets...</p>
      </div>
    );
  }

  if (error && selections.length === 0 && parlays.length === 0) {
    return (
      <div className="bg-red-900/20 border border-red-800 rounded-lg p-4">
        <p className="text-red-400">{error}</p>
      </div>
    );
  }

  if (selections.length === 0 && parlays.length === 0 && !loading) {
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

  // Combine all bets into one list for unified display
  const allBets = [
    ...selections.map(s => ({ type: 'single' as const, data: s })),
    ...parlays.map(p => ({ type: 'parlay' as const, data: p }))
  ];

  return (
    <>
      <div className="space-y-4">
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

        {error && (
          <div className="bg-red-900/20 border border-red-800 rounded-lg p-3">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {/* Unified Bets List */}
        <div className="grid gap-3">
          {allBets.map((bet) => {
            if (bet.type === 'single') {
              const selection = bet.data;
              const canModify = selection.bet.game.status === 'scheduled' && selection.status !== 'locked';
              const inBuilder = isBetInActiveParlay(selection.id, selection.bet.id);
              
              return (
                <div
                  key={selection.id}
                  className={`bg-slate-900 border rounded-lg px-3 py-2 transition-all duration-200 relative ${
                    inBuilder
                      ? 'border-blue-500 border-2'
                      : 'border-slate-800 hover:border-slate-700'
                  }`}
                >
                  {/* Greyed out overlay for bets in parlay builder */}
                  {inBuilder && (
                    <>
                      <div className="absolute inset-0 bg-slate-950/85 rounded-lg z-20 pointer-events-none" />
                      <div className="absolute top-1.5 right-1.5 z-30">
                        <span className="px-1.5 py-0.5 bg-blue-600 text-white rounded text-xs font-medium border border-blue-500 shadow-lg">
                          In Builder
                        </span>
                      </div>
                    </>
                  )}
                  <div className="flex items-center gap-3">
                    <span className="text-lg flex-shrink-0">{getSportEmoji(selection.bet.game.sport)}</span>
                    <span className="text-xs text-slate-400 flex-shrink-0">{formatTime(selection.bet.game.startTime)}</span>
                    <span className="flex-1 text-sm text-white font-medium truncate">
                      {formatSelectionText(selection.selectedSide, selection.bet.betType, selection.bet.config, selection.bet.game)}
                    </span>
                    {selection.status === 'locked' && (
                      <span className="px-1.5 py-0.5 rounded text-xs font-medium flex-shrink-0 bg-yellow-900/30 text-yellow-400 border border-yellow-600/30">
                        🔒
                      </span>
                    )}
                    {canModify && (
                      <div className="flex gap-1.5 flex-shrink-0">
                        <button
                          onClick={() => handleStartParlay(selection.id, selection.bet.id, selection.selectedSide)}
                          disabled={startingParlayId === selection.id}
                          className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {startingParlayId === selection.id ? '...' : 'Make Parlay'}
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(selection.id)}
                          disabled={deletingId === selection.id}
                          className="px-2 py-1 bg-red-900/30 text-red-400 rounded hover:bg-red-900/50 text-xs font-medium border border-red-800/50 disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Remove"
                        >
                          {deletingId === selection.id ? '...' : '×'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            } else {
              const parlay = bet.data;
              const isLocked = parlay.lockedAt !== null && parlay.lockedAt !== undefined;

              return (
                <div
                  key={parlay.id}
                  className="bg-gradient-to-br from-blue-900/20 to-slate-900 border-2 border-blue-800/50 rounded-lg px-3 py-2 hover:border-blue-700/50 transition-all duration-200"
                >
                  <div className="flex items-center gap-3">
                    <span className="px-2 py-0.5 bg-blue-600 text-white rounded text-xs font-bold border border-blue-500 flex-shrink-0">
                    {parlay.betCount} LEG PARLAY
                    </span>
                    {parlay.insured && (
                      <span className="px-1.5 py-0.5 bg-orange-900/30 text-orange-400 rounded text-xs font-medium border border-orange-600/30 flex-shrink-0">
                        INSURED
                      </span>
                    )}
                    {isLocked && (
                      <span className="px-1.5 py-0.5 bg-yellow-900/30 text-yellow-400 rounded text-xs font-medium border border-yellow-600/30 flex-shrink-0">
                        🔒
                      </span>
                    )}
                    <div className="flex items-center gap-2 flex-1 min-w-0 overflow-x-auto">
                      {parlay.selections.map((selection, idx) => (
                        <div key={selection.id} className="flex items-center gap-1.5 flex-shrink-0">
                          {idx > 0 && <span className="text-slate-500">•</span>}
                          <span className="text-xs">{getSportEmoji(selection.game.sport)}</span>
                          <span className="text-xs text-slate-400">{formatTime(selection.game.startTime)}</span>
                          <span className="text-xs text-white font-medium whitespace-nowrap">
                            {formatSelectionText(selection.selectedSide, selection.bet.betType, selection.bet.config, selection.game)}
                          </span>
                          {selection.status === 'locked' && (
                            <span className="px-1 py-0.5 rounded text-xs flex-shrink-0 bg-yellow-900/30 text-yellow-400">
                              🔒
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                    {!isLocked && (
                      <button
                        onClick={() => handleOpenParlay(parlay)}
                        className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-medium flex-shrink-0"
                      >
                        Open
                      </button>
                    )}
                  </div>
                </div>
              );
            }
          })}
        </div>
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
