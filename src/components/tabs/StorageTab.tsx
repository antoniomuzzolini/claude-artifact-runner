import React from 'react';
import { Save, Download, Upload } from 'lucide-react';
import { Player, Match } from '../../types/foosball';

interface StorageTabProps {
  players: Player[];
  matches: Match[];
  lastSaved: Date | null;
  onExportData: () => void;
  onImportData: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onResetAll: () => void;
}

const StorageTab: React.FC<StorageTabProps> = ({
  players,
  matches,
  lastSaved,
  onExportData,
  onImportData,
  onResetAll
}) => {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-6">
        <Save className="w-6 h-6 text-purple-500" />
        <h2 className="text-2xl font-bold">Storage IndexedDB</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Status IndexedDB */}
        <div className="bg-white rounded-lg p-6 shadow-sm border">
          <h3 className="font-semibold mb-4 flex items-center gap-2 text-purple-600">
            <Save className="w-5 h-5" />
            Database Status
          </h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Storage:</span>
              <span className="text-sm font-medium text-purple-600">📊 IndexedDB</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Stato:</span>
              <span className="text-sm font-medium text-green-600">✅ Attivo</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Ultimo salvataggio:</span>
              <span className="text-sm">
                {lastSaved ? lastSaved.toLocaleString('it-IT') : 'Mai'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Dati salvati:</span>
              <span className="text-sm">{players.length} giocatori, {matches.length} partite</span>
            </div>
          </div>
          <div className="mt-4 p-3 bg-purple-50 border border-purple-200 rounded-lg">
            <p className="text-sm text-purple-700">
              I dati vengono salvati automaticamente in IndexedDB ad ogni modifica.
            </p>
          </div>
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
              Esporta Dati
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
                  Importa Dati
                </div>
              </label>
            </div>
          </div>
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-700">
              Esporta per backup o importa dati da file JSON.
            </p>
          </div>
        </div>
      </div>

      {/* Opzioni avanzate */}
      <div className="bg-white rounded-lg p-6 shadow-sm border">
        <h3 className="font-semibold mb-4 text-gray-700">Opzioni Avanzate</h3>
        <div className="space-y-4">
          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <h4 className="font-medium text-yellow-800 mb-2">⚠️ Zona Pericolosa</h4>
            <p className="text-sm text-yellow-700 mb-4">
              Questa operazione cancellerà tutti i dati da IndexedDB. Assicurati di aver esportato un backup prima!
            </p>
            <button
              onClick={onResetAll}
              className="bg-red-500 text-white py-2 px-4 rounded-lg hover:bg-red-600 transition-colors text-sm"
            >
              Cancella Tutti i Dati
            </button>
          </div>
          
          <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
            <h4 className="font-medium text-gray-800 mb-2">📋 Informazioni</h4>
            <div className="text-sm text-gray-600 space-y-1">
              <p><strong>Storage:</strong> IndexedDB (database browser)</p>
              <p><strong>Durata:</strong> Permanente fino alla cancellazione manuale</p>
              <p><strong>Accessibilità:</strong> Solo su questo browser e computer</p>
              <p><strong>Capacità:</strong> Diversi GB (molto più di localStorage)</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StorageTab; 