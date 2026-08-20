// bebita_family — 公開ビューア (v2 データ構造対応)
//
// データ構造:
//   articles/index.json  ... 記事一覧のメタ情報
//   articles/<id>.md     ... 個別記事の本文(frontmatter付きMarkdown)
//
// ページネーション・タグフィルタ・検索対応。

const { useState, useMemo, useEffect, useCallback } = React;

// ── frontmatter パース ─────────────────────────────────────
// ---
// title: ...
// date: 2026-08-20
// tags: [日記, 猫]
// cover: images/xxx.jpg
// draft: false
// ---
// (本文)
function parseFrontmatter(src){
  if (!src) return { meta: {}, body: '' };
  const m = src.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { meta: {}, body: src };
  const meta = {};
  for (const line of m[1].split(/\r?\n/)){
    const kv = line.match(/^([a-zA-Z_][a-zA-Z0-9_-]*)\s*:\s*(.*)$/);
    if (!kv) continue;
    const key = kv[1].trim();
    let val = kv[2].trim();
    // simple types
    if (/^\[.*\]$/.test(val)){
      val = val.slice(1,-1).split(',').map(s => s.trim()).filter(Boolean);
    } else if (val === 'true') val = true;
    else if (val === 'false') val = false;
    else if (/^-?\d+(\.\d+)?$/.test(val)) val = parseFloat(val);
    else if (/^".*"$/.test(val) || /^'.*'$/.test(val)) val = val.slice(1,-1);
    meta[key] = val;
  }
  return { meta, body: m[2] || '' };
}

// ── helpers ───────────────────────────────────────────────
function formatDate(iso){
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,'0');
  const day = String(d.getDate()).padStart(2,'0');
  return `${y}.${m}.${day}`;
}
function sortByDateDesc(list){
  return [...list].sort((a,b)=> (b.date||'').localeCompare(a.date||''));
}

// theme apply
const BG_PATTERNS_VIEW = {
  'なし': 'none',
  'ドット (小)': 'radial-gradient(color-mix(in oklab, var(--ink), transparent 92%) 1px, transparent 1px)',
  'ドット (中)': 'radial-gradient(color-mix(in oklab, var(--ink), transparent 88%) 1.5px, transparent 1.5px)',
  '格子': 'linear-gradient(color-mix(in oklab, var(--ink), transparent 94%) 1px, transparent 1px), linear-gradient(90deg, color-mix(in oklab, var(--ink), transparent 94%) 1px, transparent 1px)',
  '斜線': 'repeating-linear-gradient(45deg, color-mix(in oklab, var(--ink), transparent 94%) 0 1px, transparent 1px 8px)',
  '肉球風ドット': 'radial-gradient(circle at 30% 30%, color-mix(in oklab, var(--accent), transparent 85%) 3px, transparent 4px), radial-gradient(circle at 70% 70%, color-mix(in oklab, var(--accent), transparent 88%) 2px, transparent 3px)',
  'グラデーション (アクセント)': 'radial-gradient(1200px 700px at 85% -10%, color-mix(in oklab, var(--accent-2), transparent 60%) 0%, transparent 55%), radial-gradient(900px 600px at -10% 30%, color-mix(in oklab, var(--accent), transparent 75%) 0%, transparent 55%)',
  'グラデーション (やわらか)': 'linear-gradient(180deg, color-mix(in oklab, var(--bg), white 20%) 0%, var(--bg) 100%)',
};
const BG_SIZES_VIEW = {
  'ドット (小)': '16px 16px',
  'ドット (中)': '22px 22px',
  '格子': '24px 24px',
  '肉球風ドット': '80px 80px',
};

