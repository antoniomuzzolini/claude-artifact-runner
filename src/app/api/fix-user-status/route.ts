import { neon } from '@neondatabase/serverless';
import { NextResponse } from 'next/server';

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

    const users = await sql`
      SELECT id, email, username, role, status, created_at
      FROM users 
      ORDER BY created_at;
    `;

    return jsonResponse({
      success: true,
      users: users,
      message: 'Current user status'
    });
  } catch (error) {
    console.error('Fix user status error:', error);
    const message = error instanceof Error ? error.message : 'Failed to fix user status';
    return jsonResponse({ 
      success: false,
      error: 'Failed to fix user status',
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

    const result = await sql`
      UPDATE users 
      SET status = 'active'
      WHERE status IS NULL OR status = '';
    `;

    await sql`
      UPDATE users 
      SET status = 'active'
      WHERE status IS NULL;
    `;

    const updatedUsers = await sql`
      SELECT id, email, username, role, status, created_at
      FROM users 
      ORDER BY created_at;
    `;

    return jsonResponse({
      success: true,
      message: 'User status fixed',
      updatedUsers: updatedUsers,
      sqlResult: result
    });
  } catch (error) {
    console.error('Fix user status error:', error);
    const message = error instanceof Error ? error.message : 'Failed to fix user status';
    return jsonResponse({ 
      success: false,
      error: 'Failed to fix user status',
      errorMessage: message
    }, 500);
  }
}
