import { neon } from '@neondatabase/serverless';
import jwt from 'jsonwebtoken';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const sql = neon(process.env.DATABASE_URL!);
const JWT_SECRET = process.env.JWT_SECRET || 'your-fallback-secret-key-change-in-production';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Add CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT,HEAD');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method === 'HEAD') {
    res.status(200).end();
    return;
  }

  try {
    // Verify authentication for all operations
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const token = authHeader.substring(7);
    let currentUser;
    
    try {
      currentUser = jwt.verify(token, JWT_SECRET) as any;
    } catch (error) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Check if user has organization
    if (!currentUser.organizationId) {
      return res.status(403).json({ error: 'User must belong to an organization' });
    }

    switch (req.method) {
      case 'GET':
        // Get all players for the user's organization
        const players = await sql`
          SELECT * FROM players 
          WHERE organization_id = ${currentUser.organizationId}
          ORDER BY elo DESC
        `;
        res.status(200).json(players);
        break;

      case 'POST':
        // Create or update players (bulk operation) within organization
        const { players: playersData } = req.body;
        
        if (!playersData || !Array.isArray(playersData)) {
          return res.status(400).json({ error: 'Invalid players data' });
        }

        // Upsert all players with organization context
        for (const player of playersData) {
          await sql`
            INSERT INTO players (id, name, elo, matches, wins, losses, organization_id)
            VALUES (${player.id}, ${player.name}, ${player.elo}, ${player.matches}, ${player.wins}, ${player.losses}, ${currentUser.organizationId})
            ON CONFLICT (id) DO UPDATE SET
              name = EXCLUDED.name,
              elo = EXCLUDED.elo,
              matches = EXCLUDED.matches,
              wins = EXCLUDED.wins,
              losses = EXCLUDED.losses
            WHERE players.organization_id = ${currentUser.organizationId}
          `;
        }

        res.status(200).json({ success: true, message: 'Players synced successfully' });
        break;

      case 'DELETE':
        // Clear all players for the user's organization only
        await sql`
          DELETE FROM players 
          WHERE organization_id = ${currentUser.organizationId}
        `;
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