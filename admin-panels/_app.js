// Shared Alpine.js app helpers for all admin panels
window.bo = {
  api: window.location.origin,
  token: localStorage.getItem('bo_token') || '',
  setToken(t) { this.token = t; localStorage.setItem('bo_token', t); },
  async get(path) {
    const r = await fetch(`${this.api}/api${path}`, { headers: this.headers() });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error?.message || `HTTP ${r.status}`);
    return j.data ?? j;
  },
  async post(path, body) {
    const r = await fetch(`${this.api}/api${path}`, { method: 'POST', headers: { ...this.headers(), 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error?.message || `HTTP ${r.status}`);
    return j.data ?? j;
  },
  async patch(path, body) {
    const r = await fetch(`${this.api}/api${path}`, { method: 'PATCH', headers: { ...this.headers(), 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error?.message || `HTTP ${r.status}`);
    return j.data ?? j;
  },
  headers() { return this.token ? { Authorization: `Bearer ${this.token}` } : {}; },
  fmt(iso) { return iso ? new Date(iso).toLocaleString() : '—'; },
  dur(ms) { return ms != null ? `${(ms/1000).toFixed(1)}s` : '—'; },
};
