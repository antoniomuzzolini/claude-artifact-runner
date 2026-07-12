"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Trophy, PlusCircle, BarChart3, Settings, Calendar, AlertTriangle, Users, Swords } from 'lucide-react';

// Import types
import { Match, NewMatch, AppData, Player, Tournament } from '../types/championship';

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
import {
  ResolvedSlot,
  addConsolationBracket,
  addThirdPlaceMatch,
  createTournamentSlots,
  generateNextSwissRound,
  getSideMemberIds,
  orderParticipants,
  slotContextLabel,
  suggestedTeamSize
} from '../utils/tournament';

// Import tab components
import RankingsTab from '../components/tabs/RankingsTab';
import NewMatchTab from '../components/tabs/NewMatchTab';
import HistoryTab from '../components/tabs/HistoryTab';
import StorageTab from '../components/tabs/StorageTab';
import SeasonsTab from '../components/tabs/SeasonsTab';
import PlayersTab from '../components/tabs/PlayersTab';
import TournamentsTab from '../components/tabs/TournamentsTab';
import { TournamentDraft } from '../components/tournament/TournamentWizard';
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
    rankingMode,
    hiddenTabs,
    isLoading: isSettingsLoading,
    isSaving: isSettingsSaving,
    updateMinMatchesForRanking,
    updateEloKFactor,
    updateRankingMode,
    updateHiddenTabs
  } = useSettings();
  
  // Use the simplified cloud-only data management
  const {
    players,
    matches,
    seasons,
    tournaments,
    currentSeasonId,
    lastSaved,
    isOnline,
    isSyncing,
    isAutoSaveEnabled,
    error,
    setPlayers,
    setMatches,
    setTournaments,
    setIsAutoSaveEnabled,
    exportDataToFile,
    importDataFromFile,
    resetAll,
    refreshData,
    deleteMatch,
    deleteTournament
  } = useNeonDB();

  // Local state for UI
  const [newMatch, setNewMatch] = useState<NewMatch>({
    teams: [[''], ['']],
    scores: [0, 0]
  });
  const [activeTab, setActiveTab] = useState<'rankings' | 'new-match' | 'history' | 'tournaments' | 'seasons' | 'players' | 'storage'>('rankings');
  const [matchFilterPlayerId, setMatchFilterPlayerId] = useState<number | null>(null);
  const [selectedSeasonId, setSelectedSeasonId] = useState<number | null>(null);
  const [selectedTournamentId, setSelectedTournamentId] = useState<number | null>(null);
  const [isSeasonSaving, setIsSeasonSaving] = useState(false);
  const [isSeasonCreating, setIsSeasonCreating] = useState(false);
  const [isEloPreviewActive, setIsEloPreviewActive] = useState(false);
  
  // Player stats modal state
  const [selectedPlayerForStats, setSelectedPlayerForStats] = useState<Player | null>(null);
  const [isPlayerStatsModalOpen, setIsPlayerStatsModalOpen] = useState(false);

  const normalizeName = (name: string) => name.trim().toLowerCase();

  // Deep links: restore tab / season / open tournament from the URL on load,
  // and keep the URL in sync so a reload lands on the same view.
  const VALID_TABS = ['rankings', 'new-match', 'history', 'tournaments', 'seasons', 'players', 'storage'] as const;
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab');
    if (tab && (VALID_TABS as readonly string[]).includes(tab)) {
      setActiveTab(tab as (typeof VALID_TABS)[number]);
    }
    const season = Number(params.get('season'));
    if (Number.isFinite(season) && season > 0) {
      setSelectedSeasonId(season);
    }
    const tournamentId = Number(params.get('tournament'));
    if (Number.isFinite(tournamentId) && tournamentId > 0) {
      setSelectedTournamentId(tournamentId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    if (activeTab !== 'rankings') params.set('tab', activeTab);
    if (selectedSeasonId !== null) params.set('season', String(selectedSeasonId));
    if (activeTab === 'tournaments' && selectedTournamentId !== null) {
      params.set('tournament', String(selectedTournamentId));
    }
    const query = params.toString();
    window.history.replaceState(null, '', query ? `?${query}` : window.location.pathname);
  }, [activeTab, selectedSeasonId, selectedTournamentId]);

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

  // "Tournament name · round" label for each match linked to a tournament slot
  const tournamentLabelByMatchId = useMemo(() => {
    const labels = new Map<number, string>();
    for (const tournament of tournaments) {
      const knockoutRounds = tournament.slots
        .filter(slot => slot.phase === 'knockout')
        .reduce((max, slot) => Math.max(max, slot.round), 0);
      for (const slot of tournament.slots) {
        if (slot.matchId === null) continue;
        labels.set(slot.matchId, `${tournament.name} · ${slotContextLabel(slot, knockoutRounds)}`);
      }
    }
    return labels;
  }, [tournaments]);

  const seasonTournaments = useMemo(() => (
    effectiveSeasonId
      ? tournaments
          .filter(tournament => tournament.season_id === effectiveSeasonId)
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      : []
  ), [tournaments, effectiveSeasonId]);
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

  // Create a tournament (structure only; matches are created as results come in)
  const handleCreateTournament = (draft: TournamentDraft): number | null => {
    if (!organization || !currentSeasonId || !isViewingCurrentSeason) {
      alert('You can only create tournaments in the current season.');
      return null;
    }
    if (user?.role !== 'superuser') {
      alert('Only administrators can create tournaments.');
      return null;
    }

    // Team tournaments: the wizard delivers the teams already composed and in
    // seed order; sides in the bracket are team ids. Individual tournaments
    // keep the existing player-seeding path.
    const isTeamDraft = (draft.teams?.length ?? 0) > 1;
    const teams = isTeamDraft
      ? draft.teams!.map((team, index) => ({
          id: index + 1,
          name: team.name.trim() || `Team ${index + 1}`,
          playerIds: team.playerIds
        }))
      : undefined;

    let seededIds: number[];
    let participantIds: number[];
    if (teams) {
      seededIds = teams.map(team => team.id);
      participantIds = teams.flatMap(team => team.playerIds);
    } else {
      const eloById = new Map(selectedSeasonPlayers.map(player => [player.id, player.elo]));
      seededIds = orderParticipants(draft.participantIds, draft.seeding, eloById);
      participantIds = seededIds;
    }
    const slots = createTournamentSlots(draft.format, seededIds, draft.config, teams ? 'team' : 'player');

    let tournamentId = Date.now() + Math.floor(Math.random() * 1000);
    const existingIds = new Set(tournaments.map(tournament => tournament.id));
    while (existingIds.has(tournamentId)) {
      tournamentId += Math.floor(Math.random() * 1000) + 1;
    }

    const tournament: Tournament = {
      id: tournamentId,
      name: draft.name,
      format: draft.format,
      seeding: draft.seeding,
      participantIds,
      config: draft.config,
      ...(teams ? { teams } : {}),
      slots,
      organization_id: organization.id,
      season_id: currentSeasonId,
      createdBy: user?.id,
      createdAt: new Date().toISOString()
    };

    setTournaments(prev => [tournament, ...prev]);
    return tournamentId;
  };

  // Record a tournament match result: creates a regular match (counts for ELO)
  // and links it to the tournament slot
  const handleRecordTournamentResult = (
    tournament: Tournament,
    slot: ResolvedSlot,
    homeScore: number,
    awayScore: number
  ) => {
    if (!organization || !currentSeasonId || !isViewingCurrentSeason || tournament.season_id !== currentSeasonId) {
      alert('You can only record tournament results in the current season.');
      return;
    }
    if (slot.homePlayerId === null || slot.awayPlayerId === null) return;
    const drawsForbidden = slot.phase === 'knockout' || slot.phase === 'consolation' || tournament.config.pointsScheme === 'set_based';
    if (drawsForbidden && homeScore === awayScore) {
      alert('Draws are not allowed in this match.');
      return;
    }

    const seasonStatsById = new Map(selectedSeasonPlayers.map(player => [player.id, player]));
    const basePlayerById = new Map(players.map(player => [player.id, player]));
    const resolveSeasonPlayer = (playerId: number): Player | null => {
      const seasonPlayer = seasonStatsById.get(playerId);
      if (seasonPlayer) return seasonPlayer;
      const basePlayer = basePlayerById.get(playerId);
      if (!basePlayer) return null;
      return { ...basePlayer, elo: 1200, matches: 0, wins: 0, losses: 0 };
    };

    // Slot sides are players or teams; the match always stores the real
    // players, so individual ELO updates work the same in both cases
    const sideMembers = [slot.homePlayerId, slot.awayPlayerId].map(sideId =>
      getSideMemberIds(tournament, sideId!).map(resolveSeasonPlayer)
    );
    if (sideMembers.some(members => members.some(member => member === null) || members.length === 0)) {
      alert('Tournament player not found.');
      return;
    }
    const teamsPlayers = sideMembers as Player[][];

    const scores = [homeScore, awayScore];
    const { winnerIndex, eloChanges } = calculateMultiTeamEloChanges(
      teamsPlayers,
      scores,
      eloKFactor
    );

    let matchId = Date.now() + Math.floor(Math.random() * 1000);
    const existingMatchIds = new Set(matches.map(match => match.id));
    while (existingMatchIds.has(matchId)) {
      matchId += Math.floor(Math.random() * 1000) + 1;
    }

    const match: Match = {
      id: matchId,
      date: new Date().toLocaleDateString('en-US'),
      time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      teams: teamsPlayers.map(team => team.map(member => ({ id: member.id, name: member.name }))),
      scores,
      winnerIndex,
      eloChanges,
      createdBy: user?.id,
      organization_id: organization.id,
      season_id: currentSeasonId
    };

    setMatches(prev => [match, ...prev]);
    setTournaments(prev => prev.map(item => (
      item.id === tournament.id
        ? {
            ...item,
            slots: item.slots.map(existingSlot => (
              existingSlot.id === slot.id
                ? { ...existingSlot, matchId }
                : existingSlot
            ))
          }
        : item
    )));
  };

  // Edit an already recorded tournament result (typo fixes). Scores, winner and
  // this match's ELO deltas are updated; season history keeps the same match id.
  const handleUpdateTournamentResult = (
    tournament: Tournament,
    slot: ResolvedSlot,
    homeScore: number,
    awayScore: number
  ) => {
    if (!organization || !currentSeasonId || !isViewingCurrentSeason || tournament.season_id !== currentSeasonId) {
      alert('You can only edit tournament results in the current season.');
      return;
    }
    if (slot.matchId === null || slot.homePlayerId === null || slot.awayPlayerId === null) return;
    const drawsForbidden = slot.phase === 'knockout' || slot.phase === 'consolation' || tournament.config.pointsScheme === 'set_based';
    if (drawsForbidden && homeScore === awayScore) {
      alert('Draws are not allowed in this match.');
      return;
    }

    // Locked results: swiss rounds freeze once the next round is generated,
    // group results freeze once the knockout stage has results
    if (slot.phase === 'swiss') {
      const latestSwissRound = tournament.slots
        .filter(item => item.phase === 'swiss')
        .reduce((max, item) => Math.max(max, item.round), 0);
      if (slot.round < latestSwissRound) {
        alert('This result is locked: the next round has already been generated from these standings.');
        return;
      }
    }
    if (slot.phase === 'group') {
      const knockoutStarted = tournament.slots.some(item => (item.phase === 'knockout' || item.phase === 'consolation') && item.matchId !== null);
      if (knockoutStarted) {
        alert('This result is locked: the knockout stage has already started from these standings.');
        return;
      }
    }

    const targetMatch = matches.find(match => Number(match.id) === Number(slot.matchId));
    if (!targetMatch) return;

    // Flipping a knockout winner whose next round was already played leaves the
    // later match inconsistent — ask before proceeding
    const newWinnerId = homeScore === awayScore
      ? null
      : (homeScore > awayScore ? slot.homePlayerId : slot.awayPlayerId);
    if (slot.phase === 'knockout' && slot.winnerPlayerId !== null && newWinnerId !== slot.winnerPlayerId) {
      const dependentPlayed = tournament.slots.some(other => (
        other.matchId !== null && (
          (other.home.kind === 'winner' && other.home.slotId === slot.id)
          || (other.away.kind === 'winner' && other.away.slotId === slot.id)
        )
      ));
      if (dependentPlayed && !window.confirm(
        'This change flips the winner, but the next round has already been played and will become inconsistent.\n\nContinue anyway?'
      )) {
        return;
      }
    }

    const seasonStatsById = new Map(selectedSeasonPlayers.map(player => [player.id, player]));
    const basePlayerById = new Map(players.map(player => [player.id, player]));
    const resolveSeasonPlayer = (playerId: number): Player | null => {
      const seasonPlayer = seasonStatsById.get(playerId);
      if (seasonPlayer) return seasonPlayer;
      const basePlayer = basePlayerById.get(playerId);
      if (!basePlayer) return null;
      return { ...basePlayer, elo: 1200, matches: 0, wins: 0, losses: 0 };
    };

    const sideMembers = [slot.homePlayerId, slot.awayPlayerId].map(sideId =>
      getSideMemberIds(tournament, sideId!).map(resolveSeasonPlayer)
    );
    if (sideMembers.some(members => members.some(member => member === null) || members.length === 0)) return;
    const teamsPlayers = sideMembers as Player[][];

    const scores = [homeScore, awayScore];
    const { winnerIndex, eloChanges } = calculateMultiTeamEloChanges(
      teamsPlayers,
      scores,
      eloKFactor
    );

    setMatches(prev => prev.map(match => (
      Number(match.id) === Number(slot.matchId)
        ? { ...match, scores, winnerIndex, eloChanges }
        : match
    )));
  };

  const handleGenerateNextSwissRound = (tournament: Tournament) => {
    const newSlots = generateNextSwissRound(tournament, matches);
    if (!newSlots || newSlots.length === 0) return;
    setTournaments(prev => prev.map(item => (
      item.id === tournament.id
        ? { ...item, slots: [...item.slots, ...newSlots] }
        : item
    )));
  };

  // Add a 3rd place match / consolation bracket to an existing tournament
  // (for when the flag was forgotten in the creation wizard)
  const handleAddThirdPlaceMatch = (tournament: Tournament) => {
    if (!currentSeasonId || !isViewingCurrentSeason || tournament.season_id !== currentSeasonId) {
      alert('You can only modify tournaments in the current season.');
      return;
    }
    const newSlots = addThirdPlaceMatch(tournament);
    if (!newSlots) return;
    setTournaments(prev => prev.map(item => (
      item.id === tournament.id
        ? { ...item, config: { ...item.config, thirdPlaceMatch: true }, slots: newSlots }
        : item
    )));
  };

  const handleAddConsolationBracket = (tournament: Tournament) => {
    if (!currentSeasonId || !isViewingCurrentSeason || tournament.season_id !== currentSeasonId) {
      alert('You can only modify tournaments in the current season.');
      return;
    }
    const newSlots = addConsolationBracket(tournament);
    if (!newSlots) return;
    setTournaments(prev => prev.map(item => (
      item.id === tournament.id
        ? { ...item, config: { ...item.config, consolationBracket: true }, slots: newSlots }
        : item
    )));
  };

  const handleDeleteTournament = async (tournament: Tournament) => {
    const confirmMessage = `Are you sure you want to delete the tournament "${tournament.name}"?\n\nMatches already played will remain in the season history.`;
    if (!window.confirm(confirmMessage)) {
      return false;
    }
    return deleteTournament(tournament.id);
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

  // Reset season/tab only on a real organization SWITCH. On initial load the
  // organization goes from undefined to its value: resetting there would wipe
  // the view just restored from the URL (reload always landed on rankings).
  const previousOrgIdRef = React.useRef<number | null>(null);
  useEffect(() => {
    const orgId = organization?.id ?? null;
    if (orgId !== null && previousOrgIdRef.current !== null && previousOrgIdRef.current !== orgId) {
      setSelectedSeasonId(null);
      setSelectedTournamentId(null);
      setActiveTab('rankings');
    }
    if (orgId !== null) {
      previousOrgIdRef.current = orgId;
    }
  }, [organization?.id]);

  // If the active tab gets hidden from settings, fall back to the first
  // visible one (rankings itself is hideable now)
  useEffect(() => {
    if (!hiddenTabs.includes(activeTab as (typeof hiddenTabs)[number])) return;
    const fallbackOrder = ['rankings', 'history', 'tournaments', 'seasons', 'new-match'] as const;
    const fallback = fallbackOrder.find(tab => !hiddenTabs.includes(tab as (typeof hiddenTabs)[number]));
    setActiveTab(fallback ?? 'rankings');
  }, [hiddenTabs, activeTab]);

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

  // Add a player without recording a match (needed to seed tournaments from scratch)
  const handleAddPlayer = (name: string) => {
    if (!organization) {
      return { success: false, error: 'Organization context not available.' };
    }
    const trimmed = name.trim();
    if (!trimmed) {
      return { success: false, error: 'Player name cannot be empty.' };
    }
    const isDuplicate = players.some(player => normalizeName(player.name) === normalizeName(trimmed));
    if (isDuplicate) {
      return { success: false, error: 'A player with that name already exists.' };
    }
    findOrCreatePlayer(trimmed, players, setPlayers, organization.id);
    return { success: true };
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
    // An open tournament belongs to the previous season's list
    setSelectedTournamentId(null);
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
        <div className="flex justify-between items-start gap-3 mb-8">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
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
              { id: 'tournaments', name: 'Tournaments', Icon: Swords },
              { id: 'seasons', name: 'Seasons', Icon: Calendar },
              ...(user?.role === 'superuser' ? [{ id: 'players', name: 'Players', Icon: Users }] : []),
              ...(user?.role === 'superuser' ? [{ id: 'storage', name: 'Settings', Icon: Settings }] : []),
            ].filter(tab => !hiddenTabs.includes(tab.id as (typeof hiddenTabs)[number])).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as 'rankings' | 'new-match' | 'history' | 'tournaments' | 'seasons' | 'players' | 'storage')}
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
                rankingMode={rankingMode}
                onPlayerClick={handlePlayerClick}
                onPlayerStatsClick={handlePlayerStatsClick}
                onRefresh={refreshData}
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
                rankingMode={rankingMode}
                onDeleteMatch={handleDeleteMatch}
                onPlayerStatsClick={handlePlayerStatsClick}
                canEditMatches={isViewingCurrentSeason}
                tournamentLabelByMatchId={tournamentLabelByMatchId}
              />
            )}
            {activeTab === 'tournaments' && (
              <TournamentsTab
                tournaments={seasonTournaments}
                players={allTimePlayers}
                matches={matches}
                selectedTournamentId={selectedTournamentId}
                onSelectTournament={setSelectedTournamentId}
                suggestedTeamSize={suggestedTeamSize(matches)}
                canCreate={user?.role === 'superuser' && isViewingCurrentSeason}
                canRecordResults={isViewingCurrentSeason}
                canManage={user?.role === 'superuser'}
                onCreateTournament={handleCreateTournament}
                onRecordResult={handleRecordTournamentResult}
                onUpdateResult={handleUpdateTournamentResult}
                onGenerateNextRound={handleGenerateNextSwissRound}
                onDeleteTournament={handleDeleteTournament}
                onAddThirdPlaceMatch={handleAddThirdPlaceMatch}
                onAddConsolationBracket={handleAddConsolationBracket}
                onRefresh={refreshData}
              />
            )}
            {activeTab === 'seasons' && (
              <SeasonsTab
                seasons={seasons}
                players={players}
                matches={matches}
                minMatchesForRanking={minMatchesForRanking}
                rankingMode={rankingMode}
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
                onAddPlayer={handleAddPlayer}
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
                rankingMode={rankingMode}
                isSettingsLoading={isSettingsLoading}
                isSettingsSaving={isSettingsSaving}
                onUpdateMinMatchesForRanking={updateMinMatchesForRanking}
                onUpdateEloKFactor={updateEloKFactor}
                onUpdateRankingMode={updateRankingMode}
                hiddenTabs={hiddenTabs}
                onUpdateHiddenTabs={updateHiddenTabs}
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
          rankingMode={rankingMode}
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
