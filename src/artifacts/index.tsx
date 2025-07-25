import React, { useState } from 'react';

// Import types
import { Match, NewMatch, AppData } from '../types/foosball';

// Import hooks
import { useNeonDB } from '../hooks/useNeonDB';
import { useAuth } from '../hooks/useAuth';

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
import UserMenu from '../components/auth/UserMenu';
import AuthWrapper from '../components/auth/AuthWrapper';

const ChampionshipManager = () => {
  // Use authentication context
  const { user, organization } = useAuth();
  
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

  // Add new match
  const addMatch = () => {
    if (!organization) {
      alert('Organization context not available!');
      return;
    }

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

    const player1 = findOrCreatePlayer(newMatch.team1Player1, players, setPlayers, organization.id);
    const player2 = findOrCreatePlayer(newMatch.team1Player2, players, setPlayers, organization.id);
    const player3 = findOrCreatePlayer(newMatch.team2Player1, players, setPlayers, organization.id);
    const player4 = findOrCreatePlayer(newMatch.team2Player2, players, setPlayers, organization.id);

    // Determine winner
    const team1Won = newMatch.team1Score > newMatch.team2Score;

    // Calculate ELO changes with margin factor
    const marginFactor = calculateMarginFactor(
      Math.abs(newMatch.team1Score - newMatch.team2Score)
    );

    const team1Elo = (player1.elo + player2.elo) / 2;
    const team2Elo = (player3.elo + player4.elo) / 2;

    // Get K-factors based on experience
    const player1K = getKFactor(player1.matches);
    const player2K = getKFactor(player2.matches);
    const player3K = getKFactor(player3.matches);
    const player4K = getKFactor(player4.matches);

    // Calculate ELO changes for each player
    const player1NewElo = calculateELO(player1.elo, team2Elo, team1Won ? 1 : 0, player1K * marginFactor);
    const player2NewElo = calculateELO(player2.elo, team2Elo, team1Won ? 1 : 0, player2K * marginFactor);
    const player3NewElo = calculateELO(player3.elo, team1Elo, team1Won ? 0 : 1, player3K * marginFactor);
    const player4NewElo = calculateELO(player4.elo, team1Elo, team1Won ? 0 : 1, player4K * marginFactor);

    // Calculate changes
    const player1Change = player1NewElo - player1.elo;
    const player2Change = player2NewElo - player2.elo;
    const player3Change = player3NewElo - player3.elo;
    const player4Change = player4NewElo - player4.elo;

    // Update player stats
    setPlayers(prev => prev.map(p => {
      if (p.id === player1.id) {
        return {
          ...p,
          elo: player1NewElo,
          matches: p.matches + 1,
          wins: p.wins + (team1Won ? 1 : 0),
          losses: p.losses + (team1Won ? 0 : 1)
        };
      }
      if (p.id === player2.id) {
        return {
          ...p,
          elo: player2NewElo,
          matches: p.matches + 1,
          wins: p.wins + (team1Won ? 1 : 0),
          losses: p.losses + (team1Won ? 0 : 1)
        };
      }
      if (p.id === player3.id) {
        return {
          ...p,
          elo: player3NewElo,
          matches: p.matches + 1,
          wins: p.wins + (team1Won ? 0 : 1),
          losses: p.losses + (team1Won ? 1 : 0)
        };
      }
      if (p.id === player4.id) {
        return {
          ...p,
          elo: player4NewElo,
          matches: p.matches + 1,
          wins: p.wins + (team1Won ? 0 : 1),
          losses: p.losses + (team1Won ? 1 : 0)
        };
      }
      return p;
    }));

    // Add match to history with creator tracking and organization
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
        [player1.name]: player1Change,
        [player2.name]: player2Change,
        [player3.name]: player3Change,
        [player4.name]: player4Change
      },
      createdBy: user?.id,
      organization_id: organization.id
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

  // Filter matches by player
  const filteredMatches = matchFilterPlayer 
    ? matches.filter(match => 
        match.team1.includes(matchFilterPlayer) || 
        match.team2.includes(matchFilterPlayer)
      )
    : matches;

  // Handle player click from rankings
  const handlePlayerClick = (playerName: string) => {
    setMatchFilterPlayer(playerName);
    setActiveTab('history');
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
      <div className="max-w-6xl mx-auto p-6">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Championship Manager</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">Manage your championship tracking</p>
          </div>
          <UserMenu />
        </div>

        {/* Tabs Navigation */}
        <div className="flex justify-center mb-8">
          <nav className="flex space-x-8" aria-label="Tabs">
            {[
              { id: 'rankings', name: 'Rankings', icon: '🏆' },
              { id: 'new-match', name: 'New Match', icon: '➕' },
              { id: 'history', name: 'History', icon: '📊' },
              { id: 'storage', name: 'Backup', icon: '💾' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                } whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm transition-colors duration-200`}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.name}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border dark:border-gray-700 transition-colors duration-200">
          {/* Cloud Database Status */}
          <div className={`border rounded-lg p-3 mb-6 ${
            error 
              ? 'bg-red-50 dark:bg-red-900/50 border-red-200 dark:border-red-800' 
              : isOnline 
                ? 'bg-green-50 dark:bg-green-900/50 border-green-200 dark:border-green-800' 
                : 'bg-orange-50 dark:bg-orange-900/50 border-orange-200 dark:border-orange-800'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${
                  error ? 'bg-red-500' : isOnline ? 'bg-green-500' : 'bg-orange-500'
                }`} />
                <span className={`text-sm font-medium ${
                  error 
                    ? 'text-red-700 dark:text-red-400' 
                    : isOnline 
                      ? 'text-green-700 dark:text-green-400' 
                      : 'text-orange-700 dark:text-orange-400'
                }`}>
                  {error ? 'Error' : isOnline ? 'Online' : 'Connecting...'}
                </span>
              </div>
              {isSyncing && (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600" />
              )}
            </div>
            <div className={`text-xs mt-1 ${
              error 
                ? 'text-red-600 dark:text-red-400' 
                : isOnline 
                  ? 'text-green-600 dark:text-green-400' 
                  : 'text-orange-600 dark:text-orange-400'
            }`}>
              {error || (isOnline ? 'Data automatically synced to cloud' : 'Establishing connection...')}
            </div>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {activeTab === 'rankings' && (
              <RankingsTab 
                players={players} 
                onPlayerClick={handlePlayerClick}
              />
            )}
            {activeTab === 'new-match' && (
              <>
                {error ? (
                  <div className="text-center py-8">
                    <div className="text-red-600 dark:text-red-400 mb-4">
                      ⚠️ Cannot add matches - database error
                    </div>
                    <p className="text-gray-600 dark:text-gray-400">{error}</p>
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
                filteredMatches={filteredMatches}
                players={players}
                matchFilterPlayer={matchFilterPlayer}
                setMatchFilterPlayer={setMatchFilterPlayer}
                onDeleteMatch={() => {}} // Placeholder for now
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
                onResetAll={resetAll}
                onRefresh={refreshData}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Wrap the component with authentication
const AuthenticatedChampionshipManager = () => (
  <AuthWrapper>
    <ChampionshipManager />
  </AuthWrapper>
);

export default AuthenticatedChampionshipManager;