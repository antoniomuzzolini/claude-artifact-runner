import { neon } from '@neondatabase/serverless';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const sql = neon(process.env.DATABASE_URL!);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Add CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    switch (req.method) {
      case 'GET':
        // Get all matches
        const matches = await sql`SELECT * FROM matches ORDER BY created_at DESC`;
        res.status(200).json(matches);
        break;

      case 'POST':
        // Create or update matches (bulk operation)
        const { matches: matchesData } = req.body;
        
        if (!matchesData || !Array.isArray(matchesData)) {
          return res.status(400).json({ error: 'Invalid matches data' });
        }

        // Upsert all matches
        for (const match of matchesData) {
          await sql`
            INSERT INTO matches (id, date, time, team1, team2, winner, team1_score, team2_score, elo_changes)
            VALUES (${match.id}, ${match.date}, ${match.time}, ${match.team1}, ${match.team2}, ${match.winner}, ${match.team1Score}, ${match.team2Score}, ${JSON.stringify(match.eloChanges)})
            ON CONFLICT (id) DO UPDATE SET
              date = EXCLUDED.date,
              time = EXCLUDED.time,
              team1 = EXCLUDED.team1,
              team2 = EXCLUDED.team2,
              winner = EXCLUDED.winner,
              team1_score = EXCLUDED.team1_score,
              team2_score = EXCLUDED.team2_score,
              elo_changes = EXCLUDED.elo_changes
          `;
        }

        res.status(200).json({ success: true, message: 'Matches synced successfully' });
        break;

      case 'DELETE':
        // Clear all matches
        await sql`DELETE FROM matches`;
        res.status(200).json({ success: true, message: 'All matches deleted' });
        break;

      default:
        res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
        res.status(405).end(`Method ${req.method} Not Allowed`);
    }
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ error: 'Database operation failed' });
  }
} 