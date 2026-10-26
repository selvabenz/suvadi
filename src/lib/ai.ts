// Optional AI explanations. Nothing is sent anywhere unless the reader sets an
// endpoint in Settings. It is meant for a small proxy (for example in front of
// unfoldingWord's BT Servant) that holds its own secrets: a key typed here is
// stored on this device only and sent as a Bearer token to that endpoint.
//
// Request:  POST <endpoint>  { message, verse: { ref, text, translation }, context }
// Response: { reply: string }  (or { text: string })

export interface AiRequest {
  message: string;
  verse: { ref: string; text: string; translation: string };
  context: { selection?: string; notes?: string[]; words?: string[] };
}

export class AiError extends Error {
  constructor(public kind: 'noendpoint' | 'network' | 'http' | 'bad', msg: string) {
    super(msg);
  }
}

export async function ask(endpoint: string, key: string, req: AiRequest, timeoutMs = 30000): Promise<string> {
  const url = endpoint.trim();
  if (!url) throw new AiError('noendpoint', 'no AI endpoint set');
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(key.trim() ? { Authorization: `Bearer ${key.trim()}` } : {}) },
      body: JSON.stringify(req),
      signal: ctl.signal,
    });
  } catch {
    throw new AiError('network', 'AI endpoint unreachable');
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) throw new AiError('http', `AI endpoint HTTP ${res.status}`);
  let data: unknown;
  try {
    data = await res.json();
  } catch {
    throw new AiError('bad', 'AI reply is not JSON');
  }
  const d = data as { reply?: unknown; text?: unknown };
  const reply = typeof d?.reply === 'string' ? d.reply : typeof d?.text === 'string' ? d.text : '';
  if (!reply.trim()) throw new AiError('bad', 'AI reply has no text');
  return reply;
}
