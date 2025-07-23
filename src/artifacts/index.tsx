import React, { useState } from 'react';
import { TrendingUp, Save } from 'lucide-react';

// Import types
import { Player, Match, NewMatch, AppData } from '../types/foosball';

// Import hooks
import { useIndexedDB } from '../hooks/useIndexedDB';

// Import utilities
import { 
  calculateELO, 
  getKFactor, 
  calculateMarginFactor, 
  findOrCreatePlayer, 
  validateMatch 
} from '../utils/gameLogic';

// Import tab components
import ClassificaTab from '../components/tabs/ClassificaTab';
import NuovaPartitaTab from '../components/tabs/NuovaPartitaTab';
import StoricoTab from '../components/tabs/StoricoTab';
import StorageTab from '../components/tabs/StorageTab';

const FoosballManager = () => {
  // Use the custom hook for data management
  const {
    players,
    matches,
    lastSaved,
    setPlayers,
    setMatches,
    exportDataToFile,
    importDataFromFile,
    resetAll
  } = useIndexedDB();

  // Local state for UI
  const [newMatch, setNewMatch] = useState<NewMatch>({
    team1Player1: '',
    team1Player2: '',
    team2Player1: '',
    team2Player2: '',
    team1Score: 0,
    team2Score: 0
  });
  const [activeTab, setActiveTab] = useState('classifica');
  const [matchFilterPlayer, setMatchFilterPlayer] = useState<string>('');

  // Handle file import
  const handleImportFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const result = e.target?.result;
        if (typeof result !== 'string') {
          alert('Errore: il file non è un testo valido!');
          return;
        }
        const data: AppData = JSON.parse(result);

        // Verify format
        if (data.players && data.matches) {
          await importDataFromFile(data);
          alert('Dati importati con successo!');
        } else {
          alert('File di dati non valido!');
        }
      } catch (error) {
        alert('Errore nell\'importazione del file!');
      }
    };
    reader.readAsText(file);
    
    // Reset input
    event.target.value = '';
  };

  // Handle reset with confirmation
  const handleResetAll = async () => {
    if (confirm('Sei sicuro di voler cancellare tutti i dati? Questa operazione non è reversibile!')) {
      try {
        await resetAll();
        alert('Tutti i dati sono stati cancellati!');
      } catch (error) {
        console.error('Errore nella cancellazione:', error);
        alert('Errore nella cancellazione dei dati!');
      }
    }
  };

  // Delete match and revert ELO changes
  const deleteMatch = (matchToDelete: Match) => {
    const matchInfo = `${matchToDelete.team1.join(' & ')} vs ${matchToDelete.team2.join(' & ')} (${matchToDelete.team1Score}-${matchToDelete.team2Score})`;
    if (!confirm(`Sei sicuro di voler cancellare questa partita?\n\n${matchInfo}\n\nL'ELO e le statistiche verranno ripristinati per tutti i giocatori coinvolti.`)) {
      return;
    }

    try {
      // Find all players involved in the match
      const playersInMatch = [
        ...matchToDelete.team1,
        ...matchToDelete.team2
      ];

      // Update players by reverting changes
      setPlayers(prevPlayers => 
        prevPlayers.map(player => {
          if (playersInMatch.includes(player.name)) {
            // Revert ELO change
            const eloChange = matchToDelete.eloChanges[player.name] || 0;
            const newElo = player.elo - eloChange;
            
            // Determine if player was on winning team
            const wasInTeam1 = matchToDelete.team1.includes(player.name);
            const wasInTeam2 = matchToDelete.team2.includes(player.name);
            const teamWon = (wasInTeam1 && matchToDelete.winner === 'team1') ||
                           (wasInTeam2 && matchToDelete.winner === 'team2');
            
            return {
              ...player,
              elo: newElo,
              matches: Math.max(0, player.matches - 1),
              wins: teamWon ? Math.max(0, player.wins - 1) : player.wins,
              losses: !teamWon ? Math.max(0, player.losses - 1) : player.losses
            };
          }
          return player;
        })
      );

      // Remove match from list
      setMatches(prevMatches => 
        prevMatches.filter(match => match.id !== matchToDelete.id)
      );

      alert('Partita cancellata e ELO ripristinato!');
    } catch (error) {
      console.error('Errore nella cancellazione della partita:', error);
      alert('Errore nella cancellazione della partita!');
    }
  };

  // Add new match
  const addMatch = () => {
    if (!validateMatch(
      newMatch.team1Player1,
      newMatch.team1Player2,
      newMatch.team2Player1,
      newMatch.team2Player2,
      newMatch.team1Score,
      newMatch.team2Score
    )) {
      alert('Compila tutti i campi e assicurati che i punteggi siano diversi!');
      return;
    }

    const player1 = findOrCreatePlayer(newMatch.team1Player1, players, setPlayers);
    const player2 = findOrCreatePlayer(newMatch.team1Player2, players, setPlayers);
    const player3 = findOrCreatePlayer(newMatch.team2Player1, players, setPlayers);
    const player4 = findOrCreatePlayer(newMatch.team2Player2, players, setPlayers);

    if (!player1 || !player2 || !player3 || !player4) return;

    // Calculate team average ELO
    const team1Elo = (player1.elo + player2.elo) / 2;
    const team2Elo = (player3.elo + player4.elo) / 2;

    // Determine winners and calculate victory factor based on score
    const team1Won = newMatch.team1Score > newMatch.team2Score;
    
    // Margin factor (the bigger the victory, the more ELO changes)
    const scoreDifference = Math.abs(newMatch.team1Score - newMatch.team2Score);
    const marginFactor = calculateMarginFactor(scoreDifference);
    
    // Calculate result for ELO (1 for win, 0 for loss)
    const team1Result = team1Won ? 1 : 0;
    const team2Result = team1Won ? 0 : 1;

    // Calculate new ELOs
    const newElos: { [playerName: string]: number } = {
      [player1.name]: calculateELO(player1.elo, team2Elo, team1Result, getKFactor(player1.matches, marginFactor)),
      [player2.name]: calculateELO(player2.elo, team2Elo, team1Result, getKFactor(player2.matches, marginFactor)),
      [player3.name]: calculateELO(player3.elo, team1Elo, team2Result, getKFactor(player3.matches, marginFactor)),
      [player4.name]: calculateELO(player4.elo, team1Elo, team2Result, getKFactor(player4.matches, marginFactor))
    };

    // Update players
    setPlayers((prev: Player[]) => prev.map((p: Player) => {
      if (p.id === player1.id) {
        return {
          ...p,
          elo: newElos[player1.name],
          matches: p.matches + 1,
          wins: p.wins + (team1Won ? 1 : 0),
          losses: p.losses + (team1Won ? 0 : 1)
        };
      }
      if (p.id === player2.id) {
        return {
          ...p,
          elo: newElos[player2.name],
          matches: p.matches + 1,
          wins: p.wins + (team1Won ? 1 : 0),
          losses: p.losses + (team1Won ? 0 : 1)
        };
      }
      if (p.id === player3.id) {
        return {
          ...p,
          elo: newElos[player3.name],
          matches: p.matches + 1,
          wins: p.wins + (team1Won ? 0 : 1),
          losses: p.losses + (team1Won ? 1 : 0)
        };
      }
      if (p.id === player4.id) {
        return {
          ...p,
          elo: newElos[player4.name],
          matches: p.matches + 1,
          wins: p.wins + (team1Won ? 0 : 1),
          losses: p.losses + (team1Won ? 1 : 0)
        };
      }
      return p;
    }));

    // Add match to history
    const match: Match = {
      id: Date.now(),
      date: new Date().toLocaleDateString('it-IT'),
      time: new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }),
      team1: [player1.name, player2.name],
      team2: [player3.name, player4.name],
      winner: team1Won ? 'team1' : 'team2',
      team1Score: newMatch.team1Score,
      team2Score: newMatch.team2Score,
      eloChanges: {
        [player1.name]: newElos[player1.name] - player1.elo,
        [player2.name]: newElos[player2.name] - player2.elo,
        [player3.name]: newElos[player3.name] - player3.elo,
        [player4.name]: newElos[player4.name] - player4.elo
      }
    };

    setMatches(prev => [match, ...prev]);

    // Reset form
    setNewMatch({
      team1Player1: '',
      team1Player2: '',
      team2Player1: '',
      team2Player2: '',
      team1Score: 0,
      team2Score: 0
    });

    alert('Partita aggiunta con successo!');
  };

  // Navigate to player history
  const goToPlayerHistory = (playerName: string) => {
    setMatchFilterPlayer(playerName);
    setActiveTab('storico');
  };

  // Filter matches by player
  const filteredMatches = matchFilterPlayer 
    ? matches.filter(match => 
        match.team1.includes(matchFilterPlayer) || 
        match.team2.includes(matchFilterPlayer)
      )
    : matches;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto p-4">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">🏆 Calcetto Manager</h1>
          <p className="text-gray-600">Gestisci la classifica ELO del tuo ufficio</p>
        </div>

        {/* Navigation */}
        <div className="flex justify-center mb-8">
          <div className="bg-white rounded-lg p-1 shadow-sm border">
            <button
              onClick={() => setActiveTab('classifica')}
              className={`px-6 py-2 rounded-md transition-colors ${
                activeTab === 'classifica' 
                  ? 'bg-blue-500 text-white' 
                  : 'text-gray-600 hover:text-blue-500'
              }`}
            >
              Classifica
            </button>
            <button
              onClick={() => setActiveTab('nuova')}
              className={`px-6 py-2 rounded-md transition-colors ${
                activeTab === 'nuova' 
                  ? 'bg-blue-500 text-white' 
                  : 'text-gray-600 hover:text-blue-500'
              }`}
            >
              Nuova Partita
            </button>
            <button
              onClick={() => setActiveTab('storico')}
              className={`px-6 py-2 rounded-md transition-colors ${
                activeTab === 'storico' 
                  ? 'bg-blue-500 text-white' 
                  : 'text-gray-600 hover:text-blue-500'
              }`}
            >
              Storico
            </button>
            <button
              onClick={() => setActiveTab('storage')}
              className={`px-6 py-2 rounded-md transition-colors ${
                activeTab === 'storage' 
                  ? 'bg-blue-500 text-white' 
                  : 'text-gray-600 hover:text-blue-500'
              }`}
            >
              Storage
            </button>
          </div>
        </div>

        {/* Status bar */}
        {lastSaved && (
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 mb-6 flex items-center justify-between">
            <div className="flex items-center gap-2 text-purple-700">
              <Save className="w-4 h-4" />
              <span className="text-sm">
                IndexedDB • Ultimo salvataggio: {lastSaved.toLocaleString('it-IT')}
              </span>
            </div>
            <div className="text-xs text-purple-600">
              {players.length} giocatori • {matches.length} partite
            </div>
          </div>
        )}

        {/* Content */}
        <div className="mb-8">
          {activeTab === 'classifica' && (
            <ClassificaTab 
              players={players} 
              onPlayerClick={goToPlayerHistory} 
            />
          )}
          {activeTab === 'nuova' && (
            <NuovaPartitaTab
              players={players}
              newMatch={newMatch}
              setNewMatch={setNewMatch}
              onAddMatch={addMatch}
            />
          )}
          {activeTab === 'storico' && (
            <StoricoTab
              players={players}
              matches={matches}
              matchFilterPlayer={matchFilterPlayer}
              setMatchFilterPlayer={setMatchFilterPlayer}
              filteredMatches={filteredMatches}
              onDeleteMatch={deleteMatch}
              onBackToClassifica={() => setActiveTab('classifica')}
            />
          )}
          {activeTab === 'storage' && (
            <StorageTab
              players={players}
              matches={matches}
              lastSaved={lastSaved}
              onExportData={exportDataToFile}
              onImportData={handleImportFile}
              onResetAll={handleResetAll}
            />
          )}
        </div>

        {/* Stats */}
        {players.length > 0 && (
          <div className="bg-white rounded-lg p-6 shadow-sm border">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Statistiche Generali
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-blue-600">{players.length}</div>
                <div className="text-sm text-gray-500">Giocatori</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600">{matches.length}</div>
                <div className="text-sm text-gray-500">Partite</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-purple-600">
                  {Math.max(...players.map(p => p.elo), 0)}
                </div>
                <div className="text-sm text-gray-500">ELO Max</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-orange-600">
                  {players.length > 0 ? Math.round(players.reduce((sum, p) => sum + p.elo, 0) / players.length) : 0}
                </div>
                <div className="text-sm text-gray-500">ELO Medio</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FoosballManager;