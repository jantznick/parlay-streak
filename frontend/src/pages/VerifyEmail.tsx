import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Footer } from '../components/layout/Footer';

export function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();
  const { user, checkAuth } = useAuth();
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [error, setError] = useState('');
  const [resending, setResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [hasVerified, setHasVerified] = useState(false);

  useEffect(() => {
    // Only verify once, and only if we haven't already verified
    if (token && !hasVerified && status === 'verifying') {
      verifyEmail(token);
    } else if (!token) {
      setStatus('error');
      setError('No verification token provided');
    }
  }, [token, hasVerified, status]);

  const verifyEmail = async (verificationToken: string) => {
    // Prevent multiple verification attempts
    if (hasVerified) return;
    
    try {
      setHasVerified(true);
      const response = await api.verifyEmail(verificationToken);
      if (response.success) {
        setStatus('success');
        // Refresh user data to get updated emailVerified status
        if (checkAuth) {
          await checkAuth();
        }
        // Redirect to dashboard after 2 seconds
        setTimeout(() => {
          navigate('/');
        }, 2000);
      } else {
        // If response exists but success is false, show error from response
        setStatus('error');
        setError(response.error?.message || 'Failed to verify email');
        setHasVerified(false); // Allow retry
      }
    } catch (err: any) {
      setStatus('error');
      setError(err.message || 'Failed to verify email');
      setHasVerified(false); // Allow retry
    }
  };

  const handleResend = async () => {
    if (!user) {
      setError('You must be logged in to resend verification email');
      return;
    }

    setResending(true);
    setError('');
    setResendSuccess(false);

    try {
      const response = await api.resendVerificationEmail();
      if (response.success) {
        setResendSuccess(true);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to resend verification email');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="max-w-md w-full">
          <div className="bg-slate-900 rounded-lg shadow-xl p-8 border border-slate-800">
            {status === 'verifying' && (
              <div className="text-center">
                <div className="text-6xl mb-4">📧</div>
                <h1 className="text-2xl font-bold text-white mb-2">Verifying Email</h1>
                <p className="text-slate-400">Please wait while we verify your email address...</p>
              </div>
            )}

            {status === 'success' && (
              <div className="text-center">
                <div className="text-6xl mb-4">✅</div>
                <h1 className="text-2xl font-bold text-green-500 mb-2">Email Verified!</h1>
                <p className="text-slate-400 mb-4">Your email has been successfully verified.</p>
                <p className="text-slate-500 text-sm">Redirecting to dashboard...</p>
              </div>
            )}

            {status === 'error' && (
              <div className="text-center">
                <div className="text-6xl mb-4">❌</div>
                <h1 className="text-2xl font-bold text-red-500 mb-2">Verification Failed</h1>
                <p className="text-slate-400 mb-6">{error}</p>
                
                {user && !user.emailVerified && (
                  <div className="space-y-4">
                    <button
                      onClick={handleResend}
                      disabled={resending}
                      className="w-full bg-orange-600 hover:bg-orange-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {resending ? 'Sending...' : 'Resend Verification Email'}
                    </button>
                    {resendSuccess && (
                      <p className="text-green-500 text-sm">Verification email sent! Please check your inbox.</p>
                    )}
                  </div>
                )}

                <div className="mt-6 pt-6 border-t border-slate-800">
                  <Link
                    to="/"
                    className="text-orange-500 hover:text-orange-400 text-sm"
                  >
                    Go to Dashboard
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}

