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

function signSessionToken(userId: number, email: string, role: string, organizationId: number | null) {
  return jwt.sign(
    { userId, email, role, organizationId },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return jsonResponse({ error: 'No token provided' }, 401);
    }

    const token = authHeader.substring(7);
    return await handleVerifyToken(token);
  } catch (error) {
    console.error('Auth error:', error);
    const message = error instanceof Error ? error.message : 'Authentication failed';
    return jsonResponse({ error: 'Authentication failed', message }, 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { action, email, password, username, token, organizationId } = await req.json();

    switch (action) {
      case 'login':
        return await handleLogin(email, password);
      case 'register':
        return await handleRegister(email, username, password, req);
      case 'verify':
        return await handleVerifyToken(token);
      case 'switch-organization':
        return await handleSwitchOrganization(organizationId, req);
      case 'invite':
        return await handleInviteUser(email, req);
      case 'complete-invitation':
        return await handleCompleteInvitation(token, username, password);
      case 'verify-invitation':
        return await handleVerifyInvitation(token);
      default:
        return jsonResponse({ error: 'Invalid action' }, 400);
    }
  } catch (error) {
    console.error('Auth error:', error);
    const message = error instanceof Error ? error.message : 'Authentication failed';
    return jsonResponse({ error: 'Authentication failed', message }, 500);
  }
}

async function handleLogin(email: string, password: string) {
  if (!email || !password) {
    return jsonResponse({ error: 'Email and password are required' }, 400);
  }

  const users = await sql`
    SELECT id, email, username, password_hash, role, status, created_at, last_login, organization_id
    FROM users 
    WHERE email = ${email}
    LIMIT 1;
  `;

  if (users.length === 0) {
    return jsonResponse({ error: 'Invalid email or password' }, 401);
  }

  const user = users[0];

  if (user.status !== 'active') {
    return jsonResponse({ error: 'Account not active or pending setup' }, 401);
  }

  const isValidPassword = await bcrypt.compare(password, user.password_hash);
  if (!isValidPassword) {
    return jsonResponse({ error: 'Invalid email or password' }, 401);
  }

  await ensureMembershipSchema();
  const memberships = await getMemberships(user.id);

  // Active organization: last used (users.organization_id) if still a member,
  // otherwise the first membership; role comes from the membership
  const lastUsedId = Number(user.organization_id);
  const activeMembership = memberships.find(m => m.organization_id === lastUsedId)
    ?? memberships[0]
    ?? null;
  const activeOrganizationId = activeMembership?.organization_id ?? null;
  const activeRole = activeMembership?.role ?? user.role;

  let organization = null;
  if (activeOrganizationId) {
    const orgs = await sql`
      SELECT id, name, domain, created_at, created_by
      FROM organizations
      WHERE id = ${activeOrganizationId}
      LIMIT 1;
    `;
    organization = orgs[0] || null;
  }

  await sql`
    UPDATE users
    SET last_login = NOW(), organization_id = ${activeOrganizationId}
    WHERE id = ${user.id};
  `;

  const token = signSessionToken(user.id, user.email, activeRole, activeOrganizationId);

  const { password_hash, ...userWithoutPassword } = user;

  return jsonResponse({
    success: true,
    user: { ...userWithoutPassword, role: activeRole, organization_id: activeOrganizationId },
    organization: organization,
    memberships,
    token,
    message: 'Login successful'
  });
}

