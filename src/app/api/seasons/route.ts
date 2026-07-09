import { neon } from '@neondatabase/serverless';
import jwt from 'jsonwebtoken';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

const sql = neon(process.env.DATABASE_URL!);
const JWT_SECRET = process.env.JWT_SECRET || 'your-fallback-secret-key-change-in-production';

const corsHeaders = {
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PATCH,OPTIONS',
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
      seasons: transformedSeasons,
      currentSeasonId: Number.isFinite(resolvedCurrentSeasonId) ? resolvedCurrentSeasonId : null
    });
  } catch (error) {
    console.error('Seasons API error:', error);
    const message = error instanceof Error ? error.message : 'Failed to load seasons';
    return jsonResponse({ error: 'Failed to load seasons', message }, 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { currentUser, error } = getCurrentUser(req);
    if (error) return error;

    if (currentUser.role !== 'superuser') {
      return jsonResponse({ error: 'Only administrators can create seasons' }, 403);
    }

    await ensureSeasonsSchema();

    const body = await req.json().catch(() => ({}));
    const customName = typeof body?.name === 'string' ? body.name.trim() : '';

    const countRows = await sql`
      SELECT COUNT(*)::int AS count
      FROM seasons
      WHERE organization_id = ${currentUser.organizationId}
    `;
    const seasonNumber = (countRows[0]?.count ?? 0) + 1;
    const name = customName || `Season ${seasonNumber}`;
    const now = new Date().toISOString();

    await sql`
      UPDATE seasons
      SET is_current = FALSE,
          end_date = COALESCE(end_date, ${now})
      WHERE organization_id = ${currentUser.organizationId} AND is_current = TRUE
    `;

    const newId = Date.now();
    const created = await sql`
      INSERT INTO seasons (id, organization_id, name, start_date, end_date, is_current)
      VALUES (${newId}, ${currentUser.organizationId}, ${name}, ${now}, NULL, TRUE)
      RETURNING *
    `;

    const createdId = Number(created[0].id);
    return jsonResponse({
      success: true,
      season: {
        id: createdId,
        name: created[0].name,
        startDate: created[0].start_date?.toISOString ? created[0].start_date.toISOString() : created[0].start_date,
        endDate: created[0].end_date?.toISOString ? created[0].end_date.toISOString() : created[0].end_date,
        organization_id: created[0].organization_id,
        isCurrent: created[0].is_current
      },
      currentSeasonId: Number.isFinite(createdId) ? createdId : null
    });
  } catch (error) {
    console.error('Seasons API error:', error);
    const message = error instanceof Error ? error.message : 'Failed to create season';
    return jsonResponse({ error: 'Failed to create season', message }, 500);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { currentUser, error } = getCurrentUser(req);
    if (error) return error;

    if (currentUser.role !== 'superuser') {
      return jsonResponse({ error: 'Only administrators can update seasons' }, 403);
    }

    await ensureSeasonsSchema();

    const body = await req.json().catch(() => ({}));
    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    const seasonId = Number(body?.seasonId);

    if (!name) {
      return jsonResponse({ error: 'Season name is required' }, 400);
    }

    const currentSeason = await ensureCurrentSeason(currentUser.organizationId);
    const targetSeasonId = Number.isFinite(seasonId) ? seasonId : Number(currentSeason.id);

    const updated = await sql`
      UPDATE seasons
      SET name = ${name}
      WHERE id = ${targetSeasonId} AND organization_id = ${currentUser.organizationId}
      RETURNING *
    `;

    if (updated.length === 0) {
      return jsonResponse({ error: 'Season not found' }, 404);
    }

    const updatedId = Number(updated[0].id);
    return jsonResponse({
      success: true,
      season: {
        id: updatedId,
        name: updated[0].name,
        startDate: updated[0].start_date?.toISOString ? updated[0].start_date.toISOString() : updated[0].start_date,
        endDate: updated[0].end_date?.toISOString ? updated[0].end_date.toISOString() : updated[0].end_date,
        organization_id: updated[0].organization_id,
        isCurrent: updated[0].is_current
      }
    });
  } catch (error) {
    console.error('Seasons API error:', error);
    const message = error instanceof Error ? error.message : 'Failed to update season';
    return jsonResponse({ error: 'Failed to update season', message }, 500);
  }
}
