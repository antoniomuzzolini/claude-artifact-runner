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

export async function GET(req: NextRequest) {
  try {
    const { currentUser, error } = getCurrentUser(req);
    if (error) return error;

    const matches = await sql`
      SELECT * FROM matches 
      WHERE organization_id = ${currentUser.organizationId}
      ORDER BY created_at DESC
    `;
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

    for (const match of matchesData) {
      const teams = Array.isArray(match.teams) ? match.teams : [];
      const scores = Array.isArray(match.scores) ? match.scores : [];
      const winnerIndex = resolveWinnerIndex(scores, match.winnerIndex ?? null);

      await sql`
        INSERT INTO matches (id, date, time, teams, scores, winner_index, elo_changes, created_by, organization_id, season_id)
        VALUES (${match.id}, ${match.date}, ${match.time}, ${JSON.stringify(teams)}, ${scores}, ${winnerIndex}, ${JSON.stringify(match.eloChanges)}, ${match.createdBy || currentUser.userId}, ${currentUser.organizationId}, ${match.season_id || null})
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
