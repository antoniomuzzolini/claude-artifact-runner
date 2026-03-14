import { neon } from '@neondatabase/serverless';
import jwt from 'jsonwebtoken';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

const sql = neon(process.env.DATABASE_URL!);
const JWT_SECRET = process.env.JWT_SECRET || 'your-fallback-secret-key-change-in-production';
const DEFAULT_MIN_MATCHES = 10;
const DEFAULT_ELO_K_FACTOR = 32;

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
      elo_k_factor INTEGER DEFAULT 32,
      updated_at TIMESTAMP DEFAULT NOW()
    );
  `;
  await sql`
    ALTER TABLE organization_settings
    ADD COLUMN IF NOT EXISTS elo_k_factor INTEGER DEFAULT 32;
  `;
}

export async function GET(req: NextRequest) {
  try {
    const { currentUser, error } = getCurrentUser(req);
    if (error) return error;

    await ensureSettingsTable();

    const rows = await sql`
      SELECT min_matches_for_ranking, elo_k_factor
      FROM organization_settings
      WHERE organization_id = ${currentUser.organizationId}
      LIMIT 1;
    `;

    if (rows.length === 0) {
      await sql`
        INSERT INTO organization_settings (organization_id, min_matches_for_ranking, elo_k_factor)
        VALUES (${currentUser.organizationId}, ${DEFAULT_MIN_MATCHES}, ${DEFAULT_ELO_K_FACTOR});
      `;

      return jsonResponse({
        success: true,
        minMatchesForRanking: DEFAULT_MIN_MATCHES,
        eloKFactor: DEFAULT_ELO_K_FACTOR
      });
    }

    return jsonResponse({
      success: true,
      minMatchesForRanking: rows[0].min_matches_for_ranking ?? DEFAULT_MIN_MATCHES,
      eloKFactor: rows[0].elo_k_factor ?? DEFAULT_ELO_K_FACTOR
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
    const rawMinMatches = body?.minMatchesForRanking;
    const rawEloKFactor = body?.eloKFactor;
    const hasMinMatches = rawMinMatches !== undefined;
    const hasEloKFactor = rawEloKFactor !== undefined;

    if (!hasMinMatches && !hasEloKFactor) {
      return jsonResponse({ error: 'No settings provided' }, 400);
    }

    const minMatchesValue = hasMinMatches
      ? Number.parseInt(String(rawMinMatches), 10)
      : null;
    const eloKFactorValue = hasEloKFactor
      ? Number.parseInt(String(rawEloKFactor), 10)
      : null;

    if (hasMinMatches && (Number.isNaN(minMatchesValue) || minMatchesValue < 0 || minMatchesValue > 1000)) {
      return jsonResponse({ error: 'minMatchesForRanking must be a number between 0 and 1000' }, 400);
    }
    if (hasEloKFactor && (Number.isNaN(eloKFactorValue) || eloKFactorValue < 1 || eloKFactorValue > 100)) {
      return jsonResponse({ error: 'eloKFactor must be a number between 1 and 100' }, 400);
    }

    const result = await sql`
      INSERT INTO organization_settings (organization_id, min_matches_for_ranking, elo_k_factor, updated_at)
      VALUES (
        ${currentUser.organizationId},
        ${hasMinMatches ? minMatchesValue : DEFAULT_MIN_MATCHES},
        ${hasEloKFactor ? eloKFactorValue : DEFAULT_ELO_K_FACTOR},
        NOW()
      )
      ON CONFLICT (organization_id) DO UPDATE SET
        min_matches_for_ranking = COALESCE(${minMatchesValue}, organization_settings.min_matches_for_ranking),
        elo_k_factor = COALESCE(${eloKFactorValue}, organization_settings.elo_k_factor),
        updated_at = NOW()
      RETURNING min_matches_for_ranking, elo_k_factor;
    `;

    return jsonResponse({
      success: true,
      minMatchesForRanking: result[0]?.min_matches_for_ranking ?? minMatchesValue ?? DEFAULT_MIN_MATCHES,
      eloKFactor: result[0]?.elo_k_factor ?? eloKFactorValue ?? DEFAULT_ELO_K_FACTOR
    });
  } catch (error) {
    console.error('Settings API error:', error);
    const message = error instanceof Error ? error.message : 'Failed to update settings';
    return jsonResponse({ error: 'Failed to update settings', message }, 500);
  }
}
