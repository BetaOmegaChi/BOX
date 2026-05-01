// src/auth.js
//
// Thin wrappers around Supabase Auth so the rest of the app imports from here
// rather than directly from '@supabase/supabase-js'.  This keeps Supabase as a
// single dependency boundary and makes auth calls easy to trace in the dev console.

import { supabase } from './supabase';
import log from './logger';

/** Creates a new Supabase account with the given email and password. */
export const signUp = async (email, password) => {
  log.auth('signUp attempt for', email);
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  return data;
};

/** Signs in an existing Supabase user. */
export const signIn = async (email, password) => {
  log.auth('signIn attempt for', email);
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
};

/** Signs the current user out. */
export const logOut = async () => {
  log.auth('logOut called');
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
};

/**
 * Subscribes to auth state changes.  Fires immediately with the current session.
 * @param {function} cb - Called with the Supabase User object (or null when signed out).
 * @returns {function} Unsubscribe function — call it in a useEffect cleanup.
 */
export const watchUser = (cb) => {
  // Fire immediately with the current session so callers don't have to wait.
  supabase.auth.getSession().then(({ data: { session } }) => {
    cb(session?.user ?? null);
  });

  const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
    log.auth('auth state changed — user:', session?.user?.email ?? 'null (signed out)');
    cb(session?.user ?? null);
  });

  return () => subscription.unsubscribe();
};
