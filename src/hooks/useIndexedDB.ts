import { useState, useEffect } from 'react';
import { AppData, Player, Match } from '../types/foosball';

const DB_NAME = 'FoosballManagerDB';
const DB_VERSION = 1;
const STORE_NAME = 'gameData';

export const useIndexedDB = () => {
  const [players, setPlayers] = useState<Player[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  // Initialize IndexedDB
  const initDB = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
    });
  };

  // Save data to IndexedDB
  const saveDataToDB = async (data: AppData) => {
    try {
      const db = await initDB();
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      
      const dbRecord = {
        id: 'foosball-data',
        timestamp: Date.now(),
        data: data,
        lastSaved: new Date().toISOString()
      };
      
      await store.put(dbRecord);
      console.log('Dati salvati automaticamente su IndexedDB');
    } catch (error) {
      console.error('Errore nel salvataggio su IndexedDB:', error);
      throw error;
    }
  };

  // Load data from IndexedDB
  const loadDataFromDB = async (): Promise<AppData | null> => {
    try {
      const db = await initDB();
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      
      return new Promise((resolve, reject) => {
        const request = store.get('foosball-data');
        
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          if (request.result) {
            resolve(request.result.data);
          } else {
            resolve(null);
          }
        };
      });
    } catch (error) {
      console.error('Errore nel caricamento da IndexedDB:', error);
      return null;
    }
  };

  // Export data to file
  const exportDataToFile = async () => {
    try {
      const data: AppData = {
        players,
        matches,
        lastSaved: new Date().toISOString(),
        version: '1.0'
      };
      
      // Also save to IndexedDB for backup
      await saveDataToDB(data);
      
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `artifacts/foosball-data-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      console.log('Dati esportati in file per artifacts folder');
    } catch (error) {
      console.error('Errore nell\'esportazione:', error);
    }
  };

  // Import data from file
  const importDataFromFile = async (data: AppData) => {
    setPlayers(data.players);
    setMatches(data.matches);
    setLastSaved(new Date());
    
    // Save to IndexedDB
    await saveDataToDB({
      ...data,
      lastSaved: new Date().toISOString()
    });
  };

  // Save data automatically
  const saveData = async () => {
    const data: AppData = {
      players,
      matches,
      lastSaved: new Date().toISOString()
    };
    
    await saveDataToDB(data);
    setLastSaved(new Date());
  };

  // Load data on initialization
  const loadData = async () => {
    try {
      const dbData = await loadDataFromDB();
      if (dbData) {
        setPlayers(dbData.players || []);
        setMatches(dbData.matches || []);
        setLastSaved(dbData.lastSaved ? new Date(dbData.lastSaved) : null);
        console.log('Dati caricati da IndexedDB');
      }
    } catch (error) {
      console.error('Errore nel caricamento dei dati:', error);
    }
  };

  // Reset all data
  const resetAll = async () => {
    try {
      const db = await initDB();
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      await store.delete('foosball-data');
      
      setPlayers([]);
      setMatches([]);
      setLastSaved(null);
    } catch (error) {
      console.error('Errore nella cancellazione:', error);
      throw error;
    }
  };

  // Auto-save when data changes
  useEffect(() => {
    if (players.length > 0 || matches.length > 0) {
      saveData();
    }
  }, [players, matches]);

  // Load data on mount
  useEffect(() => {
    loadData();
  }, []);

  return {
    players,
    matches,
    lastSaved,
    setPlayers,
    setMatches,
    exportDataToFile,
    importDataFromFile,
    resetAll
  };
}; 