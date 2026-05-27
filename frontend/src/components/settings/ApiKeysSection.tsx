'use client';

/**
 * API Key Management UI — Sprint 3 G19.
 * Features: list, create (with one-time secret reveal), inline rename, revoke.
 */

import { useState, useRef } from 'react';
import { KeyRound, Plus, Copy, Check, Pencil, Trash2, X, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useApiKeys, useCreateApiKey, useRenameApiKey, useRevokeApiKey } from '@/lib/hooks/useApiKeys';
import { API_KEY_SCOPES } from '@/lib/api/apiKeys';
import type { ApiKey, ApiKeyCreateResult, ApiKeyScope } from '@/lib/api/apiKeys';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function scopeColor(scope: ApiKeyScope) {
  if (scope === 'admin') return 'bg-red-100 text-red-700';
  if (scope === 'write') return 'bg-amber-100 text-amber-700';
  return 'bg-blue-100 text-blue-700';
}

function relativeDate(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  return `${days} days ago`;
}

// ─── Secret Reveal Dialog ─────────────────────────────────────────────────────

function SecretRevealDialog({ result, onClose }: { result: ApiKeyCreateResult; onClose: () => void }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(result.rawKey).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-background border rounded-xl shadow-xl w-full max-w-lg p-6 mx-4">
        <div className="flex items-start gap-3 mb-4">
          <KeyRound className="text-brand-primary mt-0.5 shrink-0" size={20} />
          <div>
            <h2 className="font-semibold text-base">Save your API key</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              This is the <strong>only time</strong> you&apos;ll see the full key. Store it securely — it cannot be retrieved again.
            </p>
          </div>
        </div>

        <div className="bg-muted rounded-lg p-3 font-mono text-sm break-all select-all mb-4">
          {result.rawKey}
        </div>

        <div className="flex gap-2">
          <Button onClick={copy} variant="outline" className="flex-1 gap-2">
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? 'Copied!' : 'Copy key'}
          </Button>
          <Button onClick={onClose} className="flex-1">
            I&apos;ve saved it — close
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Revoke Confirm Dialog ────────────────────────────────────────────────────

function RevokeConfirmDialog({ keyName, onConfirm, onCancel }: { keyName: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-background border rounded-xl shadow-xl w-full max-w-sm p-6 mx-4">
        <div className="flex items-start gap-3 mb-4">
          <AlertTriangle className="text-red-500 mt-0.5 shrink-0" size={20} />
          <div>
            <h2 className="font-semibold text-base">Revoke API key</h2>
            <p className="text-sm text-muted-foreground mt-1">
              <strong>{keyName}</strong> will be permanently revoked. Any service using it will lose access immediately.
            </p>
          </div>
        </div>
        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button onClick={onConfirm} className="bg-red-600 hover:bg-red-700 text-white">Revoke key</Button>
        </div>
      </div>
    </div>
  );
}

// ─── Key Row ──────────────────────────────────────────────────────────────────

