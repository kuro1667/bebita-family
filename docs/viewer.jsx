// bebita_family — 公開ビューア v3
//
// 機能:
//   ・ホーム(記事一覧・タグ絞り込み・検索・ページネーション)
//   ・記事詳細(モーダル、目次自動生成、前後ナビ、共有ボタン)
//   ・猫プロフィールページ(#page=cats, #cat=<id>)
//   ・ダークモード(端末追従 + 手動切替)
//   ・キャッシュ制御(記事更新を確実に反映)
//   ・URLハッシュで状態管理

const { useState, useMemo, useEffect, useCallback, useRef } = React;

// ── frontmatter パース ────────────────────────────────────
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
    if (/^\[.*\]$/.test(val)){
      val = val.slice(1,-1).split(',').map(s => s.trim().replace(/^["']|["']$/g,'')).filter(Boolean);
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
function slugify(text){
  return String(text||'').toLowerCase()
    .replace(/[\s\u3000]+/g,'-')
    .replace(/[^\w\-\u3040-\u30ff\u4e00-\u9fff]/g,'')
    .replace(/-+/g,'-').replace(/^-|-$/g,'');
}

// ── theme ────────────────────────────────────────────────
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
  const s = (k,v) => v && root.style.setProperty(k, v);
  s('--bg', theme.bg); s('--bg-2', theme.bg2); s('--paper', theme.paper);
  s('--ink', theme.ink); s('--ink-soft', theme.inkSoft); s('--ink-mute', theme.inkMute);
  s('--line', theme.line); s('--accent', theme.accent); s('--accent-2', theme.accent2);
  s('--accent-ink', theme.accentInk);
  s('--font-heading', theme.fontHeading); s('--font-body', theme.fontBody);
  const key = theme.bgPattern || 'なし';
  root.style.setProperty('--bg-pattern', BG_PATTERNS_VIEW[key] || 'none');
  document.body.style.backgroundSize = BG_SIZES_VIEW[key] || '';
}

// ── URL state (hash-based) ────────────────────────────────
function parseHashState(){
  const raw = (location.hash || '').replace(/^#/, '');
  const state = { page: 'home', tag: '', q: '', pageNum: 1, article: '', cat: '' };
  if (!raw) return state;
  for (const p of raw.split('&')){
    const [k, v] = p.split('=').map(decodeURIComponent);
    if (k === 'page' && (v === 'cats' || v === 'home')) state.page = v;
    else if (k === 'tag')  state.tag = v || '';
    else if (k === 'q')    state.q = v || '';
    else if (k === 'p')    state.pageNum = Math.max(1, parseInt(v, 10) || 1);
    else if (k === 'a')    state.article = v || '';
    else if (k === 'cat')  state.cat = v || '';
  }
  return state;
}
function setHashState(s){
  const parts = [];
  if (s.page && s.page !== 'home') parts.push('page='+encodeURIComponent(s.page));
  if (s.tag)     parts.push('tag='+encodeURIComponent(s.tag));
  if (s.q)       parts.push('q='+encodeURIComponent(s.q));
  if (s.pageNum>1)  parts.push('p='+s.pageNum);
  if (s.article) parts.push('a='+encodeURIComponent(s.article));
  if (s.cat)     parts.push('cat='+encodeURIComponent(s.cat));
  const next = parts.join('&');
  const url = next ? ('#'+next) : location.pathname + location.search;
  history.pushState(null, '', url);
}
function replaceHashState(s){
  const parts = [];
  if (s.page && s.page !== 'home') parts.push('page='+encodeURIComponent(s.page));
  if (s.tag)     parts.push('tag='+encodeURIComponent(s.tag));
  if (s.q)       parts.push('q='+encodeURIComponent(s.q));
  if (s.pageNum>1)  parts.push('p='+s.pageNum);
  if (s.article) parts.push('a='+encodeURIComponent(s.article));
  if (s.cat)     parts.push('cat='+encodeURIComponent(s.cat));
  const next = parts.join('&');
  const url = next ? ('#'+next) : location.pathname + location.search;
  history.replaceState(null, '', url);
}

const PER_PAGE = 12;
const THEME_KEY = 'bebita_theme_preference';

// ── Theme toggle ─────────────────────────────────────────
function useTheme(){
  const [mode, setMode] = useState(() => {
    try { return localStorage.getItem(THEME_KEY) || 'auto'; }
    catch(e){ return 'auto'; }
  });
  useEffect(()=>{
    const root = document.documentElement;
    if (mode === 'light') root.setAttribute('data-theme', 'light');
    else if (mode === 'dark') root.setAttribute('data-theme', 'dark');
    else root.removeAttribute('data-theme');
    try { localStorage.setItem(THEME_KEY, mode); } catch(e){}
  }, [mode]);
  const cycle = useCallback(() => {
    setMode(m => m === 'auto' ? 'light' : m === 'light' ? 'dark' : 'auto');
  }, []);
  return [mode, cycle];
}

// ── Table of contents extraction ─────────────────────────
function extractHeadings(md){
  if (!md) return [];
  const lines = String(md).split(/\r?\n/);
  const headings = [];
  let inCode = false;
  for (const line of lines){
    if (/^```/.test(line)){ inCode = !inCode; continue; }
    if (inCode) continue;
    const m = line.match(/^(#{1,3})\s+(.+)$/);
    if (m){
      const level = m[1].length;
      const text = m[2].trim();
      headings.push({ level, text, id: slugify(text) || 'h'+headings.length });
    }
  }
  return headings;
}

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
function ArticleCard({ item, onOpen, onTag, catsById }){
  const catIds = Array.isArray(item.cats) && item.cats.length ? item.cats : (item.cat ? [item.cat] : []);
  const cats = catIds.map(id => catsById[id]).filter(Boolean);
  return (
    <button className="article-card" onClick={()=>onOpen(item.id)}>
      {item.cover && item.cover.trim() && <img className="article-thumb" src={encodeURI(item.cover)} alt="" loading="lazy" />}
      <div className="article-body">
        <div className="article-date"><span>{formatDate(item.date)}</span></div>
        <div className="article-title">{item.title || '(無題)'}</div>
        {cats.length > 0 && (
          <div style={{marginBottom:6, display:'flex', gap:4, flexWrap:'wrap'}}>
            {cats.map(c => (
              <span key={c.id} className="article-cat-badge">
                {c.photo ? <img src={encodeURI(c.photo)} alt=""/> : null}
                <span className="badge-name">🐾 {c.name}</span>
              </span>
            ))}
          </div>
        )}
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

// ── Article modal ─────────────────────────────────────────
function ArticleModal({ articleId, allArticles, catsById, onClose, onTag, onOpen }){
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showToast, setShowToast] = useState(false);

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

  // Scroll modal to top on article change
  const backdropRef = useRef(null);
  useEffect(()=>{
    if (backdropRef.current) backdropRef.current.scrollTop = 0;
  }, [articleId]);

  // Prev / next
  const sortedPub = useMemo(()=> sortByDateDesc((allArticles||[]).filter(a=>!a.draft)), [allArticles]);
  const currentIdx = sortedPub.findIndex(a => a.id === articleId);
  const prevArticle = currentIdx > 0 ? sortedPub[currentIdx - 1] : null;
  const nextArticle = currentIdx >= 0 && currentIdx < sortedPub.length - 1 ? sortedPub[currentIdx + 1] : null;

  const share = async () => {
    const url = location.origin + location.pathname + location.search + `#a=${encodeURIComponent(articleId)}`;
    const title = data?.meta?.title || 'bebita_family';
    if (navigator.share){
      try { await navigator.share({ title, url }); return; } catch(e){}
    }
    try {
      await navigator.clipboard.writeText(url);
      setShowToast(true);
      setTimeout(()=>setShowToast(false), 2500);
    } catch(e){
      prompt('この記事のURL:', url);
    }
  };

  // TOC (only show if 2+ headings)
  const headings = useMemo(()=> data ? extractHeadings(data.body) : [], [data]);
  const showToc = headings.length >= 2;

  const catIds = data?.meta ?
    (Array.isArray(data.meta.cats) && data.meta.cats.length ? data.meta.cats
     : (data.meta.cat ? [data.meta.cat] : []))
    : [];
  const relatedCats = catIds.map(id => catsById[id]).filter(Boolean);

  return (
    <>
      <div className="modal-backdrop" onClick={onClose} ref={backdropRef}>
        <div className="modal" onClick={e=>e.stopPropagation()}>
          <button className="share-button" onClick={share} title="この記事のURLを共有" aria-label="share">↗</button>
          <button className="modal-close" onClick={onClose} aria-label="閉じる">✕</button>
          {loading && <div className="modal-inner"><div className="viewer-loading">読み込み中…</div></div>}
          {error && <div className="modal-inner"><div style={{color:'#a33', padding:20}}>{error}</div></div>}
          {data && <>
            {data.meta.cover && String(data.meta.cover).trim() && <img className="modal-cover" src={encodeURI(data.meta.cover)} alt="" />}
            <div className="modal-inner">
              <div className="modal-date">{formatDate(data.meta.date)}</div>
              <h1 className="modal-title">{data.meta.title}</h1>
              {relatedCats.length > 0 && (
                <div style={{marginBottom:12, display:'flex', gap:6, flexWrap:'wrap'}}>
                  {relatedCats.map(c => (
                    <button key={c.id} className="article-cat-badge"
                      style={{cursor:'pointer', border:'1px solid color-mix(in oklab, var(--accent), var(--line) 60%)'}}
                      onClick={()=>onOpen && onOpen({ page:'cats', cat: c.id, article:'' })}>
                      {c.photo ? <img src={encodeURI(c.photo)} alt=""/> : null}
                      <span className="badge-name">🐾 {c.name} のこと</span>
                    </button>
                  ))}
                </div>
              )}
              {Array.isArray(data.meta.tags) && data.meta.tags.length > 0 && (
                <div style={{display:'flex', gap:6, flexWrap:'wrap', marginBottom:16}}>
                  {data.meta.tags.map(t =>
                    <span key={t} className="tag-chip tag-clickable" onClick={() => { onTag(t); onClose(); }}>#{t}</span>
                  )}
                </div>
              )}

              {showToc && data.meta.toc !== false && (
                <div className="md-toc">
                  <div className="md-toc-title">目次</div>
                  <ol>
                    {headings.filter(h => h.level <= 3).map((h, i) => (
                      <li key={i} className={'toc-h'+h.level}>
                        <a href={`#h-${h.id}`} onClick={(e)=>{
                          e.preventDefault();
                          const el = document.getElementById(`h-${h.id}`);
                          if (el){
                            const scroller = backdropRef.current;
                            if (scroller){
                              const y = el.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop - 20;
                              scroller.scrollTo({top: y, behavior: 'smooth'});
                            }
                          }
                        }}>{h.text}</a>
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              <MarkdownArticleView source={data.body} headings={headings} />

              <div className="modal-bottom-actions">
                <button className="modal-close-bottom" onClick={onClose}>↑ 閉じる</button>
              </div>

              {(prevArticle || nextArticle) && (
                <div className="modal-nav">
                  {prevArticle ? (
                    <button className="prev" onClick={()=> onOpen({ article: prevArticle.id })}>
                      <span className="nav-label">← 前の記事</span>
                      <span className="nav-title">{prevArticle.title}</span>
                    </button>
                  ) : <span className="nav-empty"/>}
                  {nextArticle ? (
                    <button className="next" onClick={()=> onOpen({ article: nextArticle.id })}>
                      <span className="nav-label">次の記事 →</span>
                      <span className="nav-title">{nextArticle.title}</span>
                    </button>
                  ) : <span className="nav-empty"/>}
                </div>
              )}
            </div>
          </>}
        </div>
      </div>
      {showToast && <div className="share-toast">🔗 URLをコピーしました</div>}
    </>
  );
}

// MarkdownView wrapper that injects ids into headings
function MarkdownArticleView({ source, headings }){
  const html = useMemo(() => {
    let rendered = window.renderMarkdown(source);
    // Wire heading ids
    let idx = 0;
    rendered = rendered.replace(/<(h[1-3])>([^<]*)<\/\1>/g, (m, tag, text) => {
      const h = headings[idx++];
      if (!h) return m;
      return `<${tag} id="h-${h.id}">${text}</${tag}>`;
    });
    return rendered;
  }, [source, headings]);
  return <div className="md-body" dangerouslySetInnerHTML={{__html: html}} />;
}

// ── Cats page ────────────────────────────────────────────
function CatsPage({ cats, articles, catsById, onSelectCat, onOpenArticle, onTag, selectedCatId }){
  const cat = selectedCatId ? catsById[selectedCatId] : null;

  if (cat){
    // Cat detail page
    const matchesCat = (a) => {
      if (Array.isArray(a.cats) && a.cats.length) return a.cats.includes(cat.id);
      return a.cat === cat.id;
    };
    const catArticles = sortByDateDesc(articles.filter(a => !a.draft && matchesCat(a)));
    return (
      <div className="shell">
        <div className="cat-hero">
          {cat.photo
            ? <img className="cat-hero-photo" src={encodeURI(cat.photo)} alt={cat.name} />
            : <div className="cat-hero-photo-placeholder">{(cat.name||'?').slice(0,2)}</div>}
          <h1 className="cat-hero-name">{cat.name}</h1>
          {cat.tagline && <p className="cat-hero-tagline">{cat.tagline}</p>}
          <div className="cat-hero-meta">
            {cat.species && <span><strong>種類:</strong> {cat.species}</span>}
            {cat.gender && <span><strong>性別:</strong> {cat.gender}</span>}
            {cat.age && <span><strong>年齢:</strong> {cat.age}</span>}
            {cat.origin && <span><strong>来歴:</strong> {cat.origin}</span>}
          </div>
          {cat.bio && (
            <div className="cat-hero-bio md-body">
              <MarkdownArticleView source={cat.bio} headings={[]} />
            </div>
          )}
        </div>

        {catArticles.length > 0 && (
          <div className="section">
            <div className="section-head">
              <h2 className="section-title">{cat.name}の記事</h2>
              <span className="section-count">{catArticles.length.toString().padStart(2,'0')}</span>
            </div>
            <div className="articles">
              {catArticles.map(a => <ArticleCard key={a.id} item={a} onOpen={onOpenArticle} onTag={onTag} catsById={catsById}/>)}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Cats index
  const withCounts = cats.map(c => ({
    ...c,
    count: articles.filter(a => {
      if (a.draft) return false;
      if (Array.isArray(a.cats) && a.cats.length) return a.cats.includes(c.id);
      return a.cat === c.id;
    }).length,
  }));
  return (
    <div className="shell">
      <div style={{textAlign:'center', padding:'24px 0 12px'}}>
        <h1 style={{font:'900 clamp(24px, 5vw, 34px)/1.3 var(--font-heading)', margin:'0 0 6px', color:'var(--ink)'}}>
          🐾 うちの子たち
        </h1>
        <p style={{color:'var(--ink-soft)', fontSize:14, margin:0}}>
          プロフィールと記事アーカイブ
        </p>
      </div>
      {cats.length === 0 ? (
        <div className="empty-state">まだ紹介ページはありません。</div>
      ) : (
        <div className="cats-grid">
          {withCounts.map(c => (
            <button key={c.id} className="cat-card" onClick={()=>onSelectCat(c.id)}>
              {c.photo
                ? <img className="cat-card-photo" src={encodeURI(c.photo)} alt={c.name} loading="lazy" onError={(e)=>{e.target.style.display='none'; e.target.nextSibling && (e.target.nextSibling.style.display='');}}/>
                : <div className="cat-card-placeholder">{(c.name||'?').slice(0,2)}</div>}
              <div className="cat-card-name">{c.name}</div>
              {c.tagline && <div className="cat-card-tagline">{c.tagline}</div>}
              <div className="cat-card-count">{c.count.toString().padStart(2,'0')} 記事</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main viewer ───────────────────────────────────────────
function Viewer(){
  const [config, setConfig] = useState(null);
  const [articles, setArticles] = useState([]);
  const [cats, setCats] = useState([]);
  const [error, setError] = useState(null);
  const [hashState, setHashStateReact] = useState(parseHashState());
  const [themeMode, cycleTheme] = useTheme();

  // Watch hash changes
  useEffect(()=>{
    const onHash = () => setHashStateReact(parseHashState());
    window.addEventListener('hashchange', onHash);
    window.addEventListener('popstate', onHash);
    return () => {
      window.removeEventListener('hashchange', onHash);
      window.removeEventListener('popstate', onHash);
    };
  }, []);

  // Load initial data
  useEffect(()=>{
    Promise.all([
      fetch('site-config.json', { cache: 'no-cache' }).then(r => r.ok ? r.json() : Promise.reject(new Error('site-config.json'))),
      fetch('articles/index.json', { cache: 'no-cache' }).then(r => r.ok ? r.json() : Promise.reject(new Error('articles/index.json'))),
      fetch('cats.json', { cache: 'no-cache' }).then(r => r.ok ? r.json() : {cats:[]}).catch(()=>({cats:[]})),
    ]).then(([cfg, idx, catsData])=>{
      setConfig(cfg);
      setArticles(idx.articles || []);
      setCats(catsData.cats || []);
      applyTheme(cfg.theme);
      applyAvatarVars(cfg);
      if (cfg.name) document.title = cfg.name;
    }).catch(err => {
      setError(err.message);
      console.error(err);
    });
  }, []);

  const catsById = useMemo(() => Object.fromEntries(cats.map(c => [c.id, c])), [cats]);

  // Navigation helpers
  const setTag = useCallback((tag) => {
    const s = parseHashState();
    s.tag = tag === s.tag ? '' : tag;
    s.pageNum = 1;
    s.page = 'home';
    setHashState(s);
    setHashStateReact({ ...s });
  }, []);
  const setQuery = useCallback((q) => {
    const s = parseHashState();
    s.q = q;
    s.pageNum = 1;
    s.page = 'home';
    replaceHashState(s);
    setHashStateReact({ ...s });
  }, []);
  const setPageNum = useCallback((p) => {
    const s = parseHashState();
    s.pageNum = p;
    setHashState(s);
    setHashStateReact({ ...s });
    document.getElementById('article-list-top')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);
  const openArticle = useCallback((idOrPatch) => {
    const s = parseHashState();
    if (typeof idOrPatch === 'string') s.article = idOrPatch;
    else Object.assign(s, idOrPatch);
    setHashState(s);
    setHashStateReact({ ...s });
  }, []);
  const closeArticle = useCallback(() => {
    const s = parseHashState();
    s.article = '';
    setHashState(s);
    setHashStateReact({ ...s });
  }, []);
  const goToPage = useCallback((page) => {
    const s = parseHashState();
    s.page = page;
    s.tag = ''; s.q = ''; s.pageNum = 1; s.article = ''; s.cat = '';
    setHashState(s);
    setHashStateReact({ ...s });
  }, []);
  const selectCat = useCallback((catId) => {
    const s = parseHashState();
    s.page = 'cats';
    s.cat = catId;
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

  const totalPages = Math.max(1, Math.ceil(visible.length / PER_PAGE));
  const pageNum = Math.min(hashState.pageNum, totalPages);
  const paged = visible.slice((pageNum-1) * PER_PAGE, pageNum * PER_PAGE);

  const latest = visible[0];
  const showHero = pageNum === 1 && !hashState.tag && !hashState.q && latest;
  const listItems = showHero ? paged.slice(1) : paged;

  if (error){
    return (
      <div style={{padding: 40, fontFamily: 'system-ui', color:'#666'}}>
        <p><strong>読み込みエラー:</strong> {error}</p>
        <p>ローカルで開く場合は簡易サーバー経由でアクセスしてください(README.md参照)。</p>
      </div>
    );
  }
  if (!config) return <div className="viewer-loading">読み込み中…</div>;

  const t = config;
  const themeIcon = themeMode === 'auto' ? '⚙' : themeMode === 'light' ? '☀️' : '🌙';
  const themeLabel = themeMode === 'auto' ? '自動' : themeMode === 'light' ? 'ライト' : 'ダーク';

  // Cat detail page
  if (hashState.page === 'cats'){
    return (
      <div className="layout-desktop">
        <nav className="topnav">
          <button className="nav-brand" onClick={()=>goToPage('home')} style={{background:'none', border:'none', cursor:'pointer', padding:0}}>
            {t.name}
          </button>
          <div className="nav-links">
            <button className="nav-link" onClick={()=>goToPage('home')}>ブログ</button>
            <button className={"nav-link" + (hashState.page === 'cats' ? ' is-active' : '')} onClick={()=>goToPage('cats')}>うちの子たち</button>
          </div>
        </nav>
        <CatsPage
          cats={cats}
          articles={articles}
          catsById={catsById}
          onSelectCat={selectCat}
          onOpenArticle={(id)=>openArticle(id)}
          onTag={setTag}
          selectedCatId={hashState.cat}
        />
        <div className="shell" style={{paddingTop:0}}>
          <div className="footer">© {new Date().getFullYear()} {t.name} · made with ♡</div>
        </div>
        <button className="theme-toggle" onClick={cycleTheme} title={`テーマ: ${themeLabel}(クリックで切替)`}>{themeIcon}</button>
        {hashState.article && (
          <ArticleModal
            articleId={hashState.article}
            allArticles={articles}
            catsById={catsById}
            onClose={closeArticle}
            onTag={setTag}
            onOpen={openArticle}
          />
        )}
      </div>
    );
  }

  // Home page
  return (
    <div className="layout-desktop">
      <nav className="topnav">
        <button className="nav-brand" onClick={()=>goToPage('home')} style={{background:'none', border:'none', cursor:'pointer', padding:0}}>
          {t.name}
        </button>
        <div className="nav-links">
          <button className={"nav-link" + (hashState.page === 'home' ? ' is-active' : '')} onClick={()=>goToPage('home')}>ブログ</button>
          {cats.length > 0 && (
            <button className="nav-link" onClick={()=>goToPage('cats')}>うちの子たち</button>
          )}
        </div>
      </nav>

      <div className="shell">
        <div className="grid">
          <aside className="col-left">
            <div className="profile">
              <div className="avatar">
                {t.avatarUrl
                  ? <img src={encodeURI(t.avatarUrl)} alt="" />
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

            <div className="section" style={{textAlign:'center', paddingTop:20, borderTop:'1px dashed var(--line)'}}>
              <a href="rss.xml" style={{
                color:'var(--ink-mute)', textDecoration:'none',
                font:'12px var(--font-mono)', letterSpacing:'.08em',
                display:'inline-flex', alignItems:'center', gap:6,
              }}>📡 RSS を購読</a>
            </div>
          </aside>

          <main className="col-right">
            {showHero && (
              <section className="hero">
                {latest.cover && latest.cover.trim() && <img className="hero-cover" src={encodeURI(latest.cover)} alt="" />}
                <span className="hero-kicker">最新の投稿</span>
                <h1 className="hero-title">{latest.title}</h1>
                <div className="hero-date">{formatDate(latest.date)}</div>
                {(() => {
                  const ids = Array.isArray(latest.cats) && latest.cats.length ? latest.cats : (latest.cat ? [latest.cat] : []);
                  const shown = ids.map(id => catsById[id]).filter(Boolean);
                  if (!shown.length) return null;
                  return (
                    <div style={{marginTop:8, display:'flex', gap:6, flexWrap:'wrap'}}>
                      {shown.map(c => (
                        <span key={c.id} className="article-cat-badge">
                          {c.photo ? <img src={encodeURI(c.photo)} alt=""/> : null}
                          <span className="badge-name">🐾 {c.name}</span>
                        </span>
                      ))}
                    </div>
                  );
                })()}
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
                  {listItems.map(a => <ArticleCard key={a.id} item={a} onOpen={openArticle} onTag={setTag} catsById={catsById}/>)}
                </div>

                {totalPages > 1 && (
                  <div className="pagination">
                    <button onClick={()=>setPageNum(pageNum-1)} disabled={pageNum<=1}>← 前へ</button>
                    <span className="page-indicator">{pageNum} / {totalPages}</span>
                    <button onClick={()=>setPageNum(pageNum+1)} disabled={pageNum>=totalPages}>次へ →</button>
                  </div>
                )}
              </div>
            )}
          </main>
        </div>

        <div className="footer">© {new Date().getFullYear()} {t.name} · made with ♡</div>
      </div>

      <button className="theme-toggle" onClick={cycleTheme} title={`テーマ: ${themeLabel}(クリックで切替)`}>{themeIcon}</button>

      {hashState.article && (
        <ArticleModal
          articleId={hashState.article}
          allArticles={articles}
          catsById={catsById}
          onClose={closeArticle}
          onTag={setTag}
          onOpen={openArticle}
        />
      )}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('app')).render(<Viewer />);
