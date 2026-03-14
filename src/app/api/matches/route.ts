import { neon } from '@neondatabase/serverless';
import jwt from 'jsonwebtoken';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

const sql = neon(process.env.DATABASE_URL!);
const JWT_SECRET = process.env.JWT_SECRET || 'your-fallback-secret-key-change-in-production';

const corsHeaders = {
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,OPTIONS,PATCH,DELETE,POST,PUT,HEAD',
  'Access-Control-Allow-Headers': 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization',
};

function jsonResponse(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: corsHeaders });
}

export function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders });
}

export function HEAD() {
  return new NextResponse(null, { status: 200, headers: corsHeaders });
}

function getCurrentUser(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return { error: jsonResponse({ error: 'Authentication required' }, 401) };
  }

  const token = authHeader.substring(7);
  try {
    const currentUser = jwt.verify(token, JWT_SECRET) as any;
    if (!currentUser.organizationId) {
      return { error: jsonResponse({ error: 'User must belong to an organization' }, 403) };
    }
    return { currentUser };
  } catch (error) {
    return { error: jsonResponse({ error: 'Invalid token' }, 401) };
  }
}

const resolveWinnerIndex = (scores: number[], winnerIndex?: number | null) => {
  if (typeof winnerIndex === 'number' && Number.isFinite(winnerIndex)) return winnerIndex;
  if (!scores.length) return null;
  const maxScore = Math.max(...scores);
  const maxIndexes = scores
    .map((score, index) => ({ score, index }))
    .filter(item => item.score === maxScore)
    .map(item => item.index);
  return maxIndexes.length === 1 ? maxIndexes[0] : null;
};

const normalizeName = (name: string) => name.trim().toLowerCase();

const buildPlayerLookup = (players: any[]) => {
  const byId = new Map<number, { id: number; name: string; season_id?: number | null }>();
  const bySeasonAndName = new Map<string, { id: number; name: string; season_id?: number | null }>();

  players.forEach(player => {
    const id = Number(player.id);
    if (!Number.isFinite(id)) return;
    const seasonKey = Number.isFinite(Number(player.season_id)) ? String(player.season_id) : '';
    const nameKey = normalizeName(String(player.name ?? ''));
    const record = { id, name: String(player.name ?? ''), season_id: player.season_id ?? null };
    byId.set(id, record);
    if (nameKey) {
      bySeasonAndName.set(`${seasonKey}::${nameKey}`, record);
      bySeasonAndName.set(`::${nameKey}`, record);
    }
  });

  return { byId, bySeasonAndName };
};

const resolvePlayerByName = (
  name: string,
  seasonId: number | null,
  lookup: ReturnType<typeof buildPlayerLookup>
) => {
  const nameKey = normalizeName(name);
  const seasonKey = Number.isFinite(Number(seasonId)) ? String(seasonId) : '';
  return lookup.bySeasonAndName.get(`${seasonKey}::${nameKey}`) ?? lookup.bySeasonAndName.get(`::${nameKey}`);
};

const normalizeTeams = (
  teams: unknown,
  seasonId: number | null,
  lookup: ReturnType<typeof buildPlayerLookup>
) => {
  let changed = false;
  if (!Array.isArray(teams)) return { teams: [], changed: teams !== undefined && teams !== null };

  const normalized = teams.map(team => {
    if (!Array.isArray(team)) {
      changed = true;
      return [];
    }
    return team.map(entry => {
      if (typeof entry === 'string') {
        changed = true;
        const player = resolvePlayerByName(entry, seasonId, lookup);
        return {
          id: player?.id ?? 0,
          name: player?.name ?? entry
        };
      }

      if (entry && typeof entry === 'object') {
        const rawId = Number((entry as { id?: unknown }).id);
        const rawName = (entry as { name?: unknown }).name;
        const name = typeof rawName === 'string' ? rawName : '';

        if (Number.isFinite(rawId) && rawId > 0) {
          const player = lookup.byId.get(rawId);
          if (!name || (entry as { id?: unknown }).id !== rawId) {
            changed = true;
          }
          return {
            id: rawId,
            name: name || player?.name || ''
          };
        }

        changed = true;
        const player = name ? resolvePlayerByName(name, seasonId, lookup) : undefined;
        return {
          id: player?.id ?? 0,
          name: player?.name ?? name
        };
      }

      changed = true;
      return { id: 0, name: String(entry ?? '') };
    });
  });

  return { teams: normalized, changed };
};

const normalizeEloChanges = (
  eloChanges: unknown,
  seasonId: number | null,
  lookup: ReturnType<typeof buildPlayerLookup>
) => {
  let changed = false;
  const normalized: Record<string, number> = {};
  if (!eloChanges || typeof eloChanges !== 'object') {
    return { eloChanges: normalized, changed: eloChanges !== undefined && eloChanges !== null };
  }

  for (const [key, value] of Object.entries(eloChanges as Record<string, unknown>)) {
    let playerId = Number(key);
    if (!Number.isFinite(playerId) || playerId <= 0) {
      const player = resolvePlayerByName(key, seasonId, lookup);
      if (!player) {
        changed = true;
        continue;
      }
      playerId = player.id;
      changed = true;
    }

    const delta = Number(value);
    if (!Number.isFinite(delta)) {
      changed = true;
      continue;
    }

    normalized[String(playerId)] = delta;
  }

  return { eloChanges: normalized, changed };
};

