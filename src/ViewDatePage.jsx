// src/ViewDatePage.jsx
//
// Day view for a specific date (/view-date/YYYY-MM-DD).
//
// All users can view events.  Authenticated members can create, edit, and
// delete events.  Writes use an optimistic-update pattern: the UI is updated
// immediately and rolled back if Supabase rejects the write.

import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useNavigate, useLocation } from 'react-router-dom';
import './CalendarPage.css';
import './ViewDatePage.css';

import { supabase, mapEvent } from './supabase';
import log from './logger';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns true if the string is a valid "YYYY-MM-DD" dateKey. */
const isValidDateKey = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s);

/** Shifts a dateKey by `deltaDays` days and returns the new dateKey. */
function shiftDateKey(dateKey, deltaDays) {
  const [y, m, d] = dateKey.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + deltaDays);
  const pad2 = (n) => String(n).padStart(2, '0');
  return `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}`;
}

/** Normalises a time string to "HH:MM", e.g. "9:5" → "09:05". */
function normalizeTime(t) {
  if (!t) return '';
  const [h, m] = t.split(':');
  const pad2 = (n) => String(n).padStart(2, '0');
  return `${pad2(+h)}:${pad2(+(m ?? 0))}`;
}

/** Converts a 24-hour "HH:MM" string to a 12-hour "h:mm AM/PM" string. */
function formatTime12h(t) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = ((h + 11) % 12) + 1;
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
}

