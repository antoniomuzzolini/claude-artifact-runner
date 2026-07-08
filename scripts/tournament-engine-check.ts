/* Standalone sanity check for the tournament engine.
   Run with: npx tsx scripts/tournament-engine-check.ts */
import { Match, Tournament, TournamentConfig, TournamentFormat } from '../src/types/championship';
import {
  computeTournamentState,
  createTournamentSlots,
  generateNextSwissRound,
  suggestFormats,
  DEFAULT_POINTS_DRAW,
  DEFAULT_POINTS_WIN
} from '../src/utils/tournament';

let failures = 0;
const check = (label: string, condition: boolean) => {
  if (condition) {
    console.log(`  ok: ${label}`);
  } else {
    failures += 1;
    console.error(`  FAIL: ${label}`);
  }
};

let matchIdCounter = 1;
const makeMatch = (home: number, away: number, scoreHome: number, scoreAway: number): Match => ({
  id: matchIdCounter++,
  date: '1/1/2026',
  time: '10:00',
  teams: [[{ id: home, name: `P${home}` }], [{ id: away, name: `P${away}` }]],
  scores: [scoreHome, scoreAway],
  winnerIndex: scoreHome === scoreAway ? null : (scoreHome > scoreAway ? 0 : 1),
  eloChanges: {},
  organization_id: 1,
  season_id: 1
});

const makeTournament = (
  format: TournamentFormat,
  participantIds: number[],
  config: Partial<TournamentConfig> = {}
): Tournament => {
  const fullConfig: TournamentConfig = {
    pointsWin: DEFAULT_POINTS_WIN,
    pointsDraw: DEFAULT_POINTS_DRAW,
    ...config
  };
  return {
    id: 1,
    name: 'Test',
    format,
    seeding: 'manual',
    participantIds,
    config: fullConfig,
    slots: createTournamentSlots(format, participantIds, fullConfig),
    organization_id: 1,
    season_id: 1,
    createdAt: '2026-01-01'
  };
};

// Plays every 'ready' slot until nothing is playable; lower player id always wins
const playOut = (tournament: Tournament, matches: Match[]) => {
  for (let guard = 0; guard < 200; guard += 1) {
    const state = computeTournamentState(tournament, matches);
    const ready = state.slots.filter(slot => slot.status === 'ready');
    if (ready.length === 0) return state;
    for (const slot of ready) {
      const home = slot.homePlayerId!;
      const away = slot.awayPlayerId!;
      const homeWins = home < away;
      const match = makeMatch(home, away, homeWins ? 10 : 5, homeWins ? 5 : 10);
      matches.push(match);
      const stored = tournament.slots.find(s => s.id === slot.id)!;
      stored.matchId = match.id;
    }
  }
  throw new Error('playOut did not converge');
};

// --- suggestFormats -------------------------------------------------------
console.log('suggestFormats');
{
  const s8 = suggestFormats(8);
  const se8 = s8.find(s => s.format === 'single_elimination')!;
  const rr8 = s8.find(s => s.format === 'round_robin')!;
  check('8 players: single elim has 7 matches', se8.totalMatches === 7);
  check('8 players: single elim recommended', se8.recommended);
  check('8 players: round robin has 28 matches', rr8.totalMatches === 28);
  const s5 = suggestFormats(5);
  check('5 players: groups unavailable', !s5.find(s => s.format === 'groups_knockout')!.available);
  check('5 players: round robin recommended', s5.find(s => s.format === 'round_robin')!.recommended);
  const s12 = suggestFormats(12);
  check('12 players: groups+KO recommended', s12.find(s => s.format === 'groups_knockout')!.recommended);
  const s20 = suggestFormats(20);
  check('20 players: swiss recommended', s20.find(s => s.format === 'swiss')!.recommended);
}

// --- single elimination ----------------------------------------------------
console.log('single elimination (6 players, bracket of 8 with 2 byes)');
{
  const tournament = makeTournament('single_elimination', [1, 2, 3, 4, 5, 6]);
  const matches: Match[] = [];
  const initial = computeTournamentState(tournament, matches);
  const byes = initial.slots.filter(slot => slot.status === 'bye');
  check('has 7 slots', tournament.slots.length === 7);
  check('2 byes in round 1', byes.length === 2 && byes.every(slot => slot.round === 1));
  check('seeds 1 and 2 get the byes', byes.every(slot => [1, 2].includes(slot.winnerPlayerId!)));
  const final = playOut(tournament, matches);
  check('tournament completes', final.isComplete);
  check('champion is player 1 (always wins)', final.championId === 1);
  check('5 matches played (7 slots - 2 byes)', final.playedMatches === 5);
}

