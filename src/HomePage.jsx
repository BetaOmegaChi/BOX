// src/HomePage.jsx
//
// Landing page: hero section, an "About Us" blurb, and a live list of the
// next five upcoming events pulled from Supabase.

import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import "./style.css";
import "./HomePage.css";
import logo from "./assets/BOXBoxer.png";

import { supabase, mapEvent } from "./supabase";
import log from "./logger";

// ---------------------------------------------------------------------------
// Date / time helpers
// ---------------------------------------------------------------------------

/** Zero-pads a number to two digits: 5 → "05" */
const pad2 = (n) => String(n).padStart(2, "0");

/** Converts a Date object to a "YYYY-MM-DD" dateKey. */
const toKey = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

/** Converts a 24-hour "HH:MM" string to a 12-hour "h:mm AM/PM" string. */
const formatTime12h = (t) => {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = ((h + 11) % 12) + 1;
  return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
};

/** Converts a "YYYY-MM-DD" dateKey to a human-readable date string. */
const prettyFromKey = (key) => {
  if (!key) return "";
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function HomePage() {
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [nextFive, setNextFive] = useState([]);

  useEffect(() => {
    let mounted = true;

    const now      = new Date();
    const todayKey = toKey(now);
    const nowTime  = `${pad2(now.getHours())}:${pad2(now.getMinutes())}`;

    async function fetchEvents() {
      log.firebase('HomePage: fetching upcoming events from', todayKey);

      const { data, error } = await supabase
        .from('events')
        .select('*')
        .gte('date_key', todayKey)
        .order('date_key', { ascending: true })
        .limit(120);

      if (!mounted) return;

      if (error) {
        log.error('HomePage: fetch error', error);
        setNextFive([]);
        setLoadingEvents(false);
        return;
      }

      log.firebase('HomePage: received', data.length, 'docs');
      const rows = (data ?? []).map(mapEvent);

      // Drop events that have already ended today.
      const upcoming = rows.filter((ev) => {
        if (!ev?.dateKey) return false;
        if (ev.dateKey > todayKey) return true;
        if (ev.dateKey < todayKey) return false;
        if (ev.allDay) return true;
        const et = ev.endTime   || "";
        const st = ev.startTime || "";
        if (et) return et >= nowTime;
        if (st) return st >= nowTime;
        return true;
      });

      // Primary sort by date, secondary by all-day first, tertiary by start time.
      upcoming.sort((a, b) => {
        if (a.dateKey !== b.dateKey) return a.dateKey.localeCompare(b.dateKey);
        const aIsAllDay = a.allDay ? 1 : 0;
        const bIsAllDay = b.allDay ? 1 : 0;
        if (aIsAllDay !== bIsAllDay) return bIsAllDay - aIsAllDay;
        const aStart = a.startTime || "99:99";
        const bStart = b.startTime || "99:99";
        return aStart.localeCompare(bStart);
      });

      log.firebase('HomePage: rendering', Math.min(upcoming.length, 5), 'of', upcoming.length, 'upcoming events');
      setNextFive(upcoming.slice(0, 5));
      setLoadingEvents(false);
    }

    fetchEvents();

    // Re-fetch whenever any event row changes.
    const channel = supabase
      .channel('homepage-events')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, () => {
        log.firebase('HomePage: change detected, re-fetching');
        fetchEvents();
      })
      .subscribe();

    return () => {
      mounted = false;
      log.firebase('HomePage: unsubscribing from events');
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <div className="homepage-container">

      {/* Hero */}
      <section className="homepage-intro">
        <img src={logo} alt="Beta Omega Chi Logo" className="homepage-image" />
        <h1>Welcome to Beta Omega Chi</h1>
        <p className="tagline">A brotherhood Built On Christ.</p>
      </section>

      {/* About */}
      <section className="homepage-about">
        <h2>About Us</h2>
        <p>
          Beta Omega Chi is a brotherhood Built On Christ at Harding University.
          We strive to shine God's light through service, friendship, and example,
          building strong bonds among our members while encouraging one another
          toward spiritual growth and unity.
        </p>
      </section>

      {/* Upcoming events */}
      <section className="homepage-events">
        <div className="section-header">
          <h2>Upcoming Events</h2>
          <Link className="btn-outline" to="/calendar">Open Calendar</Link>
        </div>

        {loadingEvents && <p className="muted">Loading events…</p>}
        {!loadingEvents && nextFive.length === 0 && (
          <p className="muted">No upcoming events yet.</p>
        )}

        <ul className="event-list">
          {nextFive.map((ev) => {
            const title = ev.title ?? ev.text ?? "";
            const when = ev.allDay
              ? "All Day"
              : ev.startTime
                ? `${formatTime12h(ev.startTime)}${ev.endTime ? " – " + formatTime12h(ev.endTime) : ""}`
                : "";

            return (
              <li key={ev.id} className="event-row">
                <div className="event-title">
                  <Link to={`/view-date/${ev.dateKey}`}>{title}</Link>
                  <div className="event-time">{when}</div>
                </div>
                <div className="event-meta">{prettyFromKey(ev.dateKey)}</div>
                <div className="event-actions">
                  <Link className="btn small" to={`/view-date/${ev.dateKey}`}>Open</Link>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

    </div>
  );
}
