// Authentication types for the Championship Manager application

import { Organization } from './foosball';

export interface User {
  id: number;
  email: string;
  username: string;
  role: 'superuser' | 'user';
  status: 'active' | 'pending' | 'suspended';
  created_at: string;
  created_by?: number;
  last_login?: string;
  invitation_token?: string;
  organization_id: number;
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

export interface InviteUser {
  email: string;
}

export interface CompleteInvitation {
  token: string;
  username: string;
  password: string;
}

export interface AuthResponse {
  success: boolean;
  user?: User;
  token?: string;
  error?: string;
  message?: string;
  invitationUrl?: string;
  organization?: Organization;
}

export interface AuthContext {
  user: User | null;
  token: string | null;
  organization: Organization | null;
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

export interface OrganizationSetupData {
  organizationName: string;
  organizationDomain?: string;
  adminEmail: string;
  adminUsername: string;
  adminPassword: string;
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