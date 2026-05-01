// src/supabase.js
//
// Initializes the Supabase client and exports it for use across the site.
// SUPABASE_URL and SUPABASE_ANON_KEY are injected at build time by Webpack's
// DefinePlugin from the project's .env file (see webpack.config.js).
//
// The anon key is safe to expose in the browser — Supabase security is
// enforced by Row Level Security (RLS) policies on the database.

import { createClient } from '@supabase/supabase-js';
import log from './logger';

const supabaseUrl     = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (process.env.NODE_ENV !== 'production') {
  if (!supabaseUrl || !supabaseAnonKey) {
    log.warn('Supabase config is missing env vars. Copy .env.example → .env and fill in credentials.');
  } else {
    log.firebase('Supabase client initialized for:', supabaseUrl);
  }
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Maps a Supabase DB row (snake_case columns) to the shape the app uses (camelCase).
export const mapEvent = (row) => ({
  id:          row.id,
  dateKey:     row.date_key,
  title:       row.title,
  description: row.description ?? '',
  allDay:      row.all_day,
  startTime:   row.start_time ?? '',
  endTime:     row.end_time   ?? '',
  ownerId:     row.owner_id,
  createdAt:   row.created_at,
});

log.firebase('Supabase initialized — client ready');
