"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { AppData, Player, Match, Season, Tournament } from '../types/championship';
import { useAuth } from './useAuth';

const resolveWinnerIndex = (scores: number[], winnerIndex?: number | null) => {
  if (typeof winnerIndex === 'number' && Number.isFinite(winnerIndex)) return winnerIndex;
  if (!scores.length) return null;
  const maxScore = Math.max(...scores);
  const maxIndexes = scores
    .map((score, index) => ({ score, index }))
    .filter(item => item.score === maxScore)
    .map(item => item.index);
  return maxIndexes.length === 1 ? maxIndexes[0] : null;
};

const normalizeName = (name: string) => name.trim().toLowerCase();
const normalizePlayerId = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const buildPlayerLookup = (players: Player[]) => {
  const byId = new Map<number, Player>();
  const byName = new Map<string, Player>();

  players.forEach(player => {
    byId.set(player.id, player);
    const nameKey = normalizeName(player.name);
    if (nameKey) {
      byName.set(nameKey, player);
    }
  });

  return { byId, byName };
};

const resolvePlayerByName = (
  name: string,
  lookup: ReturnType<typeof buildPlayerLookup>
) => {
  const nameKey = normalizeName(name);
  return lookup.byName.get(nameKey);
};

const normalizeTeams = (
  teams: unknown,
  lookup: ReturnType<typeof buildPlayerLookup>
) => {
  if (!Array.isArray(teams)) return [];
  return teams.map(team => {
    if (!Array.isArray(team)) return [];
    return team.map(entry => {
      if (typeof entry === 'string') {
        const player = resolvePlayerByName(entry, lookup);
        return {
          id: player?.id ?? 0,
          name: player?.name ?? entry
        };
      }

      if (entry && typeof entry === 'object') {
        const rawId = Number((entry as { id?: unknown }).id);
        const rawName = (entry as { name?: unknown }).name;
        const name = typeof rawName === 'string' ? rawName : '';

        if (Number.isFinite(rawId) && rawId > 0) {
          const player = lookup.byId.get(rawId);
          return {
            id: rawId,
            name: name || player?.name || ''
          };
        }

        const player = name ? resolvePlayerByName(name, lookup) : undefined;
        return {
          id: player?.id ?? 0,
          name: player?.name ?? name
        };
      }

      return { id: 0, name: String(entry ?? '') };
    });
  });
};

const normalizeEloChanges = (
  eloChanges: unknown,
  lookup: ReturnType<typeof buildPlayerLookup>
) => {
  const normalized: { [playerId: string]: number } = {};
  if (!eloChanges || typeof eloChanges !== 'object') return normalized;

  for (const [key, value] of Object.entries(eloChanges as Record<string, unknown>)) {
    let playerId = Number(key);
    if (!Number.isFinite(playerId) || playerId <= 0) {
      const player = resolvePlayerByName(key, lookup);
      if (!player) continue;
      playerId = player.id;
    }

    const delta = Number(value);
    normalized[String(playerId)] = Number.isFinite(delta) ? delta : 0;
  }

  return normalized;
};

const normalizeMatch = (
  match: Match,
  lookup: ReturnType<typeof buildPlayerLookup>,
  resolvedSeasonId: number | null
): Match => {
  const parsedSeasonId = Number((match as Match).season_id);
  const matchSeasonId = Number.isFinite(parsedSeasonId)
    ? parsedSeasonId
    : (Number.isFinite(Number(resolvedSeasonId)) ? Number(resolvedSeasonId) : 0);
  const teams = normalizeTeams(match.teams, lookup);
  const rawScores = Array.isArray(match.scores) ? match.scores : [];
  const scores = rawScores.length < teams.length
    ? [...rawScores, ...Array(teams.length - rawScores.length).fill(0)]
    : rawScores;
  const winnerIndex = resolveWinnerIndex(scores, match.winnerIndex ?? null);
  const rawEloChanges = (match as Match).eloChanges ?? (match as Match & { elo_changes?: unknown }).elo_changes ?? {};
  const eloChanges = normalizeEloChanges(rawEloChanges, lookup);
  // BIGINT ids come back from Postgres as strings; tournaments link slots to
  // matches by numeric id, so coerce here
  const parsedMatchId = Number(match.id);

  return {
    ...match,
    id: Number.isFinite(parsedMatchId) ? parsedMatchId : match.id,
    teams,
    scores,
    winnerIndex,
    eloChanges,
    season_id: matchSeasonId
  };
};

