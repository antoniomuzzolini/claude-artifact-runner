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
    const { action, email, password, username, token } = await req.json();

    switch (action) {
      case 'login':
        return await handleLogin(email, password);
      case 'register':
        return await handleRegister(email, username, password, req);
      case 'verify':
        return await handleVerifyToken(token);
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

  let organization = null;
  if (user.organization_id) {
    const orgs = await sql`
      SELECT id, name, domain, created_at, created_by
      FROM organizations 
      WHERE id = ${user.organization_id}
      LIMIT 1;
    `;
    organization = orgs[0] || null;
  }

  await sql`
    UPDATE users 
    SET last_login = NOW() 
    WHERE id = ${user.id};
  `;

  const token = jwt.sign(
    { 
      userId: user.id, 
      email: user.email, 
      role: user.role,
      organizationId: user.organization_id
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  const { password_hash, ...userWithoutPassword } = user;

  return jsonResponse({
    success: true,
    user: userWithoutPassword,
    organization: organization,
    token,
    message: 'Login successful'
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

  const existingUsers = await sql`
    SELECT id FROM users 
    WHERE email = ${email} AND organization_id = ${currentUser.organizationId}
    LIMIT 1;
  `;

  if (existingUsers.length > 0) {
    return jsonResponse({ error: 'User with this email already exists in your organization' }, 400);
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

    let organization = null;
    if (user.organization_id) {
      const orgs = await sql`
        SELECT id, name, domain, created_at, created_by
        FROM organizations 
        WHERE id = ${user.organization_id}
        LIMIT 1;
      `;
      organization = orgs[0] || null;
    }

    return jsonResponse({
      success: true,
      user: user,
      organization: organization,
      message: 'Token is valid'
    });
  
  } catch (error) {
    return jsonResponse({ error: 'Invalid or expired token' }, 401);
  }
}
