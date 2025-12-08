import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { BetSelectionGroup } from '../components/bets/BetSelectionGroup';
import { getSportEmoji, getTimezoneOffset, getTodayDateString } from '../utils/formatting';
import type { Bet, Game } from '../interfaces';

export function TodaysBets() {
  const { user, logout } = useAuth();
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
      const localDate = getTodayDateString();
      
      // Get timezone offset in hours (e.g., -5 for EST)
      const timezoneOffset = getTimezoneOffset();
      const response = await fetch(`/api/bets/today?date=${localDate}&timezoneOffset=${timezoneOffset}`, {
        credentials: 'include'
      });
      const data = await response.json();
      console.log('Today\'s bets API response:', data);
      if (data.success && data.data?.games) {
        // Games are already sorted by start time from backend, but ensure they're sorted
        const sortedGames = [...data.data.games].sort((a, b) => {
          const timeA = new Date(a.startTime).getTime();
          const timeB = new Date(b.startTime).getTime();
          return timeA - timeB;
        });
        console.log('Setting games:', sortedGames);
        setGames(sortedGames);
      } else {
        console.log('No games found in response:', data);
        setGames([]);
      }
    } catch (error: any) {
      console.error('Error fetching today\'s bets:', error);
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


  return (
    <div className="min-h-screen bg-slate-950">
      {/* Header */}
      <header className="bg-slate-900 border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <Link
                to="/"
                className="text-2xl font-bold bg-gradient-to-r from-orange-600 to-red-700 bg-clip-text text-transparent hover:opacity-80 transition"
              >
                Parlay Streak
              </Link>
              <span className="text-slate-400">/</span>
              <h1 className="text-xl font-semibold text-white">Today's Bets</h1>
            </div>
            {user && (
              <div className="flex items-center gap-4">
                <Link
                  to="/"
                  className="px-4 py-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition"
                >
                  Dashboard
                </Link>
                <button
                  onClick={logout}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 transition"
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="bg-red-900/20 border border-red-800 rounded-lg p-4 mb-6">
            <p className="text-red-400">{error}</p>
          </div>
        )}

        {loading ? (
          <div className="bg-slate-900 rounded-lg p-8 text-center">
            <div className="text-4xl mb-4">⏳</div>
            <p className="text-slate-400">Loading today's bets...</p>
          </div>
        ) : games.length === 0 ? (
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
        ) : (
          <div className="space-y-6">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h2 className="text-2xl font-bold text-white">
                  Today's Available Bets
                </h2>
                <p className="text-slate-400 text-sm mt-1">
                  {games.length} game{games.length !== 1 ? 's' : ''} with {games.reduce((sum, g) => sum + (g.bets?.length || 0), 0)} available bet{games.reduce((sum, g) => sum + (g.bets?.length || 0), 0) !== 1 ? 's' : ''}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <p className="text-slate-400 text-sm">
                  {new Date().toLocaleDateString('en-US', {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric'
                  })}
                </p>
                <button
                  onClick={fetchTodaysBets}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 transition text-sm"
                >
                  Refresh
                </button>
              </div>
            </div>

            <div className="grid gap-6">
              {games.map((game) => {
                // All bets returned are already available (pending), but sort by priority
                const sortedBets = [...(game.bets || [])].sort((a, b) => a.priority - b.priority);
                
                return (
                  <div
                    key={game.id}
                    className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden hover:border-slate-700 transition"
                  >
                    {/* Game Header */}
                    <div className="p-6 bg-gradient-to-r from-slate-800/50 to-slate-900/50 border-b border-slate-800">
                      <div className="flex items-center gap-4 mb-4">
                        <span className="text-3xl">{getSportEmoji(game.sport)}</span>
                        <div className="flex-1">
                          <h3 className="text-xl font-bold text-white mb-1">
                            {game.awayTeam} @ {game.homeTeam}
                          </h3>
                          <div className="flex items-center gap-4 text-sm text-slate-400">
                            <span>{formatTime(game.startTime)}</span>
                            <span>•</span>
                            <span>{formatDate(game.startTime)}</span>
                            {game.status !== 'scheduled' && (
                              <>
                                <span>•</span>
                                <span
                                  className={`px-2 py-0.5 rounded text-xs font-medium ${
                                    game.status === 'completed'
                                      ? 'bg-green-900/50 text-green-400'
                                      : game.status === 'in_progress'
                                      ? 'bg-yellow-900/50 text-yellow-400'
                                      : 'bg-slate-800 text-slate-400'
                                  }`}
                                >
                                  {game.status.replace('_', ' ').toUpperCase()}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold text-orange-500">
                            {sortedBets.length}
                          </div>
                          <div className="text-xs text-slate-400">
                            available bet{sortedBets.length !== 1 ? 's' : ''}
                          </div>
                        </div>
                      </div>

                      {/* Score */}
                      {(game.homeScore !== null || game.awayScore !== null) && (
                        <div className="flex gap-6 text-lg">
                          <div className="flex-1 text-right">
                            <span className="text-slate-300">{game.awayTeam}</span>
                            <span className="ml-3 font-bold text-white">{game.awayScore}</span>
                          </div>
                          <span className="text-slate-500">-</span>
                          <div className="flex-1">
                            <span className="font-bold text-white">{game.homeScore}</span>
                            <span className="ml-3 text-slate-300">{game.homeTeam}</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Bets List - All bets shown are available (pending) */}
                    <div className="p-6">
                      <div className="mb-4 flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-400">Available Bets:</span>
                        <span className="text-sm text-slate-500">({sortedBets.length})</span>
                      </div>
                      <div className="space-y-6">
                        {sortedBets.map((bet) => (
                          <div
                            key={bet.id}
                            className="bg-slate-800 rounded-lg p-4 border border-slate-700"
                          >
                            <div className="flex items-center gap-3 mb-4">
                              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-orange-600/20 border border-orange-600/50 flex items-center justify-center">
                                <span className="text-xs font-bold text-orange-400">
                                  #{bet.priority}
                                </span>
                              </div>
                              <div className="px-3 py-1 rounded text-xs font-medium bg-orange-900/30 text-orange-400 border border-orange-600/30">
                                AVAILABLE
                              </div>
                            </div>
                            <BetSelectionGroup
                              bet={bet}
                              game={game}
                              onSelectionSaved={() => {
                                // Optionally refresh or show feedback
                              }}
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
        )}
      </main>
    </div>
  );
}

