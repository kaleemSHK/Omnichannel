'use client';

import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import {
  Volume2,
  Hash,
  Bot,
  Users,
  GitBranch,
  Clock,
  Webhook,
  Variable,
  Voicemail,
  MessageSquare,
  PhoneForwarded,
  PhoneOff,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import type { IVRNodeType } from '@/types';

// ─── Node metadata ─────────────────────────────────────────────────────────────

export interface IVRNodeMeta {
  icon: React.ElementType;
  label: string;
  color: string;       // Tailwind border+accent color
  bg: string;          // card header bg
  text: string;        // header text color
  category: string;
  description: string;
  hasDefaultOut: boolean;  // single "next" output
  hasDtmfOut: boolean;     // multiple labeled outputs (dtmf, condition)
  hasNoOut: boolean;       // terminal node
}

export const NODE_META: Record<IVRNodeType, IVRNodeMeta> = {
  play: {
    icon: Volume2,
    label: 'Play Message',
    color: 'border-blue-300',
    bg: 'bg-blue-500',
    text: 'text-white',
    category: 'Messaging',
    description: 'Play TTS or audio file',
    hasDefaultOut: true,
    hasDtmfOut: false,
    hasNoOut: false,
  },
  dtmf: {
    icon: Hash,
    label: 'DTMF Menu',
    color: 'border-emerald-300',
    bg: 'bg-emerald-500',
    text: 'text-white',
    category: 'Input',
    description: 'Keypad press options',
    hasDefaultOut: false,
    hasDtmfOut: true,
    hasNoOut: false,
  },
  voicebot: {
    icon: Bot,
    label: 'Voice Bot',
    color: 'border-amber-300',
    bg: 'bg-amber-500',
    text: 'text-white',
    category: 'Input',
    description: 'AI-powered voice intent',
    hasDefaultOut: true,
    hasDtmfOut: false,
    hasNoOut: false,
  },
  transfer: {
    icon: Users,
    label: 'Route to Queue',
    color: 'border-teal-300',
    bg: 'bg-teal-500',
    text: 'text-white',
    category: 'Routing',
    description: 'Send call to agent queue',
    hasDefaultOut: true,
    hasDtmfOut: false,
    hasNoOut: false,
  },
  enqueue: {
    icon: Users,
    label: 'Route to Queue',
    color: 'border-teal-300',
    bg: 'bg-teal-500',
    text: 'text-white',
    category: 'Routing',
    description: 'Send call to agent queue',
    hasDefaultOut: true,
    hasDtmfOut: false,
    hasNoOut: false,
  },
  condition: {
    icon: GitBranch,
    label: 'Condition',
    color: 'border-purple-300',
    bg: 'bg-purple-500',
    text: 'text-white',
    category: 'Logic',
    description: 'Branch on variable value',
    hasDefaultOut: false,
    hasDtmfOut: true,
    hasNoOut: false,
  },
  schedule: {
    icon: Clock,
    label: 'Business Hours',
    color: 'border-indigo-300',
    bg: 'bg-indigo-500',
    text: 'text-white',
    category: 'Logic',
    description: 'Check hours / holiday',
    hasDefaultOut: false,
    hasDtmfOut: true,
    hasNoOut: false,
  },
  webhook: {
    icon: Webhook,
    label: 'HTTP Request',
    color: 'border-orange-300',
    bg: 'bg-orange-500',
    text: 'text-white',
    category: 'Actions',
    description: 'Call external API',
    hasDefaultOut: true,
    hasDtmfOut: false,
    hasNoOut: false,
  },
  set_variable: {
    icon: Variable,
    label: 'Set Variable',
    color: 'border-slate-300',
    bg: 'bg-slate-500',
    text: 'text-white',
    category: 'Actions',
    description: 'Store data for later steps',
    hasDefaultOut: true,
    hasDtmfOut: false,
    hasNoOut: false,
  },
  voicemail: {
    icon: Voicemail,
    label: 'Voicemail',
    color: 'border-pink-300',
    bg: 'bg-pink-500',
    text: 'text-white',
    category: 'Messaging',
    description: 'Record caller message',
    hasDefaultOut: true,
    hasDtmfOut: false,
    hasNoOut: false,
  },
  sms: {
    icon: MessageSquare,
    label: 'Send SMS',
    color: 'border-cyan-300',
    bg: 'bg-cyan-500',
    text: 'text-white',
    category: 'Messaging',
    description: 'Send text message',
    hasDefaultOut: true,
    hasDtmfOut: false,
    hasNoOut: false,
  },
  callback: {
    icon: PhoneForwarded,
    label: 'Schedule Callback',
    color: 'border-lime-300',
    bg: 'bg-lime-500',
    text: 'text-white',
    category: 'Routing',
    description: 'Queue a callback request',
    hasDefaultOut: true,
    hasDtmfOut: false,
    hasNoOut: false,
  },
  hangup: {
    icon: PhoneOff,
    label: 'Hang Up',
    color: 'border-red-300',
    bg: 'bg-red-500',
    text: 'text-white',
    category: 'Terminal',
    description: 'End the call',
    hasDefaultOut: false,
    hasDtmfOut: false,
    hasNoOut: true,
  },
};

// ─── Custom React-Flow node ────────────────────────────────────────────────────

export interface IVRNodeData {
  nodeType: IVRNodeType;
  label: string;
  config: Record<string, unknown>;
  isEntry?: boolean;
  dtmfOptions?: string[];
  conditionBranches?: string[];
  [key: string]: unknown;
}

function IVRNodeCardInner({ data, selected }: NodeProps) {
  const d = data as IVRNodeData;
  const meta = NODE_META[d.nodeType] ?? NODE_META.play;
  const Icon = meta.icon;

  const branches: string[] =
    d.nodeType === 'dtmf'
      ? (d.dtmfOptions as string[] | undefined) ?? ['1', '2', '3']
      : d.nodeType === 'condition'
        ? (d.conditionBranches as string[] | undefined) ?? ['true', 'false']
        : d.nodeType === 'schedule'
          ? ['open', 'closed']
          : [];

  return (
    <div
      className={cn(
        'w-[180px] rounded-xl border-2 bg-white shadow-md transition-shadow select-none',
        meta.color,
        selected && 'shadow-lg ring-2 ring-brand-primary ring-offset-1',
      )}
    >
      {/* Entry badge */}
      {d.isEntry && (
        <div className="absolute -top-5 left-2 text-[10px] font-semibold text-brand-primary tracking-wide uppercase">
          ▶ Entry point
        </div>
      )}

      {/* Header */}
      <div className={cn('flex items-center gap-2 px-3 py-2 rounded-t-[10px]', meta.bg)}>
        <Icon className={cn('w-3.5 h-3.5 shrink-0', meta.text)} />
        <span className={cn('text-[11px] font-semibold truncate', meta.text)}>{meta.label}</span>
      </div>

      {/* Body */}
      <div className="px-3 py-2">
        <p className="text-[12px] font-medium text-gray-900 truncate">{d.label}</p>
        {d.nodeType === 'transfer' && !!d.config.queueKey && (
          <p className="text-[10px] text-muted-foreground mt-0.5 font-mono truncate">
            → {String(d.config.queueKey)}
          </p>
        )}
        {d.nodeType === 'webhook' && !!d.config.url && (
          <p className="text-[10px] text-muted-foreground mt-0.5 font-mono truncate">
            {String(d.config.method ?? 'GET')} …
          </p>
        )}
        {d.nodeType === 'schedule' && !!d.config.timezone && (
          <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
            {String(d.config.timezone)}
          </p>
        )}
        {d.nodeType === 'set_variable' && !!d.config.varName && (
          <p className="text-[10px] text-muted-foreground mt-0.5 font-mono truncate">
            {String(d.config.varName)} = …
          </p>
        )}
      </div>

      {/* DTMF / condition branch labels at bottom */}
      {branches.length > 0 && (
        <div className="border-t border-gray-100 px-3 py-1.5 flex flex-wrap gap-1">
          {branches.map(b => (
            <span
              key={b}
              className="inline-block text-[9px] font-mono font-semibold bg-gray-100 text-gray-600 rounded px-1 py-0.5"
            >
              {b}
            </span>
          ))}
        </div>
      )}

      {/* Handles */}
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !border-2 !border-white !bg-gray-400 !rounded-full"
      />

      {meta.hasDefaultOut && (
        <Handle
          type="source"
          position={Position.Bottom}
          className="!w-3 !h-3 !border-2 !border-white !bg-brand-primary !rounded-full"
        />
      )}

      {meta.hasDtmfOut && branches.length > 0 &&
        branches.map((b, i) => {
          const pct = ((i + 1) / (branches.length + 1)) * 100;
          return (
            <Handle
              key={b}
              id={b}
              type="source"
              position={Position.Bottom}
              style={{ left: `${pct}%` }}
              className="!w-3 !h-3 !border-2 !border-white !bg-brand-primary !rounded-full"
            />
          );
        })}
    </div>
  );
}

export const IVRNodeCard = memo(IVRNodeCardInner);
