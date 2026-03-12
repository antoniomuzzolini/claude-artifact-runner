import { neon } from '@neondatabase/serverless';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const corsHeaders = {
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function jsonResponse(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: corsHeaders });
}

export function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders });
}

export async function GET() {
  const diagnostics = {
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    hasDatabaseUrl: !!process.env.DATABASE_URL,
    databaseUrlPrefix: process.env.DATABASE_URL ? process.env.DATABASE_URL.substring(0, 20) + '...' : 'Not found',
  };

  try {
    if (!process.env.DATABASE_URL) {
      return jsonResponse({ 
        ...diagnostics,
        error: 'DATABASE_URL environment variable not found',
        success: false
      }, 500);
    }

    const sql = neon(process.env.DATABASE_URL);
    const result = await sql`SELECT 1 as test, current_timestamp as time`;

    return jsonResponse({ 
      ...diagnostics,
      success: true,
      message: 'Database connection successful',
      testQuery: result[0],
      tablesExist: {
        checked: false,
        note: 'Will check in next step'
      }
    });

  } catch (error) {
    console.error('Database connection error:', error);
    const message = error instanceof Error ? error.message : 'Database connection failed';
    const name = error instanceof Error ? error.name : 'Error';
    return jsonResponse({ 
      ...diagnostics,
      success: false,
      error: 'Database connection failed',
      errorMessage: message,
      errorName: name
    }, 500);
  }
}
