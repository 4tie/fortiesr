// Simple state store with subscribe/publish pattern
// Centralized state management for the application

import { config } from '../config.js';

class Store {
  constructor() {
    this.state = this.getInitialState();
    this.listeners = [];
    this.loadFromStorage();
  }

  getInitialState() {
    return {
      // UI State
      currentPage: config.defaultPage,
      isLoading: false,
      error: null,
      
      // Settings
      settings: null,
      
      // Backtest
      backtestResults: null,
      backtestConfig: null,
      
      // AutoQuant
      autoQuantStatus: null,
      autoQuantResults: null,
      autoQuantConfig: null,
      
      // Navigation
      sidebarOpen: true,
    };
  }

  getState() {
    return { ...this.state };
  }

  setState(newState) {
    this.state = { ...this.state, ...newState };
    this.notifyListeners();
    this.saveToStorage();
  }

  subscribe(listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  notifyListeners() {
    this.listeners.forEach(listener => listener(this.getState()));
  }

  saveToStorage() {
    if (config.enableLocalStorage) {
      try {
        localStorage.setItem(config.localStorageKey, JSON.stringify(this.state));
      } catch (error) {
        console.error('Failed to save state to localStorage:', error);
      }
    }
  }

  loadFromStorage() {
    if (config.enableLocalStorage) {
      try {
        const saved = localStorage.getItem(config.localStorageKey);
        if (saved) {
          this.state = { ...this.state, ...JSON.parse(saved) };
        }
      } catch (error) {
        console.error('Failed to load state from localStorage:', error);
      }
    }
  }

  clearStorage() {
    if (config.enableLocalStorage) {
      try {
        localStorage.removeItem(config.localStorageKey);
      } catch (error) {
        console.error('Failed to clear localStorage:', error);
      }
    }
  }
}

export const store = new Store();