const normalizeMatches = (
  rawMatches: Match[],
  rawPlayers: Player[],
  resolvedSeasonId: number | null
) => {
  const lookup = buildPlayerLookup(rawPlayers);
  return rawMatches.map(match => normalizeMatch(match, lookup, resolvedSeasonId));
};

const normalizeTournaments = (raw: unknown): Tournament[] => {
  if (!Array.isArray(raw)) return [];
  return raw
    .map(entry => {
      if (!entry || typeof entry !== 'object') return null;
      const tournament = entry as Tournament;
      const id = Number(tournament.id);
      const seasonId = Number(tournament.season_id);
      if (!Number.isFinite(id)) return null;
      return {
        ...tournament,
        id,
        season_id: Number.isFinite(seasonId) ? seasonId : 0,
        participantIds: Array.isArray(tournament.participantIds)
          ? tournament.participantIds.map(Number).filter(Number.isFinite)
          : [],
        slots: Array.isArray(tournament.slots)
          ? tournament.slots.map(slot => ({
              ...slot,
              matchId: slot.matchId === null || slot.matchId === undefined
                ? null
                : Number(slot.matchId)
            }))
          : [],
        config: tournament.config ?? { pointsWin: 3, pointsDraw: 1 }
      };
    })
    .filter((tournament): tournament is Tournament => !!tournament);
};

