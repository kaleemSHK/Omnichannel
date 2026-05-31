'use client';

import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select-radix';
import type { AutomationAction, AutomationCondition } from '@/lib/api/settings';
import {
  CONDITION_OPERATORS,
  LANGUAGE_VALUES,
  MESSAGE_TYPE_VALUES,
  PRIORITY_VALUES,
  STATUS_VALUES,
  conditionAttributesForEvent,
  defaultOperatorForAttribute,
  useAutomationLookups,
} from './AutomationLookups';

interface ConditionValueSelectProps {
  condition: AutomationCondition;
  onChange: (values: string[]) => void;
}

export function ConditionValueSelect({ condition, onChange }: ConditionValueSelectProps) {
  const { agents, teams, labels, inboxes, isLoading } = useAutomationLookups();
  const key = condition.attribute_key;
  const value = condition.values[0] ?? '';

  if (isLoading) {
    return (
      <Select disabled>
        <SelectTrigger className="flex-1 min-w-[140px]">
          <SelectValue placeholder="Loading…" />
        </SelectTrigger>
      </Select>
    );
  }

  if (key === 'status') {
    return (
      <Select value={value || undefined} onValueChange={v => onChange([v])}>
        <SelectTrigger className="flex-1 min-w-[140px]">
          <SelectValue placeholder="Select status" />
        </SelectTrigger>
        <SelectContent>
          {STATUS_VALUES.map(o => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  if (key === 'inbox_id') {
    return (
      <Select value={value || undefined} onValueChange={v => onChange([v])}>
        <SelectTrigger className="flex-1 min-w-[140px]">
          <SelectValue placeholder="Select inbox" />
        </SelectTrigger>
        <SelectContent>
          {inboxes.map(inbox => (
            <SelectItem key={inbox.id} value={String(inbox.id)}>
              {inbox.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  if (key === 'team_id') {
    return (
      <Select value={value || undefined} onValueChange={v => onChange([v])}>
        <SelectTrigger className="flex-1 min-w-[140px]">
          <SelectValue placeholder="Select team" />
        </SelectTrigger>
        <SelectContent>
          {teams.map(team => (
            <SelectItem key={team.id} value={String(team.id)}>
              {team.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  if (key === 'assignee_id') {
    return (
      <Select value={value || undefined} onValueChange={v => onChange([v])}>
        <SelectTrigger className="flex-1 min-w-[140px]">
          <SelectValue placeholder="Select agent" />
        </SelectTrigger>
        <SelectContent>
          {agents.map(agent => (
            <SelectItem key={agent.id} value={String(agent.id)}>
              {agent.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  if (key === 'labels') {
    return (
      <Select value={value || undefined} onValueChange={v => onChange([v])}>
        <SelectTrigger className="flex-1 min-w-[140px]">
          <SelectValue placeholder="Select label" />
        </SelectTrigger>
        <SelectContent>
          {labels.map(label => (
            <SelectItem key={label.id} value={label.title}>
              {label.title}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  if (key === 'message_type') {
    return (
      <Select value={value || undefined} onValueChange={v => onChange([v])}>
        <SelectTrigger className="flex-1 min-w-[140px]">
          <SelectValue placeholder="Message type" />
        </SelectTrigger>
        <SelectContent>
          {MESSAGE_TYPE_VALUES.map(o => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  if (key === 'content') {
    return (
      <Input
        className="flex-1 min-w-[140px]"
        value={value}
        onChange={e => onChange([e.target.value])}
        placeholder="Text in message"
      />
    );
  }

  if (key === 'label') {
    return (
      <Select value={value || undefined} onValueChange={v => onChange([v])}>
        <SelectTrigger className="flex-1 min-w-[140px]">
          <SelectValue placeholder="Select label" />
        </SelectTrigger>
        <SelectContent>
          {labels.map(label => (
            <SelectItem key={label.id} value={label.title}>
              {label.title}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  if (key === 'priority') {
    return (
      <Select value={value || undefined} onValueChange={v => onChange([v])}>
        <SelectTrigger className="flex-1 min-w-[140px]">
          <SelectValue placeholder="Select priority" />
        </SelectTrigger>
        <SelectContent>
          {PRIORITY_VALUES.map(o => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  if (key === 'conversation_language') {
    return (
      <Select value={value || undefined} onValueChange={v => onChange([v])}>
        <SelectTrigger className="flex-1 min-w-[140px]">
          <SelectValue placeholder="Select language" />
        </SelectTrigger>
        <SelectContent>
          {LANGUAGE_VALUES.map(o => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  return (
    <Input
      className="flex-1 min-w-[140px]"
      value={value}
      onChange={e => onChange([e.target.value])}
      placeholder="Value"
    />
  );
}

interface ActionParamSelectProps {
  action: AutomationAction;
  onChange: (params: unknown[]) => void;
}

export function ActionParamSelect({ action, onChange }: ActionParamSelectProps) {
  const { agents, teams, labels, isLoading } = useAutomationLookups();
  const name = action.action_name;
  const raw = action.action_params[0];
  const value = raw != null ? String(raw) : '';

  const noParam = ['resolve_conversation', 'snooze_conversation', 'mute_conversation'].includes(name);
  if (noParam) return null;

  if (isLoading) {
    return (
      <Select disabled>
        <SelectTrigger className="flex-1 min-w-[140px]">
          <SelectValue placeholder="Loading…" />
        </SelectTrigger>
      </Select>
    );
  }

  if (name === 'assign_agent') {
    return (
      <Select
        value={value || undefined}
        onValueChange={v => onChange([v])}
      >
        <SelectTrigger className="flex-1 min-w-[140px]">
          <SelectValue placeholder="Select agent" />
        </SelectTrigger>
        <SelectContent>
          {agents.map(agent => (
            <SelectItem key={agent.id} value={String(agent.id)}>
              {agent.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  if (name === 'assign_team' || name === 'send_email_to_team') {
    return (
      <Select
        value={value || undefined}
        onValueChange={v => onChange([v])}
      >
        <SelectTrigger className="flex-1 min-w-[140px]">
          <SelectValue placeholder="Select team" />
        </SelectTrigger>
        <SelectContent>
          {teams.map(team => (
            <SelectItem key={team.id} value={String(team.id)}>
              {team.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  if (name === 'add_label' || name === 'remove_label') {
    return (
      <Select value={value || undefined} onValueChange={v => onChange([v])}>
        <SelectTrigger className="flex-1 min-w-[140px]">
          <SelectValue placeholder="Select label" />
        </SelectTrigger>
        <SelectContent>
          {labels.map(label => (
            <SelectItem key={label.id} value={label.title}>
              {label.title}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  if (name === 'change_priority') {
    return (
      <Select value={value || undefined} onValueChange={v => onChange([v])}>
        <SelectTrigger className="flex-1 min-w-[140px]">
          <SelectValue placeholder="Select priority" />
        </SelectTrigger>
        <SelectContent>
          {PRIORITY_VALUES.filter(p => p.value !== 'none').map(o => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  if (name === 'send_message') {
    return (
      <Textarea
        className="flex-1 min-w-[140px] text-sm"
        rows={2}
        value={value}
        onChange={e => onChange([e.target.value])}
        placeholder="Message to send"
      />
    );
  }

  return (
    <Input
      className="flex-1 min-w-[140px]"
      value={value}
      onChange={e => onChange([e.target.value])}
      placeholder="Value"
    />
  );
}

export function ConditionAttributeSelect({
  value,
  eventName,
  onChange,
}: {
  value: string;
  eventName: string;
  onChange: (key: string) => void;
}) {
  const attrs = conditionAttributesForEvent(eventName);
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-[140px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {attrs.map(a => (
          <SelectItem key={a.value} value={a.value}>
            {a.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function ConditionOperatorSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (op: string) => void;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-[130px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {CONDITION_OPERATORS.map(o => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function ActionNameSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (name: string) => void;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="flex-1 min-w-[160px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {[
          { value: 'assign_agent', label: 'Assign to agent' },
          { value: 'assign_team', label: 'Assign to team' },
          { value: 'add_label', label: 'Add label' },
          { value: 'remove_label', label: 'Remove label' },
          { value: 'send_message', label: 'Send message' },
          { value: 'send_email_to_team', label: 'Send email to team' },
          { value: 'change_priority', label: 'Change priority' },
          { value: 'resolve_conversation', label: 'Resolve conversation' },
          { value: 'snooze_conversation', label: 'Snooze conversation' },
          { value: 'mute_conversation', label: 'Mute conversation' },
        ].map(a => (
          <SelectItem key={a.value} value={a.value}>
            {a.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
