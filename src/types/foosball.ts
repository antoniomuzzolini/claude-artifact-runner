// Type definitions for Championship Manager application

export interface Organization {
  id: number;
  name: string;
  domain?: string;
  created_at: string;
  created_by: number; // User ID of the organization creator (superuser)
}

export interface Player {
  id: number;
  name: string;
  elo: number;
  matches: number;
  wins: number;
  losses: number;
  organization_id: number;
}

export interface Match {
  id: number;
  date: string;
  time: string;
  team1: string[];
  team2: string[];
  winner: string;
  team1Score: number;
  team2Score: number;
  eloChanges: { [playerName: string]: number };
  createdBy?: number; // User ID who created the match
  organization_id: number;
}

export interface NewMatch {
  team1: string[];
  team2: string[];
  team1Score: number;
  team2Score: number;
}

export interface AppData {
  players: Player[];
  matches: Match[];
  lastSaved: string;
  version?: string;
  exportDate?: string;
  organization?: Organization;
} 