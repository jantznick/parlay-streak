import { useAuth } from '../context/AuthContext';
import { useParlay } from '../context/ParlayContext';
import { Header } from '../components/layout/Header';
import { Footer } from '../components/layout/Footer';
import { TodaysBetsSection } from '../components/dashboard/TodaysBetsSection';
import { MyBetsSection } from '../components/dashboard/MyBetsSection';
import { ParlayBuilder } from '../components/parlay/ParlayBuilder';

export function Dashboard() {
  const { user } = useAuth();
  const { isParlayBuilderOpen } = useParlay();

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      <Header />

      {/* Parlay Builder - Sticky */}
      <ParlayBuilder />

      {/* Main Content */}
      <main className={`flex-1 w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-6 sm:py-12 mx-auto transition-[margin-right] duration-300 ease-in-out ${
        isParlayBuilderOpen 
          ? 'lg:mr-[22rem]' // Increase right margin when builder opens (desktop only)
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
      </main>

      <Footer />
    </div>
  );
}

