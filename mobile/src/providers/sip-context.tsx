import { createContext, useContext, type ReactNode } from 'react';

export interface SipActions {
  makeCall: (destination: string) => void;
  answerCall: () => void;
  hangup: () => void;
  mute: () => void;
  unmute: () => void;
  hold: () => Promise<void>;
  unhold: () => Promise<void>;
}

const noop = () => {};
const noopAsync = async () => {};

const defaultActions: SipActions = {
  makeCall: noop,
  answerCall: noop,
  hangup: noop,
  mute: noop,
  unmute: noop,
  hold: noopAsync,
  unhold: noopAsync,
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
