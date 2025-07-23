import { neon } from '@neondatabase/serverless';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const sql = neon(process.env.DATABASE_URL!);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Add CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
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
        // Get all players
        const players = await sql`SELECT * FROM players ORDER BY elo DESC`;
        res.status(200).json(players);
        break;

      case 'POST':
        // Create or update players (bulk operation)
        const { players: playersData } = req.body;
        
        if (!playersData || !Array.isArray(playersData)) {
          return res.status(400).json({ error: 'Invalid players data' });
        }

        // Upsert all players
        for (const player of playersData) {
          await sql`
            INSERT INTO players (id, name, elo, matches, wins, losses)
            VALUES (${player.id}, ${player.name}, ${player.elo}, ${player.matches}, ${player.wins}, ${player.losses})
            ON CONFLICT (id) DO UPDATE SET
              name = EXCLUDED.name,
              elo = EXCLUDED.elo,
              matches = EXCLUDED.matches,
              wins = EXCLUDED.wins,
              losses = EXCLUDED.losses
          `;
        }

        res.status(200).json({ success: true, message: 'Players synced successfully' });
        break;

      case 'DELETE':
        // Clear all players
        await sql`DELETE FROM players`;
        res.status(200).json({ success: true, message: 'All players deleted' });
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