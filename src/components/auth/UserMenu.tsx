import React, { useState } from 'react';
import { LogOut, Users, User, ChevronDown } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import UserManagementModal from './UserManagementModal';
import ThemeToggle from '../ui/theme-toggle';

const UserMenu: React.FC = () => {
  const { user, organization, logout, permissions } = useAuth();
  const [showUserModal, setShowUserModal] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  if (!user) return null;

  return (
    <>
      <div className="relative">
        {/* User Info Button */}
        <button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="flex items-center gap-3 p-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
        >
          <div className="w-8 h-8 bg-blue-600 dark:bg-blue-500 rounded-full flex items-center justify-center">
            <User className="w-4 h-4 text-white" />
          </div>
          <div className="text-left hidden sm:block">
            <div className="text-sm font-medium text-gray-900 dark:text-white">{user.username}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">{organization?.name}</div>
          </div>
          <ChevronDown className="w-4 h-4 text-gray-500 dark:text-gray-400" />
        </button>

        {/* Dropdown Menu */}
        {dropdownOpen && (
          <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50">
            <div className="p-3 border-b border-gray-200 dark:border-gray-700">
              <div className="text-sm font-medium text-gray-900 dark:text-white">{user.username}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">{user.email}</div>
              <div className="text-xs text-blue-600 dark:text-blue-400 capitalize">{user.role}</div>
              {organization && (
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{organization.name}</div>
              )}
            </div>

            <div className="p-2">
              {/* Theme Toggle */}
              <div className="flex items-center justify-between px-3 py-2">
                <span className="text-sm text-gray-700 dark:text-gray-300">Dark Mode</span>
                <ThemeToggle />
              </div>

              {/* User Management */}
              {permissions.canManageUsers && (
                <button
                  onClick={() => {
                    setShowUserModal(true);
                    setDropdownOpen(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors duration-200"
                >
                  <Users className="w-4 h-4" />
                  Manage Users
                </button>
              )}

              {/* Logout */}
              <button
                onClick={() => {
                  logout();
                  setDropdownOpen(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors duration-200"
              >
                <LogOut className="w-4 h-4" />
                Sign out
              </button>
            </div>
          </div>
        )}

        {/* Click outside to close dropdown */}
        {dropdownOpen && (
          <div
            className="fixed inset-0 z-40"
            onClick={() => setDropdownOpen(false)}
          />
        )}
      </div>

      {/* User Management Modal */}
      {showUserModal && (
        <UserManagementModal
          isOpen={showUserModal}
          onClose={() => setShowUserModal(false)}
        />
      )}
    </>
  );
};

export default UserMenu; 