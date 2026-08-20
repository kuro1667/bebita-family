// SNS platform icons + paw + platform detection.

const PLATFORMS = [
  { key:'x',         label:'X (Twitter)', match:/(?:\/\/|^|\.)(x\.com|twitter\.com)\b/i },
  { key:'instagram', label:'Instagram',   match:/instagram\.com/i },
  { key:'youtube',   label:'YouTube',     match:/(youtube\.com|youtu\.be)/i },
  { key:'tiktok',    label:'TikTok',      match:/tiktok\.com/i },
  { key:'threads',   label:'Threads',     match:/threads\.(net|com)/i },
  { key:'note',      label:'note',        match:/note\.com/i },
  { key:'bluesky',   label:'Bluesky',     match:/bsky\.app/i },
  { key:'github',    label:'GitHub',      match:/github\.com/i },
  { key:'facebook',  label:'Facebook',    match:/facebook\.com/i },
  { key:'pinterest', label:'Pinterest',   match:/pinterest\./i },
  { key:'linkedin',  label:'LinkedIn',    match:/linkedin\.com/i },
  { key:'discord',   label:'Discord',     match:/discord\.(gg|com)/i },
  { key:'mail',      label:'メール',       match:/^mailto:/i },
  { key:'website',   label:'ウェブサイト', match:/./ },
];

// Full selectable list (includes 'website' fallback)
const PLATFORM_KEYS = PLATFORMS.map(p => p.key);
const PLATFORM_MAP = Object.fromEntries(PLATFORMS.map(p => [p.key, p]));

function detectPlatform(url){
  if (!url) return PLATFORM_MAP.website;
  for (const p of PLATFORMS){
    if (p.match.test(url)) return p;
  }
  return PLATFORM_MAP.website;
}

function extractHandle(url){
  if (!url) return '';
  try{
    if (/^mailto:/i.test(url)) return url.replace(/^mailto:/i,'');
    const u = new URL(url);
    const path = u.pathname.replace(/\/+$/,'').replace(/^\/+/,'');
    if (!path) return u.hostname.replace(/^www\./,'');
    const first = path.split('/')[0];
    return first.startsWith('@') ? first : '@'+first;
  }catch(e){
    return url;
  }
}

