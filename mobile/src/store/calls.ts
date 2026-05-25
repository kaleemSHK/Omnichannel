import { create } from 'zustand';
import type { CallSession, AgentState, IncomingCallInfo } from '@/types';

interface CallsState {
  activeCall: CallSession | null;
  incomingCalls: IncomingCallInfo[];
  agentState: AgentState;
  sipRegistered: boolean;
  isMuted: boolean;
  isOnHold: boolean;
  callDurationSec: number;
  setActiveCall: (call: CallSession | null) => void;
  addIncomingCall: (call: IncomingCallInfo) => void;
  removeIncomingCall: (callId: string) => void;
  setAgentState: (state: AgentState) => void;
  setSipRegistered: (v: boolean) => void;
  setMuted: (v: boolean) => void;
  setOnHold: (v: boolean) => void;
  setCallDuration: (sec: number) => void;
}

export const useCallsStore = create<CallsState>((set) => ({
  activeCall: null,
  incomingCalls: [],
  agentState: 'offline',
  sipRegistered: false,
  isMuted: false,
  isOnHold: false,
  callDurationSec: 0,

  setActiveCall: (call) =>
    set({ activeCall: call, isMuted: false, isOnHold: false, callDurationSec: 0 }),
  addIncomingCall: (call) => set((s) => ({ incomingCalls: [...s.incomingCalls, call] })),
  removeIncomingCall: (callId) =>
    set((s) => ({ incomingCalls: s.incomingCalls.filter((c) => c.callId !== callId) })),
  setAgentState: (state) => set({ agentState: state }),
  setSipRegistered: (v) => set({ sipRegistered: v }),
  setMuted: (v) => set({ isMuted: v }),
  setOnHold: (v) => set({ isOnHold: v }),
  setCallDuration: (sec) => set({ callDurationSec: sec }),
}));
