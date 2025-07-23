import React, { useState } from 'react';
import { LogIn, Eye, EyeOff, Building2 } from 'lucide-react';
import { LoginCredentials } from '../../types/auth';

interface LoginFormProps {
  onLogin: (credentials: LoginCredentials) => Promise<boolean>;
  onRegisterOrganization: () => void;
  isLoading: boolean;
  error: string | null;
  onClearError: () => void;
}

const LoginForm: React.FC<LoginFormProps> = ({ 
  onLogin, 
  onRegisterOrganization, 
  isLoading, 
  error, 
  onClearError 
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    onClearError();

    if (!email.trim() || !password.trim()) {
      return;
    }

    await onLogin({ email: email.trim(), password });
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="max-w-md w-full space-y-8 p-8">
        {/* Header */}
        <div className="text-center">
          <div className="text-4xl mb-4">🏆</div>
          <h2 className="text-3xl font-bold text-gray-900">Foosball Manager</h2>
          <p className="mt-2 text-sm text-gray-600">Sign in to your account</p>
        </div>

        {/* Form */}
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            {/* Email Input */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter your email"
                disabled={isLoading}
              />
            </div>

            {/* Password Input */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <div className="mt-1 relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full px-3 py-2 pr-10 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter your password"
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
              disabled={isLoading || !email.trim() || !password.trim()}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              <span className="absolute left-0 inset-y-0 flex items-center pl-3">
                <LogIn className="h-4 w-4" aria-hidden="true" />
              </span>
              {isLoading ? 'Signing in...' : 'Sign in'}
            </button>
          </div>
        </form>

        {/* Divider */}
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-300" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-gray-50 text-gray-500">Or</span>
          </div>
        </div>

        {/* Register Organization Button */}
        <div>
          <button
            type="button"
            onClick={onRegisterOrganization}
            disabled={isLoading}
            className="group relative w-full flex justify-center py-2 px-4 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
          >
            <span className="absolute left-0 inset-y-0 flex items-center pl-3">
              <Building2 className="h-4 w-4" aria-hidden="true" />
            </span>
            Register New Organization
          </button>
        </div>

        {/* Demo Credentials Note */}
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-md">
          <div className="text-sm text-blue-700">
            <p className="font-medium mb-1">Getting Started:</p>
            <p>Sign in to your organization account, or register a new organization to get started with foosball tracking.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginForm; 