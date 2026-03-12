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

export async function GET(req: NextRequest) {
  try {
    const { currentUser, error } = getCurrentUser(req);
    if (error) return error;

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

    const transformedMatches = matches.map(match => ({
      ...match,
      team1Score: match.team1_score,
      team2Score: match.team2_score,
      eloChanges: match.elo_changes,
      createdBy: match.created_by
    }));

    return jsonResponse({
      players,
      matches: transformedMatches,
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

    const { players: playersData, matches: matchesData } = await req.json();

    if (!playersData || !matchesData) {
      return jsonResponse({ error: 'Invalid data format' }, 400);
    }

    if (Array.isArray(playersData)) {
      for (const player of playersData) {
        await sql`
          INSERT INTO players (id, name, elo, matches, wins, losses, organization_id)
          VALUES (${player.id}, ${player.name}, ${player.elo}, ${player.matches}, ${player.wins}, ${player.losses}, ${currentUser.organizationId})
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            elo = EXCLUDED.elo,
            matches = EXCLUDED.matches,
            wins = EXCLUDED.wins,
            losses = EXCLUDED.losses
          WHERE players.organization_id = ${currentUser.organizationId}
        `;
      }
    }

    if (Array.isArray(matchesData)) {
      for (const match of matchesData) {
        await sql`
          INSERT INTO matches (id, date, time, team1, team2, winner, team1_score, team2_score, elo_changes, created_by, organization_id)
          VALUES (${match.id}, ${match.date}, ${match.time}, ${match.team1}, ${match.team2}, ${match.winner}, ${match.team1Score}, ${match.team2Score}, ${JSON.stringify(match.eloChanges)}, ${match.createdBy || currentUser.userId}, ${currentUser.organizationId})
          ON CONFLICT (id) DO UPDATE SET
            date = EXCLUDED.date,
            time = EXCLUDED.time,
            team1 = EXCLUDED.team1,
            team2 = EXCLUDED.team2,
            winner = EXCLUDED.winner,
            team1_score = EXCLUDED.team1_score,
            team2_score = EXCLUDED.team2_score,
            elo_changes = EXCLUDED.elo_changes,
            created_by = EXCLUDED.created_by
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
