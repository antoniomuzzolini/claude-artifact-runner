import { neon } from '@neondatabase/serverless';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

const corsHeaders = {
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function jsonResponse(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: corsHeaders });
}

export function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders });
}

export async function GET() {
  try {
    if (!process.env.DATABASE_URL) {
      return jsonResponse({ 
        error: 'DATABASE_URL environment variable not found',
        success: false
      }, 500);
    }

    const sql = neon(process.env.DATABASE_URL);
    
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
    
    return jsonResponse({
      success: true,
      tablesExist: {
        players: playersTable[0].exists,
        matches: matchesTable[0].exists
      },
      message: 'Table status checked successfully'
    });
  } catch (error) {
    console.error('Setup tables error:', error);
    const message = error instanceof Error ? error.message : 'Failed to setup tables';
    return jsonResponse({
      success: false,
      error: 'Failed to setup tables',
      errorMessage: message
    }, 500);
  }
}

export async function POST() {
  try {
    if (!process.env.DATABASE_URL) {
      return jsonResponse({ 
        error: 'DATABASE_URL environment variable not found',
        success: false
      }, 500);
    }

    const sql = neon(process.env.DATABASE_URL);
    
    await sql`
      CREATE TABLE IF NOT EXISTS players (
        id BIGINT PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        elo INTEGER DEFAULT 1200,
        matches INTEGER DEFAULT 0,
        wins INTEGER DEFAULT 0,
        losses INTEGER DEFAULT 0,
        organization_id INTEGER,
        season_id BIGINT,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `;
    
    await sql`
      CREATE TABLE IF NOT EXISTS matches (
        id BIGINT PRIMARY KEY,
        date VARCHAR(255) NOT NULL,
        time VARCHAR(255) NOT NULL,
        teams JSONB,
        scores INTEGER[],
        winner_index INTEGER,
        elo_changes JSONB,
        organization_id INTEGER,
        season_id BIGINT,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `;

    await sql`ALTER TABLE matches ADD COLUMN IF NOT EXISTS teams JSONB;`;
    await sql`ALTER TABLE matches ADD COLUMN IF NOT EXISTS scores INTEGER[];`;
    await sql`ALTER TABLE matches ADD COLUMN IF NOT EXISTS winner_index INTEGER;`;

    await sql`
      CREATE TABLE IF NOT EXISTS seasons (
        id BIGINT PRIMARY KEY,
        organization_id INTEGER NOT NULL,
        name VARCHAR(255) NOT NULL,
        start_date TIMESTAMP NOT NULL,
        end_date TIMESTAMP,
        is_current BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `;
    
    return jsonResponse({
      success: true,
      message: 'Tables created successfully',
      tables: ['players', 'matches']
    });
  } catch (error) {
    console.error('Setup tables error:', error);
    const message = error instanceof Error ? error.message : 'Failed to setup tables';
    return jsonResponse({
      success: false,
      error: 'Failed to setup tables',
      errorMessage: message
    }, 500);
  }
}
