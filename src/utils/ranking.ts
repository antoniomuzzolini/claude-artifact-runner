import { Player } from '../types/championship';

export type RankingMode = 'elo' | 'wins' | 'win_rate' | 'points_scored';

export const DEFAULT_RANKING_MODE: RankingMode = 'elo';

export const RANKING_MODE_OPTIONS: { value: RankingMode; label: string }[] = [
  { value: 'elo', label: 'ELO' },
  { value: 'wins', label: 'Wins' },
  { value: 'win_rate', label: 'Win Rate' },
  { value: 'points_scored', label: 'Points Scored' }
];

export const isRankingMode = (value: unknown): value is RankingMode => (
  typeof value === 'string'
  && (['elo', 'wins', 'win_rate', 'points_scored'] as RankingMode[]).includes(value as RankingMode)
);

export const getRankingLabel = (mode: RankingMode) => {
  switch (mode) {
    case 'elo':
      return 'ELO Rating';
    case 'wins':
      return 'Wins';
    case 'win_rate':
      return 'Win Rate';
    case 'points_scored':
      return 'Points Scored';
    default:
      return 'ELO Rating';
  }
};

export const getRankingValue = (player: Player, mode: RankingMode) => {
  switch (mode) {
    case 'elo':
      return player.elo ?? 0;
    case 'wins':
      return player.wins ?? 0;
    case 'win_rate':
      return player.matches > 0 ? (player.wins / player.matches) * 100 : 0;
    case 'points_scored':
      return player.pointsScored ?? 0;
    default:
      return player.elo ?? 0;
  }
};

export const formatRankingValue = (value: number, mode: RankingMode) => {
  if (mode === 'win_rate') {
    return `${value.toFixed(1)}%`;
  }
  return Math.round(value).toString();
};

export const comparePlayersByRanking = (a: Player, b: Player, mode: RankingMode) => {
  const valueDelta = getRankingValue(b, mode) - getRankingValue(a, mode);
  if (valueDelta !== 0) return valueDelta;

  const matchesDelta = b.matches - a.matches;
  if (matchesDelta !== 0) return matchesDelta;

  const winsDelta = b.wins - a.wins;
  if (winsDelta !== 0) return winsDelta;

  const eloDelta = b.elo - a.elo;
  if (eloDelta !== 0) return eloDelta;

  return a.name.localeCompare(b.name);
};