// --- round robin ------------------------------------------------------------
console.log('round robin (5 players)');
{
  const tournament = makeTournament('round_robin', [1, 2, 3, 4, 5]);
  const matches: Match[] = [];
  check('10 slots', tournament.slots.length === 10);
  const perPlayer = new Map<number, number>();
  tournament.slots.forEach(slot => {
    for (const source of [slot.home, slot.away]) {
      if (source.kind === 'player') perPlayer.set(source.playerId, (perPlayer.get(source.playerId) ?? 0) + 1);
    }
  });
  check('everyone plays 4 matches', [...perPlayer.values()].every(count => count === 4));
  const final = playOut(tournament, matches);
  check('completes', final.isComplete);
  check('champion is player 1', final.championId === 1);
  check('player 1 has 12 points (4 wins)', final.standings![0].points === 12);
  check('last is player 5 with 0 points', final.standings![4].playerId === 5 && final.standings![4].points === 0);
}

// --- round robin with draw and head-to-head --------------------------------
console.log('round robin tie-break (3 players, head-to-head)');
{
  const tournament = makeTournament('round_robin', [1, 2, 3]);
  const matches: Match[] = [];
  // 2 beats 1; 1 beats 3; 3 beats 2 with huge score -> all 3 points, circular.
  // Then diff decides.
  const results: Array<[number, number, number, number]> = [
    [1, 2, 3, 10], // 2 beats 1 (diff: 1:-7, 2:+7)
    [1, 3, 10, 3], // 1 beats 3
    [2, 3, 0, 10]  // 3 beats 2
  ];
  for (const [home, away, sh, sa] of results) {
    const slot = tournament.slots.find(s => {
      const ids = [s.home, s.away].map(src => (src.kind === 'player' ? src.playerId : -1));
      return ids.includes(home) && ids.includes(away);
    })!;
    const storedHome = (slot.home as { playerId: number }).playerId;
    const match = storedHome === home ? makeMatch(home, away, sh, sa) : makeMatch(away, home, sa, sh);
    matches.push(match);
    slot.matchId = match.id;
  }
  const state = computeTournamentState(tournament, matches);
  check('all tied at 3 points', state.standings!.every(row => row.points === 3));
  // diffs: P1 = -7 + 7 = 0; P2 = +7 - 10 = -3; P3 = -7 + 10 = +3
  check('score diff breaks circular tie (3,1,2)', state.standings!.map(r => r.playerId).join(',') === '3,1,2');
}

// --- groups + knockout ------------------------------------------------------
console.log('groups + knockout (9 players, 2 groups, top 2)');
{
  const tournament = makeTournament('groups_knockout', [1, 2, 3, 4, 5, 6, 7, 8, 9], {
    groupCount: 2,
    qualifiersPerGroup: 2
  });
  const matches: Match[] = [];
  const groupSlots = tournament.slots.filter(slot => slot.phase === 'group');
  const koSlots = tournament.slots.filter(slot => slot.phase === 'knockout');
  // groups of 5 and 4 -> 10 + 6 group matches; 4 qualifiers -> 3 KO matches
  check('16 group slots', groupSlots.length === 16);
  check('3 knockout slots', koSlots.length === 3);
  const beforeGroups = computeTournamentState(tournament, matches);
  check('KO pending before groups complete', beforeGroups.slots.filter(s => s.phase === 'knockout').every(s => s.status === 'pending'));
  const final = playOut(tournament, matches);
  check('group phase complete', final.isGroupPhaseComplete);
  check('completes', final.isComplete);
  check('champion is player 1', final.championId === 1);
  // Semifinal must not repeat a group pairing: 1st of G0 plays 2nd of G1
  const semis = final.slots.filter(s => s.phase === 'knockout' && s.round === 1);
  const groupOf = (playerId: number) => final.groupStandings.findIndex(rows => rows.some(r => r.playerId === playerId));
  check('semifinals are cross-group', semis.every(s => groupOf(s.homePlayerId!) !== groupOf(s.awayPlayerId!)));
}

