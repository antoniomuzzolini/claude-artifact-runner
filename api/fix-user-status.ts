import { neon } from '@neondatabase/serverless';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const sql = neon(process.env.DATABASE_URL!);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Add CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    if (!process.env.DATABASE_URL) {
      return res.status(500).json({ 
        error: 'DATABASE_URL environment variable not found',
        success: false
      });
    }

    if (req.method === 'GET') {
      // Check current user status
      const users = await sql`
        SELECT id, email, username, role, status, created_at
        FROM users 
        ORDER BY created_at;
      `;

      return res.status(200).json({
        success: true,
        users: users,
        message: 'Current user status'
      });
    }
    
    if (req.method === 'POST') {
      // Fix user status - set all users without status or with NULL status to 'active'
      const result = await sql`
        UPDATE users 
        SET status = 'active'
        WHERE status IS NULL OR status = '';
      `;

      // Also ensure all existing users have the status column
      const updateResult = await sql`
        UPDATE users 
        SET status = 'active'
        WHERE status IS NULL;
      `;

      // Get updated user list
      const updatedUsers = await sql`
        SELECT id, email, username, role, status, created_at
        FROM users 
        ORDER BY created_at;
      `;

      return res.status(200).json({
        success: true,
        message: 'User status fixed',
        updatedUsers: updatedUsers,
        sqlResult: result
      });
    }
    
    res.setHeader('Allow', ['GET', 'POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
    
  } catch (error) {
    console.error('Fix user status error:', error);
    return res.status(500).json({ 
      success: false,
      error: 'Failed to fix user status',
      errorMessage: error.message
    });
  }
} 