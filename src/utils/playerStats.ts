import { Match, Player } from '../types/championship';

const normalizeName = (name: string) => name.trim().toLowerCase();
const normalizePlayerId = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export const buildPlayerStats = (
  players: Player[],
  matches: Match[],
  seasonId: number | null
) => {
  const statsById = new Map<number, Player>();
  const playerIdByName = new Map<string, number>();

  players.forEach(player => {
    const parsedId = normalizePlayerId(player.id);
    if (parsedId === null) return;
    statsById.set(parsedId, {
      ...player,
      id: parsedId,
      elo: 1200,
      matches: 0,
      wins: 0,
      losses: 0,
      pointsScored: 0,
      pointsConceded: 0
    });
    const nameKey = normalizeName(player.name);
    if (nameKey) {
      playerIdByName.set(nameKey, parsedId);
    }
  });

  const relevantMatches = seasonId === null
    ? matches
    : matches.filter(match => match.season_id === seasonId);

  for (const match of relevantMatches) {
    match.teams.forEach((team, teamIndex) => {
      const didWin = match.winnerIndex !== null && match.winnerIndex === teamIndex;
      const isTie = match.winnerIndex === null;
      const teamScore = match.scores[teamIndex] ?? 0;
      const opponentScore = match.scores
        .filter((_, index) => index !== teamIndex)
        .reduce((sum, score) => sum + (score ?? 0), 0);

      team.forEach(playerRef => {
        const resolvedId = normalizePlayerId(playerRef.id)
          ?? playerIdByName.get(normalizeName(playerRef.name));
        if (resolvedId === undefined) return;

        const existing = statsById.get(resolvedId);
        const stats: Player = existing ?? {
          id: resolvedId,
          name: playerRef.name,
          elo: 1200,
          matches: 0,
          wins: 0,
          losses: 0,
          pointsScored: 0,
          pointsConceded: 0,
          organization_id: match.organization_id
        };

        const eloDelta = match.eloChanges[String(resolvedId)] ?? 0;
        const updated: Player = {
          ...stats,
          elo: stats.elo + eloDelta,
          matches: stats.matches + 1,
          wins: stats.wins + (!isTie && didWin ? 1 : 0),
          losses: stats.losses + (!isTie && !didWin ? 1 : 0),
          pointsScored: (stats.pointsScored ?? 0) + teamScore,
          pointsConceded: (stats.pointsConceded ?? 0) + opponentScore
        };

        statsById.set(playerRef.id, updated);
      });
    });
  }

  return Array.from(statsById.values());
};
