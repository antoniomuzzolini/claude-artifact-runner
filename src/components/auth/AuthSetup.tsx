import React, { useState, useEffect } from 'react';
import { Shield, Eye, EyeOff, CheckCircle } from 'lucide-react';

interface AuthSetupProps {
  onSetupComplete: () => void;
}

const AuthSetup: React.FC<AuthSetupProps> = ({ onSetupComplete }) => {
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [setupStatus, setSetupStatus] = useState<any>(null);
  const [isCheckingStatus, setIsCheckingStatus] = useState(true);

  const API_BASE = process.env.NODE_ENV === 'production' ? '' : 'http://localhost:3000';

  // Check setup status on mount
  useEffect(() => {
    const checkSetupStatus = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/setup-auth`);
        const data = await response.json();
        setSetupStatus(data);
        
        if (data.usersTableExists && data.matchesHasCreatedBy) {
          // Setup already complete, check if we have a superuser
          const authResponse = await fetch(`${API_BASE}/api/auth`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'verify', token: 'dummy' }),
          });
          
          if (authResponse.status !== 401) {
            onSetupComplete();
          }
        }
      } catch (error) {
        console.error('Error checking setup status:', error);
        setError('Failed to check setup status');
      } finally {
        setIsCheckingStatus(false);
      }
    };

    checkSetupStatus();
  }, [onSetupComplete]);

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!adminEmail.trim() || !adminPassword.trim()) {
      setError('Email and password are required');
      return;
    }

    if (adminPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (adminPassword.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE}/api/setup-auth`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          adminEmail: adminEmail.trim(),
          adminPassword,
        }),
      });

      const data = await response.json();

      if (data.success) {
        onSetupComplete();
      } else {
        setError(data.error || 'Setup failed');
      }
    } catch (error) {
      console.error('Setup error:', error);
      setError('Network error during setup');
    } finally {
      setIsLoading(false);
    }
  };

  if (isCheckingStatus) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Checking authentication setup...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="max-w-md w-full space-y-8 p-8">
        {/* Header */}
        <div className="text-center">
          <Shield className="mx-auto h-12 w-12 text-blue-600" />
          <h2 className="mt-6 text-3xl font-bold text-gray-900">Authentication Setup</h2>
          <p className="mt-2 text-sm text-gray-600">
            Create the first administrator account for your Foosball Manager
          </p>
        </div>

        {/* Current Status */}
        {setupStatus && (
          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <h3 className="font-medium text-gray-900 mb-3">Setup Status</h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center">
                {setupStatus.usersTableExists ? (
                  <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                ) : (
                  <div className="h-4 w-4 rounded-full border-2 border-gray-300 mr-2" />
                )}
                <span>Users table</span>
              </div>
              <div className="flex items-center">
                {setupStatus.matchesHasCreatedBy ? (
                  <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                ) : (
                  <div className="h-4 w-4 rounded-full border-2 border-gray-300 mr-2" />
                )}
                <span>Match ownership tracking</span>
              </div>
            </div>
          </div>
        )}

        {/* Form */}
        <form className="mt-8 space-y-6" onSubmit={handleSetup}>
          <div className="space-y-4">
            {/* Admin Email */}
            <div>
              <label htmlFor="adminEmail" className="block text-sm font-medium text-gray-700">
                Administrator Email
              </label>
              <input
                id="adminEmail"
                name="adminEmail"
                type="email"
                required
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="admin@example.com"
                disabled={isLoading}
              />
            </div>

            {/* Admin Password */}
            <div>
              <label htmlFor="adminPassword" className="block text-sm font-medium text-gray-700">
                Administrator Password
              </label>
              <div className="mt-1 relative">
                <input
                  id="adminPassword"
                  name="adminPassword"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
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
              disabled={isLoading || !adminEmail.trim() || !adminPassword.trim() || adminPassword !== confirmPassword}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Setting up...' : 'Create Administrator Account'}
            </button>
          </div>
        </form>

        {/* Info */}
        <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-md">
          <div className="text-sm text-yellow-700">
            <p className="font-medium mb-1">Important:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>This will be the main administrator account</li>
              <li>Only administrators can create new user accounts</li>
              <li>Make sure to use a strong password</li>
              <li>Remember these credentials - they cannot be recovered</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthSetup; 