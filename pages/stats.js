import { useState, useEffect, useCallback } from 'react';

const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 min auto-refresh

function formatTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function StatCard({ label, value, sub, color }) {
  return (
    <div style={styles.statCard}>
      <div style={{ ...styles.statValue, color: color || '#fff' }}>{value}</div>
      <div style={styles.statLabel}>{label}</div>
      {sub && <div style={styles.statSub}>{sub}</div>}
    </div>
  );
}

function LocationRow({ loc }) {
  const rate = loc.total > 0 ? Math.round((loc.replied / loc.total) * 100) : 100;
  const rateColor = rate === 100 ? '#4ade80' : rate >= 80 ? '#facc15' : '#f87171';
  return (
    <div style={styles.locRow}>
      <div style={styles.locName}>{loc.label}</div>
      <div style={styles.locStat}>{loc.total} reviews</div>
      <div style={styles.locStat}>
        <span style={{ color: rateColor, fontWeight: 600 }}>{rate}%</span> replied
      </div>
      <div style={styles.locStat}>
        {loc.avgRating ? `${loc.avgRating} ★` : '—'}
      </div>
      {loc.unreplied > 0 && (
        <div style={{ ...styles.locStat, color: '#f87171' }}>
          {loc.unreplied} unreplied
        </div>
      )}
    </div>
  );
}

function SampleReview({ r }) {
  const starStr = '★'.repeat(r.stars) + '☆'.repeat(5 - r.stars);
  return (
    <div style={styles.sampleCard}>
      <div style={styles.sampleHeader}>
        <span style={styles.sampleReviewer}>{r.reviewer}</span>
        <span style={styles.sampleLocation}>{r.location}</span>
        <span style={{ color: '#f5a623', fontSize: 13 }}>{starStr}</span>
      </div>
      {r.comment && r.comment !== '(star only)' && (
        <div style={styles.sampleComment}>{r.comment}</div>
      )}
      <div style={styles.sampleReply}>
        <span style={styles.replyTag}>Reply:</span> {r.reply}
      </div>
    </div>
  );
}

