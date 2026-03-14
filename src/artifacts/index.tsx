"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Trophy, PlusCircle, BarChart3, Settings, Calendar, AlertTriangle, Users } from 'lucide-react';

// Import types
import { Match, NewMatch, AppData, Player } from '../types/championship';

// Import hooks
import { useNeonDB } from '../hooks/useNeonDB';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import { useSettings } from '../hooks/useSettings';

// Import utilities
import { 
  findOrCreatePlayer, 
  validateMatch,
  calculateMultiTeamEloChanges
} from '../utils/gameLogic';
import { buildPlayerStats } from '../utils/playerStats';

// Import tab components
import RankingsTab from '../components/tabs/RankingsTab';
import NewMatchTab from '../components/tabs/NewMatchTab';
import HistoryTab from '../components/tabs/HistoryTab';
import StorageTab from '../components/tabs/StorageTab';
import SeasonsTab from '../components/tabs/SeasonsTab';
import PlayersTab from '../components/tabs/PlayersTab';
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
    eloKFactor,
    isLoading: isSettingsLoading,
    isSaving: isSettingsSaving,
    updateMinMatchesForRanking,
    updateEloKFactor
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
    isAutoSaveEnabled,
    error,
    setPlayers,
    setMatches,
    setIsAutoSaveEnabled,
    exportDataToFile,
    importDataFromFile,
    resetAll,
    refreshData,
    deleteMatch
  } = useNeonDB();

  // Local state for UI
  const [newMatch, setNewMatch] = useState<NewMatch>({
    teams: [[''], ['']],
    scores: [0, 0]
  });
  const [activeTab, setActiveTab] = useState<'rankings' | 'new-match' | 'history' | 'seasons' | 'players' | 'storage'>('rankings');
  const [matchFilterPlayerId, setMatchFilterPlayerId] = useState<number | null>(null);
  const [selectedSeasonId, setSelectedSeasonId] = useState<number | null>(null);
  const [isSeasonSaving, setIsSeasonSaving] = useState(false);
  const [isSeasonCreating, setIsSeasonCreating] = useState(false);
  const [isEloPreviewActive, setIsEloPreviewActive] = useState(false);
  
  // Player stats modal state
  const [selectedPlayerForStats, setSelectedPlayerForStats] = useState<Player | null>(null);
  const [isPlayerStatsModalOpen, setIsPlayerStatsModalOpen] = useState(false);

  const normalizeName = (name: string) => name.trim().toLowerCase();

  const effectiveSeasonId = selectedSeasonId ?? currentSeasonId;
  const selectedSeasonMatches = useMemo(() => (
    effectiveSeasonId
      ? matches.filter(match => match.season_id === effectiveSeasonId)
      : []
  ), [matches, effectiveSeasonId]);

  const selectedSeasonPlayers = useMemo(() => (
    effectiveSeasonId
      ? buildPlayerStats(players, matches, effectiveSeasonId)
      : []
  ), [players, matches, effectiveSeasonId]);

  const allTimePlayers = useMemo(() => (
    buildPlayerStats(players, matches, null)
  ), [players, matches]);
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
      newMatch.teams,
      newMatch.scores
    )) {
      alert('Fill in all fields, avoid duplicate players, and make sure there is a single winning team!');
      return;
    }

    const seasonStatsById = new Map(selectedSeasonPlayers.map(player => [player.id, player]));

    // Find or create all players (global), then map to current season stats
    const teamsPlayers = newMatch.teams.map(team =>
      team.map(name => {
        const basePlayer = findOrCreatePlayer(name, players, setPlayers, organization.id);
        const seasonPlayer = seasonStatsById.get(basePlayer.id);
        return seasonPlayer ?? {
          ...basePlayer,
          elo: 1200,
          matches: 0,
          wins: 0,
          losses: 0
        };
      })
    );

    const { winnerIndex, eloChanges } = calculateMultiTeamEloChanges(
      teamsPlayers,
      newMatch.scores,
      eloKFactor
    );

    // Add match to history with creator tracking and organization
    let matchId = Date.now() + Math.floor(Math.random() * 1000);
    const existingMatchIds = new Set(matches.map(match => match.id));
    while (existingMatchIds.has(matchId)) {
      matchId += Math.floor(Math.random() * 1000) + 1;
    }

    const match: Match = {
      id: matchId,
      date: new Date().toLocaleDateString('en-US'),
      time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      teams: teamsPlayers.map(team =>
        team.map(player => ({
          id: player.id,
          name: player.name
        }))
      ),
      scores: newMatch.scores.slice(),
      winnerIndex,
      eloChanges,
      createdBy: user?.id,
      organization_id: organization.id,
      season_id: currentSeasonId
    };

    setMatches(prev => [match, ...prev]);

    // Reset form
    setNewMatch({
      teams: [[''], ['']],
      scores: [0, 0]
    });

    alert('Match added successfully!');
  };

  // Filter matches by player
  const filteredMatches = matchFilterPlayerId !== null
    ? selectedSeasonMatches.filter(match => 
        match.teams.some(team => team.some(player => player.id === matchFilterPlayerId))
      )
    : selectedSeasonMatches;

  // Handle player click from rankings
  const handlePlayerClick = (playerId: number) => {
    setMatchFilterPlayerId(playerId);
    setActiveTab('history');
  };

  // Handle opening player stats modal
  const handlePlayerStatsClick = (playerId: number) => {
    const player = selectedSeasonPlayers.find(p => p.id === playerId);
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
    setMatchFilterPlayerId(null);
    setIsPlayerStatsModalOpen(false);
    setSelectedPlayerForStats(null);
  }, [selectedSeasonId]);

  // Handle match deletion
  const handleDeleteMatch = async (match: Match) => {
    if (!isViewingCurrentSeason) {
      alert('Past seasons are read-only. You cannot delete matches.');
      return;
    }
    const teamsLabel = match.teams
      .map((team, index) => `Team ${index + 1}: ${team.map(player => player.name).join(', ')}`)
      .join(' vs ');
    const scoreLabel = match.scores.join(' - ');
    const confirmMessage = `Are you sure you want to delete this match?\n\nDate: ${match.date} ${match.time}\nTeams: ${teamsLabel}\nScore: ${scoreLabel}`;
    
    if (window.confirm(confirmMessage)) {
      const success = await deleteMatch(match.id);
      if (success) {
        // Optionally recalculate ELO ratings after deletion
        // This would require implementing ELO recalculation logic
      }
    }
  };

  const handleRenamePlayer = async (playerId: number, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed) {
      return { success: false, error: 'Player name cannot be empty.' };
    }

    const targetPlayer = players.find(player => player.id === playerId);
    if (!targetPlayer) {
      return { success: false, error: 'Player not found.' };
    }

    const hasDuplicate = players.some(player => (
      player.id !== playerId
      && normalizeName(player.name) === normalizeName(trimmed)
    ));
    if (hasDuplicate) {
      return { success: false, error: 'Another player already has that name.' };
    }

    setPlayers(prev => prev.map(player => (
      player.id === playerId
        ? { ...player, name: trimmed }
        : player
    )));

    setMatches(prev => prev.map(match => ({
      ...match,
      teams: match.teams.map(team => team.map(member => (
        member.id === playerId
          ? { ...member, name: trimmed }
          : member
      )))
    })));

    setSelectedPlayerForStats(prev => (
      prev?.id === playerId ? { ...prev, name: trimmed } : prev
    ));

    return { success: true };
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

  const setPreviewMode = (enabled: boolean) => {
    setIsEloPreviewActive(enabled);
    if (enabled) {
      if (isAutoSaveEnabled) setIsAutoSaveEnabled(false);
    } else if (!isAutoSaveEnabled) {
      setIsAutoSaveEnabled(true);
    }
  };

  // Recalculate ELO from scratch (superuser only)
  const recalculateELO = async (options?: { preview?: boolean }) => {
    if (!organization || !effectiveSeasonId) return;
    const isPreview = options?.preview ?? false;

    try {
      const seasonId = effectiveSeasonId;
      const seasonPlayers = selectedSeasonPlayers;
      const seasonMatches = selectedSeasonMatches;

      if (seasonPlayers.length === 0 || seasonMatches.length === 0) {
        alert('No matches available to recalculate for the current season.');
        return;
      }

      setPreviewMode(isPreview);

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

      const normalizeName = (name: string) => name.trim().toLowerCase();

      for (const match of sortedMatches) {
        // Find all players involved in this match
        const teamsPlayers = match.teams.map(team =>
          team.map(playerRef => {
            if (playerRef.id) {
              const foundById = currentPlayers.find(p => p.id === playerRef.id);
              if (foundById) return foundById;
            }
            const fallbackName = normalizeName(playerRef.name);
            return currentPlayers.find(p => normalizeName(p.name) === fallbackName);
          }).filter(Boolean) as Player[]
        );

        // Skip if any players are missing
        const missingPlayers = teamsPlayers.some((team, index) => team.length !== match.teams[index].length);
        if (missingPlayers) {
          continue;
        }

        const { winnerIndex, eloChanges } = calculateMultiTeamEloChanges(
          teamsPlayers,
          match.scores,
          eloKFactor
        );

        // Update player stats
        const updatePlayerStats = (player: Player, eloChange: number, won: boolean, isTie = false) => {
          const playerIndex = currentPlayers.findIndex(p => p.id === player.id);
          if (playerIndex !== -1) {
            currentPlayers[playerIndex] = {
              ...currentPlayers[playerIndex],
              elo: currentPlayers[playerIndex].elo + eloChange,
              matches: currentPlayers[playerIndex].matches + 1,
              wins: currentPlayers[playerIndex].wins + (won ? 1 : 0),
              losses: currentPlayers[playerIndex].losses + (!isTie && !won ? 1 : 0)
            };
          }
        };

        // Update all team players
        teamsPlayers.forEach((team, teamIndex) => {
          const didWin = winnerIndex !== null && teamIndex === winnerIndex;
          const isTie = winnerIndex === null;
          team.forEach(player => {
            updatePlayerStats(player, eloChanges[String(player.id)] ?? 0, didWin, isTie);
          });
        });

        // Create updated match with new ELO changes
        const updatedMatch = {
          ...match,
          eloChanges
        };

        updatedMatches.push(updatedMatch);
      }

      const updatedMatchesById = new Map(updatedMatches.map(match => [match.id, match]));

      // Update state with recalculated data (current season only)
      setMatches(prev => prev.map(match => {
        if (match.season_id !== seasonId) return match;
        return updatedMatchesById.get(match.id) || match;
      }));

      if (isPreview) {
        alert(`ELO preview complete! Processed ${updatedMatches.length} matches. Changes were NOT saved.`);
      } else {
        alert(`ELO recalculation complete! Processed ${updatedMatches.length} matches.`);
      }
    } catch (error) {
      console.error('ELO recalculation error:', error);
      alert('Failed to recalculate ELO. Please try again.');
    }
  };

  const previewELO = async () => {
    await recalculateELO({ preview: true });
  };

  const discardEloPreview = async () => {
    setPreviewMode(false);
    await refreshData();
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
              <select
                value={effectiveSeasonId ?? ''}
                onChange={(e) => {
                  if (!e.target.value) return;
                  handleSelectSeason(Number(e.target.value));
                }}
                className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors duration-200"
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
              ...(isViewingCurrentSeason ? [{ id: 'new-match', name: 'New Match', Icon: PlusCircle }] : []),
              { id: 'history', name: 'History', Icon: BarChart3 },
              { id: 'seasons', name: 'Seasons', Icon: Calendar },
              ...(user?.role === 'superuser' ? [{ id: 'players', name: 'Players', Icon: Users }] : []),
              ...(user?.role === 'superuser' ? [{ id: 'storage', name: 'Settings', Icon: Settings }] : []),
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as 'rankings' | 'new-match' | 'history' | 'seasons' | 'players' | 'storage')}
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
                    <div className="text-red-600 dark:text-red-400 mb-4 flex items-center justify-center gap-2">
                      <AlertTriangle className="h-4 w-4" />
                      <span>Cannot add matches - database error</span>
                    </div>
                    <p className="text-gray-600 dark:text-gray-400">{error}</p>
                  </div>
                ) : (
                  <NewMatchTab
                    players={allTimePlayers}
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
                matchFilterPlayerId={matchFilterPlayerId}
                setMatchFilterPlayerId={setMatchFilterPlayerId}
                onDeleteMatch={handleDeleteMatch}
                onPlayerStatsClick={handlePlayerStatsClick}
                canEditMatches={isViewingCurrentSeason}
              />
            )}
            {activeTab === 'seasons' && (
              <SeasonsTab
                seasons={seasons}
                players={players}
                matches={matches}
                minMatchesForRanking={minMatchesForRanking}
                currentSeasonId={currentSeasonId}
                selectedSeasonId={effectiveSeasonId}
                onSelectSeason={handleSelectSeason}
                onCreateSeason={handleCreateSeason}
                canCreateSeason={user?.role === 'superuser'}
                isCreating={isSeasonCreating}
              />
            )}
            {activeTab === 'players' && user?.role === 'superuser' && (
              <PlayersTab
                players={allTimePlayers}
                onRenamePlayer={handleRenamePlayer}
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
                eloKFactor={eloKFactor}
                isSettingsLoading={isSettingsLoading}
                isSettingsSaving={isSettingsSaving}
                onUpdateMinMatchesForRanking={updateMinMatchesForRanking}
                onUpdateEloKFactor={updateEloKFactor}
                currentSeason={currentSeason}
                onUpdateCurrentSeasonName={handleUpdateCurrentSeasonName}
                isSeasonSaving={isSeasonSaving}
                onExportData={exportDataToFile}
                onImportData={handleImportFile}
                onResetAll={resetAll}
                onRefresh={refreshData}
                onRecalculateELO={() => recalculateELO({ preview: false })}
                onPreviewELO={previewELO}
                onDiscardEloPreview={discardEloPreview}
                isEloPreviewActive={isEloPreviewActive}
                isSuperuser={user?.role === 'superuser'}
              />
            )}
          </div>
        </div>
        
        {/* Player Stats Modal */}
        <PlayerStatsModal
          player={selectedPlayerForStats}
          matches={selectedSeasonMatches}
          minMatchesForRanking={minMatchesForRanking}
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
