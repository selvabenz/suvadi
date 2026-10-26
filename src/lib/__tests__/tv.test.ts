import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseAppUrl, receiverUrl, tvUrl } from '../url';
import { parseTvMessage, presentAvailable, presentSupported, sendRef, type PresentConn } from '../present';

afterEach(() => vi.unstubAllGlobals());

describe('app URLs', () => {
  const base = 'https://selvabenz.github.io/suvadi/';

  it('reads deep links and TV links', () => {
    expect(parseAppUrl('?ref=JHN.3.16&t=ta-irv', '')).toEqual({ tv: false, receiver: false, ref: { book: 'JHN', ch: 3, v: 16 }, translation: 'ta-irv' });
    expect(parseAppUrl('?tv=1&receiver=1', '')).toMatchObject({ tv: true, receiver: true, ref: null });
    expect(parseAppUrl('', '#tv').tv).toBe(true);
    expect(parseAppUrl('?ref=nonsense', '').ref).toBeNull();
  });

  it('writes TV links that read back', () => {
    const u = tvUrl(base, { book: 'PSA', ch: 23, v: 1 }, 'en-ult');
    expect(u).toBe('https://selvabenz.github.io/suvadi/?tv=1&ref=PSA.23.1&t=en-ult');
    expect(parseAppUrl(new URL(u).search, '')).toMatchObject({ tv: true, ref: { book: 'PSA', ch: 23, v: 1 }, translation: 'en-ult' });
    expect(receiverUrl(base)).toBe('https://selvabenz.github.io/suvadi/?tv=1&receiver=1');
  });
});

describe('Presentation API wrapper', () => {
  it('is unavailable without the API', async () => {
    vi.stubGlobal('PresentationRequest', undefined);
    expect(presentSupported()).toBe(false);
    await expect(presentAvailable('https://x.test/a')).resolves.toBe(false);
  });

  it('reports availability from the browser', async () => {
    vi.stubGlobal('PresentationRequest', class { getAvailability() { return Promise.resolve({ value: true }); } start() { return Promise.reject(); } });
    await expect(presentAvailable('https://x.test/b')).resolves.toBe(true);
    vi.stubGlobal('PresentationRequest', class { getAvailability() { return Promise.reject(new Error('NotSupported')); } start() { return Promise.reject(); } });
    await expect(presentAvailable('https://x.test/c')).resolves.toBe(false);
  });

  it('sends verses only on a live connection, and reads them back', () => {
    const sent: string[] = [];
    const conn = { state: 'connected', send: (d: string) => sent.push(d) } as unknown as PresentConn;
    sendRef(conn, { book: 'JHN', ch: 3, v: 16 }, 'ta-irv');
    sendRef({ ...conn, state: 'closed' } as PresentConn, { book: 'JHN', ch: 3, v: 17 }, 'ta-irv');
    expect(sent.length).toBe(1);
    expect(parseTvMessage(sent[0])).toEqual({ type: 'ref', ref: { book: 'JHN', ch: 3, v: 16 }, translation: 'ta-irv' });
    expect(parseTvMessage('junk')).toBeNull();
    expect(parseTvMessage({ type: 'ref', ref: 'JHN.3', translation: 'x' })).toBeNull();
  });
});
