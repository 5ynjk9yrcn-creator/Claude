// Structured logs on one line each: greppable in a terminal, parseable by a
// log shipper, no dependency.
import { config } from './config.js';

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40, silent: 99 };
const threshold = () => LEVELS[config.logLevel] ?? LEVELS.info;

function emit(level, msg, fields) {
  if (LEVELS[level] < threshold()) return;
  const rec = { t: new Date().toISOString(), level, msg, ...fields };
  const line = Object.entries(rec)
    .map(([k, v]) => `${k}=${typeof v === 'string' && /[\s"]/.test(v) ? JSON.stringify(v) : v}`)
    .join(' ');
  (level === 'error' || level === 'warn' ? process.stderr : process.stdout).write(line + '\n');
}

export const log = {
  debug: (msg, fields = {}) => emit('debug', msg, fields),
  info: (msg, fields = {}) => emit('info', msg, fields),
  warn: (msg, fields = {}) => emit('warn', msg, fields),
  error: (msg, fields = {}) => emit('error', msg, fields)
};
