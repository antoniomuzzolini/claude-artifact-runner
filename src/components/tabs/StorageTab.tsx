"use client";

import React, { useEffect, useState } from 'react';
import { Download, Upload, Cloud, Wifi, WifiOff, RefreshCw, Trash2, AlertTriangle } from 'lucide-react';
import { Player, Match, Season } from '../../types/championship';

interface StorageTabProps {
  players: Player[];
  matches: Match[];
  lastSaved: Date | null;
  isOnline: boolean;
  isSyncing: boolean;
  error: string | null;
  minMatchesForRanking: number;
  isSettingsLoading: boolean;
  isSettingsSaving: boolean;
  onUpdateMinMatchesForRanking: (value: number) => Promise<boolean>;
  currentSeason?: Season | null;
  onUpdateCurrentSeasonName?: (name: string) => Promise<boolean>;
  isSeasonSaving?: boolean;
  onExportData: () => void;
  onImportData: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onResetAll: () => void;
  onRefresh: () => Promise<void>;
  onRecalculateELO?: () => void;
  isSuperuser?: boolean;
}

const StorageTab: React.FC<StorageTabProps> = ({
  players,
  matches,
  lastSaved,
  isOnline,
  isSyncing,
  error,
  minMatchesForRanking,
  isSettingsLoading,
  isSettingsSaving,
  onUpdateMinMatchesForRanking,
  currentSeason,
  onUpdateCurrentSeasonName,
  isSeasonSaving = false,
  onExportData,
  onImportData,
  onResetAll,
  onRefresh,
  onRecalculateELO,
  isSuperuser
}) => {
  const [minMatchesInput, setMinMatchesInput] = useState<string>(String(minMatchesForRanking));
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [settingsMessage, setSettingsMessage] = useState<string | null>(null);
  const [seasonNameInput, setSeasonNameInput] = useState<string>(currentSeason?.name || '');
  const [seasonMessage, setSeasonMessage] = useState<string | null>(null);
  const [seasonError, setSeasonError] = useState<string | null>(null);

  useEffect(() => {
    setMinMatchesInput(String(minMatchesForRanking));
  }, [minMatchesForRanking]);

  useEffect(() => {
    setSeasonNameInput(currentSeason?.name || '');
  }, [currentSeason?.name]);

  const handleSaveMinMatches = async () => {
    const parsed = Number.parseInt(minMatchesInput, 10);
    if (Number.isNaN(parsed) || parsed < 0) {
      setSettingsError('Please enter a valid non-negative number.');
      return;
    }
    setSettingsError(null);
    setSettingsMessage(null);
    const success = await onUpdateMinMatchesForRanking(parsed);
    if (!success) {
      setSettingsError('Failed to save settings. Please try again.');
      return;
    }
    setSettingsMessage('Settings saved.');
  };

  const handleSaveSeasonName = async () => {
    if (!onUpdateCurrentSeasonName) return;
    const trimmed = seasonNameInput.trim();
    if (!trimmed) {
      setSeasonError('Please enter a season name.');
      setSeasonMessage(null);
      return;
    }
    setSeasonError(null);
    setSeasonMessage(null);
    const success = await onUpdateCurrentSeasonName(trimmed);
    if (!success) {
      setSeasonError('Failed to update season name. Please try again.');
      return;
    }
    setSeasonMessage('Season name updated.');
  };


  return (
    <div className="space-y-6">
      {isSuperuser && currentSeason && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border dark:border-gray-700 shadow-sm">
          <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Season Settings</h3>
          <div className="flex flex-col gap-3">
            <label className="text-sm text-gray-600 dark:text-gray-300">
              Current season name
            </label>
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <input
                type="text"
                value={seasonNameInput}
                onChange={(e) => setSeasonNameInput(e.target.value)}
                className="w-full sm:w-80 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                disabled={isSeasonSaving}
              />
              <button
                onClick={handleSaveSeasonName}
                disabled={isSeasonSaving}
                className="inline-flex items-center justify-center px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-md hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors duration-200 disabled:bg-gray-400 dark:disabled:bg-gray-600"
              >
                {isSeasonSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
            {seasonError && (
              <p className="text-sm text-red-600 dark:text-red-400">{seasonError}</p>
            )}
            {seasonMessage && (
              <p className="text-sm text-green-600 dark:text-green-400">{seasonMessage}</p>
            )}
          </div>
        </div>
      )}

      {/* Ranking Settings */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border dark:border-gray-700 shadow-sm">
        <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Rankings Settings</h3>
        <div className="flex flex-col gap-3">
          <label className="text-sm text-gray-600 dark:text-gray-300">
            Minimum matches required to appear in rankings
          </label>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <input
              type="number"
              min={0}
              step={1}
              value={minMatchesInput}
              onChange={(e) => setMinMatchesInput(e.target.value)}
              className="w-full sm:w-40 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              disabled={isSettingsLoading || isSettingsSaving}
            />
            <button
              onClick={handleSaveMinMatches}
              disabled={isSettingsLoading || isSettingsSaving}
              className="inline-flex items-center justify-center px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-md hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors duration-200 disabled:bg-gray-400 dark:disabled:bg-gray-600"
            >
              {isSettingsSaving ? 'Saving...' : 'Save'}
            </button>
          </div>
          {settingsError && (
            <p className="text-sm text-red-600 dark:text-red-400">{settingsError}</p>
          )}
          {settingsMessage && (
            <p className="text-sm text-green-600 dark:text-green-400">{settingsMessage}</p>
          )}
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Players with fewer matches will be hidden from the rankings list.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-6">
        <Cloud className="w-6 h-6 text-blue-500" />
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Data Management</h2>
      </div>

      {/* Cloud Status Card */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border dark:border-gray-700 shadow-sm">
        <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Cloud Storage Status</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600 dark:text-gray-300">Connection:</span>
            <div className="flex items-center gap-2">
              {isOnline ? (
                <Wifi className="w-4 h-4 text-green-500" />
              ) : (
                <WifiOff className="w-4 h-4 text-red-500" />
              )}
              <span className={`text-sm font-medium ${
                isOnline ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
              }`}>
                {isOnline ? 'Connected' : 'Offline'}
              </span>
            </div>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600 dark:text-gray-300">Last saved:</span>
            <span className="text-sm text-gray-900 dark:text-white">
              {lastSaved ? lastSaved.toLocaleString('en-UK') : 'Never'}
            </span>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600 dark:text-gray-300">Data:</span>
            <span className="text-sm text-gray-900 dark:text-white">{players.length} players, {matches.length} matches</span>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600 dark:text-gray-300">Status:</span>
            <span className={`text-sm font-medium ${
              error 
                ? 'text-red-600 dark:text-red-400' 
                : isSyncing 
                  ? 'text-blue-600 dark:text-blue-400' 
                  : 'text-green-600 dark:text-green-400'
            }`}>
              {error ? 'Error' : isSyncing ? 'Syncing...' : 'Ready'}
            </span>
          </div>
        </div>
        
        <div className={`mt-4 p-3 border rounded-lg ${
          error 
            ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' 
            : isOnline 
              ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' 
              : 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800'
        }`}>
          <p className={`text-sm ${
            error 
              ? 'text-red-700 dark:text-red-300' 
              : isOnline 
                ? 'text-green-700 dark:text-green-300' 
                : 'text-orange-700 dark:text-orange-300'
          }`}>
            {error 
              ? error 
              : isOnline 
                ? 'All data is automatically saved to cloud database' 
                : 'Connecting to cloud database...'
            }
          </p>
          
          {error && (
            <button
              onClick={onRefresh}
              disabled={isSyncing}
              className="mt-2 inline-flex items-center gap-1 text-sm bg-red-600 dark:bg-red-500 text-white py-1 px-3 rounded hover:bg-red-700 dark:hover:bg-red-600 transition-colors disabled:bg-gray-400 dark:disabled:bg-gray-600"
            >
              <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? 'Retrying...' : 'Retry Connection'}
            </button>
          )}
        </div>
      </div>

      {/* Export/Import Section - Superuser Only */}
      {isSuperuser && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border dark:border-gray-700 shadow-sm">
          <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Backup & Export</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Export Data */}
            <div className="space-y-3">
              <h4 className="font-medium text-gray-900 dark:text-white">Export Data</h4>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Download your data as a JSON file for backup or sharing.
              </p>
              <button
                onClick={onExportData}
                className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-blue-600 dark:bg-blue-500 text-white rounded-md hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
              >
                <Download className="w-4 h-4" />
                Export to File
              </button>
            </div>

            {/* Import Data */}
            <div className="space-y-3">
              <h4 className="font-medium text-gray-900 dark:text-white">Import Data</h4>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Upload a JSON file to restore or merge data.
              </p>
              <label className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-green-600 dark:bg-green-500 text-white rounded-md hover:bg-green-700 dark:hover:bg-green-600 transition-colors duration-200 cursor-pointer focus-within:ring-2 focus-within:ring-green-500 focus-within:ring-offset-2 dark:focus-within:ring-offset-gray-800">
                <Upload className="w-4 h-4" />
                Import from File
                <input
                  type="file"
                  accept=".json"
                  onChange={onImportData}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        </div>
      )}

      {/* ELO Recalculation - Superuser Only */}
      {isSuperuser && onRecalculateELO && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border dark:border-gray-700 shadow-sm">
          <h3 className="text-lg font-semibold mb-4 text-orange-600 dark:text-orange-400">ELO Recalculation</h3>
          
          <div className="space-y-4">
            <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                <div>
                  <p className="text-sm font-medium text-orange-800 dark:text-orange-300 mb-1">
                    Recalculate ELO from scratch
                  </p>
                  <p className="text-xs text-orange-700 dark:text-orange-400">
                    This will reset all players to 1200 ELO and recalculate ratings based on match history in chronological order. All current ELO values will be overwritten.
                  </p>
                </div>
              </div>
            </div>
            
            <div className="space-y-3">
              <div className="text-sm text-gray-600 dark:text-gray-300">
                <strong>What this does:</strong>
                <ul className="list-disc list-inside mt-1 space-y-1 text-xs">
                  <li>Reset all players to starting ELO (1200)</li>
                  <li>Process all matches in chronological order</li>
                  <li>Recalculate ELO changes for each match</li>
                  <li>Update all player rankings and match history</li>
                </ul>
              </div>
              
              <button
                onClick={() => {
                  if (window.confirm('Are you sure you want to recalculate all ELO ratings? This will reset all current ELO values and recalculate from match history.')) {
                    onRecalculateELO();
                  }
                }}
                disabled={isSyncing || !isOnline || matches.length === 0}
                className="flex items-center gap-2 py-2 px-4 bg-orange-600 dark:bg-orange-500 text-white rounded-md hover:bg-orange-700 dark:hover:bg-orange-600 transition-colors duration-200 disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
              >
                <RefreshCw className="w-4 h-4" />
                Recalculate ELO Ratings
              </button>
              
              {matches.length === 0 && (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  No matches available for ELO recalculation
                </p>
              )}
              {!isOnline && (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Database connection required to recalculate ELO
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Danger Zone - Superuser Only */}
      {isSuperuser && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border dark:border-gray-700 shadow-sm">
          <h3 className="text-lg font-semibold mb-4 text-red-600 dark:text-red-400">Danger Zone</h3>
          
          <div className="space-y-3">
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Permanently delete all players and match data. This action cannot be undone.
            </p>
            <button
              onClick={onResetAll}
              disabled={isSyncing || !isOnline}
              className="flex items-center gap-2 py-2 px-4 bg-red-600 dark:bg-red-500 text-white rounded-md hover:bg-red-700 dark:hover:bg-red-600 transition-colors duration-200 disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
            >
              <Trash2 className="w-4 h-4" />
              Reset All Data
            </button>
            {!isOnline && (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Database connection required to reset data
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default StorageTab; 
