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

  await sql`ALTER TABLE players ADD COLUMN IF NOT EXISTS season_id BIGINT;`;
  await sql`ALTER TABLE matches ADD COLUMN IF NOT EXISTS season_id BIGINT;`;
  await sql`ALTER TABLE matches ADD COLUMN IF NOT EXISTS teams JSONB;`;
  await sql`ALTER TABLE matches ADD COLUMN IF NOT EXISTS scores INTEGER[];`;
  await sql`ALTER TABLE matches ADD COLUMN IF NOT EXISTS winner_index INTEGER;`;
}

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
  const created = await sql`
    INSERT INTO seasons (id, organization_id, name, start_date, is_current)
    VALUES (${newId}, ${organizationId}, ${'Season 1'}, ${now}, TRUE)
    RETURNING *
  `;

  return created[0];
}

async function backfillSeasonIds(organizationId: number, seasonId: number) {
  await Promise.all([
    sql`
      UPDATE players
      SET season_id = ${seasonId}
      WHERE organization_id = ${organizationId} AND season_id IS NULL
    `,
    sql`
      UPDATE matches
      SET season_id = ${seasonId}
      WHERE organization_id = ${organizationId} AND season_id IS NULL
    `
  ]);
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
        ORDER BY elo DESC
      `,
      sql`
        SELECT * FROM matches 
        WHERE organization_id = ${currentUser.organizationId}
        ORDER BY created_at DESC
      `
    ]);

    const transformedMatches = matches.map(match => {
      const teams = Array.isArray(match.teams) ? match.teams : [];
      const scores = Array.isArray(match.scores) ? match.scores : [];
      const winnerIndex = resolveWinnerIndex(scores, match.winner_index);
      return {
        ...match,
        teams,
        scores,
        winnerIndex,
        eloChanges: match.elo_changes,
        createdBy: match.created_by
      };
    });

    const seasons = await sql`
      SELECT * FROM seasons
      WHERE organization_id = ${currentUser.organizationId}
      ORDER BY start_date DESC
    `;

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

    const { players: playersData, matches: matchesData, seasons: seasonsData, currentSeasonId } = await req.json();

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

    if (typeof effectiveSeasonId === 'number') {
      await sql`
        UPDATE seasons
        SET is_current = (id = ${effectiveSeasonId})
        WHERE organization_id = ${currentUser.organizationId}
      `;
    }

    if (Array.isArray(playersData)) {
      for (const player of playersData) {
        await sql`
          INSERT INTO players (id, name, elo, matches, wins, losses, organization_id, season_id)
          VALUES (
            ${player.id},
            ${player.name},
            ${player.elo},
            ${player.matches},
            ${player.wins},
            ${player.losses},
            ${currentUser.organizationId},
            ${player.season_id || effectiveSeasonId}
          )
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            elo = EXCLUDED.elo,
            matches = EXCLUDED.matches,
            wins = EXCLUDED.wins,
            losses = EXCLUDED.losses,
            season_id = EXCLUDED.season_id
          WHERE players.organization_id = ${currentUser.organizationId}
        `;
      }
    }

    if (Array.isArray(matchesData)) {
      for (const match of matchesData) {
        const teams = Array.isArray(match.teams) ? match.teams : [];
        const scores = Array.isArray(match.scores) ? match.scores : [];
        const winnerIndex = resolveWinnerIndex(scores, match.winnerIndex ?? null);

        await sql`
          INSERT INTO matches (id, date, time, teams, scores, winner_index, elo_changes, created_by, organization_id, season_id)
          VALUES (
            ${match.id},
            ${match.date},
            ${match.time},
            ${JSON.stringify(teams)},
            ${scores},
            ${winnerIndex},
            ${JSON.stringify(match.eloChanges)},
            ${match.createdBy || currentUser.userId},
            ${currentUser.organizationId},
            ${match.season_id || effectiveSeasonId}
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
      sql`DELETE FROM players WHERE organization_id = ${currentUser.organizationId}`
    ]);
    
    return jsonResponse({ success: true, message: 'All data cleared for your organization' });
  } catch (error) {
    console.error('Sync error:', error);
    const message = error instanceof Error ? error.message : 'Sync operation failed';
    return jsonResponse({ error: 'Sync operation failed', details: message }, 500);
  }
}
