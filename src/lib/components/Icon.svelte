<script lang="ts">
  // Thin line icons (24×24, stroke = currentColor), in the style of the
  // reference design. `filled` fills the shape (a liked heart, a set bookmark).
  let {
    name,
    size = 24,
    stroke = 1.7,
    filled = false,
  }: { name: string; size?: number; stroke?: number; filled?: boolean } = $props();

  const PATHS: Record<string, string> = {
    book: 'M12 6.5C10.5 5.2 8.3 4.5 4 4.5v13c4.3 0 6.5.7 8 2m0-13c1.5-1.3 3.7-2 8-2v13c-4.3 0-6.5.7-8 2m0-13v13',
    calendar: 'M4.5 6.5h15v13h-15zM4.5 10.5h15M8.5 4v4M15.5 4v4',
    bookmark: 'M6.5 4.5h11v15l-5.5-4-5.5 4z',
    search: 'M10.5 4.5a6 6 0 1 1 0 12 6 6 0 0 1 0-12zM15 15l4.5 4.5',
    settings:
      'M12 9a3 3 0 1 1 0 6 3 3 0 0 1 0-6zM12 3.5l1.6 2.2 2.7-.5.9 2.6 2.6.9-.5 2.7 2.2 1.6-2.2 1.6.5 2.7-2.6.9-.9 2.6-2.7-.5L12 20.5l-1.6-2.2-2.7.5-.9-2.6-2.6-.9.5-2.7L2.5 12l2.2-1.6-.5-2.7 2.6-.9.9-2.6 2.7.5z',
    heart: 'M12 19.5s-7.5-4.4-7.5-9.6A4.1 4.1 0 0 1 12 7.6a4.1 4.1 0 0 1 7.5 2.3c0 5.2-7.5 9.6-7.5 9.6z',
    bulb: 'M9 17.5h6M10 20.5h4M12 3.5a5.5 5.5 0 0 0-3.3 9.9c.8.6 1.3 1.6 1.3 2.6v1.5h4V16c0-1 .5-2 1.3-2.6A5.5 5.5 0 0 0 12 3.5z',
    note: 'M4.5 12a7.5 7.5 0 1 1 3.4 6.3L4.5 19.5l1.1-3.3A7.4 7.4 0 0 1 4.5 12z',
    send: 'M20 4 3.5 10.8l7 2.7 2.7 7zM20 4l-9.5 9.5',
    more: 'M5.5 12h.01M12 12h.01M18.5 12h.01',
    sparkle: 'M12 3.5l1.9 5.1 5.1 1.9-5.1 1.9L12 17.5l-1.9-5.1L5 10.5l5.1-1.9zM18.5 15.5l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z',
    words: 'M4.5 6.5h9M4.5 12h15M4.5 17.5h11',
    link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
    footnote: 'M6 4.5h8l4 4v11H6zM14 4.5v4h4M9 13h6M9 16.5h4',
    close: 'M6 6l12 12M18 6 6 18',
    'chevron-left': 'M14.5 6 8.5 12l6 6',
    'chevron-right': 'M9.5 6l6 6-6 6',
    'chevron-down': 'M6 9.5l6 6 6-6',
  };
  const FILLABLE = new Set(['heart', 'bookmark', 'note']);
</script>

<svg
  class="icon"
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill={filled && FILLABLE.has(name) ? 'currentColor' : 'none'}
  stroke="currentColor"
  stroke-width={name === 'more' ? 3 : stroke}
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
>
  <path d={PATHS[name] ?? ''} />
</svg>

<style>
  .icon { display: block; flex: none; }
</style>
