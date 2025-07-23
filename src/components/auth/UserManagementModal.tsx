import React, { useState, useEffect } from 'react';
import { X, UserPlus, Mail, User, Shield, Trash2, Copy, Clock } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { User as UserType } from '../../types/auth';

interface UserManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const UserManagementModal: React.FC<UserManagementModalProps> = ({ isOpen, onClose }) => {
  const { inviteUser, makeAuthenticatedRequest, error: authError, clearError } = useAuth();
  const [users, setUsers] = useState<UserType[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [invitationUrl, setInvitationUrl] = useState<string | null>(null);

  // Invite user form state
  const [newUserEmail, setNewUserEmail] = useState('');
  const [isInviting, setIsInviting] = useState(false);

  // Fetch users when modal opens
  useEffect(() => {
    if (isOpen) {
      clearError(); // Clear any previous auth errors
      fetchUsers();
    }
  }, [isOpen, clearError]);

  const fetchUsers = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await makeAuthenticatedRequest('/api/users');
      
      if (response.ok) {
        const data = await response.json();
        setUsers(data.users || []);
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to fetch users');
      }
    } catch (error) {
      console.error('Error fetching users:', error);
      setError('Network error while fetching users');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInviteUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    clearError(); // Clear any previous auth errors

    if (!newUserEmail.trim()) {
      setError('Email address is required');
      return;
    }

    setIsInviting(true);

    try {
      const result = await inviteUser(newUserEmail.trim());
      
      if (result.success) {
        // Show invitation URL
        setInvitationUrl(result.invitationUrl || '');
        
        // Reset form
        setNewUserEmail('');
        
        // Refresh users list
        await fetchUsers();
      }
    } catch (error) {
      console.error('Error inviting user:', error);
    } finally {
      setIsInviting(false);
    }
  };

  const copyInvitationUrl = () => {
    if (invitationUrl) {
      navigator.clipboard.writeText(invitationUrl);
    }
  };

  const handleDeleteUser = async (userId: number, username: string) => {
    if (!confirm(`Are you sure you want to delete user "${username}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const response = await makeAuthenticatedRequest('/api/users', {
        method: 'DELETE',
        body: JSON.stringify({ userId }),
      });

      if (response.ok) {
        await fetchUsers(); // Refresh the list
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to delete user');
      }
    } catch (error) {
      console.error('Error deleting user:', error);
      setError('Network error while deleting user');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-900">User Management</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-md transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          {/* Error Message */}
          {(error || authError) && (
            <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-4">
              <div className="text-sm text-red-700">{error || authError}</div>
            </div>
          )}

          {/* Invite User Button */}
          {!showInviteForm && !invitationUrl && (
            <div className="mb-6">
              <button
                onClick={() => setShowInviteForm(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                <UserPlus className="w-4 h-4" />
                Invite New User
              </button>
            </div>
          )}

          {/* Invite User Form */}
          {showInviteForm && (
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium text-gray-900">Invite New User</h3>
                <button
                  onClick={() => {
                    setShowInviteForm(false);
                    setNewUserEmail('');
                    setError(null);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
                <p className="text-sm text-blue-700">
                  <strong>New workflow:</strong> Just enter the user's email address. They'll receive an invitation link to set up their own username and password.
                </p>
              </div>

              <form onSubmit={handleInviteUser} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={newUserEmail}
                    onChange={(e) => setNewUserEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="user@example.com"
                    disabled={isInviting}
                    required
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={isInviting}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
                  >
                    {isInviting ? 'Sending Invitation...' : 'Send Invitation'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowInviteForm(false)}
                    className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Invitation URL Display */}
          {invitationUrl && (
            <div className="bg-green-50 rounded-lg p-4 mb-6 border border-green-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium text-green-900">Invitation Sent Successfully!</h3>
                <button
                  onClick={() => {
                    setInvitationUrl(null);
                    setShowInviteForm(false);
                  }}
                  className="text-green-600 hover:text-green-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-sm text-green-700 mb-3">
                Share this invitation link with the new user. They'll use it to set up their username and password:
              </p>

              <div className="flex items-center gap-2 bg-white border border-green-300 rounded-md p-2">
                <input
                  type="text"
                  value={invitationUrl}
                  readOnly
                  className="flex-1 text-sm bg-transparent border-none outline-none"
                />
                <button
                  onClick={copyInvitationUrl}
                  className="flex items-center gap-1 px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition-colors"
                >
                  <Copy className="w-3 h-3" />
                  Copy
                </button>
              </div>

              <p className="text-xs text-green-600 mt-2">
                💡 The invitation link expires in 7 days. The user will appear as "Pending" until they complete setup.
              </p>
            </div>
          )}

          {/* Users List */}
          <div>
            <h3 className="font-medium text-gray-900 mb-4">Existing Users</h3>
            
            {isLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                <p className="text-gray-600">Loading users...</p>
              </div>
            ) : users.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No users found
              </div>
            ) : (
              <div className="space-y-2">
                {users.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-md"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex-shrink-0">
                        {user.status === 'pending' ? (
                          <Clock className="w-5 h-5 text-yellow-600" />
                        ) : user.role === 'superuser' ? (
                          <Shield className="w-5 h-5 text-purple-600" />
                        ) : (
                          <User className="w-5 h-5 text-blue-600" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900">{user.username}</span>
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            user.role === 'superuser' 
                              ? 'bg-purple-100 text-purple-800' 
                              : 'bg-blue-100 text-blue-800'
                          }`}>
                            {user.role === 'superuser' ? 'Admin' : 'User'}
                          </span>
                          {user.status === 'pending' && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                              Pending Setup
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 text-sm text-gray-500">
                          <Mail className="w-3 h-3" />
                          {user.email}
                        </div>
                        {user.status === 'active' && user.last_login && (
                          <div className="text-xs text-gray-400">
                            Last login: {new Date(user.last_login).toLocaleDateString()}
                          </div>
                        )}
                        {user.status === 'pending' && (
                          <div className="text-xs text-yellow-600">
                            Waiting for user to complete setup
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {user.status === 'pending' && user.invitation_token && (
                        <button
                          onClick={() => setInvitationUrl(`${window.location.origin}/complete-invitation?token=${user.invitation_token}`)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                          title="Show invitation link"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                      )}
                      {user.role !== 'superuser' && (
                        <button
                          onClick={() => handleDeleteUser(user.id, user.username)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                          title="Delete user"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserManagementModal; 