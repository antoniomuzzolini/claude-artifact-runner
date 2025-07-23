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
    SELECT id, email, username, password_hash, role, created_at, last_login
    FROM users 
    WHERE email = ${email}
    LIMIT 1;
  `;

  if (users.length === 0) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const user = users[0];

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

async function handleVerifyToken(token: string, res: VercelResponse) {
  if (!token) {
    return res.status(401).json({ error: 'Token is required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    
    // Get fresh user data from database
    const users = await sql`
      SELECT id, email, username, role, created_at, last_login
      FROM users 
      WHERE id = ${decoded.userId}
      LIMIT 1;
    `;

    if (users.length === 0) {
      return res.status(401).json({ error: 'User not found' });
    }

    return res.status(200).json({
      success: true,
      user: users[0],
      message: 'Token is valid'
    });

  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
} 