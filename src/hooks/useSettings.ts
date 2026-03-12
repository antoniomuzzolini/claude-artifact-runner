"use client";

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from './useAuth';

const DEFAULT_MIN_MATCHES = 10;

export const useSettings = () => {
  const { makeAuthenticatedRequest, isAuthenticated } = useAuth();
  const [minMatchesForRanking, setMinMatchesForRanking] = useState<number>(DEFAULT_MIN_MATCHES);
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

  const updateMinMatchesForRanking = useCallback(async (value: number) => {
    if (!isAuthenticated) {
      setError('Authentication required');
      return false;
    }

    setIsSaving(true);
    setError(null);

    try {
      const response = await makeAuthenticatedRequest('/api/settings', {
        method: 'POST',
        body: JSON.stringify({ minMatchesForRanking: value }),
      });

      if (response.ok) {
        const data = await response.json().catch(() => ({}));
        const newValue = typeof data.minMatchesForRanking === 'number' ? data.minMatchesForRanking : value;
        setMinMatchesForRanking(newValue);
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

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  return {
    minMatchesForRanking,
    isLoading,
    isSaving,
    error,
    reloadSettings: loadSettings,
    updateMinMatchesForRanking,
  };
};
