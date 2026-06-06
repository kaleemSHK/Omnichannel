import { createContext, useContext, type ReactNode } from 'react';

export interface SipActions {
  makeCall: (destination: string) => Promise<boolean>;
  makePeerCall: (targetAgentId: string) => void;
  answerCall: () => void;
  hangup: () => void;
  declineCall: () => void;
  mute: () => void;
  unmute: () => void;
  hold: () => Promise<void>;
  unhold: () => Promise<void>;
  sendDtmf: (digit: string) => void;
}

const noop = () => {};
const noopAsync = async () => {};

const defaultActions: SipActions = {
  makeCall: async () => false,
  makePeerCall: noop,
  answerCall: noop,
  hangup: noop,
  declineCall: noop,
  mute: noop,
  unmute: noop,
  hold: noopAsync,
  unhold: noopAsync,
  sendDtmf: noop,
};

const SipContext = createContext<SipActions>(defaultActions);

export function useSip(): SipActions {
  return useContext(SipContext);
}

export function SipContextProvider({
  value,
  children,
}: {
  value: SipActions;
  children: ReactNode;
}) {
  return <SipContext.Provider value={value}>{children}</SipContext.Provider>;
}
