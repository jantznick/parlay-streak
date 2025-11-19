import { useState, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import { Footer } from '../components/layout/Footer';

export function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);

    if (!email) {
      setError('Please enter your email address');
      return;
    }

    setLoading(true);

    try {
      const response = await api.forgotPassword(email);
      if (response.success) {
        setSuccess(true);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to send password reset email');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="max-w-md w-full">
          <div className="bg-slate-900 rounded-lg shadow-xl p-8 border border-slate-800">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-white mb-2">Reset Password</h1>
              <p className="text-slate-400">Enter your email address and we'll send you a link to reset your password.</p>
            </div>

            {success ? (
              <div className="text-center">
                <div className="text-6xl mb-4">📧</div>
                <h2 className="text-xl font-semibold text-green-500 mb-2">Email Sent!</h2>
                <p className="text-slate-400 mb-4">
                  If an account exists with this email, a password reset link has been sent.
                  Please check your inbox and follow the instructions.
                </p>
                <p className="text-slate-500 text-sm mb-6">
                  The link will expire in 1 hour.
                </p>
                <Link
                  to="/login"
                  className="text-orange-500 hover:text-orange-400 text-sm"
                >
                  Back to Login
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-2">
                    Email Address
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    placeholder="you@example.com"
                    required
                  />
                </div>

                {error && (
                  <div className="bg-red-900/50 border border-red-700 text-red-200 px-4 py-3 rounded-lg text-sm">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-orange-600 hover:bg-orange-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Sending...' : 'Send Reset Link'}
                </button>

                <div className="text-center">
                  <Link
                    to="/login"
                    className="text-orange-500 hover:text-orange-400 text-sm"
                  >
                    Back to Login
                  </Link>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}