/** Sorts events: all-day first, then by start time ascending. */
function sortEvents(rows) {
  return [...rows].sort((a, b) => {
    const aIsAllDay = a.allDay ? 1 : 0;
    const bIsAllDay = b.allDay ? 1 : 0;
    if (aIsAllDay !== bIsAllDay) return bIsAllDay - aIsAllDay;
    return (a.startTime || '99:99').localeCompare(b.startTime || '99:99');
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ViewDatePage() {
  const params   = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const dateKey = params?.dateKey ?? new URLSearchParams(location.search).get('dateKey') ?? '';
  const invalid = !isValidDateKey(dateKey);

  // Current Supabase user — null when signed out.
  const [user, setUser] = useState(null);
  const isLoggedIn = !!user;

  // ---------------------------------------------------------------------------
  // Form state — "new event" form
  // ---------------------------------------------------------------------------
  const [newTitle,     setNewTitle]     = useState('');
  const [newDesc,      setNewDesc]      = useState('');
  const [newAllDay,    setNewAllDay]    = useState(false);
  const [newStartTime, setNewStartTime] = useState('');
  const [newEndTime,   setNewEndTime]   = useState('');

  // ---------------------------------------------------------------------------
  // Form state — inline edit form
  // ---------------------------------------------------------------------------
  const [editingId,     setEditingId]     = useState(null);
  const [editTitle,     setEditTitle]     = useState('');
  const [editDesc,      setEditDesc]      = useState('');
  const [editAllDay,    setEditAllDay]    = useState(false);
  const [editStartTime, setEditStartTime] = useState('');
  const [editEndTime,   setEditEndTime]   = useState('');

  const [events, setEvents] = useState([]);
  const [err,    setErr]    = useState('');

  // ---------------------------------------------------------------------------
  // Auth subscription — keep `user` in sync across the lifetime of this page
  // ---------------------------------------------------------------------------
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // ---------------------------------------------------------------------------
  // Supabase subscription — re-runs whenever the dateKey changes
  // ---------------------------------------------------------------------------
  useEffect(() => {
    setEvents([]);
    setEditingId(null);
    setNewTitle(''); setNewDesc(''); setNewAllDay(false);
    setNewStartTime(''); setNewEndTime('');
    setErr('');

    if (invalid) return;

    let mounted = true;

    async function fetchEvents() {
      log.firebase('ViewDatePage: fetching events for', dateKey);

      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('date_key', dateKey)
        .order('created_at', { ascending: false });

      if (!mounted) return;

      if (error) {
        log.error('ViewDatePage: fetch error', error);
        return;
      }

      log.firebase('ViewDatePage:', data.length, 'event(s) for', dateKey);
      setEvents(sortEvents((data ?? []).map(mapEvent)));
    }

    fetchEvents();

    const channel = supabase
      .channel(`viewdate-${dateKey}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'events', filter: `date_key=eq.${dateKey}` },
        () => {
          log.firebase('ViewDatePage: change detected, re-fetching');
          fetchEvents();
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      log.firebase('ViewDatePage: unsubscribing from', dateKey);
      supabase.removeChannel(channel);
    };
  }, [dateKey, invalid]);

  // ---------------------------------------------------------------------------
  // Keyboard day navigation — ← / → or PageUp / PageDown
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const onKey = (e) => {
      const target   = e.target;
      const isTyping = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable;
      if (isTyping) return;
      if (e.key === 'ArrowLeft'  || e.key === 'PageUp')   { e.preventDefault(); goToDelta(-1); }
      if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); goToDelta(+1); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dateKey]);

  // ---------------------------------------------------------------------------
  // Derived values
  // ---------------------------------------------------------------------------

  const prettyDate = useMemo(() => {
    if (invalid) return '';
    const [y, m, d] = dateKey.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
    });
  }, [dateKey, invalid]);

  // ---------------------------------------------------------------------------
  // Navigation helpers
  // ---------------------------------------------------------------------------

  function goToDelta(delta) {
    setEvents([]); setEditingId(null);
    setNewTitle(''); setNewDesc(''); setErr('');
    navigate(`/view-date/${shiftDateKey(dateKey, delta)}`);
  }
  const gotoPrevDay = () => goToDelta(-1);
  const gotoNextDay = () => goToDelta(+1);

  // ---------------------------------------------------------------------------
  // Event CRUD
  // ---------------------------------------------------------------------------

  async function addEvent(e) {
    e.preventDefault();
    setErr('');
    if (!isLoggedIn || !user) return;

    const title       = newTitle.trim();
    const description = newDesc.trim();
    if (!title) return;

    const allDay    = !!newAllDay;
    const startTime = allDay ? '' : normalizeTime(newStartTime);
    const endTime   = allDay ? '' : normalizeTime(newEndTime);

    if (!allDay) {
      if (!startTime || !endTime) { setErr('Please provide start and end times or mark as All Day.'); return; }
      if (startTime > endTime)    { setErr('Start time must be before end time.'); return; }
    }

    // Optimistic update: show the event immediately with a temp ID, then
    // replace it with the real Supabase ID once the write succeeds.
    const tempId     = `temp-${crypto.randomUUID?.() ?? Math.random()}`;
    const optimistic = { id: tempId, dateKey, title, description, allDay, startTime, endTime, ownerId: user.id, createdAt: new Date().toISOString() };

    log.firebase('ViewDatePage: adding event (optimistic)', { title, dateKey });
    setEvents(prev => sortEvents([optimistic, ...prev]));

    try {
      const { data, error } = await supabase.from('events').insert({
        date_key:    dateKey,
        title,
        description,
        all_day:     allDay,
        start_time:  startTime,
        end_time:    endTime,
        owner_id:    user.id,
      }).select().single();

      if (error) throw error;

      log.firebase('ViewDatePage: event saved with id', data.id);
      setEvents(prev => sortEvents(prev.map(ev => ev.id === tempId ? mapEvent(data) : ev)));
      setNewTitle(''); setNewDesc(''); setNewAllDay(false); setNewStartTime(''); setNewEndTime('');
    } catch (err) {
      log.error('ViewDatePage: insert failed', err);
      setErr(err?.message || 'Failed to add event.');
      setEvents(prev => prev.filter(ev => ev.id !== tempId));
    }
  }

  function beginEdit(ev) {
    log.info('ViewDatePage: begin edit', ev.id);
    setEditingId(ev.id);
    setEditTitle(ev.title ?? '');
    setEditDesc(ev.description ?? '');
    setEditAllDay(!!ev.allDay);
    setEditStartTime(ev.startTime ?? '');
    setEditEndTime(ev.endTime ?? '');
  }

  function cancelEdit() {
    setEditingId(null);
    setEditTitle(''); setEditDesc('');
    setEditAllDay(false); setEditStartTime(''); setEditEndTime('');
  }

  async function saveEdit(id) {
    if (!isLoggedIn) return;
    const title       = editTitle.trim();
    const description = editDesc.trim();
    if (!title) return;

    const allDay    = !!editAllDay;
    const startTime = allDay ? '' : normalizeTime(editStartTime);
    const endTime   = allDay ? '' : normalizeTime(editEndTime);

    if (!allDay) {
      if (!startTime || !endTime) { setErr('Please provide start and end times or mark as All Day.'); return; }
      if (startTime > endTime)    { setErr('Start time must be before end time.'); return; }
    }

    const snapshot = events;
    log.firebase('ViewDatePage: saving edit for', id);
    setEvents(prev => prev.map(ev => ev.id === id
      ? { ...ev, title, description, allDay, startTime, endTime }
      : ev
    ));

    try {
      const { error } = await supabase.from('events').update({
        title,
        description,
        all_day:    allDay,
        start_time: startTime,
        end_time:   endTime,
      }).eq('id', id);

      if (error) throw error;
      log.firebase('ViewDatePage: edit saved for', id);
    } catch (err) {
      log.error('ViewDatePage: update failed', err);
      setEvents(snapshot);
      setErr(err?.message || 'Failed to save changes.');
    } finally {
      cancelEdit();
    }
  }

  async function removeEvent(id) {
    if (!isLoggedIn) return;
    if (!confirm('Delete this event?')) return;

    const snapshot = events;
    log.firebase('ViewDatePage: deleting event', id);
    setEvents(prev => prev.filter(ev => ev.id !== id));

    try {
      const { error } = await supabase.from('events').delete().eq('id', id);
      if (error) throw error;
      log.firebase('ViewDatePage: event deleted', id);
    } catch (err) {
      log.error('ViewDatePage: delete failed', err);
      setEvents(snapshot);
      setErr(err?.message || 'Failed to delete event.');
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (invalid) {
    return (
      <section className="view-date-page">
        <div className="error-card">
          <h2>Invalid /view-date URL</h2>
          <p>Expected format: <code>/view-date/YYYY-MM-DD</code></p>
          <button onClick={() => navigate('/calendar')}>Go to Calendar</button>
        </div>
      </section>
    );
  }

  return (
    <section className="view-date-page">

      {/* Day navigation */}
      <div className="calendar-controls">
        <button type="button" onClick={gotoPrevDay} aria-label="Previous day">◀ Previous</button>
        <div className="current-month">{prettyDate}</div>
        <button type="button" onClick={gotoNextDay} aria-label="Next day">Next ▶</button>
      </div>

      {/* Add event form — only visible to authenticated members */}
      {isLoggedIn ? (
        <form onSubmit={addEvent}>
          <p className="form-heading">Add Event</p>

          <div className="form-field">
            <label htmlFor="new-title">Title <span className="form-required">*</span></label>
            <input
              id="new-title"
              placeholder="e.g. Meeting"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
            />
          </div>

          <div className="form-field">
            <label htmlFor="new-desc">Description <span className="form-optional">(optional)</span></label>
            <textarea
              id="new-desc"
              placeholder="Add any details members should know…"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              rows={3}
            />
          </div>

          <div className="form-field">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={newAllDay}
                onChange={e => setNewAllDay(e.target.checked)}
              />
              <span>All Day event</span>
            </label>
          </div>

          {!newAllDay && (
            <div className="time-row">
              <div className="form-field">
                <label htmlFor="new-start">Start Time</label>
                <input id="new-start" type="time" value={newStartTime} onChange={e => setNewStartTime(e.target.value)} />
              </div>
              <div className="form-field">
                <label htmlFor="new-end">End Time</label>
                <input id="new-end" type="time" value={newEndTime} onChange={e => setNewEndTime(e.target.value)} />
              </div>
            </div>
          )}

          {err && <div className="error" aria-live="polite">{err}</div>}
          <button type="submit">Add Event</button>
        </form>
      ) : (
        <p className="calendar-note">Sign in to add events. <Link to="/login">Login</Link></p>
      )}

      {/* Event list */}
      {events.length > 0 && <p className="events-section-heading">Events</p>}
      {events.length === 0 && <p className="no-events">No events for this day.</p>}
      <ul>
        {events.map((ev) => (
          <li key={ev.id}>
            {editingId === ev.id ? (
              /* ---- Inline edit form ---- */
              <div className="event-body">
              <label className="inline">
                  All Day
                  <input
                    type="checkbox"
                    checked={editAllDay}
                    onChange={(e) => setEditAllDay(e.target.checked)}
                  />
                </label>
                {!editAllDay && (
                  <div className="time-row">
                    <input type="time" value={editStartTime} onChange={(e) => setEditStartTime(e.target.value)} aria-label="Start time" />
                    <input type="time" value={editEndTime}   onChange={(e) => setEditEndTime(e.target.value)}   aria-label="End time"   />
                  </div>
                )}
                <input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="Title"
                />
                <textarea
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  placeholder="Description"
                  rows={3}
                />
                <div className="actions">
                  <button onClick={() => saveEdit(ev.id)}>Save</button>
                  <button onClick={cancelEdit}>Cancel</button>
                </div>
              </div>
            ) : (
              /* ---- Read view ---- */
              <div className="event-body">
                <div className="event-header">
                  <strong>{ev.title ?? ev.text}</strong>
                  <span className="event-time-badge">
                    {ev.allDay
                      ? 'All Day'
                      : `${formatTime12h(ev.startTime ?? '')}${ev.endTime ? ' – ' + formatTime12h(ev.endTime) : ''}`
                    }
                  </span>
                </div>
                {ev.description ? <div className="desc">{ev.description}</div> : null}
                {isLoggedIn && (
                  <div className="actions">
                    <button onClick={() => beginEdit(ev)}>Edit</button>
                    <button className="danger" onClick={() => removeEvent(ev.id)}>Delete</button>
                  </div>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>

      {/* Back to calendar — passes current month so CalendarPage restores the right view */}
      <div className="back-row">
        <button
          type="button"
          className="back-btn"
          onClick={() => {
            const [year, month] = dateKey.split('-');
            navigate('/calendar', {
              state: { year: parseInt(year, 10), month: parseInt(month, 10) - 1 },
            });
          }}
        >
          ← Back to Calendar
        </button>
      </div>

    </section>
  );
}