// --- swiss ------------------------------------------------------------------
console.log('swiss (7 players, 3 rounds)');
{
  const tournament = makeTournament('swiss', [1, 2, 3, 4, 5, 6, 7], { swissRounds: 3 });
  const matches: Match[] = [];
  check('round 1 has 3 matches + 1 bye', tournament.slots.length === 4);

  const byeRecipients = new Set<number>();
  for (let round = 1; round <= 3; round += 1) {
    const state = playOut(tournament, matches);
    state.slots
      .filter(slot => slot.phase === 'swiss' && slot.status === 'bye' && slot.winnerPlayerId !== null)
      .forEach(slot => byeRecipients.add(slot.winnerPlayerId!));
    if (round < 3) {
      const nextSlots = generateNextSwissRound(tournament, matches);
      check(`round ${round + 1} generated`, nextSlots !== null && nextSlots.length === 4);
      tournament.slots.push(...nextSlots!);
    }
  }

  const final = computeTournamentState(tournament, matches);
  check('completes after 3 rounds', final.isComplete);
  check('no further round can be generated', !final.canGenerateNextSwissRound);
  check('3 different players got the bye', byeRecipients.size === 3);

  // no rematches
  const seenPairs = new Set<string>();
  let rematch = false;
  for (const slot of final.slots) {
    if (slot.homePlayerId === null || slot.awayPlayerId === null) continue;
    const key = [slot.homePlayerId, slot.awayPlayerId].sort((a, b) => a - b).join('-');
    if (seenPairs.has(key)) rematch = true;
    seenPairs.add(key);
  }
  check('no rematches across rounds', !rematch);
  check('champion is player 1', final.championId === 1);
}

// --- placeholders -------------------------------------------------------------
console.log('placeholder labels');
{
  const ko = makeTournament('single_elimination', [1, 2, 3, 4]);
  const koState = computeTournamentState(ko, []);
  const final = koState.slots.find(slot => slot.round === 2)!;
  check('final shows "Winner of SF1/SF2"',
    final.homePlaceholder === 'Winner of SF1' && final.awayPlaceholder === 'Winner of SF2');

  const groups = makeTournament('groups_knockout', [1, 2, 3, 4, 5, 6, 7, 8], {
    groupCount: 2,
    qualifiersPerGroup: 2
  });
  const groupsState = computeTournamentState(groups, []);
  const koPlaceholders = groupsState.slots
    .filter(slot => slot.phase === 'knockout' && slot.round === 1)
    .flatMap(slot => [slot.homePlaceholder, slot.awayPlaceholder]);
  check('KO round 1 shows group qualifiers', (
    koPlaceholders.includes('1st Group A')
    && koPlaceholders.includes('2nd Group B')
    && koPlaceholders.every(label => label !== null)
  ));
}

// --- string ids from Postgres BIGINT ------------------------------------------
console.log('string match ids (as returned by the DB) still resolve');
{
  const tournament = makeTournament('round_robin', [1, 2, 3]);
  const matches: Match[] = [];
  playOut(tournament, matches);
  const withStringIds = matches.map(match => ({ ...match, id: String(match.id) as unknown as number }));
  const state = computeTournamentState(tournament, withStringIds);
  check('all slots resolve with string match ids', state.slots.every(slot => slot.status === 'done'));
  check('champion still resolved', state.championId === 1);
}

// --- match deletion resilience ----------------------------------------------
console.log('deleted match resets a slot to ready');
{
  const tournament = makeTournament('single_elimination', [1, 2, 3, 4]);
  const matches: Match[] = [];
  playOut(tournament, matches);
  // delete the final's match
  const finalSlot = tournament.slots.find(slot => slot.round === 2)!;
  const remaining = matches.filter(match => match.id !== finalSlot.matchId);
  const state = computeTournamentState(tournament, remaining);
  const resolvedFinal = state.slots.find(slot => slot.id === finalSlot.id)!;
  check('final back to ready', resolvedFinal.status === 'ready');
  check('no champion anymore', state.championId === null);
}

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
