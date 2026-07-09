"use client";

import { useEffect } from 'react';

export const AUTO_REFRESH_INTERVAL_MS = 5000;

// Poll `onRefresh` while `active` is true — used by "Live" views (shared
// screens showing rankings/brackets while results are entered elsewhere)
export const useAutoRefresh = (active: boolean, onRefresh: () => void) => {
  useEffect(() => {
    if (!active) return;
    const interval = setInterval(() => {
      onRefresh();
    }, AUTO_REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [active, onRefresh]);
};
