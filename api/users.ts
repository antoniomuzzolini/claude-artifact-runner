import { neon } from '@neondatabase/serverless';
import jwt from 'jsonwebtoken';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const sql = neon(process.env.DATABASE_URL!);
const JWT_SECRET = process.env.JWT_SECRET || 'your-fallback-secret-key-change-in-production';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Add CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    // Verify authentication
    const authHeader = req.headers.authorization;
    console.log('Auth header:', authHeader ? 'Present' : 'Missing');
    
    if (!authHeader?.startsWith('Bearer ')) {
      console.log('No Bearer token found');
      return res.status(401).json({ error: 'Authentication required' });
    }

    const token = authHeader.substring(7);
    let currentUser;
    
    try {
      currentUser = jwt.verify(token, JWT_SECRET) as any;
      console.log('JWT verified for user:', currentUser.userId, 'role:', currentUser.role, 'orgId:', currentUser.organizationId);
    } catch (error) {
      console.log('JWT verification failed:', error.message);
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Verify superuser role
    if (currentUser.role !== 'superuser') {
      console.log('User is not superuser:', currentUser.role);
      return res.status(403).json({ error: 'Only administrators can manage users' });
    }

    // Check if user has organization
    if (!currentUser.organizationId) {
      console.log('User has no organization ID');
      return res.status(403).json({ error: 'User must belong to an organization' });
    }

    if (req.method === 'GET') {
      // List all users in the same organization
      const users = await sql`
        SELECT id, email, username, role, status, created_at, last_login, created_by, invitation_token, organization_id
        FROM users 
        WHERE organization_id = ${currentUser.organizationId}
        ORDER BY created_at DESC;
      `;

      return res.status(200).json({
        success: true,
        users: users
      });
    }

    if (req.method === 'DELETE') {
      const { userId } = req.body;

      if (!userId) {
        return res.status(400).json({ error: 'User ID is required' });
      }

      // Check if user exists and belongs to the same organization
      const targetUsers = await sql`
        SELECT id, email, username, role, organization_id
        FROM users 
        WHERE id = ${userId} AND organization_id = ${currentUser.organizationId}
        LIMIT 1;
      `;

      if (targetUsers.length === 0) {
        return res.status(404).json({ error: 'User not found in your organization' });
      }

      const targetUser = targetUsers[0];

      // Prevent deleting yourself
      if (targetUser.id === currentUser.userId) {
        return res.status(400).json({ error: 'Cannot delete your own account' });
      }

      // Delete the user
      await sql`
        DELETE FROM users 
        WHERE id = ${userId} AND organization_id = ${currentUser.organizationId};
      `;

      return res.status(200).json({
        success: true,
        message: `User ${targetUser.username} deleted successfully`
      });
    }

    res.setHeader('Allow', ['GET', 'DELETE']);
    res.status(405).end(`Method ${req.method} Not Allowed`);

  } catch (error) {
    console.error('Users API error:', error);
    return res.status(500).json({ 
      error: 'User operation failed',
      message: error.message 
    });
  }
} 