import { useState, useEffect } from 'react';
import { BetSelectionGroup } from '../bets/BetSelectionGroup';
import { api } from '../../services/api';

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
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchTodaysBets();
  }, []);

  const fetchTodaysBets = async () => {
    setLoading(true);
    setError(null);
    try {
      // Get local date string (YYYY-MM-DD) in user's timezone
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const localDate = `${year}-${month}-${day}`;
      
      const timezoneOffset = -new Date().getTimezoneOffset() / 60;
      const data = await api.getTodaysBets(localDate, timezoneOffset);
      if (data.success && data.data?.games) {
        const sortedGames = [...data.data.games].sort((a, b) => {
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
        <p className="text-slate-400">Loading today's bets...</p>
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

  if (games.length === 0) {
    return (
      <div className="bg-slate-900 rounded-lg p-8 text-center">
        <div className="text-4xl mb-4">📅</div>
        <p className="text-slate-300 mb-2">No games with bets available today</p>
        <p className="text-slate-500 text-sm mb-4">
          Check back later or browse upcoming games
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
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-white">
            Today's Available Bets
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            {games.length} game{games.length !== 1 ? 's' : ''} with {games.reduce((sum, g) => sum + g.bets.length, 0)} available bet{games.reduce((sum, g) => sum + g.bets.length, 0) !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={fetchTodaysBets}
          className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 transition text-sm"
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

