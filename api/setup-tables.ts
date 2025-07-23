import { neon } from '@neondatabase/serverless';
import type { VercelRequest, VercelResponse } from '@vercel/node';

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

    const sql = neon(process.env.DATABASE_URL);
    
    if (req.method === 'GET') {
      // Check if tables exist
      const playersTable = await sql`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'players'
        );
      `;
      
      const matchesTable = await sql`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'matches'
        );
      `;
      
      return res.status(200).json({
        success: true,
        tablesExist: {
          players: playersTable[0].exists,
          matches: matchesTable[0].exists
        },
        message: 'Table status checked successfully'
      });
    }
    
    if (req.method === 'POST') {
      // Create tables
      await sql`
        CREATE TABLE IF NOT EXISTS players (
          id BIGINT PRIMARY KEY,
          name VARCHAR(255) UNIQUE NOT NULL,
          elo INTEGER DEFAULT 1200,
          matches INTEGER DEFAULT 0,
          wins INTEGER DEFAULT 0,
          losses INTEGER DEFAULT 0,
          created_at TIMESTAMP DEFAULT NOW()
        );
      `;
      
      await sql`
        CREATE TABLE IF NOT EXISTS matches (
          id BIGINT PRIMARY KEY,
          date VARCHAR(255) NOT NULL,
          time VARCHAR(255) NOT NULL,
          team1 TEXT[] NOT NULL,
          team2 TEXT[] NOT NULL,
          winner VARCHAR(255) NOT NULL,
          team1_score INTEGER NOT NULL,
          team2_score INTEGER NOT NULL,
          elo_changes JSONB,
          created_at TIMESTAMP DEFAULT NOW()
        );
      `;
      
      return res.status(200).json({
        success: true,
        message: 'Tables created successfully',
        tables: ['players', 'matches']
      });
    }
    
    res.setHeader('Allow', ['GET', 'POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
    
  } catch (error) {
    console.error('Setup tables error:', error);
    return res.status(500).json({ 
      success: false,
      error: 'Failed to setup tables',
      errorMessage: error.message
    });
  }
} 