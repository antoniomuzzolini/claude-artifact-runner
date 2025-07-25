import { useState, useEffect, useCallback } from 'react';

type Theme = 'light' | 'dark';

export const useTheme = () => {
  const [theme, setTheme] = useState<Theme>('light');

  // Initialize theme from localStorage or system preference
  useEffect(() => {
    const savedTheme = localStorage.getItem('championship_theme') as Theme;
    if (savedTheme) {
      setTheme(savedTheme);
      document.documentElement.classList.toggle('dark', savedTheme === 'dark');
    } else {
      // Check system preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const systemTheme = prefersDark ? 'dark' : 'light';
      setTheme(systemTheme);
      document.documentElement.classList.toggle('dark', systemTheme === 'dark');
    }
  }, []);

  const toggleTheme = useCallback(() => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('championship_theme', newTheme);
    document.documentElement.classList.toggle('dark', newTheme === 'dark');
  }, [theme]);

  const setLightMode = useCallback(() => {
    setTheme('light');
    localStorage.setItem('championship_theme', 'light');
    document.documentElement.classList.remove('dark');
  }, []);

  const setDarkMode = useCallback(() => {
    setTheme('dark');
    localStorage.setItem('championship_theme', 'dark');
    document.documentElement.classList.add('dark');
  }, []);

  return {
    theme,
    isDark: theme === 'dark',
    toggleTheme,
    setLightMode,
    setDarkMode,
  };
}; 