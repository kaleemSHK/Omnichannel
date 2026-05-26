import { appendFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

const LOG_PATH =
  process.env.CALL_DEBUG_LOG || '/tmp/blinkone-call-debug.ndjson';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const line = `${JSON.stringify({ ...body, timestamp: body.timestamp ?? Date.now() })}\n`;
    await mkdir(dirname(LOG_PATH), { recursive: true }).catch(() => undefined);
    await appendFile(LOG_PATH, line, { encoding: 'utf8', flag: 'a' });
  } catch (err) {
    console.error('[call-debug] write failed:', err);
  }
  return Response.json({ ok: true });
}
