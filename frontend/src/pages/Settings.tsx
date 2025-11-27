import { useState, FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { validateUsername, validateEmail, validatePassword } from '@shared/validation/auth';
import { Header } from '../components/layout/Header';
import { Footer } from '../components/layout/Footer';

export function Settings() {
  const { user, checkAuth } = useAuth();
  const [username, setUsername] = useState(user?.username || '');
  const [email, setEmail] = useState(user?.email || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [usernameError, setUsernameError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [usernameSuccess, setUsernameSuccess] = useState('');
  const [emailSuccess, setEmailSuccess] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');

  const [updatingUsername, setUpdatingUsername] = useState(false);
  const [updatingEmail, setUpdatingEmail] = useState(false);
  const [updatingPassword, setUpdatingPassword] = useState(false);

  const handleUpdateUsername = async (e: FormEvent) => {
    e.preventDefault();
    setUsernameError('');
    setUsernameSuccess('');

    const validationError = validateUsername(username);
    if (validationError) {
      setUsernameError(validationError);
      return;
    }

    if (username === user?.username) {
      setUsernameError('This is already your username');
      return;
    }

    setUpdatingUsername(true);
    try {
      const response = await api.updateUsername(username);
      if (response.success) {
        setUsernameSuccess('Username updated successfully!');
        if (checkAuth) {
          await checkAuth();
        }
        // Clear success message after 3 seconds
        setTimeout(() => setUsernameSuccess(''), 3000);
      }
    } catch (err: any) {
      setUsernameError(err.message || 'Failed to update username');
    } finally {
      setUpdatingUsername(false);
    }
  };

  const handleUpdateEmail = async (e: FormEvent) => {
    e.preventDefault();
    setEmailError('');
    setEmailSuccess('');

    const validationError = validateEmail(email);
    if (validationError) {
      setEmailError(validationError);
      return;
    }

    if (email === user?.email) {
      setEmailError('This is already your email');
      return;
    }

    setUpdatingEmail(true);
    try {
      const response = await api.updateEmail(email);
      if (response.success) {
        setEmailSuccess('Email updated successfully! Please check your email to verify the new address.');
        if (checkAuth) {
          await checkAuth();
        }
        // Clear success message after 5 seconds
        setTimeout(() => setEmailSuccess(''), 5000);
      }
    } catch (err: any) {
      setEmailError(err.message || 'Failed to update email');
    } finally {
      setUpdatingEmail(false);
    }
  };

  const handleUpdatePassword = async (e: FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (!currentPassword) {
      setPasswordError('Please enter your current password');
      return;
    }

    const validationError = validatePassword(newPassword);
    if (validationError) {
      setPasswordError(validationError);
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }

    setUpdatingPassword(true);
    try {
      const response = await api.updatePassword(currentPassword, newPassword, confirmPassword);
      if (response.success) {
        setPasswordSuccess('Password updated successfully!');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        // Clear success message after 3 seconds
        setTimeout(() => setPasswordSuccess(''), 3000);
      }
    } catch (err: any) {
      setPasswordError(err.message || 'Failed to update password');
    } finally {
      setUpdatingPassword(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      <Header />
      
      <main className="flex-1 w-full max-w-4xl px-4 sm:px-6 lg:px-8 py-12 mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Settings</h1>
          <p className="text-slate-400">Manage your account settings</p>
        </div>

        <div className="space-y-6">
          {/* Username Section */}
          <div className="bg-slate-900 rounded-lg p-6 border border-slate-800">
            <h2 className="text-xl font-semibold text-white mb-4">Username</h2>
            <form onSubmit={handleUpdateUsername} className="space-y-4">
              <div>
                <label htmlFor="username" className="block text-sm font-medium text-slate-300 mb-2">
                  Username
                </label>
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-600 focus:border-transparent"
                  placeholder="johndoe"
                />
                <p className="mt-1 text-xs text-slate-500">
                  Alphanumeric only, 3-30 characters
                </p>
              </div>
              {usernameError && (
                <div className="bg-red-900/20 border border-red-800 rounded-lg p-3">
                  <p className="text-red-400 text-sm">{usernameError}</p>
                </div>
              )}
              {usernameSuccess && (
                <div className="bg-green-900/20 border border-green-800 rounded-lg p-3">
                  <p className="text-green-400 text-sm">{usernameSuccess}</p>
                </div>
              )}
              <button
                type="submit"
                disabled={updatingUsername || username === user?.username}
                className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {updatingUsername ? 'Updating...' : 'Update Username'}
              </button>
            </form>
          </div>

          {/* Email Section */}
          <div className="bg-slate-900 rounded-lg p-6 border border-slate-800">
            <h2 className="text-xl font-semibold text-white mb-4">Email</h2>
            <form onSubmit={handleUpdateEmail} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-2">
                  Email Address
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-600 focus:border-transparent"
                  placeholder="you@example.com"
                />
                {user && !user.emailVerified && (
                  <p className="mt-1 text-xs text-orange-400">
                    ⚠️ Your email is not verified. Please check your inbox.
                  </p>
                )}
              </div>
              {emailError && (
                <div className="bg-red-900/20 border border-red-800 rounded-lg p-3">
                  <p className="text-red-400 text-sm">{emailError}</p>
                </div>
              )}
              {emailSuccess && (
                <div className="bg-green-900/20 border border-green-800 rounded-lg p-3">
                  <p className="text-green-400 text-sm">{emailSuccess}</p>
                </div>
              )}
              <button
                type="submit"
                disabled={updatingEmail || email === user?.email}
                className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {updatingEmail ? 'Updating...' : 'Update Email'}
              </button>
            </form>
          </div>

          {/* Password Section */}
          {user && user.emailVerified && (
            <div className="bg-slate-900 rounded-lg p-6 border border-slate-800">
              <h2 className="text-xl font-semibold text-white mb-4">Password</h2>
              <form onSubmit={handleUpdatePassword} className="space-y-4">
                <div>
                  <label htmlFor="currentPassword" className="block text-sm font-medium text-slate-300 mb-2">
                    Current Password
                  </label>
                  <input
                    id="currentPassword"
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-600 focus:border-transparent"
                    placeholder="••••••••"
                  />
                </div>
                <div>
                  <label htmlFor="newPassword" className="block text-sm font-medium text-slate-300 mb-2">
                    New Password
                  </label>
                  <input
                    id="newPassword"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-600 focus:border-transparent"
                    placeholder="••••••••"
                  />
                  <p className="mt-1 text-xs text-slate-500">
                    6-128 characters
                  </p>
                </div>
                <div>
                  <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-300 mb-2">
                    Confirm New Password
                  </label>
                  <input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-600 focus:border-transparent"
                    placeholder="••••••••"
                  />
                </div>
                {passwordError && (
                  <div className="bg-red-900/20 border border-red-800 rounded-lg p-3">
                    <p className="text-red-400 text-sm">{passwordError}</p>
                  </div>
                )}
                {passwordSuccess && (
                  <div className="bg-green-900/20 border border-green-800 rounded-lg p-3">
                    <p className="text-green-400 text-sm">{passwordSuccess}</p>
                  </div>
                )}
                <button
                  type="submit"
                  disabled={updatingPassword}
                  className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {updatingPassword ? 'Updating...' : 'Update Password'}
                </button>
              </form>
            </div>
          )}

          {user && !user.emailVerified && (
            <div className="bg-slate-900 rounded-lg p-6 border border-slate-800">
              <h2 className="text-xl font-semibold text-white mb-4">Password</h2>
              <div className="bg-orange-900/20 border border-orange-800 rounded-lg p-4">
                <p className="text-orange-400 text-sm">
                  You must verify your email before you can change your password.
                </p>
              </div>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}

