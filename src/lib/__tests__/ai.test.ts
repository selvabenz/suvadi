import { afterEach, describe, expect, it, vi } from 'vitest';
import { ask, AiError, type AiRequest } from '../ai';

const req: AiRequest = { message: 'What is grace?', verse: { ref: 'John 1:14', text: '…', translation: 'ULT' }, context: {} };

afterEach(() => vi.unstubAllGlobals());

describe('ask', () => {
  it('refuses without an endpoint', async () => {
    await expect(ask('', '', req)).rejects.toMatchObject({ kind: 'noendpoint' });
  });

  it('posts JSON with the key and returns the reply', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ reply: 'Grace is a gift.' }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(ask('https://example.test/ask', 'k1', req)).resolves.toBe('Grace is a gift.');
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer k1');
    expect(JSON.parse(init.body as string).message).toBe('What is grace?');
  });

  it('reports HTTP errors and bad replies', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('x', { status: 500 })));
    await expect(ask('https://example.test', '', req)).rejects.toBeInstanceOf(AiError);
    vi.stubGlobal('fetch', vi.fn(async () => new Response('not json', { status: 200 })));
    await expect(ask('https://example.test', '', req)).rejects.toMatchObject({ kind: 'bad' });
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('offline'); }));
    await expect(ask('https://example.test', '', req)).rejects.toMatchObject({ kind: 'network' });
  });
});
