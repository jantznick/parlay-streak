import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';

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
  bets: any[];
}

export function BetManagement() {
  const { user, logout } = useAuth();
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [selectedSport, setSelectedSport] = useState<string>('BASKETBALL');
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchingFromApi, setFetchingFromApi] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadGames = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.getGames(selectedDate, selectedSport);
      if (response.success && response.data) {
        setGames(response.data.games);
      }
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchGamesFromApi = async () => {
    setFetchingFromApi(true);
    setError(null);
    try {
      const response = await api.fetchGamesFromApi(
        selectedDate
      );
      if (response.success) {
        // Reload games after fetching
        // await loadGames();
      }
    } catch (error: any) {
      setError(error.message);
    } finally {
      setFetchingFromApi(false);
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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-white">Admin: Bet Management</h1>
              <p className="text-slate-400 text-sm mt-1">
                Logged in as {user?.email}
              </p>
            </div>
            <button
              onClick={logout}
              className="px-4 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Date & Sport Selector */}
        <div className="bg-slate-900 rounded-lg p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

            <div className="flex items-end">
              <button
                onClick={fetchGamesFromApi}
                disabled={fetchingFromApi}
                className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg transition font-medium"
              >
                {fetchingFromApi ? 'Fetching...' : 'Fetch Games from API'}
              </button>
            </div>
          </div>

          <div className="mt-4 text-sm text-slate-400">
            Viewing games for <span className="text-white font-medium">{formatDate(selectedDate)}</span>
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
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold text-white">
              Games ({games.length})
            </h2>
            {games.length > 0 && (
              <button
                onClick={loadGames}
                disabled={loading}
                className="px-3 py-1 text-sm text-slate-400 hover:text-white hover:bg-slate-800 rounded transition"
              >
                {loading ? 'Refreshing...' : '🔄 Refresh'}
              </button>
            )}
          </div>

          {loading ? (
            <div className="bg-slate-900 rounded-lg p-8 text-center">
              <div className="text-4xl mb-4">⏳</div>
              <p className="text-slate-400">Loading games...</p>
            </div>
          ) : games.length === 0 ? (
            <div className="bg-slate-900 rounded-lg p-8 text-center">
              <div className="text-4xl mb-4">📅</div>
              <p className="text-slate-300 mb-2">No games found for this date</p>
              <p className="text-slate-500 text-sm">
                Click "Fetch Games from API" to load games from the sports API
              </p>
            </div>
          ) : (
            <div className="grid gap-4">
              {games.map((game) => (
                <div
                  key={game.id}
                  className="bg-slate-900 border border-slate-800 rounded-lg p-6 hover:border-slate-700 transition"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      {/* Game Info */}
                      <div className="flex items-center gap-3 mb-3">
                        <span className="text-2xl">
                          {game.sport === 'BASKETBALL' ? '🏀' : '🏈'}
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
                        <div className="flex gap-4 text-sm mb-3">
                          <span className="text-slate-300">
                            {game.awayTeam}: <span className="font-bold text-white">{game.awayScore}</span>
                          </span>
                          <span className="text-slate-300">
                            {game.homeTeam}: <span className="font-bold text-white">{game.homeScore}</span>
                          </span>
                        </div>
                      )}

                      {/* Status Badge */}
                      <div className="flex gap-2 items-center">
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
                          {game.bets.length} bets
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div>
                      <button className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition text-sm font-medium">
                        Create Bets
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

