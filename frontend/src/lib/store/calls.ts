import { create } from 'zustand';
import type { AgentState, CallSession } from '@/types';

export type ActiveCall = CallSession;

export interface SipControls {
  hangup: () => void;
  toggleMute: () => void;
  toggleHold: () => void;
  answerCall: () => void;
  sendDTMF: (tone: string) => void;
  blindTransfer: (target: string) => void;
}

interface CallsState {
  activeCall: ActiveCall | null;
  incomingCalls: ActiveCall[];
  agentState: AgentState;
  sipRegistered: boolean;
  sipError: string | null;
  muted: boolean;
  held: boolean;
  contactCache: Map<string, string>;

  setActiveCall: (call: ActiveCall | null) => void;
  addIncomingCall: (call: ActiveCall) => void;
  removeIncomingCall: (id: string) => void;
  setAgentState: (state: AgentState) => void;
  setSipRegistered: (v: boolean) => void;
  setSipError: (err: string | null) => void;
  setMuted: (v: boolean) => void;
  setHeld: (v: boolean) => void;
  cacheContact: (phone: string, name: string) => void;
  makeCall: ((destination: string) => void) | null;
  setMakeCall: (fn: ((destination: string) => void) | null) => void;
  sipControls: SipControls | null;
  setSipControls: (controls: SipControls | null) => void;
}

export const useCallsStore = create<CallsState>(set => ({
  activeCall: null,
  incomingCalls: [],
  agentState: 'available',
  sipRegistered: false,
  sipError: null,
  muted: false,
  held: false,
  contactCache: new Map(),
  makeCall: null,
  sipControls: null,

  setActiveCall: call => set({ activeCall: call, muted: false, held: false }),

  addIncomingCall: call =>
    set(s => ({
      incomingCalls: s.incomingCalls.some(c => c.id === call.id)
        ? s.incomingCalls
        : [...s.incomingCalls, call],
    })),

  removeIncomingCall: id =>
    set(s => ({ incomingCalls: s.incomingCalls.filter(c => c.id !== id) })),

  setAgentState: agentState => set({ agentState }),
  setSipRegistered: sipRegistered => set({ sipRegistered }),
  setSipError: sipError => set({ sipError }),
  setMuted: muted => set({ muted }),
  setHeld: held => set({ held }),
  cacheContact: (phone, name) =>
    set(s => {
      const next = new Map(s.contactCache);
      next.set(phone, name);
      return { contactCache: next };
    }),
  setMakeCall: fn => set({ makeCall: fn }),
  setSipControls: controls => set({ sipControls: controls }),
}));
