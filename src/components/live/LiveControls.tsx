"use client";

import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Maximize2, RadioTower, X } from 'lucide-react';

export const LiveToggle: React.FC<{
  isLive: boolean;
  onToggle: () => void;
}> = ({ isLive, onToggle }) => (
  <button
    onClick={onToggle}
    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm whitespace-nowrap rounded-md border transition-colors duration-200 ${
      isLive
        ? 'text-green-700 dark:text-green-300 border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/20'
        : 'text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50'
    }`}
    title="Automatically reload results every 5 seconds"
  >
    <RadioTower className="w-4 h-4" />
    {isLive ? 'Live' : 'Live off'}
    {isLive && <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />}
  </button>
);

export const FullscreenButton: React.FC<{
  onClick: () => void;
}> = ({ onClick }) => (
  <button
    onClick={onClick}
    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm whitespace-nowrap rounded-md border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors duration-200"
    title="Show only the board, full screen"
  >
    <Maximize2 className="w-4 h-4" />
    Full screen
  </button>
);

// Overlay covering the whole viewport with just the board content — meant for
// shared screens/projectors, usually combined with Live mode. Esc closes it.
// Rendered in a portal on document.body: inside the app tree an ancestor with
// a transform/stacking context would break `fixed` and let the page header
// paint on top.
export const FullscreenOverlay: React.FC<{
  title: string;
  isLive: boolean;
  onClose: () => void;
  children: React.ReactNode;
}> = ({ title, isLive, onClose, children }) => {
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  // Lock the page scroll behind the overlay while it is open
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  return createPortal(
    <div className="fixed inset-0 z-[100] bg-gray-50 dark:bg-gray-900 overflow-y-auto">
      <div className="max-w-6xl mx-auto p-6 sm:p-10">
        <div className="flex items-center justify-between gap-3 mb-6">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white truncate">{title}</h2>
          <div className="flex items-center gap-3 shrink-0">
            {isLive && (
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-green-700 dark:text-green-300">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                Live
              </span>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-md text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors duration-200"
              aria-label="Exit full screen"
              title="Exit full screen (Esc)"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
};