function applyAvatarVars(cfg){
  const root = document.documentElement;
  const size = cfg.avatarSize;
  if (size) root.style.setProperty('--avatar-size', `${size}px`);
  const px = cfg.avatarPositionX;
  const py = cfg.avatarPositionY;
  root.style.setProperty('--avatar-pos-x', `${px == null ? 50 : px}%`);
  root.style.setProperty('--avatar-pos-y', `${py == null ? 50 : py}%`);
}
function applyTheme(theme){
  if (!theme) return;
  const root = document.documentElement;
  if (theme.bg)          root.style.setProperty('--bg', theme.bg);
  if (theme.bg2)         root.style.setProperty('--bg-2', theme.bg2);
  if (theme.paper)       root.style.setProperty('--paper', theme.paper);
  if (theme.ink)         root.style.setProperty('--ink', theme.ink);
  if (theme.inkSoft)     root.style.setProperty('--ink-soft', theme.inkSoft);
  if (theme.inkMute)     root.style.setProperty('--ink-mute', theme.inkMute);
  if (theme.line)        root.style.setProperty('--line', theme.line);
  if (theme.accent)      root.style.setProperty('--accent', theme.accent);
  if (theme.accent2)     root.style.setProperty('--accent-2', theme.accent2);
  if (theme.accentInk)   root.style.setProperty('--accent-ink', theme.accentInk);
  if (theme.fontHeading) root.style.setProperty('--font-heading', theme.fontHeading);
  if (theme.fontBody)    root.style.setProperty('--font-body', theme.fontBody);
  const key = theme.bgPattern || 'なし';
  root.style.setProperty('--bg-pattern', BG_PATTERNS_VIEW[key] || 'none');
  document.body.style.backgroundSize = BG_SIZES_VIEW[key] || '';
}

