// Configuration file for 4tie frontend
// Easy to change API endpoints and settings without touching code

export const config = {
  // API Configuration
  apiBaseUrl: 'http://localhost:8000',
  apiTimeout: 30000,
  retryAttempts: 3,
  
  // Feature Flags
  enableDebugMode: false,
  enableErrorLogging: true,
  
  // UI Configuration
  defaultTheme: 'dark',
  animationDuration: 300,
  
  // Page Configuration
  defaultPage: 'dashboard',
  pages: ['dashboard', 'autoquant', 'settings'],
  
  // State Configuration
  enableLocalStorage: true,
  localStorageKey: '4tie_state',
  
  // Performance
  debounceDelay: 300,
  throttleDelay: 100,
};