// Re-issue the session token scoped to another organization the user belongs to
async function handleSwitchOrganization(organizationId: unknown, req: NextRequest) {
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

  const targetOrgId = Number(organizationId);
  if (!Number.isFinite(targetOrgId)) {
    return jsonResponse({ error: 'Invalid organization id' }, 400);
  }

  await ensureMembershipSchema();
  const memberships = await getMemberships(decoded.userId);
  const membership = memberships.find(m => m.organization_id === targetOrgId);

  if (!membership) {
    return jsonResponse({ error: 'You are not a member of this organization' }, 403);
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

  const orgs = await sql`
    SELECT id, name, domain, created_at, created_by
    FROM organizations
    WHERE id = ${targetOrgId}
    LIMIT 1;
  `;

  // Remember the last used organization for the next login
  await sql`
    UPDATE users SET organization_id = ${targetOrgId} WHERE id = ${user.id};
  `;

  const token = signSessionToken(user.id, user.email, membership.role, targetOrgId);

  return jsonResponse({
    success: true,
    user: { ...user, role: membership.role, organization_id: targetOrgId },
    organization: orgs[0] || null,
    memberships,
    token,
    message: 'Organization switched'
  });
}

async function handleRegister(
  email: string,
  username: string,
  password: string,
  req: NextRequest
) {
  if (!email || !username || !password) {
    return jsonResponse({ error: 'Email, username, and password are required' }, 400);
  }

  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return jsonResponse({ error: 'Authentication required to create users' }, 401);
  }

  const token = authHeader.substring(7);
  let currentUser;

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    if (decoded.role !== 'superuser') {
      return jsonResponse({ error: 'Only superusers can create new accounts' }, 403);
    }
    currentUser = decoded;
  } catch (error) {
    return jsonResponse({ error: 'Invalid token' }, 401);
  }

  const existingUsers = await sql`
    SELECT id FROM users 
    WHERE email = ${email} OR username = ${username}
    LIMIT 1;
  `;

  if (existingUsers.length > 0) {
    return jsonResponse({ error: 'User with this email or username already exists' }, 400);
  }

  const hashedPassword = await bcrypt.hash(password, 12);

  const newUsers = await sql`
    INSERT INTO users (email, username, password_hash, role, created_by, organization_id)
    VALUES (${email}, ${username}, ${hashedPassword}, 'user', ${currentUser.userId}, ${currentUser.organizationId})
    RETURNING id, email, username, role, created_at, organization_id;
  `;

  const newUser = newUsers[0];

  await ensureMembershipSchema();
  await sql`
    INSERT INTO organization_members (user_id, organization_id, role)
    VALUES (${newUser.id}, ${currentUser.organizationId}, 'user')
    ON CONFLICT (user_id, organization_id) DO NOTHING;
  `;

  return jsonResponse({
    success: true,
    user: newUser,
    message: 'User created successfully'
  }, 201);
}

async function handleInviteUser(email: string, req: NextRequest) {
  if (!email) {
    return jsonResponse({ error: 'Email is required' }, 400);
  }

  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return jsonResponse({ error: 'Authentication required to invite users' }, 401);
  }

  const token = authHeader.substring(7);
  let currentUser;

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    if (decoded.role !== 'superuser') {
      return jsonResponse({ error: 'Only administrators can invite users' }, 403);
    }
    currentUser = decoded;
  } catch (error) {
    return jsonResponse({ error: 'Invalid token' }, 401);
  }

  await ensureMembershipSchema();

  // If the email belongs to an existing account, add it to this organization
  // directly — no invitation needed
  const existingAccounts = await sql`
    SELECT id, email, username, status FROM users
    WHERE email = ${email}
    LIMIT 1;
  `;

  if (existingAccounts.length > 0) {
    const existingUser = existingAccounts[0];

    const existingMembership = await sql`
      SELECT user_id FROM organization_members
      WHERE user_id = ${existingUser.id} AND organization_id = ${currentUser.organizationId}
      LIMIT 1;
    `;
    if (existingMembership.length > 0) {
      return jsonResponse({ error: 'User is already a member of your organization' }, 400);
    }

    if (existingUser.status === 'pending') {
      return jsonResponse({ error: 'This user has a pending invitation in another organization. They must complete it first.' }, 400);
    }

    await sql`
      INSERT INTO organization_members (user_id, organization_id, role)
      VALUES (${existingUser.id}, ${currentUser.organizationId}, 'user')
      ON CONFLICT (user_id, organization_id) DO NOTHING;
    `;

    return jsonResponse({
      success: true,
      addedExistingUser: true,
      user: { id: existingUser.id, email: existingUser.email, username: existingUser.username },
      message: `${existingUser.username} already had an account and was added to your organization directly.`
    }, 201);
  }

  const invitationToken = jwt.sign(
    { email, invitedBy: currentUser.userId, organizationId: currentUser.organizationId, type: 'invitation' },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  let baseUsername = email.split('@')[0];
  let username = baseUsername;
  let counter = 1;

  while (true) {
    const existingUsername = await sql`
      SELECT id FROM users WHERE username = ${username} AND organization_id = ${currentUser.organizationId} LIMIT 1;
    `;
    
    if (existingUsername.length === 0) {
      break;
    }
    
    username = `${baseUsername}${counter}`;
    counter++;
  }

  try {
    const newUsers = await sql`
      INSERT INTO users (email, username, password_hash, role, status, created_by, invitation_token, organization_id)
      VALUES (${email}, ${username}, 'PENDING', 'user', 'pending', ${currentUser.userId}, ${invitationToken}, ${currentUser.organizationId})
      RETURNING id, email, username, role, status, created_at, organization_id;
    `;

    const newUser = newUsers[0];

    await sql`
      INSERT INTO organization_members (user_id, organization_id, role)
      VALUES (${newUser.id}, ${currentUser.organizationId}, 'user')
      ON CONFLICT (user_id, organization_id) DO NOTHING;
    `;

    const origin = req.headers.get('origin') || req.nextUrl.origin;

    return jsonResponse({
      success: true,
      user: newUser,
      invitationToken,
      message: `User invitation created successfully with username: ${username}`,
      invitationUrl: `${origin}/complete-invitation?token=${invitationToken}`
    }, 201);
  } catch (error: any) {
    console.error('Error creating user invitation:', error);
    
    if (error?.code === '23505') {
      if (error.constraint?.includes('email')) {
        return jsonResponse({ error: 'User with this email already exists' }, 400);
      } else if (error.constraint?.includes('username')) {
        return jsonResponse({ error: 'Username conflict occurred, please try again' }, 400);
      }
    }
    
    return jsonResponse({ error: 'Failed to create user invitation' }, 500);
  }
}

