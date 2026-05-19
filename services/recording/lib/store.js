import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export function createStore(dir, defaults = {}) {
  const file = join(dir, 'store.json');
  let chain = Promise.resolve();
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  function load() {
    try { return JSON.parse(readFileSync(file, 'utf8')); }
    catch { return typeof defaults === 'function' ? defaults() : structuredClone(defaults); }
  }

  function save(data) {
    chain = chain.then(() => writeFileSync(file, JSON.stringify(data, null, 2)));
    return chain;
  }

  function withStore(fn) {
    chain = chain.then(() => { const s = load(); const r = fn(s); save(s); return r; });
    return chain;
  }

  return { load, save, withStore };
}