function PlatformIcon({ platformKey, size=22 }){
  const s = size;
  const common = { width:s, height:s, viewBox:'0 0 24 24', fill:'none', xmlns:'http://www.w3.org/2000/svg' };
  switch(platformKey){
    case 'x':
      return <svg {...common}><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z" fill="currentColor"/></svg>;
    case 'instagram':
      return <svg {...common}><rect x="2.5" y="2.5" width="19" height="19" rx="5.5" stroke="currentColor" strokeWidth="1.6"/><circle cx="12" cy="12" r="4.2" stroke="currentColor" strokeWidth="1.6"/><circle cx="17.5" cy="6.6" r="1.1" fill="currentColor"/></svg>;
    case 'youtube':
      return <svg {...common}><path d="M22 12s0-3.2-.4-4.7c-.2-.8-.9-1.5-1.7-1.7C18.4 5.2 12 5.2 12 5.2s-6.4 0-7.9.4c-.8.2-1.5.9-1.7 1.7C2 8.8 2 12 2 12s0 3.2.4 4.7c.2.8.9 1.5 1.7 1.7 1.5.4 7.9.4 7.9.4s6.4 0 7.9-.4c.8-.2 1.5-.9 1.7-1.7.4-1.5.4-4.7.4-4.7Z" stroke="currentColor" strokeWidth="1.6"/><path d="M10.2 15.1V8.9L15.6 12l-5.4 3.1Z" fill="currentColor"/></svg>;
    case 'tiktok':
      return <svg {...common}><path d="M14 3h2.4c.3 1.6 1.2 2.9 2.6 3.6.7.4 1.5.6 2.3.6v2.6c-1.7 0-3.3-.5-4.7-1.4v6.4c0 3.4-2.8 6.2-6.2 6.2S4.2 18.2 4.2 14.8s2.8-6.2 6.2-6.2c.3 0 .6 0 .9.1v2.7c-.3-.1-.6-.1-.9-.1-2 0-3.6 1.6-3.6 3.6s1.6 3.6 3.6 3.6 3.6-1.6 3.6-3.6V3Z" fill="currentColor"/></svg>;
    case 'threads':
      return <svg {...common}><path d="M12.2 3c-4.8 0-7.7 2.9-7.9 7.5-.1 2.5.5 4.5 1.7 6 1.3 1.6 3.3 2.5 5.9 2.6h.1c1.9 0 3.5-.5 4.7-1.4 1.4-1.1 2.2-2.7 2.2-4.4 0-1.6-.6-3-1.7-3.9-.7-.6-1.6-1-2.7-1.2-.2-1.3-.9-2.4-2.1-2.9-1.5-.7-3.5-.3-4.7 1l1.5 1c.6-.7 1.6-.9 2.4-.6.5.2.9.7 1.1 1.3-1.2 0-2.3.2-3.2.5-1.4.6-2.2 1.7-2.2 3 0 .9.4 1.7 1.1 2.3.7.5 1.6.8 2.6.8 1.4 0 2.5-.5 3.3-1.5.5-.7.8-1.5.9-2.5.7.2 1.2.5 1.6.9.6.6 1 1.5 1 2.5 0 1.1-.5 2.1-1.4 2.9-.9.7-2.1 1-3.5 1-2 0-3.5-.6-4.4-1.9-1-1.2-1.4-2.9-1.3-4.9.2-3.6 2.4-5.7 6-5.7 1.9 0 3.4.6 4.4 1.7l1.4-1.2C16.4 3.7 14.5 3 12.2 3Z" fill="currentColor"/></svg>;
    case 'note':
      return <svg {...common}><rect x="3" y="3" width="18" height="18" rx="4" stroke="currentColor" strokeWidth="1.6"/><path d="M8 8v8M8 8l6 8V8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>;
    case 'bluesky':
      return <svg {...common}><path d="M6 4c2.5 1.6 4.5 4 6 7 1.5-3 3.5-5.4 6-7 2 0 3 1.4 3 3.6s-.5 4.8-1.5 6c-1.1 1.4-2.9 1.8-4.8 1.4.9.3 2 1.1 2 2.6 0 1.9-1.6 3.4-3.7 3.4-2 0-3-.6-4-2-1 1.4-2 2-4 2-2.1 0-3.7-1.5-3.7-3.4 0-1.5 1.1-2.3 2-2.6-1.9.4-3.7 0-4.8-1.4C2.5 12.4 2 9.8 2 7.6 2 5.4 3 4 5 4h1Z" fill="currentColor"/></svg>;
    case 'github':
      return <svg {...common}><path d="M12 2C6.5 2 2 6.6 2 12.2c0 4.5 2.9 8.3 6.8 9.6.5.1.7-.2.7-.5v-1.7c-2.8.6-3.4-1.4-3.4-1.4-.5-1.2-1.1-1.5-1.1-1.5-.9-.6.1-.6.1-.6 1 .1 1.5 1 1.5 1 .9 1.6 2.4 1.1 3 .9.1-.7.4-1.1.6-1.4-2.2-.3-4.6-1.1-4.6-5 0-1.1.4-2 1-2.8-.1-.2-.4-1.2.1-2.6 0 0 .8-.3 2.7 1.1.8-.2 1.6-.3 2.5-.3s1.7.1 2.5.3c1.9-1.3 2.7-1.1 2.7-1.1.5 1.4.2 2.4.1 2.6.7.8 1 1.7 1 2.8 0 3.9-2.3 4.7-4.6 5 .4.3.7.9.7 1.8v2.7c0 .3.2.6.7.5C19.2 20.4 22 16.7 22 12.2 22 6.6 17.5 2 12 2Z" fill="currentColor"/></svg>;
    case 'facebook':
      return <svg {...common}><path d="M13.5 21v-8h2.7l.4-3.2h-3.1V7.7c0-.9.3-1.6 1.6-1.6h1.7V3.2c-.3 0-1.3-.1-2.4-.1-2.4 0-4 1.4-4 4.1v2.6H7.7V13h2.6v8h3.2Z" fill="currentColor"/></svg>;
    case 'pinterest':
      return <svg {...common}><path d="M12 2C6.5 2 2 6.5 2 12c0 4.2 2.6 7.7 6.2 9.2-.1-.8-.2-2 0-2.9.2-.8 1.2-4.9 1.2-4.9s-.3-.6-.3-1.5c0-1.4.8-2.5 1.8-2.5.9 0 1.3.6 1.3 1.4 0 .9-.6 2.2-.9 3.4-.2 1 .5 1.9 1.5 1.9 1.9 0 3.3-2 3.3-4.8 0-2.5-1.8-4.3-4.4-4.3-3 0-4.7 2.2-4.7 4.5 0 .9.3 1.9.8 2.4.1.1.1.2.1.3l-.3 1.1c-.1.2-.2.2-.4.1-1.3-.6-2.1-2.5-2.1-4.1 0-3.3 2.4-6.3 7-6.3 3.7 0 6.5 2.6 6.5 6.1 0 3.7-2.3 6.6-5.5 6.6-1.1 0-2.1-.6-2.4-1.2 0 0-.5 2.1-.7 2.6-.3.9-.9 2.1-1.4 2.8 1 .3 2.1.5 3.2.5 5.5 0 10-4.5 10-10S17.5 2 12 2Z" fill="currentColor"/></svg>;
    case 'linkedin':
      return <svg {...common}><path d="M4.98 3.5A2.5 2.5 0 1 1 5 8.5a2.5 2.5 0 0 1-.02-5ZM3 9.5h4V21H3V9.5Zm7 0h3.8v1.6h.1c.5-1 1.8-2 3.7-2 4 0 4.7 2.6 4.7 6V21H18v-5.4c0-1.3 0-3-1.8-3s-2.1 1.4-2.1 2.9V21H10V9.5Z" fill="currentColor"/></svg>;
    case 'discord':
      return <svg {...common}><path d="M20 5.3c-1.5-.7-3.1-1.2-4.7-1.5 0 0-.2.3-.3.5-1.8-.3-3.6-.3-5.3 0-.1-.2-.3-.5-.3-.5-1.7.3-3.3.8-4.7 1.5-3 4.4-3.8 8.7-3.4 12.9 2 1.5 3.9 2.4 5.8 3 .5-.7.9-1.4 1.3-2.1-.7-.3-1.4-.6-2-1 .2-.1.3-.2.5-.3 3.9 1.8 8.1 1.8 12 0 .2.1.3.2.5.3-.6.4-1.3.7-2 1 .4.7.8 1.4 1.3 2.1 2-.6 3.9-1.5 5.8-3 .5-4.9-.8-9.2-3.5-12.9ZM8.5 15.5c-1.1 0-2.1-1-2.1-2.3s1-2.3 2.1-2.3 2.1 1 2.1 2.3-.9 2.3-2.1 2.3Zm7 0c-1.1 0-2.1-1-2.1-2.3s1-2.3 2.1-2.3 2.1 1 2.1 2.3-1 2.3-2.1 2.3Z" fill="currentColor"/></svg>;
    case 'mail':
      return <svg {...common}><rect x="3" y="5" width="18" height="14" rx="2.5" stroke="currentColor" strokeWidth="1.6"/><path d="m4 7 8 6 8-6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>;
    default: // website / fallback
      return <svg {...common}><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6"/><path d="M3 12h18M12 3c2.5 3 2.5 15 0 18M12 3c-2.5 3-2.5 15 0 18" stroke="currentColor" strokeWidth="1.4"/></svg>;
  }
}

