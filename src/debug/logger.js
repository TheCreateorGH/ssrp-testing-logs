const util = require('util');
const fs = require('fs');
const path = require('path');

const DEBUG = process.env.DEBUG === 'true';
const LOG_FILE = path.join(__dirname, '..', '..', 'server.log');

const ANSI = {
    log: '\x1b[37m', info: '\x1b[36m', warn: '\x1b[33m',
    error: '\x1b[31m', debug: '\x1b[90m', reset: '\x1b[0m', bold: '\x1b[1m'
};

// Captured before anything is overridden, so console.silent and the
// logger's own terminal output always have an unwrapped writer to use.
const original = {
    log: console.log.bind(console),
    info: console.info.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console),
    debug: (console.debug || console.log).bind(console)
};

// eslint-disable-next-line no-control-regex
const ANSI_STRIP_RE = /\x1b\[[0-9;]*m/g;

function appendToFile(line) {
    try { fs.appendFileSync(LOG_FILE, line.replace(ANSI_STRIP_RE, '') + '\n'); } catch { /* logging must never crash the app */ }
}

function makeLogger(level) {
    return (...args) => {
        const time = new Date().toISOString();
        const message = util.format(...args); // handles nested objects, %s/%d, etc.
        const plain = `[${time}] [${level.toUpperCase()}] ${message}`;
        const colored = `${ANSI[level]}[${time}] [${level.toUpperCase()}]${ANSI.reset} ${message}`;
        original[level](colored);
        appendToFile(plain);
    };
}

/** Activates the interceptor layer. Safe to call unconditionally —
 *  it only overrides console.{log,info,warn,error,debug} when
 *  DEBUG=true; console.silent is always available either way. */
function activate() {
    console.silent = original.log;

    if (!DEBUG) return;

    console.log = makeLogger('log');
    console.info = makeLogger('info');
    console.warn = makeLogger('warn');
    console.error = makeLogger('error');
    console.debug = makeLogger('debug');

    console.log(`${ANSI.bold}[LOGGER]${ANSI.reset} Debug logging activated — console output is now timestamped, colored, and mirrored to ${LOG_FILE}`);
}

module.exports = { activate, isDebug: () => DEBUG };