// ── URL state (hash-based) ────────────────────────────────
function parseHashState(){
  const raw = (location.hash || '').replace(/^#/, '');
  const state = { tag: '', q: '', page: 1, article: '' };
  if (!raw) return state;
  for (const p of raw.split('&')){
    const [k, v] = p.split('=').map(decodeURIComponent);
    if (k === 'tag')       state.tag = v || '';
    else if (k === 'q')    state.q = v || '';
    else if (k === 'page') state.page = Math.max(1, parseInt(v, 10) || 1);
    else if (k === 'a')    state.article = v || '';
  }
  return state;
}
function setHashState(s){
  const parts = [];
  if (s.tag)     parts.push('tag='+encodeURIComponent(s.tag));
  if (s.q)       parts.push('q='+encodeURIComponent(s.q));
  if (s.page>1)  parts.push('page='+s.page);
  if (s.article) parts.push('a='+encodeURIComponent(s.article));
  const next = parts.join('&');
  const url = next ? ('#'+next) : location.pathname + location.search;
  history.replaceState(null, '', url);
}

const PER_PAGE = 12;

// ── SNS card ──────────────────────────────────────────────
function SNSCard({ item }){
  const label = resolveSNSLabel(item);
  const handle = extractHandle(item.url);
  return (
    <a className="sns-card" href={item.url || '#'} target="_blank" rel="noopener noreferrer">
      <span className="sns-icon"><SNSIconResolved item={item} /></span>
      <span className="sns-meta">
        <div className="sns-label">{label}</div>
        <div className="sns-handle">{handle}</div>
      </span>
      <span className="sns-arrow">→</span>
    </a>
  );
}

// ── Article card ──────────────────────────────────────────
function ArticleCard({ item, onOpen, onTag }){
  return (
    <button className="article-card" onClick={()=>onOpen(item.id)}>
      {item.cover && <img className="article-thumb" src={item.cover} alt="" />}
      <div className="article-body">
        <div className="article-date"><span>{formatDate(item.date)}</span></div>
        <div className="article-title">{item.title || '(無題)'}</div>
        <div className="article-excerpt">{item.excerpt || ''}</div>
        {item.tags?.length > 0 && (
          <div className="article-tags">
            {item.tags.map(t =>
              <span key={t} className="tag-chip tag-clickable"
                    onClick={e => { e.stopPropagation(); onTag(t); }}>#{t}</span>
            )}
          </div>
        )}
      </div>
    </button>
  );
}

// ── Article modal (fetches body on demand) ────────────────
function ArticleModal({ articleId, onClose, onTag }){
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(()=>{
    setLoading(true);
    setError(null);
    fetch(`articles/${articleId}.md`, { cache: 'no-cache' })
      .then(r => r.ok ? r.text() : Promise.reject(new Error('記事が見つかりません')))
      .then(text => {
        const { meta, body } = parseFrontmatter(text);
        setData({ meta, body });
        setLoading(false);
      })
      .catch(err => { setError(err.message); setLoading(false); });
  }, [articleId]);

  useEffect(()=>{
    const onKey = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return ()=>{
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="閉じる">✕</button>
        {loading && <div className="modal-inner"><div style={{color:'var(--ink-mute)', padding:20, textAlign:'center'}}>読み込み中…</div></div>}
        {error && <div className="modal-inner"><div style={{color:'#a33', padding:20}}>{error}</div></div>}
        {data && <>
          {data.meta.cover && <img className="modal-cover" src={data.meta.cover} alt="" />}
          <div className="modal-inner">
            <div className="modal-date">{formatDate(data.meta.date)}</div>
            <h1 className="modal-title">{data.meta.title}</h1>
            {Array.isArray(data.meta.tags) && data.meta.tags.length > 0 && (
              <div style={{display:'flex', gap:6, flexWrap:'wrap', marginBottom:16}}>
                {data.meta.tags.map(t =>
                  <span key={t} className="tag-chip tag-clickable" onClick={() => { onTag(t); onClose(); }}>#{t}</span>
                )}
              </div>
            )}
            <MarkdownView source={data.body} />
            <div className="modal-bottom-actions">
              <button className="modal-close-bottom" onClick={onClose}>
                ↑ 閉じる
              </button>
            </div>
          </div>
        </>}
      </div>
    </div>
  );
}

// ── Main viewer ───────────────────────────────────────────
function Viewer(){
  const [config, setConfig] = useState(null);
  const [articles, setArticles] = useState([]);
  const [error, setError] = useState(null);
  const [hashState, setHashStateReact] = useState(parseHashState());

  // watch hash changes (back/forward)
  useEffect(()=>{
    const onHash = () => setHashStateReact(parseHashState());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  // load initial data
  useEffect(()=>{
    Promise.all([
      fetch('site-config.json', { cache: 'no-cache' }).then(r => r.ok ? r.json() : Promise.reject(new Error('site-config.json'))),
      fetch('articles/index.json', { cache: 'no-cache' }).then(r => r.ok ? r.json() : Promise.reject(new Error('articles/index.json'))),
    ]).then(([cfg, idx])=>{
      setConfig(cfg);
      setArticles(idx.articles || []);
      applyTheme(cfg.theme);
      applyAvatarVars(cfg);
      if (cfg.name) document.title = cfg.name;
    }).catch(err => {
      setError(err.message);
      console.error(err);
    });
  }, []);

  // controls
  const setTag = useCallback((tag) => {
    const s = parseHashState();
    s.tag = tag === s.tag ? '' : tag; // toggle
    s.page = 1;
    setHashState(s);
    setHashStateReact({ ...s });
  }, []);
  const setQuery = useCallback((q) => {
    const s = parseHashState();
    s.q = q;
    s.page = 1;
    setHashState(s);
    setHashStateReact({ ...s });
  }, []);
  const setPage = useCallback((p) => {
    const s = parseHashState();
    s.page = p;
    setHashState(s);
    setHashStateReact({ ...s });
    // scroll to top of list
    document.getElementById('article-list-top')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);
  const openArticle = useCallback((id) => {
    const s = parseHashState();
    s.article = id;
    setHashState(s);
    setHashStateReact({ ...s });
  }, []);
  const closeArticle = useCallback(() => {
    const s = parseHashState();
    s.article = '';
    setHashState(s);
    setHashStateReact({ ...s });
  }, []);

  // Filter + sort
  const visible = useMemo(() => {
    let list = (articles || []).filter(a => !a.draft);
    if (hashState.tag){
      list = list.filter(a => Array.isArray(a.tags) && a.tags.includes(hashState.tag));
    }
    if (hashState.q){
      const q = hashState.q.toLowerCase();
      list = list.filter(a =>
        (a.title||'').toLowerCase().includes(q) ||
        (a.excerpt||'').toLowerCase().includes(q) ||
        (a.tags||[]).some(t => t.toLowerCase().includes(q))
      );
    }
    return sortByDateDesc(list);
  }, [articles, hashState.tag, hashState.q]);

  // Tag counts (all published articles, ignoring current tag filter)
  const tagCounts = useMemo(() => {
    const map = new Map();
    for (const a of (articles || [])){
      if (a.draft) continue;
      for (const t of (a.tags || [])){
        map.set(t, (map.get(t) || 0) + 1);
      }
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [articles]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(visible.length / PER_PAGE));
  const page = Math.min(hashState.page, totalPages);
  const paged = visible.slice((page-1) * PER_PAGE, page * PER_PAGE);

  const latest = visible[0];
  const rest = paged.filter(a => !latest || a.id !== latest.id || page > 1);
  // If we're on page 1 with no filter, hero is latest; rest is the rest of page 1 (excluding hero)
  const showHero = page === 1 && !hashState.tag && !hashState.q && latest;
  const listItems = showHero ? paged.slice(1) : paged;

  if (error){
    return (
      <div style={{padding: 40, fontFamily: 'system-ui', color:'#666'}}>
        <p><strong>読み込みエラー:</strong> {error}</p>
        <p>ローカルで開く場合は簡易サーバー経由でアクセスしてください(README.md参照)。</p>
      </div>
    );
  }
  if (!config) return null;

  const t = config;

  return (
    <div className="layout-desktop">
      <div className="shell">
        <div className="grid">
          <aside className="col-left">
            <div className="profile">
              <div className="avatar">
                {t.avatarUrl
                  ? <img src={t.avatarUrl} alt="" />
                  : <span>{(t.name||'?').trim().slice(0,2)}</span>}
              </div>
              <div className="name">{t.name}</div>
              {t.tagline && <div className="tagline">{t.tagline}</div>}
              <AccentMark decor={t.decor} />
              {t.bio && <div className="bio md-body"><MarkdownView source={t.bio} /></div>}
            </div>

            {(t.sns||[]).length > 0 && (
              <div className="section">
                <div className="section-head">
                  <h2 className="section-title">リンク</h2>
                  <span className="section-count">{(t.sns||[]).length.toString().padStart(2,'0')}</span>
                </div>
                <div className="sns-list">
                  {(t.sns||[]).map(s => <SNSCard key={s.id} item={s} />)}
                </div>
              </div>
            )}

            {tagCounts.length > 0 && (
              <div className="section">
                <div className="section-head">
                  <h2 className="section-title">タグ</h2>
                </div>
                <div className="tag-cloud">
                  {tagCounts.map(([tag, count]) => (
                    <button
                      key={tag}
                      className={"tag-chip tag-clickable" + (hashState.tag === tag ? " is-active" : "")}
                      onClick={() => setTag(tag)}
                    >
                      #{tag}<span className="tag-count">{count}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </aside>

          <main className="col-right">
            {showHero && (
              <section className="hero">
                {latest.cover && <img className="hero-cover" src={latest.cover} alt="" />}
                <span className="hero-kicker">最新の投稿</span>
                <h1 className="hero-title">{latest.title}</h1>
                <div className="hero-date">{formatDate(latest.date)}</div>
                {Array.isArray(latest.tags) && latest.tags.length > 0 && (
                  <div className="hero-tags">
                    {latest.tags.map(tg => <span key={tg} className="tag-chip tag-clickable" onClick={()=>setTag(tg)}>#{tg}</span>)}
                  </div>
                )}
                <p className="hero-excerpt">{latest.excerpt || ''}</p>
                <button className="hero-btn" onClick={()=>openArticle(latest.id)}>
                  続きを読む →
                </button>
              </section>
            )}

            <div id="article-list-top"></div>

            {/* Search + active filter */}
            <div className="list-toolbar">
              <input
                className="search-input"
                type="search"
                placeholder="🔍 記事を検索"
                value={hashState.q}
                onChange={e => setQuery(e.target.value)}
              />
              {hashState.tag && (
                <div className="active-filter">
                  タグ: <b>#{hashState.tag}</b>
                  <button onClick={()=>setTag(hashState.tag)}>✕</button>
                </div>
              )}
              {hashState.q && (
                <div className="active-filter">
                  検索: <b>"{hashState.q}"</b>
                  <button onClick={()=>setQuery('')}>✕</button>
                </div>
              )}
            </div>

            {visible.length === 0 ? (
              <div className="empty-state">
                {articles.length === 0
                  ? '記事はまだありません。'
                  : '該当する記事がありません。'}
              </div>
            ) : (
              <div className="section">
                <div className="section-head">
                  <h2 className="section-title">
                    {hashState.tag ? `#${hashState.tag} の記事` : (hashState.q ? '検索結果' : 'これまでの日記')}
                  </h2>
                  <span className="section-count">{visible.length.toString().padStart(2,'0')}</span>
                </div>
                <div className="articles">
                  {listItems.map(a => <ArticleCard key={a.id} item={a} onOpen={openArticle} onTag={setTag} />)}
                </div>

                {totalPages > 1 && (
                  <div className="pagination">
                    <button onClick={()=>setPage(page-1)} disabled={page<=1}>← 前へ</button>
                    <span className="page-indicator">{page} / {totalPages}</span>
                    <button onClick={()=>setPage(page+1)} disabled={page>=totalPages}>次へ →</button>
                  </div>
                )}
              </div>
            )}
          </main>
        </div>

        <div className="footer">© {new Date().getFullYear()} {t.name} · made with ♡</div>
      </div>

      {hashState.article && (
        <ArticleModal
          articleId={hashState.article}
          onClose={closeArticle}
          onTag={setTag}
        />
      )}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('app')).render(<Viewer />);
