import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';
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
      // Check if users table exists
      const usersTable = await sql`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'users'
        );
      `;
      
      // Check if matches table has created_by column
      const hasCreatedBy = await sql`
        SELECT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_name = 'matches' 
          AND column_name = 'created_by'
        );
      `;

      return res.status(200).json({
        success: true,
        usersTableExists: usersTable[0].exists,
        matchesHasCreatedBy: hasCreatedBy[0].exists,
        message: 'Auth setup status checked'
      });
    }
    
    if (req.method === 'POST') {
      const { adminEmail, adminPassword } = req.body;

      if (!adminEmail || !adminPassword) {
        return res.status(400).json({
          error: 'Admin email and password are required',
          success: false
        });
      }

      // Create users table
      await sql`
        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          email VARCHAR(255) UNIQUE NOT NULL,
          username VARCHAR(255) UNIQUE NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          role VARCHAR(50) DEFAULT 'user',
          created_at TIMESTAMP DEFAULT NOW(),
          created_by INTEGER REFERENCES users(id),
          last_login TIMESTAMP
        );
      `;

      // Add created_by column to matches table
      await sql`
        ALTER TABLE matches 
        ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES users(id);
      `;

      // Check if admin user already exists
      const existingAdmin = await sql`
        SELECT id FROM users WHERE role = 'superuser' LIMIT 1;
      `;

      if (existingAdmin.length === 0) {
        // Create initial superuser
        const hashedPassword = await bcrypt.hash(adminPassword, 12);
        const username = adminEmail.split('@')[0]; // Use email prefix as username

        await sql`
          INSERT INTO users (email, username, password_hash, role)
          VALUES (${adminEmail}, ${username}, ${hashedPassword}, 'superuser');
        `;

        return res.status(200).json({
          success: true,
          message: 'Auth tables created and superuser account set up',
          superuser: { email: adminEmail, username }
        });
      } else {
        return res.status(200).json({
          success: true,
          message: 'Auth tables updated (superuser already exists)',
          note: 'Superuser account was not modified'
        });
      }
    }
    
    res.setHeader('Allow', ['GET', 'POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
    
  } catch (error) {
    console.error('Auth setup error:', error);
    return res.status(500).json({ 
      success: false,
      error: 'Failed to setup authentication',
      errorMessage: error.message
    });
  }
} 