async function handleCompleteInvitation(token: string, username: string, password: string) {
  if (!token || !username || !password) {
    return jsonResponse({ error: 'Token, username, and password are required' }, 400);
  }

  if (password.length < 6) {
    return jsonResponse({ error: 'Password must be at least 6 characters long' }, 400);
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    
    if (decoded.type !== 'invitation') {
      return jsonResponse({ error: 'Invalid invitation token' }, 400);
    }

    const users = await sql`
      SELECT id, email, status, invitation_token
      FROM users 
      WHERE email = ${decoded.email} AND status = 'pending' AND invitation_token = ${token}
      LIMIT 1;
    `;

    if (users.length === 0) {
      return jsonResponse({ error: 'Invalid or expired invitation' }, 400);
    }

    const user = users[0];

    const existingUsername = await sql`
      SELECT id FROM users 
      WHERE username = ${username} AND id != ${user.id}
      LIMIT 1;
    `;

    if (existingUsername.length > 0) {
      return jsonResponse({ error: 'Username already taken' }, 400);
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    await sql`
      UPDATE users 
      SET username = ${username}, 
          password_hash = ${hashedPassword}, 
          status = 'active',
          invitation_token = NULL
      WHERE id = ${user.id};
    `;

    return jsonResponse({
      success: true,
      message: 'Account setup completed successfully'
    });

  } catch (error) {
    return jsonResponse({ error: 'Invalid or expired invitation token' }, 400);
  }
}

async function handleVerifyInvitation(token: string) {
  if (!token) {
    return jsonResponse({ error: 'Token is required' }, 400);
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    
    if (decoded.type !== 'invitation') {
      return jsonResponse({ error: 'Invalid invitation token' }, 400);
    }

    const users = await sql`
      SELECT id, email, status, invitation_token
      FROM users 
      WHERE email = ${decoded.email} AND organization_id = ${decoded.organizationId}
      LIMIT 1;
    `;

    if (users.length === 0) {
      return jsonResponse({ error: 'Invitation not found' }, 400);
    }

    const user = users[0];

    if (user.status !== 'pending') {
      return jsonResponse({ 
        error: 'This invitation is no longer valid. The user has already completed registration.',
        userAlreadyRegistered: true
      }, 400);
    }

    if (user.invitation_token !== token) {
      return jsonResponse({ error: 'Invalid invitation token' }, 400);
    }

    return jsonResponse({
      success: true,
      email: user.email,
      isPending: true,
      message: 'Invitation is valid'
    });

  } catch (error) {
    return jsonResponse({ error: 'Invalid or expired invitation token' }, 400);
  }
}

async function handleVerifyToken(token: string) {
  if (!token) {
    return jsonResponse({ error: 'Token is required' }, 401);
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    
    const users = await sql`
      SELECT id, email, username, role, status, created_at, last_login, organization_id
      FROM users 
      WHERE id = ${decoded.userId}
      LIMIT 1;
    `;

    if (users.length === 0) {
      return jsonResponse({ error: 'User not found' }, 401);
    }

    const user = users[0];

    if (user.status !== 'active') {
      return jsonResponse({ error: 'Account not active' }, 401);
    }

    await ensureMembershipSchema();
    const memberships = await getMemberships(user.id);

    // The token's organization is the active one (it survives org switches);
    // fall back to the user's last-used org for legacy tokens
    const tokenOrgId = Number(decoded.organizationId);
    const activeMembership = memberships.find(m => m.organization_id === tokenOrgId)
      ?? memberships.find(m => m.organization_id === Number(user.organization_id))
      ?? memberships[0]
      ?? null;
    const activeOrganizationId = activeMembership?.organization_id ?? null;
    const activeRole = activeMembership?.role ?? user.role;

    let organization = null;
    if (activeOrganizationId) {
      const orgs = await sql`
        SELECT id, name, domain, created_at, created_by
        FROM organizations
        WHERE id = ${activeOrganizationId}
        LIMIT 1;
      `;
      organization = orgs[0] || null;
    }

    return jsonResponse({
      success: true,
      user: { ...user, role: activeRole, organization_id: activeOrganizationId },
      organization: organization,
      memberships,
      message: 'Token is valid'
    });

  } catch (error) {
    return jsonResponse({ error: 'Invalid or expired token' }, 401);
  }
}
