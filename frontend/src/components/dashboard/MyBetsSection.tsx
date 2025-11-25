import { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { useParlay } from '../../context/ParlayContext';
import { useBets } from '../../context/BetsContext';
import { ConfirmModal } from '../common/ConfirmModal';
import { BetSelectionGroup } from '../bets/BetSelectionGroup';
import { DateNavigation, formatDateDisplay } from './DateNavigation';
import { SingleBetCard } from './SingleBetCard';
import { ParlayCard } from './ParlayCard';
import { AvailableBetsSection } from './AvailableBetsSection';

interface BetSelection {
  id: string;
  betId: string;
  selectedSide: string;
  status: string;
  outcome?: string; // 'win', 'loss', 'push' - only set when resolved
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
      homeScore?: number | null;
      awayScore?: number | null;
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
  outcome?: string; // 'win', 'loss', 'push' - only set when resolved
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

interface HistoricalGame {
  id: string;
  homeTeam: string;
  awayTeam: string;
  startTime: string;
  status: string;
  sport: string;
  homeScore?: number | null;
  awayScore?: number | null;
  bets: Array<{
    id: string;
    displayText: string;
    betType: string;
    outcome: string;
    priority: number;
    config?: any;
  }>;
  metadata?: any;
}

export function MyBetsSection() {
  const { activeParlay, setActiveParlay, isParlayBuilderOpen, setIsParlayBuilderOpen } = useParlay();
  const { refreshTrigger, setSelectedDate: setContextSelectedDate } = useBets();
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
  const [historicalGames, setHistoricalGames] = useState<HistoricalGame[]>([]);
  const [loadingHistorical, setLoadingHistorical] = useState(false);
  
  // Date navigation state - default to today
  const getTodayDateString = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  const [selectedDate, setSelectedDateState] = useState<string>(getTodayDateString());
  
  // Sync selected date with context so TodaysBetsSection can access it
  const setSelectedDate = (date: string) => {
    setSelectedDateState(date);
    setContextSelectedDate(date);
  };
  
  // Initialize context on mount
  useEffect(() => {
    setContextSelectedDate(selectedDate);
  }, []);
  
  // Get timezone offset in hours
  const getTimezoneOffset = () => {
    return -new Date().getTimezoneOffset() / 60;
  };

  useEffect(() => {
    // Only refresh if builder is closed, or if it's a non-parlay operation (like delete)
    // This prevents UI updates while user is building a parlay
    if (!isParlayBuilderOpen) {
      fetchMyData();
    }
  }, [refreshTrigger, isParlayBuilderOpen, selectedDate]);

  const fetchMyData = async () => {
    // Don't set loading to true if we already have data - prevents jump
    const isInitialLoad = selections.length === 0 && parlays.length === 0;
    if (isInitialLoad) {
      setLoading(true);
    }
    setError(null);
    try {
      // Fetch single bets (selections with no parlay) for the selected date
      const selectionsResponse = await api.getMySelections(selectedDate, getTimezoneOffset());
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

      // Fetch parlays - show all statuses for the selected date (not just 'building')
      // This allows viewing historical parlays (locked, won, lost, etc.)
      const parlaysResponse = await api.getParlays(undefined, true, selectedDate, getTimezoneOffset());
      if (parlaysResponse.success && parlaysResponse.data) {
        const data = parlaysResponse.data as { parlays?: Parlay[] };
        // Filter out invalid parlays (betCount < 2)
        const validParlays = (data.parlays || []).filter(p => p.betCount >= 2);
        setParlays(validParlays);
      } else {
        setParlays([]);
      }

      // Fetch historical bets available on the selected date
      await fetchHistoricalBets();
    } catch (error: any) {
      setError(error.message || 'Failed to load your bets');
      setSelections([]);
      setParlays([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchHistoricalBets = async () => {
    setLoadingHistorical(true);
    try {
      const response = await api.getTodaysBets(selectedDate, getTimezoneOffset());
      if (response.success && response.data?.games) {
        const sortedGames = [...response.data.games].sort((a, b) => {
          const timeA = new Date(a.startTime).getTime();
          const timeB = new Date(b.startTime).getTime();
          return timeA - timeB;
        });
        setHistoricalGames(sortedGames);
      } else {
        setHistoricalGames([]);
      }
    } catch (error: any) {
      console.error('Error fetching historical bets:', error);
      setHistoricalGames([]);
    } finally {
      setLoadingHistorical(false);
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

  const getTeamName = (participant: any, game: any): string => {
    if (participant?.subject_type === 'TEAM') {
      const metadata = game.metadata;
      const apiData = metadata?.apiData;
      if (apiData?.teams?.home?.id === participant.subject_id) {
        return game.homeTeam;
      } else if (apiData?.teams?.away?.id === participant.subject_id) {
        return game.awayTeam;
      }
    }
    return participant?.subject_name || 'Unknown';
  };

  // Format a resolved bet for display when we don't have a user selection
  // Shows what actually happened based on outcome and scores
  const formatResolvedBetText = (bet: any, game: any): string => {
    if (!bet.outcome || bet.outcome === 'pending' || !bet.config) {
      return bet.displayText;
    }

    if (bet.betType === 'COMPARISON' && bet.config) {
      const compConfig = bet.config;
      const p1 = compConfig.participant_1;
      const p2 = compConfig.participant_2;
      
      if (p1?.subject_type === 'TEAM' && p2?.subject_type === 'TEAM' && 
          game.homeScore !== null && game.awayScore !== null) {
        const name1 = getTeamName(p1, game);
        const name2 = getTeamName(p2, game);
        const shortName1 = name1.split(' ').pop() || name1;
        const shortName2 = name2.split(' ').pop() || name2;
        
        // Determine which team won based on scores
        const p1IsHome = game.metadata?.apiData?.teams?.home?.id === p1?.subject_id;
        const p1Score = p1IsHome ? game.homeScore : game.awayScore;
        const p2Score = p1IsHome ? game.awayScore : game.homeScore;
        
        if (p1Score > p2Score) {
          return `${shortName1} over ${shortName2} (${p1Score}-${p2Score})`;
        } else if (p2Score > p1Score) {
          return `${shortName2} over ${shortName1} (${p2Score}-${p1Score})`;
        } else {
          return `${shortName1} vs ${shortName2} (${p1Score}-${p2Score})`;
        }
      }
    }
    
    return bet.displayText;
  };

  const formatSelectionText = (side: string, betType: string, config: any, game: any, outcome?: string) => {
    if (betType === 'COMPARISON' && config) {
      const compConfig = config;
      const p1 = compConfig.participant_1;
      const p2 = compConfig.participant_2;
      
      let name1 = getTeamName(p1, game);
      let name2 = getTeamName(p2, game);
      
      // Use short names for display
      const shortName1 = name1.split(' ').pop() || name1;
      const shortName2 = name2.split(' ').pop() || name2;
      
      // Handle spread
      if (compConfig.spread) {
        const spreadValue = compConfig.spread.value;
        const spreadDir = compConfig.spread.direction;
        if (side === 'participant_1') {
          name1 = spreadDir === '+' ? `${shortName1} +${spreadValue}` : `${shortName1} -${spreadValue}`;
        } else {
          name2 = spreadDir === '+' ? `${shortName2} +${spreadValue}` : `${shortName2} -${spreadValue}`;
        }
      } else {
        name1 = shortName1;
        name2 = shortName2;
      }
      
      // If bet is resolved, show what actually happened with scores
      if (outcome && outcome !== 'pending' && game.homeScore !== null && game.awayScore !== null) {
        // Determine which participant won based on outcome and user's selection
        let winner: any;
        let loser: any;
        let winnerScore: number;
        let loserScore: number;
        
        if (outcome === 'push') {
          // Push means tie - show both teams with same score
          const p1IsHome = game.metadata?.apiData?.teams?.home?.id === p1?.subject_id;
          const p1Score = p1IsHome ? game.homeScore : game.awayScore;
          return `${shortName1} vs ${shortName2} (${p1Score}-${p1Score})`;
        } else if (outcome === 'win') {
          // User's selection won
          winner = side === 'participant_1' ? p1 : p2;
          loser = side === 'participant_1' ? p2 : p1;
        } else {
          // outcome === 'loss' - user's selection lost, so the other participant won
          winner = side === 'participant_1' ? p2 : p1;
          loser = side === 'participant_1' ? p1 : p2;
        }
        
        // Get scores for winner and loser
        const winnerIsHome = game.metadata?.apiData?.teams?.home?.id === winner?.subject_id;
        winnerScore = winnerIsHome ? game.homeScore : game.awayScore;
        loserScore = winnerIsHome ? game.awayScore : game.homeScore;
        
        const winnerShortName = (winner === p1 ? shortName1 : shortName2);
        const loserShortName = (winner === p1 ? shortName2 : shortName1);
        
        return `${winnerShortName} over ${loserShortName} (${winnerScore}-${loserScore})`;
      }
      
      // Not resolved yet - show user's selection
      return side === 'participant_1' ? `${name1} over ${name2}` : `${name2} over ${name1}`;
    } else if (betType === 'THRESHOLD' && config) {
      const threshold = config.threshold;
      const participant = config.participant;
      let name = getTeamName(participant, game);
      const shortName = name.split(' ').pop() || name;
      
      // If resolved, show what actually happened
      if (outcome && outcome !== 'pending' && game.homeScore !== null && game.awayScore !== null && participant?.subject_type === 'TEAM') {
        const pIsHome = game.metadata?.apiData?.teams?.home?.id === participant?.subject_id;
        const pScore = pIsHome ? game.homeScore : game.awayScore;
        return `${shortName} ${side} ${threshold} (${pScore})`;
      }
      
      return side === 'over' ? `${shortName} over ${threshold}` : `${shortName} under ${threshold}`;
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

  // Check if viewing past dates
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const selected = new Date(selectedDate + 'T00:00:00');
  selected.setHours(0, 0, 0, 0);
  const isPastDate = selected < today;
  const isTodayOrFuture = selected >= today;
  
  // Always show the date selector, even when there are no bets
  // This allows users to navigate to historical bets
  const hasUserBets = selections.length > 0 || parlays.length > 0;
  const emptyState = !hasUserBets && !loading;

  // Combine all bets into one list for unified display
  const allBets = [
    ...selections.map(s => ({ type: 'single' as const, data: s })),
    ...parlays.map(p => ({ type: 'parlay' as const, data: p }))
  ];

  return (
    <>
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold text-white">
                My Bets
              </h2>
              <DateNavigation
                selectedDate={selectedDate}
                onDateChange={setSelectedDate}
              />
            </div>
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

        {/* For past dates, always show "Bets You Made" section */}
        {isPastDate && (
          <div className="mt-6">
            <h3 className="text-lg font-semibold text-slate-300 mb-4">
              Bets You Made for {formatDateDisplay(selectedDate)}
            </h3>
            {hasUserBets ? (
              <div className="grid gap-3">
                {allBets.map((bet) => {
                  if (bet.type === 'single') {
                    const selection = bet.data;
                    const canModify = selection.bet.game.status === 'scheduled' && selection.status !== 'locked';
                    
                    return (
                      <SingleBetCard
                        key={selection.id}
                        selection={selection}
                        formatSelectionText={formatSelectionText}
                        formatTime={formatTime}
                        getSportEmoji={getSportEmoji}
                        isBetInActiveParlay={isBetInActiveParlay}
                        canModify={canModify}
                        startingParlayId={startingParlayId}
                        deletingId={deletingId}
                        onStartParlay={handleStartParlay}
                        onDelete={setConfirmDeleteId}
                      />
                    );
                  } else {
                    return (
                      <ParlayCard
                        key={bet.data.id}
                        parlay={bet.data}
                        formatSelectionText={formatSelectionText}
                        formatTime={formatTime}
                        getSportEmoji={getSportEmoji}
                        onOpenParlay={handleOpenParlay}
                      />
                    );
                  }
                })}
              </div>
            ) : (
              <div className="bg-slate-900 rounded-lg p-8 text-center border border-slate-800">
                <div className="text-4xl mb-4">📝</div>
                <p className="text-slate-300 mb-2">No bets made for {formatDateDisplay(selectedDate)}</p>
                <p className="text-slate-500 text-sm">
                  You didn't make any bet selections on this date
                </p>
              </div>
            )}
          </div>
        )}

        {/* For today/future dates, show bets list normally */}
        {isTodayOrFuture && !emptyState && (
          <div className="grid gap-3 mt-6">
            {allBets.map((bet) => {
              if (bet.type === 'single') {
                const selection = bet.data;
                const canModify = selection.bet.game.status === 'scheduled' && selection.status !== 'locked';
                
                return (
                  <SingleBetCard
                    key={selection.id}
                    selection={selection}
                    formatSelectionText={formatSelectionText}
                    formatTime={formatTime}
                    getSportEmoji={getSportEmoji}
                    isBetInActiveParlay={isBetInActiveParlay}
                    canModify={canModify}
                    startingParlayId={startingParlayId}
                    deletingId={deletingId}
                    onStartParlay={handleStartParlay}
                    onDelete={setConfirmDeleteId}
                  />
                );
              } else {
                return (
                  <ParlayCard
                    key={bet.data.id}
                    parlay={bet.data}
                    formatSelectionText={formatSelectionText}
                    formatTime={formatTime}
                    getSportEmoji={getSportEmoji}
                    onOpenParlay={handleOpenParlay}
                  />
                );
              }
            })}
          </div>
        )}

        {/* Empty state for today/future when no bets */}
        {isTodayOrFuture && emptyState && (
          <div className="bg-slate-900 rounded-lg p-8 text-center mt-6">
            <div className="text-4xl mb-4">📝</div>
            <p className="text-slate-300 mb-2">No bets for {formatDateDisplay(selectedDate)}</p>
            <p className="text-slate-500 text-sm">
              Browse available bets below and make your selections
            </p>
          </div>
        )}

        {/* Available Bets - Only show for past/future dates (TodaysBetsSection handles today) */}
        {/* Always show for past dates, show for future dates if games exist */}
        {(isPastDate || (selected > today && (historicalGames.length > 0 || loadingHistorical))) && (
          <div className="mt-8">
            <h3 className="text-lg font-semibold text-slate-300 mb-4">
              Available Bets for {formatDateDisplay(selectedDate)}
            </h3>
            <AvailableBetsSection
              games={historicalGames}
              selections={selections}
              formatResolvedBetText={formatResolvedBetText}
              formatTime={formatTime}
              getSportEmoji={getSportEmoji}
              selectedDate={selectedDate}
              loading={loadingHistorical}
              isPastDate={isPastDate}
            />
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
