// Authentication types for the Foosball Manager application

export interface User {
  id: number;
  email: string;
  username: string;
  role: 'superuser' | 'user';
  created_at: string;
  created_by?: number;
  last_login?: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterUser {
  email: string;
  username: string;
  password: string;
  role?: 'user'; // Only superuser can create other superusers
}

export interface AuthResponse {
  success: boolean;
  user?: User;
  token?: string;
  message?: string;
  error?: string;
}

export interface AuthContext {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: LoginCredentials) => Promise<boolean>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

export interface Permission {
  canViewRankings: boolean;
  canViewHistory: boolean;
  canAddMatches: boolean;
  canDeleteAnyMatch: boolean;
  canDeleteOwnMatches: boolean;
  canManageUsers: boolean;
  canExportData: boolean;
  canResetData: boolean;
}

// Helper function to get permissions based on role
export const getPermissions = (role: string): Permission => {
  switch (role) {
    case 'superuser':
      return {
        canViewRankings: true,
        canViewHistory: true,
        canAddMatches: true,
        canDeleteAnyMatch: true,
        canDeleteOwnMatches: true,
        canManageUsers: true,
        canExportData: true,
        canResetData: true,
      };
    case 'user':
      return {
        canViewRankings: true,
        canViewHistory: true,
        canAddMatches: true,
        canDeleteAnyMatch: false,
        canDeleteOwnMatches: true,
        canManageUsers: false,
        canExportData: false,
        canResetData: false,
      };
    default:
      return {
        canViewRankings: false,
        canViewHistory: false,
        canAddMatches: false,
        canDeleteAnyMatch: false,
        canDeleteOwnMatches: false,
        canManageUsers: false,
        canExportData: false,
        canResetData: false,
      };
  }
}; 