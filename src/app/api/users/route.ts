import { neon } from '@neondatabase/serverless';
import jwt from 'jsonwebtoken';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

const sql = neon(process.env.DATABASE_URL!);
const JWT_SECRET = process.env.JWT_SECRET || 'your-fallback-secret-key-change-in-production';

const corsHeaders = {
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function jsonResponse(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: corsHeaders });
}

export function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders });
}

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return jsonResponse({ error: 'Authentication required' }, 401);
    }

    const token = authHeader.substring(7);
    let currentUser;
    
    try {
      currentUser = jwt.verify(token, JWT_SECRET) as any;
    } catch (error) {
      return jsonResponse({ error: 'Invalid token' }, 401);
    }

    if (currentUser.role !== 'superuser') {
      return jsonResponse({ error: 'Only administrators can manage users' }, 403);
    }

    if (!currentUser.organizationId) {
      return jsonResponse({ error: 'User must belong to an organization' }, 403);
    }

    const users = await sql`
      SELECT id, email, username, role, status, created_at, last_login, created_by, invitation_token, organization_id
      FROM users 
      WHERE organization_id = ${currentUser.organizationId}
      ORDER BY created_at DESC;
    `;

    return jsonResponse({
      success: true,
      users: users
    });
  } catch (error) {
    console.error('Users API error:', error);
    const message = error instanceof Error ? error.message : 'User operation failed';
    return jsonResponse({ error: 'User operation failed', message }, 500);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return jsonResponse({ error: 'Authentication required' }, 401);
    }

    const token = authHeader.substring(7);
    let currentUser;
    
    try {
      currentUser = jwt.verify(token, JWT_SECRET) as any;
    } catch (error) {
      return jsonResponse({ error: 'Invalid token' }, 401);
    }

    if (currentUser.role !== 'superuser') {
      return jsonResponse({ error: 'Only administrators can manage users' }, 403);
    }

    if (!currentUser.organizationId) {
      return jsonResponse({ error: 'User must belong to an organization' }, 403);
    }

    const { userId } = await req.json();

    if (!userId) {
      return jsonResponse({ error: 'User ID is required' }, 400);
    }

    const targetUsers = await sql`
      SELECT id, email, username, role, organization_id
      FROM users 
      WHERE id = ${userId} AND organization_id = ${currentUser.organizationId}
      LIMIT 1;
    `;

    if (targetUsers.length === 0) {
      return jsonResponse({ error: 'User not found in your organization' }, 404);
    }

    const targetUser = targetUsers[0];

    if (targetUser.id === currentUser.userId) {
      return jsonResponse({ error: 'Cannot delete your own account' }, 400);
    }

    await sql`
      DELETE FROM users 
      WHERE id = ${userId} AND organization_id = ${currentUser.organizationId};
    `;

    return jsonResponse({
      success: true,
      message: `User ${targetUser.username} deleted successfully`
    });
  } catch (error) {
    console.error('Users API error:', error);
    const message = error instanceof Error ? error.message : 'User operation failed';
    return jsonResponse({ error: 'User operation failed', message }, 500);
  }
}
