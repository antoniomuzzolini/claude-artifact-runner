import { useState, useEffect, useCallback } from 'react';
import { AppData, Player, Match } from '../types/foosball';
import { dbAPI } from '../lib/database';

export const useNeonDB = () => {
  const [players, setPlayers] = useState<Player[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Save data directly to cloud database
  const saveData = useCallback(async () => {
    if (!isOnline) {
      setError('Cannot save - database not available');
      return false;
    }

    setIsSyncing(true);
    setError(null);
    
    try {
      const data: AppData = {
        players,
        matches,
        lastSaved: new Date().toISOString()
      };
      
      const success = await dbAPI.syncData(data);
      
      if (success) {
        setLastSaved(new Date());
        console.log('✅ Data saved to Neon DB');
        return true;
      } else {
        setError('Failed to save data to database');
        return false;
      }
    } catch (error) {
      console.error('❌ Error saving data:', error);
      setError('Error saving data to database');
      return false;
    } finally {
      setIsSyncing(false);
    }
  }, [players, matches, isOnline]);

  // Load data directly from cloud database
  const loadData = useCallback(async () => {
    setIsSyncing(true);
    setError(null);
    
    try {
      // Check if we can connect to cloud
      const cloudAvailable = await dbAPI.isOnline();
      setIsOnline(cloudAvailable);

      if (!cloudAvailable) {
        setError('Database not available - please check your internet connection');
        setIsSyncing(false);
        return;
      }

      // Load from cloud database
      const cloudData = await dbAPI.loadData();
      
      if (cloudData) {
        setPlayers(cloudData.players || []);
        setMatches(cloudData.matches || []);
        setLastSaved(cloudData.lastSaved ? new Date(cloudData.lastSaved) : null);
        console.log('☁️ Data loaded from Neon DB');
      } else {
        // No data in database yet - start fresh
        setPlayers([]);
        setMatches([]);
        setLastSaved(null);
        console.log('📊 No data found - starting fresh');
      }
    } catch (error) {
      console.error('❌ Error loading data:', error);
      setError('Error loading data from database');
    } finally {
      setIsSyncing(false);
    }
  }, []);

  // Export data to file
  const exportDataToFile = async () => {
    try {
      const data: AppData = {
        players,
        matches,
        lastSaved: new Date().toISOString(),
        version: '1.0'
      };
      
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `foosball-data-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      console.log('📁 Data exported to file');
    } catch (error) {
      console.error('❌ Error exporting data:', error);
      setError('Error exporting data');
    }
  };

  // Import data from file
  const importDataFromFile = async (data: AppData) => {
    if (!isOnline) {
      setError('Cannot import - database not available');
      return;
    }

    setIsSyncing(true);
    setError(null);
    
    try {
      // Update local state
      setPlayers(data.players);
      setMatches(data.matches);
      setLastSaved(new Date());
      
      // Save to cloud database
      const success = await dbAPI.syncData({
        ...data,
        lastSaved: new Date().toISOString()
      });
      
      if (success) {
        console.log('✅ Data imported and saved to Neon DB');
      } else {
        setError('Failed to save imported data to database');
      }
    } catch (error) {
      console.error('❌ Error importing data:', error);
      setError('Error importing data');
    } finally {
      setIsSyncing(false);
    }
  };

  // Reset all data
  const resetAll = async () => {
    if (!isOnline) {
      setError('Cannot reset - database not available');
      return;
    }

    setIsSyncing(true);
    setError(null);
    
    try {
      // Clear cloud data
      const success = await dbAPI.clearData();
      
      if (success) {
        setPlayers([]);
        setMatches([]);
        setLastSaved(null);
        console.log('✅ All data cleared from Neon DB');
      } else {
        setError('Failed to clear data from database');
      }
    } catch (error) {
      console.error('❌ Error resetting data:', error);
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

  // Check connection status periodically
  useEffect(() => {
    const checkConnection = async () => {
      const online = await dbAPI.isOnline();
      setIsOnline(online);
      
      if (!online && !error) {
        setError('Database connection lost');
      } else if (online && error === 'Database connection lost') {
        setError(null);
      }
    };

    // Check immediately
    checkConnection();

    // Check every 30 seconds
    const interval = setInterval(checkConnection, 30000);
    
    return () => clearInterval(interval);
  }, [error]);

  // Auto-save when data changes (only if online)
  useEffect(() => {
    if ((players.length > 0 || matches.length > 0) && isOnline) {
      saveData();
    }
  }, [players, matches, isOnline, saveData]);

  // Load data on mount
  useEffect(() => {
    loadData();
  }, [loadData]);

  return {
    players,
    matches,
    lastSaved,
    isOnline,
    isSyncing,
    error,
    setPlayers,
    setMatches,
    exportDataToFile,
    importDataFromFile,
    resetAll,
    refreshData,
    saveData // Expose for manual save
  };
}; 