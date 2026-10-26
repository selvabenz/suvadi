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
    // a rounded 8-tooth cog with a hollow centre
    settings:
      'M10.31 5.62L10.87 3.58L13.13 3.58L13.69 5.62L15.31 6.29L17.16 5.24L18.76 6.84L17.71 8.69L18.38 10.31L20.42 10.87L20.42 13.13L18.38 13.69L17.71 15.31L18.76 17.16L17.16 18.76L15.31 17.71L13.69 18.38L13.13 20.42L10.87 20.42L10.31 18.38L8.69 17.71L6.84 18.76L5.24 17.16L6.29 15.31L5.62 13.69L3.58 13.13L3.58 10.87L5.62 10.31L6.29 8.69L5.24 6.84L6.84 5.24L8.69 6.29ZM12 9.1a2.9 2.9 0 1 1 0 5.8 2.9 2.9 0 0 1 0-5.8z',
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
    share: 'M12 3.5v11.5M8 7.5l4-4 4 4M6.5 11.5H5.5v8h13v-8h-1',
    whatsapp: 'M4.5 12a7.5 7.5 0 1 1 3.4 6.3L4.5 19.5l1.1-3.3A7.4 7.4 0 0 1 4.5 12zM9.4 9.3c.2-.5.6-.7 1-.5l.9 1.3c.2.3.1.6-.1.8l-.4.5c.6 1.1 1.4 1.9 2.5 2.5l.5-.4c.2-.2.5-.3.8-.1l1.3.9c.2.4 0 .8-.5 1-1 .5-2.3.2-3.9-1.4s-2.6-3.6-2.1-4.6z',
    tv: 'M3.5 6h17v11h-17zM8.5 20h7M12 17v3',
    cast: 'M3.5 17.5a3 3 0 0 1 3 3M3.5 13.5a7 7 0 0 1 7 7M3.5 9.5a11 11 0 0 1 11 11M3.5 6.5v-1h17v14h-6',
    qr: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 14h2v2h-2zM14 18h2v2h-2zM18 18h2v2h-2z',
    copy: 'M8.5 8.5h11v11h-11zM15.5 8.5v-4h-11v11h4',
    check: 'M5 12.5l4.5 4.5L19 7',
    'arrows-h': 'M4 12h16M8 8l-4 4 4 4M16 8l4 4-4 4',
    fingers: 'M9 4.5v9M15 4.5v9M6 13.5a6 6 0 0 0 12 0',
    info: 'M12 4.5a7.5 7.5 0 1 1 0 15 7.5 7.5 0 0 1 0-15zM12 11v5M12 8h.01',
    globe: 'M12 4.5a7.5 7.5 0 1 1 0 15 7.5 7.5 0 0 1 0-15zM4.5 12h15M12 4.5c2.3 2.3 2.3 12.7 0 15M12 4.5c-2.3 2.3-2.3 12.7 0 15',
    type: 'M5.5 7V4.5h13V7M12 4.5v15M9.5 19.5h5',
    download: 'M12 4.5v10M8 10.5l4 4 4-4M5 19.5h14',
    trash: 'M5 7h14M10 7V4.5h4V7M7 7l1 12.5h8L17 7',
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
