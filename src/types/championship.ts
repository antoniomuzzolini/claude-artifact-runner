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
  pointsScored?: number;
  pointsConceded?: number;
  organization_id: number;
}

export interface MatchTeamPlayer {
  id: number;
  name: string;
}

export interface Match {
  id: number;
  date: string;
  time: string;
  teams: MatchTeamPlayer[][];
  scores: number[];
  winnerIndex: number | null;
  eloChanges: { [playerId: string]: number };
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

export type TournamentFormat = 'single_elimination' | 'round_robin' | 'groups_knockout' | 'swiss';
export type TournamentSeedingMode = 'random' | 'elo' | 'manual';
export type TournamentPhase = 'round_robin' | 'group' | 'knockout' | 'swiss';

export type SlotSource =
  | { kind: 'player'; playerId: number }
  | { kind: 'winner'; slotId: string }
  | { kind: 'qualifier'; group: number; rank: number }
  | { kind: 'bye' };

export interface TournamentSlot {
  id: string;
  phase: TournamentPhase;
  round: number; // 1-based
  position: number; // 0-based within round
  group?: number; // 0-based, group phase only
  home: SlotSource;
  away: SlotSource;
  matchId: number | null; // linked Match once the result is recorded
}

// 'flat': fixed points per win/draw. 'set_based' (volleyball-style): scores are
// sets won; margin >= 2 awards 3/0, a deciding set (margin 1) awards 2/1.
export type TournamentPointsScheme = 'flat' | 'set_based';

export interface TournamentConfig {
  groupCount?: number;
  qualifiersPerGroup?: number;
  swissRounds?: number;
  pointsWin: number;
  pointsDraw: number;
  pointsScheme?: TournamentPointsScheme;
}

export interface Tournament {
  id: number;
  name: string;
  format: TournamentFormat;
  seeding: TournamentSeedingMode;
  participantIds: number[]; // in seed order
  config: TournamentConfig;
  slots: TournamentSlot[];
  organization_id: number;
  season_id: number;
  createdBy?: number;
  createdAt: string;
}

export interface AppData {
  players: Player[];
  matches: Match[];
  seasons?: Season[];
  tournaments?: Tournament[];
  currentSeasonId?: number | null;
  lastSaved: string;
  version?: string;
  exportDate?: string;
  organization?: Organization;
}
