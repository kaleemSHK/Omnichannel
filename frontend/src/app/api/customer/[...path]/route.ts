import { type NextRequest, NextResponse } from 'next/server';

const GATEWAY = (process.env.GATEWAY_UPSTREAM || 'http://127.0.0.1:8787').replace(/\/$/, '');

async function handler(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const target = `${GATEWAY}/api/customer/${path.join('/')}`;
  const url = new URL(target);

  // Forward query params
  req.nextUrl.searchParams.forEach((v, k) => url.searchParams.set(k, v));

  const headers = new Headers();
  req.headers.forEach((v, k) => {
    if (!['host', 'connection', 'transfer-encoding'].includes(k.toLowerCase())) {
      headers.set(k, v);
    }
  });

  const body = req.method !== 'GET' && req.method !== 'HEAD'
    ? await req.arrayBuffer()
    : undefined;

  const upstream = await fetch(url.toString(), {
    method: req.method,
    headers,
    body,
  });

  const responseHeaders = new Headers();
  upstream.headers.forEach((v, k) => {
    if (!['transfer-encoding', 'connection'].includes(k.toLowerCase())) {
      responseHeaders.set(k, v);
    }
  });

  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
