import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

export function VerifyMagicLink() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { checkAuth } = useAuth() as any;

  useEffect(() => {
    const verifyToken = async () => {
      const token = searchParams.get('token');

      if (!token) {
        setStatus('error');
        setError('No token provided');
        return;
      }

      try {
        const response = await api.verifyMagicLink(token);
        
        if (response.success) {
          setStatus('success');
          // Refresh auth context
          if (checkAuth) await checkAuth();
          // Redirect to dashboard after 2 seconds
          setTimeout(() => {
            navigate('/');
          }, 2000);
        } else {
          setStatus('error');
          setError(response.error?.message || 'Verification failed');
        }
      } catch (err: any) {
        setStatus('error');
        setError(err.message || 'Verification failed');
      }
    };

    verifyToken();
  }, [searchParams, navigate, checkAuth]);

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        {/* Logo/Header */}
        <h1 className="text-4xl font-bold mb-8 bg-gradient-to-r from-orange-600 to-red-700 bg-clip-text text-transparent">
          Parlay Streak
        </h1>

        {/* Status Card */}
        <div className="bg-slate-900 rounded-2xl shadow-xl p-12 border border-slate-800">
          {status === 'verifying' && (
            <div>
              <div className="text-6xl mb-4 animate-spin">⚡</div>
              <h2 className="text-2xl font-bold text-white mb-2">Verifying...</h2>
              <p className="text-slate-400">Please wait while we verify your magic link</p>
            </div>
          )}

          {status === 'success' && (
            <div>
              <div className="text-6xl mb-4">✅</div>
              <h2 className="text-2xl font-bold text-white mb-2">Success!</h2>
              <p className="text-slate-400 mb-4">You're being logged in...</p>
              <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                <div className="bg-gradient-to-r from-orange-600 to-red-700 h-full animate-pulse"></div>
              </div>
            </div>
          )}

          {status === 'error' && (
            <div>
              <div className="text-6xl mb-4">❌</div>
              <h2 className="text-2xl font-bold text-white mb-2">Verification Failed</h2>
              <p className="text-slate-400 mb-6">{error}</p>
              <button
                onClick={() => navigate('/login')}
                className="bg-gradient-to-r from-orange-600 to-red-700 text-white px-6 py-3 rounded-lg font-bold hover:shadow-xl transition"
              >
                Back to Login
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

