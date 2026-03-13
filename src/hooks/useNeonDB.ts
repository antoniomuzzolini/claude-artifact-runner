"use client";

import { useState, useEffect, useCallback } from 'react';
import { AppData, Player, Match, Season } from '../types/foosball';
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

const normalizeMatch = (match: Match): Match => {
  const teams = Array.isArray(match.teams) ? match.teams : [];
  const rawScores = Array.isArray(match.scores) ? match.scores : [];
  const scores = rawScores.length < teams.length
    ? [...rawScores, ...Array(teams.length - rawScores.length).fill(0)]
    : rawScores;
  const winnerIndex = resolveWinnerIndex(scores, match.winnerIndex ?? null);

  return {
    ...match,
    teams,
    scores,
    winnerIndex,
    eloChanges: match.eloChanges ?? {}
  };
};

export const useNeonDB = () => {
  const { makeAuthenticatedRequest, isAuthenticated } = useAuth();
  const [players, setPlayers] = useState<Player[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [currentSeasonId, setCurrentSeasonId] = useState<number | null>(null);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

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
  }, [players, matches, seasons, currentSeasonId, isOnline, isAuthenticated, makeAuthenticatedRequest]);

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
        const cloudData = await response.json();
        
        if (cloudData) {
          const parsedSeasonId = Number(cloudData.currentSeasonId);
          const resolvedSeasonId = Number.isFinite(parsedSeasonId) ? parsedSeasonId : null;
          const rawPlayers = Array.isArray(cloudData.players) ? (cloudData.players as Player[]) : [];
          const rawMatches = Array.isArray(cloudData.matches) ? (cloudData.matches as Match[]) : [];
          const rawSeasons = Array.isArray(cloudData.seasons) ? (cloudData.seasons as Season[]) : [];

          setPlayers(
            rawPlayers.map((player: Player) => {
              const parsedPlayerSeason = Number(player.season_id);
              return {
                ...player,
                season_id: Number.isFinite(parsedPlayerSeason)
                  ? parsedPlayerSeason
                  : (resolvedSeasonId ?? player.season_id)
              };
            })
          );
          setMatches(
            rawMatches.map((match: Match) => {
              const parsedMatchSeason = Number(match.season_id);
              return {
                ...normalizeMatch(match),
                season_id: Number.isFinite(parsedMatchSeason)
                  ? parsedMatchSeason
                  : (resolvedSeasonId ?? match.season_id)
              };
            })
          );
          setSeasons(
            rawSeasons.map((season: Season) => ({
              ...season,
              id: Number(season.id)
            }))
          );
          setCurrentSeasonId(resolvedSeasonId);
          setLastSaved(cloudData.lastSaved ? new Date(cloudData.lastSaved) : null);
          console.log('â˜ï¸ Data loaded from Neon DB');
        } else {
          // No data in database yet - start fresh
          setPlayers([]);
          setMatches([]);
          setSeasons([]);
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
  }, [isAuthenticated, makeAuthenticatedRequest]);

  // Export data to file
  const exportDataToFile = async () => {
    try {
      const data: AppData = {
        players,
        matches,
        seasons,
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

      setPlayers(
        rawPlayers.map((player: Player) => {
          const parsedPlayerSeason = Number(player.season_id);
          return {
            ...player,
            season_id: Number.isFinite(parsedPlayerSeason)
              ? parsedPlayerSeason
              : (resolvedSeasonId ?? player.season_id)
          };
        })
      );
      setMatches(
        rawMatches.map((match: Match) => {
          const parsedMatchSeason = Number(match.season_id);
          return {
            ...normalizeMatch(match),
            season_id: Number.isFinite(parsedMatchSeason)
              ? parsedMatchSeason
              : (resolvedSeasonId ?? match.season_id)
          };
        })
      );
      setSeasons(
        rawSeasons.map((season: Season) => ({
          ...season,
          id: Number(season.id)
        }))
      );
      setCurrentSeasonId(resolvedSeasonId);
      setLastSaved(new Date());
      
      // Save to cloud database
      const response = await makeAuthenticatedRequest('/api/sync', {
        method: 'POST',
        body: JSON.stringify({
          players: data.players,
          matches: data.matches,
          seasons: data.seasons || [],
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

    // Check immediately
    checkConnection();

    // Check every 30 seconds
    const interval = setInterval(checkConnection, 30000);
    
    return () => clearInterval(interval);
  }, [error, isAuthenticated, makeAuthenticatedRequest]);

  // Auto-save when data changes (only if online and authenticated)
  useEffect(() => {
    if ((players.length > 0 || matches.length > 0) && isOnline && isAuthenticated) {
      saveData();
    }
  }, [players, matches, isOnline, isAuthenticated, saveData]);

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
    currentSeasonId,
    lastSaved,
    isOnline,
    isSyncing,
    error,
    setPlayers,
    setMatches,
    setSeasons,
    setCurrentSeasonId,
    exportDataToFile,
    importDataFromFile,
    resetAll,
    refreshData,
    saveData, // Expose for manual save
    deleteMatch
  };
}; 
