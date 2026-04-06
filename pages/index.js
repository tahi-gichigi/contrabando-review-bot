import { useState, useRef } from 'react';

const STARS = [1, 2, 3, 4, 5];
const LANGUAGES = ['PT', 'EN', 'ES', 'FR', 'IT'];

// 20 real reviews across PT/EN/ES, range of ratings and topics
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

// Track last index to avoid immediate repeat
let lastIndex = -1;

function getRandomReview() {
  let idx;
  do { idx = Math.floor(Math.random() * SAMPLE_REVIEWS.length); } while (idx === lastIndex);
  lastIndex = idx;
  return SAMPLE_REVIEWS[idx];
}

export default function Home() {
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
    // Brief flash to confirm it changed
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
    <main style={styles.page}>
      <div style={styles.card}>
        <h1 style={styles.title}>Contrabando</h1>
        <div style={styles.titleRow}>
          <p style={styles.subtitle}>Google Review Reply Generator</p>
          <a href="/stats" style={styles.statsLink}>Stats →</a>
        </div>

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
        <label style={styles.label}>
          Review text <span style={styles.optional}>(leave blank for star-only)</span>
        </label>
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Paste a review or hit Random..."
          rows={4}
          style={styles.textarea}
        />

        <div style={styles.btnRow}>
          <button
            onClick={generate}
            disabled={loading}
            style={{ ...styles.btn, ...(loading ? styles.btnDisabled : {}) }}
          >
            {loading ? 'Generating...' : 'Generate reply'}
          </button>
          <button onClick={loadRandom} style={{ ...styles.randomBtn, ...(randomFlash ? styles.randomFlash : {}) }}>
            ↻ Random
          </button>
        </div>

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
  titleRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '0 0 28px' },
  subtitle: { color: '#888', fontSize: 13, margin: 0 },
  statsLink: { color: '#888', fontSize: 13, textDecoration: 'none', padding: '4px 10px', border: '1px solid #333', borderRadius: 6 },
  label: { display: 'block', color: '#aaa', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 },
  optional: { color: '#555', fontWeight: 400, textTransform: 'none', letterSpacing: 0 },
  labelRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 0 },
  randomBtn: { background: 'none', border: '1px solid #333', color: '#aaa', fontSize: 15, padding: '12px 20px', borderRadius: 8, cursor: 'pointer', fontWeight: 600, transition: 'background 0.15s', whiteSpace: 'nowrap' },
  randomFlash: { background: '#2a2a2a', color: '#fff', borderColor: '#555' },
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
  btnRow: { display: 'flex', gap: 10, marginBottom: 0 },
  btn: {
    flex: 1, padding: '12px', background: '#c8102e', color: '#fff',
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
