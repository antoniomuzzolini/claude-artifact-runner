import { neon } from '@neondatabase/serverless';
import jwt from 'jsonwebtoken';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

const sql = neon(process.env.DATABASE_URL!);
const JWT_SECRET = process.env.JWT_SECRET || 'your-fallback-secret-key-change-in-production';

const corsHeaders = {
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function jsonResponse(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: corsHeaders });
}

export function OPTIONS() {
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
  const byId = new Map<number, { id: number; name: string }>();
  const byName = new Map<string, { id: number; name: string }>();

  players.forEach(player => {
    const id = Number(player.id);
    if (!Number.isFinite(id)) return;
    const name = String(player.name ?? '');
    const nameKey = normalizeName(name);
    const record = { id, name };
    byId.set(id, record);
    if (nameKey) {
      byName.set(nameKey, record);
    }
  });

  return { byId, byName };
};

const resolvePlayerByName = (
  name: string,
  lookup: ReturnType<typeof buildPlayerLookup>
) => {
  const nameKey = normalizeName(name);
  return lookup.byName.get(nameKey);
};

const normalizeTeams = (
  teams: unknown,
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
        const player = resolvePlayerByName(entry, lookup);
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
        const player = name ? resolvePlayerByName(name, lookup) : undefined;
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
      const player = resolvePlayerByName(key, lookup);
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

async function ensureSeasonsSchema() {
  await sql`
    CREATE TABLE IF NOT EXISTS seasons (
      id BIGINT PRIMARY KEY,
      organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      start_date TIMESTAMP NOT NULL,
      end_date TIMESTAMP,
      is_current BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `;

  await sql`ALTER TABLE matches ADD COLUMN IF NOT EXISTS season_id BIGINT;`;
  await sql`ALTER TABLE matches ADD COLUMN IF NOT EXISTS teams JSONB;`;
  await sql`ALTER TABLE matches ADD COLUMN IF NOT EXISTS scores INTEGER[];`;
  await sql`ALTER TABLE matches ADD COLUMN IF NOT EXISTS winner_index INTEGER;`;

  // Player names are unique per organization, not globally: the same name can
  // exist in different organizations (the legacy global UNIQUE blocked that)
  await sql`ALTER TABLE players DROP CONSTRAINT IF EXISTS players_name_key;`;
  try {
    await sql`
      CREATE UNIQUE INDEX IF NOT EXISTS players_org_name_unique
      ON players (organization_id, LOWER(name));
    `;
  } catch (error) {
    // Pre-existing duplicates within an organization would block the index;
    // the app-level duplicate checks still apply
    console.warn('players_org_name_unique index not created:', error);
  }

  // Self-heal: at most one current season per organization (keep the most recent)
  await sql`
    UPDATE seasons SET is_current = FALSE
    WHERE is_current AND id NOT IN (
      SELECT DISTINCT ON (organization_id) id
      FROM seasons
      WHERE is_current
      ORDER BY organization_id, start_date DESC
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS tournaments (
      id BIGINT PRIMARY KEY,
      organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      season_id BIGINT,
      name VARCHAR(255) NOT NULL,
      format VARCHAR(32) NOT NULL,
      seeding VARCHAR(16) NOT NULL,
      participant_ids JSONB NOT NULL,
      config JSONB NOT NULL,
      slots JSONB NOT NULL,
      created_by INTEGER,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `;
  // Tournament-scoped teams (team tournaments); empty for individual ones
  await sql`ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS teams JSONB;`;
}

const transformTournamentRow = (row: Record<string, any>) => ({
  id: Number(row.id),
  name: row.name,
  format: row.format,
  seeding: row.seeding,
  participantIds: Array.isArray(row.participant_ids) ? row.participant_ids.map(Number) : [],
  config: row.config ?? {},
  teams: Array.isArray(row.teams) ? row.teams : [],
  slots: Array.isArray(row.slots) ? row.slots : [],
  organization_id: row.organization_id,
  season_id: Number(row.season_id),
  createdBy: row.created_by ?? undefined,
  createdAt: row.created_at?.toISOString ? row.created_at.toISOString() : row.created_at
});

async function ensureCurrentSeason(organizationId: number) {
  await ensureSeasonsSchema();

  const currentRows = await sql`
    SELECT * FROM seasons 
    WHERE organization_id = ${organizationId} AND is_current = TRUE
    LIMIT 1
  `;

  if (currentRows.length > 0) {
    return currentRows[0];
  }

  const existingRows = await sql`
    SELECT * FROM seasons
    WHERE organization_id = ${organizationId}
    ORDER BY start_date DESC
    LIMIT 1
  `;

  if (existingRows.length > 0) {
    await sql`
      UPDATE seasons
      SET is_current = TRUE
      WHERE id = ${existingRows[0].id}
    `;
    return existingRows[0];
  }

  const now = new Date().toISOString();
  const newId = Date.now();
  // Guarded insert: concurrent requests for a brand-new organization must not
  // create two "Season 1" rows
  const created = await sql`
    INSERT INTO seasons (id, organization_id, name, start_date, is_current)
    SELECT ${newId}, ${organizationId}, ${'Season 1'}, ${now}, TRUE
    WHERE NOT EXISTS (SELECT 1 FROM seasons WHERE organization_id = ${organizationId})
    RETURNING *
  `;
  if (created.length > 0) {
    return created[0];
  }

  const retry = await sql`
    SELECT * FROM seasons
    WHERE organization_id = ${organizationId}
    ORDER BY start_date DESC
    LIMIT 1
  `;
  return retry[0];
}

async function backfillSeasonIds(organizationId: number, seasonId: number) {
  await sql`
    UPDATE matches
    SET season_id = ${seasonId}
    WHERE organization_id = ${organizationId} AND season_id IS NULL
  `;
}

export async function GET(req: NextRequest) {
  try {
    const { currentUser, error } = getCurrentUser(req);
    if (error) return error;

    const currentSeason = await ensureCurrentSeason(currentUser.organizationId);
    const resolvedCurrentSeasonId = Number(currentSeason.id);
    await backfillSeasonIds(currentUser.organizationId, resolvedCurrentSeasonId);

    const [players, matches] = await Promise.all([
      sql`
        SELECT * FROM players 
        WHERE organization_id = ${currentUser.organizationId}
        ORDER BY name ASC
      `,
      sql`
        SELECT * FROM matches 
        WHERE organization_id = ${currentUser.organizationId}
        ORDER BY created_at DESC
      `
    ]);

    const playerLookup = buildPlayerLookup(players);
    const transformedMatches = [];

    for (const match of matches) {
      const teamsResult = normalizeTeams(match.teams, playerLookup);
      const eloResult = normalizeEloChanges(match.elo_changes, playerLookup);
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

    const [seasons, tournaments] = await Promise.all([
      sql`
        SELECT * FROM seasons
        WHERE organization_id = ${currentUser.organizationId}
        ORDER BY start_date DESC
      `,
      sql`
        SELECT * FROM tournaments
        WHERE organization_id = ${currentUser.organizationId}
        ORDER BY created_at DESC
      `
    ]);

    const transformedSeasons = seasons.map(season => ({
      id: Number(season.id),
      name: season.name,
      startDate: season.start_date?.toISOString ? season.start_date.toISOString() : season.start_date,
      endDate: season.end_date?.toISOString ? season.end_date.toISOString() : season.end_date,
      organization_id: season.organization_id,
      isCurrent: season.is_current
    }));

    return jsonResponse({
      players,
      matches: transformedMatches,
      seasons: transformedSeasons,
      tournaments: tournaments.map(transformTournamentRow),
      currentSeasonId: Number.isFinite(resolvedCurrentSeasonId) ? resolvedCurrentSeasonId : null,
      lastSaved: new Date().toISOString()
    });
  } catch (error) {
    console.error('Sync error:', error);
    const message = error instanceof Error ? error.message : 'Sync operation failed';
    return jsonResponse({ error: 'Sync operation failed', details: message }, 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { currentUser, error } = getCurrentUser(req);
    if (error) return error;

    const {
      players: playersData,
      matches: matchesData,
      seasons: seasonsData,
      tournaments: tournamentsData,
      currentSeasonId
    } = await req.json();

    if (!playersData || !matchesData) {
      return jsonResponse({ error: 'Invalid data format' }, 400);
    }

    const currentSeason = await ensureCurrentSeason(currentUser.organizationId);
    const resolvedCurrentSeasonId = Number(currentSeason.id);
    const parsedSeasonId = Number(currentSeasonId);
    const effectiveSeasonId = Number.isFinite(parsedSeasonId) ? parsedSeasonId : resolvedCurrentSeasonId;

    if (Array.isArray(seasonsData) && seasonsData.length > 0) {
      for (const season of seasonsData) {
        await sql`
          INSERT INTO seasons (id, organization_id, name, start_date, end_date, is_current)
          VALUES (
            ${season.id},
            ${currentUser.organizationId},
            ${season.name},
            ${season.startDate || new Date().toISOString()},
            ${season.endDate || null},
            ${season.isCurrent || false}
          )
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            start_date = EXCLUDED.start_date,
            end_date = EXCLUDED.end_date,
            is_current = EXCLUDED.is_current
          WHERE seasons.organization_id = ${currentUser.organizationId}
        `;
      }
    }

    // Update the current-season flag only if the id actually belongs to this
    // organization (a stale payload from another org must not clear it)
    if (typeof effectiveSeasonId === 'number') {
      await sql`
        UPDATE seasons SET is_current = FALSE
        WHERE organization_id = ${currentUser.organizationId}
          AND is_current
          AND id <> ${effectiveSeasonId}
          AND EXISTS (
            SELECT 1 FROM seasons
            WHERE id = ${effectiveSeasonId} AND organization_id = ${currentUser.organizationId}
          )
      `;
      await sql`
        UPDATE seasons SET is_current = TRUE
        WHERE id = ${effectiveSeasonId} AND organization_id = ${currentUser.organizationId}
      `;
    }

    if (Array.isArray(tournamentsData)) {
      for (const tournament of tournamentsData) {
        const tournamentId = Number(tournament.id);
        const tournamentSeasonId = Number(tournament.season_id);
        if (!Number.isFinite(tournamentId)) continue;

        // Merge incoming slots with the stored ones instead of overwriting:
        // a stale client (backgrounded tab, outdated snapshot) must not be able
        // to null out match links or drop slots (e.g. swiss rounds) that were
        // recorded from other devices. Slots are only ever added and matchIds
        // only ever set/replaced by the app, so keeping existing non-null links
        // and existing extra slots never discards a legitimate change.
        let mergedSlots: Array<{ id: string; matchId?: number | null }> =
          Array.isArray(tournament.slots) ? tournament.slots : [];
        let mergedTeams: unknown[] = Array.isArray(tournament.teams) ? tournament.teams : [];
        const existingRows = await sql`
          SELECT slots, teams FROM tournaments
          WHERE id = ${tournamentId} AND organization_id = ${currentUser.organizationId}
        `;
        // Same staleness guard as for slots: a payload without teams (old
        // client build, outdated snapshot) must not wipe stored teams
        if (existingRows.length > 0
          && mergedTeams.length === 0
          && Array.isArray(existingRows[0].teams)
          && existingRows[0].teams.length > 0) {
          mergedTeams = existingRows[0].teams;
        }
        if (existingRows.length > 0 && Array.isArray(existingRows[0].slots)) {
          const existingSlots = existingRows[0].slots as Array<{ id: string; matchId?: number | null }>;
          const existingById = new Map(existingSlots.map(slot => [slot.id, slot]));
          mergedSlots = mergedSlots.map(slot => {
            const existing = existingById.get(slot.id);
            if ((slot.matchId === null || slot.matchId === undefined)
              && existing && existing.matchId !== null && existing.matchId !== undefined) {
              return { ...slot, matchId: existing.matchId };
            }
            return slot;
          });
          const incomingIds = new Set(mergedSlots.map(slot => slot.id));
          for (const existing of existingSlots) {
            if (!incomingIds.has(existing.id)) {
              mergedSlots.push(existing);
            }
          }
        }

        await sql`
          INSERT INTO tournaments (id, organization_id, season_id, name, format, seeding, participant_ids, config, teams, slots, created_by, created_at)
          VALUES (
            ${tournamentId},
            ${currentUser.organizationId},
            ${Number.isFinite(tournamentSeasonId) ? tournamentSeasonId : effectiveSeasonId},
            ${tournament.name},
            ${tournament.format},
            ${tournament.seeding},
            ${JSON.stringify(tournament.participantIds ?? [])},
            ${JSON.stringify(tournament.config ?? {})},
            ${JSON.stringify(mergedTeams)},
            ${JSON.stringify(mergedSlots)},
            ${tournament.createdBy || currentUser.userId},
            ${tournament.createdAt || new Date().toISOString()}
          )
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            format = EXCLUDED.format,
            seeding = EXCLUDED.seeding,
            participant_ids = EXCLUDED.participant_ids,
            config = EXCLUDED.config,
            teams = EXCLUDED.teams,
            slots = EXCLUDED.slots,
            season_id = EXCLUDED.season_id
          WHERE tournaments.organization_id = ${currentUser.organizationId}
        `;
      }
    }

    if (Array.isArray(playersData)) {
      for (const player of playersData) {
        await sql`
          INSERT INTO players (id, name, organization_id)
          VALUES (
            ${player.id},
            ${player.name},
            ${currentUser.organizationId}
          )
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name
          WHERE players.organization_id = ${currentUser.organizationId}
        `;
      }
    }

    const playerLookup = buildPlayerLookup(Array.isArray(playersData) ? playersData : []);

    if (Array.isArray(matchesData)) {
      for (const match of matchesData) {
        const parsedSeasonId = Number(match.season_id);
        const matchSeasonId = Number.isFinite(parsedSeasonId) ? parsedSeasonId : effectiveSeasonId;
        const teamsResult = normalizeTeams(match.teams, playerLookup);
        const scores = Array.isArray(match.scores) ? match.scores : [];
        const winnerIndex = resolveWinnerIndex(scores, match.winnerIndex ?? null);
        const rawEloChanges = match.eloChanges ?? match.elo_changes ?? {};
        const eloResult = normalizeEloChanges(rawEloChanges, playerLookup);

        await sql`
          INSERT INTO matches (id, date, time, teams, scores, winner_index, elo_changes, created_by, organization_id, season_id)
          VALUES (
            ${match.id},
            ${match.date},
            ${match.time},
            ${JSON.stringify(teamsResult.teams)},
            ${scores},
            ${winnerIndex},
            ${JSON.stringify(eloResult.eloChanges)},
            ${match.createdBy || currentUser.userId},
            ${currentUser.organizationId},
            ${matchSeasonId}
          )
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
    }

    return jsonResponse({ 
      success: true, 
      message: `Synced ${playersData.length} players and ${matchesData.length} matches` 
    });
  } catch (error) {
    console.error('Sync error:', error);
    const message = error instanceof Error ? error.message : 'Sync operation failed';
    return jsonResponse({ error: 'Sync operation failed', details: message }, 500);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { currentUser, error } = getCurrentUser(req);
    if (error) return error;

    await Promise.all([
      sql`DELETE FROM matches WHERE organization_id = ${currentUser.organizationId}`,
      sql`DELETE FROM players WHERE organization_id = ${currentUser.organizationId}`,
      sql`DELETE FROM tournaments WHERE organization_id = ${currentUser.organizationId}`
    ]);
    
    return jsonResponse({ success: true, message: 'All data cleared for your organization' });
  } catch (error) {
    console.error('Sync error:', error);
    const message = error instanceof Error ? error.message : 'Sync operation failed';
    return jsonResponse({ error: 'Sync operation failed', details: message }, 500);
  }
}
