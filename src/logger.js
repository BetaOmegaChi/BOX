// src/logger.js
//
// Lightweight dev-only logger. All methods are no-ops in production so there's
// zero overhead and no log leakage in the deployed build.
//
// Usage:
//   import log from './logger';
//   log.info('HomePage mounted');
//   log.firebase('snapshot received', snap.size, 'docs');
//   log.auth('user signed in', user.email);
//   log.error('something broke', err);

const isDev = process.env.NODE_ENV !== 'production';

const noop = () => {};

const logger = isDev
  ? {
      /** General info messages */
      info:     (...args) => console.log   ('%c[BOX]',        'color:#6c8ebf;font-weight:bold', ...args),
      /** Warnings that don't break anything but are worth knowing */
      warn:     (...args) => console.warn  ('%c[BOX:warn]',   'color:#d6a61a;font-weight:bold', ...args),
      /** Errors — always log these */
      error:    (...args) => console.error ('%c[BOX:error]',  'color:#d64f4f;font-weight:bold', ...args),
      /** Database fetch and real-time subscription events */
      firebase: (...args) => console.log   ('%c[BOX:firebase]','color:#ff9900;font-weight:bold', ...args),
      /** Auth state transitions (sign-in, sign-out) */
      auth:     (...args) => console.log   ('%c[BOX:auth]',   'color:#34a853;font-weight:bold', ...args),
    }
  : {
      info: noop, warn: noop, error: noop, firebase: noop, auth: noop,
    };

export default logger;
