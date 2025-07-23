import { neon } from '@neondatabase/serverless';
import jwt from 'jsonwebtoken';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const sql = neon(process.env.DATABASE_URL!);
const JWT_SECRET = process.env.JWT_SECRET || 'your-fallback-secret-key-change-in-production';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Add CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
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
        // Get all data from database for the user's organization
        const [players, matches] = await Promise.all([
          sql`
            SELECT * FROM players 
            WHERE organization_id = ${currentUser.organizationId}
            ORDER BY elo DESC
          `,
          sql`
            SELECT * FROM matches 
            WHERE organization_id = ${currentUser.organizationId}
            ORDER BY created_at DESC
          `
        ]);

        // Transform matches data back to frontend format
        const transformedMatches = matches.map(match => ({
          ...match,
          team1Score: match.team1_score,
          team2Score: match.team2_score,
          eloChanges: match.elo_changes,
          createdBy: match.created_by
        }));

        res.status(200).json({
          players,
          matches: transformedMatches,
          lastSaved: new Date().toISOString()
        });
        break;

      case 'POST':
        // Sync all data to database for the user's organization
        const { players: playersData, matches: matchesData } = req.body;
        
        if (!playersData || !matchesData) {
          return res.status(400).json({ error: 'Invalid data format' });
        }

        // Sync players (only for this organization)
        if (Array.isArray(playersData)) {
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
        }

        // Sync matches (only for this organization)
        if (Array.isArray(matchesData)) {
          for (const match of matchesData) {
            await sql`
              INSERT INTO matches (id, date, time, team1, team2, winner, team1_score, team2_score, elo_changes, created_by, organization_id)
              VALUES (${match.id}, ${match.date}, ${match.time}, ${match.team1}, ${match.team2}, ${match.winner}, ${match.team1Score}, ${match.team2Score}, ${JSON.stringify(match.eloChanges)}, ${match.createdBy || currentUser.userId}, ${currentUser.organizationId})
              ON CONFLICT (id) DO UPDATE SET
                date = EXCLUDED.date,
                time = EXCLUDED.time,
                team1 = EXCLUDED.team1,
                team2 = EXCLUDED.team2,
                winner = EXCLUDED.winner,
                team1_score = EXCLUDED.team1_score,
                team2_score = EXCLUDED.team2_score,
                elo_changes = EXCLUDED.elo_changes,
                created_by = EXCLUDED.created_by
              WHERE matches.organization_id = ${currentUser.organizationId}
            `;
          }
        }

        res.status(200).json({ 
          success: true, 
          message: `Synced ${playersData.length} players and ${matchesData.length} matches` 
        });
        break;

      case 'DELETE':
        // Reset all data for the user's organization only
        await Promise.all([
          sql`DELETE FROM matches WHERE organization_id = ${currentUser.organizationId}`,
          sql`DELETE FROM players WHERE organization_id = ${currentUser.organizationId}`
        ]);
        
        res.status(200).json({ success: true, message: 'All data cleared for your organization' });
        break;

      default:
        res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
        res.status(405).end(`Method ${req.method} Not Allowed`);
    }
  } catch (error) {
    console.error('Sync error:', error);
    res.status(500).json({ error: 'Sync operation failed', details: error.message });
  }
} 