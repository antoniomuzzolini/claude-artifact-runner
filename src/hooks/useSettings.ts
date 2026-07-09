"use client";

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from './useAuth';
import { DEFAULT_RANKING_MODE, RankingMode, isRankingMode } from '../utils/ranking';

const DEFAULT_MIN_MATCHES = 10;
const DEFAULT_ELO_K_FACTOR = 32;

export type HideableTab = 'new-match' | 'history' | 'tournaments' | 'seasons';
export const HIDEABLE_TABS: HideableTab[] = ['new-match', 'history', 'tournaments', 'seasons'];

const normalizeHiddenTabs = (value: unknown): HideableTab[] =>
  Array.isArray(value)
    ? value.filter((tab): tab is HideableTab => HIDEABLE_TABS.includes(tab as HideableTab))
    : [];

export const useSettings = () => {
  const { makeAuthenticatedRequest, isAuthenticated } = useAuth();
  const [minMatchesForRanking, setMinMatchesForRanking] = useState<number>(DEFAULT_MIN_MATCHES);
  const [eloKFactor, setEloKFactor] = useState<number>(DEFAULT_ELO_K_FACTOR);
  const [rankingMode, setRankingMode] = useState<RankingMode>(DEFAULT_RANKING_MODE);
  const [hiddenTabs, setHiddenTabs] = useState<HideableTab[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const loadSettings = useCallback(async () => {
    if (!isAuthenticated) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await makeAuthenticatedRequest('/api/settings');
      if (response.ok) {
        const data = await response.json();
        if (typeof data.minMatchesForRanking === 'number') {
          setMinMatchesForRanking(data.minMatchesForRanking);
        }
        if (typeof data.eloKFactor === 'number') {
          setEloKFactor(data.eloKFactor);
        }
        if (isRankingMode(data.rankingMode)) {
          setRankingMode(data.rankingMode);
        }
        setHiddenTabs(normalizeHiddenTabs(data.hiddenTabs));
      } else {
        const data = await response.json().catch(() => ({}));
        setError(data.error || 'Failed to load settings');
      }
    } catch (err) {
      setError('Failed to load settings');
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, makeAuthenticatedRequest]);

  const persistSettings = useCallback(async (payload: { minMatchesForRanking?: number; eloKFactor?: number; rankingMode?: RankingMode; hiddenTabs?: HideableTab[] }) => {
    if (!isAuthenticated) {
      setError('Authentication required');
      return false;
    }

    setIsSaving(true);
    setError(null);

    try {
      const response = await makeAuthenticatedRequest('/api/settings', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const data = await response.json().catch(() => ({}));
        if (typeof data.minMatchesForRanking === 'number') {
          setMinMatchesForRanking(data.minMatchesForRanking);
        }
        if (typeof data.eloKFactor === 'number') {
          setEloKFactor(data.eloKFactor);
        }
        if (isRankingMode(data.rankingMode)) {
          setRankingMode(data.rankingMode);
        }
        if (data.hiddenTabs !== undefined) {
          setHiddenTabs(normalizeHiddenTabs(data.hiddenTabs));
        }
        return true;
      }

      const data = await response.json().catch(() => ({}));
      setError(data.error || 'Failed to update settings');
      return false;
    } catch (err) {
      setError('Failed to update settings');
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [isAuthenticated, makeAuthenticatedRequest]);

  const updateMinMatchesForRanking = useCallback(
    async (value: number) => persistSettings({ minMatchesForRanking: value }),
    [persistSettings]
  );

  const updateEloKFactor = useCallback(
    async (value: number) => persistSettings({ eloKFactor: value }),
    [persistSettings]
  );

  const updateRankingMode = useCallback(
    async (value: RankingMode) => persistSettings({ rankingMode: value }),
    [persistSettings]
  );

  const updateHiddenTabs = useCallback(
    async (value: HideableTab[]) => persistSettings({ hiddenTabs: value }),
    [persistSettings]
  );

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  return {
    minMatchesForRanking,
    eloKFactor,
    rankingMode,
    hiddenTabs,
    isLoading,
    isSaving,
    error,
    reloadSettings: loadSettings,
    updateMinMatchesForRanking,
    updateEloKFactor,
    updateRankingMode,
    updateHiddenTabs,
  };
};