// Renders a SNS icon of any kind: platform key / emoji / image URL
function SNSIconResolved({ item, size = 22 }){
  const mode = item.iconMode || 'auto';
  if (mode === 'emoji' && item.iconEmoji){
    return <span style={{fontSize: size, lineHeight:1}}>{item.iconEmoji}</span>;
  }
  if (mode === 'image' && item.iconImage){
    return <img src={item.iconImage} alt="" />;
  }
  // manual platform key or auto-detected
  let key;
  if (mode === 'platform' && item.iconPlatform){
    key = item.iconPlatform;
  } else {
    key = detectPlatform(item.url).key;
  }
  return <PlatformIcon platformKey={key} size={size} />;
}

// Resolved label — user override -> auto detect -> "リンク"
function resolveSNSLabel(item){
  if (item.label && item.label.trim()) return item.label.trim();
  const key = (item.iconMode === 'platform' && item.iconPlatform) ? item.iconPlatform : detectPlatform(item.url).key;
  return PLATFORM_MAP[key]?.label || 'リンク';
}

function Paw({size=16}){
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="6" cy="9" rx="2" ry="2.6"/>
    <ellipse cx="12" cy="6.5" rx="2" ry="2.8"/>
    <ellipse cx="18" cy="9" rx="2" ry="2.6"/>
    <ellipse cx="9" cy="14" rx="1.8" ry="2.2"/>
    <path d="M12 12.5c3.5 0 5.5 3 5.5 5.2 0 1.7-1.5 2.8-3.3 2.8-1.2 0-1.6-.4-2.2-.4s-1 .4-2.2.4c-1.8 0-3.3-1.1-3.3-2.8 0-2.2 2-5.2 5.5-5.2Z"/>
  </svg>;
}

// Renders "the little accent thing" — could be paws, emoji, custom image
function AccentMark({ decor }){
  const d = decor || {};
  if (!d.enabled) return null;
  const count = Math.min(Math.max(d.count || 3, 1), 6);
  const items = [];
  for (let i=0; i<count; i++){
    if (d.mode === 'emoji' && d.emoji){
      items.push(<span key={i} style={{fontSize:18, lineHeight:1}}>{d.emoji}</span>);
    } else if (d.mode === 'image' && d.image){
      items.push(<img key={i} src={d.image} alt="" />);
    } else {
      items.push(<Paw key={i} size={16}/>);
    }
  }
  return <div className="paws">{items}</div>;
}

Object.assign(window, { PLATFORMS, PLATFORM_KEYS, PLATFORM_MAP, detectPlatform, extractHandle, PlatformIcon, SNSIconResolved, resolveSNSLabel, Paw, AccentMark });
