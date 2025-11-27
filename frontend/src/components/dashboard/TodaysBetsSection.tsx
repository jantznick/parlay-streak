import { useState, useEffect } from 'react';
import { BetSelectionGroup } from '../bets/BetSelectionGroup';
import { useBets } from '../../context/BetsContext';
import { api } from '../../services/api';
import { getSportEmoji, getTodayDateString, getTimezoneOffset } from '../../utils/formatting';

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
  sport: string;
  homeTeam: string;
  awayTeam: string;
  startTime: string;
  status: string;
  homeScore: number | null;
  awayScore: number | null;
  bets: Bet[];
  metadata?: any;
}

export function TodaysBetsSection() {
  const { selectedDate } = useBets();
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  
  // Check if we're viewing today or a future date
  const isViewingTodayOrFuture = () => {
    if (!selectedDate) return true; // Default to showing if no date selected
    const today = getTodayDateString();
    return selectedDate >= today;
  };
  
  // Format date display for section title
  const formatDateForTitle = (dateString: string) => {
    const date = new Date(dateString + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selected = new Date(date);
    selected.setHours(0, 0, 0, 0);
    
    const diffTime = selected.getTime() - today.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays > 1) {
      return date.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      });
    }
    return dateString; // Fallback
  };

  useEffect(() => {
    fetchTodaysBets();
  }, [selectedDate]);

  const fetchTodaysBets = async () => {
    setLoading(true);
    setError(null);
    try {
      // Use selected date from context, or default to today
      const dateToFetch = selectedDate || getTodayDateString();
      const timezoneOffset = getTimezoneOffset();
      const response = await api.getTodaysBets(dateToFetch, timezoneOffset);
      if (response.success && response.data?.games) {
        const sortedGames = [...response.data.games].sort((a, b) => {
          const timeA = new Date(a.startTime).getTime();
          const timeB = new Date(b.startTime).getTime();
          return timeA - timeB;
        });
        setGames(sortedGames);
      } else {
        setGames([]);
      }
    } catch (error: any) {
      setError(error.message || 'Failed to load bets');
      setGames([]);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
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


  if (loading) {
    return (
      <div className="bg-slate-900 rounded-lg p-6 sm:p-8 text-center">
        <div className="text-3xl sm:text-4xl mb-4">⏳</div>
        <p className="text-sm sm:text-base text-slate-400">Loading today's bets...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-900/20 border border-red-800 rounded-lg p-3 sm:p-4">
        <p className="text-sm sm:text-base text-red-400">{error}</p>
      </div>
    );
  }

  // Hide section if viewing past dates (MyBetsSection handles those)
  if (selectedDate && !isViewingTodayOrFuture()) {
    return null;
  }
  
  // Format date label for display
  const dateLabel = selectedDate ? formatDateForTitle(selectedDate) : 'Today';
  
  // Show empty state message when there are no games
  if (games.length === 0 && !loading) {
    return (
      <div className="bg-slate-900 rounded-lg p-6 sm:p-8 text-center">
        <div className="text-3xl sm:text-4xl mb-4">📅</div>
        <p className="text-sm sm:text-base text-slate-300 mb-2">No games with bets available for {dateLabel.toLowerCase()}</p>
        <p className="text-xs sm:text-sm text-slate-500 mb-4">
          {selectedDate === getTodayDateString() 
            ? "Check back later or browse upcoming games"
            : "No bets available for this date"}
        </p>
        <button
          onClick={fetchTodaysBets}
          className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition"
        >
          Refresh
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-0">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white">
            {dateLabel}'s Available Bets
          </h2>
          <p className="text-slate-400 text-xs sm:text-sm mt-1">
            {games.length} game{games.length !== 1 ? 's' : ''} with {games.reduce((sum, g) => sum + g.bets.length, 0)} available bet{games.reduce((sum, g) => sum + g.bets.length, 0) !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={fetchTodaysBets}
          className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 transition text-sm w-full sm:w-auto"
        >
          Refresh
        </button>
      </div>

      <div className="grid gap-6">
        {games.map((game) => {
          const sortedBets = [...game.bets].sort((a, b) => a.priority - b.priority);
          
          return (
            <div
              key={game.id}
              className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden hover:border-slate-700 transition"
            >
              {/* Game Header - Condensed */}
              <div className="px-4 py-3 border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <span className="text-xl">{getSportEmoji(game.sport)}</span>
                  <div className="flex-1">
                    <h3 className="text-base font-semibold text-white">
                      {game.awayTeam} @ {game.homeTeam}
                    </h3>
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <span>{formatTime(game.startTime)}</span>
                      <span>•</span>
                      <span>{formatDate(game.startTime)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bets List - Condensed */}
              <div className="p-4">
                <div className="space-y-4">
                  {sortedBets.map((bet) => (
                    <div key={bet.id} className="space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-orange-600/20 border border-orange-600/50 flex items-center justify-center">
                          <span className="text-xs font-bold text-orange-400">
                            #{bet.priority}
                          </span>
                        </div>
                        <span className="text-sm text-slate-300">{bet.displayText}</span>
                      </div>
                      <BetSelectionGroup
                        bet={bet}
                        game={game}
                        onSelectionSaved={fetchTodaysBets}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

