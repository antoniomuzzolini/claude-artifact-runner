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
// spectators' phones). Deliberately plain server-rendered HTML with inline
// CSS and NO client-side JavaScript: it must work on old smart-TV browsers
// where the main React app does not load.
//
// One fixed screen, no scrolling (on TV-sized viewports). When the content
// cannot reasonably fit one screen (many groups, consolation bracket), the
// board rotates between views automatically: the meta-refresh reloads the
// page and the server picks the view from the wall clock — zero JS.
//
// Optional ?view= override per screen: all | groups | bracket | consolation | rotate
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const sql = neon(process.env.DATABASE_URL!);

const ROTATE_SECONDS = 7; // per-view time when rotating
const STATIC_REFRESH_SECONDS = 15; // data refresh when everything fits

type BoardView = 'overview' | 'groups' | 'bracket' | 'consolation' | 'table';

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

const sideText = (
  tournament: Tournament,
  playerNameById: Map<number, string>,
  slot: ResolvedSlot,
  side: 'home' | 'away'
): { text: string; resolved: boolean; isBye: boolean } => {
  const sideId = side === 'home' ? slot.homePlayerId : slot.awayPlayerId;
  const isBye = side === 'home' ? slot.homeIsBye : slot.awayIsBye;
  const placeholder = side === 'home' ? slot.homePlaceholder : slot.awayPlaceholder;
  if (isBye) return { text: 'Bye', resolved: false, isBye: true };
  if (sideId === null) return { text: placeholder ?? 'TBD', resolved: false, isBye: false };
  return {
    text: getSideName(tournament, sideId, id => playerNameById.get(id) ?? `Player ${id}`),
    resolved: true,
    isBye: false
  };
};

