import { useAuth } from '../context/AuthContext';
import { useParlay } from '../context/ParlayContext';
import { Header } from '../components/layout/Header';
import { TodaysBetsSection } from '../components/dashboard/TodaysBetsSection';
import { MyBetsSection } from '../components/dashboard/MyBetsSection';
import { ParlayBuilder } from '../components/parlay/ParlayBuilder';

export function Dashboard() {
  const { user } = useAuth();
  const { isParlayBuilderOpen } = useParlay();

  return (
    <div className="min-h-screen bg-slate-950">
      <Header />

      {/* Parlay Builder - Sticky */}
      <ParlayBuilder />

      {/* Main Content */}
      <main className={`max-w-7xl px-4 sm:px-6 lg:px-8 py-12 mx-auto transition-[margin-right] duration-300 ease-in-out ${
        isParlayBuilderOpen 
          ? 'mr-[22rem]' // Increase right margin when builder opens
          : ''
      }`}>
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

        {/* My Bets Section */}
        <div className="mb-12">
          <MyBetsSection />
        </div>

        {/* Today's Bets Section */}
        <div className="mb-12">
          <TodaysBetsSection />
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

