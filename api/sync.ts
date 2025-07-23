import { neon } from '@neondatabase/serverless';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const sql = neon(process.env.DATABASE_URL!);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Add CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT,HEAD');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method === 'HEAD') {
    res.status(200).end();
    return;
  }

  try {
    switch (req.method) {
      case 'GET':
        // Get all data from database
        const [players, matches] = await Promise.all([
          sql`SELECT * FROM players ORDER BY elo DESC`,
          sql`SELECT * FROM matches ORDER BY created_at DESC`
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
        // Sync all data to database
        const { players: playersData, matches: matchesData } = req.body;
        
        if (!playersData || !matchesData) {
          return res.status(400).json({ error: 'Invalid data format' });
        }

        // Sync players
        if (Array.isArray(playersData)) {
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
        }

        // Sync matches
        if (Array.isArray(matchesData)) {
          for (const match of matchesData) {
            await sql`
              INSERT INTO matches (id, date, time, team1, team2, winner, team1_score, team2_score, elo_changes, created_by)
              VALUES (${match.id}, ${match.date}, ${match.time}, ${match.team1}, ${match.team2}, ${match.winner}, ${match.team1Score}, ${match.team2Score}, ${JSON.stringify(match.eloChanges)}, ${match.createdBy || null})
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
            `;
          }
        }

        res.status(200).json({ 
          success: true, 
          message: `Synced ${playersData.length} players and ${matchesData.length} matches` 
        });
        break;

      case 'DELETE':
        // Reset all data
        await Promise.all([
          sql`DELETE FROM matches`,
          sql`DELETE FROM players`
        ]);
        
        res.status(200).json({ success: true, message: 'All data cleared' });
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