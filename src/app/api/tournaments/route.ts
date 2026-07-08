import { neon } from '@neondatabase/serverless';
import jwt from 'jsonwebtoken';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

const sql = neon(process.env.DATABASE_URL!);
const JWT_SECRET = process.env.JWT_SECRET || 'your-fallback-secret-key-change-in-production';

const corsHeaders = {
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'DELETE,OPTIONS',
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

export async function DELETE(req: NextRequest) {
  try {
    const { currentUser, error } = getCurrentUser(req);
    if (error) return error;

    const { tournamentId } = await req.json().catch(() => ({}));
    const parsedId = Number(tournamentId);

    if (!Number.isFinite(parsedId)) {
      return jsonResponse({ error: 'Invalid tournament id' }, 400);
    }

    const rows = await sql`
      SELECT created_by FROM tournaments
      WHERE id = ${parsedId} AND organization_id = ${currentUser.organizationId}
      LIMIT 1
    `;

    if (rows.length === 0) {
      return jsonResponse({ error: 'Tournament not found' }, 404);
    }

    const canDelete = currentUser.role === 'superuser' || rows[0].created_by === currentUser.userId;
    if (!canDelete) {
      return jsonResponse({ error: 'You can only delete tournaments you created' }, 403);
    }

    await sql`
      DELETE FROM tournaments
      WHERE id = ${parsedId} AND organization_id = ${currentUser.organizationId}
    `;

    return jsonResponse({ success: true, message: 'Tournament deleted successfully' });
  } catch (error) {
    console.error('Tournament delete error:', error);
    return jsonResponse({ error: 'Database operation failed' }, 500);
  }
}
