const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  none: 4
};

class Logger {
  constructor() {
    this.level = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'test' ? 'none' : 'info');
  }

  setLevel(level) {
    if (LOG_LEVELS[level] !== undefined) {
      this.level = level;
    }
  }

  shouldLog(targetLevel) {
    const currentPriority = LOG_LEVELS[this.level] ?? 1;
    const targetPriority = LOG_LEVELS[targetLevel] ?? 1;
    return targetPriority >= currentPriority;
  }

  debug(...args) {
    if (this.shouldLog('debug')) {
      console.log(`[DEBUG] [${new Date().toISOString()}]`, ...args);
    }
  }

  info(...args) {
    if (this.shouldLog('info')) {
      console.log(`[INFO]  [${new Date().toISOString()}]`, ...args);
    }
  }

  warn(...args) {
    if (this.shouldLog('warn')) {
      console.warn(`[WARN]  [${new Date().toISOString()}]`, ...args);
    }
  }

  error(...args) {
    if (this.shouldLog('error')) {
      console.error(`[ERROR] [${new Date().toISOString()}]`, ...args);
    }
  }
}

module.exports = new Logger();
