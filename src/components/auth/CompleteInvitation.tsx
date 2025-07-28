import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, CheckCircle, AlertCircle } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

interface CompleteInvitationProps {
  token: string;
  onComplete: () => void;
}

const CompleteInvitation: React.FC<CompleteInvitationProps> = ({ token, onComplete }) => {
  const { verifyInvitation, completeInvitation } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [tokenValid, setTokenValid] = useState<boolean | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userAlreadyRegistered, setUserAlreadyRegistered] = useState(false);

  // Verify token validity on mount
  useEffect(() => {
    const verifyToken = async () => {
      try {
        const result = await verifyInvitation(token);
        
        if (result.email && result.isPending) {
          setTokenValid(true);
          setUserEmail(result.email);
          setUserAlreadyRegistered(false);
        } else if (result.userAlreadyRegistered) {
          setTokenValid(false);
          setUserAlreadyRegistered(true);
          setError('This invitation is no longer valid. The user has already completed registration.');
        } else {
          setTokenValid(false);
          setError('Invalid invitation token');
        }
      } catch (error) {
        setTokenValid(false);
        setError('Failed to verify invitation token');
      }
    };

    if (token) {
      verifyToken();
    } else {
      setTokenValid(false);
      setError('No invitation token provided');
    }
  }, [token, verifyInvitation]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!username.trim() || !password.trim()) {
      setError('Username and password are required');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }

    if (username.length < 3) {
      setError('Username must be at least 3 characters long');
      return;
    }

    setIsLoading(true);

    try {
      const success = await completeInvitation(token, username.trim(), password);
      
      if (success) {
        setSuccess(true);
        setTimeout(() => {
          onComplete();
        }, 2000);
      }
    } catch (error) {
      console.error('Error completing invitation:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (tokenValid === null) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Verifying invitation...</p>
        </div>
      </div>
    );
  }

  if (tokenValid === false) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full p-8 text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-red-600 mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {userAlreadyRegistered ? 'User Already Registered' : 'Invalid Invitation'}
          </h2>
          <p className="text-gray-600 mb-4">
            {userAlreadyRegistered 
              ? 'This invitation is no longer valid because the user has already completed their registration. Please use the login page to access your account.'
              : 'This invitation link is invalid or has expired. Please contact your administrator for a new invitation.'
            }
          </p>
          <button
            onClick={() => window.location.href = '/'}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full p-8 text-center">
          <CheckCircle className="mx-auto h-12 w-12 text-green-600 mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Account Setup Complete!</h2>
          <p className="text-gray-600 mb-4">
            Your account has been successfully created. You can now log in with your credentials.
          </p>
          <div className="text-sm text-gray-500">
            Redirecting to login page...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="max-w-md w-full space-y-8 p-8">
        {/* Header */}
        <div className="text-center">
          <div className="text-4xl mb-4">✉️</div>
          <h2 className="text-3xl font-bold text-gray-900">Complete Your Invitation</h2>
          <p className="mt-2 text-sm text-gray-600">
            You've been invited to join the Championship Manager
          </p>
          {userEmail && (
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
              <p className="text-sm text-blue-700">
                <span className="font-medium">Email:</span> {userEmail}
              </p>
            </div>
          )}
        </div>

        {/* Form */}
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            {/* Username */}
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700">
                Choose a Username
              </label>
              <input
                id="username"
                name="username"
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter your username"
                disabled={isLoading}
              />
              <p className="mt-1 text-xs text-gray-500">
                Must be at least 3 characters long
              </p>
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Create Password
              </label>
              <div className="mt-1 relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full px-3 py-2 pr-10 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Create a secure password"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={isLoading}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4 text-gray-400" />
                  ) : (
                    <Eye className="h-4 w-4 text-gray-400" />
                  )}
                </button>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Must be at least 6 characters long
              </p>
            </div>

            {/* Confirm Password */}
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                Confirm Password
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type={showPassword ? 'text' : 'password'}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="Confirm your password"
                disabled={isLoading}
              />
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-4">
              <div className="text-sm text-red-700">{error}</div>
            </div>
          )}

          {/* Submit Button */}
          <div>
            <button
              type="submit"
              disabled={isLoading || !username.trim() || !password.trim() || password !== confirmPassword}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Setting up account...' : 'Complete Setup'}
            </button>
          </div>
        </form>

        {/* Features info */}
        <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-md">
          <div className="text-sm text-green-700">
            <p className="font-medium mb-1">What you can do:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>View rankings and match history</li>
              <li>Add new matches and track scores</li>
              <li>Export and import championship data</li>
              <li>Participate in organization competitions</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CompleteInvitation; 