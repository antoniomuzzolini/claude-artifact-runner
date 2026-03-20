"use client";

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from './useAuth';
import { DEFAULT_RANKING_MODE, RankingMode, isRankingMode } from '../utils/ranking';

const DEFAULT_MIN_MATCHES = 10;
const DEFAULT_ELO_K_FACTOR = 32;

export const useSettings = () => {
  const { makeAuthenticatedRequest, isAuthenticated } = useAuth();
  const [minMatchesForRanking, setMinMatchesForRanking] = useState<number>(DEFAULT_MIN_MATCHES);
  const [eloKFactor, setEloKFactor] = useState<number>(DEFAULT_ELO_K_FACTOR);
  const [rankingMode, setRankingMode] = useState<RankingMode>(DEFAULT_RANKING_MODE);
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

  const persistSettings = useCallback(async (payload: { minMatchesForRanking?: number; eloKFactor?: number; rankingMode?: RankingMode }) => {
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

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  return {
    minMatchesForRanking,
    eloKFactor,
    rankingMode,
    isLoading,
    isSaving,
    error,
    reloadSettings: loadSettings,
    updateMinMatchesForRanking,
    updateEloKFactor,
    updateRankingMode,
  };
};