function KeyRow({ apiKey }: { apiKey: ApiKey }) {
  const rename = useRenameApiKey();
  const revoke = useRevokeApiKey();

  const [editing, setEditing]   = useState(false);
  const [editName, setEditName] = useState(apiKey.name);
  const [showConfirm, setShowConfirm] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function startEdit() {
    setEditName(apiKey.name);
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  function commitRename() {
    const trimmed = editName.trim();
    if (trimmed && trimmed !== apiKey.name) {
      rename.mutate({ id: apiKey.id, name: trimmed });
    }
    setEditing(false);
  }

  function handleRevokeConfirm() {
    revoke.mutate(apiKey.id);
    setShowConfirm(false);
  }

  return (
    <>
      <div className="flex items-center gap-3 py-3 border-b last:border-0">
        {/* Icon */}
        <div className="w-8 h-8 rounded-md bg-muted flex items-center justify-center shrink-0">
          <KeyRound size={15} className="text-muted-foreground" />
        </div>

        {/* Name + prefix */}
        <div className="flex-1 min-w-0">
          {editing ? (
            <div className="flex items-center gap-2">
              <Input
                ref={inputRef}
                value={editName}
                onChange={e => setEditName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setEditing(false); }}
                className="h-7 text-sm"
              />
              <Button size="sm" variant="ghost" onClick={commitRename} className="h-7 px-2">
                <Check size={13} />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)} className="h-7 px-2">
                <X size={13} />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm truncate">{apiKey.name}</span>
              <button onClick={startEdit} className="text-muted-foreground hover:text-foreground transition-colors" title="Rename">
                <Pencil size={12} />
              </button>
            </div>
          )}
          <div className="flex items-center gap-2 mt-0.5">
            <code className="text-xs text-muted-foreground font-mono">{apiKey.keyPrefix}…</code>
            <span className="text-xs text-muted-foreground">·</span>
            <span className="text-xs text-muted-foreground">Created {relativeDate(apiKey.createdAt)}</span>
          </div>
        </div>

        {/* Scopes */}
        <div className="hidden sm:flex items-center gap-1">
          {apiKey.scopes.map(s => (
            <span key={s} className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${scopeColor(s)}`}>
              {s.toUpperCase()}
            </span>
          ))}
        </div>

        {/* Revoke */}
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setShowConfirm(true)}
          className="text-red-500 hover:text-red-700 hover:bg-red-50 h-8 w-8 p-0"
          title="Revoke key"
          disabled={revoke.isPending}
        >
          <Trash2 size={14} />
        </Button>
      </div>

      {showConfirm && (
        <RevokeConfirmDialog
          keyName={apiKey.name}
          onConfirm={handleRevokeConfirm}
          onCancel={() => setShowConfirm(false)}
        />
      )}
    </>
  );
}

// ─── Create Sheet ─────────────────────────────────────────────────────────────

function CreateKeySheet({ onClose, onCreated }: { onClose: () => void; onCreated: (r: ApiKeyCreateResult) => void }) {
  const [name, setName]         = useState('');
  const [scopes, setScopes]     = useState<ApiKeyScope[]>(['read']);
  const create = useCreateApiKey(result => {
    onCreated(result);
    onClose();
  });

  function toggleScope(s: ApiKeyScope) {
    setScopes(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || scopes.length === 0) return;
    create.mutate({ name: name.trim(), scopes });
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-background border rounded-xl shadow-xl w-full max-w-md p-6 mx-4">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-semibold text-base">Create API key</h2>
          <Button variant="ghost" size="sm" onClick={onClose} className="h-7 w-7 p-0">
            <X size={15} />
          </Button>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1.5 block">Name</label>
            <Input
              autoFocus
              placeholder="e.g. CI Pipeline, Analytics Bot"
              value={name}
              onChange={e => setName(e.target.value)}
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 block">Scopes</label>
            <div className="space-y-2">
              {API_KEY_SCOPES.map(({ value, label, description }) => (
                <label key={value} className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={scopes.includes(value)}
                    onChange={() => toggleScope(value)}
                    className="mt-0.5"
                  />
                  <div>
                    <span className="text-sm font-medium">{label}</span>
                    <p className="text-xs text-muted-foreground">{description}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1"
              disabled={!name.trim() || scopes.length === 0 || create.isPending}
            >
              {create.isPending ? 'Creating…' : 'Create key'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main Section ─────────────────────────────────────────────────────────────

export function ApiKeysSection() {
  const { data: keys = [], isLoading } = useApiKeys();

  const [showCreate, setShowCreate]   = useState(false);
  const [newResult, setNewResult]     = useState<ApiKeyCreateResult | null>(null);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold">API Keys</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Manage long-lived bearer tokens for server-to-server API access. Each key is shown once — store it securely.
        </p>
      </div>

      {/* Key list */}
      <div className="border rounded-xl bg-background">
        {/* Top bar */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <span className="text-sm font-medium">
            {isLoading ? 'Loading…' : `${keys.length} key${keys.length !== 1 ? 's' : ''}`}
          </span>
          <Button size="sm" className="gap-1.5" onClick={() => setShowCreate(true)}>
            <Plus size={14} />
            New key
          </Button>
        </div>

        {/* Rows */}
        {isLoading ? (
          <div className="py-10 text-center text-sm text-muted-foreground">Loading keys…</div>
        ) : keys.length === 0 ? (
          <div className="py-10 text-center">
            <KeyRound size={32} className="mx-auto text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground">No API keys yet</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => setShowCreate(true)}>
              Create your first key
            </Button>
          </div>
        ) : (
          <div className="px-4">
            {keys.map(k => <KeyRow key={k.id} apiKey={k} />)}
          </div>
        )}
      </div>

      {/* Best practices */}
      <div className="rounded-xl border bg-muted/30 p-4 space-y-2">
        <h3 className="text-sm font-semibold">Security best practices</h3>
        <ul className="text-sm text-muted-foreground space-y-1 list-disc pl-4">
          <li>Never commit API keys to source control — use environment variables or a secrets manager.</li>
          <li>Grant only the scopes actually needed (principle of least privilege).</li>
          <li>Rotate keys regularly — revoke and recreate rather than sharing a long-lived key.</li>
          <li>Monitor usage: each key&apos;s <code className="font-mono text-xs">key_prefix</code> appears in audit logs.</li>
        </ul>
      </div>

      {/* Modals */}
      {showCreate && (
        <CreateKeySheet
          onClose={() => setShowCreate(false)}
          onCreated={r => setNewResult(r)}
        />
      )}

      {newResult && (
        <SecretRevealDialog
          result={newResult}
          onClose={() => setNewResult(null)}
        />
      )}
    </div>
  );
}
