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

// Find or create player in the players array
export const findOrCreatePlayer = (
  name: string,
  players: Player[],
  setPlayers: React.Dispatch<React.SetStateAction<Player[]>>
): Player | null => {
  if (!name.trim()) return null;
  
  const existingPlayer = players.find((p: Player) => 
    p.name.toLowerCase() === name.trim().toLowerCase()
  );
  
  if (existingPlayer) {
    return existingPlayer;
  }
  
  const newPlayer: Player = {
    id: Date.now() + Math.random(),
    name: name.trim(),
    elo: 1200,
    matches: 0,
    wins: 0,
    losses: 0
  };
  
  setPlayers(prev => [...prev, newPlayer]);
  return newPlayer;
};

// Validate match data
export const validateMatch = (
  team1Player1: string,
  team1Player2: string,
  team2Player1: string,
  team2Player2: string,
  team1Score: number,
  team2Score: number
): boolean => {
  return !!(
    team1Player1 && 
    team1Player2 && 
    team2Player1 && 
    team2Player2 && 
    team1Score !== team2Score
  );
}; 