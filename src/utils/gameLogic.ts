import { Player } from '../types/foosball';

// Calculate ELO rating
export const calculateELO = (playerRating: number, opponentRating: number, actualScore: number, kFactor = 32) => {
  const expectedScore = 1 / (1 + Math.pow(10, (opponentRating - playerRating) / 400));
  return Math.round(playerRating + kFactor * (actualScore - expectedScore));
};

// Get adaptive K-factor based on player experience and match margin
export const getKFactor = (matches: number, marginFactor: number = 1) => {
  const baseFactor = matches < 10 ? 40 : matches < 20 ? 32 : 24;
  return Math.round(baseFactor * marginFactor);
};

// Calculate margin factor based on score difference
export const calculateMarginFactor = (scoreDifference: number) => {
  return Math.min(1 + (scoreDifference - 1) * 0.1, 2); // Max 2x multiplier
};

// Find or create player
export const findOrCreatePlayer = (
  name: string, 
  players: Player[], 
  setPlayers: React.Dispatch<React.SetStateAction<Player[]>>,
  organizationId: number
): Player => {
  const existingPlayer = players.find(
    p => p.name.toLowerCase() === name.toLowerCase()
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
    organization_id: organizationId
  };
  
  setPlayers(prev => [...prev, newPlayer]);
  return newPlayer;
};

// Calculate ELO for unbalanced teams
export const calculateUnbalancedELO = (
  playerRating: number,
  opponentTeamRatings: number[],
  actualScore: number,
  kFactor: number = 32
) => {
  // Calculate team strength as average, but apply a team size penalty/bonus
  const teamSize = opponentTeamRatings.length;
  const avgOpponentRating = opponentTeamRatings.reduce((sum, rating) => sum + rating, 0) / teamSize;
  
  // Apply team size modifier - larger teams get a slight advantage
  const teamSizeModifier = Math.log(teamSize) * 50; // Logarithmic scaling
  const adjustedOpponentRating = avgOpponentRating + teamSizeModifier;
  
  const expectedScore = 1 / (1 + Math.pow(10, (adjustedOpponentRating - playerRating) / 400));
  return Math.round(playerRating + kFactor * (actualScore - expectedScore));
};

// Calculate team average ELO
export const calculateTeamELO = (players: Player[]) => {
  if (players.length === 0) return 1200;
  return players.reduce((sum, player) => sum + player.elo, 0) / players.length;
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