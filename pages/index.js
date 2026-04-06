import { useState, useEffect, useCallback, useRef } from 'react';

// ─── Constants ────────────────────────────────────────────────────────────────

const STARS = [1, 2, 3, 4, 5];
const LANGUAGES = ['PT', 'EN', 'ES', 'FR', 'IT'];
const STATS_REFRESH_INTERVAL = 5 * 60 * 1000; // 5 min auto-refresh
const SESSION_KEY = 'cbdo_session';

const SAMPLE_REVIEWS = [
  { stars: 5, lang: 'PT', text: 'Excelente estabelecimento, a comida estava fantástica, comemos hambúrgueres, a carne era de muito boa qualidade. As margaritas também estavam muito boas. Compensa muito!' },
  { stars: 5, lang: 'PT', text: 'FOMOS BEM ATENDIDAS POR DUAS PESSOAS TOPS TOPS, MUITO BOM' },
  { stars: 5, lang: 'PT', text: 'Muito bom!' },
  { stars: 5, lang: 'PT', text: 'Adorei os cocktails e os hambúrgueres. Vamos definitivamente voltar!' },
  { stars: 4, lang: 'PT', text: 'Restaurante Ok com boa comida e menu apropriado. Estabelecimento bem decorado e boa atmosfera. Casas de banho limpas. Atendimento podia ser melhor... estávamos com pressa e não nos foi permitido pagar ao balcão obrigaram nos a sentar outra vez.' },
  { stars: 4, lang: 'PT', text: 'comida muito boa. apesar de ser um bom ambiente para se estar achei que faltava iluminação, mas o espaço é bom para conviver com musica boa, e nao muito alta perfeito para conversas e também apenas para comer.' },
  { stars: 3, lang: 'PT', text: 'O serviço foi eficiente, simpático e atencioso. A comida estava deliciosa e no ponto. No entanto, o espaço é exíguo e não tem luz, além de muito barulhento. Mesmo assim a relação qualidade-preço é razoável se se fizer a reserva.' },
  { stars: 3, lang: 'PT', text: 'Paguei 30€ pela comida e bebida e ainda sai com fome. ATENÇÃO não fui o único.' },
  { stars: 2, lang: 'PT', text: 'Fomos super maltratados pelo Gerente. Acusou o nosso grupo de agir de má-fé porque fizemos uma reserva no The Fork com desconto e de seguida nos juntamos a outro grupo.' },
  { stars: 1, lang: 'PT', text: 'preço exorbitante para o que é. já de comida mexicana foi a pior que já comi, o burrito não tem sabor, o brownie não é brownie é apenas um pedaço de bolo de chocolate duro e é 7,90€' },
  { stars: 1, lang: 'PT', text: 'Um local péssimo, com atendimento mal educado. O atendente não deveria estar a trabalhar com público. Não indico para ninguém este estabelecimento.' },
  { stars: 5, lang: 'EN', text: 'One of the best mexican restaurants in margem sul. Highly recommend! Book through fork.' },
  { stars: 5, lang: 'EN', text: 'Amazing food, great cocktails and really friendly staff. Will definitely be back.' },
  { stars: 4, lang: 'EN', text: 'Really good food and atmosphere. Service was a bit slow but the margaritas made up for it. Would come back.' },
  { stars: 3, lang: 'EN', text: 'Food was decent but nothing special. Portions are quite small for the price. Cocktails are the highlight though.' },
  { stars: 1, lang: 'EN', text: 'Terrible service, the waiter ignored us for 30 minutes. Food was cold when it arrived. Very disappointing.' },
  { stars: 5, lang: 'ES', text: 'Me encantan los restaurantes contrabando. Ya los probé en Lisboa y Almada. Son simplemente espectaculares. La amabilidad de los trabajadores hace toda la diferencia.' },
  { stars: 4, lang: 'ES', text: 'La comida estaba muy buena pero el servicio fue lento. Los cócteles son excelentes, especialmente las margaritas.' },
  { stars: 2, lang: 'ES', text: 'Noche de mariachis con buen cantante que arregló la noche. La comida fue un total desastre. Nachos aguados y quemados, guacamole sin sabor.' },
  { stars: 3, lang: 'ES', text: 'El ambiente es bonito y los cócteles buenos, pero la comida es cara para lo que ofrecen. El servicio podría mejorar.' },
];

