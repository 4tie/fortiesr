const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  NONE: 4
};

let currentLogLevel = LOG_LEVELS.DEBUG;

const setLogLevel = (level) => {
  if (typeof level === 'string') {
    currentLogLevel = LOG_LEVELS[level.toUpperCase()] ?? LOG_LEVELS.DEBUG;
  } else {
    currentLogLevel = level;
  }
};

const formatMessage = (level, message, ...args) => {
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [${level}]`;
  return [prefix, message, ...args];
};

const logger = {
  setLogLevel,
  debug: (message, ...args) => {
    if (currentLogLevel <= LOG_LEVELS.DEBUG) {
      console.debug(...formatMessage('DEBUG', message, ...args));
    }
  },
  info: (message, ...args) => {
    if (currentLogLevel <= LOG_LEVELS.INFO) {
      console.info(...formatMessage('INFO', message, ...args));
    }
  },
  warn: (message, ...args) => {
    if (currentLogLevel <= LOG_LEVELS.WARN) {
      console.warn(...formatMessage('WARN', message, ...args));
    }
  },
  error: (message, ...args) => {
    if (currentLogLevel <= LOG_LEVELS.ERROR) {
      console.error(...formatMessage('ERROR', message, ...args));
    }
  },
  group: (label) => {
    if (currentLogLevel <= LOG_LEVELS.DEBUG) {
      console.group(label);
    }
  },
  groupEnd: () => {
    if (currentLogLevel <= LOG_LEVELS.DEBUG) {
      console.groupEnd();
    }
  },
  table: (data) => {
    if (currentLogLevel <= LOG_LEVELS.DEBUG) {
      console.table(data);
    }
  }
};

export default logger;
