import { useState, useEffect, useCallback } from 'react';
import { User, LoginCredentials, AuthResponse, getPermissions, OrganizationSetupData } from '../types/auth';
import { Organization } from '../types/foosball';

const API_BASE = process.env.NODE_ENV === 'production' 
  ? '' 
  : 'http://localhost:3000';

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Initialize auth from localStorage
  useEffect(() => {
    const initAuth = async () => {
      const storedToken = localStorage.getItem('championship_token');
      const storedUser = localStorage.getItem('championship_user');
      const storedOrganization = localStorage.getItem('championship_organization');

      if (storedToken && storedUser) {
        try {
          console.log('Initializing auth with stored token');
          setToken(storedToken);
          setUser(JSON.parse(storedUser));
          
          if (storedOrganization) {
            setOrganization(JSON.parse(storedOrganization));
          }
          
          // Verify token is still valid
          const response = await fetch(`${API_BASE}/api/auth`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${storedToken}`,
              'Content-Type': 'application/json',
            },
          });

          if (response.ok) {
            console.log('Token verification successful');
            const data = await response.json();
            setUser(data.user);
            if (data.organization) {
              setOrganization(data.organization);
            }
            // Keep the token that was already set
          } else {
            console.log('Token verification failed, clearing auth');
            // Token is invalid, clear everything
            localStorage.removeItem('championship_token');
            localStorage.removeItem('championship_user');
            localStorage.removeItem('championship_organization');
            setToken(null);
            setUser(null);
            setOrganization(null);
          }
        } catch (error) {
          console.error('Auth initialization error:', error);
          // Keep existing auth data on network error
        }
      }

      setIsLoading(false);
    };

    initAuth();
  }, []);

  const login = useCallback(async (credentials: LoginCredentials): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/api/auth`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'login',
          ...credentials,
        }),
      });

      const data: AuthResponse = await response.json();

      if (data.success && data.user && data.token) {
        // Store in localStorage
        localStorage.setItem('championship_token', data.token);
        localStorage.setItem('championship_user', JSON.stringify(data.user));
        if (data.organization) {
          localStorage.setItem('championship_organization', JSON.stringify(data.organization));
        }
        
        // Update state
        setToken(data.token);
        setUser(data.user);
        setOrganization(data.organization || null);
        setIsLoading(false);
        return true;
      } else {
        setError(data.error || 'Login failed');
        setIsLoading(false);
        return false;
      }
    } catch (error) {
      console.error('Login error:', error);
      setError('Network error during login');
      setIsLoading(false);
      return false;
    }
  }, []);

  const registerOrganization = useCallback(async (data: OrganizationSetupData): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/api/organizations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'register',
          organizationName: data.organizationName,
          organizationDomain: data.organizationDomain,
          adminEmail: data.adminEmail,
          adminUsername: data.adminUsername,
          adminPassword: data.adminPassword,
        }),
      });

      const responseData: AuthResponse = await response.json();

      if (responseData.success && responseData.user && responseData.token && responseData.organization) {
        // Store in localStorage
        localStorage.setItem('championship_token', responseData.token);
        localStorage.setItem('championship_user', JSON.stringify(responseData.user));
        localStorage.setItem('championship_organization', JSON.stringify(responseData.organization));
        
        // Update state
        setToken(responseData.token);
        setUser(responseData.user);
        setOrganization(responseData.organization);
        setIsLoading(false);
        return true;
      } else {
        setError(responseData.error || 'Organization registration failed');
        setIsLoading(false);
        return false;
      }
    } catch (error) {
      console.error('Organization registration error:', error);
      setError('Network error during organization registration');
      setIsLoading(false);
      return false;
    }
  }, []);

  const logout = useCallback(() => {
    // Clear localStorage
    localStorage.removeItem('championship_token');
    localStorage.removeItem('championship_user');
    localStorage.removeItem('championship_organization');
    
    // Clear state
    setToken(null);
    setUser(null);
    setOrganization(null);
    setError(null);
  }, []);

  const refreshUser = useCallback(async () => {
    if (!token) return;

    try {
      const response = await fetch(`${API_BASE}/api/auth`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data: AuthResponse = await response.json();

      if (data.success && data.user) {
        setUser(data.user);
        setOrganization(data.organization || null);
        localStorage.setItem('championship_user', JSON.stringify(data.user));
        if (data.organization) {
          localStorage.setItem('championship_organization', JSON.stringify(data.organization));
        }
      } else {
        // Token invalid, logout
        logout();
      }
    } catch (error) {
      console.error('Refresh user error:', error);
    }
  }, [token, logout]);

  const inviteUser = useCallback(async (email: string): Promise<{ success: boolean; invitationUrl?: string }> => {
    if (!token) {
      setError('Authentication required');
      return { success: false };
    }

    try {
      const response = await fetch(`${API_BASE}/api/auth`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'invite',
          email,
        }),
      });

      const data: AuthResponse = await response.json();

      if (data.success) {
        return { success: true, invitationUrl: data.invitationUrl };
      } else {
        setError(data.error || 'Failed to invite user');
        return { success: false };
      }
    } catch (error) {
      console.error('Invite user error:', error);
      setError('Network error during user invitation');
      return { success: false };
    }
  }, [token]);

  const completeInvitation = useCallback(async (token: string, username: string, password: string): Promise<boolean> => {
    try {
      const response = await fetch(`${API_BASE}/api/auth`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'complete-invitation',
          token,
          username,
          password,
        }),
      });

      const data: AuthResponse = await response.json();

      if (data.success) {
        return true;
      } else {
        setError(data.error || 'Failed to complete invitation');
        return false;
      }
    } catch (error) {
      console.error('Complete invitation error:', error);
      setError('Network error during invitation completion');
      return false;
    }
  }, []);

  // Get user permissions
  const permissions = user ? getPermissions(user.role) : getPermissions('');

  // Helper to check if user is authenticated
  const isAuthenticated = !!(user && token);

  // Helper to check if user is superuser
  const isSuperuser = user?.role === 'superuser';

  // Helper to check if user has organization
  const hasOrganization = !!organization;

  // Helper to make authenticated API calls
  const makeAuthenticatedRequest = useCallback(async (url: string, options: RequestInit = {}) => {
    console.log('makeAuthenticatedRequest called with token:', token ? 'Present' : 'Missing');
    console.log('Token value:', token);
    console.log('localStorage token:', localStorage.getItem('championship_token'));
    
    if (!token) {
      // Try to get token from localStorage as fallback
      const fallbackToken = localStorage.getItem('championship_token');
      if (fallbackToken) {
        console.log('Using fallback token from localStorage');
        setToken(fallbackToken);
        
        const headers = {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${fallbackToken}`,
          ...options.headers,
        };

        return fetch(`${API_BASE}${url}`, {
          ...options,
          headers,
        });
      }
      
      throw new Error('No authentication token');
    }

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...options.headers,
    };

    return fetch(`${API_BASE}${url}`, {
      ...options,
      headers,
    });
  }, [token]);

  return {
    user,
    organization,
    token,
    isAuthenticated,
    hasOrganization,
    isLoading,
    error,
    permissions,
    isSuperuser,
    login,
    registerOrganization,
    logout,
    refreshUser,
    inviteUser,
    completeInvitation,
    makeAuthenticatedRequest,
    clearError: () => setError(null),
  };
}; 