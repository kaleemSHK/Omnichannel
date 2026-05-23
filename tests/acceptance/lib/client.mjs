export async function health(url, path = '/health') {
  try {
    const res = await fetch(`${url}${path}`, { signal: AbortSignal.timeout(5000) });
    return res.ok;
  } catch {
    return false;
  }
}

export async function api(url, path, { method = 'GET', token, tenantId, body, headers: extra = {} } = {}) {
  const headers = { Accept: 'application/json', ...extra };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (tenantId) headers['X-Blinkone-Tenant-Id'] = String(tenantId);
  if (body) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${url}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(30_000),
  });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, json, data: json.data ?? json };
}
