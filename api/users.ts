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

    // Verify superuser role
    if (currentUser.role !== 'superuser') {
      return res.status(403).json({ error: 'Only administrators can manage users' });
    }

    if (req.method === 'GET') {
      // List all users
      const users = await sql`
        SELECT id, email, username, role, created_at, last_login, created_by
        FROM users 
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

      // Prevent deleting superusers
      const userToDelete = await sql`
        SELECT id, role FROM users WHERE id = ${userId} LIMIT 1;
      `;

      if (userToDelete.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      if (userToDelete[0].role === 'superuser') {
        return res.status(400).json({ error: 'Cannot delete administrator accounts' });
      }

      // Prevent self-deletion
      if (userId === currentUser.userId) {
        return res.status(400).json({ error: 'Cannot delete your own account' });
      }

      // Delete user
      await sql`DELETE FROM users WHERE id = ${userId};`;

      return res.status(200).json({
        success: true,
        message: 'User deleted successfully'
      });
    }

    res.setHeader('Allow', ['GET', 'DELETE']);
    res.status(405).end(`Method ${req.method} Not Allowed`);

  } catch (error) {
    console.error('Users API error:', error);
    return res.status(500).json({ 
      error: 'Failed to manage users',
      message: error.message 
    });
  }
} 