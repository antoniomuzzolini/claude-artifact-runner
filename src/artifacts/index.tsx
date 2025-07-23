import React, { useState } from 'react';
import { TrendingUp, Save } from 'lucide-react';

// Import types
import { Player, Match, NewMatch, AppData } from '../types/foosball';

// Import hooks
import { useNeonDB } from '../hooks/useNeonDB';

// Import utilities
import { 
  calculateELO, 
  getKFactor, 
  calculateMarginFactor, 
  findOrCreatePlayer, 
  validateMatch 
} from '../utils/gameLogic';

// Import tab components
import RankingsTab from '../components/tabs/RankingsTab';
import NewMatchTab from '../components/tabs/NewMatchTab';
import HistoryTab from '../components/tabs/HistoryTab';
import StorageTab from '../components/tabs/StorageTab';

const FoosballManager = () => {
  // Use the simplified cloud-only data management
  const {
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
    refreshData
  } = useNeonDB();

  // Local state for UI
  const [newMatch, setNewMatch] = useState<NewMatch>({
    team1Player1: '',
    team1Player2: '',
    team2Player1: '',
    team2Player2: '',
    team1Score: 0,
    team2Score: 0
  });
  const [activeTab, setActiveTab] = useState('rankings');
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
          alert('Error: the file is not valid text!');
          return;
        }
        const data: AppData = JSON.parse(result);

        // Verify format
        if (data.players && data.matches) {
          await importDataFromFile(data);
          alert('Data imported successfully!');
        } else {
          alert('Invalid data file!');
        }
      } catch (error) {
        alert('Error importing file!');
      }
    };
    reader.readAsText(file);
    
    // Reset input
    event.target.value = '';
  };

  // Handle reset with confirmation
  const handleResetAll = async () => {
    if (confirm('Are you sure you want to delete all data? This operation is irreversible!')) {
      try {
        await resetAll();
        alert('All data has been deleted!');
      } catch (error) {
        console.error('Error deleting data:', error);
        alert('Error deleting data!');
      }
    }
  };

  // Delete match and revert ELO changes
  const deleteMatch = (matchToDelete: Match) => {
    const matchInfo = `${matchToDelete.team1.join(' & ')} vs ${matchToDelete.team2.join(' & ')} (${matchToDelete.team1Score}-${matchToDelete.team2Score})`;
    if (!confirm(`Are you sure you want to delete this match?\n\n${matchInfo}\n\nELO and statistics will be restored for all involved players.`)) {
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

      alert('Match deleted and ELO restored!');
    } catch (error) {
      console.error('Error deleting match:', error);
      alert('Error deleting match!');
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
      alert('Fill in all fields and make sure the scores are different!');
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
      date: new Date().toLocaleDateString('en-US'),
      time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
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

    alert('Match added successfully!');
  };

  // Navigate to player history
  const goToPlayerHistory = (playerName: string) => {
    setMatchFilterPlayer(playerName);
    setActiveTab('history');
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
          <h1 className="text-3xl font-bold text-gray-800 mb-2">🏆 Foosball Manager</h1>
          <p className="text-gray-600">Manage your office's ELO rankings</p>
        </div>

        {/* Navigation */}
        <div className="flex justify-center mb-8">
          <div className="bg-white rounded-lg p-1 shadow-sm border">
            <button
              onClick={() => setActiveTab('rankings')}
              className={`px-6 py-2 rounded-md transition-colors ${
                activeTab === 'rankings' 
                  ? 'bg-blue-500 text-white' 
                  : 'text-gray-600 hover:text-blue-500'
              }`}
            >
              Rankings
            </button>
            <button
              onClick={() => setActiveTab('new')}
              className={`px-6 py-2 rounded-md transition-colors ${
                activeTab === 'new' 
                  ? 'bg-blue-500 text-white' 
                  : 'text-gray-600 hover:text-blue-500'
              }`}
            >
              New Match
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-6 py-2 rounded-md transition-colors ${
                activeTab === 'history' 
                  ? 'bg-blue-500 text-white' 
                  : 'text-gray-600 hover:text-blue-500'
              }`}
            >
              History
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

        {/* Cloud Database Status */}
        <div className={`border rounded-lg p-3 mb-6 ${
          error 
            ? 'bg-red-50 border-red-200' 
            : isOnline 
              ? 'bg-green-50 border-green-200' 
              : 'bg-orange-50 border-orange-200'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Save className="w-4 h-4" />
              <span className="text-sm">
                {error ? (
                  <span className="text-red-700">
                    ❌ {error}
                  </span>
                ) : isOnline ? (
                  <span className="text-green-700">
                    ☁️ Neon DB {isSyncing ? '(Syncing...)' : '(Connected)'}
                    {lastSaved && ` • Last saved: ${lastSaved.toLocaleString('en-US')}`}
                  </span>
                ) : (
                  <span className="text-orange-700">
                    🔌 Connecting to database...
                  </span>
                )}
              </span>
            </div>
            <div className="text-xs">
              {players.length} players • {matches.length} matches
            </div>
          </div>
          {error && (
            <div className="mt-2 flex items-center gap-2">
              <button
                onClick={refreshData}
                disabled={isSyncing}
                className="text-xs bg-blue-500 text-white py-1 px-2 rounded hover:bg-blue-600 transition-colors disabled:bg-gray-400"
              >
                {isSyncing ? 'Retrying...' : 'Retry Connection'}
              </button>
            </div>
          )}
        </div>

        {/* Database Error Alert */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-2">
              <div className="text-red-600">⚠️</div>
              <div>
                <h3 className="font-semibold text-red-800">Database Connection Required</h3>
                <p className="text-sm text-red-700 mt-1">
                  This app requires an internet connection to save and load data from the cloud database.
                  Please check your connection and try again.
                </p>
                <button
                  onClick={refreshData}
                  disabled={isSyncing}
                  className="mt-2 bg-red-600 text-white py-1 px-3 rounded text-sm hover:bg-red-700 transition-colors disabled:bg-gray-400"
                >
                  {isSyncing ? 'Retrying...' : 'Retry Connection'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="mb-8">
          {activeTab === 'rankings' && (
            <RankingsTab 
              players={players} 
              onPlayerClick={goToPlayerHistory} 
            />
          )}
          {activeTab === 'new' && (
            <>
              {error ? (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
                  <div className="text-gray-400 mb-4">🔌</div>
                  <h3 className="font-semibold text-gray-700 mb-2">Database Connection Required</h3>
                  <p className="text-sm text-gray-600">
                    Please establish a database connection to add new matches.
                  </p>
                </div>
              ) : (
                <NewMatchTab
                  players={players}
                  newMatch={newMatch}
                  setNewMatch={setNewMatch}
                  onAddMatch={addMatch}
                />
              )}
            </>
          )}
          {activeTab === 'history' && (
            <HistoryTab
              players={players}
              matches={matches}
              matchFilterPlayer={matchFilterPlayer}
              setMatchFilterPlayer={setMatchFilterPlayer}
              filteredMatches={filteredMatches}
              onDeleteMatch={deleteMatch}
              onBackToRankings={() => setActiveTab('rankings')}
            />
          )}
          {activeTab === 'storage' && (
            <StorageTab
              players={players}
              matches={matches}
              lastSaved={lastSaved}
              isOnline={isOnline}
              isSyncing={isSyncing}
              error={error}
              onExportData={exportDataToFile}
              onImportData={handleImportFile}
              onResetAll={handleResetAll}
              onRefresh={refreshData}
            />
          )}
        </div>

        {/* Stats */}
        {players.length > 0 && (
          <div className="bg-white rounded-lg p-6 shadow-sm border">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              General Statistics
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-blue-600">{players.length}</div>
                <div className="text-sm text-gray-500">Players</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600">{matches.length}</div>
                <div className="text-sm text-gray-500">Matches</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-purple-600">
                  {Math.max(...players.map(p => p.elo), 0)}
                </div>
                <div className="text-sm text-gray-500">Max ELO</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-orange-600">
                  {players.length > 0 ? Math.round(players.reduce((sum, p) => sum + p.elo, 0) / players.length) : 0}
                </div>
                <div className="text-sm text-gray-500">Average ELO</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FoosballManager;