"use client";

import React, { useMemo } from 'react';
import { ArrowLeft, Crown, PlusCircle, Trash2 } from 'lucide-react';
import { Match, Player, Tournament } from '../../types/championship';
import {
  ResolvedSlot,
  computeTournamentState,
  formatLabel
} from '../../utils/tournament';
import BracketView from './BracketView';
import StandingsTable from './StandingsTable';
import SlotScoreEntry from './SlotScoreEntry';

interface TournamentDetailProps {
  tournament: Tournament;
  matches: Match[];
  players: Player[];
  canRecordResults: boolean;
  canManage: boolean;
  onRecordResult: (tournament: Tournament, slot: ResolvedSlot, homeScore: number, awayScore: number) => void;
  onGenerateNextRound: (tournament: Tournament) => void;
  onDelete: (tournament: Tournament) => void;
  onBack: () => void;
}

const MatchRow: React.FC<{
  slot: ResolvedSlot;
  getPlayerName: (playerId: number) => string;
  allowDraw: boolean;
  canRecordResults: boolean;
  onRecordResult: (slot: ResolvedSlot, homeScore: number, awayScore: number) => void;
}> = ({ slot, getPlayerName, allowDraw, canRecordResults, onRecordResult }) => {
  const homeName = slot.homePlayerId !== null ? getPlayerName(slot.homePlayerId) : 'TBD';
  const awayName = slot.awayIsBye ? 'Bye' : (slot.awayPlayerId !== null ? getPlayerName(slot.awayPlayerId) : 'TBD');

  const scoreFor = (playerId: number | null): number | null => {
    if (!slot.match || playerId === null) return null;
    const teamIndex = slot.match.teams.findIndex(team => team.some(member => member.id === playerId));
    return teamIndex === -1 ? null : slot.match.scores[teamIndex] ?? null;
  };

  const homeScore = scoreFor(slot.homePlayerId);
  const awayScore = scoreFor(slot.awayPlayerId);
  const homeWon = slot.winnerPlayerId !== null && slot.winnerPlayerId === slot.homePlayerId;
  const awayWon = slot.winnerPlayerId !== null && slot.winnerPlayerId === slot.awayPlayerId;

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/40">
      <div className="flex items-center gap-2 text-sm min-w-0">
        <span className={`truncate ${homeWon ? 'font-semibold text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-300'}`}>
          {homeName}
        </span>
        <span className="text-gray-400 dark:text-gray-500 text-xs">vs</span>
        <span className={`truncate ${awayWon ? 'font-semibold text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-300'} ${slot.awayIsBye ? 'italic text-gray-400 dark:text-gray-500' : ''}`}>
          {awayName}
        </span>
      </div>
      {slot.status === 'done' && homeScore !== null && awayScore !== null && (
        <span className="text-sm font-semibold tabular-nums text-gray-900 dark:text-white">
          {homeScore} - {awayScore}
          {slot.isDraw && <span className="ml-2 text-xs font-normal text-gray-500 dark:text-gray-400">Draw</span>}
        </span>
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
  onRecordResult: (slot: ResolvedSlot, homeScore: number, awayScore: number) => void;
}> = ({ slots, getPlayerName, allowDraw, canRecordResults, onRecordResult }) => {
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
            Round {round}
          </div>
          <div className="space-y-2">
            {roundSlots.map(slot => (
              <MatchRow
                key={slot.id}
                slot={slot}
                getPlayerName={getPlayerName}
                allowDraw={allowDraw}
                canRecordResults={canRecordResults}
                onRecordResult={onRecordResult}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

const TournamentDetail: React.FC<TournamentDetailProps> = ({
  tournament,
  matches,
  players,
  canRecordResults,
  canManage,
  onRecordResult,
  onGenerateNextRound,
  onDelete,
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
  const groupCount = tournament.config.groupCount ?? 0;
  const totalPlayable = state.playedMatches + state.pendingMatches;

  const handleRecord = (slot: ResolvedSlot, homeScore: number, awayScore: number) => {
    onRecordResult(tournament, slot, homeScore, awayScore);
  };

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

      {tournament.format === 'single_elimination' && (
        <BracketView
          slots={knockoutSlots}
          getPlayerName={getPlayerName}
          canRecordResults={canRecordResults}
          onRecordResult={handleRecord}
        />
      )}

      {tournament.format === 'round_robin' && state.standings && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">Standings</h3>
            <StandingsTable rows={state.standings} getPlayerName={getPlayerName} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">Matches</h3>
            <RoundsList
              slots={roundRobinSlots}
              getPlayerName={getPlayerName}
              allowDraw
              canRecordResults={canRecordResults}
              onRecordResult={handleRecord}
            />
          </div>
        </div>
      )}

      {tournament.format === 'groups_knockout' && (
        <div className="space-y-8">
          <div>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">Group Stage</h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {Array.from({ length: groupCount }, (_, groupIndex) => (
                <div key={groupIndex} className="space-y-3">
                  <StandingsTable
                    rows={state.groupStandings[groupIndex] ?? []}
                    getPlayerName={getPlayerName}
                    qualifiedCount={tournament.config.qualifiersPerGroup ?? 0}
                    title={`Group ${String.fromCharCode(65 + groupIndex)}`}
                  />
                  <RoundsList
                    slots={groupSlots.filter(slot => slot.group === groupIndex)}
                    getPlayerName={getPlayerName}
                    allowDraw
                    canRecordResults={canRecordResults}
                    onRecordResult={handleRecord}
                  />
                </div>
              ))}
            </div>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">
              Knockout Stage
              {!state.isGroupPhaseComplete && (
                <span className="ml-2 text-xs font-normal text-gray-500 dark:text-gray-400">
                  (unlocks when all group matches are played)
                </span>
              )}
            </h3>
            <BracketView
              slots={knockoutSlots}
              getPlayerName={getPlayerName}
              canRecordResults={canRecordResults && state.isGroupPhaseComplete}
              onRecordResult={handleRecord}
            />
          </div>
        </div>
      )}

      {tournament.format === 'swiss' && state.standings && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">Standings</h3>
            <StandingsTable rows={state.standings} getPlayerName={getPlayerName} />
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                Rounds ({state.swissRoundsGenerated}/{tournament.config.swissRounds ?? state.swissRoundsGenerated})
              </h3>
              {canRecordResults && state.canGenerateNextSwissRound && (
                <button
                  onClick={() => onGenerateNextRound(tournament)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 dark:bg-blue-500 text-white rounded-md hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors duration-200"
                >
                  <PlusCircle className="w-4 h-4" />
                  Generate next round
                </button>
              )}
            </div>
            <RoundsList
              slots={swissSlots}
              getPlayerName={getPlayerName}
              allowDraw
              canRecordResults={canRecordResults}
              onRecordResult={handleRecord}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default TournamentDetail;
