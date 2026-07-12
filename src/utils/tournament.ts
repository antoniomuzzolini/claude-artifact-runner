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
// Sides: one competitor in a tournament — a single player (individual
// tournaments) or a tournament-scoped team. Slots and standings work on side
// ids; matches always store the real players (so individual ELO keeps working).
// ---------------------------------------------------------------------------

export type SideKind = 'player' | 'team';

export const getSideMemberIds = (tournament: Tournament, sideId: number): number[] => {
  const team = tournament.teams?.find(item => Number(item.id) === Number(sideId));
  return team ? team.playerIds.map(Number) : [Number(sideId)];
};

export const getSideName = (
  tournament: Tournament,
  sideId: number,
  playerName: (playerId: number) => string
): string => {
  const team = tournament.teams?.find(item => Number(item.id) === Number(sideId));
  return team ? team.name : playerName(sideId);
};

const sideSource = (id: number, sideKind: SideKind): SlotSource => (
  sideKind === 'team' ? { kind: 'team', teamId: id } : { kind: 'player', playerId: id }
);

// ---------------------------------------------------------------------------
// Team formation (wizard): floor(N/S) teams of minimum size S; leftover
// players join the weakest team one by one (recomputing averages), so no team
// ends up with more than one extra member unless it stays the weakest.
// ---------------------------------------------------------------------------

const distributeReserves = (
  teams: number[][],
  leftovers: number[],
  eloOf: (playerId: number) => number
) => {
  for (const playerId of leftovers) {
    let weakestIndex = 0;
    let weakestAvg = Infinity;
    teams.forEach((team, index) => {
      const avg = team.reduce((sum, id) => sum + eloOf(id), 0) / Math.max(1, team.length);
      if (avg < weakestAvg) {
        weakestAvg = avg;
        weakestIndex = index;
      }
    });
    teams[weakestIndex].push(playerId);
  }
};

export const buildRandomTeamGroups = (
  playerIds: number[],
  teamSize: number,
  eloOf: (playerId: number) => number
): number[][] => {
  const shuffled = [...playerIds];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const teamCount = Math.floor(playerIds.length / teamSize);
  if (teamCount < 2) return [];
  const teams = Array.from({ length: teamCount }, (_, index) =>
    shuffled.slice(index * teamSize, (index + 1) * teamSize)
  );
  distributeReserves(teams, shuffled.slice(teamCount * teamSize), eloOf);
  return teams;
};

// Snake draft over ELO: round 1 deals best players left-to-right, round 2
// right-to-left, and so on — the classic balanced draft
export const buildBalancedTeamGroups = (
  playerIds: number[],
  teamSize: number,
  eloOf: (playerId: number) => number
): number[][] => {
  const sorted = [...playerIds].sort((a, b) => eloOf(b) - eloOf(a));
  const teamCount = Math.floor(playerIds.length / teamSize);
  if (teamCount < 2) return [];
  const teams = Array.from({ length: teamCount }, () => [] as number[]);
  for (let round = 0; round < teamSize; round += 1) {
    for (let position = 0; position < teamCount; position += 1) {
      const teamIndex = round % 2 === 0 ? position : teamCount - 1 - position;
      teams[teamIndex].push(sorted[round * teamCount + position]);
    }
  }
  distributeReserves(teams, sorted.slice(teamCount * teamSize), eloOf);
  return teams;
};

// Default "players per team" for the wizard: the average team size seen in
// the organization's matches so far
export const suggestedTeamSize = (matches: Match[]): number => {
  const sizes = matches.flatMap(match =>
    Array.isArray(match.teams) ? match.teams.map(team => team.length) : []
  );
  if (sizes.length === 0) return 1;
  return Math.max(1, Math.round(sizes.reduce((sum, size) => sum + size, 0) / sizes.length));
};

// ---------------------------------------------------------------------------
// Structure builders (all slots are static; results flow in via matchId links)
// ---------------------------------------------------------------------------

