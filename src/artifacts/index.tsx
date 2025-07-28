import React, { useState, useEffect } from 'react';

// Import types
import { Match, NewMatch, AppData, Player } from '../types/foosball';

// Import hooks
import { useNeonDB } from '../hooks/useNeonDB';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';

// Import utilities
import { 
  getKFactor, 
  calculateMarginFactor, 
  findOrCreatePlayer, 
  validateMatch,
  calculateUnbalancedELO
} from '../utils/gameLogic';

// Import tab components
import RankingsTab from '../components/tabs/RankingsTab';
import NewMatchTab from '../components/tabs/NewMatchTab';
import HistoryTab from '../components/tabs/HistoryTab';
import StorageTab from '../components/tabs/StorageTab';
import UserMenu from '../components/auth/UserMenu';
import AuthWrapper from '../components/auth/AuthWrapper';
import PlayerStatsModal from '../components/PlayerStatsModal';

const ChampionshipManager = () => {
  // Initialize theme early
  useTheme();
  
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
    refreshData,
    deleteMatch
  } = useNeonDB();

  // Local state for UI
  const [newMatch, setNewMatch] = useState<NewMatch>({
    team1: [''],
    team2: [''],
    team1Score: 0,
    team2Score: 0
  });
  const [activeTab, setActiveTab] = useState<'rankings' | 'new-match' | 'history' | 'storage'>('rankings');
  const [matchFilterPlayer, setMatchFilterPlayer] = useState<string>('');
  
  // Player stats modal state
  const [selectedPlayerForStats, setSelectedPlayerForStats] = useState<Player | null>(null);
  const [isPlayerStatsModalOpen, setIsPlayerStatsModalOpen] = useState(false);

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
      newMatch.team1,
      newMatch.team2,
      newMatch.team1Score,
      newMatch.team2Score
    )) {
      alert('Fill in all fields and make sure the scores are different!');
      return;
    }

    // Find or create all players
    const team1Players = newMatch.team1.map(name => 
      findOrCreatePlayer(name, players, setPlayers, organization.id)
    );
    const team2Players = newMatch.team2.map(name => 
      findOrCreatePlayer(name, players, setPlayers, organization.id)
    );

    // Get total points for the match
    let totalPoints = newMatch.team1Score + newMatch.team2Score;
    if (totalPoints === 0) totalPoints = 1;
    const team1Won = newMatch.team1Score > newMatch.team2Score;
    
    // Calculate ELO changes with margin factor
    const marginFactor = calculateMarginFactor(
      Math.abs(newMatch.team1Score - newMatch.team2Score)
    );

    // Calculate ELO changes for each player
    const team1EloChanges: { [name: string]: number } = {};
    const team2EloChanges: { [name: string]: number } = {};
    
    // For team 1 players
    team1Players.forEach(player => {
      const kFactor = getKFactor(player.matches, marginFactor);
      const team2Ratings = team2Players.map(p => p.elo);
      const newElo = calculateUnbalancedELO(
        player.elo,
        team2Ratings,
        newMatch.team1Score / totalPoints,
        kFactor
      );
      team1EloChanges[player.name] = newElo - player.elo;
    });

    // For team 2 players
    team2Players.forEach(player => {
      const kFactor = getKFactor(player.matches, marginFactor);
      const team1Ratings = team1Players.map(p => p.elo);
      const newElo = calculateUnbalancedELO(
        player.elo,
        team1Ratings,
        newMatch.team2Score / totalPoints,
        kFactor
      );
      team2EloChanges[player.name] = newElo - player.elo;
    });

    // Update player stats
    setPlayers(prev => prev.map(p => {
      // Check if player is in team 1
      const team1Player = team1Players.find(tp => tp.id === p.id);
      if (team1Player) {
        return {
          ...p,
          elo: p.elo + team1EloChanges[p.name],
          matches: p.matches + 1,
          wins: p.wins + (team1Won ? 1 : 0),
          losses: p.losses + (team1Won ? 0 : 1)
        };
      }
      
      // Check if player is in team 2
      const team2Player = team2Players.find(tp => tp.id === p.id);
      if (team2Player) {
        return {
          ...p,
          elo: p.elo + team2EloChanges[p.name],
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
      team1: newMatch.team1.slice(), // Copy arrays
      team2: newMatch.team2.slice(),
      winner: team1Won ? 'team1' : 'team2',
      team1Score: newMatch.team1Score,
      team2Score: newMatch.team2Score,
      eloChanges: {
        ...team1EloChanges,
        ...team2EloChanges
      },
      createdBy: user?.id,
      organization_id: organization.id
    };

    setMatches(prev => [match, ...prev]);

    // Reset form
    setNewMatch({
      team1: [''],
      team2: [''],
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

  // Handle opening player stats modal
  const handlePlayerStatsClick = (playerName: string) => {
    const player = players.find(p => p.name === playerName);
    if (player) {
      setSelectedPlayerForStats(player);
      setIsPlayerStatsModalOpen(true);
    }
  };

  // Close player stats modal
  const closePlayerStatsModal = () => {
    setIsPlayerStatsModalOpen(false);
    setSelectedPlayerForStats(null);
  };

  // Handle match deletion
  const handleDeleteMatch = async (match: Match) => {
    const confirmMessage = `Are you sure you want to delete this match?\n\nDate: ${match.date} ${match.time}\nTeams: ${match.team1.join(', ')} vs ${match.team2.join(', ')}\nScore: ${match.team1Score} - ${match.team2Score}`;
    
    if (window.confirm(confirmMessage)) {
      const success = await deleteMatch(match.id);
      if (success) {
        // Optionally recalculate ELO ratings after deletion
        // This would require implementing ELO recalculation logic
      }
    }
  };

  // Update document title with organization name
  useEffect(() => {
    document.title = organization?.name || 'Championship Manager';
  }, [organization?.name]);

  // Recalculate ELO from scratch (superuser only)
  const recalculateELO = async () => {
    if (!organization) return;

    try {
      // Create a copy of all players and reset their ELO to 1200
      const resetPlayers = players.map(player => ({
        ...player,
        elo: 1200,
        matches: 0,
        wins: 0,
        losses: 0
      }));

      // Sort matches by date and time chronologically
      const sortedMatches = [...matches].sort((a, b) => {
        const dateA = new Date(`${a.date} ${a.time}`);
        const dateB = new Date(`${b.date} ${b.time}`);
        return dateA.getTime() - dateB.getTime();
      });

      // Process each match and recalculate ELO
      const updatedMatches = [];
      let currentPlayers = [...resetPlayers];

      for (const match of sortedMatches) {
        // Find all players involved in this match
        const team1Players = match.team1.map(name => 
          currentPlayers.find(p => p.name === name)
        ).filter(Boolean) as Player[];
        
        const team2Players = match.team2.map(name => 
          currentPlayers.find(p => p.name === name)
        ).filter(Boolean) as Player[];

        // Skip if any players are missing
        if (team1Players.length !== match.team1.length || team2Players.length !== match.team2.length) {
          continue;
        }

        // Get total points for the match
        let totalPoints = match.team1Score + match.team2Score;
        if (totalPoints === 0) totalPoints = 1;
        const team1Won = match.team1Score > match.team2Score;

        // Calculate margin factor
        const scoreDifference = Math.abs(match.team1Score - match.team2Score);
        const marginFactor = calculateMarginFactor(scoreDifference);

        // Calculate ELO changes for each player
        const team1EloChanges: { [name: string]: number } = {};
        const team2EloChanges: { [name: string]: number } = {};
        
        // For team 1 players
        team1Players.forEach(player => {
          const kFactor = getKFactor(player.matches, marginFactor);
          const team2Ratings = team2Players.map(p => p.elo);
          const newElo = calculateUnbalancedELO(
            player.elo,
            team2Ratings,
            match.team1Score / totalPoints,
            kFactor
          );
          team1EloChanges[player.name] = newElo - player.elo;
        });

        // For team 2 players
        team2Players.forEach(player => {
          const kFactor = getKFactor(player.matches, marginFactor);
          const team1Ratings = team1Players.map(p => p.elo);
          const newElo = calculateUnbalancedELO(
            player.elo,
            team1Ratings,
            match.team2Score / totalPoints,
            kFactor
          );
          team2EloChanges[player.name] = newElo - player.elo;
        });

        // Update player stats
        const updatePlayerStats = (player: Player, eloChange: number, won: boolean) => {
          const playerIndex = currentPlayers.findIndex(p => p.id === player.id);
          if (playerIndex !== -1) {
            currentPlayers[playerIndex] = {
              ...currentPlayers[playerIndex],
              elo: currentPlayers[playerIndex].elo + eloChange,
              matches: currentPlayers[playerIndex].matches + 1,
              wins: currentPlayers[playerIndex].wins + (won ? 1 : 0),
              losses: currentPlayers[playerIndex].losses + (won ? 0 : 1)
            };
          }
        };

        // Update all team 1 players
        team1Players.forEach(player => {
          updatePlayerStats(player, team1EloChanges[player.name], team1Won);
        });

        // Update all team 2 players
        team2Players.forEach(player => {
          updatePlayerStats(player, team2EloChanges[player.name], !team1Won);
        });

        // Create updated match with new ELO changes
        const updatedMatch = {
          ...match,
          eloChanges: {
            ...team1EloChanges,
            ...team2EloChanges
          }
        };

        updatedMatches.push(updatedMatch);
      }

      // Update state with recalculated data
      setPlayers(currentPlayers);
      setMatches(updatedMatches);

      alert(`ELO recalculation complete! Processed ${updatedMatches.length} matches.`);
    } catch (error) {
      console.error('ELO recalculation error:', error);
      alert('Failed to recalculate ELO. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
      <div className="max-w-6xl mx-auto p-6">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              {organization?.name || 'Championship Manager'}
            </h1>
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
              ...(user?.role === 'superuser' ? [{ id: 'storage', name: 'Backup', icon: '💾' }] : []),
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as 'rankings' | 'new-match' | 'history' | 'storage')}
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
                onPlayerStatsClick={handlePlayerStatsClick}
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
                onDeleteMatch={handleDeleteMatch}
                onPlayerStatsClick={handlePlayerStatsClick}
              />
            )}
            {activeTab === 'storage' && user?.role === 'superuser' && (
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
                onRecalculateELO={recalculateELO}
                isSuperuser={user?.role === 'superuser'}
              />
            )}
          </div>
        </div>
        
        {/* Player Stats Modal */}
        <PlayerStatsModal
          player={selectedPlayerForStats}
          matches={matches}
          isOpen={isPlayerStatsModalOpen}
          onClose={closePlayerStatsModal}
        />
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