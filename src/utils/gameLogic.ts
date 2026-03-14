import { Player } from '../types/championship';

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

const getWinnerIndex = (scores: number[]): number | null => {
  if (!Array.isArray(scores) || scores.length === 0) return null;
  const maxScore = Math.max(...scores);
  const maxIndexes = scores
    .map((score, index) => ({ score, index }))
    .filter(item => item.score === maxScore)
    .map(item => item.index);
  if (maxIndexes.length !== 1) return null;
  return maxIndexes[0];
};

// Validate match data
export const validateMatch = (
  teams: string[][],
  scores: number[]
): boolean => {
  if (!Array.isArray(teams) || teams.length < 2) return false;
  if (!Array.isArray(scores) || scores.length !== teams.length) return false;
  if (!scores.every(score => Number.isFinite(score) && score >= 0)) return false;

  const allPlayers = teams.flat();
  if (allPlayers.length === 0) return false;
  if (!allPlayers.every(name => name.trim())) return false;

  const normalizedAll = allPlayers.map(name => name.trim().toLowerCase());
  const uniqueAll = new Set(normalizedAll);
  if (uniqueAll.size !== normalizedAll.length) return false;

  for (const team of teams) {
    if (team.length === 0) return false;
    const normalizedTeam = team.map(name => name.trim().toLowerCase());
    if (new Set(normalizedTeam).size !== normalizedTeam.length) return false;
  }

  return true;
}; 

export const calculateMultiTeamEloChanges = (
  teams: Player[][],
  scores: number[]
) => {
  const winnerIndex = getWinnerIndex(scores);
  const teamCount = teams.length;
  const teamDivisor = Math.max(1, teamCount - 1);
  const eloChanges: { [playerName: string]: number } = {};

  for (let i = 0; i < teams.length; i += 1) {
    for (let j = i + 1; j < teams.length; j += 1) {
      const teamA = teams[i];
      const teamB = teams[j];
      const scoreA = scores[i] ?? 0;
      const scoreB = scores[j] ?? 0;
      const totalPairPoints = scoreA + scoreB || 1;
      const actualScoreA = scoreA / totalPairPoints;
      const winTeamSize = Math.max(1, scoreA > scoreB ? teamA.length : teamB.length)
      const divisor = winTeamSize * teamDivisor;

      teamA.forEach(player => {
        if (!eloChanges[player.name]) eloChanges[player.name] = 0;
        teamB.forEach(opponent => {
          if (!eloChanges[opponent.name]) eloChanges[opponent.name] = 0;
          const diff = calculateELODifference(player.elo, opponent.elo, actualScoreA);
          const adjusted = Math.round(diff / divisor);
          eloChanges[player.name] += adjusted;
          eloChanges[opponent.name] -= adjusted;
        });
      });
    }
  }

  return { winnerIndex, eloChanges };
};
