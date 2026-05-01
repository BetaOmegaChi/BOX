// src/NavBar.jsx
//
// Persistent top navigation bar.  Renders the brand, main nav links, external
// social links, and a Login/Logout button that reflects the current Supabase
// auth state in real time.

import React, { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { supabase } from './supabase';
import log from './logger';
import './NavBar.css';

// ---------------------------------------------------------------------------
// SVG icon components
// ---------------------------------------------------------------------------

function InstagramIcon(props) {
  return (
    <svg
      aria-hidden="true"
      width="18" height="18" viewBox="0 0 24 24" fill="none"
      xmlns="http://www.w3.org/2000/svg" {...props}
    >
      <path d="M7 2h10a5 5 0 015 5v10a5 5 0 01-5 5H7a5 5 0 01-5-5V7a5 5 0 015-5Z" stroke="currentColor" strokeWidth="1.5"/>
      <circle cx="12" cy="12" r="3.5" stroke="currentColor" strokeWidth="1.5"/>
      <circle cx="17.5" cy="6.5" r="1.25" fill="currentColor"/>
    </svg>
  );
}

function StoreIcon(props) {
  return (
    <svg
      aria-hidden="true"
      width="18" height="18" viewBox="0 0 24 24" fill="none"
      xmlns="http://www.w3.org/2000/svg" {...props}
    >
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M9 22V12h6v10" stroke="currentColor" strokeWidth="1.5"/>
    </svg>
  );
}

// ---------------------------------------------------------------------------
// NavBar
// ---------------------------------------------------------------------------

export default function NavBar() {
  const navigate = useNavigate();
  const [open, setOpen]         = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);

  // Sync with Supabase auth state — fires immediately with current session,
  // then updates whenever the user signs in or out.
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setLoggedIn(!!session?.user);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      log.auth('NavBar: auth state →', session?.user ? 'logged in' : 'logged out');
      setLoggedIn(!!session?.user);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    log.auth('NavBar: logout initiated');
    try {
      await supabase.auth.signOut();
      log.auth('NavBar: logout successful');
    } catch (err) {
      log.error('NavBar: logout failed', err);
    }
    setLoggedIn(false);
    setOpen(false);
    navigate('/login');
  };

  const linkClass = ({ isActive }) => (isActive ? 'nav-link active' : 'nav-link');

  return (
    <header className="bx-navbar">
      <div className="bx-nav-inner">

        {/* Brand — clicking always goes home and closes the mobile menu */}
        <button className="bx-brand" onClick={() => { setOpen(false); navigate('/'); }}>
          <span className="bx-logo">ΒΩΧ</span>
          <span className="bx-name">Beta Omega Chi</span>
        </button>

        {/* Hamburger toggle (visible on mobile only) */}
        <button
          className={`bx-burger ${open ? 'open' : ''}`}
          aria-label="Toggle menu"
          aria-expanded={open}
          onClick={() => setOpen(v => !v)}
        >
          <span/> <span/> <span/>
        </button>

        {/* Primary nav — each link closes the mobile menu on click */}
        <nav className={`bx-links ${open ? 'open' : ''}`}>
          <NavLink to="/"        className={linkClass} end      onClick={() => setOpen(false)}>Home</NavLink>
          <NavLink to="/calendar" className={linkClass}          onClick={() => setOpen(false)}>Calendar</NavLink>

          <a
            href="https://instagram.com/huinstabox?utm_source=site&utm_medium=nav&utm_campaign=header"
            className="nav-link social"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Open our Instagram (opens in a new tab)"
            onClick={() => setOpen(false)}
          >
            <InstagramIcon />
            <span className="sr-only">Instagram</span>
          </a>

          <a
            href="https://the-box-shop.square.site/"
            className="nav-link social"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Open our Merch Store (opens in a new tab)"
            onClick={() => setOpen(false)}
          >
            <StoreIcon />
            <span className="sr-only">Merch Store</span>
          </a>

          {loggedIn ? (
            <button
              type="button"
              className="nav-link as-button"
              onClick={handleLogout}
            >
              Logout
            </button>
          ) : (
            <NavLink to="/login" className={linkClass} onClick={() => setOpen(false)}>Login</NavLink>
          )}
        </nav>

      </div>
    </header>
  );
}
