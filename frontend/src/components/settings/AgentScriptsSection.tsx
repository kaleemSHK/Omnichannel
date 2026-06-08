'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { GripVertical, Plus, Trash2 } from 'lucide-react';
import {
  getAgentScriptConfig,
  saveAgentScriptConfig,
  type AgentScriptConfig,
} from '@/lib/api/ai';
import { useTenantId } from '@/lib/hooks/useTenantScope';
import { SectionHeader } from '@/components/settings/shared/SectionHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';

type StepRow = { id: string; label: string; description: string };

export function AgentScriptsSection() {
  const tenantId = useTenantId();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['agent-scripts', tenantId],
    queryFn: getAgentScriptConfig,
  });

  const [openingLine, setOpeningLine] = useState('');
  const [steps, setSteps] = useState<StepRow[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (!data || hydrated) return;
    setOpeningLine(data.openingLine);
    setSteps(data.steps.map(s => ({ ...s })));
    setHydrated(true);
  }, [data, hydrated]);

  const save = useMutation({
    mutationFn: () =>
      saveAgentScriptConfig({
        openingLine: openingLine.trim(),
        steps: steps.map(s => ({
          id: s.id,
          label: s.label.trim(),
          description: s.description.trim(),
        })),
      }),
    onSuccess: saved => {
      qc.setQueryData(['agent-scripts', tenantId], saved);
      toast.success('Agent script saved');
      setHydrated(false);
    },
    onError: () => toast.error('Could not save agent script'),
  });

  const addStep = () => {
    setSteps(prev => [
      ...prev,
      { id: `step-${Date.now()}`, label: '', description: '' },
    ]);
  };

  const updateStep = (id: string, patch: Partial<StepRow>) => {
    setSteps(prev => prev.map(s => (s.id === id ? { ...s, ...patch } : s)));
  };

  const removeStep = (id: string) => {
    setSteps(prev => prev.filter(s => s.id !== id));
  };

  if (isLoading && !hydrated) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Agent Scripts"
        description="Checklist shown in Conversations → Agent assist panel. Agents tick steps during a chat; changes apply to all agents on this account."
      />

      <div className="space-y-2">
        <Label className="text-xs">Opening line (optional)</Label>
        <Textarea
          value={openingLine}
          onChange={e => setOpeningLine(e.target.value)}
          rows={2}
          placeholder="Suggested greeting when the conversation opens"
          className="text-sm"
        />
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Checklist steps</Label>
          <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={addStep}>
            <Plus className="w-3 h-3 me-1" />
            Add step
          </Button>
        </div>

        {steps.length === 0 && (
          <p className="text-sm text-muted-foreground">No steps yet. Add at least one step.</p>
        )}

        {steps.map((step, index) => (
          <div
            key={step.id}
            className="flex gap-2 items-start border border-gray-100 rounded-lg p-3 bg-white"
          >
            <GripVertical className="w-4 h-4 text-muted-foreground mt-2 shrink-0" />
            <div className="flex-1 space-y-2 min-w-0">
              <Input
                value={step.label}
                onChange={e => updateStep(step.id, { label: e.target.value })}
                placeholder={`Step ${index + 1} title`}
                className="h-8 text-sm font-medium"
              />
              <Input
                value={step.description}
                onChange={e => updateStep(step.id, { description: e.target.value })}
                placeholder="What the agent should do"
                className="h-8 text-xs"
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="shrink-0 text-muted-foreground hover:text-red-600"
              onClick={() => removeStep(step.id)}
              aria-label="Remove step"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <Button
          type="button"
          disabled={save.isPending || steps.every(s => !s.label.trim())}
          onClick={() => save.mutate()}
        >
          {save.isPending ? 'Saving…' : 'Save script'}
        </Button>
      </div>

      <p className="text-xs text-muted-foreground border-t pt-4">
        Tip: Use <strong>Canned Responses</strong> for quick reply snippets (/greet). Agent Script is the
        step-by-step workflow checklist in the right panel.
      </p>
    </div>
  );
}
