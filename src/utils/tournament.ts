import {
  Match,
  SlotSource,
  Tournament,
  TournamentConfig,
  TournamentFormat,
  TournamentSlot
} from '../types/championship';

export const DEFAULT_POINTS_WIN = 3;
export const DEFAULT_POINTS_DRAW = 1;

// ---------------------------------------------------------------------------
// Format suggestions
// ---------------------------------------------------------------------------

export interface FormatSuggestion {
  format: TournamentFormat;
  available: boolean;
  recommended: boolean;
  totalMatches: number;
  minMatchesPerPlayer: number;
  maxMatchesPerPlayer: number;
  rounds: number;
  defaultConfig: TournamentConfig;
}

const roundRobinMatchCount = (n: number) => (n * (n - 1)) / 2;

export const defaultGroupCount = (n: number) => {
  // aim for groups of ~4 players, never fewer than 3 per group
  const count = Math.max(2, Math.round(n / 4));
  return Math.min(count, Math.floor(n / 3));
};

export const splitGroupSizes = (n: number, groupCount: number): number[] => {
  const base = Math.floor(n / groupCount);
  const extra = n % groupCount;
  return Array.from({ length: groupCount }, (_, i) => base + (i < extra ? 1 : 0));
};

export const suggestFormats = (n: number): FormatSuggestion[] => {
  const koRounds = n > 1 ? Math.ceil(Math.log2(n)) : 0;
  const basePoints = { pointsWin: DEFAULT_POINTS_WIN, pointsDraw: DEFAULT_POINTS_DRAW };

  const singleElimination: FormatSuggestion = {
    format: 'single_elimination',
    available: n >= 2,
    recommended: false,
    totalMatches: Math.max(0, n - 1),
    minMatchesPerPlayer: 1,
    maxMatchesPerPlayer: koRounds,
    rounds: koRounds,
    defaultConfig: { ...basePoints }
  };

  const roundRobin: FormatSuggestion = {
    format: 'round_robin',
    available: n >= 2,
    recommended: false,
    totalMatches: roundRobinMatchCount(n),
    minMatchesPerPlayer: Math.max(0, n - 1),
    maxMatchesPerPlayer: Math.max(0, n - 1),
    rounds: n <= 1 ? 0 : (n % 2 === 0 ? n - 1 : n),
    defaultConfig: { ...basePoints }
  };

  const groupCount = defaultGroupCount(n);
  const groupSizes = n >= 6 ? splitGroupSizes(n, groupCount) : [];
  const qualifiersPerGroup = 2;
  const qualifierCount = groupCount * qualifiersPerGroup;
  const groupMatches = groupSizes.reduce((sum, size) => sum + roundRobinMatchCount(size), 0);
  const maxGroupSize = groupSizes.length > 0 ? Math.max(...groupSizes) : 0;
  const minGroupSize = groupSizes.length > 0 ? Math.min(...groupSizes) : 0;
  const koPhaseRounds = qualifierCount > 1 ? Math.ceil(Math.log2(qualifierCount)) : 0;

  const groupsKnockout: FormatSuggestion = {
    format: 'groups_knockout',
    available: n >= 6,
    recommended: false,
    totalMatches: groupMatches + Math.max(0, qualifierCount - 1),
    minMatchesPerPlayer: Math.max(0, minGroupSize - 1),
    maxMatchesPerPlayer: Math.max(0, maxGroupSize - 1) + koPhaseRounds,
    rounds: (maxGroupSize > 0 ? maxGroupSize - (maxGroupSize % 2 === 0 ? 1 : 0) : 0) + koPhaseRounds,
    defaultConfig: { ...basePoints, groupCount, qualifiersPerGroup }
  };

  const swissRounds = Math.max(3, Math.ceil(Math.log2(Math.max(2, n))));
  const swiss: FormatSuggestion = {
    format: 'swiss',
    available: n >= 5,
    recommended: false,
    totalMatches: swissRounds * Math.floor(n / 2),
    minMatchesPerPlayer: swissRounds - (n % 2 === 1 ? 1 : 0),
    maxMatchesPerPlayer: swissRounds,
    rounds: swissRounds,
    defaultConfig: { ...basePoints, swissRounds }
  };

  const suggestions = [singleElimination, roundRobin, groupsKnockout, swiss];

  const recommendedFormat: TournamentFormat = n <= 6
    ? 'round_robin'
    : n <= 8
      ? 'single_elimination'
      : n <= 15
        ? 'groups_knockout'
        : 'swiss';

  return suggestions.map(suggestion => ({
    ...suggestion,
    recommended: suggestion.available && suggestion.format === recommendedFormat
  }));
};

