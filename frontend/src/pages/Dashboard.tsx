import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';

export function Dashboard() {
  const { user, logout } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    // Check if user is admin by calling the API
    const checkAdmin = async () => {
      try {
        // Try to access an admin endpoint to check if user is admin
        const response = await fetch('/api/admin/sports', {
          credentials: 'include'
        });
        setIsAdmin(response.ok);
      } catch {
        setIsAdmin(false);
      }
    };
    if (user) {
      checkAdmin();
    }
  }, [user]);

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Header */}
      <header className="bg-slate-900 border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold bg-gradient-to-r from-orange-600 to-red-700 bg-clip-text text-transparent">
                Parlay Streak
              </h1>
            </div>
            <div className="flex items-center gap-4">
              {isAdmin && (
                <Link
                  to="/admin/bets"
                  className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition font-medium"
                >
                  Admin
                </Link>
              )}
              <span className="text-slate-300">
                Welcome, <span className="font-semibold text-white">{user?.username}</span>
              </span>
              <button
                onClick={handleLogout}
                className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 transition"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Streak Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {/* Current Streak */}
          <div className="bg-gradient-to-br from-orange-900/30 to-slate-900 rounded-2xl p-6 border-2 border-orange-600">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-slate-400 text-sm font-medium">Current Streak</h3>
              <span className="text-2xl">🔥</span>
            </div>
            <p className="text-4xl font-bold text-white">{user?.currentStreak || 0}</p>
          </div>

          {/* Longest Streak */}
          <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-slate-400 text-sm font-medium">Longest Streak</h3>
              <span className="text-2xl">👑</span>
            </div>
            <p className="text-4xl font-bold text-white">{user?.longestStreak || 0}</p>
          </div>

          {/* Total Points */}
          <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-slate-400 text-sm font-medium">Total Points</h3>
              <span className="text-2xl">⭐</span>
            </div>
            <p className="text-4xl font-bold text-white">{user?.totalPointsEarned || 0}</p>
          </div>
        </div>

        {/* Today's Bets Link */}
        <div className="bg-gradient-to-br from-orange-900/20 to-slate-900 rounded-2xl p-8 border-2 border-orange-600/50 mb-8 text-center">
          <Link
            to="/bets/today"
            className="inline-flex items-center gap-3 text-white hover:text-orange-400 transition group"
          >
            <span className="text-3xl">📊</span>
            <div className="text-left">
              <h3 className="text-xl font-bold group-hover:text-orange-400 transition">
                View Today's Bets
              </h3>
              <p className="text-sm text-slate-400">
                See all available bets for today's games
              </p>
            </div>
            <span className="text-2xl group-hover:translate-x-1 transition">→</span>
          </Link>
        </div>

        {/* Coming Soon Section */}
        <div className="bg-slate-900 rounded-2xl p-12 border border-slate-800 text-center">
          <div className="max-w-2xl mx-auto">
            <div className="text-6xl mb-4">🎮</div>
            <h2 className="text-3xl font-bold text-white mb-4">
              Game Features Coming Soon
            </h2>
            <p className="text-slate-400 text-lg mb-8">
              Browse games, build parlays, and start climbing the leaderboards.
              The full experience is being built right now!
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
              <div className="bg-slate-800 rounded-lg p-4">
                <h3 className="font-semibold text-white mb-2">🎯 Build Parlays</h3>
                <p className="text-sm text-slate-400">
                  Combine 1-5 bets from any games into custom parlays
                </p>
              </div>
              <div className="bg-slate-800 rounded-lg p-4">
                <h3 className="font-semibold text-white mb-2">🛡️ Insurance System</h3>
                <p className="text-sm text-slate-400">
                  Protect your streak with strategic insurance on big parlays
                </p>
              </div>
              <div className="bg-slate-800 rounded-lg p-4">
                <h3 className="font-semibold text-white mb-2">📊 Live Updates</h3>
                <p className="text-sm text-slate-400">
                  Watch your parlays resolve in real-time as games finish
                </p>
              </div>
              <div className="bg-slate-800 rounded-lg p-4">
                <h3 className="font-semibold text-white mb-2">🏆 Leaderboards</h3>
                <p className="text-sm text-slate-400">
                  Compete for the longest streak and climb the rankings
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

