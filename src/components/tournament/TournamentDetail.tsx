"use client";

import React, { useMemo, useState } from 'react';
import { ArrowLeft, Crown, Lock, Pencil, PlusCircle, Trash2, Trophy } from 'lucide-react';
import { Match, Player, Tournament } from '../../types/championship';
import {
  ResolvedSlot,
  computeTournamentState,
  formatLabel,
  groupLetter,
  knockoutRoundLabel,
  slotContextLabel
} from '../../utils/tournament';
import BracketView from './BracketView';
import StandingsTable from './StandingsTable';
import SlotScoreEntry from './SlotScoreEntry';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import { LiveToggle, FullscreenButton, FullscreenOverlay } from '../live/LiveControls';

interface TournamentDetailProps {
  tournament: Tournament;
  matches: Match[];
  players: Player[];
  canRecordResults: boolean;
  canManage: boolean;
  onRecordResult: (tournament: Tournament, slot: ResolvedSlot, homeScore: number, awayScore: number) => void;
  onUpdateResult: (tournament: Tournament, slot: ResolvedSlot, homeScore: number, awayScore: number) => void;
  onGenerateNextRound: (tournament: Tournament) => void;
  onDelete: (tournament: Tournament) => void;
  onRefresh: () => void;
  onBack: () => void;
}

type DetailTab = 'standings' | 'bracket' | 'scores';

const sideName = (
  playerId: number | null,
  isBye: boolean,
  placeholder: string | null,
  getPlayerName: (playerId: number) => string
) => {
  if (isBye) return 'Bye';
  if (playerId !== null) return getPlayerName(playerId);
  return placeholder ?? 'TBD';
};

const MatchRow: React.FC<{
  slot: ResolvedSlot;
  getPlayerName: (playerId: number) => string;
  allowDraw: boolean;
  canRecordResults: boolean;
  canEdit?: boolean;
  onRecordResult: (slot: ResolvedSlot, homeScore: number, awayScore: number) => void;
  onUpdateResult: (slot: ResolvedSlot, homeScore: number, awayScore: number) => void;
}> = ({ slot, getPlayerName, allowDraw, canRecordResults, canEdit = true, onRecordResult, onUpdateResult }) => {
  const [isEditing, setIsEditing] = useState(false);
  const homeName = sideName(slot.homePlayerId, slot.homeIsBye, slot.homePlaceholder, getPlayerName);
  const awayName = sideName(slot.awayPlayerId, slot.awayIsBye, slot.awayPlaceholder, getPlayerName);

  const scoreFor = (playerId: number | null): number | null => {
    if (!slot.match || playerId === null) return null;
    const teamIndex = slot.match.teams.findIndex(team => team.some(member => member.id === playerId));
    return teamIndex === -1 ? null : slot.match.scores[teamIndex] ?? null;
  };

  const homeScore = scoreFor(slot.homePlayerId);
  const awayScore = scoreFor(slot.awayPlayerId);
  const homeWon = slot.winnerPlayerId !== null && slot.winnerPlayerId === slot.homePlayerId;
  const awayWon = slot.winnerPlayerId !== null && slot.winnerPlayerId === slot.awayPlayerId;
  const homeUnresolved = slot.homeIsBye || slot.homePlayerId === null;
  const awayUnresolved = slot.awayIsBye || slot.awayPlayerId === null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/40">
      <div className="flex items-center gap-2 text-sm min-w-0">
        <span className={`truncate ${homeWon ? 'font-semibold text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-300'} ${homeUnresolved ? 'italic text-gray-400 dark:text-gray-500' : ''}`}>
          {homeName}
        </span>
        <span className="text-gray-400 dark:text-gray-500 text-xs">vs</span>
        <span className={`truncate ${awayWon ? 'font-semibold text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-300'} ${awayUnresolved ? 'italic text-gray-400 dark:text-gray-500' : ''}`}>
          {awayName}
        </span>
      </div>

      {slot.status === 'done' && homeScore !== null && awayScore !== null && !isEditing && (
        <span className="flex items-center gap-2">
          <span className="text-sm font-semibold tabular-nums text-gray-900 dark:text-white">
            {homeScore} - {awayScore}
            {slot.isDraw && <span className="ml-2 text-xs font-normal text-gray-500 dark:text-gray-400">Draw</span>}
          </span>
          {canRecordResults && canEdit && (
            <button
              onClick={() => setIsEditing(true)}
              className="p-1 rounded text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors duration-200"
              aria-label="Edit result"
              title="Edit result"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
          )}
          {canRecordResults && !canEdit && (
            <Lock
              className="w-3.5 h-3.5 text-gray-300 dark:text-gray-600"
              aria-label="Result locked"
            />
          )}
        </span>
      )}

      {slot.status === 'done' && isEditing && (
        <SlotScoreEntry
          homeName={homeName}
          awayName={awayName}
          allowDraw={allowDraw}
          initialHomeScore={homeScore ?? 0}
          initialAwayScore={awayScore ?? 0}
          onCancel={() => setIsEditing(false)}
          onSubmit={(hs, as) => {
            onUpdateResult(slot, hs, as);
            setIsEditing(false);
          }}
        />
      )}

      {slot.status === 'bye' && (
        <span className="text-xs text-gray-500 dark:text-gray-400">Free win</span>
      )}
      {slot.status === 'ready' && canRecordResults && (
        <SlotScoreEntry
          homeName={homeName}
          awayName={awayName}
          allowDraw={allowDraw}
          onSubmit={(hs, as) => onRecordResult(slot, hs, as)}
        />
      )}
      {slot.status === 'ready' && !canRecordResults && (
        <span className="text-xs text-gray-500 dark:text-gray-400">Waiting for result</span>
      )}
    </div>
  );
};

