import type { Ref } from './types';
import { parseRefKey, refKey } from './refs';

// The W3C Presentation API: a desktop Chrome/Edge page can show another page
// on a Chromecast or a connected display and send it messages. Phones cannot
// present an arbitrary page this way, so availability is checked first and
// the option stays hidden where it is missing. TypeScript's DOM library does
// not declare this API, hence the small local types.

export interface PresentConn {
  state: string;
  send(data: string): void;
  close(): void;
  terminate(): void;
  onmessage: ((e: { data: unknown }) => void) | null;
  onclose: (() => void) | null;
  onconnect: (() => void) | null;
  onterminate?: (() => void) | null;
}

interface RequestLike {
  getAvailability(): Promise<{ value: boolean; onchange?: (() => void) | null }>;
  start(): Promise<PresentConn>;
}
type RequestCtor = new (urls: string[]) => RequestLike;

export interface TvMessage {
  type: 'ref';
  ref: Ref;
  translation: string;
}

const requests = new Map<string, RequestLike>();

function ctor(): RequestCtor | null {
  const c = (globalThis as unknown as { PresentationRequest?: RequestCtor }).PresentationRequest;
  return typeof c === 'function' ? c : null;
}

function request(url: string): RequestLike | null {
  const C = ctor();
  if (!C) return null;
  let r = requests.get(url);
  if (!r) {
    r = new C([url]);
    requests.set(url, r);
  }
  return r;
}

export function presentSupported(): boolean {
  return !!ctor();
}

/** Is there a display to present on? Any failure (no API, no discovery) means no. */
export async function presentAvailable(url: string): Promise<boolean> {
  try {
    const r = request(url);
    if (!r) return false;
    const a = await r.getAvailability();
    return !!a?.value;
  } catch {
    return false;
  }
}

/** Opens the browser's display picker. Call it directly from a click. */
export function startPresenting(url: string): Promise<PresentConn> {
  const r = request(url);
  if (!r) return Promise.reject(new Error('Presentation API unavailable'));
  return r.start();
}

export function sendRef(conn: PresentConn | null, ref: Ref, translation: string): void {
  if (!conn || conn.state !== 'connected') return;
  const m: TvMessage = { type: 'ref', ref, translation };
  try {
    conn.send(JSON.stringify({ ...m, ref: refKey(ref) }));
  } catch {
    /* the TV went away; onclose will clear the connection */
  }
}

export function stopPresenting(conn: PresentConn | null): void {
  try {
    conn?.terminate();
  } catch {
    /* already gone */
  }
}

export function parseTvMessage(data: unknown): TvMessage | null {
  try {
    const o = typeof data === 'string' ? JSON.parse(data) : data;
    if (!o || o.type !== 'ref' || typeof o.translation !== 'string') return null;
    const ref = typeof o.ref === 'string' ? parseRefKey(o.ref) : null;
    return ref ? { type: 'ref', ref, translation: o.translation } : null;
  } catch {
    return null;
  }
}

interface ReceiverLike {
  connectionList: Promise<{
    connections: PresentConn[];
    addEventListener(type: 'connectionavailable', fn: (e: { connection: PresentConn }) => void): void;
  }>;
}

function receiver(): ReceiverLike | null {
  return (navigator as unknown as { presentation?: { receiver?: ReceiverLike } }).presentation?.receiver ?? null;
}

/** This page was opened on a TV by a presenting browser. */
export function isReceiver(): boolean {
  return !!receiver();
}

/** On the TV: call onMessage for every verse the controlling browser sends. */
export function listenReceiver(onMessage: (m: TvMessage) => void): () => void {
  const rec = receiver();
  let stopped = false;
  if (!rec) return () => {};
  const attach = (c: PresentConn) => {
    c.onmessage = (e) => {
      if (stopped) return;
      const m = parseTvMessage(e.data);
      if (m) onMessage(m);
    };
  };
  rec.connectionList
    .then((list) => {
      list.connections.forEach(attach);
      list.addEventListener('connectionavailable', (e) => attach(e.connection));
    })
    .catch(() => {});
  return () => {
    stopped = true;
  };
}
