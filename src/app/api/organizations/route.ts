import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

const sql = neon(process.env.DATABASE_URL!);
const JWT_SECRET = process.env.JWT_SECRET || 'your-fallback-secret-key-change-in-production';

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

    let organizations;
    if (currentUser.role === 'superuser' && !currentUser.organizationId) {
      organizations = await sql`
        SELECT id, name, domain, created_at, created_by
        FROM organizations 
        ORDER BY created_at DESC;
      `;
    } else {
      organizations = await sql`
        SELECT id, name, domain, created_at, created_by
        FROM organizations 
        WHERE id = ${currentUser.organizationId}
        LIMIT 1;
      `;
    }

    return jsonResponse({
      success: true,
      organizations
    });
  } catch (error) {
    console.error('Organizations API error:', error);
    const message = error instanceof Error ? error.message : 'Organization operation failed';
    return jsonResponse({ error: 'Organization operation failed', message }, 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { action, organizationName, organizationDomain, adminEmail, adminUsername, adminPassword } = await req.json();

    if (action === 'register') {
      return await handleOrganizationRegistration(
        organizationName,
        organizationDomain,
        adminEmail,
        adminUsername,
        adminPassword
      );
    }

    return jsonResponse({ error: 'Invalid action' }, 400);
  } catch (error) {
    console.error('Organizations API error:', error);
    const message = error instanceof Error ? error.message : 'Organization operation failed';
    return jsonResponse({ error: 'Organization operation failed', message }, 500);
  }
}

async function handleOrganizationRegistration(
  organizationName: string,
  organizationDomain: string | undefined,
  adminEmail: string,
  adminUsername: string,
  adminPassword: string
) {
  if (!organizationName || !adminEmail || !adminUsername || !adminPassword) {
    return jsonResponse({
      error: 'Organization name, admin email, username, and password are required'
    }, 400);
  }

  if (adminPassword.length < 6) {
    return jsonResponse({ error: 'Password must be at least 6 characters long' }, 400);
  }

  const existingOrg = await sql`
    SELECT id FROM organizations 
    WHERE LOWER(name) = LOWER(${organizationName})
    LIMIT 1;
  `;

  if (existingOrg.length > 0) {
    return jsonResponse({ error: 'Organization name already exists' }, 400);
  }

  const existingUser = await sql`
    SELECT id FROM users 
    WHERE email = ${adminEmail}
    LIMIT 1;
  `;

  if (existingUser.length > 0) {
    return jsonResponse({ error: 'User with this email already exists' }, 400);
  }

  const existingUsername = await sql`
    SELECT id FROM users 
    WHERE username = ${adminUsername}
    LIMIT 1;
  `;

  if (existingUsername.length > 0) {
    return jsonResponse({ error: 'Username already taken' }, 400);
  }

  try {
    const newOrganizations = await sql`
      INSERT INTO organizations (name, domain, created_at)
      VALUES (${organizationName}, ${organizationDomain || null}, NOW())
      RETURNING id, name, domain, created_at;
    `;

    const organization = newOrganizations[0];

    const hashedPassword = await bcrypt.hash(adminPassword, 12);

    const newUsers = await sql`
      INSERT INTO users (email, username, password_hash, role, status, organization_id, created_at)
      VALUES (${adminEmail}, ${adminUsername}, ${hashedPassword}, 'superuser', 'active', ${organization.id}, NOW())
      RETURNING id, email, username, role, organization_id, created_at;
    `;

    const user = newUsers[0];

    await sql`
      UPDATE organizations 
      SET created_by = ${user.id}
      WHERE id = ${organization.id};
    `;

    await sql`
      INSERT INTO organization_settings (organization_id, min_matches_for_ranking, elo_k_factor, ranking_mode)
      VALUES (${organization.id}, 10, 32, 'elo')
      ON CONFLICT (organization_id) DO NOTHING;
    `;

    const token = jwt.sign(
      { 
        userId: user.id, 
        email: user.email, 
        role: user.role,
        organizationId: organization.id
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return jsonResponse({
      success: true,
      user: user,
      organization: { ...organization, created_by: user.id },
      token,
      message: 'Organization and admin account created successfully'
    }, 201);

  } catch (error) {
    console.error('Organization registration error:', error);
    const message = error instanceof Error ? error.message : 'Failed to create organization';
    return jsonResponse({ error: 'Failed to create organization', message }, 500);
  }
}