const RoundsList: React.FC<{
  slots: ResolvedSlot[];
  getPlayerName: (playerId: number) => string;
  allowDraw: boolean;
  canRecordResults: boolean;
  roundLabel?: (round: number) => string;
  isSlotEditable?: (slot: ResolvedSlot) => boolean;
  onRecordResult: (slot: ResolvedSlot, homeScore: number, awayScore: number) => void;
  onUpdateResult: (slot: ResolvedSlot, homeScore: number, awayScore: number) => void;
}> = ({ slots, getPlayerName, allowDraw, canRecordResults, roundLabel, isSlotEditable, onRecordResult, onUpdateResult }) => {
  const rounds = useMemo(() => {
    const byRound = new Map<number, ResolvedSlot[]>();
    slots.forEach(slot => {
      const bucket = byRound.get(slot.round) ?? [];
      bucket.push(slot);
      byRound.set(slot.round, bucket);
    });
    return Array.from(byRound.entries()).sort((a, b) => a[0] - b[0]);
  }, [slots]);

  return (
    <div className="space-y-4">
      {rounds.map(([round, roundSlots]) => (
        <div key={round}>
          <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
            {roundLabel ? roundLabel(round) : `Round ${round}`}
          </div>
          <div className="space-y-2">
            {roundSlots.map(slot => (
              <MatchRow
                key={slot.id}
                slot={slot}
                getPlayerName={getPlayerName}
                allowDraw={allowDraw}
                canRecordResults={canRecordResults}
                canEdit={isSlotEditable ? isSlotEditable(slot) : true}
                onRecordResult={onRecordResult}
                onUpdateResult={onUpdateResult}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

const PodiumStep: React.FC<{
  place: string;
  names: string[];
  heightClass: string;
  colorClass: string;
  medal: string;
}> = ({ place, names, heightClass, colorClass, medal }) => (
  <div className="flex flex-col items-center gap-2 w-28 sm:w-36">
    <div className="text-2xl" aria-hidden="true">{medal}</div>
    <div className="text-sm font-semibold text-gray-900 dark:text-white text-center leading-tight">
      {names.map(name => (
        <div key={name} className="truncate max-w-full">{name}</div>
      ))}
    </div>
    <div className={`w-full rounded-t-md flex items-start justify-center pt-1.5 text-xs font-bold text-white/90 ${heightClass} ${colorClass}`}>
      {place}
    </div>
  </div>
);

const TournamentDetail: React.FC<TournamentDetailProps> = ({
  tournament,
  matches,
  players,
  canRecordResults,
  canManage,
  onRecordResult,
  onUpdateResult,
  onGenerateNextRound,
  onDelete,
  onRefresh,
  onBack
}) => {
  const state = useMemo(
    () => computeTournamentState(tournament, matches),
    [tournament, matches]
  );

  const nameById = useMemo(
    () => new Map(players.map(player => [player.id, player.name])),
    [players]
  );
  const getPlayerName = (playerId: number) => nameById.get(playerId) ?? `Player ${playerId}`;

  const knockoutSlots = state.slots.filter(slot => slot.phase === 'knockout');
  const groupSlots = state.slots.filter(slot => slot.phase === 'group');
  const roundRobinSlots = state.slots.filter(slot => slot.phase === 'round_robin');
  const swissSlots = state.slots.filter(slot => slot.phase === 'swiss');
  const totalKnockoutRounds = knockoutSlots.reduce((max, slot) => Math.max(max, slot.round), 0);
  const groupCount = tournament.config.groupCount ?? 0;
  const totalPlayable = state.playedMatches + state.pendingMatches;
  // Editing locks: group results freeze once the knockout stage has results
  // (they determine the qualifiers); swiss results freeze once the next round
  // is generated (they determine the pairings)
  const hasKnockoutResults = knockoutSlots.some(slot => slot.matchId !== null);
  // Set-based scoring (volleyball) has no draws
  const allowDraws = (tournament.config.pointsScheme ?? 'flat') !== 'set_based';

  const hasStandings = tournament.format !== 'single_elimination';
  const hasBracket = tournament.format === 'single_elimination' || tournament.format === 'groups_knockout';
  const availableTabs = useMemo(() => {
    const tabs: { id: DetailTab; label: string }[] = [];
    if (hasStandings) {
      tabs.push({ id: 'standings', label: tournament.format === 'groups_knockout' ? 'Groups' : 'Standings' });
    }
    if (hasBracket) tabs.push({ id: 'bracket', label: 'Bracket' });
    tabs.push({ id: 'scores', label: 'Scores' });
    return tabs;
  }, [hasStandings, hasBracket, tournament.format]);

  const [activeTab, setActiveTab] = useState<DetailTab>(availableTabs[0].id);
  const [isAutoRefreshOn, setIsAutoRefreshOn] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // "Live" mode: keep standings/bracket up to date when results are entered
  // from other devices (e.g. tournament shown on a shared screen)
  useAutoRefresh(isAutoRefreshOn, onRefresh);

  // Podium: KO formats use final/semifinal results, points formats use standings
  const podium = useMemo(() => {
    if (!state.isComplete || state.championId === null) return null;
    const loserOf = (slot: ResolvedSlot): number | null => {
      if (slot.winnerPlayerId === null) return null;
      return slot.winnerPlayerId === slot.homePlayerId ? slot.awayPlayerId : slot.homePlayerId;
    };

    if (tournament.format === 'single_elimination' || tournament.format === 'groups_knockout') {
      const finalSlot = knockoutSlots.find(slot => slot.round === totalKnockoutRounds && slot.position === 0);
      const second = finalSlot ? loserOf(finalSlot) : null;
      const thirds = totalKnockoutRounds >= 2
        ? knockoutSlots
            .filter(slot => slot.round === totalKnockoutRounds - 1)
            .map(loserOf)
            .filter((playerId): playerId is number => playerId !== null)
        : [];
      return { first: state.championId, second, thirds };
    }

    const rows = state.standings ?? [];
    return {
      first: state.championId,
      second: rows[1]?.playerId ?? null,
      thirds: rows[2] ? [rows[2].playerId] : []
    };
  }, [state, tournament.format, knockoutSlots, totalKnockoutRounds]);

  const handleRecord = (slot: ResolvedSlot, homeScore: number, awayScore: number) => {
    onRecordResult(tournament, slot, homeScore, awayScore);
  };
  const handleUpdate = (slot: ResolvedSlot, homeScore: number, awayScore: number) => {
    onUpdateResult(tournament, slot, homeScore, awayScore);
  };

  // Shared between the sub-tabs and the full-screen (projector) overlay
  const standingsView = tournament.format === 'groups_knockout' ? (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {Array.from({ length: groupCount }, (_, groupIndex) => (
        <StandingsTable
          key={groupIndex}
          rows={state.groupStandings[groupIndex] ?? []}
          getPlayerName={getPlayerName}
          qualifiedCount={tournament.config.qualifiersPerGroup ?? 0}
          title={`Group ${groupLetter(groupIndex)}`}
        />
      ))}
    </div>
  ) : state.standings ? (
    <div className="max-w-2xl">
      <StandingsTable rows={state.standings} getPlayerName={getPlayerName} />
      {tournament.format === 'swiss' && (
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          Rounds played: {state.swissRoundsGenerated}/{tournament.config.swissRounds ?? state.swissRoundsGenerated}
        </p>
      )}
    </div>
  ) : null;

  const bracketView = (
    <div>
      {tournament.format === 'groups_knockout' && !state.isGroupPhaseComplete && (
        <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
          The bracket fills in as group matches are completed.
        </p>
      )}
      <BracketView slots={knockoutSlots} getPlayerName={getPlayerName} />
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onBack}
            className="p-1.5 rounded-md text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200"
            aria-label="Back to tournaments"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white truncate">{tournament.name}</h2>
            <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-gray-500 dark:text-gray-400">
              <span className="font-semibold text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/40 px-2 py-0.5 rounded-full">
                {formatLabel(tournament.format)}
              </span>
              <span>{tournament.participantIds.length} players</span>
              <span>{state.playedMatches}/{totalPlayable} matches played</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {state.isComplete && state.championId !== null && (
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/40 px-3 py-1.5 rounded-full">
              <Crown className="w-4 h-4" />
              {getPlayerName(state.championId)}
            </span>
          )}
          <LiveToggle isLive={isAutoRefreshOn} onToggle={() => setIsAutoRefreshOn(prev => !prev)} />
          {activeTab !== 'scores' && (
            <FullscreenButton onClick={() => setIsFullscreen(true)} />
          )}
          {canManage && (
            <button
              onClick={() => onDelete(tournament)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors duration-200"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
          )}
        </div>
      </div>

      {podium && (
        <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-gradient-to-b from-amber-50 to-white dark:from-amber-900/20 dark:to-gray-800 p-6">
          <div className="flex items-center justify-center gap-2 mb-5 text-amber-700 dark:text-amber-300 font-semibold">
            <Trophy className="w-5 h-5" />
            Tournament complete
          </div>
          <div className="flex items-end justify-center gap-2 sm:gap-4">
            {podium.second !== null && (
              <PodiumStep
                place="2nd"
                names={[getPlayerName(podium.second)]}
                heightClass="h-16"
                colorClass="bg-gray-400 dark:bg-gray-500"
                medal="🥈"
              />
            )}
            <PodiumStep
              place="1st"
              names={[getPlayerName(podium.first)]}
              heightClass="h-24"
              colorClass="bg-amber-400 dark:bg-amber-500"
              medal="🥇"
            />
            {podium.thirds.length > 0 && (
              <PodiumStep
                place="3rd"
                names={podium.thirds.map(getPlayerName)}
                heightClass="h-12"
                colorClass="bg-orange-400 dark:bg-orange-600"
                medal="🥉"
              />
            )}
          </div>
        </div>
      )}

      {/* Sub-tabs */}
      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700">
        {availableTabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors duration-200 ${
              activeTab === tab.id
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Full-screen (projector) view of the standings or bracket */}
      {isFullscreen && (
        <FullscreenOverlay
          title={tournament.name}
          isLive={isAutoRefreshOn}
          onClose={() => setIsFullscreen(false)}
        >
          {activeTab === 'bracket' && hasBracket ? bracketView : standingsView ?? bracketView}
        </FullscreenOverlay>
      )}

      {/* Standings / Groups tab */}
      {activeTab === 'standings' && hasStandings && standingsView}

      {/* Bracket tab */}
      {activeTab === 'bracket' && hasBracket && bracketView}

      {/* Scores tab */}
      {activeTab === 'scores' && (
        <div className="space-y-8 max-w-3xl">
          {tournament.format === 'single_elimination' && (
            <RoundsList
              slots={knockoutSlots.filter(slot => slot.status !== 'bye')}
              getPlayerName={getPlayerName}
              allowDraw={false}
              canRecordResults={canRecordResults}
              roundLabel={(round) => knockoutRoundLabel(round, totalKnockoutRounds)}
              onRecordResult={handleRecord}
              onUpdateResult={handleUpdate}
            />
          )}

          {tournament.format === 'round_robin' && (
            <RoundsList
              slots={roundRobinSlots}
              getPlayerName={getPlayerName}
              allowDraw={allowDraws}
              canRecordResults={canRecordResults}
              onRecordResult={handleRecord}
              onUpdateResult={handleUpdate}
            />
          )}

          {tournament.format === 'groups_knockout' && (
            <>
              {Array.from({ length: groupCount }, (_, groupIndex) => (
                <div key={groupIndex}>
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">
                    Group {groupLetter(groupIndex)}
                  </h3>
                  <RoundsList
                    slots={groupSlots.filter(slot => slot.group === groupIndex)}
                    getPlayerName={getPlayerName}
                    allowDraw={allowDraws}
                    canRecordResults={canRecordResults}
                    isSlotEditable={() => !hasKnockoutResults}
                    onRecordResult={handleRecord}
                    onUpdateResult={handleUpdate}
                  />
                </div>
              ))}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">
                  Knockout Stage
                  {!state.isGroupPhaseComplete && (
                    <span className="ml-2 text-xs font-normal text-gray-500 dark:text-gray-400">
                      (unlocks when all group matches are played)
                    </span>
                  )}
                </h3>
                <RoundsList
                  slots={knockoutSlots.filter(slot => slot.status !== 'bye')}
                  getPlayerName={getPlayerName}
                  allowDraw={false}
                  canRecordResults={canRecordResults}
                  roundLabel={(round) => knockoutRoundLabel(round, totalKnockoutRounds)}
                  onRecordResult={handleRecord}
                  onUpdateResult={handleUpdate}
                />
              </div>
            </>
          )}

          {tournament.format === 'swiss' && (
            <div>
              {canRecordResults && state.canGenerateNextSwissRound && (
                <button
                  onClick={() => onGenerateNextRound(tournament)}
                  className="mb-4 inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 dark:bg-blue-500 text-white rounded-md hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors duration-200"
                >
                  <PlusCircle className="w-4 h-4" />
                  Generate round {state.swissRoundsGenerated + 1}
                </button>
              )}
              <RoundsList
                slots={swissSlots}
                getPlayerName={getPlayerName}
                allowDraw={allowDraws}
                canRecordResults={canRecordResults}
                isSlotEditable={(slot) => slot.round === state.swissRoundsGenerated}
                onRecordResult={handleRecord}
                onUpdateResult={handleUpdate}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TournamentDetail;
