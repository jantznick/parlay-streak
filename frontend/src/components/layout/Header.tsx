import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

interface HeaderProps {
  title?: string;
}

export function Header({ title }: HeaderProps) {
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  return (
    <header className="bg-slate-900 border-b border-slate-800 w-full">
      <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center gap-4">
            <Link
              to="/"
              className="text-2xl font-bold bg-gradient-to-r from-orange-600 to-red-700 bg-clip-text text-transparent hover:opacity-80 transition"
            >
              Parlay Streak
            </Link>
            {title && (
              <>
                <span className="text-slate-400">/</span>
                <h1 className="text-xl font-semibold text-white">{title}</h1>
              </>
            )}
          </div>
          {user && (
            <div className="flex items-center gap-4">
              {user.isAdmin && (
                <Link
                  to="/admin/bets"
                  className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition font-medium"
                >
                  Admin
                </Link>
              )}
              <span className="text-slate-300">
                Welcome, <span className="font-semibold text-white">{user.username}</span>
              </span>
              <button
                onClick={handleLogout}
                className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 transition"
              >
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

