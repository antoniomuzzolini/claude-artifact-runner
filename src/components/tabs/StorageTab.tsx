import React from 'react';
import { Download, Upload, Cloud, Wifi, WifiOff, RefreshCw } from 'lucide-react';
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
        <h2 className="text-2xl font-bold">Cloud Database Storage</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Neon Database Status */}
        <div className="bg-white rounded-lg p-6 shadow-sm border">
          <h3 className="font-semibold mb-4 flex items-center gap-2 text-blue-600">
            <Cloud className="w-5 h-5" />
            Neon Database Status
          </h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Connection:</span>
              <span className={`text-sm font-medium flex items-center gap-1 ${
                error 
                  ? 'text-red-600' 
                  : isOnline 
                    ? 'text-green-600' 
                    : 'text-orange-600'
              }`}>
                {error ? (
                  <>❌ Error</>
                ) : isOnline ? (
                  <><Wifi className="w-4 h-4" /> Connected</>
                ) : (
                  <><WifiOff className="w-4 h-4" /> Connecting...</>
                )}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Database:</span>
              <span className="text-sm font-medium text-blue-600">☁️ Neon PostgreSQL</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Last saved:</span>
              <span className="text-sm">
                {lastSaved ? lastSaved.toLocaleString('en-US') : 'Never'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Data:</span>
              <span className="text-sm">{players.length} players, {matches.length} matches</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Status:</span>
              <span className={`text-sm font-medium ${
                error 
                  ? 'text-red-600' 
                  : isSyncing 
                    ? 'text-blue-600' 
                    : 'text-green-600'
              }`}>
                {error ? '❌ Error' : isSyncing ? '🔄 Syncing...' : '✅ Ready'}
              </span>
            </div>
          </div>
          <div className={`mt-4 p-3 border rounded-lg ${
            error 
              ? 'bg-red-50 border-red-200' 
              : isOnline 
                ? 'bg-green-50 border-green-200' 
                : 'bg-orange-50 border-orange-200'
          }`}>
            <p className={`text-sm ${
              error 
                ? 'text-red-700' 
                : isOnline 
                  ? 'text-green-700' 
                  : 'text-orange-700'
            }`}>
              {error 
                ? `❌ ${error}` 
                : isOnline 
                  ? '☁️ All data is automatically saved to Neon cloud database' 
                  : '🔌 Connecting to cloud database...'
              }
            </p>
          </div>
          {(error || !isOnline) && (
            <button
              onClick={onRefresh}
              disabled={isSyncing}
              className="mt-3 w-full bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600 transition-colors disabled:bg-gray-400 flex items-center justify-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? 'Connecting...' : 'Retry Connection'}
            </button>
          )}
        </div>

        {/* Import/Export */}
        <div className="bg-white rounded-lg p-6 shadow-sm border">
          <h3 className="font-semibold mb-4 flex items-center gap-2 text-blue-600">
            <Download className="w-5 h-5" />
            Import/Export
          </h3>
          <div className="space-y-4">
            <button
              onClick={onExportData}
              className="w-full bg-blue-500 text-white py-3 px-4 rounded-lg hover:bg-blue-600 transition-colors flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" />
              Export Data
            </button>
            
            <div className="text-center">
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept=".json"
                  onChange={onImportData}
                  className="hidden"
                />
                <div className="w-full bg-green-500 text-white py-3 px-4 rounded-lg hover:bg-green-600 transition-colors flex items-center justify-center gap-2">
                  <Upload className="w-4 h-4" />
                  Import Data
                </div>
              </label>
            </div>
          </div>
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-700">
              Export for backup or import data from JSON file.
            </p>
          </div>
        </div>
      </div>

      {/* Advanced options */}
      <div className="bg-white rounded-lg p-6 shadow-sm border">
        <h3 className="font-semibold mb-4 text-gray-700">Advanced Options</h3>
        <div className="space-y-4">
          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <h4 className="font-medium text-yellow-800 mb-2">⚠️ Danger Zone</h4>
            <p className="text-sm text-yellow-700 mb-4">
              This will permanently delete all data from the cloud database. Export a backup first!
            </p>
            <button
              onClick={onResetAll}
              disabled={!isOnline}
              className="bg-red-500 text-white py-2 px-4 rounded-lg hover:bg-red-600 transition-colors text-sm disabled:bg-gray-400"
            >
              Delete All Data
            </button>
          </div>
          
          <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
            <h4 className="font-medium text-gray-800 mb-2">📋 Storage Information</h4>
            <div className="text-sm text-gray-600 space-y-1">
              <p><strong>Database:</strong> Neon PostgreSQL (serverless)</p>
              <p><strong>Storage:</strong> Cloud-only (no local storage)</p>
              <p><strong>Sync:</strong> Immediate cloud saves</p>
              <p><strong>Accessibility:</strong> Available on any device with internet</p>
              <p><strong>Requirements:</strong> Internet connection required</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StorageTab; 