"use client";

import React, { useState } from 'react';
import { LogOut, Users, User, ChevronDown, Building2, Check, PlusCircle, X } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import UserManagementModal from './UserManagementModal';
import ThemeToggle from '../ui/theme-toggle';

const UserMenu: React.FC = () => {
  const {
    user,
    organization,
    memberships,
    logout,
    permissions,
    switchOrganization,
    createOrganization,
    error,
    clearError
  } = useAuth();
  const [showUserModal, setShowUserModal] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [showNewOrgModal, setShowNewOrgModal] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  const [isSwitching, setIsSwitching] = useState(false);
  const [isCreatingOrg, setIsCreatingOrg] = useState(false);

  if (!user) return null;

  const handleSwitch = async (organizationId: number) => {
    if (organizationId === organization?.id || isSwitching) return;
    setIsSwitching(true);
    await switchOrganization(organizationId);
    setIsSwitching(false);
    setDropdownOpen(false);
  };

  const handleCreateOrg = async () => {
    if (!newOrgName.trim() || isCreatingOrg) return;
    setIsCreatingOrg(true);
    const success = await createOrganization(newOrgName.trim());
    setIsCreatingOrg(false);
    if (success) {
      setNewOrgName('');
      setShowNewOrgModal(false);
    }
  };

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
          <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50">
            <div className="p-3 border-b border-gray-200 dark:border-gray-700">
              <div className="text-sm font-medium text-gray-900 dark:text-white">{user.username}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">{user.email}</div>
              <div className="text-xs text-blue-600 dark:text-blue-400 capitalize">{user.role}</div>
            </div>

            {/* Organizations */}
            <div className="p-2 border-b border-gray-200 dark:border-gray-700">
              <div className="px-3 py-1 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5" />
                Organizations
              </div>
              {memberships.map(membership => {
                const isActive = membership.organization_id === organization?.id;
                return (
                  <button
                    key={membership.organization_id}
                    onClick={() => handleSwitch(membership.organization_id)}
                    disabled={isSwitching}
                    className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-sm rounded-md transition-colors duration-200 ${
                      isActive
                        ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                    } disabled:opacity-60`}
                  >
                    <span className="truncate">{membership.name}</span>
                    <span className="flex items-center gap-1.5 shrink-0">
                      {membership.role === 'superuser' && (
                        <span className="text-[10px] font-semibold uppercase text-amber-600 dark:text-amber-400">admin</span>
                      )}
                      {isActive && <Check className="w-4 h-4" />}
                    </span>
                  </button>
                );
              })}
              <button
                onClick={() => {
                  clearError();
                  setShowNewOrgModal(true);
                  setDropdownOpen(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors duration-200"
              >
                <PlusCircle className="w-4 h-4" />
                New organization
              </button>
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

      {/* New Organization Modal */}
      {showNewOrgModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Building2 className="w-5 h-5 text-blue-500" />
                New organization
              </h3>
              <button
                onClick={() => setShowNewOrgModal(false)}
                className="p-1 rounded-md text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              You will become its administrator, and your account switches to it right away.
            </p>
            <input
              type="text"
              value={newOrgName}
              onChange={(e) => setNewOrgName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateOrg();
              }}
              placeholder="Organization name"
              autoFocus
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 mb-3"
            />
            {error && (
              <p className="text-sm text-red-600 dark:text-red-400 mb-3">{error}</p>
            )}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowNewOrgModal(false)}
                className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors duration-200"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateOrg}
                disabled={!newOrgName.trim() || isCreatingOrg}
                className="px-4 py-2 text-sm bg-blue-600 dark:bg-blue-500 text-white rounded-md hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isCreatingOrg ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

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