export async function GET(req: NextRequest) {
  try {
    const { currentUser, error } = getCurrentUser(req);
    if (error) return error;

    const [matches, players] = await Promise.all([
      sql`
        SELECT * FROM matches 
        WHERE organization_id = ${currentUser.organizationId}
        ORDER BY created_at DESC
      `,
      sql`
        SELECT * FROM players
        WHERE organization_id = ${currentUser.organizationId}
      `
    ]);

    const playerLookup = buildPlayerLookup(players);
    const transformedMatches = [];

    for (const match of matches) {
      const parsedSeasonId = Number(match.season_id);
      const matchSeasonId = Number.isFinite(parsedSeasonId) ? parsedSeasonId : null;
      const teamsResult = normalizeTeams(match.teams, matchSeasonId, playerLookup);
      const eloResult = normalizeEloChanges(match.elo_changes, matchSeasonId, playerLookup);
      const scores = Array.isArray(match.scores) ? match.scores : [];
      const winnerIndex = resolveWinnerIndex(scores, match.winner_index);

      if (teamsResult.changed || eloResult.changed) {
        await sql`
          UPDATE matches
          SET teams = ${JSON.stringify(teamsResult.teams)},
              elo_changes = ${JSON.stringify(eloResult.eloChanges)}
          WHERE id = ${match.id} AND organization_id = ${currentUser.organizationId}
        `;
      }

      transformedMatches.push({
        ...match,
        teams: teamsResult.teams,
        scores,
        winnerIndex,
        eloChanges: eloResult.eloChanges,
        createdBy: match.created_by
      });
    }
    return jsonResponse(transformedMatches);
  } catch (error) {
    console.error('Database error:', error);
    return jsonResponse({ error: 'Database operation failed' }, 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { currentUser, error } = getCurrentUser(req);
    if (error) return error;

    const { matches: matchesData } = await req.json();

    if (!matchesData || !Array.isArray(matchesData)) {
      return jsonResponse({ error: 'Invalid matches data' }, 400);
    }

    const players = await sql`
      SELECT * FROM players
      WHERE organization_id = ${currentUser.organizationId}
    `;
    const playerLookup = buildPlayerLookup(players);

    for (const match of matchesData) {
      const parsedSeasonId = Number(match.season_id);
      const matchSeasonId = Number.isFinite(parsedSeasonId) ? parsedSeasonId : null;
      const teamsResult = normalizeTeams(match.teams, matchSeasonId, playerLookup);
      const scores = Array.isArray(match.scores) ? match.scores : [];
      const winnerIndex = resolveWinnerIndex(scores, match.winnerIndex ?? null);
      const rawEloChanges = match.eloChanges ?? match.elo_changes ?? {};
      const eloResult = normalizeEloChanges(rawEloChanges, matchSeasonId, playerLookup);

      await sql`
        INSERT INTO matches (id, date, time, teams, scores, winner_index, elo_changes, created_by, organization_id, season_id)
        VALUES (${match.id}, ${match.date}, ${match.time}, ${JSON.stringify(teamsResult.teams)}, ${scores}, ${winnerIndex}, ${JSON.stringify(eloResult.eloChanges)}, ${match.createdBy || currentUser.userId}, ${currentUser.organizationId}, ${matchSeasonId})
        ON CONFLICT (id) DO UPDATE SET
          date = EXCLUDED.date,
          time = EXCLUDED.time,
          teams = EXCLUDED.teams,
          scores = EXCLUDED.scores,
          winner_index = EXCLUDED.winner_index,
          elo_changes = EXCLUDED.elo_changes,
          created_by = EXCLUDED.created_by,
          season_id = EXCLUDED.season_id
        WHERE matches.organization_id = ${currentUser.organizationId}
      `;
    }

    return jsonResponse({ success: true, message: 'Matches synced successfully' });
  } catch (error) {
    console.error('Database error:', error);
    return jsonResponse({ error: 'Database operation failed' }, 500);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { currentUser, error } = getCurrentUser(req);
    if (error) return error;

    const { matchId } = await req.json().catch(() => ({}));

    if (matchId) {
      const matchRows = await sql`
        SELECT created_by FROM matches 
        WHERE id = ${matchId} AND organization_id = ${currentUser.organizationId}
        LIMIT 1
      `;

      if (matchRows.length === 0) {
        return jsonResponse({ error: 'Match not found' }, 404);
      }

      const match = matchRows[0];
      const canDelete = currentUser.role === 'superuser' || match.created_by === currentUser.userId;

      if (!canDelete) {
        return jsonResponse({ error: 'You can only delete matches you created' }, 403);
      }

      await sql`
        DELETE FROM matches 
        WHERE id = ${matchId} AND organization_id = ${currentUser.organizationId}
      `;

      return jsonResponse({ success: true, message: 'Match deleted successfully' });
    }

    if (currentUser.role !== 'superuser') {
      return jsonResponse({ error: 'Only administrators can delete all matches' }, 403);
    }

    await sql`
      DELETE FROM matches 
      WHERE organization_id = ${currentUser.organizationId}
    `;
    return jsonResponse({ success: true, message: 'All matches deleted' });
  } catch (error) {
    console.error('Database error:', error);
    return jsonResponse({ error: 'Database operation failed' }, 500);
  }
}
