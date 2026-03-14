import { Player } from '../types/championship';

const DEFAULT_ELO = 1200;
const DEFAULT_K_FACTOR = 32;
const ELO_SCALE = 400;
const SIZE_ELO_PER_DOUBLING = 50;

const normalizeName = (name: string) => name.trim().toLowerCase();
const hasDuplicates = (values: string[]) => new Set(values).size !== values.length;
const expectedScore = (rating: number, opponentRating: number) => (
  1 / (1 + Math.pow(10, (opponentRating - rating) / ELO_SCALE))
);
const averageElo = (team: Player[]) => (
  team.length === 0 ? 0 : team.reduce((sum, player) => sum + player.elo, 0) / team.length
);

// Find or create player
export const findOrCreatePlayer = (
  name: string,
  players: Player[],
  setPlayers: React.Dispatch<React.SetStateAction<Player[]>>,
  organizationId: number,
  seasonId: number
): Player => {
  const normalized = normalizeName(name);
  const existingPlayer = players.find(player => (
    normalizeName(player.name) === normalized && player.season_id === seasonId
  ));
  
  if (existingPlayer) {
    return existingPlayer;
  }
  
  const newPlayer: Player = {
    id: Date.now() + Math.floor(Math.random() * 1000),
    name: name.trim(),
    elo: DEFAULT_ELO,
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
  const winners = scores
    .map((score, index) => ({ score, index }))
    .filter(item => item.score === maxScore)
    .map(item => item.index);
  return winners.length === 1 ? winners[0] : null;
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

  const normalizedAll = allPlayers.map(normalizeName);
  if (hasDuplicates(normalizedAll)) return false;

  for (const team of teams) {
    if (team.length === 0) return false;
    const normalizedTeam = team.map(normalizeName);
    if (hasDuplicates(normalizedTeam)) return false;
  }

  return true;
}; 

export const calculateMultiTeamEloChanges = (
  teams: Player[][],
  scores: number[],
  kFactor = DEFAULT_K_FACTOR
) => {
  const winnerIndex = getWinnerIndex(scores);
  const teamCount = teams.length;
  const teamDivisor = Math.max(1, teamCount - 1);
  const eloChanges: { [playerName: string]: number } = {};

  const teamStats = teams.map(team => {
    const baseElo = averageElo(team);
    const size = Math.max(1, team.length);
    const sizeElo = SIZE_ELO_PER_DOUBLING * Math.log2(size);
    return {
      team,
      baseElo,
      effectiveElo: baseElo + sizeElo
    };
  });

  const distributeTeamDelta = (team: Player[], teamElo: number, teamDelta: number) => {
    if (team.length === 0 || teamDelta === 0) return;
    const weights = team.map(player => expectedScore(teamElo, player.elo));
    const totalWeight = weights.reduce((sum, w) => sum + w, 0) || 1;
    const rawDeltas = weights.map(w => (teamDelta * w) / totalWeight);
    const rounded = rawDeltas.map(value => (value >= 0 ? Math.floor(value) : Math.ceil(value)));
    let remainder = teamDelta - rounded.reduce((sum, value) => sum + value, 0);

    if (remainder !== 0) {
      const order = team.map((player, index) => ({ index, elo: player.elo }))
        .sort((a, b) => (remainder > 0 ? a.elo - b.elo : b.elo - a.elo));
      const step = remainder > 0 ? 1 : -1;
      for (let i = 0; i < Math.abs(remainder); i += 1) {
        const target = order[i % order.length];
        rounded[target.index] += step;
      }
    }

    team.forEach((player, index) => {
      eloChanges[player.name] = (eloChanges[player.name] ?? 0) + rounded[index];
    });
  };

  for (let i = 0; i < teams.length; i += 1) {
    for (let j = i + 1; j < teams.length; j += 1) {
      const teamA = teamStats[i];
      const teamB = teamStats[j];
      const scoreA = scores[i] ?? 0;
      const scoreB = scores[j] ?? 0;
      const totalPairPoints = scoreA + scoreB || 1;
      const actualScoreA = scoreA / totalPairPoints;
      const expectedScoreA = expectedScore(teamA.effectiveElo, teamB.effectiveElo);
      const teamDeltaA = Math.round((kFactor * (actualScoreA - expectedScoreA)) / teamDivisor);
      const teamDeltaB = -teamDeltaA;

      distributeTeamDelta(teamA.team, teamA.baseElo, teamDeltaA);
      distributeTeamDelta(teamB.team, teamB.baseElo, teamDeltaB);
    }
  }

  return { winnerIndex, eloChanges };
};
