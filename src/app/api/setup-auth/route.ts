import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

const sql = neon(process.env.DATABASE_URL!);

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

    const organizationsTable = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'organizations'
      );
    `;

    const usersTable = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'users'
      );
    `;

    const hasCreatedBy = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'matches' 
        AND column_name = 'created_by'
      );
    `;

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

    const settingsTable = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'organization_settings'
      );
    `;

    return jsonResponse({
      success: true,
      organizationsTableExists: organizationsTable[0].exists,
      usersTableExists: usersTable[0].exists,
      matchesHasCreatedBy: hasCreatedBy[0].exists,
      usersHasOrgId: usersHasOrgId[0].exists,
      playersHasOrgId: playersHasOrgId[0].exists,
      matchesHasOrgId: matchesHasOrgId[0].exists,
      settingsTableExists: settingsTable[0].exists,
      message: 'Auth setup status checked'
    });
  } catch (error) {
    console.error('Auth setup error:', error);
    const message = error instanceof Error ? error.message : 'Failed to setup authentication';
    return jsonResponse({
      success: false,
      error: 'Failed to setup authentication',
      errorMessage: message
    }, 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!process.env.DATABASE_URL) {
      return jsonResponse({ 
        error: 'DATABASE_URL environment variable not found',
        success: false
      }, 500);
    }

    const { adminEmail, adminPassword } = await req.json();

    if (!adminEmail || !adminPassword) {
      return jsonResponse({
        error: 'Admin email and password are required',
        success: false
      }, 400);
    }

    await sql`
      CREATE TABLE IF NOT EXISTS organizations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        domain VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW(),
        created_by INTEGER
      );
    `;

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

    await sql`
      ALTER TABLE organizations 
      ADD CONSTRAINT fk_organizations_created_by 
      FOREIGN KEY (created_by) REFERENCES users(id);
    `;

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

    await sql`
      ALTER TABLE matches 
      ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES users(id);
    `;

    await sql`
      ALTER TABLE matches 
      ADD COLUMN IF NOT EXISTS organization_id INTEGER REFERENCES organizations(id);
    `;

    await sql`
      ALTER TABLE matches 
      ADD COLUMN IF NOT EXISTS teams JSONB;
    `;

    await sql`
      ALTER TABLE matches 
      ADD COLUMN IF NOT EXISTS scores INTEGER[];
    `;

    await sql`
      ALTER TABLE matches 
      ADD COLUMN IF NOT EXISTS winner_index INTEGER;
    `;


    await sql`
      ALTER TABLE players 
      ADD COLUMN IF NOT EXISTS organization_id INTEGER REFERENCES organizations(id);
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS organization_settings (
        organization_id INTEGER PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
        min_matches_for_ranking INTEGER DEFAULT 10,
        elo_k_factor INTEGER DEFAULT 32,
        ranking_mode VARCHAR(32) DEFAULT 'elo',
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `;

    await sql`
      ALTER TABLE organization_settings
      ADD COLUMN IF NOT EXISTS elo_k_factor INTEGER DEFAULT 32;
    `;

    await sql`
      ALTER TABLE organization_settings
      ADD COLUMN IF NOT EXISTS ranking_mode VARCHAR(32) DEFAULT 'elo';
    `;

    await sql`
      INSERT INTO organization_settings (organization_id, min_matches_for_ranking)
      SELECT o.id, 10
      FROM organizations o
      WHERE NOT EXISTS (
        SELECT 1 FROM organization_settings s WHERE s.organization_id = o.id
      );
    `;

    const existingAdmin = await sql`
      SELECT id FROM users WHERE role = 'superuser' LIMIT 1;
    `;

    if (existingAdmin.length === 0) {
      const hashedPassword = await bcrypt.hash(adminPassword, 12);
      const username = adminEmail.split('@')[0];

      await sql`
        INSERT INTO users (email, username, password_hash, role, status)
        VALUES (${adminEmail}, ${username}, ${hashedPassword}, 'superuser', 'active');
      `;

      return jsonResponse({
        success: true,
        message: 'Auth tables created and superuser account set up',
        superuser: { email: adminEmail, username },
        note: 'Create an organization to complete setup'
      });
    }

    return jsonResponse({
      success: true,
      message: 'Auth tables updated (superuser already exists)',
      note: 'Superuser account was not modified'
    });
  } catch (error) {
    console.error('Auth setup error:', error);
    const message = error instanceof Error ? error.message : 'Failed to setup authentication';
    return jsonResponse({
      success: false,
      error: 'Failed to setup authentication',
      errorMessage: message
    }, 500);
  }
}