export const useNeonDB = () => {
  const { makeAuthenticatedRequest, isAuthenticated, token } = useAuth();
  // Token the in-memory data was loaded with. Guards against saving one
  // organization's state under another organization's session during a switch.
  const loadedTokenRef = useRef<string | null>(null);
  // Exact array instances produced by the last load. Auto-save must only run
  // when the state diverged from these (i.e. a local edit happened): echoing
  // freshly loaded data back to the server lets a stale client (backgrounded
  // mobile tab, live viewer polling) overwrite results recorded elsewhere.
  const loadedSnapshotRef = useRef<{
    players: Player[];
    matches: Match[];
    tournaments: Tournament[];
  } | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [currentSeasonId, setCurrentSeasonId] = useState<number | null>(null);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isAutoSaveEnabled, setIsAutoSaveEnabled] = useState<boolean>(true);

  // Save data directly to cloud database
  const saveData = useCallback(async () => {
    if (!isAuthenticated) {
      setError('Authentication required');
      return false;
    }

    if (!isOnline) {
      setError('Cannot save - database not available');
      return false;
    }

    setIsSyncing(true);
    setError(null);
    
    try {
      const response = await makeAuthenticatedRequest('/api/sync', {
        method: 'POST',
        body: JSON.stringify({
          players,
          matches,
          seasons,
          tournaments,
          currentSeasonId
        }),
      });

      if (response.ok) {
        setLastSaved(new Date());
        console.log('âœ… Data saved to Neon DB');
        return true;
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to save data to database');
        return false;
      }
    } catch (error) {
      console.error('âŒ Error saving data:', error);
      setError('Error saving data to database');
      return false;
    } finally {
      setIsSyncing(false);
    }
  }, [players, matches, seasons, tournaments, currentSeasonId, isOnline, isAuthenticated, makeAuthenticatedRequest]);

  // Load data directly from cloud database
  const loadData = useCallback(async () => {
    if (!isAuthenticated) {
      setError('Authentication required');
      return;
    }

    setIsSyncing(true);
    setError(null);

    try {
      // Check if we can connect to cloud
      const response = await makeAuthenticatedRequest('/api/sync');

      if (response.ok) {
        setIsOnline(true);
        loadedTokenRef.current = token;
        const cloudData = await response.json();
        
        if (cloudData) {
          const parsedSeasonId = Number(cloudData.currentSeasonId);
          const resolvedSeasonId = Number.isFinite(parsedSeasonId) ? parsedSeasonId : null;
          const rawPlayers = Array.isArray(cloudData.players) ? (cloudData.players as Player[]) : [];
          const rawMatches = Array.isArray(cloudData.matches) ? (cloudData.matches as Match[]) : [];
          const rawSeasons = Array.isArray(cloudData.seasons) ? (cloudData.seasons as Season[]) : [];

          const normalizedPlayers = rawPlayers
            .map((player: Player) => {
              const parsedId = normalizePlayerId(player.id);
              if (parsedId === null) return null;
              return {
                ...player,
                id: parsedId,
                organization_id: Number(player.organization_id),
                elo: 1200,
                matches: 0,
                wins: 0,
                losses: 0
              };
            })
            .filter((player): player is Player => !!player);
          const uniquePlayers = Array.from(
            new Map(normalizedPlayers.map(player => [player.id, player])).values()
          );

          const normalizedMatches = normalizeMatches(rawMatches, uniquePlayers, resolvedSeasonId);
          const normalizedTournaments = normalizeTournaments(cloudData.tournaments);

          loadedSnapshotRef.current = {
            players: uniquePlayers,
            matches: normalizedMatches,
            tournaments: normalizedTournaments
          };
          setPlayers(uniquePlayers);
          setMatches(normalizedMatches);
          setSeasons(
            rawSeasons.map((season: Season) => ({
              ...season,
              id: Number(season.id)
            }))
          );
          setTournaments(normalizedTournaments);
          setCurrentSeasonId(resolvedSeasonId);
          setLastSaved(cloudData.lastSaved ? new Date(cloudData.lastSaved) : null);
          console.log('â˜ï¸ Data loaded from Neon DB');
        } else {
          // No data in database yet - start fresh
          loadedSnapshotRef.current = null;
          setPlayers([]);
          setMatches([]);
          setSeasons([]);
          setTournaments([]);
          setCurrentSeasonId(null);
          setLastSaved(null);
          console.log('ðŸ“Š No data found - starting fresh');
        }
      } else {
        setIsOnline(false);
        const errorData = await response.json();
        setError(errorData.error || 'Database not available - please check your connection');
      }
    } catch (error) {
      console.error('âŒ Error loading data:', error);
      setIsOnline(false);
      setError('Error loading data from database');
    } finally {
      setIsSyncing(false);
    }
  }, [isAuthenticated, makeAuthenticatedRequest, token]);

  // When the session token changes (organization switch, re-login), drop the
  // previous organization's data immediately: nothing stale on screen, nothing
  // stale to auto-save
  useEffect(() => {
    if (loadedTokenRef.current && token && loadedTokenRef.current !== token) {
      loadedTokenRef.current = null;
      loadedSnapshotRef.current = null;
      setPlayers([]);
      setMatches([]);
      setSeasons([]);
      setTournaments([]);
      setCurrentSeasonId(null);
    }
  }, [token]);

  // Export data to file
  const exportDataToFile = async () => {
    try {
      const data: AppData = {
        players,
        matches,
        seasons,
        tournaments,
        currentSeasonId,
        lastSaved: new Date().toISOString(),
        version: '1.0'
      };
      
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `championship-data-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      console.log('ðŸ“ Data exported to file');
    } catch (error) {
      console.error('âŒ Error exporting data:', error);
      setError('Error exporting data');
    }
  };

  // Import data from file
  const importDataFromFile = async (data: AppData) => {
    if (!isAuthenticated) {
      setError('Authentication required');
      return;
    }

    if (!isOnline) {
      setError('Cannot import - database not available');
      return;
    }

    setIsSyncing(true);
    setError(null);
    
    try {
      // Update local state
      const parsedSeasonId = Number(data.currentSeasonId);
      const resolvedSeasonId = Number.isFinite(parsedSeasonId) ? parsedSeasonId : null;
      const rawPlayers = Array.isArray(data.players) ? (data.players as Player[]) : [];
      const rawMatches = Array.isArray(data.matches) ? (data.matches as Match[]) : [];
      const rawSeasons = Array.isArray(data.seasons) ? (data.seasons as Season[]) : [];

      const normalizedPlayers = rawPlayers
        .map((player: Player) => {
          const parsedId = normalizePlayerId(player.id);
          if (parsedId === null) return null;
          return {
            ...player,
            id: parsedId,
            organization_id: Number(player.organization_id),
            elo: 1200,
            matches: 0,
            wins: 0,
            losses: 0
          };
        })
        .filter((player): player is Player => !!player);
      const uniquePlayers = Array.from(
        new Map(normalizedPlayers.map(player => [player.id, player])).values()
      );

      const normalizedMatches = normalizeMatches(rawMatches, uniquePlayers, resolvedSeasonId);
      const normalizedTournaments = normalizeTournaments(data.tournaments);

      // Import performs its own explicit POST below; register the snapshot so
      // the auto-save effect doesn't fire a duplicate save for these setStates
      loadedSnapshotRef.current = {
        players: uniquePlayers,
        matches: normalizedMatches,
        tournaments: normalizedTournaments
      };
      setPlayers(uniquePlayers);
      setMatches(normalizedMatches);
      setSeasons(
        rawSeasons.map((season: Season) => ({
          ...season,
          id: Number(season.id)
        }))
      );
      setTournaments(normalizedTournaments);
      setCurrentSeasonId(resolvedSeasonId);
      setLastSaved(new Date());

      // Save to cloud database
      const response = await makeAuthenticatedRequest('/api/sync', {
        method: 'POST',
        body: JSON.stringify({
          players: data.players,
          matches: data.matches,
          seasons: data.seasons || [],
          tournaments: data.tournaments || [],
          currentSeasonId: Number.isFinite(Number(data.currentSeasonId)) ? Number(data.currentSeasonId) : null
        }),
      });
      
      if (response.ok) {
        console.log('âœ… Data imported and saved to Neon DB');
        await loadData();
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to save imported data to database');
      }
    } catch (error) {
      console.error('âŒ Error importing data:', error);
      setError('Error importing data');
    } finally {
      setIsSyncing(false);
    }
  };

  // Reset all data
  const resetAll = async () => {
    if (!isAuthenticated) {
      setError('Authentication required');
      return;
    }

    if (!isOnline) {
      setError('Cannot reset - database not available');
      return;
    }

    setIsSyncing(true);
    setError(null);
    
    try {
      // Clear cloud data
      const response = await makeAuthenticatedRequest('/api/sync', {
        method: 'DELETE',
      });
      
      if (response.ok) {
        setPlayers([]);
        setMatches([]);
        setTournaments([]);
        setLastSaved(null);
        console.log('âœ… All data cleared from Neon DB');
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to clear data from database');
      }
    } catch (error) {
      console.error('âŒ Error resetting data:', error);
      setError('Error clearing data');
      throw error;
    } finally {
      setIsSyncing(false);
    }
  };

  // Force refresh data from database
  const refreshData = async () => {
    await loadData();
  };

  // Delete a specific match
  const deleteMatch = async (matchId: number) => {
    if (!isAuthenticated) {
      setError('Authentication required');
      return false;
    }

    if (!isOnline) {
      setError('Cannot delete - database not available');
      return false;
    }

    setIsSyncing(true);
    setError(null);
    
    try {
      const response = await makeAuthenticatedRequest('/api/matches', {
        method: 'DELETE',
        body: JSON.stringify({ matchId }),
      });
      
      if (response.ok) {
        // Remove match from local state
        setMatches(prev => prev.filter(match => match.id !== matchId));
        console.log('âœ… Match deleted successfully');
        return true;
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to delete match');
        return false;
      }
    } catch (error) {
      console.error('âŒ Error deleting match:', error);
      setError('Error deleting match');
      return false;
    } finally {
      setIsSyncing(false);
    }
  };

  // Delete a specific tournament (its matches remain as regular matches)
  const deleteTournament = async (tournamentId: number) => {
    if (!isAuthenticated) {
      setError('Authentication required');
      return false;
    }

    if (!isOnline) {
      setError('Cannot delete - database not available');
      return false;
    }

    setIsSyncing(true);
    setError(null);

    try {
      const response = await makeAuthenticatedRequest('/api/tournaments', {
        method: 'DELETE',
        body: JSON.stringify({ tournamentId }),
      });

      if (response.ok) {
        setTournaments(prev => prev.filter(tournament => tournament.id !== tournamentId));
        return true;
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to delete tournament');
        return false;
      }
    } catch (error) {
      console.error('Error deleting tournament:', error);
      setError('Error deleting tournament');
      return false;
    } finally {
      setIsSyncing(false);
    }
  };

  // Check connection status periodically
  useEffect(() => {
    if (!isAuthenticated) return;

    const checkConnection = async () => {
      try {
        const response = await makeAuthenticatedRequest('/api/sync');
        const online = response.ok;
        setIsOnline(online);
        
        if (!online && !error) {
          setError('Database connection lost');
        } else if (online && error === 'Database connection lost') {
          setError(null);
        }
      } catch (error) {
        setIsOnline(false);
        if (error !== 'Database connection lost') {
          setError('Database connection lost');
        }
      }
    };

    // No immediate check: loadData already runs on mount/token change and sets
    // isOnline — a parallel duplicate GET here raced with it on brand-new
    // organizations, creating the initial season twice
    const interval = setInterval(checkConnection, 30000);

    return () => clearInterval(interval);
  }, [error, isAuthenticated, makeAuthenticatedRequest]);

  // Auto-save when data changes (only if online and authenticated). Never save
  // data that was loaded with a different token than the current one — during
  // an organization switch that would write the old org's state into the new one.
  useEffect(() => {
    if (!isAutoSaveEnabled) return;
    if (loadedTokenRef.current === null || loadedTokenRef.current !== token) return;
    // Only save state that diverged from the last load (a real local edit).
    // Without this, every load echoed the just-read data back to the server,
    // and a stale client (resumed mobile tab, live viewer) could overwrite
    // results recorded from other devices with its outdated snapshot.
    const snapshot = loadedSnapshotRef.current;
    if (
      snapshot
      && snapshot.players === players
      && snapshot.matches === matches
      && snapshot.tournaments === tournaments
    ) return;
    if ((players.length > 0 || matches.length > 0 || tournaments.length > 0) && isOnline && isAuthenticated) {
      saveData();
    }
  }, [players, matches, tournaments, isOnline, isAuthenticated, saveData, isAutoSaveEnabled, token]);

  // Load data on mount when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      loadData();
    }
  }, [isAuthenticated, loadData]);

  return {
    players,
    matches,
    seasons,
    tournaments,
    currentSeasonId,
    lastSaved,
    isOnline,
    isSyncing,
    isAutoSaveEnabled,
    error,
    setPlayers,
    setMatches,
    setSeasons,
    setTournaments,
    setCurrentSeasonId,
    setIsAutoSaveEnabled,
    exportDataToFile,
    importDataFromFile,
    resetAll,
    refreshData,
    saveData, // Expose for manual save
    deleteMatch,
    deleteTournament
  };
}; 