let lastRandomIndex = -1;
function getRandomReview() {
  let idx;
  do { idx = Math.floor(Math.random() * SAMPLE_REVIEWS.length); } while (idx === lastRandomIndex);
  lastRandomIndex = idx;
  return SAMPLE_REVIEWS[idx];
}

function formatTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function LoginScreen({ onLogin }) {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (!password) return;
    setLoading(true);
    setError('');
    // Validate against the API — if it returns 401 the password is wrong
    try {
      const res = await fetch(`/api/stats?password=${encodeURIComponent(password)}&hours=1`);
      if (res.status === 401) {
        setError('Wrong password');
        setLoading(false);
        return;
      }
      // Valid — persist and proceed
      localStorage.setItem(SESSION_KEY, password);
      onLogin(password);
    } catch {
      setError('Connection error, try again');
      setLoading(false);
    }
  }

  return (
    <main style={s.page}>
      <div style={{ ...s.card, maxWidth: 360 }}>
        <h1 style={s.title}>Contrabando</h1>
        <p style={{ ...s.subtitle, marginBottom: 24 }}>Enter password to continue</p>
        <form onSubmit={handleSubmit}>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Password"
            style={s.input}
            autoFocus
          />
          <button type="submit" style={s.primaryBtn} disabled={!password || loading}>
            {loading ? 'Checking...' : 'Enter'}
          </button>
        </form>
        {error && <p style={s.error}>{error}</p>}
      </div>
    </main>
  );
}

