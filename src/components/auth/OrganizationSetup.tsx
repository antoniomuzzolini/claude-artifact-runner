import React, { useState } from 'react';
import { Building2, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { OrganizationSetupData } from '../../types/auth';

interface OrganizationSetupProps {
  onOrganizationSetup: (data: OrganizationSetupData) => Promise<boolean>;
  onBackToLogin: () => void;
  isLoading: boolean;
  error: string | null;
  onClearError: () => void;
}

const OrganizationSetup: React.FC<OrganizationSetupProps> = ({ 
  onOrganizationSetup, 
  onBackToLogin, 
  isLoading, 
  error, 
  onClearError 
}) => {
  const [organizationName, setOrganizationName] = useState('');
  const [organizationDomain, setOrganizationDomain] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    onClearError();

    // Validation
    if (!organizationName.trim() || !adminEmail.trim() || !adminUsername.trim() || !adminPassword.trim()) {
      return;
    }

    if (adminPassword !== confirmPassword) {
      return;
    }

    if (adminPassword.length < 6) {
      return;
    }

    await onOrganizationSetup({
      organizationName: organizationName.trim(),
      organizationDomain: organizationDomain.trim() || undefined,
      adminEmail: adminEmail.trim(),
      adminUsername: adminUsername.trim(),
      adminPassword,
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="max-w-md w-full space-y-8 p-8">
        {/* Header */}
        <div className="text-center">
          <div className="text-4xl mb-4">🏢</div>
          <h2 className="text-3xl font-bold text-gray-900">Create Organization</h2>
          <p className="mt-2 text-sm text-gray-600">Set up your championship organization and admin account</p>
        </div>

        {/* Form */}
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            {/* Organization Name Input */}
            <div>
              <label htmlFor="organizationName" className="block text-sm font-medium text-gray-700">
                Organization Name *
              </label>
              <input
                id="organizationName"
                name="organizationName"
                type="text"
                required
                value={organizationName}
                onChange={(e) => setOrganizationName(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g., Acme Corporation"
                disabled={isLoading}
              />
            </div>

            {/* Organization Domain Input (Optional) */}
            <div>
              <label htmlFor="organizationDomain" className="block text-sm font-medium text-gray-700">
                Organization Domain (Optional)
              </label>
              <input
                id="organizationDomain"
                name="organizationDomain"
                type="text"
                value={organizationDomain}
                onChange={(e) => setOrganizationDomain(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g., acme.com"
                disabled={isLoading}
              />
            </div>

            <div className="border-t pt-4">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Administrator Account</h3>

              {/* Admin Email Input */}
              <div className="mb-4">
                <label htmlFor="adminEmail" className="block text-sm font-medium text-gray-700">
                  Admin Email *
                </label>
                <input
                  id="adminEmail"
                  name="adminEmail"
                  type="email"
                  autoComplete="email"
                  required
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="admin@example.com"
                  disabled={isLoading}
                />
              </div>

              {/* Admin Username Input */}
              <div className="mb-4">
                <label htmlFor="adminUsername" className="block text-sm font-medium text-gray-700">
                  Admin Username *
                </label>
                <input
                  id="adminUsername"
                  name="adminUsername"
                  type="text"
                  required
                  value={adminUsername}
                  onChange={(e) => setAdminUsername(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="admin"
                  disabled={isLoading}
                />
              </div>

              {/* Admin Password Input */}
              <div className="mb-4">
                <label htmlFor="adminPassword" className="block text-sm font-medium text-gray-700">
                  Admin Password *
                </label>
                <div className="mt-1 relative">
                  <input
                    id="adminPassword"
                    name="adminPassword"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    required
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    className="block w-full px-3 py-2 pr-10 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter admin password"
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
                {adminPassword && adminPassword.length < 6 && (
                  <p className="mt-1 text-sm text-red-600">Password must be at least 6 characters long</p>
                )}
              </div>

              {/* Confirm Password Input */}
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                  Confirm Password *
                </label>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Confirm admin password"
                  disabled={isLoading}
                />
                {confirmPassword && adminPassword !== confirmPassword && (
                  <p className="mt-1 text-sm text-red-600">Passwords do not match</p>
                )}
              </div>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-4">
              <div className="text-sm text-red-700">{error}</div>
            </div>
          )}

          {/* Buttons */}
          <div className="space-y-3">
            <button
              type="submit"
              disabled={
                isLoading || 
                !organizationName.trim() || 
                !adminEmail.trim() || 
                !adminUsername.trim() || 
                !adminPassword.trim() || 
                adminPassword !== confirmPassword ||
                adminPassword.length < 6
              }
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              <span className="absolute left-0 inset-y-0 flex items-center pl-3">
                <Building2 className="h-4 w-4" aria-hidden="true" />
              </span>
              {isLoading ? 'Creating Organization...' : 'Create Organization'}
            </button>

            <button
              type="button"
              onClick={onBackToLogin}
              disabled={isLoading}
              className="group relative w-full flex justify-center py-2 px-4 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
            >
              <span className="absolute left-0 inset-y-0 flex items-center pl-3">
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              </span>
              Back to Login
            </button>
          </div>
        </form>

        {/* Info Note */}
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-md">
          <div className="text-sm text-blue-700">
            <p className="font-medium mb-1">What happens next:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Your organization will be created</li>
              <li>You'll become the organization administrator</li>
              <li>You can invite other users to join your organization</li>
              <li>All championship data will be isolated to your organization</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrganizationSetup; 