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

export async function GET(req: NextRequest) {
  try {
    const { currentUser, error } = getCurrentUser(req);
    if (error) return error;

    const players = await sql`
      SELECT * FROM players 
      WHERE organization_id = ${currentUser.organizationId}
      ORDER BY elo DESC
    `;
    return jsonResponse(players);
  } catch (error) {
    console.error('Database error:', error);
    return jsonResponse({ error: 'Database operation failed' }, 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { currentUser, error } = getCurrentUser(req);
    if (error) return error;

    const { players: playersData } = await req.json();

    if (!playersData || !Array.isArray(playersData)) {
      return jsonResponse({ error: 'Invalid players data' }, 400);
    }

    for (const player of playersData) {
      await sql`
        INSERT INTO players (id, name, elo, matches, wins, losses, organization_id, season_id)
        VALUES (${player.id}, ${player.name}, ${player.elo}, ${player.matches}, ${player.wins}, ${player.losses}, ${currentUser.organizationId}, ${player.season_id || null})
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

    return jsonResponse({ success: true, message: 'Players synced successfully' });
  } catch (error) {
    console.error('Database error:', error);
    return jsonResponse({ error: 'Database operation failed' }, 500);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { currentUser, error } = getCurrentUser(req);
    if (error) return error;

    await sql`
      DELETE FROM players 
      WHERE organization_id = ${currentUser.organizationId}
    `;
    return jsonResponse({ success: true, message: 'All players deleted' });
  } catch (error) {
    console.error('Database error:', error);
    return jsonResponse({ error: 'Database operation failed' }, 500);
  }
}
