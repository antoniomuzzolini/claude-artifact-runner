import React, { useState } from 'react';
import { User, LogOut, Settings, UserPlus, ChevronDown } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

const UserMenu: React.FC = () => {
  const { user, logout, permissions } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  if (!user) return null;

  return (
    <div className="relative">
      {/* User Menu Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 text-sm bg-white border border-gray-200 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <User className="w-4 h-4" />
        <span className="hidden sm:inline">{user.username}</span>
        <span className="text-xs text-gray-500 hidden sm:inline">
          ({user.role})
        </span>
        <ChevronDown className="w-4 h-4" />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <>
          {/* Overlay */}
          <div 
            className="fixed inset-0 z-10" 
            onClick={() => setIsOpen(false)}
          />
          
          {/* Menu */}
          <div className="absolute right-0 mt-2 w-56 bg-white border border-gray-200 rounded-md shadow-lg z-20">
            <div className="py-2">
              {/* User Info */}
              <div className="px-4 py-2 border-b border-gray-100">
                <p className="font-medium text-gray-900">{user.username}</p>
                <p className="text-sm text-gray-500">{user.email}</p>
                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium mt-1 ${
                  user.role === 'superuser' 
                    ? 'bg-purple-100 text-purple-800' 
                    : 'bg-blue-100 text-blue-800'
                }`}>
                  {user.role === 'superuser' ? 'Administrator' : 'User'}
                </span>
              </div>

              {/* Menu Items */}
              <div className="py-1">
                {permissions.canManageUsers && (
                  <button
                    onClick={() => {
                      setIsOpen(false);
                      // TODO: Open user management modal
                    }}
                    className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    <UserPlus className="w-4 h-4" />
                    Manage Users
                  </button>
                )}

                <button
                  onClick={() => {
                    setIsOpen(false);
                    // TODO: Open user settings modal
                  }}
                  className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  <Settings className="w-4 h-4" />
                  Settings
                </button>

                <div className="border-t border-gray-100 my-1" />

                <button
                  onClick={() => {
                    setIsOpen(false);
                    logout();
                  }}
                  className="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                >
                  <LogOut className="w-4 h-4" />
                  Sign out
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default UserMenu; 