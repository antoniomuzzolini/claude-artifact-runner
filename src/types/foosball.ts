// Type definitions for Foosball Manager application

export interface Player {
  id: number;
  name: string;
  elo: number;
  matches: number;
  wins: number;
  losses: number;
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
}

export interface NewMatch {
  team1Player1: string;
  team1Player2: string;
  team2Player1: string;
  team2Player2: string;
  team1Score: number;
  team2Score: number;
}

export interface AppData {
  players: Player[];
  matches: Match[];
  lastSaved: string;
  version?: string;
  exportDate?: string;
} 