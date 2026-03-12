"use client";

import React, { useState, useEffect } from 'react';
import { Trophy, PlusCircle, BarChart3, Settings, Calendar, ChevronDown } from 'lucide-react';

// Import types
import { Match, NewMatch, AppData, Player } from '../types/foosball';

// Import hooks
import { useNeonDB } from '../hooks/useNeonDB';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import { useSettings } from '../hooks/useSettings';

// Import utilities
import { 
  findOrCreatePlayer, 
  validateMatch,
  calculateELODifference
} from '../utils/gameLogic';

// Import tab components
import RankingsTab from '../components/tabs/RankingsTab';
import NewMatchTab from '../components/tabs/NewMatchTab';
import HistoryTab from '../components/tabs/HistoryTab';
import StorageTab from '../components/tabs/StorageTab';
import SeasonsTab from '../components/tabs/SeasonsTab';
import UserMenu from '../components/auth/UserMenu';
import AuthWrapper from '../components/auth/AuthWrapper';
import PlayerStatsModal from '../components/PlayerStatsModal';

const ChampionshipManager = () => {
  // Initialize theme early
  useTheme();
  
  // Use authentication context
  const { user, organization, makeAuthenticatedRequest } = useAuth();
  const {
    minMatchesForRanking,
    isLoading: isSettingsLoading,
    isSaving: isSettingsSaving,
    updateMinMatchesForRanking
  } = useSettings();
  
  // Use the simplified cloud-only data management
  const {
    players,
    matches,
    seasons,
    currentSeasonId,
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
  const [activeTab, setActiveTab] = useState<'rankings' | 'new-match' | 'history' | 'seasons' | 'storage'>('rankings');
  const [matchFilterPlayer, setMatchFilterPlayer] = useState<string>('');
  const [selectedSeasonId, setSelectedSeasonId] = useState<number | null>(null);
  const [isSeasonSaving, setIsSeasonSaving] = useState(false);
  const [isSeasonCreating, setIsSeasonCreating] = useState(false);
  
  // Player stats modal state
  const [selectedPlayerForStats, setSelectedPlayerForStats] = useState<Player | null>(null);
  const [isPlayerStatsModalOpen, setIsPlayerStatsModalOpen] = useState(false);

  const effectiveSeasonId = selectedSeasonId ?? currentSeasonId;
  const selectedSeasonPlayers = effectiveSeasonId
    ? players.filter(player => player.season_id === effectiveSeasonId)
    : [];
  const selectedSeasonMatches = effectiveSeasonId
    ? matches.filter(match => match.season_id === effectiveSeasonId)
    : [];
  const currentSeasonPlayers = currentSeasonId
    ? players.filter(player => player.season_id === currentSeasonId)
    : [];
  const currentSeasonMatches = currentSeasonId
    ? matches.filter(match => match.season_id === currentSeasonId)
    : [];
  const isViewingCurrentSeason = !!currentSeasonId && effectiveSeasonId === currentSeasonId;
  const currentSeason = seasons.find(season => season.id === currentSeasonId) || null;
  const seasonOptions = [...seasons].sort((a, b) => {
    const aTime = new Date(a.startDate).getTime();
    const bTime = new Date(b.startDate).getTime();
    return bTime - aTime;
  });

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

    if (!currentSeasonId || !isViewingCurrentSeason) {
      alert('You can only add matches to the current season.');
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
      findOrCreatePlayer(name, currentSeasonPlayers, setPlayers, organization.id, currentSeasonId)
    );
    const team2Players = newMatch.team2.map(name => 
      findOrCreatePlayer(name, currentSeasonPlayers, setPlayers, organization.id, currentSeasonId)
    );

    // Get total points for the match
    let totalPoints = newMatch.team1Score + newMatch.team2Score;
    if (totalPoints === 0) totalPoints = 1;
    const team1Won = newMatch.team1Score > newMatch.team2Score;
    
    // Calculate ELO changes for each player
    const team1EloChanges: { [name: string]: number } = {};
    const team2EloChanges: { [name: string]: number } = {};

    let minTeamSize = Math.min(team1Players.length, team2Players.length);
    if (minTeamSize === 0) minTeamSize = 1;

    team1Players.forEach(player => {
      if (!team1EloChanges[player.name]) team1EloChanges[player.name] = 0;
      team2Players.forEach(opponent => {
        if (!team2EloChanges[opponent.name]) team2EloChanges[opponent.name] = 0;
        const newElo = Math.round(calculateELODifference(
          player.elo,
          opponent.elo,
          newMatch.team1Score / totalPoints
        ) / minTeamSize);
        team1EloChanges[player.name] += newElo; // Average out ELO change across opponents
        team2EloChanges[opponent.name] -= newElo; // Average out ELO change across opponents
      });
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
      organization_id: organization.id,
      season_id: currentSeasonId
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
    ? selectedSeasonMatches.filter(match => 
        match.team1.includes(matchFilterPlayer) || 
        match.team2.includes(matchFilterPlayer)
      )
    : selectedSeasonMatches;

  // Handle player click from rankings
  const handlePlayerClick = (playerName: string) => {
    setMatchFilterPlayer(playerName);
    setActiveTab('history');
  };

  // Handle opening player stats modal
  const handlePlayerStatsClick = (playerName: string) => {
    const player = selectedSeasonPlayers.find(p => p.name === playerName);
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

  // Ensure a season is selected once seasons load
  useEffect(() => {
    if (!currentSeasonId) return;
    const hasSelected = selectedSeasonId && seasons.some(season => season.id === selectedSeasonId);
    if (!hasSelected) {
      setSelectedSeasonId(currentSeasonId);
    }
  }, [currentSeasonId, seasons, selectedSeasonId]);

  // Reset filters when switching seasons
  useEffect(() => {
    setMatchFilterPlayer('');
    setIsPlayerStatsModalOpen(false);
    setSelectedPlayerForStats(null);
  }, [selectedSeasonId]);

  // Handle match deletion
  const handleDeleteMatch = async (match: Match) => {
    if (!isViewingCurrentSeason) {
      alert('Past seasons are read-only. You cannot delete matches.');
      return;
    }
    const confirmMessage = `Are you sure you want to delete this match?\n\nDate: ${match.date} ${match.time}\nTeams: ${match.team1.join(', ')} vs ${match.team2.join(', ')}\nScore: ${match.team1Score} - ${match.team2Score}`;
    
    if (window.confirm(confirmMessage)) {
      const success = await deleteMatch(match.id);
      if (success) {
        // Optionally recalculate ELO ratings after deletion
        // This would require implementing ELO recalculation logic
      }
    }
  };

  const handleSelectSeason = (seasonId: number) => {
    setSelectedSeasonId(seasonId);
  };

  const handleCreateSeason = async () => {
    if (!makeAuthenticatedRequest) return;
    if (user?.role !== 'superuser') {
      alert('Only administrators can create new seasons.');
      return;
    }
    if (!window.confirm('Create a new season? This will close the current season and reset rankings.')) {
      return;
    }

    setIsSeasonCreating(true);
    try {
      const response = await makeAuthenticatedRequest('/api/seasons', {
        method: 'POST',
        body: JSON.stringify({})
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        alert(data.error || 'Failed to create season.');
        return;
      }

      const data = await response.json().catch(() => ({}));
      if (typeof data.currentSeasonId === 'number') {
        setSelectedSeasonId(data.currentSeasonId);
      }
      await refreshData();
      setActiveTab('rankings');
    } catch (error) {
      console.error('Create season error:', error);
      alert('Failed to create season. Please try again.');
    } finally {
      setIsSeasonCreating(false);
    }
  };

  const handleUpdateCurrentSeasonName = async (name: string) => {
    if (!makeAuthenticatedRequest) return false;
    if (!currentSeasonId) return false;

    setIsSeasonSaving(true);
    try {
      const response = await makeAuthenticatedRequest('/api/seasons', {
        method: 'PATCH',
        body: JSON.stringify({ seasonId: currentSeasonId, name })
      });

      if (!response.ok) {
        return false;
      }

      await refreshData();
      return true;
    } catch (error) {
      console.error('Update season error:', error);
      return false;
    } finally {
      setIsSeasonSaving(false);
    }
  };

  // Update document title with organization name
  useEffect(() => {
    document.title = organization?.name || 'Championship Manager';
  }, [organization?.name]);

  // Recalculate ELO from scratch (superuser only)
  const recalculateELO = async () => {
    if (!organization || !currentSeasonId) return;

    try {
      const seasonPlayers = currentSeasonPlayers;
      const seasonMatches = currentSeasonMatches;

      if (seasonPlayers.length === 0 || seasonMatches.length === 0) {
        alert('No matches available to recalculate for the current season.');
        return;
      }

      // Create a copy of season players and reset their ELO to 1200
      const resetPlayers = seasonPlayers.map(player => ({
        ...player,
        elo: 1200,
        matches: 0,
        wins: 0,
        losses: 0
      }));

      // Sort matches by date and time chronologically
      const sortedMatches = [...seasonMatches].sort((a, b) => {
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

        // Calculate ELO changes for each player
        const team1EloChanges: { [name: string]: number } = {};
        const team2EloChanges: { [name: string]: number } = {};

        let minTeamSize = Math.min(team1Players.length, team2Players.length);
        if (minTeamSize === 0) minTeamSize = 1; // Avoid division by zero

        team1Players.forEach(player => {
          if (!team1EloChanges[player.name]) team1EloChanges[player.name] = 0;
          team2Players.forEach(opponent => {
            if (!team2EloChanges[opponent.name]) team2EloChanges[opponent.name] = 0;
            const newElo = Math.round(calculateELODifference(
              player.elo,
              opponent.elo,
              match.team1Score / totalPoints
            ) / minTeamSize);
            team1EloChanges[player.name] += newElo; // Average out ELO change across opponents
            team2EloChanges[opponent.name] -= newElo; // Average out ELO change across opponents
          });
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

      const updatedPlayersById = new Map(currentPlayers.map(player => [player.id, player]));
      const updatedMatchesById = new Map(updatedMatches.map(match => [match.id, match]));

      // Update state with recalculated data (current season only)
      setPlayers(prev => prev.map(player => {
        if (player.season_id !== currentSeasonId) return player;
        return updatedPlayersById.get(player.id) || player;
      }));
      setMatches(prev => prev.map(match => {
        if (match.season_id !== currentSeasonId) return match;
        return updatedMatchesById.get(match.id) || match;
      }));

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
            <div className="flex flex-wrap items-center gap-4">
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                {organization?.name || 'Championship Manager'}
              </h1>
              <div className="relative">
                <select
                  value={effectiveSeasonId ?? ''}
                  onChange={(e) => {
                    if (!e.target.value) return;
                    handleSelectSeason(Number(e.target.value));
                  }}
                  className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors duration-200 pr-8"
                >
                  {seasonOptions.length === 0 && (
                    <option value="">Loading...</option>
                  )}
                  {seasonOptions.map(season => (
                    <option key={season.id} value={season.id}>
                      {season.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
              </div>
              {!isViewingCurrentSeason && (
                <span className="text-xs font-semibold text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/40 px-2 py-1 rounded-full">
                  Read-only season
                </span>
              )}
            </div>
            <p className="text-gray-600 dark:text-gray-400 mt-1">Manage your championship tracking</p>
          </div>
          <UserMenu />
        </div>

        {/* Tabs Navigation */}
        <div className="flex justify-center mb-8">
          <nav className="flex space-x-8" aria-label="Tabs">
            {[
              { id: 'rankings', name: 'Rankings', Icon: Trophy },
              { id: 'new-match', name: 'New Match', Icon: PlusCircle },
              { id: 'history', name: 'History', Icon: BarChart3 },
              { id: 'seasons', name: 'Seasons', Icon: Calendar },
              ...(user?.role === 'superuser' ? [{ id: 'storage', name: 'Settings', Icon: Settings }] : []),
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as 'rankings' | 'new-match' | 'history' | 'seasons' | 'storage')}
                className={`${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                } whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm transition-colors duration-200 flex items-center gap-2`}
              >
                <tab.Icon className="h-4 w-4" aria-hidden="true" />
                <span className="sr-only sm:not-sr-only">{tab.name}</span>
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
                players={selectedSeasonPlayers} 
                minMatchesForRanking={minMatchesForRanking}
                onPlayerClick={handlePlayerClick}
                onPlayerStatsClick={handlePlayerStatsClick}
              />
            )}
            {activeTab === 'new-match' && (
              <>
                {error ? (
                  <div className="text-center py-8">
                    <div className="text-red-600 dark:text-red-400 mb-4">
                      âš ï¸ Cannot add matches - database error
                    </div>
                    <p className="text-gray-600 dark:text-gray-400">{error}</p>
                  </div>
                ) : (
                  <NewMatchTab
                    players={selectedSeasonPlayers}
                    newMatch={newMatch}
                    setNewMatch={setNewMatch}
                    onAddMatch={addMatch}
                    isReadOnly={!isViewingCurrentSeason}
                    readOnlyMessage="You are viewing a past season. Matches are read-only."
                  />
                )}
              </>
            )}
            {activeTab === 'history' && (
              <HistoryTab
                filteredMatches={filteredMatches}
                players={selectedSeasonPlayers}
                matchFilterPlayer={matchFilterPlayer}
                setMatchFilterPlayer={setMatchFilterPlayer}
                onDeleteMatch={handleDeleteMatch}
                onPlayerStatsClick={handlePlayerStatsClick}
                canEditMatches={isViewingCurrentSeason}
              />
            )}
            {activeTab === 'seasons' && (
              <SeasonsTab
                seasons={seasons}
                players={players}
                minMatchesForRanking={minMatchesForRanking}
                currentSeasonId={currentSeasonId}
                selectedSeasonId={effectiveSeasonId}
                onSelectSeason={handleSelectSeason}
                onCreateSeason={handleCreateSeason}
                canCreateSeason={user?.role === 'superuser'}
                isCreating={isSeasonCreating}
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
                minMatchesForRanking={minMatchesForRanking}
                isSettingsLoading={isSettingsLoading}
                isSettingsSaving={isSettingsSaving}
                onUpdateMinMatchesForRanking={updateMinMatchesForRanking}
                currentSeason={currentSeason}
                onUpdateCurrentSeasonName={handleUpdateCurrentSeasonName}
                isSeasonSaving={isSeasonSaving}
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
          matches={selectedSeasonMatches}
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
