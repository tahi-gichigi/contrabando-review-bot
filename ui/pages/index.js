import { useState } from 'react';

const STARS = [1, 2, 3, 4, 5];
const LANGUAGES = ['PT', 'EN', 'ES', 'FR', 'IT'];

export default function Home() {
  const [stars, setStars] = useState(5);
  const [text, setText] = useState('');
  const [lang, setLang] = useState('PT');
  const [reply, setReply] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

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
    <main style={styles.page}>
      <div style={styles.card}>
        <h1 style={styles.title}>Contrabando</h1>
        <p style={styles.subtitle}>Google Review Reply Generator</p>

        {/* Star rating */}
        <label style={styles.label}>Star rating</label>
        <div style={styles.stars}>
          {STARS.map(s => (
            <button
              key={s}
              onClick={() => setStars(s)}
              style={{ ...styles.starBtn, ...(s <= stars ? styles.starActive : {}) }}
              title={`${s} star${s > 1 ? 's' : ''}`}
            >
              {s <= stars ? '★' : '☆'}
            </button>
          ))}
          <span style={styles.starLabel}>{stars} star{stars > 1 ? 's' : ''}</span>
        </div>

        {/* Language */}
        <label style={styles.label}>Language</label>
        <div style={styles.langRow}>
          {LANGUAGES.map(l => (
            <button
              key={l}
              onClick={() => setLang(l)}
              style={{ ...styles.langBtn, ...(lang === l ? styles.langActive : {}) }}
            >
              {l}
            </button>
          ))}
        </div>

        {/* Review text */}
        <label style={styles.label}>Review text <span style={styles.optional}>(leave blank for star-only)</span></label>
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Paste the review here..."
          rows={4}
          style={styles.textarea}
        />

        <button
          onClick={generate}
          disabled={loading}
          style={{ ...styles.btn, ...(loading ? styles.btnDisabled : {}) }}
        >
          {loading ? 'Generating...' : 'Generate reply'}
        </button>

        {error && <p style={styles.error}>{error}</p>}

        {reply && (
          <div style={styles.replyBox}>
            <div style={styles.replyHeader}>
              <span style={styles.replyLabel}>Reply</span>
              <button onClick={copy} style={styles.copyBtn}>
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <p style={styles.replyText}>{reply}</p>
          </div>
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
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
  },
  card: {
    background: '#1a1a1a',
    borderRadius: 12,
    padding: '32px 28px',
    width: '100%',
    maxWidth: 520,
    boxShadow: '0 4px 24px rgba(0,0,0,0.4)'
  },
  title: { color: '#fff', fontSize: 22, fontWeight: 700, margin: '0 0 2px' },
  subtitle: { color: '#888', fontSize: 13, margin: '0 0 28px' },
  label: { display: 'block', color: '#aaa', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 },
  optional: { color: '#555', fontWeight: 400, textTransform: 'none', letterSpacing: 0 },
  stars: { display: 'flex', alignItems: 'center', gap: 6, marginBottom: 20 },
  starBtn: { background: 'none', border: 'none', cursor: 'pointer', fontSize: 26, color: '#555', padding: 0, lineHeight: 1 },
  starActive: { color: '#f5a623' },
  starLabel: { color: '#666', fontSize: 13, marginLeft: 6 },
  langRow: { display: 'flex', gap: 8, marginBottom: 20 },
  langBtn: { padding: '6px 14px', borderRadius: 6, border: '1px solid #333', background: '#111', color: '#888', fontSize: 13, cursor: 'pointer', fontWeight: 500 },
  langActive: { background: '#2a2a2a', color: '#fff', borderColor: '#555' },
  textarea: {
    width: '100%', boxSizing: 'border-box', background: '#111', border: '1px solid #333',
    borderRadius: 8, color: '#fff', fontSize: 14, padding: '10px 12px', resize: 'vertical',
    outline: 'none', marginBottom: 16, fontFamily: 'inherit', lineHeight: 1.5
  },
  btn: {
    width: '100%', padding: '12px', background: '#c8102e', color: '#fff',
    border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 600, cursor: 'pointer'
  },
  btnDisabled: { background: '#5a0a14', cursor: 'not-allowed' },
  error: { color: '#f88', fontSize: 13, marginTop: 12 },
  replyBox: { background: '#111', border: '1px solid #2a2a2a', borderRadius: 8, padding: '14px 16px', marginTop: 20 },
  replyHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  replyLabel: { color: '#aaa', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' },
  copyBtn: { background: '#2a2a2a', border: 'none', color: '#ccc', fontSize: 12, padding: '4px 10px', borderRadius: 4, cursor: 'pointer' },
  replyText: { color: '#e8e8e8', fontSize: 14, margin: 0, lineHeight: 1.6, whiteSpace: 'pre-wrap' }
};
