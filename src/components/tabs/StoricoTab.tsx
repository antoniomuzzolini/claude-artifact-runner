import React from 'react';
import { Clock, Trash2 } from 'lucide-react';
import { Player, Match } from '../../types/foosball';

interface StoricoTabProps {
  players: Player[];
  matches: Match[];
  matchFilterPlayer: string;
  setMatchFilterPlayer: React.Dispatch<React.SetStateAction<string>>;
  filteredMatches: Match[];
  onPlayerHistoryClick: (playerName: string) => void;
  onDeleteMatch: (match: Match) => void;
  onBackToClassifica: () => void;
}

const StoricoTab: React.FC<StoricoTabProps> = ({
  players,
  matches,
  matchFilterPlayer,
  setMatchFilterPlayer,
  filteredMatches,
  onPlayerHistoryClick,
  onDeleteMatch,
  onBackToClassifica
}) => {
  const sortedPlayers = [...players].sort((a, b) => b.elo - a.elo);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-6">
        <Clock className="w-6 h-6 text-gray-500" />
        <h2 className="text-2xl font-bold">Storico Partite</h2>
      </div>

      {/* Filtro per giocatore */}
      {players.length > 0 && (
        <div className="bg-white rounded-lg p-4 shadow-sm border mb-4">
          <div className="flex items-center gap-4 flex-wrap">
            <label className="text-sm font-medium text-gray-700">Filtra per giocatore:</label>
            <select
              value={matchFilterPlayer}
              onChange={(e) => setMatchFilterPlayer(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white min-w-48"
            >
              <option value="">Tutti i giocatori</option>
              {sortedPlayers.map(player => (
                <option key={player.id} value={player.name}>
                  {player.name} ({player.matches} partite)
                </option>
              ))}
            </select>
            {matchFilterPlayer && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setMatchFilterPlayer('')}
                  className="text-sm text-blue-600 hover:text-blue-800 underline"
                >
                  Rimuovi filtro
                </button>
                <span className="text-gray-300">|</span>
                <button
                  onClick={onBackToClassifica}
                  className="text-sm text-blue-600 hover:text-blue-800 underline"
                >
                  Torna alla classifica
                </button>
              </div>
            )}
          </div>
          {matchFilterPlayer && (
            <div className="mt-2 text-sm text-gray-600">
              Mostrando {filteredMatches.length} di {matches.length} partite per <strong>{matchFilterPlayer}</strong>
              {(() => {
                const playerStats = players.find(p => p.name === matchFilterPlayer);
                const playerWins = filteredMatches.filter(match => 
                  (match.team1.includes(matchFilterPlayer) && match.winner === 'team1') ||
                  (match.team2.includes(matchFilterPlayer) && match.winner === 'team2')
                ).length;
                const winRate = filteredMatches.length > 0 ? Math.round((playerWins / filteredMatches.length) * 100) : 0;
                return playerStats ? (
                  <span className="ml-2">
                    • {playerWins}V-{filteredMatches.length - playerWins}P ({winRate}% vittorie)
                    • ELO: {playerStats.elo}
                  </span>
                ) : null;
              })()}
            </div>
          )}
        </div>
      )}

      {matches.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
          <div className="flex items-center gap-2 text-blue-700">
            <Trash2 className="w-4 h-4" />
            <span className="text-sm">
              <strong>Nota:</strong> Puoi cancellare qualsiasi partita cliccando l'icona del cestino. L'ELO e le statistiche verranno automaticamente ripristinati.
            </span>
          </div>
        </div>
      )}

      {filteredMatches.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
          {matchFilterPlayer ? (
            <div>
              <p>Nessuna partita trovata per <strong>{matchFilterPlayer}</strong></p>
              <button
                onClick={() => setMatchFilterPlayer('')}
                className="mt-2 text-blue-600 hover:text-blue-800 underline text-sm"
              >
                Mostra tutte le partite
              </button>
            </div>
          ) : (
            <p>Nessuna partita ancora giocata</p>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredMatches.map((match) => (
            <div key={match.id} className="bg-white rounded-lg p-4 shadow-sm border">
              <div className="flex justify-between items-start mb-3">
                <div className="text-sm text-gray-500">
                  {match.date} • {match.time}
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-lg font-bold text-gray-800">
                    {match.team1Score || 0} - {match.team2Score || 0}
                    <span className="text-sm font-medium text-green-600 ml-2">
                      ({match.winner === 'team1' ? 'Team 1' : 'Team 2'} vince)
                    </span>
                  </div>
                  <button
                    onClick={() => onDeleteMatch(match)}
                    className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                    title="Cancella partita"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className={`p-3 rounded-lg ${match.winner === 'team1' ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'} border`}>
                  <div className="font-semibold text-blue-600 mb-1 flex justify-between items-center">
                    <span>Team 1</span>
                    <span className="text-xl font-bold">{match.team1Score || 0}</span>
                  </div>
                  <div className="space-y-1">
                    {match.team1.map((player, idx) => (
                      <div key={idx} className={`flex justify-between text-sm ${
                        matchFilterPlayer === player ? 'bg-yellow-100 px-2 py-1 rounded font-medium' : ''
                      }`}>
                        <span>{player}</span>
                        <span className={`font-medium ${match.eloChanges[player] >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {match.eloChanges[player] >= 0 ? '+' : ''}{match.eloChanges[player]}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div className={`p-3 rounded-lg ${match.winner === 'team2' ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'} border`}>
                  <div className="font-semibold text-red-600 mb-1 flex justify-between items-center">
                    <span>Team 2</span>
                    <span className="text-xl font-bold">{match.team2Score || 0}</span>
                  </div>
                  <div className="space-y-1">
                    {match.team2.map((player, idx) => (
                      <div key={idx} className={`flex justify-between text-sm ${
                        matchFilterPlayer === player ? 'bg-yellow-100 px-2 py-1 rounded font-medium' : ''
                      }`}>
                        <span>{player}</span>
                        <span className={`font-medium ${match.eloChanges[player] >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {match.eloChanges[player] >= 0 ? '+' : ''}{match.eloChanges[player]}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default StoricoTab; 