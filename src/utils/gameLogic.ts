import { Player } from '../types/foosball';

// Calculate ELO rating
export const calculateELODifference = (playerRating: number, opponentRating: number, actualScore: number, kFactor = 32) => {
  const expectedScore = 1 / (1 + Math.pow(10, (opponentRating - playerRating) / 400));
  return Math.round(kFactor * (actualScore - expectedScore));
};

// Find or create player
export const findOrCreatePlayer = (
  name: string, 
  players: Player[], 
  setPlayers: React.Dispatch<React.SetStateAction<Player[]>>,
  organizationId: number,
  seasonId: number
): Player => {
  const existingPlayer = players.find(
    p => p.name.toLowerCase() === name.toLowerCase() && p.season_id === seasonId
  );
  
  if (existingPlayer) {
    return existingPlayer;
  }
  
  const newPlayer: Player = {
    id: Date.now() + Math.floor(Math.random() * 1000),
    name: name.trim(),
    elo: 1200,
    matches: 0,
    wins: 0,
    losses: 0,
    organization_id: organizationId,
    season_id: seasonId
  };
  
  setPlayers(prev => [...prev, newPlayer]);
  return newPlayer;
};

// Validate match data
export const validateMatch = (
  team1: string[],
  team2: string[],
  team1Score: number,
  team2Score: number
): boolean => {
  return !!(
    team1.length > 0 && 
    team2.length > 0 && 
    team1.every(name => name.trim()) && 
    team2.every(name => name.trim()) && 
    team1Score !== team2Score &&
    // Ensure no duplicate players across teams
    !team1.some(p1 => team2.some(p2 => p1.toLowerCase() === p2.toLowerCase())) &&
    // Ensure no duplicate players within teams
    team1.length === new Set(team1.map(p => p.toLowerCase())).size &&
    team2.length === new Set(team2.map(p => p.toLowerCase())).size
  );
}; 
