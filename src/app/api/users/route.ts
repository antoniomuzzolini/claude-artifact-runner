import { neon } from '@neondatabase/serverless';
import jwt from 'jsonwebtoken';
import { NextRequest, NextResponse } from 'next/server';
import { ensureMembershipSchema } from '../../../lib/organizationMembers';

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

    await ensureMembershipSchema();

    // Members of this organization, with their role in it (users may belong
    // to several organizations)
    const users = await sql`
      SELECT u.id, u.email, u.username, m.role, u.status, u.created_at, u.last_login,
             u.created_by, u.invitation_token, ${currentUser.organizationId}::integer AS organization_id
      FROM users u
      JOIN organization_members m ON m.user_id = u.id
      WHERE m.organization_id = ${currentUser.organizationId}
      ORDER BY u.created_at DESC;
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

    await ensureMembershipSchema();

    const targetMemberships = await sql`
      SELECT m.user_id, u.username
      FROM organization_members m
      JOIN users u ON u.id = m.user_id
      WHERE m.user_id = ${userId} AND m.organization_id = ${currentUser.organizationId}
      LIMIT 1;
    `;

    if (targetMemberships.length === 0) {
      return jsonResponse({ error: 'User not found in your organization' }, 404);
    }

    const targetUser = targetMemberships[0];

    if (Number(targetUser.user_id) === Number(currentUser.userId)) {
      return jsonResponse({ error: 'Cannot delete your own account' }, 400);
    }

    // Remove the user from this organization; delete the account only if they
    // belong to no other organization
    await sql`
      DELETE FROM organization_members
      WHERE user_id = ${userId} AND organization_id = ${currentUser.organizationId};
    `;

    const remaining = await sql`
      SELECT organization_id FROM organization_members
      WHERE user_id = ${userId}
      LIMIT 1;
    `;

    if (remaining.length === 0) {
      await sql`DELETE FROM users WHERE id = ${userId};`;
      return jsonResponse({
        success: true,
        message: `User ${targetUser.username} deleted successfully`
      });
    }

    // Repoint their last-used organization if it was this one
    await sql`
      UPDATE users
      SET organization_id = ${remaining[0].organization_id}
      WHERE id = ${userId} AND organization_id = ${currentUser.organizationId};
    `;

    return jsonResponse({
      success: true,
      message: `User ${targetUser.username} removed from your organization`
    });
  } catch (error) {
    console.error('Users API error:', error);
    const message = error instanceof Error ? error.message : 'User operation failed';
    return jsonResponse({ error: 'User operation failed', message }, 500);
  }
}
