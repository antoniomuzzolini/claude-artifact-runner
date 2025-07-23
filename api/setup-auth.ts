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
      // Check if organizations table exists
      const organizationsTable = await sql`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'organizations'
        );
      `;

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

      // Check if tables have organization_id columns
      const usersHasOrgId = await sql`
        SELECT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_name = 'users' 
          AND column_name = 'organization_id'
        );
      `;

      const playersHasOrgId = await sql`
        SELECT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_name = 'players' 
          AND column_name = 'organization_id'
        );
      `;

      const matchesHasOrgId = await sql`
        SELECT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_name = 'matches' 
          AND column_name = 'organization_id'
        );
      `;

      return res.status(200).json({
        success: true,
        organizationsTableExists: organizationsTable[0].exists,
        usersTableExists: usersTable[0].exists,
        matchesHasCreatedBy: hasCreatedBy[0].exists,
        usersHasOrgId: usersHasOrgId[0].exists,
        playersHasOrgId: playersHasOrgId[0].exists,
        matchesHasOrgId: matchesHasOrgId[0].exists,
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

      // Create organizations table first
      await sql`
        CREATE TABLE IF NOT EXISTS organizations (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          domain VARCHAR(255),
          created_at TIMESTAMP DEFAULT NOW(),
          created_by INTEGER
        );
      `;

      // Create users table
      await sql`
        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          email VARCHAR(255) UNIQUE NOT NULL,
          username VARCHAR(255) UNIQUE NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          role VARCHAR(50) DEFAULT 'user',
          status VARCHAR(50) DEFAULT 'active',
          created_at TIMESTAMP DEFAULT NOW(),
          created_by INTEGER REFERENCES users(id),
          last_login TIMESTAMP,
          invitation_token TEXT,
          organization_id INTEGER REFERENCES organizations(id)
        );
      `;

      // Add foreign key constraint to organizations table
      await sql`
        ALTER TABLE organizations 
        ADD CONSTRAINT fk_organizations_created_by 
        FOREIGN KEY (created_by) REFERENCES users(id);
      `;

      // Add new columns to existing tables
      await sql`
        ALTER TABLE users 
        ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'active';
      `;
      
      await sql`
        ALTER TABLE users 
        ADD COLUMN IF NOT EXISTS invitation_token TEXT;
      `;

      await sql`
        ALTER TABLE users 
        ADD COLUMN IF NOT EXISTS organization_id INTEGER REFERENCES organizations(id);
      `;

      // Add created_by column to matches table
      await sql`
        ALTER TABLE matches 
        ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES users(id);
      `;

      // Add organization_id to matches table
      await sql`
        ALTER TABLE matches 
        ADD COLUMN IF NOT EXISTS organization_id INTEGER REFERENCES organizations(id);
      `;

      // Add organization_id to players table
      await sql`
        ALTER TABLE players 
        ADD COLUMN IF NOT EXISTS organization_id INTEGER REFERENCES organizations(id);
      `;

      // Check if admin user already exists
      const existingAdmin = await sql`
        SELECT id FROM users WHERE role = 'superuser' LIMIT 1;
      `;

      if (existingAdmin.length === 0) {
        // Create initial superuser without organization (will be set when creating first org)
        const hashedPassword = await bcrypt.hash(adminPassword, 12);
        const username = adminEmail.split('@')[0]; // Use email prefix as username

        await sql`
          INSERT INTO users (email, username, password_hash, role, status)
          VALUES (${adminEmail}, ${username}, ${hashedPassword}, 'superuser', 'active');
        `;

        return res.status(200).json({
          success: true,
          message: 'Auth tables created and superuser account set up',
          superuser: { email: adminEmail, username },
          note: 'Create an organization to complete setup'
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