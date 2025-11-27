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
import { getTeamName, formatResolvedBetText, formatTime, getSportEmoji, getTodayDateString, getTimezoneOffset, formatSelectionText } from '../../utils/formatting';

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
  const [error, setError] = useState<{message: string, code: string} | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [startingParlayId, setStartingParlayId] = useState<string | null>(null);
  const [showNewParlayWarning, setShowNewParlayWarning] = useState(false);
  const [pendingParlayStart, setPendingParlayStart] = useState<{ selectionId: string; betId: string; selectedSide: string } | null>(null);
  const [showOpenParlayWarning, setShowOpenParlayWarning] = useState(false);
  const [pendingParlayToOpen, setPendingParlayToOpen] = useState<Parlay | null>(null);
  const [historicalGames, setHistoricalGames] = useState<HistoricalGame[]>([]);
  const [loadingHistorical, setLoadingHistorical] = useState(false);
  const [resendingEmail, setResendingEmail] = useState(false);
  const [resendEmailSuccess, setResendEmailSuccess] = useState(false);
  
  // Date navigation state - default to today
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
        // Check if there's an error with code
        if (selectionsResponse.error) {
          setError({
            message: selectionsResponse.error.message || 'Failed to load your bets',
            code: selectionsResponse.error.code || ''
          });
          setSelections([]);
          setParlays([]);
          setLoading(false);
          return;
        }
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
        // Check if there's an error with code
        if (parlaysResponse.error) {
          setError({
            message: parlaysResponse.error.message || 'Failed to load your bets',
            code: parlaysResponse.error.code || ''
          });
          setSelections([]);
          setParlays([]);
          setLoading(false);
          return;
        }
        setParlays([]);
      }

      // Fetch historical bets available on the selected date
      await fetchHistoricalBets();
    } catch (error: any) {
      let errorCode = error?.code || '';
      const errorMessage = error?.message || 'Failed to load your bets';
      
      // Fallback: check if message indicates email verification
      const lowerMessage = errorMessage.toLowerCase();
      if (!errorCode && (lowerMessage.includes('email verification') || lowerMessage.includes('verify your email'))) {
        errorCode = 'EMAIL_NOT_VERIFIED';
      }
      
      setError({
        message: errorMessage,
        code: errorCode
      });
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






  // Check if a bet is in the active parlay builder
  const isBetInActiveParlay = (selectionId: string, betId: string): boolean => {
    if (!activeParlay || !isParlayBuilderOpen) return false;
    return activeParlay.selections.some(
      sel => sel.id === selectionId || sel.bet.id === betId
    );
  };

  const handleResendVerificationEmail = async () => {
    setResendingEmail(true);
    // Don't clear the error - keep it visible with the confirmation

    try {
      const response = await api.resendVerificationEmail();
      if (response.success) {
        setResendEmailSuccess(true);
      }
    } catch (err: any) {
      setError({ message: err.message || 'Failed to resend verification email', code: 'EMAIL_NOT_VERIFIED' });
    } finally {
      setResendingEmail(false);
    }
  };


  if (loading && selections.length === 0 && parlays.length === 0) {
    return (
      <div className="bg-slate-900 rounded-lg p-6 sm:p-8 text-center animate-pulse">
        <div className="text-3xl sm:text-4xl mb-4">⏳</div>
        <p className="text-sm sm:text-base text-slate-400">Loading your bets...</p>
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
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-0">
          <div className="flex-1 w-full sm:w-auto">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <h2 className="text-xl sm:text-2xl font-bold text-white">
                My Bets
              </h2>
              <DateNavigation
                selectedDate={selectedDate}
                onDateChange={setSelectedDate}
              />
            </div>
            <p className="text-slate-400 text-xs sm:text-sm mt-1">
              {selections.length} single bet{selections.length !== 1 ? 's' : ''} • {parlays.length} parlay{parlays.length !== 1 ? 's' : ''}
            </p>
          </div>
          <button
            onClick={fetchMyData}
            className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 transition text-sm w-full sm:w-auto"
          >
            Refresh
          </button>
        </div>

        {error && error.code === 'EMAIL_NOT_VERIFIED' && (
          <div className="bg-red-900/20 border border-red-800 rounded-lg p-3 sm:p-4">
            <p className="text-sm sm:text-base text-red-400 mb-3">{error.message}</p>
            <div className="space-y-2">
              <button
                onClick={handleResendVerificationEmail}
                disabled={resendingEmail}
                className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {resendingEmail ? 'Sending...' : 'Resend Verification Email'}
              </button>
              {resendEmailSuccess && (
                <p className="text-green-400 text-sm mt-2">Verification email sent! Please check your inbox.</p>
              )}
            </div>
          </div>
        )}

        {/* For past dates, always show "Bets You Made" section */}
        {isPastDate && (
          <div className="mt-6">
            <h3 className="text-base sm:text-lg font-semibold text-slate-300 mb-4">
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
              <div className="bg-slate-900 rounded-lg p-6 sm:p-8 text-center border border-slate-800">
                <div className="text-3xl sm:text-4xl mb-4">📝</div>
                <p className="text-sm sm:text-base text-slate-300 mb-2">No bets made for {formatDateDisplay(selectedDate)}</p>
                <p className="text-xs sm:text-sm text-slate-500">
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
          <div className="bg-slate-900 rounded-lg p-6 sm:p-8 text-center mt-6 border border-slate-800">
            <div className="text-3xl sm:text-4xl mb-4">📝</div>
            <p className="text-sm sm:text-base text-slate-300 mb-2">No bets for {formatDateDisplay(selectedDate)}</p>
            <p className="text-xs sm:text-sm text-slate-500">
              Browse available bets below and make your selections
            </p>
          </div>
        )}

        {/* Available Bets - Only show for past/future dates (TodaysBetsSection handles today) */}
        {/* Always show for past dates, show for future dates if games exist */}
        {(isPastDate || (selected > today && (historicalGames.length > 0 || loadingHistorical))) && (
          <div className="mt-8">
            <h3 className="text-base sm:text-lg font-semibold text-slate-300 mb-4">
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
