// src/CalendarPage.jsx
//
// Monthly calendar grid.  Fetches events for the visible month from Supabase
// in real time and renders each day as a clickable button.  Supports:
//   • Previous/Next/Today controls
//   • Keyboard navigation  (← → PageUp PageDown = months, T = today)
//   • Swipe-to-change-month on touch devices

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import './style.css';
import './CalendarPage.css';

import { supabase, mapEvent } from './supabase';
import log from './logger';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Converts a Date to a "YYYY-MM-DD" dateKey. */
function toKey(d) {
  const y  = d.getFullYear();
  const m  = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

/**
 * Returns the first and last dateKey strings for a given month.
 * @param {number} year  - Full year (e.g. 2025)
 * @param {number} month - 0-based month index (0 = January)
 */
function monthKeyRange(year, month) {
  const mm   = String(month + 1).padStart(2, '0');
  const start = `${year}-${mm}-01`;
  const lastDay = new Date(year, month + 1, 0).getDate();
  const end     = `${year}-${mm}-${String(lastDay).padStart(2, '0')}`;
  return { start, end };
}

/** Converts a 24-hour "HH:MM" string to a 12-hour "h:mm AM/PM" string. */
function formatTime12h(t) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = ((h + 11) % 12) + 1;
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
}

// ---------------------------------------------------------------------------
// Swipe gesture thresholds — tune here if swipe feels too sensitive/loose
// ---------------------------------------------------------------------------
const SWIPE_MIN_PX   = 48;
const SWIPE_MAX_DEG  = 30;
const SWIPE_MAX_MS   = 800;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CalendarPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const today    = new Date();
  const todayKey = toKey(today);

  const [viewYear,     setViewYear]     = useState(today.getFullYear());
  const [viewMonth,    setViewMonth]    = useState(today.getMonth());
  const [eventsByDate, setEventsByDate] = useState({});

  // If navigating back from ViewDatePage, restore the month that was open.
  useEffect(() => {
    if (
      location?.state &&
      Number.isInteger(location.state.year) &&
      Number.isInteger(location.state.month)
    ) {
      log.info('CalendarPage: restoring month from navigation state', location.state);
      setViewYear(location.state.year);
      setViewMonth(location.state.month);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------------------------------------------------------------------------
  // Live Supabase subscription for the visible month
  // ---------------------------------------------------------------------------
  useEffect(() => {
    let mounted = true;
    const { start, end } = monthKeyRange(viewYear, viewMonth);

    async function fetchEvents() {
      log.firebase(`CalendarPage: fetching events ${start} → ${end}`);

      const { data, error } = await supabase
        .from('events')
        .select('*')
        .gte('date_key', start)
        .lte('date_key', end)
        .order('date_key', { ascending: true });

      if (!mounted) return;

      if (error) {
        log.error('CalendarPage: fetch error', error);
        return;
      }

      log.firebase(`CalendarPage: received ${data.length} event(s) for month`);

      // Group events by dateKey so each calendar cell can look up its list in O(1).
      const map = {};
      (data ?? []).forEach(row => {
        const ev = mapEvent(row);
        if (!map[ev.dateKey]) map[ev.dateKey] = [];
        map[ev.dateKey].push(ev);
      });
      setEventsByDate(map);
    }

    fetchEvents();

    // Re-fetch whenever any event row changes.
    const channel = supabase
      .channel(`calendar-${viewYear}-${viewMonth}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, () => {
        log.firebase('CalendarPage: change detected, re-fetching');
        fetchEvents();
      })
      .subscribe();

    return () => {
      mounted = false;
      log.firebase('CalendarPage: unsubscribing');
      supabase.removeChannel(channel);
    };
  }, [viewYear, viewMonth]);

  // ---------------------------------------------------------------------------
  // Month navigation
  // ---------------------------------------------------------------------------

  const goPrevMonth = () => {
    const d = new Date(viewYear, viewMonth - 1, 1);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  };
  const goNextMonth = () => {
    const d = new Date(viewYear, viewMonth + 1, 1);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  };
  const goToday = () => {
    const t = new Date();
    setViewYear(t.getFullYear());
    setViewMonth(t.getMonth());
  };

  useEffect(() => {
    const onKey = (e) => {
      const target  = e.target;
      const isTyping = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable;
      if (isTyping) return;

      if (e.key === 'ArrowLeft'  || e.key === 'PageUp')   { e.preventDefault(); goPrevMonth(); }
      if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); goNextMonth(); }
      if (e.key === 't'          || e.key === 'T')         { e.preventDefault(); goToday();     }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [viewYear, viewMonth]);

  // ---------------------------------------------------------------------------
  // Swipe gesture (Pointer Events API)
  // ---------------------------------------------------------------------------

  const pointerStart = useRef({ x: 0, y: 0 });
  const isDragging   = useRef(false);
  const didSwipe     = useRef(false);
  const pointerTime  = useRef(0);

  const markSwipeAndClear = () => {
    didSwipe.current = true;
    setTimeout(() => { didSwipe.current = false; }, 0);
  };

  const onPointerDown = (e) => {
    if (e.pointerType !== 'touch' && e.button !== 0) return;
    isDragging.current   = true;
    pointerTime.current  = performance.now();
    pointerStart.current = { x: e.clientX, y: e.clientY };
  };

  const onPointerMove = (/* e */) => {};

  const onPointerUp = (e) => {
    if (!isDragging.current) return;
    isDragging.current = false;

    const elapsed   = performance.now() - pointerTime.current;
    const dx        = e.clientX - pointerStart.current.x;
    const dy        = e.clientY - pointerStart.current.y;
    const angle     = Math.abs(Math.atan2(dy, dx) * (180 / Math.PI));
    const isHoriz   = angle <= SWIPE_MAX_DEG || angle >= (180 - SWIPE_MAX_DEG);
    const longEnough = Math.abs(dx) >= SWIPE_MIN_PX;
    const fastEnough = elapsed <= SWIPE_MAX_MS;

    if (isHoriz && longEnough && fastEnough) {
      log.info(`CalendarPage: swipe ${dx < 0 ? 'left (next)' : 'right (prev)'} — dx=${dx}px, dt=${Math.round(elapsed)}ms`);
      dx < 0 ? goNextMonth() : goPrevMonth();
      markSwipeAndClear();
    }
  };

  const openDate = (day) => {
    if (didSwipe.current) return;
    const dateKey = toKey(new Date(viewYear, viewMonth, day));
    log.info('CalendarPage: opening date', dateKey);
    navigate(`/view-date/${dateKey}`);
  };

  // ---------------------------------------------------------------------------
  // Calendar grid
  // ---------------------------------------------------------------------------

  const weekDays    = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const firstOfMonth = useMemo(() => new Date(viewYear, viewMonth, 1), [viewYear, viewMonth]);
  const firstDay     = firstOfMonth.getDay();
  const daysInMonth  = new Date(viewYear, viewMonth + 1, 0).getDate();

  const monthName = useMemo(() =>
    new Date(viewYear, viewMonth, 1).toLocaleString(undefined, { month: 'long', year: 'numeric' }),
    [viewYear, viewMonth]
  );

  const cells = [];

  for (const day of weekDays) {
    cells.push(<div key={'h' + day} className="calendar-cell header">{day}</div>);
  }

  for (let i = 0; i < firstDay; i++) {
    cells.push(<div key={'e' + i} className="calendar-cell" />);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const date    = new Date(viewYear, viewMonth, day);
    const dateKey = toKey(date);
    const isToday = dateKey === todayKey;

    const events = [...(eventsByDate[dateKey] || [])].sort((a, b) => {
      const aIsAllDay = a.allDay ? 1 : 0;
      const bIsAllDay = b.allDay ? 1 : 0;
      if (aIsAllDay !== bIsAllDay) return bIsAllDay - aIsAllDay;
      return (a.startTime || '99:99').localeCompare(b.startTime || '99:99');
    });

    const ariaLabel = `${date.toLocaleDateString(undefined, {
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
    })}${events.length ? `, ${events.length} event${events.length > 1 ? 's' : ''}` : ''}`;

    cells.push(
      <button
        key={'d' + day}
        className={`calendar-cell day ${events.length ? 'has-events' : ''} ${isToday ? 'today' : ''}`}
        onClick={() => openDate(day)}
        type="button"
        aria-label={ariaLabel}
        title={ariaLabel}
      >
        <div className="day-number">{day}</div>

        {events.length > 0 && (
          <div className="event-list">
            {events.slice(0, 2).map((ev) => {
              const title = ev.title ?? ev.text ?? '';
              const when  = ev.allDay
                ? 'All Day'
                : ev.startTime
                  ? `${formatTime12h(ev.startTime)}${ev.endTime ? '–' + formatTime12h(ev.endTime) : ''}`
                  : '';
              return (
                <div key={ev.id} className="event-title">
                  {title.length > 16 ? title.slice(0, 16) + '…' : title}
                  <div className="event-time">{when}</div>
                </div>
              );
            })}
            {events.length > 2 && (
              <div className="event-more">+{events.length - 2} more</div>
            )}
          </div>
        )}
      </button>
    );
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <section className="calendar-page">

      <div className="calendar-controls">
        <button type="button" onClick={goPrevMonth} aria-label="Previous month">◀</button>
        <div className="current-month" aria-live="polite">{monthName}</div>
        <button type="button" onClick={goNextMonth} aria-label="Next month">▶</button>
        <button type="button" onClick={goToday}     aria-label="Jump to today">Today</button>
      </div>

      <h2>Club Calendar</h2>
      <p className="calendar-note">Click a date to view and (if logged in) add events for that day.</p>

      <div
        id="calendarGrid"
        className="calendar-grid"
        key={`${viewYear}-${viewMonth}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {cells}
      </div>

    </section>
  );
}
