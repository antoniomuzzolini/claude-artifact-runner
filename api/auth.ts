import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const sql = neon(process.env.DATABASE_URL!);
const JWT_SECRET = process.env.JWT_SECRET || 'your-fallback-secret-key-change-in-production';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Add CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    if (req.method === 'POST') {
      const { action, email, password, username, token } = req.body;

      switch (action) {
        case 'login':
          return await handleLogin(email, password, res);
        
        case 'register':
          return await handleRegister(email, username, password, req, res);
        
        case 'verify':
          return await handleVerifyToken(token, res);
        
        case 'invite':
          return await handleInviteUser(email, req, res);
        
        case 'complete-invitation':
          return await handleCompleteInvitation(req.body.token, username, password, res);
        
        default:
          return res.status(400).json({ error: 'Invalid action' });
      }
    }

    if (req.method === 'GET') {
      // Verify token from Authorization header
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No token provided' });
      }

      const token = authHeader.substring(7);
      return await handleVerifyToken(token, res);
    }

    res.setHeader('Allow', ['GET', 'POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);

  } catch (error) {
    console.error('Auth error:', error);
    return res.status(500).json({ 
      error: 'Authentication failed',
      message: error.message 
    });
  }
}

async function handleLogin(email: string, password: string, res: VercelResponse) {
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  // Find user by email
  const users = await sql`
    SELECT id, email, username, password_hash, role, status, created_at, last_login
    FROM users 
    WHERE email = ${email}
    LIMIT 1;
  `;

  if (users.length === 0) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const user = users[0];

  // Check if user account is active
  if (user.status !== 'active') {
    return res.status(401).json({ error: 'Account not active or pending setup' });
  }

  // Verify password
  const isValidPassword = await bcrypt.compare(password, user.password_hash);
  if (!isValidPassword) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  // Update last login
  await sql`
    UPDATE users 
    SET last_login = NOW() 
    WHERE id = ${user.id};
  `;

  // Generate JWT token
  const token = jwt.sign(
    { 
      userId: user.id, 
      email: user.email, 
      role: user.role 
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  // Remove password hash from response
  const { password_hash, ...userWithoutPassword } = user;

  return res.status(200).json({
    success: true,
    user: userWithoutPassword,
    token,
    message: 'Login successful'
  });
}

async function handleRegister(email: string, username: string, password: string, req: VercelRequest, res: VercelResponse) {
  if (!email || !username || !password) {
    return res.status(400).json({ error: 'Email, username, and password are required' });
  }

  // Verify that the requester is a superuser (only superusers can create accounts)
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required to create users' });
  }

  const token = authHeader.substring(7);
  let currentUser;
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    if (decoded.role !== 'superuser') {
      return res.status(403).json({ error: 'Only superusers can create new accounts' });
    }
    currentUser = decoded;
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  // Check if user already exists
  const existingUsers = await sql`
    SELECT id FROM users 
    WHERE email = ${email} OR username = ${username}
    LIMIT 1;
  `;

  if (existingUsers.length > 0) {
    return res.status(400).json({ error: 'User with this email or username already exists' });
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(password, 12);

  // Create user
  const newUsers = await sql`
    INSERT INTO users (email, username, password_hash, role, created_by)
    VALUES (${email}, ${username}, ${hashedPassword}, 'user', ${currentUser.userId})
    RETURNING id, email, username, role, created_at;
  `;

  const newUser = newUsers[0];

  return res.status(201).json({
    success: true,
    user: newUser,
    message: 'User created successfully'
  });
}

async function handleInviteUser(email: string, req: VercelRequest, res: VercelResponse) {
  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  // Verify that the requester is a superuser
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required to invite users' });
  }

  const token = authHeader.substring(7);
  let currentUser;
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    if (decoded.role !== 'superuser') {
      return res.status(403).json({ error: 'Only administrators can invite users' });
    }
    currentUser = decoded;
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  // Check if user already exists
  const existingUsers = await sql`
    SELECT id FROM users 
    WHERE email = ${email}
    LIMIT 1;
  `;

  if (existingUsers.length > 0) {
    return res.status(400).json({ error: 'User with this email already exists' });
  }

  // Generate invitation token
  const invitationToken = jwt.sign(
    { email, invitedBy: currentUser.userId, type: 'invitation' },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  // Generate unique username
  let baseUsername = email.split('@')[0];
  let username = baseUsername;
  let counter = 1;

  // Check for existing usernames and generate unique one
  while (true) {
    const existingUsername = await sql`
      SELECT id FROM users WHERE username = ${username} LIMIT 1;
    `;
    
    if (existingUsername.length === 0) {
      break; // Username is unique
    }
    
    username = `${baseUsername}${counter}`;
    counter++;
  }

  // Create pending user
  try {
    const newUsers = await sql`
      INSERT INTO users (email, username, password_hash, role, status, created_by, invitation_token)
      VALUES (${email}, ${username}, 'PENDING', 'user', 'pending', ${currentUser.userId}, ${invitationToken})
      RETURNING id, email, username, role, status, created_at;
    `;

    const newUser = newUsers[0];

    return res.status(201).json({
      success: true,
      user: newUser,
      invitationToken,
      message: `User invitation created successfully with username: ${username}`,
      invitationUrl: `${req.headers.origin || ''}/complete-invitation?token=${invitationToken}`
    });
  } catch (error: any) {
    console.error('Error creating user invitation:', error);
    
    if (error.code === '23505') {
      // Unique constraint violation
      if (error.constraint?.includes('email')) {
        return res.status(400).json({ error: 'User with this email already exists' });
      } else if (error.constraint?.includes('username')) {
        return res.status(400).json({ error: 'Username conflict occurred, please try again' });
      }
    }
    
    return res.status(500).json({ error: 'Failed to create user invitation' });
  }
}

async function handleCompleteInvitation(token: string, username: string, password: string, res: VercelResponse) {
  if (!token || !username || !password) {
    return res.status(400).json({ error: 'Token, username, and password are required' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters long' });
  }

  try {
    // Verify invitation token
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    
    if (decoded.type !== 'invitation') {
      return res.status(400).json({ error: 'Invalid invitation token' });
    }

    // Find pending user
    const users = await sql`
      SELECT id, email, status, invitation_token
      FROM users 
      WHERE email = ${decoded.email} AND status = 'pending' AND invitation_token = ${token}
      LIMIT 1;
    `;

    if (users.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired invitation' });
    }

    const user = users[0];

    // Check if username is available (excluding current user)
    const existingUsername = await sql`
      SELECT id FROM users 
      WHERE username = ${username} AND id != ${user.id}
      LIMIT 1;
    `;

    if (existingUsername.length > 0) {
      return res.status(400).json({ error: 'Username already taken' });
    }

    // Hash password and activate user
    const hashedPassword = await bcrypt.hash(password, 12);

    await sql`
      UPDATE users 
      SET username = ${username}, 
          password_hash = ${hashedPassword}, 
          status = 'active',
          invitation_token = NULL
      WHERE id = ${user.id};
    `;

    return res.status(200).json({
      success: true,
      message: 'Account setup completed successfully'
    });

  } catch (error) {
    return res.status(400).json({ error: 'Invalid or expired invitation token' });
  }
}

async function handleVerifyToken(token: string, res: VercelResponse) {
  if (!token) {
    return res.status(401).json({ error: 'Token is required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    
    // Get fresh user data from database
    const users = await sql`
      SELECT id, email, username, role, status, created_at, last_login
      FROM users 
      WHERE id = ${decoded.userId}
      LIMIT 1;
    `;

    if (users.length === 0) {
      return res.status(401).json({ error: 'User not found' });
    }

    const user = users[0];

    // Check if user is active
    if (user.status !== 'active') {
      return res.status(401).json({ error: 'Account not active' });
    }

    return res.status(200).json({
      success: true,
      user: user,
      message: 'Token is valid'
    });

  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
} 