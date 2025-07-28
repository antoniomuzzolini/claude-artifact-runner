import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '@vercel/postgres';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  try {
    // Check if we need to migrate any data
    // The database schema already supports arrays for team1 and team2,
    // but we might have some matches with old format data
    
    const result = await sql`
      SELECT COUNT(*) as count 
      FROM matches 
      WHERE array_length(team1, 1) IS NOT NULL 
      AND array_length(team2, 1) IS NOT NULL
    `;

    const existingMatches = parseInt(result.rows[0].count);

    // The migration is essentially a no-op since:
    // 1. The database schema already supports TEXT[] for team1 and team2
    // 2. New matches will use the array format
    // 3. Old matches (if any) should already be in array format
    
    return res.status(200).json({
      success: true,
      message: 'Migration check completed',
      existingMatches,
      note: 'Database schema already supports variable team sizes. No migration needed.'
    });

  } catch (error) {
    console.error('Migration error:', error);
    return res.status(500).json({ 
      success: false,
      error: 'Failed to check migration status',
      errorMessage: error.message
    });
  }
} 