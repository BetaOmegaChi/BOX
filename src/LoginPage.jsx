// src/LoginPage.jsx
//
// Email / password login form backed by Supabase Auth.  On success the user
// is redirected to the home page.  A password-reset flow is also provided.

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from './supabase';
import log from './logger';
import './LoginPage.css';

export default function LoginPage() {
  const navigate = useNavigate();
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [showPw,   setShowPw]   = useState(false);
  const [busy,     setBusy]     = useState(false);
  const [err,      setErr]      = useState('');

  // Redirect automatically if already signed in.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      if (session?.user) {
        log.auth('LoginPage: user already signed in, redirecting home');
        navigate('/');
      }
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  async function handleSubmit(e) {
    e.preventDefault();
    setErr('');
    setBusy(true);
    log.auth('LoginPage: sign-in attempt for', email);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      log.auth('LoginPage: sign-in successful, redirecting home');
      navigate('/');
    } catch (e) {
      log.error('LoginPage: sign-in failed', e.message);
      setErr(niceAuthError(e));
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword() {
    if (!email) {
      setErr('Enter your email above, then click "Forgot password?".');
      return;
    }
    log.auth('LoginPage: sending password reset to', email);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) throw error;
      alert('Password reset email sent.');
    } catch (e) {
      log.error('LoginPage: password reset failed', e.message);
      setErr(niceAuthError(e));
    }
  }

  return (
    <section className="login-page">
      <h2>Sign in</h2>

      <form onSubmit={handleSubmit}>
        <input
          type="email"
          placeholder="Email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <div className="pw-row">
          <input
            type={showPw ? 'text' : 'password'}
            placeholder="Password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button type="button" onClick={() => setShowPw((s) => !s)}>
            {showPw ? 'Hide' : 'Show'}
          </button>
        </div>

        <button type="button" className="link-btn" onClick={resetPassword}>
          Forgot password?
        </button>

        {err && (
          <div className="error" aria-live="polite">
            {err}
          </div>
        )}

        <button type="submit" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Converts a Supabase Auth error into a user-friendly string. */
function niceAuthError(e) {
  const msg = (e?.message ?? '').toLowerCase();
  if (msg.includes('invalid login credentials') || msg.includes('invalid credential'))
    return 'Invalid email or password.';
  if (msg.includes('email not confirmed'))
    return 'Please confirm your email before signing in.';
  if (msg.includes('too many requests'))
    return 'Too many attempts. Try again later.';
  return e?.message || 'Authentication failed.';
}
