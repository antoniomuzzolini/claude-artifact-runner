import { useState, useEffect, useCallback } from 'react';

type Theme = 'light' | 'dark';

export const useTheme = () => {
  // Initialize with system preference or saved theme
  const getInitialTheme = (): Theme => {
    // First check localStorage
    const savedTheme = localStorage.getItem('championship_theme') as Theme;
    if (savedTheme === 'light' || savedTheme === 'dark') {
      return savedTheme;
    }
    
    // Then check system preference
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    
    return 'light';
  };

  const [theme, setTheme] = useState<Theme>(getInitialTheme);

  // Apply theme to document
  const applyTheme = useCallback((newTheme: Theme) => {
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  // Initialize theme on mount
  useEffect(() => {
    applyTheme(theme);
    // Save initial theme if not already saved
    if (!localStorage.getItem('championship_theme')) {
      localStorage.setItem('championship_theme', theme);
    }
  }, [theme, applyTheme]);

  const toggleTheme = useCallback(() => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('championship_theme', newTheme);
    applyTheme(newTheme);
  }, [theme, applyTheme]);

  const setLightMode = useCallback(() => {
    setTheme('light');
    localStorage.setItem('championship_theme', 'light');
    applyTheme('light');
  }, [applyTheme]);

  const setDarkMode = useCallback(() => {
    setTheme('dark');
    localStorage.setItem('championship_theme', 'dark');
    applyTheme('dark');
  }, [applyTheme]);

  return {
    theme,
    isDark: theme === 'dark',
    toggleTheme,
    setLightMode,
    setDarkMode,
  };
}; 