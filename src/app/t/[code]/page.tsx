import { neon } from '@neondatabase/serverless';
import { notFound } from 'next/navigation';
import type { Match, Tournament } from '../../../types/championship';
import {
  ResolvedSlot,
  StandingsRow,
  computeTournamentState,
  formatLabel,
  getSideName,
  groupLetter,
  knockoutRoundLabel
} from '../../../utils/tournament';

// Public, read-only tournament board for shared screens (TVs, projectors,
// phones of spectators). Deliberately kept as plain server-rendered HTML with
// inline CSS and a meta-refresh: it must work on old smart-TV browsers where
// the main React app does not load. No authentication: access is granted by
// knowing the unguessable share code.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const sql = neon(process.env.DATABASE_URL!);

const REFRESH_SECONDS = 20;

const resolveWinnerIndex = (scores: number[], winnerIndex: unknown): number | null => {
  const parsed = Number(winnerIndex);
  if (Number.isFinite(parsed)) return parsed;
  if (!scores.length) return null;
  const maxScore = Math.max(...scores);
  const maxIndexes = scores
    .map((score, index) => ({ score, index }))
    .filter(item => item.score === maxScore)
    .map(item => item.index);
  return maxIndexes.length === 1 ? maxIndexes[0] : null;
};

async function loadTournament(code: string) {
  let rows: Record<string, any>[];
  try {
    rows = await sql`SELECT * FROM tournaments WHERE share_code = ${code} LIMIT 1`;
  } catch {
    // share_code column not created yet -> no shared tournaments exist
    return null;
  }
  if (rows.length === 0) return null;
  const row = rows[0];

  const tournament: Tournament = {
    id: Number(row.id),
    name: row.name,
    format: row.format,
    seeding: row.seeding,
    participantIds: Array.isArray(row.participant_ids) ? row.participant_ids.map(Number) : [],
    config: row.config ?? { pointsWin: 3, pointsDraw: 1 },
    ...(Array.isArray(row.teams) && row.teams.length > 0
      ? {
          teams: row.teams.map((team: any) => ({
            id: Number(team.id),
            name: String(team.name ?? ''),
            playerIds: Array.isArray(team.playerIds) ? team.playerIds.map(Number) : []
          }))
        }
      : {}),
    slots: Array.isArray(row.slots)
      ? row.slots.map((slot: any) => ({
          ...slot,
          matchId: slot.matchId === null || slot.matchId === undefined ? null : Number(slot.matchId)
        }))
      : [],
    organization_id: Number(row.organization_id),
    season_id: Number(row.season_id),
    createdAt: String(row.created_at ?? '')
  };

  const [playerRows, matchRows] = await Promise.all([
    sql`SELECT id, name FROM players WHERE organization_id = ${row.organization_id}`,
    sql`
      SELECT id, teams, scores, winner_index FROM matches
      WHERE organization_id = ${row.organization_id} AND season_id = ${row.season_id}
    `
  ]);

  const playerNameById = new Map<number, string>(
    playerRows.map(player => [Number(player.id), String(player.name)])
  );

  const matches: Match[] = matchRows.map(match => {
    const scores = Array.isArray(match.scores) ? match.scores.map(Number) : [];
    return {
      id: Number(match.id),
      date: '',
      time: '',
      teams: Array.isArray(match.teams) ? match.teams : [],
      scores,
      winnerIndex: resolveWinnerIndex(scores, match.winner_index),
      eloChanges: {},
      organization_id: Number(row.organization_id),
      season_id: Number(row.season_id)
    };
  });

  return { tournament, matches, playerNameById };
}

const sideLabel = (
  tournament: Tournament,
  playerNameById: Map<number, string>,
  slot: ResolvedSlot,
  side: 'home' | 'away'
): { text: string; resolved: boolean } => {
  const sideId = side === 'home' ? slot.homePlayerId : slot.awayPlayerId;
  const isBye = side === 'home' ? slot.homeIsBye : slot.awayIsBye;
  const placeholder = side === 'home' ? slot.homePlaceholder : slot.awayPlaceholder;
  if (isBye) return { text: 'Bye', resolved: false };
  if (sideId === null) return { text: placeholder ?? 'TBD', resolved: false };
  return {
    text: getSideName(tournament, sideId, id => playerNameById.get(id) ?? `Player ${id}`),
    resolved: true
  };
};