export default function Stats() {
  const [token, setToken] = useState('');
  const [authed, setAuthed] = useState(false);
  const [hours, setHours] = useState(48);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lastFetch, setLastFetch] = useState(null);

  // Try to load token from URL hash on mount
  useEffect(() => {
    const hash = window.location.hash.replace('#', '');
    if (hash) {
      setToken(hash);
      setAuthed(true);
    }
  }, []);

  const fetchStats = useCallback(async (overrideToken) => {
    const t = overrideToken || token;
    if (!t) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/monitoring/review-stats?token=${encodeURIComponent(t)}&hours=${hours}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      setData(json);
      setLastFetch(new Date());
      setAuthed(true);
      // Persist token in hash for refresh
      if (window.location.hash !== `#${t}`) {
        window.history.replaceState(null, '', `#${t}`);
      }
    } catch (e) {
      setError(e.message);
      if (e.message === 'Unauthorized') setAuthed(false);
    } finally {
      setLoading(false);
    }
  }, [token, hours]);

  // Auto-fetch on auth
  useEffect(() => {
    if (authed && token) fetchStats();
  }, [authed]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-refresh
  useEffect(() => {
    if (!authed) return;
    const id = setInterval(() => fetchStats(), REFRESH_INTERVAL);
    return () => clearInterval(id);
  }, [authed, fetchStats]);

  function handleLogin(e) {
    e.preventDefault();
    fetchStats();
  }

  // Login screen
  if (!authed) {
    return (
      <main style={styles.page}>
        <div style={{ ...styles.card, maxWidth: 380 }}>
          <h1 style={styles.title}>Contrabando Stats</h1>
          <p style={styles.subtitle}>Enter your access token</p>
          <form onSubmit={handleLogin}>
            <input
              type="password"
              value={token}
              onChange={e => setToken(e.target.value)}
              placeholder="Token"
              style={styles.input}
              autoFocus
            />
            <button type="submit" style={styles.btn} disabled={!token || loading}>
              {loading ? 'Checking...' : 'View stats'}
            </button>
          </form>
          {error && <p style={styles.error}>{error}</p>}
        </div>
      </main>
    );
  }

  // Dashboard
  const overall = data?.overall;
  const locations = data?.byLocation || [];
  const samples = data?.qualitySample || [];
  const pipeline = data?.pipelineState;
  const replyRate = overall?.replyRate ?? '—';
  const rateColor = replyRate === 100 ? '#4ade80' : replyRate >= 80 ? '#facc15' : '#f87171';

  return (
    <main style={styles.page}>
      <div style={styles.card}>
        {/* Header */}
        <div style={styles.header}>
          <div>
            <h1 style={styles.title}>Contrabando Stats</h1>
            <p style={styles.subtitle}>
              Last {hours}h
              {lastFetch && <span> · updated {formatTime(lastFetch.toISOString())}</span>}
              {pipeline?.lastPollTime && (
                <span> · pipeline ran {formatTime(pipeline.lastPollTime)}</span>
              )}
            </p>
          </div>
          <div style={styles.headerActions}>
            <select
              value={hours}
              onChange={e => setHours(Number(e.target.value))}
              style={styles.select}
            >
              <option value={24}>24h</option>
              <option value={48}>48h</option>
              <option value={168}>7 days</option>
            </select>
            <button
              onClick={() => fetchStats()}
              disabled={loading}
              style={styles.refreshBtn}
            >
              {loading ? '...' : '↻'}
            </button>
            <a href="/" style={styles.navLink}>Generator</a>
          </div>
        </div>

        {error && <p style={styles.error}>{error}</p>}

        {data && (
          <>
            {/* Overview cards */}
            <div style={styles.statsRow}>
              <StatCard label="Total reviews" value={overall?.totalReviews ?? 0} />
              <StatCard label="Replied" value={overall?.totalReplied ?? 0} color="#4ade80" />
              <StatCard
                label="Reply rate"
                value={`${replyRate}%`}
                color={rateColor}
              />
            </div>

            {/* Per-location */}
            <div style={styles.section}>
              <h2 style={styles.sectionTitle}>By location</h2>
              {locations.map(loc => (
                <LocationRow key={loc.label} loc={loc} />
              ))}
            </div>

            {/* Unreplied alerts */}
            {locations.some(l => l.unreplied > 0) && (
              <div style={{ ...styles.section, ...styles.alertBox }}>
                <h2 style={{ ...styles.sectionTitle, color: '#f87171' }}>Unreplied reviews</h2>
                {locations.filter(l => l.unreplied > 0).flatMap(l =>
                  l.unrepliedList.map((r, i) => (
                    <div key={`${l.label}-${i}`} style={styles.unrepliedRow}>
                      <strong>{l.label}</strong> · {r.reviewer} · {r.stars}★ · {formatTime(r.createTime)}
                      {r.comment !== '(star only)' && (
                        <div style={styles.unrepliedComment}>{r.comment}</div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Quality sample */}
            {samples.length > 0 && (
              <div style={styles.section}>
                <h2 style={styles.sectionTitle}>Quality sample</h2>
                <p style={styles.sectionSub}>Random selection of recent reply pairs</p>
                {samples.map((r, i) => (
                  <SampleReview key={i} r={r} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    background: '#0f0f0f',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    padding: '40px 16px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  card: {
    background: '#1a1a1a',
    borderRadius: 12,
    padding: '28px 24px',
    width: '100%',
    maxWidth: 680,
    boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  headerActions: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  title: { color: '#fff', fontSize: 22, fontWeight: 700, margin: '0 0 2px' },
  subtitle: { color: '#888', fontSize: 13, margin: 0 },
  input: {
    width: '100%',
    boxSizing: 'border-box',
    background: '#111',
    border: '1px solid #333',
    borderRadius: 8,
    color: '#fff',
    fontSize: 14,
    padding: '10px 12px',
    outline: 'none',
    marginBottom: 12,
    fontFamily: 'inherit',
  },
  btn: {
    width: '100%',
    padding: '12px',
    background: '#c8102e',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    fontSize: 15,
    fontWeight: 600,
    cursor: 'pointer',
  },
  select: {
    background: '#111',
    border: '1px solid #333',
    borderRadius: 6,
    color: '#ccc',
    fontSize: 13,
    padding: '6px 10px',
    outline: 'none',
  },
  refreshBtn: {
    background: '#111',
    border: '1px solid #333',
    borderRadius: 6,
    color: '#ccc',
    fontSize: 16,
    padding: '5px 10px',
    cursor: 'pointer',
    lineHeight: 1,
  },
  navLink: {
    color: '#888',
    fontSize: 13,
    textDecoration: 'none',
    padding: '6px 10px',
    border: '1px solid #333',
    borderRadius: 6,
  },
  error: { color: '#f88', fontSize: 13, marginTop: 12 },

  // Stat cards
  statsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    background: '#111',
    borderRadius: 8,
    padding: '16px 14px',
    textAlign: 'center',
  },
  statValue: { fontSize: 28, fontWeight: 700, lineHeight: 1.2 },
  statLabel: { color: '#888', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 4 },
  statSub: { color: '#666', fontSize: 11, marginTop: 2 },

  // Sections
  section: { marginBottom: 24 },
  sectionTitle: { color: '#ccc', fontSize: 14, fontWeight: 600, margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '0.04em' },
  sectionSub: { color: '#666', fontSize: 12, margin: '-6px 0 12px' },

  // Location rows
  locRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    padding: '10px 12px',
    background: '#111',
    borderRadius: 6,
    marginBottom: 6,
    flexWrap: 'wrap',
  },
  locName: { color: '#fff', fontWeight: 600, fontSize: 14, minWidth: 130 },
  locStat: { color: '#aaa', fontSize: 13 },

  // Alert box
  alertBox: {
    background: 'rgba(248, 113, 113, 0.08)',
    border: '1px solid rgba(248, 113, 113, 0.2)',
    borderRadius: 8,
    padding: '14px 16px',
  },
  unrepliedRow: { color: '#ddd', fontSize: 13, marginBottom: 8, lineHeight: 1.5 },
  unrepliedComment: { color: '#999', fontSize: 12, marginTop: 2, fontStyle: 'italic' },

  // Quality sample
  sampleCard: {
    background: '#111',
    border: '1px solid #222',
    borderRadius: 8,
    padding: '12px 14px',
    marginBottom: 10,
  },
  sampleHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
    flexWrap: 'wrap',
  },
  sampleReviewer: { color: '#fff', fontWeight: 600, fontSize: 13 },
  sampleLocation: { color: '#888', fontSize: 12, background: '#1a1a1a', padding: '2px 8px', borderRadius: 4 },
  sampleComment: { color: '#bbb', fontSize: 13, lineHeight: 1.5, marginBottom: 8 },
  sampleReply: { color: '#8b8', fontSize: 13, lineHeight: 1.5, borderTop: '1px solid #222', paddingTop: 8 },
  replyTag: { color: '#666', fontSize: 11, fontWeight: 600, textTransform: 'uppercase' },
};
