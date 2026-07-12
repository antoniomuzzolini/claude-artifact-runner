import { neon } from '@neondatabase/serverless';
import jwt from 'jsonwebtoken';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

const sql = neon(process.env.DATABASE_URL!);
const JWT_SECRET = process.env.JWT_SECRET || 'your-fallback-secret-key-change-in-production';

const corsHeaders = {
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST,DELETE,OPTIONS',
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

// Short public share codes: no ambiguous characters (0/O, 1/l/I) since they
// may be typed by hand on a TV remote
const SHARE_CODE_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';
const generateShareCode = () =>
  Array.from({ length: 6 }, () =>
    SHARE_CODE_ALPHABET[Math.floor(Math.random() * SHARE_CODE_ALPHABET.length)]
  ).join('');

// Create (or return) the tournament's public share code for /t/<code>
export async function POST(req: NextRequest) {
  try {
    const { currentUser, error } = getCurrentUser(req);
    if (error) return error;
    if (currentUser.role !== 'superuser') {
      return jsonResponse({ error: 'Only administrators can create public links' }, 403);
    }

    const { tournamentId } = await req.json().catch(() => ({}));
    const parsedId = Number(tournamentId);
    if (!Number.isFinite(parsedId)) {
      return jsonResponse({ error: 'Invalid tournament id' }, 400);
    }

    await sql`ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS share_code VARCHAR(16);`;
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS tournaments_share_code_unique ON tournaments (share_code);`;

    const rows = await sql`
      SELECT share_code FROM tournaments
      WHERE id = ${parsedId} AND organization_id = ${currentUser.organizationId}
      LIMIT 1
    `;
    if (rows.length === 0) {
      return jsonResponse({ error: 'Tournament not found' }, 404);
    }
    if (rows[0].share_code) {
      return jsonResponse({ shareCode: rows[0].share_code });
    }

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const code = generateShareCode();
      try {
        const updated = await sql`
          UPDATE tournaments SET share_code = ${code}
          WHERE id = ${parsedId} AND organization_id = ${currentUser.organizationId}
            AND share_code IS NULL
          RETURNING share_code
        `;
        if (updated.length > 0) {
          return jsonResponse({ shareCode: updated[0].share_code });
        }
        // Another request set it concurrently: return the stored one
        const existing = await sql`
          SELECT share_code FROM tournaments
          WHERE id = ${parsedId} AND organization_id = ${currentUser.organizationId}
          LIMIT 1
        `;
        return jsonResponse({ shareCode: existing[0]?.share_code ?? null });
      } catch {
        // Unique-index collision with another tournament's code: retry
      }
    }
    return jsonResponse({ error: 'Could not generate a link, please retry' }, 500);
  } catch (error) {
    console.error('Tournament share error:', error);
    return jsonResponse({ error: 'Database operation failed' }, 500);
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
