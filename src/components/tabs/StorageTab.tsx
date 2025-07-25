import React from 'react';
import { Download, Upload, Cloud, Wifi, WifiOff, RefreshCw, Trash2 } from 'lucide-react';
import { Player, Match } from '../../types/foosball';

interface StorageTabProps {
  players: Player[];
  matches: Match[];
  lastSaved: Date | null;
  isOnline: boolean;
  isSyncing: boolean;
  error: string | null;
  onExportData: () => void;
  onImportData: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onResetAll: () => void;
  onRefresh: () => Promise<void>;
}

const StorageTab: React.FC<StorageTabProps> = ({
  players,
  matches,
  lastSaved,
  isOnline,
  isSyncing,
  error,
  onExportData,
  onImportData,
  onResetAll,
  onRefresh
}) => {
  return (
    <div className="space-y-6">
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
              {lastSaved ? lastSaved.toLocaleString('en-US') : 'Never'}
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
              {error ? '❌ Error' : isSyncing ? '🔄 Syncing...' : '✅ Ready'}
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
              ? `❌ ${error}` 
              : isOnline 
                ? '☁️ All data is automatically saved to cloud database' 
                : '🔌 Connecting to cloud database...'
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

      {/* Export/Import Section */}
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

      {/* Danger Zone */}
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
    </div>
  );
};

export default StorageTab; 