// ---------------------------------------------------------------------------
// Seeding
// ---------------------------------------------------------------------------

export const orderParticipants = (
  participantIds: number[],
  mode: Tournament['seeding'],
  eloById: Map<number, number>,
  rng: () => number = Math.random
): number[] => {
  if (mode === 'manual') return [...participantIds];
  if (mode === 'elo') {
    return [...participantIds].sort((a, b) => (eloById.get(b) ?? 1200) - (eloById.get(a) ?? 1200));
  }
  const shuffled = [...participantIds];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

// Standard bracket seed order (1-based): size 8 -> [1,8,4,5,2,7,3,6]
const bracketSeedOrder = (size: number): number[] => {
  let order = [1, 2];
  while (order.length < size) {
    const doubled = order.length * 2;
    const next: number[] = [];
    for (const seed of order) {
      next.push(seed, doubled + 1 - seed);
    }
    order = next;
  }
  return order;
};

// ---------------------------------------------------------------------------
// Structure builders (all slots are static; results flow in via matchId links)
// ---------------------------------------------------------------------------

const buildKnockoutSlots = (
  sources: SlotSource[],
  idPrefix: string
): TournamentSlot[] => {
  const entrants = sources.length;
  if (entrants < 2) return [];
  const size = Math.pow(2, Math.ceil(Math.log2(entrants)));
  const seedOrder = bracketSeedOrder(size);
  const slots: TournamentSlot[] = [];
  const totalRounds = Math.log2(size);

  for (let position = 0; position < size / 2; position += 1) {
    const homeSeed = seedOrder[position * 2];
    const awaySeed = seedOrder[position * 2 + 1];
    slots.push({
      id: `${idPrefix}-r1-${position}`,
      phase: 'knockout',
      round: 1,
      position,
      home: homeSeed <= entrants ? sources[homeSeed - 1] : { kind: 'bye' },
      away: awaySeed <= entrants ? sources[awaySeed - 1] : { kind: 'bye' },
      matchId: null
    });
  }

  for (let round = 2; round <= totalRounds; round += 1) {
    const matchesInRound = size / Math.pow(2, round);
    for (let position = 0; position < matchesInRound; position += 1) {
      slots.push({
        id: `${idPrefix}-r${round}-${position}`,
        phase: 'knockout',
        round,
        position,
        home: { kind: 'winner', slotId: `${idPrefix}-r${round - 1}-${position * 2}` },
        away: { kind: 'winner', slotId: `${idPrefix}-r${round - 1}-${position * 2 + 1}` },
        matchId: null
      });
    }
  }

  return slots;
};

// Circle method pairings; a null entry marks the resting player on odd counts
const roundRobinPairings = (ids: number[]): [number | null, number | null][][] => {
  const arr: (number | null)[] = [...ids];
  if (arr.length % 2 === 1) arr.push(null);
  const size = arr.length;
  if (size < 2) return [];
  const rotating = arr.slice(1);
  const rounds: [number | null, number | null][][] = [];

  for (let round = 0; round < size - 1; round += 1) {
    const current = [arr[0], ...rotating];
    const pairs: [number | null, number | null][] = [];
    for (let i = 0; i < size / 2; i += 1) {
      pairs.push([current[i], current[size - 1 - i]]);
    }
    rounds.push(pairs);
    rotating.unshift(rotating.pop()!);
  }

  return rounds;
};

const buildRoundRobinSlots = (
  ids: number[],
  phase: 'round_robin' | 'group',
  idPrefix: string,
  group?: number
): TournamentSlot[] => {
  const slots: TournamentSlot[] = [];
  roundRobinPairings(ids).forEach((pairs, roundIndex) => {
    let position = 0;
    for (const [home, away] of pairs) {
      if (home === null || away === null) continue;
      slots.push({
        id: `${idPrefix}-r${roundIndex + 1}-${position}`,
        phase,
        round: roundIndex + 1,
        position,
        ...(group !== undefined ? { group } : {}),
        home: { kind: 'player', playerId: home },
        away: { kind: 'player', playerId: away },
        matchId: null
      });
      position += 1;
    }
  });
  return slots;
};

// Snake distribution of seeded players into groups
export const distributeIntoGroups = (seededIds: number[], groupCount: number): number[][] => {
  const groups: number[][] = Array.from({ length: groupCount }, () => []);
  seededIds.forEach((id, index) => {
    const cycle = Math.floor(index / groupCount);
    const offset = index % groupCount;
    const groupIndex = cycle % 2 === 0 ? offset : groupCount - 1 - offset;
    groups[groupIndex].push(id);
  });
  return groups;
};

const buildSwissRoundSlots = (
  pairs: [number, number][],
  byePlayerId: number | null,
  round: number
): TournamentSlot[] => {
  const slots: TournamentSlot[] = pairs.map(([home, away], position) => ({
    id: `sw-r${round}-${position}`,
    phase: 'swiss',
    round,
    position,
    home: { kind: 'player', playerId: home },
    away: { kind: 'player', playerId: away },
    matchId: null
  }));

  if (byePlayerId !== null) {
    slots.push({
      id: `sw-r${round}-bye`,
      phase: 'swiss',
      round,
      position: slots.length,
      home: { kind: 'player', playerId: byePlayerId },
      away: { kind: 'bye' },
      matchId: null
    });
  }

  return slots;
};

export const createTournamentSlots = (
  format: TournamentFormat,
  seededIds: number[],
  config: TournamentConfig
): TournamentSlot[] => {
  switch (format) {
    case 'single_elimination':
      return buildKnockoutSlots(
        seededIds.map(playerId => ({ kind: 'player', playerId } as SlotSource)),
        'ko'
      );
    case 'round_robin':
      return buildRoundRobinSlots(seededIds, 'round_robin', 'rr');
    case 'groups_knockout': {
      const groupCount = config.groupCount ?? defaultGroupCount(seededIds.length);
      const qualifiersPerGroup = config.qualifiersPerGroup ?? 2;
      const groups = distributeIntoGroups(seededIds, groupCount);
      const groupSlots = groups.flatMap((groupIds, groupIndex) =>
        buildRoundRobinSlots(groupIds, 'group', `g${groupIndex + 1}`, groupIndex)
      );

      // Qualifier seeding: all first-ranked (group order), then all second-ranked,
      // and so on. Combined with the bracket seed order this pairs group winners
      // against runners-up of other groups in the first knockout round.
      const qualifierSources: SlotSource[] = [];
      for (let rank = 0; rank < qualifiersPerGroup; rank += 1) {
        for (let group = 0; group < groupCount; group += 1) {
          qualifierSources.push({ kind: 'qualifier', group, rank });
        }
      }

      return [...groupSlots, ...buildKnockoutSlots(qualifierSources, 'ko')];
    }
    case 'swiss': {
      // Round 1: top half vs bottom half by seed; odd player count -> last seed rests
      const half = Math.floor(seededIds.length / 2);
      const hasBye = seededIds.length % 2 === 1;
      const pairs: [number, number][] = [];
      for (let i = 0; i < half; i += 1) {
        pairs.push([seededIds[i], seededIds[i + half]]);
      }
      return buildSwissRoundSlots(pairs, hasBye ? seededIds[seededIds.length - 1] : null, 1);
    }
    default:
      return [];
  }
};

// ---------------------------------------------------------------------------
// Derived state (structure + recorded matches -> resolved bracket/standings)
// ---------------------------------------------------------------------------

export interface ResolvedSlot extends TournamentSlot {
  homePlayerId: number | null;
  awayPlayerId: number | null;
  homeIsBye: boolean;
  awayIsBye: boolean;
  homePlaceholder: string | null; // e.g. "Winner of SF1", "1st Group A" (when unresolved)
  awayPlaceholder: string | null;
  match: Match | null;
  winnerPlayerId: number | null;
  isDraw: boolean;
  status: 'pending' | 'ready' | 'done' | 'bye';
}

export interface StandingsRow {
  playerId: number;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  points: number;
  scoreFor: number;
  scoreAgainst: number;
}

export interface TournamentState {
  slots: ResolvedSlot[];
  groupStandings: StandingsRow[][];
  standings: StandingsRow[] | null;
  isGroupPhaseComplete: boolean;
  swissRoundsGenerated: number;
  canGenerateNextSwissRound: boolean;
  championId: number | null;
  playedMatches: number;
  pendingMatches: number;
  isComplete: boolean;
}

interface MatchOutcome {
  scored: number;
  conceded: number;
  won: boolean;
  draw: boolean;
}

const matchScoreFor = (match: Match, playerId: number): MatchOutcome | null => {
  const teamIndex = match.teams.findIndex(team => team.some(member => member.id === playerId));
  if (teamIndex === -1) return null;
  const scored = match.scores[teamIndex] ?? 0;
  const conceded = match.scores
    .filter((_, index) => index !== teamIndex)
    .reduce((sum, score) => sum + (score ?? 0), 0);
  const draw = match.winnerIndex === null;
  const won = !draw && match.winnerIndex === teamIndex;
  return { scored, conceded, won, draw };
};

// Standings points for one match outcome. 'set_based' treats scores as sets
// won (volleyball): margin >= 2 -> 3/0, deciding set (margin 1) -> 2/1.
export const pointsForOutcome = (outcome: MatchOutcome, config: TournamentConfig): number => {
  if (outcome.draw) return config.pointsDraw;
  if ((config.pointsScheme ?? 'flat') === 'set_based') {
    const margin = Math.abs(outcome.scored - outcome.conceded);
    if (outcome.won) return margin === 1 ? 2 : 3;
    return margin === 1 ? 1 : 0;
  }
  return outcome.won ? config.pointsWin : 0;
};

// A bye counts as a full win
const pointsForBye = (config: TournamentConfig): number => (
  (config.pointsScheme ?? 'flat') === 'set_based' ? 3 : config.pointsWin
);

const buildStandings = (
  slots: ResolvedSlot[],
  participantIds: number[],
  config: TournamentConfig,
  seedIndexById: Map<number, number>
): StandingsRow[] => {
  const rows = new Map<number, StandingsRow>();
  participantIds.forEach(playerId => {
    rows.set(playerId, {
      playerId,
      played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      points: 0,
      scoreFor: 0,
      scoreAgainst: 0
    });
  });

  for (const slot of slots) {
    if (slot.status === 'bye' && slot.winnerPlayerId !== null) {
      // Swiss bye counts as a free win
      const row = rows.get(slot.winnerPlayerId);
      if (row && slot.phase === 'swiss') {
        row.played += 1;
        row.wins += 1;
        row.points += pointsForBye(config);
      }
      continue;
    }
    if (slot.status !== 'done' || !slot.match) continue;

    for (const playerId of [slot.homePlayerId, slot.awayPlayerId]) {
      if (playerId === null) continue;
      const row = rows.get(playerId);
      const outcome = matchScoreFor(slot.match, playerId);
      if (!row || !outcome) continue;
      row.played += 1;
      row.scoreFor += outcome.scored;
      row.scoreAgainst += outcome.conceded;
      row.points += pointsForOutcome(outcome, config);
      if (outcome.draw) {
        row.draws += 1;
      } else if (outcome.won) {
        row.wins += 1;
      } else {
        row.losses += 1;
      }
    }
  }

  const allRows = Array.from(rows.values());

  // Head-to-head points among tied players (used as first tie-breaker)
  const headToHeadPoints = (playerId: number, tiedIds: Set<number>): number => {
    let points = 0;
    for (const slot of slots) {
      if (slot.status !== 'done' || !slot.match) continue;
      if (slot.homePlayerId === null || slot.awayPlayerId === null) continue;
      const opponent = slot.homePlayerId === playerId
        ? slot.awayPlayerId
        : (slot.awayPlayerId === playerId ? slot.homePlayerId : null);
      if (opponent === null || !tiedIds.has(opponent)) continue;
      const outcome = matchScoreFor(slot.match, playerId);
      if (!outcome) continue;
      points += pointsForOutcome(outcome, config);
    }
    return points;
  };

  const byPoints = new Map<number, StandingsRow[]>();
  allRows.forEach(row => {
    const bucket = byPoints.get(row.points) ?? [];
    bucket.push(row);
    byPoints.set(row.points, bucket);
  });

  const h2hByPlayer = new Map<number, number>();
  byPoints.forEach(bucket => {
    if (bucket.length < 2) {
      bucket.forEach(row => h2hByPlayer.set(row.playerId, 0));
      return;
    }
    const tiedIds = new Set(bucket.map(row => row.playerId));
    bucket.forEach(row => h2hByPlayer.set(row.playerId, headToHeadPoints(row.playerId, tiedIds)));
  });

  return allRows.sort((a, b) => (
    b.points - a.points
    || (h2hByPlayer.get(b.playerId) ?? 0) - (h2hByPlayer.get(a.playerId) ?? 0)
    || (b.scoreFor - b.scoreAgainst) - (a.scoreFor - a.scoreAgainst)
    || b.scoreFor - a.scoreFor
    || (seedIndexById.get(a.playerId) ?? 0) - (seedIndexById.get(b.playerId) ?? 0)
  ));
};

export const computeTournamentState = (
  tournament: Tournament,
  matches: Match[]
): TournamentState => {
  // ids may arrive as strings (Postgres BIGINT) — compare numerically
  const matchById = new Map(matches.map(match => [Number(match.id), match]));
  const seedIndexById = new Map(tournament.participantIds.map((id, index) => [id, index]));
  const resolvedById = new Map<string, ResolvedSlot>();
  const slotById = new Map(tournament.slots.map(slot => [slot.id, slot]));
  const totalKnockoutRounds = tournament.slots
    .filter(slot => slot.phase === 'knockout')
    .reduce((max, slot) => Math.max(max, slot.round), 0);

  const placeholderFor = (source: SlotSource): string | null => {
    if (source.kind === 'winner') {
      const feeder = slotById.get(source.slotId);
      if (!feeder) return null;
      return `Winner of ${knockoutSlotShortLabel(feeder.round, totalKnockoutRounds, feeder.position)}`;
    }
    if (source.kind === 'qualifier') {
      return `${ordinal(source.rank + 1)} Group ${groupLetter(source.group)}`;
    }
    return null;
  };

  const orderedSlots = [...tournament.slots].sort((a, b) => {
    const phaseRank = (slot: TournamentSlot) => (slot.phase === 'knockout' ? 1 : 0);
    return phaseRank(a) - phaseRank(b) || a.round - b.round || a.position - b.position;
  });

  const groupCount = tournament.config.groupCount ?? 0;
  let groupStandings: StandingsRow[][] = [];
  let isGroupPhaseComplete = false;

  const resolveSource = (source: SlotSource): { playerId: number | null; isBye: boolean } => {
    switch (source.kind) {
      case 'player':
        return { playerId: source.playerId, isBye: false };
      case 'bye':
        return { playerId: null, isBye: true };
      case 'winner': {
        const feeder = resolvedById.get(source.slotId);
        return { playerId: feeder?.winnerPlayerId ?? null, isBye: false };
      }
      case 'qualifier': {
        if (!isGroupPhaseComplete) return { playerId: null, isBye: false };
        const row = groupStandings[source.group]?.[source.rank];
        return { playerId: row?.playerId ?? null, isBye: false };
      }
      default:
        return { playerId: null, isBye: false };
    }
  };

  const resolveSlot = (slot: TournamentSlot): ResolvedSlot => {
    const home = resolveSource(slot.home);
    const away = resolveSource(slot.away);
    const match = slot.matchId !== null ? matchById.get(Number(slot.matchId)) ?? null : null;

    let winnerPlayerId: number | null = null;
    let isDraw = false;
    let status: ResolvedSlot['status'] = 'pending';

    if (home.isBye && away.isBye) {
      status = 'bye';
    } else if (home.isBye || away.isBye) {
      winnerPlayerId = home.isBye ? away.playerId : home.playerId;
      status = 'bye';
    } else if (match && home.playerId !== null && away.playerId !== null) {
      isDraw = match.winnerIndex === null;
      if (!isDraw) {
        const winningTeam = match.teams[match.winnerIndex!] ?? [];
        const winnerId = winningTeam[0]?.id ?? null;
        winnerPlayerId = winnerId === home.playerId || winnerId === away.playerId ? winnerId : null;
      }
      status = 'done';
    } else if (home.playerId !== null && away.playerId !== null) {
      status = 'ready';
    }

    return {
      ...slot,
      homePlayerId: home.playerId,
      awayPlayerId: away.playerId,
      homeIsBye: home.isBye,
      awayIsBye: away.isBye,
      homePlaceholder: home.playerId === null && !home.isBye ? placeholderFor(slot.home) : null,
      awayPlaceholder: away.playerId === null && !away.isBye ? placeholderFor(slot.away) : null,
      match,
      winnerPlayerId,
      isDraw,
      status
    };
  };

  // First pass: non-knockout phases (their sources are always direct players)
  for (const slot of orderedSlots) {
    if (slot.phase === 'knockout') continue;
    resolvedById.set(slot.id, resolveSlot(slot));
  }

  const nonKnockoutResolved = orderedSlots
    .filter(slot => slot.phase !== 'knockout')
    .map(slot => resolvedById.get(slot.id)!);

  if (tournament.format === 'groups_knockout' && groupCount > 0) {
    const groups = distributeIntoGroups(tournament.participantIds, groupCount);
    groupStandings = groups.map((groupIds, groupIndex) => buildStandings(
      nonKnockoutResolved.filter(slot => slot.group === groupIndex),
      groupIds,
      tournament.config,
      seedIndexById
    ));
    isGroupPhaseComplete = nonKnockoutResolved
      .filter(slot => slot.phase === 'group')
      .every(slot => slot.status === 'done');
  }

  // Second pass: knockout slots in round order (winner/qualifier sources)
  for (const slot of orderedSlots) {
    if (slot.phase !== 'knockout') continue;
    resolvedById.set(slot.id, resolveSlot(slot));
  }

  const slots = orderedSlots.map(slot => resolvedById.get(slot.id)!);

  let standings: StandingsRow[] | null = null;
  if (tournament.format === 'round_robin' || tournament.format === 'swiss') {
    standings = buildStandings(slots, tournament.participantIds, tournament.config, seedIndexById);
  }

  const swissSlots = slots.filter(slot => slot.phase === 'swiss');
  const swissRoundsGenerated = swissSlots.reduce((max, slot) => Math.max(max, slot.round), 0);
  const swissAllPlayed = swissSlots.every(slot => slot.status === 'done' || slot.status === 'bye');
  const targetSwissRounds = tournament.config.swissRounds ?? 0;
  const canGenerateNextSwissRound = tournament.format === 'swiss'
    && swissAllPlayed
    && swissRoundsGenerated < targetSwissRounds;

  const playableSlots = slots.filter(slot => slot.status !== 'bye');
  const playedMatches = playableSlots.filter(slot => slot.status === 'done').length;
  const pendingMatches = playableSlots.length - playedMatches;

  let championId: number | null = null;
  let isComplete = false;

  if (tournament.format === 'single_elimination' || tournament.format === 'groups_knockout') {
    const knockoutSlots = slots.filter(slot => slot.phase === 'knockout');
    const finalRound = knockoutSlots.reduce((max, slot) => Math.max(max, slot.round), 0);
    const finalSlot = knockoutSlots.find(slot => slot.round === finalRound && slot.position === 0);
    championId = finalSlot?.winnerPlayerId ?? null;
    isComplete = championId !== null;
  } else if (tournament.format === 'round_robin') {
    isComplete = slots.every(slot => slot.status === 'done' || slot.status === 'bye');
    championId = isComplete && standings && standings.length > 0 ? standings[0].playerId : null;
  } else if (tournament.format === 'swiss') {
    isComplete = swissAllPlayed && swissRoundsGenerated >= targetSwissRounds;
    championId = isComplete && standings && standings.length > 0 ? standings[0].playerId : null;
  }

  return {
    slots,
    groupStandings,
    standings,
    isGroupPhaseComplete,
    swissRoundsGenerated,
    canGenerateNextSwissRound,
    championId,
    playedMatches,
    pendingMatches,
    isComplete
  };
};

// ---------------------------------------------------------------------------
// Swiss round generation
// ---------------------------------------------------------------------------

const pairKey = (a: number, b: number) => (a < b ? `${a}-${b}` : `${b}-${a}`);

// Backtracking pairing that avoids rematches; falls back to sequential pairing
const pairAvoidingRematches = (
  ordered: number[],
  playedPairs: Set<string>
): [number, number][] | null => {
  if (ordered.length === 0) return [];
  const [first, ...rest] = ordered;
  for (let i = 0; i < rest.length; i += 1) {
    if (playedPairs.has(pairKey(first, rest[i]))) continue;
    const remaining = rest.filter((_, index) => index !== i);
    const sub = pairAvoidingRematches(remaining, playedPairs);
    if (sub) return [[first, rest[i]], ...sub];
  }
  return null;
};

export const generateNextSwissRound = (
  tournament: Tournament,
  matches: Match[]
): TournamentSlot[] | null => {
  if (tournament.format !== 'swiss') return null;
  const state = computeTournamentState(tournament, matches);
  if (!state.canGenerateNextSwissRound || !state.standings) return null;

  const nextRound = state.swissRoundsGenerated + 1;
  const playedPairs = new Set<string>();
  const byesTaken = new Set<number>();

  for (const slot of state.slots) {
    if (slot.phase !== 'swiss') continue;
    if (slot.homePlayerId !== null && slot.awayPlayerId !== null) {
      playedPairs.add(pairKey(slot.homePlayerId, slot.awayPlayerId));
    }
    if (slot.status === 'bye' && slot.winnerPlayerId !== null) {
      byesTaken.add(slot.winnerPlayerId);
    }
  }

  let ordered = state.standings.map(row => row.playerId);
  let byePlayerId: number | null = null;

  if (ordered.length % 2 === 1) {
    // lowest-ranked player without a previous bye rests
    for (let i = ordered.length - 1; i >= 0; i -= 1) {
      if (!byesTaken.has(ordered[i])) {
        byePlayerId = ordered[i];
        break;
      }
    }
    if (byePlayerId === null) byePlayerId = ordered[ordered.length - 1];
    ordered = ordered.filter(id => id !== byePlayerId);
  }

  let pairs = pairAvoidingRematches(ordered, playedPairs);
  if (!pairs) {
    pairs = [];
    for (let i = 0; i < ordered.length; i += 2) {
      pairs.push([ordered[i], ordered[i + 1]]);
    }
  }

  return buildSwissRoundSlots(pairs, byePlayerId, nextRound);
};

// ---------------------------------------------------------------------------
// Result recovery
// ---------------------------------------------------------------------------

// Rebuild lost slot→match links (e.g. after a stale client overwrote the
// tournament's slots) by pairing unlinked slots with existing season matches
// between the same two players, in chronological order. Knockout slots only
// resolve once their feeders are linked, so passes repeat until stable.
// Returns the repaired slots, or null if nothing could be relinked.
export const relinkTournamentMatches = (
  tournament: Tournament,
  matches: Match[],
  excludeMatchIds: Set<number> = new Set()
): TournamentSlot[] | null => {
  const matchTime = (match: Match) => {
    const parsed = new Date(`${match.date} ${match.time}`).getTime();
    return Number.isFinite(parsed) ? parsed : 0;
  };
  const candidates = matches
    .filter(match => (
      Number(match.season_id) === Number(tournament.season_id)
      && Array.isArray(match.teams)
      && match.teams.length === 2
      && match.teams[0]?.length === 1
      && match.teams[1]?.length === 1
    ))
    // ids are Date.now()-based, a reliable tiebreaker for same-minute matches
    .sort((a, b) => matchTime(a) - matchTime(b) || Number(a.id) - Number(b.id));

  const usedMatchIds = new Set<number>(excludeMatchIds);
  tournament.slots.forEach(slot => {
    if (slot.matchId !== null) usedMatchIds.add(Number(slot.matchId));
  });

  let slots = tournament.slots;
  let changed = false;

  for (;;) {
    const state = computeTournamentState({ ...tournament, slots }, matches);
    let linkedThisPass = false;

    for (const resolved of state.slots) {
      if (resolved.matchId !== null || resolved.status !== 'ready') continue;
      const home = resolved.homePlayerId;
      const away = resolved.awayPlayerId;
      if (home === null || away === null) continue;

      const requiresWinner = resolved.phase === 'knockout'
        || (tournament.config.pointsScheme ?? 'flat') === 'set_based';
      const candidate = candidates.find(match => {
        if (usedMatchIds.has(Number(match.id))) return false;
        if (requiresWinner && match.winnerIndex === null) return false;
        const first = match.teams[0][0]?.id;
        const second = match.teams[1][0]?.id;
        return (first === home && second === away) || (first === away && second === home);
      });
      if (!candidate) continue;

      const matchId = Number(candidate.id);
      slots = slots.map(slot => (slot.id === resolved.id ? { ...slot, matchId } : slot));
      usedMatchIds.add(matchId);
      changed = true;
      linkedThisPass = true;
    }

    if (!linkedThisPass) break;
  }

  return changed ? slots : null;
};

// ---------------------------------------------------------------------------
// Labels
// ---------------------------------------------------------------------------

export const knockoutRoundLabel = (round: number, totalRounds: number): string => {
  const fromEnd = totalRounds - round;
  if (fromEnd === 0) return 'Final';
  if (fromEnd === 1) return 'Semifinals';
  if (fromEnd === 2) return 'Quarterfinals';
  return `Round ${round}`;
};

export const ordinal = (n: number): string => {
  if (n === 1) return '1st';
  if (n === 2) return '2nd';
  if (n === 3) return '3rd';
  return `${n}th`;
};

export const groupLetter = (groupIndex: number): string => String.fromCharCode(65 + groupIndex);

// Short label for a single knockout slot: "Final", "SF1", "QF2", "R1 M3"
export const knockoutSlotShortLabel = (round: number, totalRounds: number, position: number): string => {
  const fromEnd = totalRounds - round;
  if (fromEnd === 0) return 'Final';
  if (fromEnd === 1) return `SF${position + 1}`;
  if (fromEnd === 2) return `QF${position + 1}`;
  return `R${round} M${position + 1}`;
};

// Human context for a slot, e.g. "Semifinals", "Group A · Round 2", "Round 3"
export const slotContextLabel = (slot: TournamentSlot, totalKnockoutRounds: number): string => {
  if (slot.phase === 'knockout') {
    const fromEnd = totalKnockoutRounds - slot.round;
    if (fromEnd <= 2) return knockoutSlotShortLabel(slot.round, totalKnockoutRounds, slot.position);
    return `Round ${slot.round} · Match ${slot.position + 1}`;
  }
  if (slot.phase === 'group' && slot.group !== undefined) {
    return `Group ${groupLetter(slot.group)} · Round ${slot.round}`;
  }
  return `Round ${slot.round}`;
};

export const formatLabel = (format: TournamentFormat): string => {
  switch (format) {
    case 'single_elimination': return 'Single Elimination';
    case 'round_robin': return 'Round Robin';
    case 'groups_knockout': return 'Groups + Knockout';
    case 'swiss': return 'Swiss System';
    default: return format;
  }
};
