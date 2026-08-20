// Minimal safe Markdown renderer.
// Supports: headings (# ## ###), bold **b**, italic *i* / _i_, strike ~~s~~,
//   lists (- item, 1. item), blockquotes (> ), code blocks (```), inline `code`,
//   horizontal rules (---), links [t](u), images ![alt](u), paragraphs, line breaks.
// Escapes HTML by default; only produced tags come from our own emitters.

function escapeHTML(s){
  return String(s)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#39;');
}

// URL sanitizer — allow http, https, mailto, and data:image
function safeURL(u){
  const s = String(u||'').trim();
  if (/^(https?:|mailto:|\/|#|\.)/i.test(s)) return s;
  if (/^data:image\//i.test(s)) return s;
  return '#';
}

function renderInline(text){
  let s = escapeHTML(text);

  // images ![alt](url)   — do before links
  s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+&quot;[^&]*&quot;)?\)/g,
    (m, alt, url) => `<img src="${safeURL(url)}" alt="${alt}">`);

  // links [text](url)
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+&quot;[^&]*&quot;)?\)/g,
    (m, txt, url) => `<a href="${safeURL(url)}" target="_blank" rel="noopener noreferrer">${txt}</a>`);

  // inline code
  s = s.replace(/`([^`]+)`/g, (m, c)=> `<code>${c}</code>`);

  // bold
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/__([^_]+)__/g, '<strong>$1</strong>');

  // italic
  s = s.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
  s = s.replace(/(^|[^_])_([^_\n]+)_/g, '$1<em>$2</em>');

  // strikethrough
  s = s.replace(/~~([^~]+)~~/g, '<del>$1</del>');

  return s;
}

function renderMarkdown(src){
  if (!src) return '';
  const lines = String(src).replace(/\r\n/g,'\n').split('\n');
  const out = [];
  let i = 0;

  // block state
  let inCode = false;
  let codeBuf = [];
  let listStack = []; // stack of {type:'ul'|'ol', indent:number}

  function closeAllLists(){
    while(listStack.length){
      const top = listStack.pop();
      out.push(`</${top.type}>`);
    }
  }

  // Alignment block state
  let alignStack = []; // stack of {tag:'div', align}

  function closeAlignIfMatching(){
    // no-op — closed explicitly by :::end / ::: fence close
  }

  while (i < lines.length){
    const line = lines[i];

    // ── Alignment: block open — ":::center" / ":::right" / ":::left" ──
    const alignOpen = line.match(/^\s*:::\s*(center|right|left)\s*$/i);
    if (alignOpen && !inCode){
      closeAllLists();
      const align = alignOpen[1].toLowerCase();
      alignStack.push(align);
      out.push(`<div style="text-align:${align}">`);
      i++; continue;
    }
    // ── Alignment: block close — ":::" on its own ──
    if (/^\s*:::\s*$/.test(line) && !inCode && alignStack.length){
      closeAllLists();
      alignStack.pop();
      out.push(`</div>`);
      i++; continue;
    }

    // ── Alignment: single-line ">>center<< ..." / ">>right<< ..." / ">>left<< ..." ──
    const alignLine = line.match(/^\s*>>\s*(center|right|left)\s*<<\s*(.*)$/i);
    if (alignLine && !inCode){
      closeAllLists();
      const a = alignLine[1].toLowerCase();
      const content = alignLine[2];
      out.push(`<p style="text-align:${a}">${renderInline(content)}</p>`);
      i++; continue;
    }

    // fenced code
    if (/^```/.test(line)){
      if (!inCode){
        closeAllLists();
        inCode = true;
        codeBuf = [];
      } else {
        out.push(`<pre><code>${escapeHTML(codeBuf.join('\n'))}</code></pre>`);
        inCode = false;
      }
      i++; continue;
    }
    if (inCode){
      codeBuf.push(line);
      i++; continue;
    }

    // blank line = end of paragraph / lists
    if (/^\s*$/.test(line)){
      closeAllLists();
      i++; continue;
    }

    // horizontal rule
    if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)){
      closeAllLists();
      out.push('<hr>');
      i++; continue;
    }

    // headings
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h){
      closeAllLists();
      const lv = Math.min(h[1].length, 3); // clamp to h1-h3
      out.push(`<h${lv}>${renderInline(h[2])}</h${lv}>`);
      i++; continue;
    }

    // blockquote (possibly multi-line)
    if (/^>\s?/.test(line)){
      closeAllLists();
      const buf = [];
      while (i < lines.length && /^>\s?/.test(lines[i])){
        buf.push(lines[i].replace(/^>\s?/, ''));
        i++;
      }
      out.push(`<blockquote>${buf.map(renderInline).join('<br>')}</blockquote>`);
      continue;
    }

    // list item?
    const ul = line.match(/^(\s*)[-*]\s+(.*)$/);
    const ol = line.match(/^(\s*)\d+\.\s+(.*)$/);
    if (ul || ol){
      const type = ul ? 'ul' : 'ol';
      const content = (ul || ol)[2];
      const indent = ((ul || ol)[1] || '').length;

      // adjust stack
      while (listStack.length && listStack[listStack.length-1].indent > indent){
        const top = listStack.pop();
        out.push(`</${top.type}>`);
      }
      const top = listStack[listStack.length-1];
      if (!top || top.indent < indent || top.type !== type){
        // open new list at this indent
        // if top exists and indent equal but type differs, close the old first
        if (top && top.indent === indent && top.type !== type){
          const closed = listStack.pop();
          out.push(`</${closed.type}>`);
        }
        listStack.push({ type, indent });
        out.push(`<${type}>`);
      }
      out.push(`<li>${renderInline(content)}</li>`);
      i++; continue;
    }

    // paragraph — collect consecutive non-block lines
    closeAllLists();
    const paraBuf = [];
    while (i < lines.length &&
           !/^\s*$/.test(lines[i]) &&
           !/^```/.test(lines[i]) &&
           !/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(lines[i]) &&
           !/^(#{1,6})\s+/.test(lines[i]) &&
           !/^>\s?/.test(lines[i]) &&
           !/^(\s*)[-*]\s+/.test(lines[i]) &&
           !/^(\s*)\d+\.\s+/.test(lines[i]) &&
           !/^\s*:::\s*$/.test(lines[i]) &&
           !/^\s*:::\s*(center|right|left)\s*$/i.test(lines[i]) &&
           !/^\s*>>\s*(center|right|left)\s*<<\s*/i.test(lines[i])){
      paraBuf.push(lines[i]);
      i++;
    }
    out.push(`<p>${paraBuf.map(renderInline).join('<br>')}</p>`);
  }

  if (inCode){
    out.push(`<pre><code>${escapeHTML(codeBuf.join('\n'))}</code></pre>`);
  }
  closeAllLists();
  // close any unclosed alignment blocks
  while (alignStack.length){
    alignStack.pop();
    out.push(`</div>`);
  }

  return out.join('\n');
}

function MarkdownView({ source }){
  const html = React.useMemo(()=> renderMarkdown(source), [source]);
  return <div className="md-body" dangerouslySetInnerHTML={{__html: html}} />;
}

// Plain-text excerpt from markdown (strips syntax)
function markdownExcerpt(src, n=140){
  if (!src) return '';
  let s = String(src)
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[#>*_~`\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return s.length > n ? s.slice(0, n).trimEnd() + '…' : s;
}

Object.assign(window, { renderMarkdown, MarkdownView, markdownExcerpt });
