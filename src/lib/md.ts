// A very small Markdown reader for unfoldingWord notes and articles. It returns
// plain data that Md.svelte renders with elements, never as raw HTML, so note
// text can never inject markup.

export type Inline =
  | { t: 'text' | 'b' | 'i'; s: string }
  | { t: 'a'; s: string; href: string };

export interface Block {
  t: 'p' | 'h' | 'li';
  level?: number;   // heading level 1..4
  inl: Inline[];
  /** A paragraph that is an "Alternate translation: [...]" suggestion. */
  alt?: boolean;
}

const ALT_SPLIT = /\s*Alternate translation:\s*/i;

/** Links the app understands: web pages, and the build's internal tw:/ta: article links. */
function safeHref(href: string): string | null {
  const h = href.trim();
  if (/^https?:\/\//i.test(h)) return h;
  if (/^(tw|ta):[a-z0-9_-]+$/i.test(h)) return h;
  return null;
}

export function parseInline(src: string): Inline[] {
  const out: Inline[] = [];
  const re = /\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)\s]+)\)|(?<![*\w])\*(?!\s)([^*]+?)\*(?!\w)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  const text = (s: string) => {
    if (s) out.push({ t: 'text', s });
  };
  while ((m = re.exec(src))) {
    text(src.slice(last, m.index));
    if (m[1] !== undefined) out.push({ t: 'b', s: m[1] });
    else if (m[2] !== undefined) {
      const href = safeHref(m[3]);
      if (href) out.push({ t: 'a', s: m[2], href });
      else out.push({ t: 'text', s: m[2] });
    } else out.push({ t: 'i', s: m[4] });
    last = re.lastIndex;
  }
  text(src.slice(last));
  return out;
}

export function parseMd(src: string): Block[] {
  const blocks: Block[] = [];
  let para: string[] = [];
  const flush = () => {
    if (!para.length) return;
    let s = para.join(' ').trim();
    para = [];
    if (!s) return;
    // Translation Notes end a paragraph with "Alternate translation: [...]";
    // that suggestion becomes its own block so it can be labelled and styled.
    const [main, ...alts] = s.split(ALT_SPLIT);
    if (main.trim()) blocks.push({ t: 'p', inl: parseInline(main.trim()) });
    for (const a of alts) if (a.trim()) blocks.push({ t: 'p', inl: parseInline(a.trim()), alt: true });
  };
  for (const raw of src.replace(/\r/g, '').split('\n')) {
    const line = raw.trim();
    if (!line) {
      flush();
      continue;
    }
    const h = /^(#{1,4})\s+(.*)$/.exec(line);
    if (h) {
      flush();
      blocks.push({ t: 'h', level: h[1].length, inl: parseInline(h[2].replace(/:$/, '')) });
      continue;
    }
    const li = /^(?:[*-]|\d+\.)\s+(.*)$/.exec(line);
    if (li) {
      flush();
      blocks.push({ t: 'li', inl: parseInline(li[1]) });
      continue;
    }
    para.push(line);
  }
  flush();
  return blocks;
}