const buildKnockoutSlots = (
  sources: SlotSource[],
  idPrefix: string,
  phase: 'knockout' | 'consolation' = 'knockout'
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
      phase,
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
        phase,
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

// Optional 3rd/4th place final: semifinal losers meet, same round as the final
// (position 1, so the final keeps position 0 for champion detection)
const appendThirdPlaceSlot = (
  knockoutSlots: TournamentSlot[],
  idPrefix: string
): TournamentSlot[] => {
  const totalRounds = knockoutSlots.reduce((max, slot) => Math.max(max, slot.round), 0);
  if (totalRounds < 2) return knockoutSlots; // no semifinals -> nothing to play
  return [
    ...knockoutSlots,
    {
      id: `${idPrefix}-3rd`,
      phase: 'knockout',
      round: totalRounds,
      position: 1,
      home: { kind: 'loser', slotId: `${idPrefix}-r${totalRounds - 1}-0` },
      away: { kind: 'loser', slotId: `${idPrefix}-r${totalRounds - 1}-1` },
      matchId: null
    }
  ];
};

// Consolation bracket: knockout among the non-qualifiers, seeded by group rank
// (all third-ranked first, then fourth-ranked, ...). Groups can be uneven, so
// only ranks that actually exist in a group are included.
const buildConsolationSlots = (
  groups: number[][],
  qualifiersPerGroup: number
): TournamentSlot[] => {
  const maxGroupSize = groups.reduce((max, groupIds) => Math.max(max, groupIds.length), 0);
  const sources: SlotSource[] = [];
  for (let rank = qualifiersPerGroup; rank < maxGroupSize; rank += 1) {
    for (let group = 0; group < groups.length; group += 1) {
      if (rank < groups[group].length) {
        sources.push({ kind: 'qualifier', group, rank });
      }
    }
  }
  return buildKnockoutSlots(sources, 'co', 'consolation');
};

// Add a 3rd place match to an existing tournament (forgotten at creation).
// Returns the new slots array, or null when not applicable / already present.
export const addThirdPlaceMatch = (tournament: Tournament): TournamentSlot[] | null => {
  if (tournament.format !== 'single_elimination' && tournament.format !== 'groups_knockout') return null;
  const knockoutSlots = tournament.slots.filter(slot => slot.phase === 'knockout');
  if (knockoutSlots.some(slot => slot.home.kind === 'loser')) return null; // already there
  const withThirdPlace = appendThirdPlaceSlot(knockoutSlots, 'ko');
  if (withThirdPlace === knockoutSlots) return null; // no semifinals
  return [...tournament.slots, withThirdPlace[withThirdPlace.length - 1]];
};

// Add a consolation bracket to an existing groups+knockout tournament.
// Returns the new slots array, or null when not applicable / already present.
export const addConsolationBracket = (tournament: Tournament): TournamentSlot[] | null => {
  if (tournament.format !== 'groups_knockout') return null;
  if (tournament.slots.some(slot => slot.phase === 'consolation')) return null;
  const groupCount = tournament.config.groupCount ?? 0;
  const qualifiersPerGroup = tournament.config.qualifiersPerGroup ?? 2;
  if (groupCount < 1) return null;
  // Sides are stored in seed order (teams or participantIds): this rebuilds
  // the exact same group distribution used at creation time
  const sideIds = (tournament.teams?.length ?? 0) > 0
    ? tournament.teams!.map(team => Number(team.id))
    : tournament.participantIds;
  const groups = distributeIntoGroups(sideIds, groupCount);
  const consolationSlots = buildConsolationSlots(groups, qualifiersPerGroup);
  if (consolationSlots.length === 0) return null;
  return [...tournament.slots, ...consolationSlots];
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
  group?: number,
  sideKind: SideKind = 'player'
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
        home: sideSource(home, sideKind),
        away: sideSource(away, sideKind),
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
  byeSideId: number | null,
  round: number,
  sideKind: SideKind = 'player'
): TournamentSlot[] => {
  const slots: TournamentSlot[] = pairs.map(([home, away], position) => ({
    id: `sw-r${round}-${position}`,
    phase: 'swiss',
    round,
    position,
    home: sideSource(home, sideKind),
    away: sideSource(away, sideKind),
    matchId: null
  }));

  if (byeSideId !== null) {
    slots.push({
      id: `sw-r${round}-bye`,
      phase: 'swiss',
      round,
      position: slots.length,
      home: sideSource(byeSideId, sideKind),
      away: { kind: 'bye' },
      matchId: null
    });
  }

  return slots;
};

export const createTournamentSlots = (
  format: TournamentFormat,
  seededIds: number[],
  config: TournamentConfig,
  sideKind: SideKind = 'player'
): TournamentSlot[] => {
  switch (format) {
    case 'single_elimination': {
      const knockoutSlots = buildKnockoutSlots(
        seededIds.map(id => sideSource(id, sideKind)),
        'ko'
      );
      return config.thirdPlaceMatch ? appendThirdPlaceSlot(knockoutSlots, 'ko') : knockoutSlots;
    }
    case 'round_robin':
      return buildRoundRobinSlots(seededIds, 'round_robin', 'rr', undefined, sideKind);
    case 'groups_knockout': {
      const groupCount = config.groupCount ?? defaultGroupCount(seededIds.length);
      const qualifiersPerGroup = config.qualifiersPerGroup ?? 2;
      const groups = distributeIntoGroups(seededIds, groupCount);
      const groupSlots = groups.flatMap((groupIds, groupIndex) =>
        buildRoundRobinSlots(groupIds, 'group', `g${groupIndex + 1}`, groupIndex, sideKind)
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

      let knockoutSlots = buildKnockoutSlots(qualifierSources, 'ko');
      if (config.thirdPlaceMatch) {
        knockoutSlots = appendThirdPlaceSlot(knockoutSlots, 'ko');
      }

      const consolationSlots = config.consolationBracket
        ? buildConsolationSlots(groups, qualifiersPerGroup)
        : [];

      return [...groupSlots, ...knockoutSlots, ...consolationSlots];
    }
    case 'swiss': {
      // Round 1: top half vs bottom half by seed; odd side count -> last seed rests
      const half = Math.floor(seededIds.length / 2);
      const hasBye = seededIds.length % 2 === 1;
      const pairs: [number, number][] = [];
      for (let i = 0; i < half; i += 1) {
        pairs.push([seededIds[i], seededIds[i + half]]);
      }
      return buildSwissRoundSlots(pairs, hasBye ? seededIds[seededIds.length - 1] : null, 1, sideKind);
    }
    default:
      return [];
  }
};

// ---------------------------------------------------------------------------
// Derived state (structure + recorded matches -> resolved bracket/standings)
// ---------------------------------------------------------------------------

// NOTE: the *PlayerId fields hold SIDE ids — player ids in individual
// tournaments, team ids in team tournaments. Names kept for compatibility.
export interface ResolvedSlot extends TournamentSlot {
  homePlayerId: number | null;
  awayPlayerId: number | null;
  homeIsBye: boolean;
  awayIsBye: boolean;
  homePlaceholder: string | null; // e.g. "Winner of SF1", "1st Group A" (when unresolved)
  awayPlaceholder: string | null;
  match: Match | null;
  homeScore: number | null; // side-aware scores, resolved from the match
  awayScore: number | null;
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

// Outcome of a match for one side, located by membership: a side's team in the
// match is the one containing any of its member players (for individual sides
// the member list is just [sideId])
const matchScoreFor = (match: Match, memberIds: number[]): MatchOutcome | null => {
  const teamIndex = match.teams.findIndex(team =>
    team.some(member => memberIds.includes(Number(member.id)))
  );
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
  sideIds: number[],
  config: TournamentConfig,
  seedIndexById: Map<number, number>,
  memberIdsOf: (sideId: number) => number[] = (sideId) => [sideId]
): StandingsRow[] => {
  const rows = new Map<number, StandingsRow>();
  sideIds.forEach(playerId => {
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
      const outcome = matchScoreFor(slot.match, memberIdsOf(playerId));
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
      const outcome = matchScoreFor(slot.match, memberIdsOf(playerId));
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
  // Sides: teams when present, individual players otherwise (in seed order)
  const isTeamTournament = (tournament.teams?.length ?? 0) > 0;
  const sideIds = isTeamTournament
    ? tournament.teams!.map(team => Number(team.id))
    : tournament.participantIds;
  const memberIdsOf = (sideId: number) => getSideMemberIds(tournament, sideId);
  const seedIndexById = new Map(sideIds.map((id, index) => [id, index]));
  const resolvedById = new Map<string, ResolvedSlot>();
  const slotById = new Map(tournament.slots.map(slot => [slot.id, slot]));
  const totalKnockoutRounds = tournament.slots
    .filter(slot => slot.phase === 'knockout')
    .reduce((max, slot) => Math.max(max, slot.round), 0);

  const placeholderFor = (source: SlotSource): string | null => {
    if (source.kind === 'winner' || source.kind === 'loser') {
      const feeder = slotById.get(source.slotId);
      if (!feeder) return null;
      const label = feeder.phase === 'consolation'
        ? `R${feeder.round} M${feeder.position + 1}`
        : knockoutSlotShortLabel(feeder.round, totalKnockoutRounds, feeder.position);
      return `${source.kind === 'winner' ? 'Winner' : 'Loser'} of ${label}`;
    }
    if (source.kind === 'qualifier') {
      return `${ordinal(source.rank + 1)} Group ${groupLetter(source.group)}`;
    }
    return null;
  };

  const isBracketPhase = (slot: TournamentSlot) =>
    slot.phase === 'knockout' || slot.phase === 'consolation';

  const orderedSlots = [...tournament.slots].sort((a, b) => {
    const phaseRank = (slot: TournamentSlot) => (isBracketPhase(slot) ? 1 : 0);
    return phaseRank(a) - phaseRank(b) || a.round - b.round || a.position - b.position;
  });

  const groupCount = tournament.config.groupCount ?? 0;
  let groupStandings: StandingsRow[][] = [];
  let isGroupPhaseComplete = false;

  const resolveSource = (source: SlotSource): { playerId: number | null; isBye: boolean } => {
    switch (source.kind) {
      case 'player':
        return { playerId: source.playerId, isBye: false };
      case 'team':
        return { playerId: source.teamId, isBye: false };
      case 'bye':
        return { playerId: null, isBye: true };
      case 'winner': {
        const feeder = resolvedById.get(source.slotId);
        return { playerId: feeder?.winnerPlayerId ?? null, isBye: false };
      }
      case 'loser': {
        const feeder = resolvedById.get(source.slotId);
        if (!feeder) return { playerId: null, isBye: false };
        // A bye feeder has no loser: this side of the 3rd place match is a bye
        if (feeder.status === 'bye') return { playerId: null, isBye: true };
        if (feeder.winnerPlayerId === null) return { playerId: null, isBye: false };
        const loserId = feeder.winnerPlayerId === feeder.homePlayerId
          ? feeder.awayPlayerId
          : feeder.homePlayerId;
        return { playerId: loserId, isBye: false };
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
    let homeScore: number | null = null;
    let awayScore: number | null = null;

    if (home.isBye && away.isBye) {
      status = 'bye';
    } else if (home.isBye || away.isBye) {
      winnerPlayerId = home.isBye ? away.playerId : home.playerId;
      status = 'bye';
    } else if (match && home.playerId !== null && away.playerId !== null) {
      isDraw = match.winnerIndex === null;
      const homeOutcome = matchScoreFor(match, memberIdsOf(home.playerId));
      const awayOutcome = matchScoreFor(match, memberIdsOf(away.playerId));
      homeScore = homeOutcome?.scored ?? null;
      awayScore = awayOutcome?.scored ?? null;
      if (!isDraw) {
        // The winning side is the one whose members appear in the winning team
        if (homeOutcome?.won) {
          winnerPlayerId = home.playerId;
        } else if (awayOutcome?.won) {
          winnerPlayerId = away.playerId;
        }
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
      homeScore,
      awayScore,
      winnerPlayerId,
      isDraw,
      status
    };
  };

  // First pass: non-bracket phases (their sources are always direct players)
  for (const slot of orderedSlots) {
    if (isBracketPhase(slot)) continue;
    resolvedById.set(slot.id, resolveSlot(slot));
  }

  const nonKnockoutResolved = orderedSlots
    .filter(slot => !isBracketPhase(slot))
    .map(slot => resolvedById.get(slot.id)!);

  if (tournament.format === 'groups_knockout' && groupCount > 0) {
    const groups = distributeIntoGroups(sideIds, groupCount);
    groupStandings = groups.map((groupIds, groupIndex) => buildStandings(
      nonKnockoutResolved.filter(slot => slot.group === groupIndex),
      groupIds,
      tournament.config,
      seedIndexById,
      memberIdsOf
    ));
    isGroupPhaseComplete = nonKnockoutResolved
      .filter(slot => slot.phase === 'group')
      .every(slot => slot.status === 'done');
  }

  // Second pass: bracket slots (knockout + consolation) in round order
  // (winner/loser/qualifier sources; feeders always sit in earlier rounds)
  for (const slot of orderedSlots) {
    if (!isBracketPhase(slot)) continue;
    resolvedById.set(slot.id, resolveSlot(slot));
  }

  const slots = orderedSlots.map(slot => resolvedById.get(slot.id)!);

  let standings: StandingsRow[] | null = null;
  if (tournament.format === 'round_robin' || tournament.format === 'swiss') {
    standings = buildStandings(slots, sideIds, tournament.config, seedIndexById, memberIdsOf);
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
    // Optional extras (3rd place match, consolation bracket) must also finish
    isComplete = championId !== null && pendingMatches === 0;
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

  const sideKind: SideKind = (tournament.teams?.length ?? 0) > 0 ? 'team' : 'player';
  return buildSwissRoundSlots(pairs, byePlayerId, nextRound, sideKind);
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

// Short label for a single knockout slot: "Final", "SF1", "QF2", "R1 M3".
// In the final round only position 0 is the final; position 1 is the
// optional 3rd place match.
export const knockoutSlotShortLabel = (round: number, totalRounds: number, position: number): string => {
  const fromEnd = totalRounds - round;
  if (fromEnd === 0) return position === 0 ? 'Final' : '3rd Place';
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
  if (slot.phase === 'consolation') {
    return `Consolation · Round ${slot.round}`;
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