// Compact standings table (one group or the whole standings)
const StandingsBox = ({
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
  <div className="gbox">
    {title && <div className="gtitle">{title}</div>}
    <table className="gt">
      <thead>
        <tr>
          <th className="c-pos">#</th>
          <th>Name</th>
          <th className="c-n">P</th>
          <th className="c-n">+/-</th>
          <th className="c-n">Pts</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, index) => (
          <tr key={row.playerId} className={index < qualifiedCount ? 'q' : undefined}>
            <td className="c-pos">{index + 1}</td>
            <td className="c-name">{nameOf(row.playerId)}</td>
            <td className="c-n">{row.played}</td>
            <td className="c-n">{row.scoreFor - row.scoreAgainst}</td>
            <td className="c-n pts">{row.points}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const MatchCard = ({
  tournament,
  playerNameById,
  slot
}: {
  tournament: Tournament;
  playerNameById: Map<number, string>;
  slot: ResolvedSlot;
}) => {
  const home = sideText(tournament, playerNameById, slot, 'home');
  const away = sideText(tournament, playerNameById, slot, 'away');
  const homeWon = slot.winnerPlayerId !== null && slot.winnerPlayerId === slot.homePlayerId;
  const awayWon = slot.winnerPlayerId !== null && slot.winnerPlayerId === slot.awayPlayerId;
  const done = slot.status === 'done' && slot.homeScore !== null && slot.awayScore !== null;
  return (
    <div className="mcard">
      <div className={`mline ${homeWon ? 'won' : ''} ${home.resolved ? '' : 'tbd'}`}>
        <span className="msc">{done ? slot.homeScore : (slot.status === 'bye' && !home.isBye ? '·' : '')}</span>
        <span className="mnm">{home.text}</span>
      </div>
      <div className={`mline ${awayWon ? 'won' : ''} ${away.resolved ? '' : 'tbd'}`}>
        <span className="msc">{done ? slot.awayScore : (slot.status === 'bye' && !away.isBye ? '·' : '')}</span>
        <span className="mnm">{away.text}</span>
      </div>
    </div>
  );
};

// Bracket as table columns: one cell per round, vertical centering gives the
// classic pyramid without flexbox or SVG (old-TV-safe CSS)
const BracketColumns = ({
  tournament,
  playerNameById,
  slots,
  totalRounds,
  thirdPlaceSlot
}: {
  tournament: Tournament;
  playerNameById: Map<number, string>;
  slots: ResolvedSlot[];
  totalRounds: number;
  thirdPlaceSlot?: ResolvedSlot | null;
}) => (
  <table className="bracket">
    <tbody>
      <tr>
        {Array.from({ length: totalRounds }, (_, index) => {
          const round = index + 1;
          const roundSlots = slots
            .filter(slot => slot.round === round)
            .sort((a, b) => a.position - b.position);
          const isFinalColumn = round === totalRounds;
          return (
            <td key={round} className="bcol" style={{ width: `${100 / totalRounds}%` }}>
              <div className="btitle">
                {knockoutRoundLabel(round, totalRounds)}
              </div>
              {roundSlots.map(slot => (
                <MatchCard key={slot.id} tournament={tournament} playerNameById={playerNameById} slot={slot} />
              ))}
              {isFinalColumn && thirdPlaceSlot && thirdPlaceSlot.status !== 'bye' && (
                <div className="third">
                  <div className="btitle">3rd Place</div>
                  <MatchCard tournament={tournament} playerNameById={playerNameById} slot={thirdPlaceSlot} />
                </div>
              )}
            </td>
          );
        })}
      </tr>
    </tbody>
  </table>
);

export default async function PublicTournamentPage({
  params,
  searchParams
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { code } = await params;
  const query = await searchParams;
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
  const totalKnockoutRounds = mainKnockoutSlots.reduce((max, slot) => Math.max(max, slot.round), 0);
  const totalConsolationRounds = consolationSlots.reduce((max, slot) => Math.max(max, slot.round), 0);
  const totalPlayable = state.playedMatches + state.pendingMatches;
  const groupCount = tournament.config.groupCount ?? 0;
  const hasConsolation = consolationSlots.length > 0;
  const maxGroupRows = state.groupStandings.reduce((max, rows) => Math.max(max, rows.length), 0);

  // Which views exist, and does everything fit one screen?
  let views: BoardView[];
  if (tournament.format === 'groups_knockout') {
    const fitsOneScreen = groupCount <= 4 && maxGroupRows <= 6 && !hasConsolation;
    views = fitsOneScreen
      ? ['overview']
      : (['groups', 'bracket', ...(hasConsolation ? ['consolation'] : [])] as BoardView[]);
  } else if (tournament.format === 'single_elimination') {
    views = ['bracket'];
  } else {
    views = ['table'];
  }

  // Per-screen override: /t/<code>?view=all|groups|bracket|consolation|rotate
  const viewParam = typeof query.view === 'string' ? query.view : undefined;
  if (viewParam === 'all' && tournament.format === 'groups_knockout') views = ['overview'];
  else if (viewParam === 'groups' && groupCount > 0) views = ['groups'];
  else if (viewParam === 'bracket' && totalKnockoutRounds > 0) views = ['bracket'];
  else if (viewParam === 'consolation' && hasConsolation) views = ['consolation'];
  else if (viewParam === 'rotate' && tournament.format === 'groups_knockout') {
    views = ['groups', 'bracket', ...(hasConsolation ? ['consolation'] : [])] as BoardView[];
  }

  // Rotation without JS: the page reloads on a timer and the server picks the
  // view from the wall clock, so the board cycles by itself
  const activeView = views.length === 1
    ? views[0]
    : views[Math.floor(Date.now() / 1000 / ROTATE_SECONDS) % views.length];
  const refreshSeconds = views.length > 1 ? ROTATE_SECONDS : STATIC_REFRESH_SECONDS;

  const viewLabel: Record<BoardView, string> = {
    overview: '',
    groups: 'Groups',
    bracket: 'Knockout',
    consolation: 'Consolation',
    table: ''
  };

  // Group columns per row: all in one row on the overview, larger cards
  // (max 3 per row) on the dedicated groups view
  const groupColumns = activeView === 'overview'
    ? Math.max(1, groupCount)
    : Math.max(1, Math.min(3, groupCount));

  // Round robin / swiss: show the round being played next to the standings
  const nonBracketSlots = state.slots.filter(
    slot => slot.phase === 'round_robin' || slot.phase === 'swiss'
  );
  const currentRound = nonBracketSlots.some(slot => slot.status !== 'done' && slot.status !== 'bye')
    ? Math.min(
        ...nonBracketSlots
          .filter(slot => slot.status !== 'done' && slot.status !== 'bye')
          .map(slot => slot.round)
      )
    : nonBracketSlots.reduce((max, slot) => Math.max(max, slot.round), 0);
  const currentRoundSlots = nonBracketSlots.filter(
    slot => slot.round === currentRound && slot.status !== 'bye'
  );

  const scaleClass = totalKnockoutRounds >= 4 || groupCount > 4 || maxGroupRows > 6 ? 'dense' : '';

  return (
    <div className={`board view-${activeView} ${scaleClass}`}>
      {/* Works on browsers too old for the main app; reloads the whole page */}
      <meta httpEquiv="refresh" content={String(refreshSeconds)} />
      <style>{`
        html, body { margin: 0; padding: 0; background: #0b1220; }
        .board { position: fixed; top: 0; left: 0; right: 0; bottom: 0;
          background: #0b1220; color: #f9fafb; overflow: auto;
          font-family: Arial, Helvetica, sans-serif; padding: 2vh 2vw; box-sizing: border-box; }
        @media (min-width: 900px) { .board { overflow: hidden; } }

        .hdr { width: 100%; margin-bottom: 1.6vh; }
        .hdr .title { font-size: 3.4vh; font-weight: bold; }
        .hdr .sub { color: #9ca3af; font-size: 1.9vh; margin-top: 0.4vh; }
        .hdr .champ { color: #fbbf24; font-weight: bold; }
        .hdr .vtag { float: right; color: #60a5fa; font-size: 2vh; font-weight: bold;
          border: 1px solid #1e3a5f; padding: 0.5vh 1.2vw; border-radius: 6px; }

        /* Groups: side-by-side cells (inline-block: no flexbox needed) */
        .grow { width: 100%; font-size: 0; }
        .gcell { display: inline-block; vertical-align: top; font-size: 1.9vh;
          box-sizing: border-box; padding: 0 0.6vw 1.2vh 0.6vw; }
        .gbox { background: #131c2e; border: 1px solid #1f2a3f; border-radius: 8px;
          padding: 1vh 0.8vw; }
        .gtitle { color: #93c5fd; font-weight: bold; font-size: 2vh; margin-bottom: 0.6vh; }
        .gt { border-collapse: collapse; width: 100%; table-layout: fixed; }
        .gt th, .gt td { text-align: left; padding: 0.55vh 0.4vw; font-size: 1.9vh;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .gt thead th { color: #6b7280; font-size: 1.5vh; border-bottom: 1px solid #263248; }
        .gt tbody td { border-bottom: 1px solid #172136; }
        .gt .c-pos { width: 9%; text-align: right; color: #6b7280; }
        .gt .c-n { width: 13%; text-align: right; }
        .gt .pts { font-weight: bold; }
        .gt tr.q td { color: #6ee7b7; }

        /* Bracket: table columns, vertical centering makes the pyramid.
           The height spreads the tree over the remaining screen space
           (on tables it behaves as a min-height). */
        .bracket { width: 100%; border-collapse: collapse; }
        .view-overview .bracket { height: 55vh; }
        .view-bracket .bracket, .view-consolation .bracket { height: 78vh; }
        .bcol { vertical-align: middle; padding: 0 0.5vw; }
        .btitle { color: #6b7280; font-size: 1.6vh; font-weight: bold;
          text-transform: uppercase; text-align: center; margin: 0.8vh 0; }
        .mcard { background: #131c2e; border: 1px solid #1f2a3f; border-radius: 8px;
          margin: 1vh 0; overflow: hidden; }
        .mline { padding: 0.9vh 0.7vw; font-size: 2vh; border-bottom: 1px solid #1f2a3f;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .mline:last-child { border-bottom: none; }
        .mline .msc { float: right; font-weight: bold; color: #e5e7eb; padding-left: 0.6vw; }
        .mline.won { color: #93c5fd; font-weight: bold; }
        .mline.won .msc { color: #93c5fd; }
        .mline.tbd { color: #6b7280; font-style: italic; }
        .third { margin-top: 2.5vh; }

        .dense .gt th, .dense .gt td { font-size: 1.6vh; padding: 0.4vh 0.4vw; }
        .dense .mline { font-size: 1.7vh; padding: 0.7vh 0.6vw; }

        .section-title { color: #d1d5db; font-size: 2.2vh; font-weight: bold; margin: 1.5vh 0 0.8vh 0; }
        .split { width: 100%; border-collapse: collapse; }
        .split > tbody > tr > td { vertical-align: top; padding: 0 1vw; }

        .foot { position: fixed; right: 1vw; bottom: 0.6vh; color: #374151; font-size: 1.4vh; }
        @media (max-width: 899px) {
          .gcell { width: 100% !important; }
          .hdr .title { font-size: 22px; }
          .hdr .sub, .gt th, .gt td, .mline, .gtitle, .btitle { font-size: 13px; }
        }
      `}</style>

      <div className="hdr">
        {(views.length > 1 || activeView === 'consolation') && viewLabel[activeView] && (
          <span className="vtag">{viewLabel[activeView]}</span>
        )}
        <div className="title">{tournament.name}</div>
        <div className="sub">
          {formatLabel(tournament.format)}
          {' · '}{state.playedMatches}/{totalPlayable} played
          {state.championId !== null && (
            <span className="champ"> · 🏆 {nameOf(state.championId)}</span>
          )}
        </div>
      </div>

      {/* Overview: groups in one row on top, bracket below */}
      {(activeView === 'overview' || activeView === 'groups') && groupCount > 0 && (
        <div className="grow">
          {state.groupStandings.map((rows, groupIndex) => (
            <div key={groupIndex} className="gcell" style={{ width: `${100 / groupColumns}%` }}>
              <StandingsBox
                title={`Group ${groupLetter(groupIndex)}`}
                rows={rows}
                qualifiedCount={tournament.config.qualifiersPerGroup ?? 0}
                nameOf={nameOf}
              />
            </div>
          ))}
        </div>
      )}

      {(activeView === 'overview' || activeView === 'bracket') && totalKnockoutRounds > 0 && (
        <BracketColumns
          tournament={tournament}
          playerNameById={playerNameById}
          slots={mainKnockoutSlots}
          totalRounds={totalKnockoutRounds}
          thirdPlaceSlot={thirdPlaceSlot}
        />
      )}

      {activeView === 'consolation' && hasConsolation && (
        <BracketColumns
          tournament={tournament}
          playerNameById={playerNameById}
          slots={consolationSlots}
          totalRounds={totalConsolationRounds}
        />
      )}

      {/* Round robin / swiss: standings + the round in progress */}
      {activeView === 'table' && (
        <table className="split">
          <tbody>
            <tr>
              <td style={{ width: '55%' }}>
                {state.standings && (
                  <StandingsBox title={null} rows={state.standings} qualifiedCount={0} nameOf={nameOf} />
                )}
              </td>
              <td style={{ width: '45%' }}>
                {currentRoundSlots.length > 0 && (
                  <div>
                    <div className="section-title">Round {currentRound}</div>
                    {currentRoundSlots.map(slot => (
                      <MatchCard key={slot.id} tournament={tournament} playerNameById={playerNameById} slot={slot} />
                    ))}
                  </div>
                )}
              </td>
            </tr>
          </tbody>
        </table>
      )}

      <div className="foot">
        {views.length > 1
          ? `Rotating every ${ROTATE_SECONDS}s`
          : `Updates every ${STATIC_REFRESH_SECONDS}s`}
      </div>
    </div>
  );
}
