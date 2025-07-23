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
      const { action, organizationName, organizationDomain, adminEmail, adminUsername, adminPassword } = req.body;

      if (action === 'register') {
        return await handleOrganizationRegistration(
          organizationName, 
          organizationDomain, 
          adminEmail, 
          adminUsername, 
          adminPassword, 
          res
        );
      }

      return res.status(400).json({ error: 'Invalid action' });
    }

    if (req.method === 'GET') {
      // List organizations (for superuser or authenticated users)
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const token = authHeader.substring(7);
      let currentUser;
      
      try {
        currentUser = jwt.verify(token, JWT_SECRET) as any;
      } catch (error) {
        return res.status(401).json({ error: 'Invalid token' });
      }

      // Get user's organization or all organizations if superuser
      let organizations;
      if (currentUser.role === 'superuser' && !currentUser.organizationId) {
        // Global superuser can see all organizations
        organizations = await sql`
          SELECT id, name, domain, created_at, created_by
          FROM organizations 
          ORDER BY created_at DESC;
        `;
      } else {
        // Regular users see only their organization
        organizations = await sql`
          SELECT id, name, domain, created_at, created_by
          FROM organizations 
          WHERE id = ${currentUser.organizationId}
          LIMIT 1;
        `;
      }

      return res.status(200).json({
        success: true,
        organizations
      });
    }

    res.setHeader('Allow', ['GET', 'POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);

  } catch (error) {
    console.error('Organizations API error:', error);
    return res.status(500).json({ 
      error: 'Organization operation failed',
      message: error.message 
    });
  }
}

async function handleOrganizationRegistration(
  organizationName: string, 
  organizationDomain: string | undefined, 
  adminEmail: string, 
  adminUsername: string, 
  adminPassword: string, 
  res: VercelResponse
) {
  if (!organizationName || !adminEmail || !adminUsername || !adminPassword) {
    return res.status(400).json({ 
      error: 'Organization name, admin email, username, and password are required' 
    });
  }

  if (adminPassword.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters long' });
  }

  // Check if organization name already exists
  const existingOrg = await sql`
    SELECT id FROM organizations 
    WHERE LOWER(name) = LOWER(${organizationName})
    LIMIT 1;
  `;

  if (existingOrg.length > 0) {
    return res.status(400).json({ error: 'Organization name already exists' });
  }

  // Check if admin email already exists
  const existingUser = await sql`
    SELECT id FROM users 
    WHERE email = ${adminEmail}
    LIMIT 1;
  `;

  if (existingUser.length > 0) {
    return res.status(400).json({ error: 'User with this email already exists' });
  }

  // Check if username already exists
  const existingUsername = await sql`
    SELECT id FROM users 
    WHERE username = ${adminUsername}
    LIMIT 1;
  `;

  if (existingUsername.length > 0) {
    return res.status(400).json({ error: 'Username already taken' });
  }

  try {
    // Start transaction - create organization first
    const newOrganizations = await sql`
      INSERT INTO organizations (name, domain, created_at)
      VALUES (${organizationName}, ${organizationDomain || null}, NOW())
      RETURNING id, name, domain, created_at;
    `;

    const organization = newOrganizations[0];

    // Hash password
    const hashedPassword = await bcrypt.hash(adminPassword, 12);

    // Create superuser for this organization
    const newUsers = await sql`
      INSERT INTO users (email, username, password_hash, role, status, organization_id, created_at)
      VALUES (${adminEmail}, ${adminUsername}, ${hashedPassword}, 'superuser', 'active', ${organization.id}, NOW())
      RETURNING id, email, username, role, organization_id, created_at;
    `;

    const user = newUsers[0];

    // Update organization with created_by
    await sql`
      UPDATE organizations 
      SET created_by = ${user.id}
      WHERE id = ${organization.id};
    `;

    // Generate JWT token
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

    return res.status(201).json({
      success: true,
      user: user,
      organization: { ...organization, created_by: user.id },
      token,
      message: 'Organization and admin account created successfully'
    });

  } catch (error) {
    console.error('Organization registration error:', error);
    return res.status(500).json({ 
      error: 'Failed to create organization',
      message: error.message 
    });
  }
} 