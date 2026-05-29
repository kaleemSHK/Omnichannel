'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, BarChart3, MessageSquare } from 'lucide-react';
import { bnFetch } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface Survey {
  id: string;
  name: string;
  type: 'csat' | 'nps' | 'custom';
  active: boolean;
  createdAt: string;
}

interface SurveySummary {
  totalResponses: number;
  avgScore: number | null;
  csatPercent: number | null;
}

async function listSurveys(): Promise<Survey[]> {
  const res = await bnFetch<{ data: Survey[] }>('ivr', '/v1/surveys');
  return res.data ?? [];
}

async function createSurvey(payload: { name: string; type: string }): Promise<Survey> {
  const res = await bnFetch<{ data: Survey }>('ivr', '/v1/surveys', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return res.data;
}

async function getSurveySummary(): Promise<SurveySummary> {
  try {
    const res = await bnFetch<{ data: SurveySummary }>('ivr', '/v1/surveys/summary');
    return res.data;
  } catch {
    return { totalResponses: 0, avgScore: null, csatPercent: null };
  }
}

export function SurveyWorkspace() {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [type, setType] = useState<'csat' | 'nps'>('csat');

  const { data: surveys = [], isLoading } = useQuery({ queryKey: ['surveys'], queryFn: listSurveys });
  const { data: summary } = useQuery({ queryKey: ['survey-summary'], queryFn: getSurveySummary });

  const create = useMutation({
    mutationFn: () => createSurvey({ name, type }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['surveys'] }); setName(''); },
  });

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Post-Call Surveys</h1>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Responses', value: summary?.totalResponses ?? 0 },
          { label: 'Avg Score (1–5)', value: summary?.avgScore != null ? summary.avgScore.toFixed(1) : '—' },
          { label: 'CSAT %', value: summary?.csatPercent != null ? `${summary.csatPercent}%` : '—' },
        ].map(k => (
          <div key={k.label} className="border rounded-lg p-4 bg-white">
            <p className="text-xs text-muted-foreground">{k.label}</p>
            <p className="text-2xl font-bold text-brand-primary mt-1">{k.value}</p>
          </div>
        ))}
      </div>

      {/* Create survey */}
      <div className="border rounded-lg p-4 bg-muted/20 space-y-3">
        <h2 className="text-sm font-medium">Create new survey</h2>
        <div className="flex gap-3">
          <Input
            placeholder="Survey name (e.g. Post-Call CSAT)"
            value={name}
            onChange={e => setName(e.target.value)}
            className="flex-1"
          />
          <select
            value={type}
            onChange={e => setType(e.target.value as 'csat' | 'nps')}
            className="text-sm border border-gray-200 rounded-md px-2 bg-white"
          >
            <option value="csat">CSAT (1–5)</option>
            <option value="nps">NPS (0–10)</option>
          </select>
          <Button size="sm" onClick={() => create.mutate()} disabled={!name || create.isPending}>
            <Plus className="w-4 h-4 me-1" />
            Create
          </Button>
        </div>
      </div>

      {/* Survey list */}
      <div className="space-y-2">
        {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {surveys.map(s => (
          <div key={s.id} className="border rounded-lg p-4 bg-white flex items-center gap-3">
            <MessageSquare className="w-5 h-5 text-brand-primary shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium">{s.name}</p>
              <p className="text-xs text-muted-foreground">{s.type.toUpperCase()} · Created {new Date(s.createdAt).toLocaleDateString()}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-xs px-2 py-0.5 rounded-full ${s.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                {s.active ? 'Active' : 'Inactive'}
              </span>
              <button type="button" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                <BarChart3 className="w-3.5 h-3.5" /> Results
              </button>
            </div>
          </div>
        ))}
        {!isLoading && surveys.length === 0 && (
          <p className="text-sm text-muted-foreground">No surveys yet. Create one above to start collecting feedback.</p>
        )}
      </div>
    </div>
  );
}
