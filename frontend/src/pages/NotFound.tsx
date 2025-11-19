import { Link } from 'react-router-dom';
import { Header } from '../components/layout/Header';
import { Footer } from '../components/layout/Footer';

export function NotFound() {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      <Header />
      <main className="flex-1 flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className="mb-8">
            <h1 className="text-9xl font-bold text-slate-800 mb-4">404</h1>
            <h2 className="text-3xl font-bold text-white mb-4">Page Not Found</h2>
            <p className="text-slate-400 mb-8">
              The page you're looking for doesn't exist or has been moved.
            </p>
          </div>
          <div className="space-y-4">
            <Link
              to="/"
              className="inline-block bg-gradient-to-r from-orange-600 to-red-700 text-white px-8 py-3 rounded-lg font-bold hover:shadow-xl hover:shadow-orange-600/20 transition transform hover:-translate-y-1"
            >
              Go to Dashboard
            </Link>
            <div>
              <Link
                to="/login"
                className="text-orange-500 hover:text-orange-400 font-medium"
              >
                Login
              </Link>
              {' • '}
              <Link
                to="/register"
                className="text-orange-500 hover:text-orange-400 font-medium"
              >
                Register
              </Link>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

