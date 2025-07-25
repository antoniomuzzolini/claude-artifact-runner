import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';

const ThemeToggle: React.FC = () => {
  const { isDark, toggleTheme } = useTheme();

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent event bubbling to parent dropdown
    toggleTheme();
  };

  return (
    <button
      onClick={handleToggle}
      className="relative inline-flex items-center justify-center w-12 h-6 bg-gray-200 dark:bg-gray-600 rounded-full transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
    >
      {/* Track */}
      <span className="sr-only">Toggle theme</span>
      
      {/* Sliding circle */}
      <span
        className={`inline-block w-5 h-5 bg-white dark:bg-gray-200 rounded-full shadow-lg transform transition-transform duration-300 ease-in-out ${
          isDark ? 'translate-x-3' : '-translate-x-3'
        }`}
      />
      
      {/* Icons */}
      <Sun
        className={`absolute left-1 w-3 h-3 text-yellow-500 transition-opacity duration-300 ${
          isDark ? 'opacity-0' : 'opacity-100'
        }`}
      />
      <Moon
        className={`absolute right-1 w-3 h-3 text-blue-400 transition-opacity duration-300 ${
          isDark ? 'opacity-100' : 'opacity-0'
        }`}
      />
    </button>
  );
};

export default ThemeToggle; 