import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { NextRequest, NextResponse } from 'next/server';
import { ensureMembershipSchema, getMemberships } from '../../../lib/organizationMembers';

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

    await ensureMembershipSchema();
    const organizations = await sql`
      SELECT o.id, o.name, o.domain, o.created_at, o.created_by, m.role
      FROM organizations o
      JOIN organization_members m ON m.organization_id = o.id
      WHERE m.user_id = ${currentUser.userId}
      ORDER BY o.name ASC;
    `;

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

    if (action === 'create') {
      return await handleOrganizationCreate(organizationName, organizationDomain, req);
    }

    return jsonResponse({ error: 'Invalid action' }, 400);
  } catch (error) {
    console.error('Organizations API error:', error);
    const message = error instanceof Error ? error.message : 'Organization operation failed';
    return jsonResponse({ error: 'Organization operation failed', message }, 500);
  }
}

// Create an additional organization for an already logged-in user: they become
// its superuser via a membership and the session switches to the new org.
async function handleOrganizationCreate(
  organizationName: string,
  organizationDomain: string | undefined,
  req: NextRequest
) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return jsonResponse({ error: 'Authentication required' }, 401);
  }

  let decoded;
  try {
    decoded = jwt.verify(authHeader.substring(7), JWT_SECRET) as any;
  } catch (error) {
    return jsonResponse({ error: 'Invalid token' }, 401);
  }

  if (!organizationName?.trim()) {
    return jsonResponse({ error: 'Organization name is required' }, 400);
  }

  const existingOrg = await sql`
    SELECT id FROM organizations
    WHERE LOWER(name) = LOWER(${organizationName.trim()})
    LIMIT 1;
  `;
  if (existingOrg.length > 0) {
    return jsonResponse({ error: 'Organization name already exists' }, 400);
  }

  const users = await sql`
    SELECT id, email, username, role, status, created_at, last_login, organization_id
    FROM users
    WHERE id = ${decoded.userId}
    LIMIT 1;
  `;
  if (users.length === 0 || users[0].status !== 'active') {
    return jsonResponse({ error: 'Account not active' }, 401);
  }
  const user = users[0];

  await ensureMembershipSchema();

  const newOrganizations = await sql`
    INSERT INTO organizations (name, domain, created_at, created_by)
    VALUES (${organizationName.trim()}, ${organizationDomain || null}, NOW(), ${user.id})
    RETURNING id, name, domain, created_at, created_by;
  `;
  const organization = newOrganizations[0];

  await sql`
    INSERT INTO organization_members (user_id, organization_id, role)
    VALUES (${user.id}, ${organization.id}, 'superuser')
    ON CONFLICT (user_id, organization_id) DO UPDATE SET role = 'superuser';
  `;

  await sql`
    INSERT INTO organization_settings (organization_id, min_matches_for_ranking, elo_k_factor, ranking_mode)
    VALUES (${organization.id}, 10, 32, 'elo')
    ON CONFLICT (organization_id) DO NOTHING;
  `;

  // Switch the session to the new organization
  await sql`
    UPDATE users SET organization_id = ${organization.id} WHERE id = ${user.id};
  `;

  const memberships = await getMemberships(user.id);
  const token = jwt.sign(
    { userId: user.id, email: user.email, role: 'superuser', organizationId: organization.id },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  return jsonResponse({
    success: true,
    user: { ...user, role: 'superuser', organization_id: organization.id },
    organization,
    memberships,
    token,
    message: 'Organization created'
  }, 201);
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

    await ensureMembershipSchema();
    await sql`
      INSERT INTO organization_members (user_id, organization_id, role)
      VALUES (${user.id}, ${organization.id}, 'superuser')
      ON CONFLICT (user_id, organization_id) DO NOTHING;
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
      memberships: [{
        organization_id: organization.id,
        role: 'superuser',
        name: organization.name,
        domain: organization.domain
      }],
      token,
      message: 'Organization and admin account created successfully'
    }, 201);

  } catch (error) {
    console.error('Organization registration error:', error);
    const message = error instanceof Error ? error.message : 'Failed to create organization';
    return jsonResponse({ error: 'Failed to create organization', message }, 500);
  }
}
