import { neon } from '@neondatabase/serverless';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Add CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const diagnostics = {
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    hasDatabaseUrl: !!process.env.DATABASE_URL,
    databaseUrlPrefix: process.env.DATABASE_URL ? process.env.DATABASE_URL.substring(0, 20) + '...' : 'Not found',
  };

  try {
    if (!process.env.DATABASE_URL) {
      return res.status(500).json({ 
        ...diagnostics,
        error: 'DATABASE_URL environment variable not found',
        success: false
      });
    }

    // Try to create SQL connection
    const sql = neon(process.env.DATABASE_URL);
    
    // Simple test query
    const result = await sql`SELECT 1 as test, current_timestamp as time`;
    
    return res.status(200).json({ 
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
    return res.status(500).json({ 
      ...diagnostics,
      success: false,
      error: 'Database connection failed',
      errorMessage: error.message,
      errorName: error.name
    });
  }
} 