const StandingsTableView = ({
  title,
  rows,
  qualifiedCount,
  nameOf
}: {
  title: string | null;
  rows: StandingsRow[];
  qualifiedCount: number;
  nameOf: (sideId: number) => string;
}) => (
  <div className="box">
    {title && <h2>{title}</h2>}
    <table>
      <thead>
        <tr>
          <th className="num">#</th>
          <th>Name</th>
          <th className="num">P</th>
          <th className="num">W</th>
          <th className="num">D</th>
          <th className="num">L</th>
          <th className="num">+/-</th>
          <th className="num">Pts</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, index) => (
          <tr key={row.playerId} className={index < qualifiedCount ? 'qualified' : undefined}>
            <td className="num">{index + 1}</td>
            <td>{nameOf(row.playerId)}</td>
            <td className="num">{row.played}</td>
            <td className="num">{row.wins}</td>
            <td className="num">{row.draws}</td>
            <td className="num">{row.losses}</td>
            <td className="num">{row.scoreFor - row.scoreAgainst}</td>
            <td className="num pts">{row.points}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const SlotLine = ({
  tournament,
  playerNameById,
  slot
}: {
  tournament: Tournament;
  playerNameById: Map<number, string>;
  slot: ResolvedSlot;
}) => {
  const home = sideLabel(tournament, playerNameById, slot, 'home');
  const away = sideLabel(tournament, playerNameById, slot, 'away');
  const homeWon = slot.winnerPlayerId !== null && slot.winnerPlayerId === slot.homePlayerId;
  const awayWon = slot.winnerPlayerId !== null && slot.winnerPlayerId === slot.awayPlayerId;
  return (
    <table className="slot">
      <tbody>
        <tr>
          <td className={`side right ${homeWon ? 'won' : ''} ${home.resolved ? '' : 'tbd'}`}>{home.text}</td>
          <td className="score">
            {slot.status === 'done' && slot.homeScore !== null && slot.awayScore !== null
              ? `${slot.homeScore} - ${slot.awayScore}`
              : 'vs'}
          </td>
          <td className={`side ${awayWon ? 'won' : ''} ${away.resolved ? '' : 'tbd'}`}>{away.text}</td>
        </tr>
      </tbody>
    </table>
  );
};

export default async function PublicTournamentPage({
  params
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const normalized = String(code ?? '').trim().toLowerCase();
  if (!normalized || normalized.length > 16) notFound();

  const data = await loadTournament(normalized);
  if (!data) notFound();
  const { tournament, matches, playerNameById } = data;

  const state = computeTournamentState(tournament, matches);
  const nameOf = (sideId: number) =>
    getSideName(tournament, sideId, id => playerNameById.get(id) ?? `Player ${id}`);

  const knockoutSlots = state.slots.filter(slot => slot.phase === 'knockout');
  const thirdPlaceSlot = knockoutSlots.find(slot => slot.home.kind === 'loser') ?? null;
  const mainKnockoutSlots = knockoutSlots.filter(slot => slot !== thirdPlaceSlot);
  const consolationSlots = state.slots.filter(slot => slot.phase === 'consolation');
  const roundRobinSlots = state.slots.filter(slot => slot.phase === 'round_robin');
  const swissSlots = state.slots.filter(slot => slot.phase === 'swiss');
  const totalKnockoutRounds = knockoutSlots.reduce((max, slot) => Math.max(max, slot.round), 0);
  const totalPlayable = state.playedMatches + state.pendingMatches;
  const groupCount = tournament.config.groupCount ?? 0;

  const roundsOf = (slots: ResolvedSlot[]) => {
    const byRound = new Map<number, ResolvedSlot[]>();
    slots
      .filter(slot => slot.status !== 'bye')
      .forEach(slot => {
        const bucket = byRound.get(slot.round) ?? [];
        bucket.push(slot);
        byRound.set(slot.round, bucket);
      });
    return Array.from(byRound.entries()).sort((a, b) => a[0] - b[0]);
  };

  return (
    <div className="board">
      {/* Works on browsers too old for the main app; reloads the whole page */}
      <meta httpEquiv="refresh" content={String(REFRESH_SECONDS)} />
      <style>{`
        html, body { margin: 0; padding: 0; }
        .board { min-height: 100vh; background: #111827; color: #f9fafb;
          font-family: Arial, Helvetica, sans-serif; padding: 24px; box-sizing: border-box; }
        .board h1 { margin: 0 0 4px 0; font-size: 32px; }
        .board .meta { color: #9ca3af; font-size: 15px; margin-bottom: 6px; }
        .board .champion { color: #fbbf24; font-size: 20px; font-weight: bold; margin: 10px 0; }
        .board h2 { font-size: 18px; color: #d1d5db; border-bottom: 1px solid #374151;
          padding-bottom: 4px; margin: 26px 0 10px 0; }
        .board .box { margin-bottom: 8px; }
        .board table { border-collapse: collapse; width: 100%; max-width: 640px; }
        .board th, .board td { text-align: left; padding: 6px 10px; font-size: 16px; }
        .board thead th { color: #9ca3af; font-size: 13px; border-bottom: 1px solid #374151; }
        .board tbody td { border-bottom: 1px solid #1f2937; }
        .board .num { text-align: right; width: 36px; }
        .board .pts { font-weight: bold; }
        .board .qualified td { color: #6ee7b7; }
        .board table.slot { max-width: 640px; margin: 4px 0; background: #1f2937; }
        .board table.slot td { border: none; padding: 8px 10px; }
        .board .side { width: 45%; }
        .board .side.right { text-align: right; }
        .board .score { text-align: center; white-space: nowrap; font-weight: bold; width: 10%; }
        .board .won { font-weight: bold; color: #93c5fd; }
        .board .tbd { color: #6b7280; font-style: italic; }
        .board .footer { color: #4b5563; font-size: 12px; margin-top: 30px; }
      `}</style>

      <h1>{tournament.name}</h1>
      <div className="meta">
        {formatLabel(tournament.format)}
        {' · '}{state.playedMatches}/{totalPlayable} matches played
        {state.isComplete ? ' · Completed' : ''}
      </div>
      {state.championId !== null && (
        <div className="champion">🏆 {nameOf(state.championId)}</div>
      )}

      {/* Group stage / standings */}
      {tournament.format === 'groups_knockout' && state.groupStandings.map((rows, groupIndex) => (
        <StandingsTableView
          key={groupIndex}
          title={`Group ${groupLetter(groupIndex)}`}
          rows={rows}
          qualifiedCount={tournament.config.qualifiersPerGroup ?? 0}
          nameOf={nameOf}
        />
      ))}
      {state.standings && (
        <StandingsTableView
          title="Standings"
          rows={state.standings}
          qualifiedCount={0}
          nameOf={nameOf}
        />
      )}

      {/* Round robin / swiss rounds */}
      {roundsOf(tournament.format === 'round_robin' ? roundRobinSlots : swissSlots).map(([round, slots]) => (
        <div key={`r-${round}`}>
          <h2>Round {round}</h2>
          {slots.map(slot => (
            <SlotLine key={slot.id} tournament={tournament} playerNameById={playerNameById} slot={slot} />
          ))}
        </div>
      ))}

      {/* Knockout */}
      {roundsOf(mainKnockoutSlots).map(([round, slots]) => (
        <div key={`ko-${round}`}>
          <h2>{knockoutRoundLabel(round, totalKnockoutRounds)}</h2>
          {slots.map(slot => (
            <SlotLine key={slot.id} tournament={tournament} playerNameById={playerNameById} slot={slot} />
          ))}
        </div>
      ))}
      {thirdPlaceSlot && thirdPlaceSlot.status !== 'bye' && (
        <div>
          <h2>3rd Place Match</h2>
          <SlotLine tournament={tournament} playerNameById={playerNameById} slot={thirdPlaceSlot} />
        </div>
      )}
      {consolationSlots.length > 0 && (
        <div>
          <h2>Consolation Bracket</h2>
          {roundsOf(consolationSlots).map(([round, slots]) => (
            <div key={`co-${round}`}>
              {slots.map(slot => (
                <SlotLine key={slot.id} tournament={tournament} playerNameById={playerNameById} slot={slot} />
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Group matches detail (kept last: standings matter most on a shared screen) */}
      {groupCount > 0 && (
        <div>
          <h2>Group Matches</h2>
          {Array.from({ length: groupCount }, (_, groupIndex) => (
            <div key={`g-${groupIndex}`}>
              {state.slots
                .filter(slot => slot.phase === 'group' && slot.group === groupIndex && slot.status !== 'bye')
                .map(slot => (
                  <SlotLine key={slot.id} tournament={tournament} playerNameById={playerNameById} slot={slot} />
                ))}
            </div>
          ))}
        </div>
      )}

      <div className="footer">Updates every {REFRESH_SECONDS} seconds</div>
    </div>
  );
}
