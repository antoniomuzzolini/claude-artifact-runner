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
        // Get all matches for the user's organization
        const matches = await sql`
          SELECT * FROM matches 
          WHERE organization_id = ${currentUser.organizationId}
          ORDER BY created_at DESC
        `;
        res.status(200).json(matches);
        break;

      case 'POST':
        // Create or update matches (bulk operation) within organization
        const { matches: matchesData } = req.body;
        
        if (!matchesData || !Array.isArray(matchesData)) {
          return res.status(400).json({ error: 'Invalid matches data' });
        }

        // Upsert all matches with organization and user context
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

        res.status(200).json({ success: true, message: 'Matches synced successfully' });
        break;

      case 'DELETE':
        const { matchId } = req.body;
        
        if (matchId) {
          // Delete specific match - check permissions
          const matchRows = await sql`
            SELECT created_by FROM matches 
            WHERE id = ${matchId} AND organization_id = ${currentUser.organizationId}
            LIMIT 1
          `;
          
          if (matchRows.length === 0) {
            return res.status(404).json({ error: 'Match not found' });
          }
          
          const match = matchRows[0];
          
          // Check if user can delete this match
          const canDelete = currentUser.role === 'superuser' || match.created_by === currentUser.userId;
          
          if (!canDelete) {
            return res.status(403).json({ error: 'You can only delete matches you created' });
          }
          
          // Delete the specific match
          await sql`
            DELETE FROM matches 
            WHERE id = ${matchId} AND organization_id = ${currentUser.organizationId}
          `;
          
          res.status(200).json({ success: true, message: 'Match deleted successfully' });
        } else {
          // Clear all matches for the user's organization only (superuser only)
          if (currentUser.role !== 'superuser') {
            return res.status(403).json({ error: 'Only administrators can delete all matches' });
          }
          
          await sql`
            DELETE FROM matches 
            WHERE organization_id = ${currentUser.organizationId}
          `;
          res.status(200).json({ success: true, message: 'All matches deleted' });
        }
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