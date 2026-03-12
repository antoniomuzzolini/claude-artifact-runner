import { neon } from '@neondatabase/serverless';
import jwt from 'jsonwebtoken';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

const sql = neon(process.env.DATABASE_URL!);
const JWT_SECRET = process.env.JWT_SECRET || 'your-fallback-secret-key-change-in-production';
const DEFAULT_MIN_MATCHES = 10;

const corsHeaders = {
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
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

async function ensureSettingsTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS organization_settings (
      organization_id INTEGER PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
      min_matches_for_ranking INTEGER DEFAULT 10,
      updated_at TIMESTAMP DEFAULT NOW()
    );
  `;
}

export async function GET(req: NextRequest) {
  try {
    const { currentUser, error } = getCurrentUser(req);
    if (error) return error;

    await ensureSettingsTable();

    const rows = await sql`
      SELECT min_matches_for_ranking
      FROM organization_settings
      WHERE organization_id = ${currentUser.organizationId}
      LIMIT 1;
    `;

    if (rows.length === 0) {
      await sql`
        INSERT INTO organization_settings (organization_id, min_matches_for_ranking)
        VALUES (${currentUser.organizationId}, ${DEFAULT_MIN_MATCHES});
      `;

      return jsonResponse({
        success: true,
        minMatchesForRanking: DEFAULT_MIN_MATCHES
      });
    }

    return jsonResponse({
      success: true,
      minMatchesForRanking: rows[0].min_matches_for_ranking ?? DEFAULT_MIN_MATCHES
    });
  } catch (error) {
    console.error('Settings API error:', error);
    const message = error instanceof Error ? error.message : 'Failed to load settings';
    return jsonResponse({ error: 'Failed to load settings', message }, 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { currentUser, error } = getCurrentUser(req);
    if (error) return error;

    await ensureSettingsTable();

    const body = await req.json().catch(() => ({}));
    const rawValue = body?.minMatchesForRanking;
    const value = Number.parseInt(String(rawValue), 10);

    if (Number.isNaN(value) || value < 0 || value > 1000) {
      return jsonResponse({ error: 'minMatchesForRanking must be a number between 0 and 1000' }, 400);
    }

    const result = await sql`
      INSERT INTO organization_settings (organization_id, min_matches_for_ranking, updated_at)
      VALUES (${currentUser.organizationId}, ${value}, NOW())
      ON CONFLICT (organization_id) DO UPDATE SET
        min_matches_for_ranking = EXCLUDED.min_matches_for_ranking,
        updated_at = NOW()
      RETURNING min_matches_for_ranking;
    `;

    return jsonResponse({
      success: true,
      minMatchesForRanking: result[0]?.min_matches_for_ranking ?? value
    });
  } catch (error) {
    console.error('Settings API error:', error);
    const message = error instanceof Error ? error.message : 'Failed to update settings';
    return jsonResponse({ error: 'Failed to update settings', message }, 500);
  }
}