function GeneratorTab() {
  const [stars, setStars] = useState(5);
  const [text, setText] = useState('');
  const [lang, setLang] = useState('PT');
  const [reply, setReply] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [randomFlash, setRandomFlash] = useState(false);

  function loadRandom() {
    const r = getRandomReview();
    setStars(r.stars);
    setLang(r.lang);
    setText(r.text);
    setReply('');
    setError('');
    setRandomFlash(true);
    setTimeout(() => setRandomFlash(false), 300);
  }

  async function generate() {
    setLoading(true);
    setReply('');
    setError('');
    setCopied(false);
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ starRating: stars, reviewText: text, language: lang })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Something went wrong');
      setReply(data.reply);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function copy() {
    await navigator.clipboard.writeText(reply);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div>
      <label style={s.label}>Star rating</label>
      <div style={s.starsRow}>
        {STARS.map(n => (
          <button key={n} onClick={() => setStars(n)}
            style={{ ...s.starBtn, ...(n <= stars ? s.starActive : {}) }}>
            {n <= stars ? '★' : '☆'}
          </button>
        ))}
        <span style={s.starLabel}>{stars} star{stars > 1 ? 's' : ''}</span>
      </div>

      <label style={s.label}>Language</label>
      <div style={s.langRow}>
        {LANGUAGES.map(l => (
          <button key={l} onClick={() => setLang(l)}
            style={{ ...s.langBtn, ...(lang === l ? s.langActive : {}) }}>
            {l}
          </button>
        ))}
      </div>

      <label style={s.label}>
        Review text <span style={s.optional}>(leave blank for star-only)</span>
      </label>
      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder="Paste a review or hit Random..."
        rows={4}
        style={s.textarea}
      />

      <div style={s.btnRow}>
        <button onClick={generate} disabled={loading}
          style={{ ...s.primaryBtn, flex: 1, ...(loading ? s.primaryBtnDisabled : {}) }}>
          {loading ? 'Generating...' : 'Generate reply'}
        </button>
        <button onClick={loadRandom}
          style={{ ...s.ghostBtn, ...(randomFlash ? s.ghostBtnFlash : {}) }}>
          ↻ Random
        </button>
      </div>

      {error && <p style={s.error}>{error}</p>}

      {reply && (
        <div style={s.replyBox}>
          <div style={s.replyHeader}>
            <span style={s.replyLabel}>Reply</span>
            <button onClick={copy} style={s.copyBtn}>{copied ? 'Copied!' : 'Copy'}</button>
          </div>
          <p style={s.replyText}>{reply}</p>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color }) {
  return (
    <div style={s.statCard}>
      <div style={{ ...s.statValue, color: color || '#fff' }}>{value}</div>
      <div style={s.statLabel}>{label}</div>
    </div>
  );
}

function LocationRow({ loc }) {
  const rate = loc.total > 0 ? Math.round((loc.replied / loc.total) * 100) : 100;
  const rateColor = rate === 100 ? '#4ade80' : rate >= 80 ? '#facc15' : '#f87171';
  return (
    <div style={s.locRow}>
      <div style={s.locName}>{loc.label}</div>
      <div style={s.locMeta}>
        <span style={s.locStat}>{loc.total} reviews</span>
        <span style={{ ...s.locStat, color: rateColor, fontWeight: 600 }}>{rate}% replied</span>
        <span style={s.locStat}>{loc.avgRating ? `${loc.avgRating} ★` : '—'}</span>
        {loc.unreplied > 0 && <span style={{ ...s.locStat, color: '#f87171' }}>{loc.unreplied} unreplied</span>}
      </div>
    </div>
  );
}

function SampleCard({ r }) {
  const stars = '★'.repeat(r.stars) + '☆'.repeat(5 - r.stars);
  return (
    <div style={s.sampleCard}>
      <div style={s.sampleHeader}>
        <span style={s.sampleReviewer}>{r.reviewer}</span>
        <span style={s.sampleLocation}>{r.location}</span>
        <span style={{ color: '#f5a623', fontSize: 13 }}>{stars}</span>
      </div>
      {r.comment && r.comment !== '(star only)' && (
        <p style={s.sampleComment}>{r.comment}</p>
      )}
      <p style={s.sampleReply}><span style={s.replyTag}>Reply</span> {r.reply}</p>
    </div>
  );
}

function StatsTab({ password }) {
  const [hours, setHours] = useState(48);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lastFetch, setLastFetch] = useState(null);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/stats?password=${encodeURIComponent(password)}&hours=${hours}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      setData(json);
      setLastFetch(new Date());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [password, hours]);

  // Fetch on mount and when hours changes
  useEffect(() => { fetchStats(); }, [fetchStats]);

  // Auto-refresh every 5 min
  useEffect(() => {
    const id = setInterval(fetchStats, STATS_REFRESH_INTERVAL);
    return () => clearInterval(id);
  }, [fetchStats]);

  const overall = data?.overall;
  const locations = data?.byLocation || [];
  const samples = data?.qualitySample || [];
  const pipeline = data?.pipelineState;
  const replyRate = overall?.replyRate ?? '—';
  const rateColor = replyRate === 100 ? '#4ade80' : replyRate >= 80 ? '#facc15' : '#f87171';

  return (
    <div>
      {/* Controls */}
      <div style={s.statsControls}>
        <p style={s.subtitle}>
          Last {hours}h
          {lastFetch && <span> · updated {formatTime(lastFetch.toISOString())}</span>}
          {pipeline?.lastPollTime && <span> · bot ran {formatTime(pipeline.lastPollTime)}</span>}
        </p>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select value={hours} onChange={e => setHours(Number(e.target.value))} style={s.select}>
            <option value={24}>24h</option>
            <option value={48}>48h</option>
            <option value={168}>7 days</option>
          </select>
          <button onClick={fetchStats} disabled={loading} style={s.iconBtn}>
            {loading ? '...' : '↻'}
          </button>
        </div>
      </div>

      {error && <p style={s.error}>{error}</p>}

      {data && (
        <>
          {/* Overview */}
          <div style={s.statsRow}>
            <StatCard label="Total reviews" value={overall?.totalReviews ?? 0} />
            <StatCard label="Replied" value={overall?.totalReplied ?? 0} color="#4ade80" />
            <StatCard label="Reply rate" value={`${replyRate}%`} color={rateColor} />
          </div>

          {/* By location */}
          <div style={s.section}>
            <h3 style={s.sectionTitle}>By location</h3>
            {locations.map(loc => <LocationRow key={loc.label} loc={loc} />)}
          </div>

          {/* Unreplied alert */}
          {locations.some(l => l.unreplied > 0) && (
            <div style={{ ...s.section, ...s.alertBox }}>
              <h3 style={{ ...s.sectionTitle, color: '#f87171' }}>Unreplied reviews</h3>
              {locations.filter(l => l.unreplied > 0).flatMap(l =>
                l.unrepliedList.map((r, i) => (
                  <div key={`${l.label}-${i}`} style={s.unrepliedRow}>
                    <strong>{l.label}</strong> · {r.reviewer} · {r.stars}★ · {formatTime(r.createTime)}
                    {r.comment !== '(star only)' && <div style={s.unrepliedComment}>{r.comment}</div>}
                  </div>
                ))
              )}
            </div>
          )}

          {/* Quality sample */}
          {samples.length > 0 && (
            <div style={s.section}>
              <h3 style={s.sectionTitle}>Quality sample</h3>
              <p style={s.sectionSub}>Random selection of recent reply pairs</p>
              {samples.map((r, i) => <SampleCard key={i} r={r} />)}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Main app ─────────────────────────────────────────────────────────────────

export default function App() {
  const [password, setPassword] = useState(null);
  const [tab, setTab] = useState('generator');

  // Restore session on mount
  useEffect(() => {
    const saved = localStorage.getItem(SESSION_KEY);
    if (saved) setPassword(saved);
  }, []);

  function handleLogin(pw) {
    setPassword(pw);
  }

  function handleLogout() {
    localStorage.removeItem(SESSION_KEY);
    setPassword(null);
  }

  if (!password) return <LoginScreen onLogin={handleLogin} />;

  return (
    <main style={s.page}>
      <div style={{ ...s.card, maxWidth: tab === 'stats' ? 680 : 520 }}>
        {/* Header */}
        <div style={s.header}>
          <div>
            <h1 style={s.title}>Contrabando</h1>
          </div>
          <button onClick={handleLogout} style={s.logoutBtn}>Log out</button>
        </div>

        {/* Tabs */}
        <div style={s.tabs}>
          <button
            onClick={() => setTab('generator')}
            style={{ ...s.tab, ...(tab === 'generator' ? s.tabActive : {}) }}
          >
            Generator
          </button>
          <button
            onClick={() => setTab('stats')}
            style={{ ...s.tab, ...(tab === 'stats' ? s.tabActive : {}) }}
          >
            Stats
          </button>
        </div>

        {/* Tab content */}
        {tab === 'generator' ? <GeneratorTab /> : <StatsTab password={password} />}
      </div>
    </main>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = {
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
    boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
    transition: 'max-width 0.2s ease',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: { color: '#fff', fontSize: 22, fontWeight: 700, margin: 0 },
  subtitle: { color: '#888', fontSize: 13, margin: 0 },

  // Tabs
  tabs: {
    display: 'flex',
    gap: 4,
    background: '#111',
    borderRadius: 8,
    padding: 4,
    marginBottom: 24,
  },
  tab: {
    flex: 1,
    padding: '8px 0',
    background: 'none',
    border: 'none',
    borderRadius: 6,
    color: '#888',
    fontSize: 14,
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'background 0.15s, color 0.15s',
  },
  tabActive: {
    background: '#2a2a2a',
    color: '#fff',
  },

  // Login
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

  // Buttons
  primaryBtn: {
    width: '100%',
    padding: '12px',
    background: '#c8102e',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    fontSize: 15,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  primaryBtnDisabled: { background: '#5a0a14', cursor: 'not-allowed' },
  ghostBtn: {
    background: 'none',
    border: '1px solid #333',
    color: '#aaa',
    fontSize: 15,
    padding: '12px 20px',
    borderRadius: 8,
    cursor: 'pointer',
    fontWeight: 600,
    whiteSpace: 'nowrap',
    fontFamily: 'inherit',
  },
  ghostBtnFlash: { background: '#2a2a2a', color: '#fff', borderColor: '#555' },
  logoutBtn: {
    background: 'none',
    border: '1px solid #333',
    color: '#666',
    fontSize: 12,
    padding: '5px 12px',
    borderRadius: 6,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  iconBtn: {
    background: '#111',
    border: '1px solid #333',
    borderRadius: 6,
    color: '#ccc',
    fontSize: 16,
    padding: '5px 10px',
    cursor: 'pointer',
    lineHeight: 1,
  },
  copyBtn: {
    background: '#2a2a2a',
    border: 'none',
    color: '#ccc',
    fontSize: 12,
    padding: '4px 10px',
    borderRadius: 4,
    cursor: 'pointer',
  },

  // Generator
  label: {
    display: 'block',
    color: '#aaa',
    fontSize: 12,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: 8,
  },
  optional: { color: '#555', fontWeight: 400, textTransform: 'none', letterSpacing: 0 },
  starsRow: { display: 'flex', alignItems: 'center', gap: 6, marginBottom: 20 },
  starBtn: { background: 'none', border: 'none', cursor: 'pointer', fontSize: 26, color: '#555', padding: 0, lineHeight: 1 },
  starActive: { color: '#f5a623' },
  starLabel: { color: '#666', fontSize: 13, marginLeft: 6 },
  langRow: { display: 'flex', gap: 8, marginBottom: 20 },
  langBtn: { padding: '6px 14px', borderRadius: 6, border: '1px solid #333', background: '#111', color: '#888', fontSize: 13, cursor: 'pointer', fontWeight: 500, fontFamily: 'inherit' },
  langActive: { background: '#2a2a2a', color: '#fff', borderColor: '#555' },
  textarea: {
    width: '100%', boxSizing: 'border-box', background: '#111', border: '1px solid #333',
    borderRadius: 8, color: '#fff', fontSize: 14, padding: '10px 12px', resize: 'vertical',
    outline: 'none', marginBottom: 16, fontFamily: 'inherit', lineHeight: 1.5,
  },
  btnRow: { display: 'flex', gap: 10 },
  replyBox: { background: '#111', border: '1px solid #2a2a2a', borderRadius: 8, padding: '14px 16px', marginTop: 20 },
  replyHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  replyLabel: { color: '#aaa', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' },
  replyText: { color: '#e8e8e8', fontSize: 14, margin: 0, lineHeight: 1.6, whiteSpace: 'pre-wrap' },
  error: { color: '#f88', fontSize: 13, marginTop: 12, margin: '12px 0 0' },

  // Stats
  statsControls: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    gap: 12,
    flexWrap: 'wrap',
  },
  select: {
    background: '#111',
    border: '1px solid #333',
    borderRadius: 6,
    color: '#ccc',
    fontSize: 13,
    padding: '6px 10px',
    outline: 'none',
    fontFamily: 'inherit',
  },
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
  section: { marginBottom: 24 },
  sectionTitle: { color: '#ccc', fontSize: 13, fontWeight: 600, margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '0.04em' },
  sectionSub: { color: '#666', fontSize: 12, margin: '-6px 0 12px' },
  locRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 12px',
    background: '#111',
    borderRadius: 6,
    marginBottom: 6,
    flexWrap: 'wrap',
    gap: 8,
  },
  locName: { color: '#fff', fontWeight: 600, fontSize: 14 },
  locMeta: { display: 'flex', gap: 14, flexWrap: 'wrap' },
  locStat: { color: '#aaa', fontSize: 13 },
  alertBox: {
    background: 'rgba(248, 113, 113, 0.08)',
    border: '1px solid rgba(248, 113, 113, 0.2)',
    borderRadius: 8,
    padding: '14px 16px',
  },
  unrepliedRow: { color: '#ddd', fontSize: 13, marginBottom: 8, lineHeight: 1.5 },
  unrepliedComment: { color: '#999', fontSize: 12, marginTop: 2, fontStyle: 'italic' },
  sampleCard: {
    background: '#111',
    border: '1px solid #222',
    borderRadius: 8,
    padding: '12px 14px',
    marginBottom: 10,
  },
  sampleHeader: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' },
  sampleReviewer: { color: '#fff', fontWeight: 600, fontSize: 13 },
  sampleLocation: { color: '#888', fontSize: 12, background: '#1a1a1a', padding: '2px 8px', borderRadius: 4 },
  sampleComment: { color: '#bbb', fontSize: 13, lineHeight: 1.5, margin: '0 0 8px' },
  sampleReply: { color: '#8b8', fontSize: 13, lineHeight: 1.5, borderTop: '1px solid #222', paddingTop: 8, margin: 0 },
  replyTag: { color: '#666', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', marginRight: 4 },
};
