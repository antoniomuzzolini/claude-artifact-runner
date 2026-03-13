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
  season_id: number;
}

export interface Match {
  id: number;
  date: string;
  time: string;
  teams: string[][];
  scores: number[];
  winnerIndex: number | null;
  eloChanges: { [playerName: string]: number };
  createdBy?: number; // User ID who created the match
  organization_id: number;
  season_id: number;
}

export interface NewMatch {
  teams: string[][];
  scores: number[];
}

export interface Season {
  id: number;
  name: string;
  startDate: string;
  endDate?: string | null;
  organization_id: number;
  isCurrent?: boolean;
}

export interface AppData {
  players: Player[];
  matches: Match[];
  seasons?: Season[];
  currentSeasonId?: number | null;
  lastSaved: string;
  version?: string;
  exportDate?: string;
  organization?: Organization;
} 
