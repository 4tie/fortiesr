/**
 * AppContext - Global application state
 * Manages theme, navigation, notifications, and global loading/error states
 */

import { createContext, useContext, useState, useCallback } from 'react';

const AppContext = createContext(null);

export const AppProvider = ({ children }) => {
  // Navigation
  const [currentTab, setCurrentTab] = useState('autoquant');
  
  // Theme
  const [theme, setTheme] = useState('dark');
  
  // User settings
  const [userSettings, setUserSettings] = useState({
    tradingStyle: 'swing',
    riskProfile: 'balanced',
    exchange: 'binance',
  });
  
  // Global notifications (toasts)
  const [toasts, setToasts] = useState([]);
  
  // Global loading state
  const [isLoading, setIsLoading] = useState(false);
  
  // Global error state
  const [error, setError] = useState(null);
  
  // Theme toggle
  const toggleTheme = useCallback(() => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  }, []);
  
  // Add toast notification
  const addToast = useCallback((message, type = 'info', duration = 3000) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    
    if (duration > 0) {
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, duration);
    }
  }, []);
  
  // Remove toast
  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);
  
  // Set global loading
  const setLoading = useCallback((loading) => {
    setIsLoading(loading);
  }, []);
  
  // Set global error
  const setGlobalError = useCallback((err) => {
    setError(err);
    if (err) {
      addToast(err.message || 'An error occurred', 'error');
    }
  }, [addToast]);
  
  // Update user settings
  const updateUserSettings = useCallback((settings) => {
    setUserSettings(prev => ({ ...prev, ...settings }));
  }, []);
  
  const value = {
    // Navigation
    currentTab,
    setCurrentTab,
    
    // Theme
    theme,
    setTheme,
    toggleTheme,
    
    // User settings
    userSettings,
    updateUserSettings,
    
    // Toasts
    toasts,
    addToast,
    removeToast,
    
    // Global state
    isLoading,
    setLoading,
    error,
    setGlobalError,
  };
  
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within AppProvider');
  }
  return context;
};
