import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { Header } from '../../components/layout/Header';
import { Footer } from '../../components/layout/Footer';
import { BetCreationModal } from '../../components/admin/BetCreationModal';
import { BetEditModal } from '../../components/admin/BetEditModal';

interface Bet {
  id: string;
  betType: string;
  displayText: string;
  priority: number;
  outcome: string;
  config?: any;
  displayTextOverride?: string;
}

interface Game {
  id: string;
  externalId: string;
  sport: string;
  homeTeam: string;
  awayTeam: string;
  startTime: string;
  status: string;
  homeScore: number | null;
  awayScore: number | null;
  metadata: any;
  bets: Bet[];
}

interface SportConfig {
  sport: string;
  leagues: Array<{ id: string; name: string }>;
}

// Helper function to get today's date in local timezone (not UTC)
const getLocalTodayDateString = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Helper function to get timezone offset in hours
const getTimezoneOffset = (): number => {
  // getTimezoneOffset() returns offset in minutes, negative for ahead of UTC
  // We want hours, positive for ahead of UTC (e.g., EST is -5, so offset is -5)
  return -new Date().getTimezoneOffset() / 60;
};

export function BetManagement() {
  const { user, logout } = useAuth();
  const [selectedDate, setSelectedDate] = useState<string>(getLocalTodayDateString());
  const [sportsConfig, setSportsConfig] = useState<SportConfig[]>([]);
  const [selectedSport, setSelectedSport] = useState<string>('basketball');
  const [selectedLeague, setSelectedLeague] = useState<string>('nba');
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [rosterData, setRosterData] = useState<any>(null);
  const [loadingRoster, setLoadingRoster] = useState(false);
  const [expandedGames, setExpandedGames] = useState<Set<string>>(new Set());
  const [editingBet, setEditingBet] = useState<{ bet: Bet; game: Game } | null>(null);
  const [deletingBet, setDeletingBet] = useState<{ bet: Bet; game: Game } | null>(null);
  const [resolvingBet, setResolvingBet] = useState<string | null>(null);
  const [creatingMoneyline, setCreatingMoneyline] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Load sports configuration on mount
  useEffect(() => {
    const loadSports = async () => {
      try {
        const response = await api.getSupportedSports();
        if (response.success && response.data && typeof response.data === 'object' && 'sports' in response.data) {
          const sports = (response.data as { sports: SportConfig[] }).sports;
          setSportsConfig(sports);
          // Set default sport/league if available
          if (sports.length > 0 && sports[0].leagues.length > 0) {
            setSelectedSport(sports[0].sport);
            setSelectedLeague(sports[0].leagues[0].id);
          }
        }
      } catch (error: any) {
        console.error('Failed to load sports:', error);
      }
    };
    loadSports();
  }, []);

  // Update league when sport changes
  useEffect(() => {
    const sportConfig = sportsConfig.find(s => s.sport === selectedSport);
    if (sportConfig && sportConfig.leagues.length > 0) {
      // Check if current league is still valid for this sport
      const leagueExists = sportConfig.leagues.some(l => l.id === selectedLeague);
      if (!leagueExists) {
        setSelectedLeague(sportConfig.leagues[0].id);
      }
    }
  }, [selectedSport, sportsConfig, selectedLeague]);

  // Fetch games from ESPN API, store in DB, and return stored games
  // Memoized to prevent unnecessary re-renders and with request cancellation
  const fetchGames = useCallback(async (force: boolean = false) => {
    if (!selectedSport || !selectedLeague) {
      setError('Please select both sport and league');
      return;
    }

    // Cancel any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller for this request
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoading(true);
    setError(null);
    
    try {
      const timezoneOffset = getTimezoneOffset();
      const response = await api.fetchGamesFromApi(
        selectedDate, 
        selectedSport, 
        selectedLeague, 
        force,
        timezoneOffset
      );
      
      // Check if request was aborted
      if (controller.signal.aborted) {
        return;
      }
      
      if (response.success && response.data && typeof response.data === 'object' && 'games' in response.data) {
        const gamesList = (response.data as { games: Game[] }).games;
        // Sort games by start time to ensure consistent ordering
        const sortedGames = [...gamesList].sort((a, b) => {
          const timeA = new Date(a.startTime).getTime();
          const timeB = new Date(b.startTime).getTime();
          return timeA - timeB;
        });
        setGames(sortedGames);
      } else {
        setGames([]);
      }
    } catch (error: any) {
      // Don't set error if request was aborted
      if (error.name !== 'AbortError' && !controller.signal.aborted) {
        setError(error.message || 'Failed to fetch games');
      }
    } finally {
      // Only update loading state if this is still the current request
      if (!controller.signal.aborted) {
        setLoading(false);
        if (abortControllerRef.current === controller) {
          abortControllerRef.current = null;
        }
      }
    }
  }, [selectedDate, selectedSport, selectedLeague]);

  // Automatically fetch games when date, sport, or league changes
  useEffect(() => {
    // Only fetch if we have sports config loaded and both sport and league are selected
    if (sportsConfig.length > 0 && selectedSport && selectedLeague) {
      fetchGames();
    }
    
    // Cleanup: abort request on unmount or when dependencies change
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, [selectedDate, selectedSport, selectedLeague, sportsConfig, fetchGames]);

  // Handle create bets button click
  const handleCreateBets = async (game: Game) => {
    setLoadingRoster(true);
    setError(null);
    try {
      const response = await api.getGameRoster(game.id);
      if (response.success && response.data) {
        setRosterData(response.data);
        setSelectedGame(game);
      }
    } catch (error: any) {
      setError(error.message || 'Failed to load roster');
    } finally {
      setLoadingRoster(false);
    }
  };

  const handleBetCreated = async () => {
    // Refresh games to show updated bet count
    await fetchGames();
  };

  const handleCloseModal = () => {
    setSelectedGame(null);
    setRosterData(null);
  };

  const toggleGameExpanded = (gameId: string) => {
    setExpandedGames(prev => {
      const newSet = new Set(prev);
      if (newSet.has(gameId)) {
        newSet.delete(gameId);
      } else {
        newSet.add(gameId);
      }
      return newSet;
    });
  };

  const handleEditBet = async (bet: Bet, game: Game) => {
    // Load roster data if needed
    if (!rosterData || selectedGame?.id !== game.id) {
      setLoadingRoster(true);
      try {
        const response = await api.getGameRoster(game.id);
        if (response.success && response.data) {
          setRosterData(response.data);
          setEditingBet({ bet, game });
        }
      } catch (error: any) {
        setError(error.message || 'Failed to load roster');
      } finally {
        setLoadingRoster(false);
      }
    } else {
      setEditingBet({ bet, game });
    }
  };

  const handleBetUpdated = async () => {
    setEditingBet(null);
    await fetchGames();
  };

  const handleDeleteBet = (bet: Bet, game: Game) => {
    setDeletingBet({ bet, game });
  };

  const confirmDeleteBet = async () => {
    if (!deletingBet) return;

    try {
      const response = await api.deleteBet(deletingBet.bet.id);
      if (response.success) {
        setDeletingBet(null);
        await fetchGames();
      } else {
        setError(response.error?.message || 'Failed to delete bet');
      }
    } catch (error: any) {
      setError(error.message || 'Failed to delete bet');
    }
  };

  const handleResolveBet = async (bet: Bet) => {
    if (resolvingBet) return; // Prevent multiple simultaneous resolutions

    setResolvingBet(bet.id);
    setError(null);

    try {
      const response = await api.resolveBet(bet.id);
      if (response.success) {
        // Refresh games to show updated bet outcome
        await fetchGames();
      } else {
        // Extract detailed error message
        const errorCode = response.error?.code;
        const errorDetails = response.error as any; // Type assertion for additional error properties
        let errorMessage = response.error?.message || 'Failed to resolve bet';
        
        // Add more context for specific error codes
        if (errorCode === 'GAME_NOT_STARTED') {
          const timeUntilStart = errorDetails?.timeUntilStartMinutes;
          if (timeUntilStart !== undefined) {
            errorMessage = `Game has not started yet. ${timeUntilStart > 0 ? `Starts in ${timeUntilStart} minutes.` : 'Game is scheduled to start soon.'}`;
          }
        } else if (errorCode === 'ALREADY_RESOLVED') {
          errorMessage = `Bet is already resolved with outcome: ${errorDetails?.currentOutcome || 'unknown'}`;
        } else if (errorCode === 'GAME_INVALID_STATUS') {
          errorMessage = `Cannot resolve bet: Game is ${errorDetails?.gameStatus || 'in an invalid state'}`;
        } else if (errorCode === 'RESOLUTION_FAILED') {
          // Keep the detailed reason from the resolution function
          errorMessage = response.error?.message || 'Bet cannot be resolved at this time';
        } else if (errorCode === 'GAME_DATA_FETCH_FAILED') {
          errorMessage = `Failed to fetch game data: ${errorDetails?.details || 'Unable to retrieve latest game statistics'}`;
        }
        
        setError(errorMessage);
      }
    } catch (error: any) {
      setError(error.message || 'Failed to resolve bet');
    } finally {
      setResolvingBet(null);
    }
  };

  const handleQuickMoneyline = async (game: Game) => {
    if (creatingMoneyline) return; // Prevent multiple simultaneous creations

    setCreatingMoneyline(game.id);
    setError(null);

    try {
      // Extract team IDs from game metadata
      const metadata = (game as any).metadata;
      const apiData = metadata?.apiData;
      
      const homeTeamId = apiData?.teams?.home?.id;
      const awayTeamId = apiData?.teams?.away?.id;

      if (!homeTeamId || !awayTeamId) {
        setError('Game missing team IDs. Please refresh the game data first.');
        setCreatingMoneyline(null);
        return;
      }

      // Create moneyline bet config (home team vs away team, points, FULL_GAME)
      const moneylineConfig = {
        type: 'COMPARISON' as const,
        participant_1: {
          subject_type: 'TEAM' as const,
          subject_id: homeTeamId,
          subject_name: game.homeTeam,
          metric: 'points',
          time_period: 'FULL_GAME' as const
        },
        participant_2: {
          subject_type: 'TEAM' as const,
          subject_id: awayTeamId,
          subject_name: game.awayTeam,
          metric: 'points',
          time_period: 'FULL_GAME' as const
        },
        operator: 'GREATER_THAN' as const
      };

      const response = await api.createBet(game.id, 'COMPARISON', moneylineConfig);
      if (response.success) {
        // Refresh games to show the new bet
        await fetchGames();
      } else {
        setError(response.error?.message || 'Failed to create moneyline bet');
      }
    } catch (error: any) {
      setError(error.message || 'Failed to create moneyline bet');
    } finally {
      setCreatingMoneyline(null);
    }
  };

  const handleMoveBetPriority = async (gameId: string, betId: string, direction: 'up' | 'down') => {
    const game = games.find(g => g.id === gameId);
    if (!game) return;

    const sortedBets = [...game.bets].sort((a, b) => a.priority - b.priority);
    const currentIndex = sortedBets.findIndex(b => b.id === betId);
    
    if (currentIndex === -1) return;
    if (direction === 'up' && currentIndex === 0) return;
    if (direction === 'down' && currentIndex === sortedBets.length - 1) return;

    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    
    // Optimistically update the UI first
    const updatedBets = [...sortedBets];
    [updatedBets[currentIndex], updatedBets[newIndex]] = [updatedBets[newIndex], updatedBets[currentIndex]];
    
    // Update priorities in the optimistic state
    const updatedBetsWithPriority = updatedBets.map((bet, index) => ({
      ...bet,
      priority: index + 1
    }));

    // Update local state immediately
    setGames(prevGames => 
      prevGames.map(g => 
        g.id === gameId 
          ? { ...g, bets: updatedBetsWithPriority }
          : g
      )
    );

    const betIds = updatedBets.map(b => b.id);

    // Then make the API call
    try {
      const response = await api.reorderBets(gameId, betIds);
      if (!response.success) {
        // Revert on error
        setGames(prevGames => 
          prevGames.map(g => 
            g.id === gameId 
              ? { ...g, bets: game.bets } // Revert to original
              : g
          )
        );
        setError(response.error?.message || 'Failed to reorder bets');
      }
    } catch (error: any) {
      // Revert on error
      setGames(prevGames => 
        prevGames.map(g => 
          g.id === gameId 
            ? { ...g, bets: game.bets } // Revert to original
            : g
        )
      );
      setError(error.message || 'Failed to reorder bets');
    }
  };

  const formatDate = (dateString: string) => {
    // Handle YYYY-MM-DD format from date input (treat as local date, not UTC)
    // Or ISO date string from database
    let date: Date;
    if (dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
      // YYYY-MM-DD format (from date input)
      const [year, month, day] = dateString.split('-').map(Number);
      date = new Date(year, month - 1, day); // month is 0-indexed
    } else {
      // ISO date string (from database)
      date = new Date(dateString);
    }
    
    if (isNaN(date.getTime())) {
      return 'Invalid Date';
    }
    
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
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

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      <Header title="Admin: Bet Management" />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Date Selector, Sport/League Selectors & Fetch Button */}
        <div className="bg-slate-900 rounded-lg p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label htmlFor="date" className="block text-sm font-medium text-slate-300 mb-2">
                Select Date
              </label>
              <input
                type="date"
                id="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="sport" className="block text-sm font-medium text-slate-300 mb-2">
                Sport
              </label>
              <select
                id="sport"
                value={selectedSport}
                onChange={(e) => setSelectedSport(e.target.value)}
                className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {sportsConfig.map((sport) => (
                  <option key={sport.sport} value={sport.sport}>
                    {sport.sport.charAt(0).toUpperCase() + sport.sport.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="league" className="block text-sm font-medium text-slate-300 mb-2">
                League
              </label>
              <select
                id="league"
                value={selectedLeague}
                onChange={(e) => setSelectedLeague(e.target.value)}
                className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={!selectedSport}
              >
                {sportsConfig
                  .find((s) => s.sport === selectedSport)
                  ?.leagues.map((league) => (
                    <option key={league.id} value={league.id}>
                      {league.name}
                    </option>
                  ))}
              </select>
            </div>

            <div className="flex items-end gap-3">
              <button
                onClick={() => fetchGames(false)}
                disabled={loading || !selectedSport || !selectedLeague}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg transition font-medium"
              >
                {loading ? 'Fetching...' : 'Fetch Games'}
              </button>
              <button
                onClick={() => fetchGames(true)}
                disabled={loading || !selectedSport || !selectedLeague}
                className="px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg transition font-medium"
                title="Force refresh from ESPN API (bypasses database cache)"
              >
                Force Refresh
              </button>
            </div>
          </div>

          <div className="mt-4 text-sm text-slate-400">
            Viewing games for <span className="text-white font-medium">{formatDate(selectedDate)}</span>
            {selectedSport && selectedLeague && (
              <span className="ml-2">
                • {sportsConfig.find(s => s.sport === selectedSport)?.leagues.find(l => l.id === selectedLeague)?.name || selectedLeague}
              </span>
            )}
            {games.length > 0 && (
              <span className="ml-2">• {games.length} game{games.length !== 1 ? 's' : ''} loaded</span>
            )}
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-900/20 border border-red-800 rounded-lg p-4 mb-6">
            <p className="text-red-400">{error}</p>
          </div>
        )}

        {/* Games List */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-white">
            Games ({games.length})
          </h2>

          {loading ? (
            <div className="bg-slate-900 rounded-lg p-8 text-center">
              <div className="text-4xl mb-4">⏳</div>
              <p className="text-slate-400">Loading games...</p>
            </div>
          ) : games.length === 0 ? (
            <div className="bg-slate-900 rounded-lg p-8 text-center">
              <div className="text-4xl mb-4">📅</div>
              <p className="text-slate-300 mb-2">No games loaded</p>
              <p className="text-slate-500 text-sm">
                Click "Fetch Games" to load games from ESPN API for the selected date
              </p>
            </div>
          ) : (
            <div className="grid gap-4">
              {games.map((game) => {
                const isExpanded = expandedGames.has(game.id);
                const sortedBets = [...game.bets].sort((a, b) => a.priority - b.priority);
                
                return (
                  <div
                    key={game.id}
                    className="bg-slate-900 border border-slate-800 rounded-lg hover:border-slate-700 transition"
                  >
                    {/* Game Header */}
                    <div className="p-6">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          {/* Game Info */}
                          <div className="flex items-center gap-3 mb-3">
                            <button
                              onClick={() => toggleGameExpanded(game.id)}
                              className="text-slate-400 hover:text-white transition"
                            >
                              {isExpanded ? '▼' : '▶'}
                            </button>
                            <span className="text-2xl">
                              {game.sport === 'BASKETBALL' ? '🏀' : 
                               game.sport === 'FOOTBALL' ? '🏈' :
                               game.sport === 'BASEBALL' ? '⚾' :
                               game.sport === 'HOCKEY' ? '🏒' :
                               game.sport === 'SOCCER' ? '⚽' : '🏆'}
                            </span>
                            <div>
                              <div className="text-lg font-semibold text-white">
                                {game.awayTeam} @ {game.homeTeam}
                              </div>
                              <div className="text-sm text-slate-400">
                                {formatTime(game.startTime)} • {formatDate(game.startTime)}
                              </div>
                            </div>
                          </div>

                          {/* Score (if game started) */}
                          {(game.homeScore !== null || game.awayScore !== null) && (
                            <div className="flex gap-4 text-sm mb-3 ml-8">
                              <span className="text-slate-300">
                                {game.awayTeam}: <span className="font-bold text-white">{game.awayScore}</span>
                              </span>
                              <span className="text-slate-300">
                                {game.homeTeam}: <span className="font-bold text-white">{game.homeScore}</span>
                              </span>
                            </div>
                          )}

                          {/* Status Badge */}
                          <div className="flex gap-2 items-center ml-8">
                            <span
                              className={`px-2 py-1 text-xs font-medium rounded ${
                                game.status === 'completed'
                                  ? 'bg-green-900/50 text-green-400'
                                  : game.status === 'in_progress'
                                  ? 'bg-yellow-900/50 text-yellow-400'
                                  : 'bg-slate-800 text-slate-400'
                              }`}
                            >
                              {game.status.replace('_', ' ').toUpperCase()}
                            </span>
                            
                            {/* Bet Count */}
                            <span className="px-2 py-1 text-xs font-medium rounded bg-blue-900/50 text-blue-400">
                              {game.bets.length} bet{game.bets.length !== 1 ? 's' : ''}
                            </span>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleQuickMoneyline(game)}
                            disabled={creatingMoneyline === game.id}
                            className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg transition text-sm font-medium"
                            title="Quickly create a moneyline bet (home team vs away team)"
                          >
                            {creatingMoneyline === game.id ? 'Creating...' : 'Quick Moneyline'}
                          </button>
                          <button
                            onClick={() => handleCreateBets(game)}
                            disabled={loadingRoster}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg transition text-sm font-medium"
                          >
                            {loadingRoster ? 'Loading...' : 'Create Bets'}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Bets Accordion */}
                    {isExpanded && sortedBets.length > 0 && (
                      <div className="border-t border-slate-800 p-4 space-y-2">
                        {sortedBets.map((bet, index) => (
                          <div
                            key={bet.id}
                            className="bg-slate-800 rounded-lg p-4 flex items-center justify-between hover:bg-slate-750 transition"
                          >
                            <div className="flex items-center gap-3 flex-1">
                              <div className="flex flex-col gap-1">
                                <button
                                  onClick={() => handleMoveBetPriority(game.id, bet.id, 'up')}
                                  disabled={index === 0}
                                  className="text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed text-xs"
                                  title="Move up"
                                >
                                  ▲
                                </button>
                                <button
                                  onClick={() => handleMoveBetPriority(game.id, bet.id, 'down')}
                                  disabled={index === sortedBets.length - 1}
                                  className="text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed text-xs"
                                  title="Move down"
                                >
                                  ▼
                                </button>
                              </div>
                              
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-xs font-medium text-slate-400">#{bet.priority}</span>
                                  <span className="text-sm font-medium text-white">
                                    {bet.displayTextOverride || bet.displayText}
                                  </span>
                                  <span
                                    className={`px-2 py-0.5 text-xs font-medium rounded ${
                                      bet.outcome === 'win'
                                        ? 'bg-green-900/50 text-green-400'
                                        : bet.outcome === 'loss'
                                        ? 'bg-red-900/50 text-red-400'
                                        : bet.outcome === 'push'
                                        ? 'bg-yellow-900/50 text-yellow-400'
                                        : bet.outcome === 'void'
                                        ? 'bg-slate-700 text-slate-300'
                                        : 'bg-slate-700 text-slate-400'
                                    }`}
                                  >
                                    {bet.outcome.toUpperCase()}
                                  </span>
                                </div>
                                <div className="text-xs text-slate-500">
                                  {bet.betType}
                                </div>
                              </div>
                            </div>

                            <div className="flex gap-2">
                              <button
                                onClick={() => handleResolveBet(bet)}
                                disabled={
                                  resolvingBet === bet.id || 
                                  bet.outcome !== 'pending' ||
                                  game.status === 'scheduled' ||
                                  new Date(game.startTime) > new Date()
                                }
                                className="px-3 py-1.5 text-xs bg-green-900/50 hover:bg-green-900/70 disabled:bg-slate-700 disabled:text-slate-500 text-green-400 rounded transition"
                                title={
                                  bet.outcome !== 'pending' 
                                    ? 'Bet already resolved' 
                                    : game.status === 'scheduled' || new Date(game.startTime) > new Date()
                                    ? 'Game has not started yet'
                                    : 'Manually resolve this bet'
                                }
                              >
                                {resolvingBet === bet.id ? 'Resolving...' : 'Resolve'}
                              </button>
                              <button
                                onClick={() => handleEditBet(bet, game)}
                                className="px-3 py-1.5 text-xs bg-slate-700 hover:bg-slate-600 text-white rounded transition"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDeleteBet(bet, game)}
                                className="px-3 py-1.5 text-xs bg-red-900/50 hover:bg-red-900/70 text-red-400 rounded transition"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {isExpanded && sortedBets.length === 0 && (
                      <div className="border-t border-slate-800 p-4 text-center text-slate-400 text-sm">
                        No bets created yet. Click "Create Bets" to add some.
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Bet Creation Modal */}
      {selectedGame && (
        <BetCreationModal
          game={selectedGame}
          rosterData={rosterData}
          onClose={handleCloseModal}
          onBetCreated={handleBetCreated}
        />
      )}

      {/* Bet Edit Modal */}
      {editingBet && (
        <BetEditModal
          bet={editingBet.bet}
          game={editingBet.game}
          rosterData={rosterData}
          onClose={() => setEditingBet(null)}
          onBetUpdated={handleBetUpdated}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deletingBet && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-900 rounded-lg border border-slate-700 p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold text-white mb-4">Delete Bet</h3>
            <p className="text-slate-300 mb-2">
              Are you sure you want to delete this bet?
            </p>
            <div className="bg-slate-800 rounded p-3 mb-6">
              <p className="text-white font-medium">{deletingBet.bet.displayText}</p>
              <p className="text-slate-400 text-sm mt-1">
                {deletingBet.game.awayTeam} @ {deletingBet.game.homeTeam}
              </p>
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeletingBet(null)}
                className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 transition"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteBet}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
      <Footer />
    </div>
  );
}

