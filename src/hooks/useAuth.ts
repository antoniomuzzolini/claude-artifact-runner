import { useState, useEffect, useCallback } from 'react';
import { User, LoginCredentials, AuthResponse, getPermissions } from '../types/auth';

const API_BASE = process.env.NODE_ENV === 'production' 
  ? '' 
  : 'http://localhost:3000';

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Initialize auth from localStorage
  useEffect(() => {
    const initAuth = async () => {
      const storedToken = localStorage.getItem('foosball_token');
      const storedUser = localStorage.getItem('foosball_user');

      if (storedToken && storedUser) {
        try {
          // Verify token is still valid
          const response = await fetch(`${API_BASE}/api/auth`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${storedToken}`,
              'Content-Type': 'application/json',
            },
          });

          if (response.ok) {
            const data: AuthResponse = await response.json();
            if (data.success && data.user) {
              setToken(storedToken);
              setUser(data.user);
            } else {
              // Token invalid, clear storage
              localStorage.removeItem('foosball_token');
              localStorage.removeItem('foosball_user');
            }
          } else {
            // Token invalid, clear storage
            localStorage.removeItem('foosball_token');
            localStorage.removeItem('foosball_user');
          }
        } catch (error) {
          console.error('Auth initialization error:', error);
          localStorage.removeItem('foosball_token');
          localStorage.removeItem('foosball_user');
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
        localStorage.setItem('foosball_token', data.token);
        localStorage.setItem('foosball_user', JSON.stringify(data.user));
        
        // Update state
        setToken(data.token);
        setUser(data.user);
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

  const logout = useCallback(() => {
    // Clear localStorage
    localStorage.removeItem('foosball_token');
    localStorage.removeItem('foosball_user');
    
    // Clear state
    setToken(null);
    setUser(null);
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
        localStorage.setItem('foosball_user', JSON.stringify(data.user));
      } else {
        // Token invalid, logout
        logout();
      }
    } catch (error) {
      console.error('Refresh user error:', error);
    }
  }, [token, logout]);

  const createUser = useCallback(async (email: string, username: string, password: string): Promise<boolean> => {
    if (!token) {
      setError('Authentication required');
      return false;
    }

    try {
      const response = await fetch(`${API_BASE}/api/auth`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'register',
          email,
          username,
          password,
        }),
      });

      const data: AuthResponse = await response.json();

      if (data.success) {
        return true;
      } else {
        setError(data.error || 'Failed to create user');
        return false;
      }
    } catch (error) {
      console.error('Create user error:', error);
      setError('Network error during user creation');
      return false;
    }
  }, [token]);

  // Get user permissions
  const permissions = user ? getPermissions(user.role) : getPermissions('');

  // Helper to check if user is authenticated
  const isAuthenticated = !!(user && token);

  // Helper to check if user is superuser
  const isSuperuser = user?.role === 'superuser';

  // Helper to make authenticated API calls
  const makeAuthenticatedRequest = useCallback(async (url: string, options: RequestInit = {}) => {
    if (!token) {
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
    token,
    isAuthenticated,
    isLoading,
    error,
    permissions,
    isSuperuser,
    login,
    logout,
    refreshUser,
    createUser,
    makeAuthenticatedRequest,
    clearError: () => setError(null),
  };
}; 