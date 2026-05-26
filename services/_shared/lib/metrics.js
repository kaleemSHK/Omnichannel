/**
 * BlinkOne Prometheus metrics — Sprint 2 MON1
 *
 * Zero-dependency minimal Prometheus text format exporter.
 * Implements Counter, Gauge, and Histogram with label support.
 *
 * Text format spec: https://prometheus.io/docs/instrumenting/exposition_formats/
 */

'use strict';

// ─── Label helpers ─────────────────────────────────────────────────────────

/** Stable sort key for a label-set object */
function labelKey(labels) {
  if (!labels || !Object.keys(labels).length) return '';
  return Object.entries(labels)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${String(v)}`)
    .join('\x00');
}

/** Render label set as {k="v",...} string */
function labelStr(labels) {
  if (!labels) return '';
  const pairs = Object.entries(labels).map(([k, v]) => `${k}="${String(v)}"`).join(',');
  return pairs ? `{${pairs}}` : '';
}

// ─── Counter ───────────────────────────────────────────────────────────────

class Counter {
  constructor(name, help) {
    this.name = name;
    this.help = help;
    this._values = new Map(); // key → number
  }

  inc(labels = {}, n = 1) {
    const k = labelKey(labels);
    this._values.set(k, (this._values.get(k) ?? 0) + n);
    this._labels = this._labels ?? new Map();
    this._labels.set(k, labels);
  }

  serialize() {
    const lines = [
      `# HELP ${this.name} ${this.help}`,
      `# TYPE ${this.name} counter`,
    ];
    for (const [k, v] of this._values) {
      const labels = this._labels?.get(k) ?? {};
      lines.push(`${this.name}${labelStr(labels)} ${v}`);
    }
    if (!this._values.size) lines.push(`${this.name} 0`);
    return lines.join('\n');
  }
}

// ─── Gauge ─────────────────────────────────────────────────────────────────

class Gauge {
  constructor(name, help) {
    this.name = name;
    this.help = help;
    this._values = new Map();
    this._labels = new Map();
  }

  _remember(labels) {
    const k = labelKey(labels);
    if (!this._labels.has(k)) this._labels.set(k, labels);
    return k;
  }

  set(labels = {}, value) {
    const k = this._remember(labels);
    this._values.set(k, value);
  }

  inc(labels = {}, n = 1) {
    const k = this._remember(labels);
    this._values.set(k, (this._values.get(k) ?? 0) + n);
  }

  dec(labels = {}, n = 1) { this.inc(labels, -n); }

  serialize() {
    const lines = [
      `# HELP ${this.name} ${this.help}`,
      `# TYPE ${this.name} gauge`,
    ];
    for (const [k, v] of this._values) {
      lines.push(`${this.name}${labelStr(this._labels.get(k) ?? {})} ${v}`);
    }
    if (!this._values.size) lines.push(`${this.name} 0`);
    return lines.join('\n');
  }
}

// ─── Histogram ─────────────────────────────────────────────────────────────

const DEFAULT_BUCKETS = [10, 25, 50, 100, 250, 500, 1000, 2500, 5000];

class Histogram {
  constructor(name, help, buckets = DEFAULT_BUCKETS) {
    this.name = name;
    this.help = help;
    this._buckets = [...buckets].sort((a, b) => a - b);
    this._counts  = new Map(); // key → count
    this._sums    = new Map(); // key → sum
    this._bkts    = new Map(); // key → bucket-count[]  (same order as _buckets)
    this._labels  = new Map(); // key → labels object
  }

  observe(labels = {}, value) {
    const k = labelKey(labels);
    if (!this._labels.has(k)) this._labels.set(k, labels);

    this._counts.set(k, (this._counts.get(k) ?? 0) + 1);
    this._sums.set(k, (this._sums.get(k) ?? 0) + value);

    const bkts = this._bkts.get(k) ?? new Array(this._buckets.length).fill(0);
    for (let i = 0; i < this._buckets.length; i++) {
      if (value <= this._buckets[i]) bkts[i]++;
    }
    this._bkts.set(k, bkts);
  }

  serialize() {
    const lines = [
      `# HELP ${this.name} ${this.help}`,
      `# TYPE ${this.name} histogram`,
    ];
    for (const [k, count] of this._counts) {
      const labels  = this._labels.get(k) ?? {};
      const bkts    = this._bkts.get(k) ?? [];
      const sum     = this._sums.get(k) ?? 0;

      for (let i = 0; i < this._buckets.length; i++) {
        const le = this._buckets[i];
        lines.push(`${this.name}_bucket${labelStr({ ...labels, le: String(le) })} ${bkts[i] ?? 0}`);
      }
      lines.push(`${this.name}_bucket${labelStr({ ...labels, le: '+Inf' })} ${count}`);
      lines.push(`${this.name}_count${labelStr(labels)} ${count}`);
      lines.push(`${this.name}_sum${labelStr(labels)} ${sum}`);
    }
    if (!this._counts.size) {
      for (const le of this._buckets) {
        lines.push(`${this.name}_bucket{le="${le}"} 0`);
      }
      lines.push(`${this.name}_bucket{le="+Inf"} 0`);
      lines.push(`${this.name}_count 0`);
      lines.push(`${this.name}_sum 0`);
    }
    return lines.join('\n');
  }
}

// ─── Registry ──────────────────────────────────────────────────────────────

class Registry {
  constructor() {
    this._metrics = new Map(); // name → metric
  }

  register(metric) {
    this._metrics.set(metric.name, metric);
    return metric;
  }

  counter(name, help) {
    if (this._metrics.has(name)) return this._metrics.get(name);
    return this.register(new Counter(name, help));
  }

  gauge(name, help) {
    if (this._metrics.has(name)) return this._metrics.get(name);
    return this.register(new Gauge(name, help));
  }

  histogram(name, help, buckets) {
    if (this._metrics.has(name)) return this._metrics.get(name);
    return this.register(new Histogram(name, help, buckets));
  }

  contentType() {
    return 'text/plain; version=0.0.4; charset=utf-8';
  }

  serialize() {
    return [...this._metrics.values()].map((m) => m.serialize()).join('\n\n') + '\n';
  }
}

// ─── Global registry ───────────────────────────────────────────────────────

export const registry = new Registry();

// ─── Process metrics (added lazily when collectProcessMetrics is called) ───

let _processCollected = false;

/**
 * Register and periodically update process-level metrics.
 * Call once per service after the service name is known.
 * @param {string} service
 */
export function collectProcessMetrics(service) {
  if (_processCollected) return;
  _processCollected = true;

  const uptime = registry.gauge('process_uptime_seconds', 'Process uptime in seconds');
  const rss    = registry.gauge('process_memory_rss_bytes', 'Resident set size bytes');
  const heap   = registry.gauge('process_memory_heap_used_bytes', 'Heap used bytes');
  const labels = { service };

  const update = () => {
    uptime.set(labels, Math.floor(process.uptime()));
    const m = process.memoryUsage();
    rss.set(labels, m.rss);
    heap.set(labels, m.heapUsed);
  };

  update();
  const t = setInterval(update, 15_000);
  if (t.unref) t.unref();
}
